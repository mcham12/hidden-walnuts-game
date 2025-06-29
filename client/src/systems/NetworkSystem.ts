// Network System - Single Responsibility: Handle multiplayer connections and remote player updates

import { System, Entity, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, Rotation } from '../core/types';
import { API_BASE } from '../main';
import { Logger, LogCategory } from '../core/Logger';

interface NetworkMessage {
  type: 'position_update' | 'player_joined' | 'player_left' | 'heartbeat' | 'player_join' | 'player_update' | 'world_state';
  squirrelId: string;
  data?: any;
  timestamp: number;
  position?: { x: number; y: number; z: number };
  rotationY?: number;
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
      // Generate unique squirrel ID
      this.localSquirrelId = crypto.randomUUID();
      
      // Get authentication token
      const authResponse = await fetch(`${API_BASE}/join?squirrelId=${this.localSquirrelId}`, {
        method: 'POST'
      });
      
      if (!authResponse.ok) {
        throw new Error(`Auth failed: ${authResponse.status}`);
      }
      
      const authData = await authResponse.json();
      const wsUrl = `${API_BASE.replace('http', 'ws')}/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      
      Logger.info(LogCategory.NETWORK, '🌐 Connecting to: ' + wsUrl);
      
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
    // Skip our own messages
    if (message.squirrelId === this.localSquirrelId) {
      return;
    }

    Logger.debug(LogCategory.NETWORK, `📨 Received ${message.type} from ${message.squirrelId}`);

    switch (message.type) {
      case 'position_update':
      case 'player_update':
        this.handleRemotePlayerUpdate(message);
        break;
      case 'player_joined':
      case 'player_join':
        this.handlePlayerJoined(message);
        break;
      case 'player_left':
        this.handlePlayerLeft(message);
        break;
      case 'world_state':
        this.handleWorldState(message);
        break;
      case 'heartbeat':
        // Server heartbeat - connection is alive
        break;
      default:
        Logger.debug(LogCategory.NETWORK, `Unknown message type: ${message.type}`);
    }
  }

  private handleRemotePlayerUpdate(message: NetworkMessage): void {
    const { squirrelId, data, position, rotationY } = message;
    
    // Extract position and rotation from either data object or direct properties
    const playerPosition = data?.position || position || { x: 0, y: 2, z: 0 };
    const playerRotation = data?.rotation?.y || rotationY || 0;
    
    // Emit player state for PlayerManager and other systems
    this.eventBus.emit('remote_player_state', {
      squirrelId,
      position: playerPosition,
      rotation: { x: 0, y: playerRotation, z: 0, w: 1 },
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
    
    // Extract position and rotation from either data object or direct properties
    const playerPosition = data?.position || position || { x: 0, y: 2, z: 0 };
    const playerRotation = rotationY || data?.rotationY || 0;

    // Emit player state to create the remote player
    this.eventBus.emit('remote_player_state', {
      squirrelId,
      position: playerPosition,
      rotation: { x: 0, y: playerRotation, z: 0, w: 1 },
      timestamp: message.timestamp || performance.now()
    });
  }

  private handlePlayerLeft(message: NetworkMessage): void {
    const { squirrelId } = message;
    
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
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const message: NetworkMessage = {
        type: 'player_update',
        squirrelId: this.localSquirrelId || 'unknown',
        position: { x: data.position.x, y: data.position.y, z: data.position.z },
        rotationY: data.rotation.y,
        timestamp: performance.now()
      };
      
      this.websocket.send(JSON.stringify(message));
      
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `📤 Sent position update: (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`
      );
    }
  }

  private findRemotePlayer(squirrelId: string): Entity | null {
    for (const entity of this.entities.values()) {
      const networkComponent = entity.getComponent<NetworkComponent>('network');
      if (networkComponent && networkComponent.squirrelId === squirrelId && !networkComponent.isLocalPlayer) {
        return entity;
      }
    }
    return null;
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
} 