// WebSocket service for real-time multiplayer communication

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface PlayerPosition {
  x: number;
  y: number;
  z: number;
}

export interface RemotePlayer {
  squirrelId: string;
  position: PlayerPosition;
  rotationY: number;
  characterId?: string;
}

export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private messageQueue: WebSocketMessage[] = [];

  // Connection state
  public isConnected: boolean = false;
  public isConnecting: boolean = false;

  // Event handlers
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onError?: (error: Event) => void;
  public onMessage?: (message: WebSocketMessage) => void;
  public onPlayerJoined?: (player: RemotePlayer) => void;
  public onPlayerLeft?: (squirrelId: string) => void;
  public onPlayerUpdate?: (player: RemotePlayer) => void;
  public onWorldState?: (data: any) => void;
  public onExistingPlayers?: (players: RemotePlayer[]) => void;

  constructor(
    private squirrelId: string,
    private characterId: string = 'colobus',
    private serverUrl: string = 'ws://localhost:8787'
  ) { }

  // Connect to WebSocket server
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;


      try {
        this.socket = new WebSocket(`${this.serverUrl}/ws?squirrelId=${this.squirrelId}&characterId=${this.characterId}`);

        this.socket.onopen = () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.startHeartbeat();
          this.processMessageQueue();
          this.onConnected?.();
          resolve();
        };

        this.socket.onclose = () => {
          this.handleDisconnection();
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          this.onError?.(error);
          reject(error);
        };

        this.socket.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Disconnect from WebSocket server
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
    }
    this.stopHeartbeat();
    this.stopReconnection();
  }

  // Send message to server
  sendMessage(message: WebSocketMessage): void {
    if (this.isConnected && this.socket) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.messageQueue.push(message);
      }
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  // Send player position update
  sendPlayerUpdate(position: PlayerPosition, rotationY: number): void {
    this.sendMessage({
      type: 'player_update',
      position,
      rotationY,
      characterId: this.characterId,
      timestamp: Date.now()
    });
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketMessage): void {
    this.onMessage?.(message);

    switch (message.type) {
      case 'world_state':
        this.onWorldState?.(message);
        break;

      case 'existing_players':
        this.onExistingPlayers?.(message.players || []);
        break;

      case 'player_joined':
        this.onPlayerJoined?.({
          squirrelId: message.squirrelId,
          position: message.position,
          rotationY: message.rotationY,
          characterId: message.characterId
        });
        break;

      case 'player_leave':
        this.onPlayerLeft?.(message.squirrelId);
        break;

      case 'player_update':
        this.onPlayerUpdate?.({
          squirrelId: message.squirrelId,
          position: message.position,
          rotationY: message.rotationY,
          characterId: message.characterId
        });
        break;

      case 'heartbeat':
        // Server responded to heartbeat - connection is alive
        break;

      default:
        break;
    }
  }

  // Handle disconnection
  private handleDisconnection(): void {
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    this.onDisconnected?.();
    this.startReconnection();
  }

  // Start heartbeat to keep connection alive
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now()
        });
      }
    }, 30000); // Every 30 seconds
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Start automatic reconnection
  private startReconnection(): void {
    this.stopReconnection();
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }
    }, 5000); // Every 5 seconds
  }

  // Stop automatic reconnection
  private stopReconnection(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Process queued messages when connection is restored
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  // Get connection status
  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.isConnected) return 'connected';
    if (this.isConnecting) return 'connecting';
    return 'disconnected';
  }
}