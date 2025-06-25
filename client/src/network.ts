// network.ts - Industry Standard Network Client
// Handles WebSocket connections, authentication, and message routing

interface NetworkConfig {
  apiBaseUrl: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}

interface AuthData {
  squirrelId: string;
  token: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

interface NetworkMessage {
  type: string;
  [key: string]: any;
}

type MessageHandler = (data: any) => void;

class NetworkManager {
  private config: NetworkConfig;
  private socket: WebSocket | null = null;
  private authData: AuthData | null = null;
  private messageHandlers = new Map<string, MessageHandler[]>();
  private connectionState: 'disconnected' | 'connecting' | 'authenticating' | 'connected' = 'disconnected';
  private reconnectAttempts = 0;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;

  constructor(config: NetworkConfig) {
    this.config = config;
  }

  // Industry Standard: Authentication flow
  async authenticate(): Promise<AuthData> {
    try {
      console.log('🔐 [Network] Authenticating...');
      
      // Request to join the game (creates session and returns token)
      const response = await fetch(`${this.config.apiBaseUrl}/join?squirrelId=${crypto.randomUUID()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status}`);
      }

      const authData = await response.json() as AuthData;
      this.authData = authData;

      console.log(`✅ [Network] Authenticated as ${authData.squirrelId.substring(0, 8)}`);
      return authData;
      
    } catch (error) {
      console.error('[Network] Authentication error:', error);
      throw error;
    }
  }

  // Industry Standard: WebSocket connection with authentication
  async connect(): Promise<void> {
    if (this.connectionState !== 'disconnected') {
      console.warn('[Network] Already connected or connecting');
      return;
    }

    // Authenticate first if not already authenticated
    if (!this.authData) {
      await this.authenticate();
    }

    if (!this.authData) {
      throw new Error('Authentication failed');
    }

    this.connectionState = 'connecting';
    
    try {
      // Create WebSocket URL with auth parameters
      const wsUrl = new URL('/ws', this.config.apiBaseUrl);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('squirrelId', this.authData.squirrelId);
      wsUrl.searchParams.set('token', this.authData.token);

      console.log('🔗 [Network] Attempting WebSocket connection to:', wsUrl.toString());

      // Create WebSocket connection
      this.socket = new WebSocket(wsUrl.toString());
      console.log('🔌 [Network] WebSocket object created, readyState:', this.socket.readyState);
      
      // Set up event handlers
      this.setupSocketHandlers();

      // Wait for connection to open
      console.log('⏳ [Network] Waiting for WebSocket connection...');
      await this.waitForConnection();
      
      console.log('🚀 [Network] Connected to multiplayer');

    } catch (error) {
      console.error('❌ [Network] Connection error:', error);
      this.connectionState = 'disconnected';
      this.scheduleReconnect();
      throw error;
    }
  }

  // Set up WebSocket event handlers
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onopen = (event) => {
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected', { event });
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as NetworkMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error('[Network] Message parsing error:', error);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`[Network] WebSocket closed: ${event.code} - ${event.reason}`);
      this.connectionState = 'disconnected';
      this.stopHeartbeat();
      this.emit('disconnected', { event });
      
      // Attempt reconnection unless it was a clean close
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (event) => {
      console.error('[Network] WebSocket error:', event);
      this.emit('error', { event });
    };
  }

  // Wait for WebSocket to connect
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('No socket'));
        return;
      }

      if (this.socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('WebSocket connection failed'));
      };

      const cleanup = () => {
        if (this.socket) {
          this.socket.removeEventListener('open', onOpen);
          this.socket.removeEventListener('error', onError);
        }
      };

      this.socket.addEventListener('open', onOpen);
      this.socket.addEventListener('error', onError);

      // Timeout after 10 seconds
      setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  }

  // Industry Standard: Message routing system
  private handleMessage(message: NetworkMessage): void {
    // Only log important messages, not pongs or updates
    if (message.type !== 'pong' && message.type !== 'player_update') {
      console.log(`🌐 [Network] ${message.type}:`, message);
    }

    // Handle system messages
    switch (message.type) {
      case 'pong':
        // Heartbeat response - connection is alive
        break;
      default:
        // Route to registered handlers
        this.emit(message.type, message);
        break;
    }
  }

  // Industry Standard: Event emission system
  private emit(eventType: string, data: any): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[Network] Handler error for ${eventType}:`, error);
        }
      });
    }
  }

  // Register message handlers
  on(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  // Remove message handlers
  off(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Industry Standard: Send messages with validation
  send(message: NetworkMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[Network] Cannot send message - not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[Network] Send error:', error);
      return false;
    }
  }

  // Send player position updates
  sendPlayerUpdate(position: { x: number; y: number; z: number }, rotationY: number): boolean {
    return this.send({
      type: 'player_update',
      position,
      rotationY,
      timestamp: Date.now()
    });
  }

  // Industry Standard: Connection heartbeat
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', timestamp: Date.now() });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // Industry Standard: Automatic reconnection
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.error('[Network] Max reconnection attempts reached');
      this.emit('reconnect_failed', {});
      return;
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts); // Exponential backoff
    this.reconnectAttempts++;

    console.log(`[Network] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[Network] Reconnection failed:', error);
      }
    }, delay);
  }

  // Clean disconnect
  disconnect(): void {
    console.log('[Network] Disconnecting...');
    
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect');
      this.socket = null;
    }

    this.connectionState = 'disconnected';
  }

  // Get current connection state
  getConnectionState(): string {
    return this.connectionState;
  }

  // Get auth data
  getAuthData(): AuthData | null {
    return this.authData;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connectionState === 'connected' && 
           this.socket?.readyState === WebSocket.OPEN;
  }
}

export { NetworkManager, type NetworkConfig, type AuthData, type NetworkMessage }; 