// Network System - Single Responsibility: Handle multiplayer connections and remote player updates

import { System } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

interface NetworkMessage {
  type: 'position_update' | 'player_joined' | 'player_left' | 'heartbeat' | 'player_join' | 'player_update' | 'world_state' | 'init' | 'existing_players' | 'player_leave' | 'position_correction' | 'batch_update';
  squirrelId: string;
  data?: any;
  timestamp: number;
  position?: { x: number; y: number; z: number };
  rotationY?: number;
  players?: any[]; // For existing_players message
  originalPosition?: { x: number; y: number; z: number }; // For position_correction
  updates?: any[]; // For batch_update message
}

// Enhanced connection quality metrics
interface ConnectionMetrics {
  latency: number;
  packetLoss: number;
  reconnectAttempts: number;
  lastHeartbeat: number;
  connectionUptime: number;
  messageCount: number;
  errorCount: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

// Enhanced error types for better diagnostics
enum NetworkErrorType {
  CONNECTION_FAILED = 'connection_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  WEBSOCKET_ERROR = 'websocket_error',
  MESSAGE_PARSE_ERROR = 'message_parse_error',
  HEARTBEAT_TIMEOUT = 'heartbeat_timeout',
  RECONNECTION_FAILED = 'reconnection_failed',
  SERVER_ERROR = 'server_error'
}

interface NetworkError {
  type: NetworkErrorType;
  message: string;
  timestamp: number;
  details?: any;
  recoverable: boolean;
}

export class NetworkSystem extends System {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for better resilience
  private heartbeatInterval: any = null;
  private heartbeatTimeout: any = null;
  private isConnecting = false;
  private localSquirrelId: string | null = null;
  
  // Enhanced connection monitoring
  private connectionStartTime: number = 0;
  private heartbeatResponses: number[] = []; // Track last 10 heartbeats for latency
  private pendingHeartbeats: Map<number, number> = new Map(); // timestamp -> sent time
  private messageCount: number = 0;
  private errorCount: number = 0;
  private connectionMetrics: ConnectionMetrics;
  
  // Enhanced error handling
  private errorHistory: NetworkError[] = [];
  private maxErrorHistory = 50;
  private connectionQualityCheckInterval: any = null;
  
  // Connection quality throttling
  private lastQualityUpdate: number = 0;
  private lastQualityValue: ConnectionMetrics['quality'] = 'poor';
  
  // TASK URGENTA.1: Request Batching & Throttling
  private batchedUpdates: any[] = [];
  private batchTimeout: any = null;
  private batchInterval = 500; // 500ms batching window
  private lastPositionUpdate = 0;
  private positionUpdateThrottle = 100; // 100ms minimum between position updates
  
  constructor(eventBus: EventBus) {
    super(eventBus, ['network'], 'NetworkSystem');
    
    // Initialize connection metrics
    this.connectionMetrics = {
      latency: 0,
      packetLoss: 0,
      reconnectAttempts: 0,
      lastHeartbeat: 0,
      connectionUptime: 0,
      messageCount: 0,
      errorCount: 0,
      quality: 'poor'
    };
    
    // Listen for local player movement to broadcast
    this.eventBus.subscribe(GameEvents.PLAYER_MOVED, this.handleLocalPlayerMove.bind(this));
    
    // Start connection quality monitoring
    this.startConnectionQualityMonitoring();
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.websocket?.readyState === WebSocket.OPEN) {
      Logger.debug(LogCategory.NETWORK, '🔄 Connection already in progress or established');
      return;
    }

    this.isConnecting = true;
    this.connectionMetrics.reconnectAttempts = this.reconnectAttempts;
    
