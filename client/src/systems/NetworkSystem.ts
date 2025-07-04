// Network System - Single Responsibility: Handle multiplayer connections and remote player updates

import { System } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

// MVP 7 Task 7: Client version for protocol compatibility
const CLIENT_VERSION = '1.0.0';
const PROTOCOL_VERSION = 'hidden-walnuts-v1';

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
  SERVER_ERROR = 'server_error',
  BROWSER_INCOMPATIBLE = 'browser_incompatible',
  PROTOCOL_VERSION_MISMATCH = 'protocol_version_mismatch'
}

interface NetworkError {
  type: NetworkErrorType;
  message: string;
  timestamp: number;
  details?: any;
  recoverable: boolean;
}

// MVP 7 Task 7: Connection state management
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed'
}

export class NetworkSystem extends System {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for better resilience
  private heartbeatInterval: any = null;
  private heartbeatTimeout: any = null;
  private localSquirrelId: string | null = null;
  
  // MVP 7 Task 7: Enhanced connection state management
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  
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
    
    // MVP 7 Task 7: Browser compatibility check
    if (!this.checkBrowserCompatibility()) {
      const error: NetworkError = {
        type: NetworkErrorType.BROWSER_INCOMPATIBLE,
        message: 'Browser does not support required WebSocket features',
        timestamp: Date.now(),
        details: { userAgent: navigator.userAgent },
        recoverable: false
      };
      this.recordError(error);
      throw new Error('Browser incompatible with multiplayer features');
    }
    
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
    
