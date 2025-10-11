// Simplified ForestManager - Basic WebSocket and world state management
// Updated for MVP 3.5 - Multiple character support

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
  characterId: string;
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
      const characterId = url.searchParams.get("characterId") || "colobus";
      
      if (!squirrelId) {
        return new Response("Missing squirrelId", { status: 400 });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      server.accept();
      await this.setupPlayerConnection(squirrelId, characterId, server);

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
  private async setupPlayerConnection(squirrelId: string, characterId: string, socket: WebSocket): Promise<void> {
    // Get or create player position
    const savedPosition = await this.loadPlayerPosition(squirrelId);
    
    const playerConnection: PlayerConnection = {
      squirrelId,
      socket,
      position: savedPosition || { x: 0, y: 2, z: 0 },
      rotationY: 0,
      lastActivity: Date.now(),
      characterId
    };

    this.activePlayers.set(squirrelId, playerConnection);

    // Setup message handlers
    socket.onmessage = async (event) => {
      try {
        console.log('📨 RAW WebSocket data received:', event.data);
        const message = JSON.parse(event.data as string);
        console.log(`📨 SERVER DEBUG: Received message:`, message);
        await this.handlePlayerMessage(playerConnection, message);
      } catch (error) {
        console.error('❌ Error processing WebSocket message:', error, 'Raw data:', event.data);
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
      rotationY: playerConnection.rotationY,
      characterId: playerConnection.characterId
    });
  }

  // Simple message handling
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    switch (data.type) {
      case "player_update":
        console.log(`🎭 SERVER DEBUG: Received player_update with animation: ${data.animation}`);
        if (data.position) {
          // Validate position is within world bounds
          const validatedPosition = this.validatePosition(data.position);
          playerConnection.position = validatedPosition;
        }
        if (typeof data.rotationY === 'number') {
          playerConnection.rotationY = data.rotationY;
        }
        
        // Save position
        await this.savePlayerPosition(playerConnection.squirrelId, playerConnection.position);
        
        // INDUSTRY STANDARD: Forward animation state with timing for multiplayer sync
        console.log(`🚀 SERVER DEBUG: Forwarding animation '${data.animation}' with start time to other clients`);
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'player_update',
          squirrelId: playerConnection.squirrelId,
          position: playerConnection.position,
          rotationY: playerConnection.rotationY,
          characterId: playerConnection.characterId,
          animation: data.animation, // Forward animation state from client
          animationStartTime: data.animationStartTime, // TIME-BASED SYNC: Forward animation start time
          velocity: data.velocity, // Forward velocity for extrapolation
          moveType: data.moveType, // Forward movement type for animation sync
          timestamp: data.timestamp // Forward client timestamp for latency compensation
        });
        break;
        
      case "heartbeat":
        this.sendMessage(playerConnection.socket, {
          type: 'heartbeat',
          timestamp: data.timestamp,
          serverTime: Date.now()
        });
        break;

      case "walnut_hidden":
        console.log(`🌰 SERVER: Player ${playerConnection.squirrelId} hid walnut ${data.walnutId}`);
        // Create new walnut in mapState
        const newWalnut: Walnut = {
          id: data.walnutId,
          ownerId: data.ownerId,
          origin: 'player',
          hiddenIn: data.walnutType, // 'buried' or 'bush'
          location: data.position,
          found: false,
          timestamp: data.timestamp || Date.now()
        };
        this.mapState.push(newWalnut);

        // Persist updated mapState
        await this.storage.put('mapState', this.mapState);

        // Broadcast to all other players
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'walnut_hidden',
          walnutId: data.walnutId,
          ownerId: data.ownerId,
          walnutType: data.walnutType,
          position: data.position,
          points: data.points
        });
        break;

      case "walnut_found":
        console.log(`🔍 SERVER: Player ${playerConnection.squirrelId} found walnut ${data.walnutId}`);
        // Mark walnut as found in mapState
        const walnutIndex = this.mapState.findIndex(w => w.id === data.walnutId);
        if (walnutIndex !== -1) {
          this.mapState[walnutIndex].found = true;

          // Persist updated mapState
          await this.storage.put('mapState', this.mapState);

          // Broadcast to all other players
          this.broadcastToOthers(playerConnection.squirrelId, {
            type: 'walnut_found',
            walnutId: data.walnutId,
            finderId: data.finderId,
            points: data.points
          });
        } else {
          console.warn(`⚠️ SERVER: Walnut ${data.walnutId} not found in mapState`);
        }
        break;

      case "chat_message":
        console.log(`💬 SERVER: Chat from ${playerConnection.squirrelId}: ${data.message}`);
        // Broadcast chat message to all other players
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'chat_message',
          playerId: data.playerId,
          message: data.message
        });
        break;

      case "player_emote":
        console.log(`👋 SERVER: Emote from ${playerConnection.squirrelId}: ${data.emote}`);
        // Broadcast emote to all other players
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'player_emote',
          playerId: data.playerId,
          emote: data.emote
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
        rotationY: player.rotationY,
        characterId: player.characterId
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

    // Load or create map state with initial game walnuts
    const storedMapState = await this.storage.get('mapState');
    if (storedMapState) {
      this.mapState = Array.isArray(storedMapState) ? storedMapState : [];
    } else {
      this.mapState = [];
    }

    // Always ensure golden walnuts exist (re-add if found/missing)
    const goldenWalnutIds = ['game-walnut-1', 'game-walnut-2', 'game-walnut-3'];
    const existingGoldenIds = this.mapState.filter(w => w.origin === 'game').map(w => w.id);

    // Define golden walnut locations
    const goldenWalnuts: Walnut[] = [
      {
        id: "game-walnut-1",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: 15, y: 0, z: 15 },
        found: false,
        timestamp: Date.now()
      },
      {
        id: "game-walnut-2",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: -12, y: 0, z: 18 },
        found: false,
        timestamp: Date.now()
      },
      {
        id: "game-walnut-3",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "bush" as const,
        location: { x: 20, y: 0, z: -10 },
        found: false,
        timestamp: Date.now()
      }
    ];

    // Add missing golden walnuts
    for (const goldenWalnut of goldenWalnuts) {
      if (!existingGoldenIds.includes(goldenWalnut.id)) {
        console.log(`🌟 SERVER: Adding missing golden walnut: ${goldenWalnut.id}`);
        this.mapState.push(goldenWalnut);
      }
    }

    await this.storage.put('mapState', this.mapState);
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

  // Validate and constrain position within world bounds
  private validatePosition(position: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const WORLD_SIZE = 200; // 200x200 world bounds
    const WORLD_HALF = WORLD_SIZE / 2;
    const MIN_Y = 0;
    const MAX_Y = 50;

    const validatedPosition = {
      x: Math.max(-WORLD_HALF, Math.min(WORLD_HALF, position.x)),
      y: Math.max(MIN_Y, Math.min(MAX_Y, position.y)),
      z: Math.max(-WORLD_HALF, Math.min(WORLD_HALF, position.z))
    };

    // Check if position was corrected
    const wasCorrected = (
      Math.abs(validatedPosition.x - position.x) > 0.01 ||
      Math.abs(validatedPosition.y - position.y) > 0.01 ||
      Math.abs(validatedPosition.z - position.z) > 0.01
    );

    if (wasCorrected) {
      console.log(`Position corrected from (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) to (${validatedPosition.x.toFixed(2)}, ${validatedPosition.y.toFixed(2)}, ${validatedPosition.z.toFixed(2)})`);
    }

    return validatedPosition;
  }

  // Validate movement speed (anti-cheat)
  private validateMovementSpeed(
    oldPosition: { x: number; y: number; z: number },
    newPosition: { x: number; y: number; z: number },
    deltaTime: number
  ): boolean {
    const MAX_SPEED = 20; // Maximum allowed speed in units per second
    
    const distance = Math.sqrt(
      Math.pow(newPosition.x - oldPosition.x, 2) +
      Math.pow(newPosition.z - oldPosition.z, 2)
    );
    
    const speed = distance / (deltaTime / 1000); // Convert deltaTime to seconds
    
    if (speed > MAX_SPEED) {
      console.warn(`Suspicious movement speed detected: ${speed.toFixed(2)} units/sec (max: ${MAX_SPEED})`);
      return false;
    }
    
    return true;
  }
}