    try {
      Logger.info(LogCategory.NETWORK, `🔄 Attempting connection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      // TEMPORARY REVERT: Use session-based ID to test remote player visibility
      // Generate a unique squirrel ID for each browser window/tab
      const newSquirrelId = crypto.randomUUID();
      this.localSquirrelId = newSquirrelId;
      
      // Store the ID for this session only (not persistent across browser restarts)
      sessionStorage.setItem('squirrelId', newSquirrelId);
      
      Logger.info(LogCategory.NETWORK, `🆕 Generated unique squirrel ID for this session: ${newSquirrelId}`);
      
      // Get authentication token with enhanced error handling
      const authResponse = await this.authenticatePlayer(this.localSquirrelId!);
      const authData = authResponse;
      
      // Update local squirrel ID with what the server returned (in case of session restoration)
      this.localSquirrelId = authData.squirrelId;
      sessionStorage.setItem('squirrelId', authData.squirrelId);
      
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const wsUrl = `${apiBase.replace('http', 'ws')}/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      
      Logger.info(LogCategory.NETWORK, `🌐 Connecting to: ${wsUrl} (ID: ${this.localSquirrelId})`);
      
      this.websocket = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
      
    } catch (error) {
      const networkError: NetworkError = {
        type: NetworkErrorType.CONNECTION_FAILED,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error,
        recoverable: this.reconnectAttempts < this.maxReconnectAttempts
      };
      
      this.recordError(networkError);
      Logger.error(LogCategory.NETWORK, '❌ Connection failed', error);
      
      // Don't re-throw the error to prevent browser console pollution
      // The error is already logged and recorded in our error system
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private async authenticatePlayer(squirrelId: string): Promise<any> {
    try {
      Logger.debug(LogCategory.NETWORK, `🔐 Attempting authentication for squirrel: ${squirrelId}`);
      
      const authUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/join?squirrelId=${squirrelId}`;
      Logger.debug(LogCategory.NETWORK, `🌐 Authentication URL: ${authUrl}`);
      
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      Logger.debug(LogCategory.NETWORK, `📡 Auth response status: ${authResponse.status} ${authResponse.statusText}`);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        Logger.error(LogCategory.NETWORK, `❌ Server returned error: ${authResponse.status} - ${errorText}`);
        throw new Error(`Authentication failed: ${authResponse.status} - ${errorText}`);
      }
      
      const authData = await authResponse.json();
      Logger.info(LogCategory.NETWORK, `✅ Authentication successful for ${squirrelId}`);
      return authData;
      
    } catch (error) {
      const networkError: NetworkError = {
        type: NetworkErrorType.AUTHENTICATION_FAILED,
        message: `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error,
        recoverable: false // Authentication failures are not recoverable
      };
      
      this.recordError(networkError);
      Logger.error(LogCategory.NETWORK, '❌ Authentication failed', error);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      this.connectionStartTime = Date.now();
      this.connectionMetrics.connectionUptime = 0;
      this.connectionMetrics.messageCount = 0;
      this.connectionMetrics.errorCount = 0;
      
      Logger.info(LogCategory.NETWORK, '✅ Connected to multiplayer server');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.eventBus.emit(GameEvents.MULTIPLAYER_CONNECTED);
      
      // Notify systems that websocket is ready
      this.eventBus.emit('network.websocket_ready', this.websocket);
      
      // Update connection quality
      this.updateConnectionQuality('excellent');
    };

    this.websocket.onmessage = (event) => {
      this.messageCount++;
      this.connectionMetrics.messageCount = this.messageCount;
      
      Logger.debug(LogCategory.NETWORK, 'RAW WEBSOCKET MESSAGE DATA:', event.data);
      try {
        const message: NetworkMessage = JSON.parse(event.data);
        this.handleNetworkMessage(message);
      } catch (error) {
        const networkError: NetworkError = {
          type: NetworkErrorType.MESSAGE_PARSE_ERROR,
          message: `Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: { rawData: event.data, error },
          recoverable: true
        };
        
        this.recordError(networkError);
        Logger.error(LogCategory.NETWORK, '❌ Failed to parse message', error);
      }
    };

    this.websocket.onclose = (event) => {
      const wasClean = event.wasClean;
      const code = event.code;
      const reason = event.reason;
      
      Logger.info(LogCategory.NETWORK, `🔴 Connection closed - Clean: ${wasClean}, Code: ${code}, Reason: ${reason}`);
      
      this.stopHeartbeat();
      this.updateConnectionQuality('poor');
      
      // Record connection close details
      if (!wasClean) {
        const networkError: NetworkError = {
          type: NetworkErrorType.WEBSOCKET_ERROR,
          message: `Connection closed unexpectedly - Code: ${code}, Reason: ${reason}`,
          timestamp: Date.now(),
          details: { code, reason, wasClean },
          recoverable: true
        };
        
        this.recordError(networkError);
      }
      
      this.scheduleReconnect();
    };

    this.websocket.onerror = (error) => {
      const networkError: NetworkError = {
        type: NetworkErrorType.WEBSOCKET_ERROR,
        message: 'WebSocket error occurred',
        timestamp: Date.now(),
        details: error,
        recoverable: true
      };
      
      this.recordError(networkError);
      Logger.error(LogCategory.NETWORK, '⚠️ WebSocket error', error);
    };
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, '📨 RAW WEBSOCKET MESSAGE RECEIVED:', message);
    
    // Skip our own messages, but only if we have a valid squirrelId
    if (message.squirrelId && message.squirrelId === this.localSquirrelId) {
      Logger.debug(LogCategory.NETWORK, '🔄 Skipping own message from:', message.squirrelId);
      return;
    }

    Logger.info(LogCategory.NETWORK, '🎯 PROCESSING REMOTE MESSAGE:', message.type, 'from:', message.squirrelId || 'server');

    switch (message.type) {
      case 'init':
        Logger.info(LogCategory.NETWORK, '🚀 Server initialization message received');
        this.handleInitMessage(message);
        break;
      case 'existing_players':
        Logger.debug(LogCategory.NETWORK, '👥 HANDLING EXISTING PLAYERS');
        this.handleExistingPlayers(message);
        break;
      case 'position_update':
      case 'player_update':
        Logger.debug(LogCategory.NETWORK, '📍 HANDLING POSITION UPDATE for:', message.squirrelId);
        this.handleRemotePlayerUpdate(message);
        break;
      case 'player_joined':
      case 'player_join':
        Logger.debug(LogCategory.NETWORK, '🎯 HANDLING PLAYER JOINED for:', message.squirrelId);
        this.handlePlayerJoined(message);
        break;
      case 'player_left':
      case 'player_leave':
        Logger.debug(LogCategory.NETWORK, '👋 HANDLING PLAYER LEFT for:', message.squirrelId);
        this.handlePlayerLeft(message);
        break;
      case 'world_state':
        Logger.debug(LogCategory.NETWORK, '🌍 HANDLING WORLD STATE');
        this.handleWorldState(message);
        break;
      case 'position_correction':
        Logger.debug(LogCategory.NETWORK, '🔧 HANDLING POSITION CORRECTION');
        this.handlePositionCorrection(message);
        break;
      case 'heartbeat':
        Logger.debug(LogCategory.NETWORK, '💓 HEARTBEAT received');
        this.handleHeartbeatResponse(message);
        break;
      case 'batch_update':
        Logger.debug(LogCategory.NETWORK, '🔄 HANDLING BATCH UPDATE');
        this.handleBatchUpdate(message);
        break;
      default:
        Logger.debug(LogCategory.NETWORK, '❓ UNKNOWN MESSAGE TYPE:', message.type);
    }
  }

  private handleHeartbeatResponse(message: NetworkMessage): void {
    const now = Date.now();
    this.connectionMetrics.lastHeartbeat = now;
    
    // Calculate latency if we have a pending heartbeat
    if (message.timestamp && this.pendingHeartbeats.has(message.timestamp)) {
      const sentTime = this.pendingHeartbeats.get(message.timestamp)!;
      const latency = now - sentTime;
      
      this.heartbeatResponses.push(latency);
      if (this.heartbeatResponses.length > 10) {
        this.heartbeatResponses.shift(); // Keep only last 10
      }
      
      // Calculate average latency
      const avgLatency = this.heartbeatResponses.reduce((a, b) => a + b, 0) / this.heartbeatResponses.length;
      this.connectionMetrics.latency = avgLatency;
      
      Logger.debug(LogCategory.NETWORK, `💓 Heartbeat latency: ${latency}ms (avg: ${avgLatency.toFixed(1)}ms)`);
      
      // Update connection quality based on latency
      if (avgLatency < 50) {
        this.updateConnectionQuality('excellent');
      } else if (avgLatency < 100) {
        this.updateConnectionQuality('good');
      } else if (avgLatency < 200) {
        this.updateConnectionQuality('fair');
      } else {
        this.updateConnectionQuality('poor');
      }
    }
    
    this.pendingHeartbeats.delete(message.timestamp);
  }

  private handleRemotePlayerUpdate(message: NetworkMessage): void {
    const { squirrelId, data, position, rotationY } = message;
    
    // Extract position and rotation from either data object or direct properties
    const playerPosition = data?.position || position || { x: 0, y: 2, z: 0 };
    const playerRotation = data?.rotation?.y || rotationY || 0;
    
    Logger.debug(LogCategory.NETWORK, '🔄 EMITTING remote_player_state for:', squirrelId, 'at position:', playerPosition);
    
    // FIXED: Emit player state for PlayerManager and other systems with correct data structure
    this.eventBus.emit('remote_player_state', {
      squirrelId,
      position: playerPosition,
      rotationY: playerRotation, // FIXED: Use rotationY directly instead of nested rotation object
      velocity: data?.velocity,
      timestamp: message.timestamp || performance.now()
    });

    Logger.debugExpensive(LogCategory.NETWORK, () => 
      `🎮 Updated player ${squirrelId} at (${playerPosition.x.toFixed(1)}, ${playerPosition.z.toFixed(1)})`
    );
  }

  private handlePlayerJoined(message: NetworkMessage): void {
    const { squirrelId, data, position, rotationY } = message;
    
    Logger.debug(LogCategory.NETWORK, `🎯 Remote player joined: ${squirrelId}`);
    Logger.debugExpensive(LogCategory.NETWORK, () => `🎯 PLAYER JOINED - about to emit remote_player_state for: ${squirrelId}`);
    Logger.debugExpensive(LogCategory.NETWORK, () => `🎯 PLAYER JOINED - message data: ${JSON.stringify({ squirrelId, data, position, rotationY })}`);
    
    // TASK 3 FIX: Add validation for player join data
    if (!squirrelId || typeof squirrelId !== 'string') {
      Logger.error(LogCategory.NETWORK, '❌ Invalid squirrelId in player_joined:', squirrelId);
      return;
    }
    
    // Extract position and rotation from either data object or direct properties
    const playerPosition = data?.position || position || { x: 0, y: 2, z: 0 };
    const playerRotation = rotationY || data?.rotationY || 0;

    // TASK 3 FIX: Validate position data
    if (!playerPosition || typeof playerPosition.x !== 'number' || typeof playerPosition.y !== 'number' || typeof playerPosition.z !== 'number') {
      Logger.error(LogCategory.NETWORK, `❌ Invalid position data for player ${squirrelId}:`, playerPosition);
      return;
    }

    // FIXED: Emit player state to create the remote player with correct data structure
    this.eventBus.emit('remote_player_state', {
      squirrelId,
      position: playerPosition,
      rotationY: playerRotation,
      timestamp: message.timestamp || performance.now()
    });
  }

  private handlePlayerLeft(message: NetworkMessage): void {
    const { squirrelId } = message;
    Logger.info(LogCategory.NETWORK, `👋 Remote player left: ${squirrelId}`);
    this.eventBus.emit('player_disconnected', { squirrelId });
  }

  private handleWorldState(message: NetworkMessage): void {
    Logger.debug(LogCategory.NETWORK, '🌍 World state received');
    // Handle world state updates
    if (message.data) {
      this.eventBus.emit('world_state_update', message.data);
    }
  }

  private handlePositionCorrection(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, '🔧 Position correction received from server:', {
      original: message.originalPosition,
      corrected: message.position
    });
    
    // TASK 3 FIX: Apply server position correction to local player
    if (message.position && message.squirrelId === this.localSquirrelId) {
      // Emit event to update local player position
      this.eventBus.emit('player_position_corrected', {
        position: message.position,
        originalPosition: message.originalPosition
      });
      
      Logger.info(LogCategory.NETWORK, '✅ Applied server position correction to local player');
    }
  }

  // TASK URGENTA.1: Request Batching & Throttling
  private addToBatch(update: any): void {
    this.batchedUpdates.push(update);
    
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.sendBatchedUpdates();
      }, this.batchInterval);
    }
  }

  // TASK URGENTA.5: Retry logic with exponential backoff
  private async retryWithBackoff<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error; // Last attempt failed
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
        Logger.warn(LogCategory.NETWORK, `🔄 Retry attempt ${attempt + 1}/${maxRetries} in ${delay.toFixed(0)}ms`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries reached');
  }

  private sendBatchedUpdates(): void {
    if (this.batchedUpdates.length > 0) {
      const batchedMessage: NetworkMessage = {
        type: 'batch_update',
        squirrelId: this.localSquirrelId || 'unknown',
        updates: this.batchedUpdates,
        timestamp: performance.now()
      };
      
      Logger.debug(LogCategory.NETWORK, `📦 Sending batch of ${this.batchedUpdates.length} updates`);
      
      // TASK URGENTA.5: Use retry logic for batched updates
      this.retryWithBackoff(async () => {
        if (this.websocket?.readyState === WebSocket.OPEN) {
          this.websocket.send(JSON.stringify(batchedMessage));
          this.messageCount++;
          this.connectionMetrics.messageCount = this.messageCount;
        } else {
          throw new Error('WebSocket not open');
        }
      }).catch(error => {
        const networkError: NetworkError = {
          type: NetworkErrorType.WEBSOCKET_ERROR,
          message: `Failed to send batched updates after retries: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          details: { batchedMessage, error },
          recoverable: true
        };
        
        this.recordError(networkError);
        Logger.error(LogCategory.NETWORK, '❌ Failed to send batched updates after retries', error);
      });
      
      this.batchedUpdates = [];
    }
    this.batchTimeout = null;
  }