    Logger.info(LogCategory.NETWORK, `🚀 NetworkSystem initialized - Client v${CLIENT_VERSION}, Protocol: ${PROTOCOL_VERSION}`);
  }

  // MVP 7 Task 7: Browser compatibility validation
  private checkBrowserCompatibility(): boolean {
    // Check WebSocket support
    if (typeof WebSocket === 'undefined') {
      Logger.error(LogCategory.NETWORK, '❌ WebSocket not supported');
      return false;
    }
    
    // Check crypto API for UUID generation
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      Logger.error(LogCategory.NETWORK, '❌ Crypto API not supported');
      return false;
    }
    
    // Check JSON support
    if (typeof JSON === 'undefined') {
      Logger.error(LogCategory.NETWORK, '❌ JSON not supported');
      return false;
    }
    
    // Check sessionStorage
    if (typeof sessionStorage === 'undefined') {
      Logger.warn(LogCategory.NETWORK, '⚠️ SessionStorage not supported - sessions will not persist');
    }
    
    Logger.debug(LogCategory.NETWORK, '✅ Browser compatibility check passed');
    return true;
  }

  // MVP 7 Task 7: Enhanced connection state management
  private setConnectionState(newState: ConnectionState): void {
    const oldState = this.connectionState;
    this.connectionState = newState;
    
    if (oldState !== newState) {
      Logger.debug(LogCategory.NETWORK, `🔄 Connection state: ${oldState} → ${newState}`);
      this.eventBus.emit('network.state_changed', {
        from: oldState,
        to: newState,
        timestamp: Date.now()
      });
    }
  }

  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTING || this.websocket?.readyState === WebSocket.OPEN) {
      Logger.debug(LogCategory.NETWORK, '🔄 Connection already in progress or established');
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);
    this.connectionMetrics.reconnectAttempts = this.reconnectAttempts;
    
    try {
      Logger.debug(LogCategory.NETWORK, `🔄 Attempting connection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      
      // POSITION PERSISTENCE FIX: Use persistent squirrelId from sessionStorage
      // This ensures the same player is identified across browser refreshes
      let squirrelId = sessionStorage.getItem('squirrelId');
      if (!squirrelId) {
        // Only generate new ID if none exists (first time player)
        // Use UUID format as the server expects this format
        squirrelId = crypto.randomUUID();
        sessionStorage.setItem('squirrelId', squirrelId);
        Logger.debug(LogCategory.NETWORK, `🆕 Generated new persistent squirrel ID: ${squirrelId}`);
      } else {
        Logger.debug(LogCategory.NETWORK, `🔄 Using existing persistent squirrel ID: ${squirrelId}`);
      }
      
      this.localSquirrelId = squirrelId;
      
      this.setConnectionState(ConnectionState.AUTHENTICATING);
      
      // Get authentication token with enhanced error handling
      const authResponse = await this.authenticatePlayer(this.localSquirrelId!);
      const authData = authResponse;
      
      // POSITION PERSISTENCE FIX: Don't overwrite squirrelId - keep the one used for authentication
      // The server expects the same squirrelId that was used in the auth request
      
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      // MVP 7 Task 7: Include client version and protocol in WebSocket URL
      const wsUrl = `${apiBase.replace('http', 'ws')}/ws?squirrelId=${authData.squirrelId}&token=${authData.token}&version=${CLIENT_VERSION}&protocol=${PROTOCOL_VERSION}`;
      
      Logger.debug(LogCategory.NETWORK, `🌐 API Base URL: ${apiBase}`);
      Logger.debug(LogCategory.NETWORK, `🌐 WebSocket URL: ${wsUrl}`);
      Logger.debug(LogCategory.NETWORK, `🌐 Connecting to: ${wsUrl} (ID: ${this.localSquirrelId})`);
      
      // MVP 7 Task 7: Enhanced WebSocket creation with protocol specification
      this.websocket = new WebSocket(wsUrl, [PROTOCOL_VERSION]);
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
      
      this.setConnectionState(ConnectionState.FAILED);
      
      // Don't re-throw the error to prevent browser console pollution
      // The error is already logged and recorded in our error system
      this.scheduleReconnect();
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
      Logger.debug(LogCategory.NETWORK, `✅ Authentication successful for ${squirrelId}`);
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

  // MVP 7 Task 7: Enhanced WebSocket handlers with comprehensive error handling and reconnection
  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      Logger.info(LogCategory.NETWORK, '🔗 WebSocket connected');
      this.setConnectionState(ConnectionState.CONNECTED);
      this.connectionStartTime = Date.now();
      this.connectionMetrics.connectionUptime = 0;
      this.connectionMetrics.messageCount = 0;
      this.connectionMetrics.errorCount = 0;
      
      // MVP 7 Task 7: Protocol validation
      if (this.websocket!.protocol !== PROTOCOL_VERSION) {
        Logger.warn(LogCategory.NETWORK, `⚠️ Protocol mismatch: expected ${PROTOCOL_VERSION}, got ${this.websocket!.protocol}`);
        
        const protocolError: NetworkError = {
          type: NetworkErrorType.PROTOCOL_VERSION_MISMATCH,
          message: `Protocol version mismatch: expected ${PROTOCOL_VERSION}, got ${this.websocket!.protocol}`,
          timestamp: Date.now(),
          details: { expected: PROTOCOL_VERSION, actual: this.websocket!.protocol },
          recoverable: false
        };
        this.recordError(protocolError);
      }
      
      // MVP 7 Task 7: Reset reconnection attempts on successful connection
      if (this.reconnectAttempts > 0) {
        Logger.info(LogCategory.NETWORK, `✅ Reconnection successful after ${this.reconnectAttempts} attempts`);
        this.reconnectAttempts = 0;
        this.connectionMetrics.reconnectAttempts = 0;
      }
      
      this.updateConnectionQuality('excellent');
      this.startHeartbeat();
      this.startConnectionQualityMonitoring();
      
      // MVP 7 Task 7: Enhanced connection events with version info
      this.eventBus.emit(GameEvents.MULTIPLAYER_CONNECTED);
      this.eventBus.emit('network.websocket_ready', this.websocket);
      this.eventBus.emit('network.connected', {
        timestamp: Date.now(),
        reconnectAttempts: this.reconnectAttempts,
        connectionDuration: 0,
        quality: this.connectionMetrics.quality,
        clientVersion: CLIENT_VERSION,
        protocol: this.websocket!.protocol,
        squirrelId: this.localSquirrelId
      });
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
      
      Logger.warn(LogCategory.NETWORK, `🔌 WebSocket closed: code=${code}, reason=${reason}, clean=${wasClean}`);
      this.stopHeartbeat();
      
      // MVP 7 Task 7: Enhanced reconnection logic based on close codes
      const shouldReconnect = this.shouldAttemptReconnection(code, reason);
      
      if (shouldReconnect) {
        this.setConnectionState(ConnectionState.RECONNECTING);
        this.updateConnectionQuality('poor');
        this.scheduleReconnect();
      } else {
        this.setConnectionState(ConnectionState.DISCONNECTED);
        this.updateConnectionQuality('critical');
        Logger.info(LogCategory.NETWORK, 'Connection closed normally, not reconnecting');
      }
      
      // MVP 7 Task 7: Enhanced disconnection event with lifecycle info
      this.eventBus.emit('network.disconnected', {
        code: event.code,
        reason: event.reason,
        timestamp: Date.now(),
        willReconnect: shouldReconnect,
        connectionDuration: this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0,
        finalQuality: this.connectionMetrics.quality,
        totalMessages: this.messageCount,
        totalErrors: this.errorCount,
        connectionState: this.connectionState
      });
    };

    this.websocket.onerror = (error) => {
      Logger.error(LogCategory.NETWORK, '❌ WebSocket error:', error);
      
      // MVP 7 Task 7: Enhanced error categorization
      const errorType = this.categorizeWebSocketError(error);
      
      const networkError: NetworkError = {
        type: errorType,
        message: 'WebSocket connection error',
        timestamp: Date.now(),
        details: error,
        recoverable: errorType !== NetworkErrorType.AUTHENTICATION_FAILED
      };
      
      this.recordError(networkError);
      this.updateConnectionQuality('poor');
      
      // MVP 7 Task 7: Set appropriate connection state on error
      if (this.connectionState === ConnectionState.CONNECTING || this.connectionState === ConnectionState.AUTHENTICATING) {
        this.setConnectionState(ConnectionState.FAILED);
      }
      
      // MVP 7 Task 7: Emit error event for UI updates
      this.eventBus.emit('network.error', {
        type: errorType,
        message: 'WebSocket connection error',
        timestamp: Date.now(),
        details: error,
        connectionState: this.connectionState
      });
    };
  }

  // MVP 7 Task 7: Determine if reconnection should be attempted
  private shouldAttemptReconnection(code: number, reason: string): boolean {
    // Don't reconnect on normal close codes
    if (code === 1000 || code === 1001) {
      return false;
    }
    
    // Don't reconnect on authentication failures
    if (code === 1008 || reason.includes('auth') || reason.includes('token')) {
      return false;
    }
    
    // Don't reconnect on policy violations
    if (code === 1008 || reason.includes('policy')) {
      return false;
    }
    
    // Attempt reconnection for all other cases
    return true;
  }

  // MVP 7 Task 7: Categorize WebSocket errors for better handling
  private categorizeWebSocketError(error: any): NetworkErrorType {
    const errorString = error.toString().toLowerCase();
    
    if (errorString.includes('auth') || errorString.includes('token') || errorString.includes('401')) {
      return NetworkErrorType.AUTHENTICATION_FAILED;
    }
    
    if (errorString.includes('timeout') || errorString.includes('408')) {
      return NetworkErrorType.HEARTBEAT_TIMEOUT;
    }
    
    if (errorString.includes('server') || errorString.includes('500')) {
      return NetworkErrorType.SERVER_ERROR;
    }
    
    return NetworkErrorType.WEBSOCKET_ERROR;
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    Logger.debug(LogCategory.NETWORK, '📨 RAW WEBSOCKET MESSAGE RECEIVED:', message);
    
    // Skip our own messages, but only if we have a valid squirrelId
    if (message.squirrelId && message.squirrelId === this.localSquirrelId) {
      Logger.debug(LogCategory.NETWORK, '🔄 Skipping own message from:', message.squirrelId);
      return;
    }

    Logger.debug(LogCategory.NETWORK, '🎯 PROCESSING REMOTE MESSAGE:', message.type, 'from:', message.squirrelId || 'server');

    switch (message.type) {
      case 'init':
        Logger.debug(LogCategory.NETWORK, '🚀 Server initialization message received');
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
    Logger.debugExpensive(LogCategory.NETWORK, () => `🎯 Remote player update: ${message.squirrelId} at (${message.position?.x.toFixed(1)}, ${message.position?.z.toFixed(1)})`);
    
    // TASK 4 FIX: Remote player updates are CRITICAL for player visibility
    // Do NOT batch these - send immediately to prevent delays
    this.eventBus.emit('remote_player_state', {
      squirrelId: message.squirrelId,
      position: message.position,
      rotationY: message.rotationY,
      timestamp: message.timestamp
    });
  }

  private handlePlayerJoined(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, `👋 Player joined: ${message.squirrelId}`);
    
    // TASK 4 FIX: Player join events are CRITICAL for multiplayer experience
    // Do NOT batch these - emit immediately
    if (message.position && typeof message.rotationY === 'number') {
      this.eventBus.emit('remote_player_state', {
        squirrelId: message.squirrelId,
        position: message.position,
        rotationY: message.rotationY,
        timestamp: message.timestamp
      });
    } else {
      Logger.warn(LogCategory.NETWORK, `⚠️ Player joined without position data: ${message.squirrelId}`);
    }
    
    // Also emit the join event for other systems
    this.eventBus.emit('remote_player_joined', {
      squirrelId: message.squirrelId,
      position: message.position,
      rotationY: message.rotationY
    });
  }

  private handlePlayerLeft(message: NetworkMessage): void {
    const { squirrelId } = message;
    Logger.debug(LogCategory.NETWORK, `👋 Remote player left: ${squirrelId}`);
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
    Logger.debug(LogCategory.NETWORK, '🔧 Position correction received from server:', {
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
      
      Logger.debug(LogCategory.NETWORK, '✅ Applied server position correction to local player');
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

  // MVP 7 Task 7: Enhanced reconnection logic with intelligent backoff and health monitoring
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
      
      // MVP 7 Task 7: Emit final reconnection failure event
      this.eventBus.emit('network.reconnection_failed', {
        attempts: this.reconnectAttempts,
        totalTime: Date.now() - this.connectionStartTime,
        lastError: networkError
      });
      return;
    }

    this.reconnectAttempts++;
    this.connectionMetrics.reconnectAttempts = this.reconnectAttempts;
    
    // MVP 7 Task 7: Intelligent backoff based on connection history
    const delay = this.calculateReconnectDelay();
    
    Logger.info(LogCategory.NETWORK, `🔄 Reconnecting in ${delay.toFixed(0)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // MVP 7 Task 7: Emit reconnection attempt event
    this.eventBus.emit('network.reconnection_attempt', {
      attempt: this.reconnectAttempts,
      delay: delay,
      totalAttempts: this.reconnectAttempts
    });
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // MVP 7 Task 7: Intelligent reconnect delay calculation
  private calculateReconnectDelay(): number {
    const baseDelay = 1000;
    const maxDelay = 30000;
    
    // MVP 7 Task 7: Adaptive backoff based on connection quality history
    let exponentialDelay: number;
    
    if (this.connectionMetrics.quality === 'excellent' || this.connectionMetrics.quality === 'good') {
      // Good connection history - use gentler backoff
      exponentialDelay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempts - 1), maxDelay);
    } else if (this.connectionMetrics.quality === 'fair') {
      // Fair connection history - use standard backoff
      exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
    } else {
      // Poor connection history - use aggressive backoff
      exponentialDelay = Math.min(baseDelay * Math.pow(2.5, this.reconnectAttempts - 1), maxDelay);
    }
    
    // MVP 7 Task 7: Add jitter to prevent thundering herd
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    
    // MVP 7 Task 7: Consider recent error rate
    const errorRate = this.errorCount / Math.max(this.messageCount, 1);
    if (errorRate > 0.1) { // More than 10% errors
      exponentialDelay *= 1.5; // Increase delay for high error rates
    }
    
    return exponentialDelay + jitter;
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
    Logger.info(LogCategory.NETWORK, `🔌 Initiating graceful disconnect from state: ${this.connectionState}`);
    
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
    
    // MVP 7 Task 7: Enhanced graceful disconnect with proper close codes
    if (this.websocket) {
      const finalStats = {
        duration: this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0,
        messageCount: this.messageCount,
        errorCount: this.errorCount,
        quality: this.connectionMetrics.quality
      };
      
      try {
        // Send final goodbye message if connection is open
        if (this.websocket.readyState === WebSocket.OPEN) {
          const goodbyeMessage = {
            type: 'goodbye',
            squirrelId: this.localSquirrelId,
            timestamp: Date.now(),
            stats: finalStats
          };
          this.websocket.send(JSON.stringify(goodbyeMessage));
          
          // Give a brief moment for message to send before closing
          setTimeout(() => {
            if (this.websocket) {
              this.websocket.close(1000, 'Client initiated disconnect');
            }
          }, 100);
        } else {
          this.websocket.close(1000, 'Client initiated disconnect');
        }
      } catch (error) {
        Logger.warn(LogCategory.NETWORK, '⚠️ Error during graceful disconnect:', error);
        // Force close if graceful close fails
        this.websocket.close();
      }
      
      this.websocket = null;
    }
    
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.updateConnectionQuality('poor');
    
    // MVP 7 Task 7: Emit comprehensive disconnect event
    this.eventBus.emit('network.graceful_disconnect', {
      timestamp: Date.now(),
      finalStats: {
        duration: this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0,
        messageCount: this.messageCount,
        errorCount: this.errorCount,
        reconnectAttempts: this.reconnectAttempts,
        quality: this.connectionMetrics.quality
      }
    });
    
    Logger.info(LogCategory.NETWORK, '👋 Graceful disconnect completed');
  }

  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN && this.connectionState === ConnectionState.CONNECTED;
  }

  // MVP 7 Task 7: Enhanced connection state API
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isConnecting(): boolean {
    return this.connectionState === ConnectionState.CONNECTING || this.connectionState === ConnectionState.AUTHENTICATING;
  }

  isReconnecting(): boolean {
    return this.connectionState === ConnectionState.RECONNECTING;
  }

  getConnectionMetrics(): ConnectionMetrics {
    // Update uptime before returning
    if (this.connectionStartTime > 0) {
      this.connectionMetrics.connectionUptime = Date.now() - this.connectionStartTime;
    }
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
    Logger.debug(LogCategory.NETWORK, '🚀 Server initialization message received');
    
    // FIRST: Server confirms our squirrel ID
    if (message.data?.confirmedSquirrelId) {
      Logger.debug(LogCategory.NETWORK, '✅ Server confirmed squirrel ID:', message.data.confirmedSquirrelId);
      this.localSquirrelId = message.data.confirmedSquirrelId;
      sessionStorage.setItem('squirrelId', message.data.confirmedSquirrelId);
    }
    
    // SECOND: Apply saved position to local player
    if (message.data?.savedPosition) {
      Logger.info(LogCategory.NETWORK, '📍 Applying saved position from server:', message.data.savedPosition);
      this.eventBus.emit('apply_saved_position', {
        position: message.data.savedPosition,
        rotationY: message.data.savedRotationY || 0
      });
    }
    
    // THIRD: Process existing players AFTER local squirrel ID is set
    if (message.data?.existingPlayers) {
      Logger.info(LogCategory.NETWORK, `👥 Server sent ${message.data.existingPlayers.length} existing players in init message`);
      for (const playerData of message.data.existingPlayers) {
        // IMPORTANT: Now localSquirrelId is guaranteed to be set
        if (playerData.squirrelId !== this.localSquirrelId) {
          Logger.info(LogCategory.NETWORK, `🎯 Processing existing player from init: ${playerData.squirrelId}`);
          this.handlePlayerJoined({
            type: 'player_joined',
            squirrelId: playerData.squirrelId,
            position: playerData.position,
            rotationY: playerData.rotationY,
            timestamp: performance.now()
          } as NetworkMessage);
        } else {
          Logger.debug(LogCategory.NETWORK, `🔄 Skipping own player in existing players: ${playerData.squirrelId}`);
        }
      }
    }
  }

  private handleExistingPlayers(message: NetworkMessage): void {
    if (message.players && Array.isArray(message.players)) {
      Logger.info(LogCategory.NETWORK, `👥 Received ${message.players.length} existing players in separate message`);
      
      // TASK 4 FIX: Process existing players immediately to prevent delays
      for (const player of message.players) {
        if (player.squirrelId && player.position) {
          // Skip if this is the local player
          if (player.squirrelId === this.localSquirrelId) {
            Logger.debug(LogCategory.NETWORK, `🔄 Skipping own player in existing_players: ${player.squirrelId}`);
            continue;
          }
          
          Logger.info(LogCategory.NETWORK, `🎯 Processing existing player from separate message: ${player.squirrelId}`);
          
          // Emit immediately - do NOT batch critical player visibility events
          this.eventBus.emit('remote_player_state', {
            squirrelId: player.squirrelId,
            position: player.position,
            rotationY: player.rotationY || 0,
            timestamp: message.timestamp || performance.now()
          });
          
          // Also emit the join event for other systems
          this.eventBus.emit('remote_player_joined', {
            squirrelId: player.squirrelId,
            position: player.position,
            rotationY: player.rotationY || 0
          });
        } else {
          Logger.warn(LogCategory.NETWORK, `⚠️ Invalid existing player data:`, player);
        }
      }
    } else {
      Logger.warn(LogCategory.NETWORK, `⚠️ Invalid existing_players message format:`, message);
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