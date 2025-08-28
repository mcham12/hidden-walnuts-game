// Simplified ForestManager - Basic WebSocket and world state management

interface DurableObjectState {
  storage: DurableObjectStorage;
  id: DurableObjectId;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  list<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

interface PlayerConnection {
  squirrelId: string;
  socket: WebSocket;
  position: { x: number; y: number; z: number };
  rotationY: number;
  lastActivity: number;
}

interface Walnut {
  id: string;
  ownerId: string;
  origin: 'game' | 'player';
  hiddenIn: 'buried' | 'bush';
  location: { x: number, y: number, z: number };
  found: boolean;
  timestamp: number;
}

interface ForestObject {
  id: string;
  type: 'tree' | 'shrub';
  x: number;
  y: number;
  z: number;
  scale: number;
}

export default class ForestManager {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env: any;
  
  // Simple state management
  mapState: Walnut[] = [];
  terrainSeed: number = 0;
  forestObjects: ForestObject[] = [];
  
  // Simple WebSocket management
  activePlayers: Map<string, PlayerConnection> = new Map();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // WebSocket upgrade
    if (path === "/ws") {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const url = new URL(request.url);
      const squirrelId = url.searchParams.get("squirrelId");
      
      if (!squirrelId) {
        return new Response("Missing squirrelId", { status: 400 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      server.accept();
      await this.setupPlayerConnection(squirrelId, server);

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // Join endpoint
    if (path === "/join" && request.method === "POST") {
      const url = new URL(request.url);
      const squirrelId = url.searchParams.get("squirrelId");
      
      if (!squirrelId) {
        return new Response(JSON.stringify({ error: "Missing squirrelId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Simple session creation
      return new Response(JSON.stringify({ 
        squirrelId,
        token: "simplified-token",
        message: "Joined successfully"
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Leaderboard endpoint  
    if (path.endsWith("/leaderboard")) {
      const leaderboard = this.env.LEADERBOARD.get(this.env.LEADERBOARD.idFromName("global"));
      return await leaderboard.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  }

  // Simple player connection setup
  private async setupPlayerConnection(squirrelId: string, socket: WebSocket): Promise<void> {
    // Get or create player position
    const savedPosition = await this.loadPlayerPosition(squirrelId);
    
    const playerConnection: PlayerConnection = {
      squirrelId,
      socket,
      position: savedPosition || { x: 0, y: 2, z: 0 },
      rotationY: 0,
      lastActivity: Date.now()
    };

    this.activePlayers.set(squirrelId, playerConnection);

    // Setup message handlers
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        await this.handlePlayerMessage(playerConnection, message);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    socket.onclose = () => {
      this.activePlayers.delete(squirrelId);
      this.broadcastToOthers(squirrelId, {
        type: 'player_leave',
        squirrelId: squirrelId
      });
    };

    socket.onerror = (event) => {
      console.error('WebSocket error:', event);
    };

    // Send initial data
    await this.sendWorldState(socket);
    await this.sendExistingPlayers(socket, squirrelId);
    
    // Broadcast player join
    this.broadcastToOthers(squirrelId, {
      type: 'player_joined',
      squirrelId,
      position: playerConnection.position,
      rotationY: playerConnection.rotationY
    });
  }

  // Simple message handling
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    switch (data.type) {
      case "player_update":
        if (data.position) {
          playerConnection.position = data.position;
        }
        if (typeof data.rotationY === 'number') {
          playerConnection.rotationY = data.rotationY;
        }
        
        // Save position
        await this.savePlayerPosition(playerConnection.squirrelId, playerConnection.position);
        
        // Broadcast to others
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'player_update',
          squirrelId: playerConnection.squirrelId,
          position: playerConnection.position,
          rotationY: playerConnection.rotationY
        });
        break;
        
      case "heartbeat":
        this.sendMessage(playerConnection.socket, {
          type: 'heartbeat',
          timestamp: data.timestamp,
          serverTime: Date.now()
        });
        break;
        
      default:
        // Broadcast other messages
        this.broadcastToOthers(playerConnection.squirrelId, data);
        break;
    }
  }

  // Simple world state initialization
  private async sendWorldState(socket: WebSocket): Promise<void> {
    await this.initializeWorld();
    
    this.sendMessage(socket, {
      type: "world_state",
      terrainSeed: this.terrainSeed,
      mapState: this.mapState,
      forestObjects: this.forestObjects
    });
  }

  // Send existing players to new player
  private async sendExistingPlayers(socket: WebSocket, excludeSquirrelId: string): Promise<void> {
    const existingPlayers = Array.from(this.activePlayers.values())
      .filter(player => player.squirrelId !== excludeSquirrelId)
      .map(player => ({
        squirrelId: player.squirrelId,
        position: player.position,
        rotationY: player.rotationY
      }));

    if (existingPlayers.length > 0) {
      this.sendMessage(socket, {
        type: "existing_players",
        players: existingPlayers
      });
    }
  }

  // Simple broadcasting
  private broadcastToOthers(excludeSquirrelId: string, message: any): void {
    const serializedMessage = JSON.stringify(message);
    
    for (const [squirrelId, playerConnection] of this.activePlayers) {
      if (squirrelId === excludeSquirrelId) continue;
      
      if (playerConnection.socket.readyState === WebSocket.OPEN) {
        try {
          playerConnection.socket.send(serializedMessage);
        } catch (error) {
          console.error(`Failed to send message to ${squirrelId}:`, error);
        }
      }
    }
  }

  // Simple message sending
  private sendMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  }

  // Simple world initialization
  private async initializeWorld(): Promise<void> {
    // Load or create terrain seed
    const storedSeed = await this.storage.get('terrainSeed');
    if (storedSeed !== null && typeof storedSeed === 'number') {
      this.terrainSeed = storedSeed;
    } else {
      this.terrainSeed = Math.random() * 1000;
      await this.storage.put('terrainSeed', this.terrainSeed);
    }

    // Load or create forest objects
    const storedForestObjects = await this.storage.get('forestObjects');
    if (storedForestObjects) {
      this.forestObjects = Array.isArray(storedForestObjects) ? storedForestObjects : [];
    } else {
      this.forestObjects = this.generateForestObjects();
      await this.storage.put('forestObjects', this.forestObjects);
    }

    // Load or create map state
    const storedMapState = await this.storage.get('mapState');
    if (storedMapState) {
      this.mapState = Array.isArray(storedMapState) ? storedMapState : [];
    } else {
      this.mapState = [{
        id: "test-walnut",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: 0, y: 0, z: 0 },
        found: false,
        timestamp: Date.now()
      }];
      await this.storage.put('mapState', this.mapState);
    }
  }

  // Simple forest object generation
  private generateForestObjects(): ForestObject[] {
    const objects: ForestObject[] = [];
    
    // Generate 20 trees
    for (let i = 0; i < 20; i++) {
      objects.push({
        id: `tree-${Date.now()}-${i}`,
        type: "tree",
        x: (Math.random() - 0.5) * 100,
        y: 0,
        z: (Math.random() - 0.5) * 100,
        scale: 0.8 + Math.random() * 0.4
      });
    }
    
    // Generate 30 shrubs
    for (let i = 0; i < 30; i++) {
      objects.push({
        id: `shrub-${Date.now()}-${i}`,
        type: "shrub",
        x: (Math.random() - 0.5) * 100,
        y: 0,
        z: (Math.random() - 0.5) * 100,
        scale: 0.7 + Math.random() * 0.3
      });
    }
    
    return objects;
  }

  // Simple player position management
  private async loadPlayerPosition(squirrelId: string): Promise<{ x: number; y: number; z: number } | null> {
    try {
      const savedData = await this.storage.get<{ position: { x: number; y: number; z: number } }>(`player:${squirrelId}`);
      return savedData?.position || null;
    } catch (error) {
      console.error(`Failed to load position for ${squirrelId}:`, error);
      return null;
    }
  }

  private async savePlayerPosition(squirrelId: string, position: { x: number; y: number; z: number }): Promise<void> {
    try {
      await this.storage.put(`player:${squirrelId}`, {
        position,
        lastUpdate: Date.now()
      });
    } catch (error) {
      console.error(`Failed to save position for ${squirrelId}:`, error);
    }
  }
}