  private handleLocalPlayerMove(data: any): void {
    Logger.debugExpensive(LogCategory.NETWORK, () => `🎯 RECEIVED PLAYER_MOVED EVENT! Data: ${JSON.stringify(data)}`);
    
    // TASK URGENTA.1: Position update throttling
    const now = performance.now();
    if (now - this.lastPositionUpdate < this.positionUpdateThrottle) {
      Logger.debug(LogCategory.NETWORK, '⏱️ Throttling position update');
      return;
    }
    this.lastPositionUpdate = now;
    
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const update = {
        type: 'player_update',
        squirrelId: this.localSquirrelId || 'unknown',
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotationY: data.rotation.y,
        timestamp: performance.now()
      };
      
      // TASK URGENTA.1: Add to batch instead of sending immediately
      this.addToBatch(update);
      
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `📦 Added position update to batch: (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`
      );
    } else {
      Logger.warn(LogCategory.NETWORK, '❌ CANNOT SEND - WebSocket not open. State:', this.websocket?.readyState);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const heartbeatId = Date.now();
        const heartbeatMessage = {
          type: 'heartbeat',
          squirrelId: this.localSquirrelId,
          timestamp: heartbeatId
        };
        
        try {
          this.websocket.send(JSON.stringify(heartbeatMessage));
          this.pendingHeartbeats.set(heartbeatId, Date.now());
          
          // Set timeout for heartbeat response
          this.heartbeatTimeout = setTimeout(() => {
            if (this.pendingHeartbeats.has(heartbeatId)) {
              this.pendingHeartbeats.delete(heartbeatId);
              this.handleHeartbeatTimeout();
            }
          }, 10000); // TASK URGENTA.2: Increased from 5 to 10 seconds
          
        } catch (error) {
          const networkError: NetworkError = {
            type: NetworkErrorType.HEARTBEAT_TIMEOUT,
            message: `Failed to send heartbeat: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
            details: { heartbeatId, error },
            recoverable: true
          };
          
          this.recordError(networkError);
          Logger.error(LogCategory.NETWORK, '❌ Failed to send heartbeat', error);
        }
      }
    }, 90000); // TASK URGENTA.2: Increased from 30 to 90 seconds
  }

  private handleHeartbeatTimeout(): void {
    const networkError: NetworkError = {
      type: NetworkErrorType.HEARTBEAT_TIMEOUT,
      message: 'Heartbeat timeout - no response from server',
      timestamp: Date.now(),
      details: { pendingHeartbeats: this.pendingHeartbeats.size },
      recoverable: true
    };
    
    this.recordError(networkError);
    Logger.warn(LogCategory.NETWORK, '⏰ Heartbeat timeout - connection may be unstable');
    this.updateConnectionQuality('critical');
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
    
    this.pendingHeartbeats.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const networkError: NetworkError = {
        type: NetworkErrorType.RECONNECTION_FAILED,
        message: `Max reconnection attempts reached (${this.maxReconnectAttempts})`,
        timestamp: Date.now(),
        details: { reconnectAttempts: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts },
        recoverable: false
      };
      
      this.recordError(networkError);
      Logger.error(LogCategory.NETWORK, '💥 Max reconnection attempts reached');
      this.updateConnectionQuality('critical');
      return;
    }

    this.reconnectAttempts++;
    this.connectionMetrics.reconnectAttempts = this.reconnectAttempts;
    
    // Enhanced exponential backoff with jitter
    const baseDelay = 1000;
    const maxDelay = 30000;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = exponentialDelay + jitter;
    
    Logger.info(LogCategory.NETWORK, `🔄 Reconnecting in ${delay.toFixed(0)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startConnectionQualityMonitoring(): void {
    this.connectionQualityCheckInterval = setInterval(() => {
      this.updateConnectionMetrics();
    }, 120000); // TASK URGENTA.2: Increased from 60 to 120 seconds
  }

  private updateConnectionMetrics(): void {
    if (this.connectionStartTime > 0) {
      this.connectionMetrics.connectionUptime = Date.now() - this.connectionStartTime;
    }
    
    this.connectionMetrics.errorCount = this.errorCount;
    
    // Calculate packet loss based on heartbeat responses
    if (this.heartbeatResponses.length > 0) {
      const totalHeartbeats = this.messageCount;
      const successfulHeartbeats = this.heartbeatResponses.length;
      this.connectionMetrics.packetLoss = Math.max(0, (totalHeartbeats - successfulHeartbeats) / totalHeartbeats * 100);
    }
    
    // Emit connection quality update
    this.eventBus.emit('network.connection_quality', this.connectionMetrics);
  }

  private updateConnectionQuality(quality: ConnectionMetrics['quality']): void {
    const now = Date.now();
    
    // Throttle connection quality updates to prevent console spam
    // Only update if quality changed or if it's been more than 5 seconds
    if (quality !== this.lastQualityValue || now - this.lastQualityUpdate > 5000) {
      this.connectionMetrics.quality = quality;
      this.lastQualityValue = quality;
      this.lastQualityUpdate = now;
      
      Logger.debug(LogCategory.NETWORK, `📊 Connection quality: ${quality}`);
      this.eventBus.emit('network.connection_quality', this.connectionMetrics);
    }
  }

  private recordError(error: NetworkError): void {
    this.errorCount++;
    this.connectionMetrics.errorCount = this.errorCount;
    
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift(); // Keep only recent errors
    }
    
    // Emit error event for UI updates
    this.eventBus.emit('network.error', error);
  }

  update(_deltaTime: number): void {
    // Connection metrics are updated via the interval timer, not every frame
    // This prevents excessive event emissions
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.connectionQualityCheckInterval) {
      clearInterval(this.connectionQualityCheckInterval);
      this.connectionQualityCheckInterval = null;
    }
    
    // TASK URGENTA.1: Send any remaining batched updates before disconnecting
    if (this.batchedUpdates.length > 0) {
      Logger.debug(LogCategory.NETWORK, `📦 Sending final batch of ${this.batchedUpdates.length} updates before disconnect`);
      this.sendBatchedUpdates();
    }
    
    // Clear batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }
    
    this.updateConnectionQuality('poor');
  }

  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  // TASK URGENTA.6: Enhanced monitoring and analytics
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.connectionMetrics };
  }

