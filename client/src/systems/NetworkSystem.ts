// Network System - Single Responsibility: Handle multiplayer connections and remote player updates

import { System, Entity, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, Rotation } from '../core/types';
import { API_BASE } from '../main';
import { NetworkLog } from '../core/Logger';

interface NetworkMessage {
  type: 'position_update' | 'player_joined' | 'player_left' | 'heartbeat';
  squirrelId: string;
  data?: any;
  timestamp: number;
}

export class NetworkSystem extends System {
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: number | null = null;
  private isConnecting = false;
  
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
      // Get authentication token
      const authResponse = await fetch(`${API_BASE}/join?squirrelId=${crypto.randomUUID()}`, {
        method: 'POST'
      });
      
      if (!authResponse.ok) {
        throw new Error(`Auth failed: ${authResponse.status}`);
      }
      
      const authData = await authResponse.json();
      const wsUrl = `${API_BASE.replace('http', 'ws')}/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      
      NetworkLog.info('Connecting to: ' + wsUrl);
      
      this.websocket = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
      
    } catch (error) {
      NetworkLog.error('Connection failed', error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      NetworkLog.info('Connected to multiplayer server');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.eventBus.emit(GameEvents.MULTIPLAYER_CONNECTED);
      
      // ZERO'S FIX: Notify systems that websocket is ready
      this.eventBus.emit('network.websocket_ready', this.websocket);
    };

    this.websocket.onmessage = (event) => {
      try {
        const message: NetworkMessage = JSON.parse(event.data);
        this.handleNetworkMessage(message);
      } catch (error) {
        NetworkLog.error('Failed to parse message', error);
      }
    };

    this.websocket.onclose = () => {
      NetworkLog.info('Connection closed');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.websocket.onerror = (error) => {
      NetworkLog.error('WebSocket error', error);
    };
  }

  private handleNetworkMessage(message: NetworkMessage): void {
    switch (message.type) {
      case 'position_update':
        this.handleRemotePlayerUpdate(message);
        break;
      case 'player_joined':
        this.handlePlayerJoined(message);
        break;
      case 'player_left':
        this.handlePlayerLeft(message);
        break;
      case 'heartbeat':
        // Server heartbeat - connection is alive
        break;
    }
  }

  private handleRemotePlayerUpdate(message: NetworkMessage): void {
    const { squirrelId, data } = message;
    
    // Find existing remote player entity
    const remotePlayer = this.findRemotePlayer(squirrelId);
    
    if (remotePlayer && data.position && data.rotation) {
      // Update interpolation targets
      this.eventBus.emit(GameEvents.REMOTE_PLAYER_UPDATED, {
        entityId: remotePlayer.id.value,
        position: new Vector3(data.position.x, data.position.y, data.position.z),
        rotation: Rotation.fromRadians(data.rotation.y)
      });
    }
  }

  private handlePlayerJoined(message: NetworkMessage): void {
    const { squirrelId, data } = message;
    
    NetworkLog.debug('Remote player joined: ' + squirrelId);
    
    this.eventBus.emit(GameEvents.REMOTE_PLAYER_JOINED, {
      squirrelId,
      position: new Vector3(data.position.x, data.position.y, data.position.z),
      rotation: Rotation.fromRadians(data.rotation.y)
    });
  }

  private handlePlayerLeft(message: NetworkMessage): void {
    const { squirrelId } = message;
    
    NetworkLog.debug('Remote player left: ' + squirrelId);
    
    this.eventBus.emit(GameEvents.REMOTE_PLAYER_LEFT, {
      squirrelId
    });
  }

  private handleLocalPlayerMove(data: any): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      const message: NetworkMessage = {
        type: 'position_update',
        squirrelId: data.entityId,
        data: {
          position: { x: data.position.x, y: data.position.y, z: data.position.z },
          rotation: { y: data.rotation.y }
        },
        timestamp: performance.now()
      };
      
      this.websocket.send(JSON.stringify(message));
    }
  }

  private findRemotePlayer(squirrelId: string): Entity | null {
    for (const entity of this.entities.values()) {
      const networkComponent = entity.getComponent<NetworkComponent>('network');
      if (networkComponent && !networkComponent.isLocalPlayer && networkComponent.squirrelId === squirrelId) {
        return entity;
      }
    }
    return null;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        const heartbeat: NetworkMessage = {
          type: 'heartbeat',
          squirrelId: 'local',
          timestamp: performance.now()
        };
        this.websocket.send(JSON.stringify(heartbeat));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      
      NetworkLog.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, delay);
    } else {
      NetworkLog.error('Max reconnection attempts reached');
    }
  }

  // ZERO'S FIX: Proper websocket accessor instead of unsafe casting
  getWebSocket(): WebSocket | null {
    return this.websocket;
  }

  isConnected(): boolean {
    return this.websocket?.readyState === WebSocket.OPEN;
  }

  update(_deltaTime: number): void {
    // NetworkSystem doesn't need frame updates - it's event-driven
    // All logic happens in WebSocket event handlers
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
} 