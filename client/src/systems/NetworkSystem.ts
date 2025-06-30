// Network System - Single Responsibility: Handle multiplayer connections and remote player updates

import { System } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

interface NetworkMessage {
  type: 'position_update' | 'player_joined' | 'player_left' | 'heartbeat' | 'player_join' | 'player_update' | 'world_state' | 'init' | 'existing_players' | 'player_leave';
  squirrelId: string;
  data?: any;
  timestamp: number;
  position?: { x: number; y: number; z: number };
  rotationY?: number;
  players?: any[]; // For existing_players message
}

export class NetworkSystem extends System {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: any = null;
  private isConnecting = false;
  private localSquirrelId: string | null = null;
  
  constructor(eventBus: EventBus) {
    super(eventBus, ['network'], 'NetworkSystem');
    
    // Listen for local player movement to broadcast
    this.eventBus.subscribe(GameEvents.PLAYER_MOVED, this.handleLocalPlayerMove.bind(this));
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    
    try {
      // FIXED: Generate a unique squirrel ID for each browser window/tab
      // This allows multiple players to connect to the same server
      const newSquirrelId = crypto.randomUUID();
      this.localSquirrelId = newSquirrelId;
      
      // Store the ID for this session only (not persistent across browser restarts)
      // This ensures each browser window gets a unique ID
      sessionStorage.setItem('squirrelId', newSquirrelId);
      
      Logger.info(LogCategory.NETWORK, `🆕 Generated unique squirrel ID for this session: ${newSquirrelId}`);
      
      // Get authentication token
      const authResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/join?squirrelId=${this.localSquirrelId}`, {
        method: 'POST'
      });
      
      if (!authResponse.ok) {
        throw new Error(`Auth failed: ${authResponse.status}`);
      }
      
      const authData = await authResponse.json();
      
      // Update local squirrel ID with what the server returned (in case of session restoration)
      this.localSquirrelId = authData.squirrelId;
      sessionStorage.setItem('squirrelId', authData.squirrelId);
      
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const wsUrl = `${apiBase.replace('http', 'ws')}/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      
      Logger.info(LogCategory.NETWORK, `🌐 Connecting to: ${wsUrl} (ID: ${this.localSquirrelId})`);
      
      this.websocket = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
      
    } catch (error) {
      Logger.error(LogCategory.NETWORK, '❌ Connection failed', error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      Logger.info(LogCategory.NETWORK, '✅ Connected to multiplayer server');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.eventBus.emit(GameEvents.MULTIPLAYER_CONNECTED);
      
      // Notify systems that websocket is ready
      this.eventBus.emit('network.websocket_ready', this.websocket);
    };

    this.websocket.onmessage = (event) => {
      Logger.debug(LogCategory.NETWORK, 'RAW WEBSOCKET MESSAGE DATA:', event.data);
      try {
        const message: NetworkMessage = JSON.parse(event.data);
        this.handleNetworkMessage(message);
      } catch (error) {
        Logger.error(LogCategory.NETWORK, '❌ Failed to parse message', error);
      }
    };

    this.websocket.onclose = () => {
      Logger.info(LogCategory.NETWORK, '🔴 Connection closed');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.websocket.onerror = (error) => {
      Logger.error(LogCategory.NETWORK, '⚠️ WebSocket error', error);
    };
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    Logger.debug(LogCategory.NETWORK, 'RAW WEBSOCKET MESSAGE RECEIVED:', message);
    
    // Skip our own messages, but only if we have a valid squirrelId
    if (message.squirrelId && message.squirrelId === this.localSquirrelId) {
      Logger.debug(LogCategory.NETWORK, '🔄 Skipping own message from:', message.squirrelId);
      return;
    }

    Logger.debug(LogCategory.NETWORK, '🎯 PROCESSING REMOTE MESSAGE:', message.type, 'from:', message.squirrelId || 'server');

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
      case 'heartbeat':
        Logger.debug(LogCategory.NETWORK, '💓 HEARTBEAT received');
        // Server heartbeat - connection is alive
        break;
      default:
        Logger.debug(LogCategory.NETWORK, '❓ UNKNOWN MESSAGE TYPE:', message.type);
    }
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
    
    Logger.info(LogCategory.NETWORK, `🎯 Remote player joined: ${squirrelId}`);
    Logger.info(LogCategory.NETWORK, '🎯 PLAYER JOINED - about to emit remote_player_state for:', squirrelId);
    
    // Extract position and rotation from either data object or direct properties
    const playerPosition = data?.position || position || { x: 0, y: 2, z: 0 };
    const playerRotation = rotationY || data?.rotationY || 0;

    // FIXED: Emit player state to create the remote player with correct data structure
    this.eventBus.emit('remote_player_state', {
      squirrelId,
      position: playerPosition,
      rotationY: playerRotation, // FIXED: Use rotationY directly instead of nested rotation object
      velocity: data?.velocity,
      timestamp: message.timestamp || performance.now()
    });

    Logger.info(LogCategory.NETWORK, `🎮 Remote player ${squirrelId} joined at (${playerPosition.x.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);
  }

  private handlePlayerLeft(message: NetworkMessage): void {
    const { squirrelId } = message;
    
    Logger.debug(LogCategory.NETWORK, '👋 PLAYER LEFT/LEAVE MESSAGE received for:', squirrelId);
    Logger.info(LogCategory.NETWORK, `👋 Remote player left: ${squirrelId}`);
    
    this.eventBus.emit('player_disconnected', {
      squirrelId
    });
  }

  private handleWorldState(message: NetworkMessage): void {
    Logger.info(LogCategory.NETWORK, '🌍 Received world state from server');
    
    // The world state contains initial terrain seed, map state, etc.
    // For now, we're primarily interested in any existing players
    if (message.data?.activePlayers) {
      for (const [squirrelId, playerData] of Object.entries(message.data.activePlayers)) {
        if (squirrelId !== this.localSquirrelId) {
          this.handlePlayerJoined({
            type: 'player_joined',
            squirrelId,
            position: (playerData as any).position,
            rotationY: (playerData as any).rotationY,
            timestamp: performance.now()
          } as NetworkMessage);
        }
      }
    }
  }

  private handleLocalPlayerMove(data: any): void {
    Logger.info(LogCategory.NETWORK, '🎯 RECEIVED PLAYER_MOVED EVENT! Data:', data);
    
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const message: NetworkMessage = {
        type: 'player_update',
        squirrelId: this.localSquirrelId || 'unknown',
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotationY: data.rotation.y,
        timestamp: performance.now()
      };
      
      Logger.info(LogCategory.NETWORK, '📤 SENDING LOCAL PLAYER UPDATE to server:', this.localSquirrelId, 'at position:', message.position);
      this.websocket.send(JSON.stringify(message));
      
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `📤 Sent position update: (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`
      );
    } else {
      Logger.warn(LogCategory.NETWORK, '❌ CANNOT SEND - WebSocket not open. State:', this.websocket?.readyState);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'heartbeat',
          squirrelId: this.localSquirrelId,
          timestamp: performance.now()
        }));
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Logger.error(LogCategory.NETWORK, '💥 Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    Logger.info(LogCategory.NETWORK, `🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  update(_deltaTime: number): void {
    // NetworkSystem handles WebSocket events, no per-frame updates needed
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  // Public method for debug UI
  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
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
    Logger.debug(LogCategory.NETWORK, '👥 EXISTING PLAYERS MESSAGE received:', message);
    
    // The existing_players message has a players array
    if (message.players) {
      Logger.debug(LogCategory.NETWORK, '👥 Processing existing players:', message.players.length);
      for (const playerData of message.players) {
        if (playerData.squirrelId !== this.localSquirrelId) {
          Logger.debug(LogCategory.NETWORK, '🎯 Creating existing player:', playerData.squirrelId);
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
} 