  getErrorHistory(): NetworkError[] {
    return [...this.errorHistory];
  }

  getConnectionQuality(): string {
    return this.connectionMetrics.quality;
  }

  // TASK URGENTA.6: Usage tracking for DO optimization
  getUsageStats(): {
    totalMessages: number;
    batchedMessages: number;
    averageBatchSize: number;
    retryCount: number;
    lastBatchTime: number;
    uptime: number;
  } {
    const now = performance.now();
    return {
      totalMessages: this.messageCount,
      batchedMessages: this.batchedUpdates.length,
      averageBatchSize: this.batchedUpdates.length > 0 ? this.batchedUpdates.length : 0,
      retryCount: this.errorCount,
      lastBatchTime: this.lastPositionUpdate,
      uptime: this.connectionStartTime > 0 ? now - this.connectionStartTime : 0
    };
  }

  // TASK URGENTA.6: Alert system for approaching limits
  checkUsageLimits(): {
    approachingLimit: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const stats = this.getUsageStats();
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let approachingLimit = false;

    // Check message frequency
    if (stats.totalMessages > 1000) {
      warnings.push('High message count detected');
      recommendations.push('Consider increasing batching interval');
      approachingLimit = true;
    }

    // Check error rate
    if (stats.retryCount > 10) {
      warnings.push('High error rate detected');
      recommendations.push('Check network stability and reduce update frequency');
      approachingLimit = true;
    }

    // Check batch efficiency
    if (stats.averageBatchSize < 2) {
      warnings.push('Low batch efficiency');
      recommendations.push('Consider reducing batching interval for better efficiency');
    }

    return { approachingLimit, warnings, recommendations };
  }

  private handleInitMessage(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, '🚀 Server initialization message received');
    
    // The init message may contain session restoration data or world state
    if (message.data?.existingPlayers) {
      Logger.debug(LogCategory.NETWORK, '👥 Server sent existing players:', message.data.existingPlayers);
      for (const playerData of message.data.existingPlayers) {
        if (playerData.squirrelId !== this.localSquirrelId) {
          this.handlePlayerJoined({
            type: 'player_joined',
            squirrelId: playerData.squirrelId,
            position: playerData.position,
            rotationY: playerData.rotationY,
            timestamp: performance.now()
          } as NetworkMessage);
        }
      }
    }
    
    // Server confirms our squirrel ID
    if (message.data?.confirmedSquirrelId) {
      Logger.info(LogCategory.NETWORK, '✅ Server confirmed squirrel ID:', message.data.confirmedSquirrelId);
      this.localSquirrelId = message.data.confirmedSquirrelId;
      sessionStorage.setItem('squirrelId', message.data.confirmedSquirrelId);
    }
  }

  private handleExistingPlayers(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, '👥 EXISTING PLAYERS MESSAGE received:', message);
    
    // The existing_players message has a players array
    if (message.players) {
      Logger.info(LogCategory.NETWORK, '👥 Processing existing players:', message.players.length);
      for (const playerData of message.players) {
        if (playerData.squirrelId !== this.localSquirrelId) {
          Logger.debug(LogCategory.NETWORK, '🎯 Creating existing player:', playerData.squirrelId);
          
          // TASK 3 FIX: Add validation before creating existing player
          if (!playerData.position || typeof playerData.position.x !== 'number' || typeof playerData.position.y !== 'number' || typeof playerData.position.z !== 'number') {
            Logger.warn(LogCategory.NETWORK, `⚠️ Invalid position data for existing player ${playerData.squirrelId}:`, playerData.position);
            continue;
          }
          
          this.handlePlayerJoined({
            type: 'player_joined',
            squirrelId: playerData.squirrelId,
            position: playerData.position,
            rotationY: playerData.rotationY,
            timestamp: performance.now()
          } as NetworkMessage);
        }
      }
    } else {
      Logger.warn(LogCategory.NETWORK, '⚠️ No players array in existing_players message');
    }
  }

  private handleBatchUpdate(message: NetworkMessage): void {
    Logger.debug(LogCategory.NETWORK, '🔄 HANDLING BATCH UPDATE');
    
    if (message.updates) {
      for (const update of message.updates) {
        this.handleRemotePlayerUpdate(update as NetworkMessage);
      }
    } else {
      Logger.warn(LogCategory.NETWORK, '⚠️ No updates in batch_update message');
    }
  }
} 