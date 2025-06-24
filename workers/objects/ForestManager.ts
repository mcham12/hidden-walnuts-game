// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { POINTS, CYCLE_DURATION_SECONDS, NUT_RUSH_INTERVAL_HOURS, NUT_RUSH_DURATION_MINUTES, TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod, ForestObject } from "../types";

// Cloudflare Workers types
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
  isAuthenticated: boolean;
  lastActivity: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

interface GameState {
  terrainSeed: number;
  mapObjects: any[];
  walnuts: any[];
  activePlayers: Map<string, PlayerConnection>;
}

export default class ForestManager {
  private state: DurableObjectState;
  private env: any;
  private gameState: GameState;
  private heartbeatInterval: any = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    
    // Initialize game state
    this.gameState = {
      terrainSeed: 0,
      mapObjects: [],
      walnuts: [],
      activePlayers: new Map()
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Handle WebSocket upgrade requests
      if (pathname === "/ws") {
        return await this.handleWebSocketUpgrade(request);
      }

      // Handle terrain seed requests
      if (pathname === "/terrain-seed") {
        return await this.handleTerrainSeed();
      }

      // Handle map state requests
      if (pathname === "/map-state") {
        return await this.handleMapState();
      }

      // Handle join requests (create session and return token)
      if (pathname === "/join") {
        return await this.handleJoinRequest(request);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("[ForestManager] Error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Industry Standard: Secure WebSocket upgrade handling
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId");
    const token = url.searchParams.get("token");

    // Validate required parameters
    if (!squirrelId || !token) {
      return new Response("Missing squirrelId or token", { status: 400 });
    }

    // Validate WebSocket upgrade headers
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    // Authenticate player session
    const isAuthenticated = await this.authenticatePlayer(squirrelId, token);
    if (!isAuthenticated) {
      return new Response("Authentication failed", { status: 401 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Set up the connection
    await this.setupPlayerConnection(squirrelId, server);

    console.log(`[ForestManager] WebSocket connection established for player ${squirrelId}`);

    // Return the client side to the browser
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Industry Standard: Player authentication via session validation
  private async authenticatePlayer(squirrelId: string, token: string): Promise<boolean> {
    try {
      // Get the player's session from SquirrelSession Durable Object
      const sessionId = this.env.SQUIRREL.idFromName(squirrelId);
      const sessionObject = this.env.SQUIRREL.get(sessionId);

      // Validate the token
      const response = await sessionObject.fetch("https://internal/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const result = await response.json() as { valid: boolean };
      return result.valid;
    } catch (error) {
      console.error(`[ForestManager] Authentication error for ${squirrelId}:`, error);
      return false;
    }
  }

  // Industry Standard: Connection setup with proper lifecycle management
  private async setupPlayerConnection(squirrelId: string, socket: WebSocket): Promise<void> {
    // Get player's session info for position restoration
    const sessionInfo = await this.getPlayerSessionInfo(squirrelId);
    
    // Create player connection record
    const playerConnection: PlayerConnection = {
      squirrelId,
      socket,
      isAuthenticated: true,
      lastActivity: Date.now(),
      position: sessionInfo?.position || { x: 50, y: 2, z: 50 },
      rotationY: sessionInfo?.rotationY || 0
    };

    // Add to active players
    this.gameState.activePlayers.set(squirrelId, playerConnection);

    // Send initial world state to the new player
    await this.sendWorldState(socket);

    // Send existing players to the new player
    await this.sendExistingPlayers(socket, squirrelId);

    // Broadcast new player join to existing players
    this.broadcastPlayerJoin(squirrelId, playerConnection);

    // Set up message handlers
    this.setupMessageHandlers(playerConnection);

    // Set up connection monitoring
    this.setupConnectionMonitoring(playerConnection);

    console.log(`[ForestManager] Player ${squirrelId} connected at position`, playerConnection.position);
  }

  // Industry Standard: Send complete world state on connection
  private async sendWorldState(socket: WebSocket): Promise<void> {
    const worldState = {
      type: "world_state",
      terrainSeed: await this.getTerrainSeed(),
      mapObjects: await this.getMapObjects(),
      walnuts: await this.getWalnuts(),
      timestamp: Date.now()
    };

    this.sendMessage(socket, worldState);
  }

  // Send existing players to newly connected player
  private async sendExistingPlayers(socket: WebSocket, excludeSquirrelId: string): Promise<void> {
    const existingPlayers = Array.from(this.gameState.activePlayers.values())
      .filter(player => player.squirrelId !== excludeSquirrelId)
      .map(player => ({
        squirrelId: player.squirrelId,
        position: player.position,
        rotationY: player.rotationY
      }));

    if (existingPlayers.length > 0) {
      this.sendMessage(socket, {
        type: "existing_players",
        players: existingPlayers,
        timestamp: Date.now()
      });
    }
  }

  // Industry Standard: Broadcast player join to existing players
  private broadcastPlayerJoin(squirrelId: string, playerConnection: PlayerConnection): void {
    const joinMessage = {
      type: "player_join",
      squirrelId,
      position: playerConnection.position,
      rotationY: playerConnection.rotationY,
      timestamp: Date.now()
    };

    this.broadcastToOthers(squirrelId, joinMessage);
  }

  // Industry Standard: Message handling with validation
  private setupMessageHandlers(playerConnection: PlayerConnection): void {
    playerConnection.socket.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data as string);
        await this.handlePlayerMessage(playerConnection, data);
      } catch (error) {
        console.error(`[ForestManager] Message parsing error from ${playerConnection.squirrelId}:`, error);
      }
    });

    playerConnection.socket.addEventListener("close", () => {
      this.handlePlayerDisconnect(playerConnection.squirrelId);
    });

    playerConnection.socket.addEventListener("error", (error) => {
      console.error(`[ForestManager] WebSocket error for ${playerConnection.squirrelId}:`, error);
      this.handlePlayerDisconnect(playerConnection.squirrelId);
    });
  }

  // Industry Standard: Message processing with server authority
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    switch (data.type) {
      case "player_update":
        await this.handlePlayerUpdate(playerConnection, data);
        break;
      case "ping":
        this.sendMessage(playerConnection.socket, { type: "pong", timestamp: Date.now() });
        break;
      default:
        console.warn(`[ForestManager] Unknown message type: ${data.type}`);
    }
  }

  // Industry Standard: Server-authoritative position updates with validation
  private async handlePlayerUpdate(playerConnection: PlayerConnection, data: any): Promise<void> {
    // Validate position data
    if (!this.isValidPosition(data.position)) {
      console.warn(`[ForestManager] Invalid position from ${playerConnection.squirrelId}:`, data.position);
      return;
    }

    // Update player position (server is authoritative)
    const oldPosition = { ...playerConnection.position };
    playerConnection.position = data.position;
    playerConnection.rotationY = data.rotationY || 0;

    // Update session storage
    await this.updatePlayerSession(playerConnection);

    // Broadcast to other players
    this.broadcastToOthers(playerConnection.squirrelId, {
      type: "player_update",
      squirrelId: playerConnection.squirrelId,
      position: playerConnection.position,
      rotationY: playerConnection.rotationY,
      timestamp: Date.now()
    });
  }

  // Industry Standard: Position validation (anti-cheat)
  private isValidPosition(position: any): boolean {
    if (!position || typeof position !== "object") return false;
    
    const { x, y, z } = position;
    const MAX_COORDINATE = 200;
    const MIN_Y = 0;
    const MAX_Y = 50;

    return typeof x === "number" && typeof y === "number" && typeof z === "number" &&
           x >= -MAX_COORDINATE && x <= MAX_COORDINATE &&
           z >= -MAX_COORDINATE && z <= MAX_COORDINATE &&
           y >= MIN_Y && y <= MAX_Y;
  }

  // Update player session with current state
  private async updatePlayerSession(playerConnection: PlayerConnection): Promise<void> {
    try {
      const sessionId = this.env.SQUIRREL.idFromName(playerConnection.squirrelId);
      const sessionObject = this.env.SQUIRREL.get(sessionId);

      await sessionObject.fetch("https://internal/update-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "server-update", // Server has special authority
          position: playerConnection.position,
          rotationY: playerConnection.rotationY,
          connectionState: "active"
        })
      });
    } catch (error) {
      console.error(`[ForestManager] Failed to update session for ${playerConnection.squirrelId}:`, error);
    }
  }

  // Industry Standard: Clean disconnection handling
  private handlePlayerDisconnect(squirrelId: string): void {
    const playerConnection = this.gameState.activePlayers.get(squirrelId);
    if (!playerConnection) return;

    // Remove from active players
    this.gameState.activePlayers.delete(squirrelId);

    // Broadcast player leave to others
    this.broadcastToOthers(squirrelId, {
      type: "player_leave",
      squirrelId,
      timestamp: Date.now()
    });

    // Update session to disconnected state
    this.updatePlayerSession({ ...playerConnection, position: playerConnection.position });

    console.log(`[ForestManager] Player ${squirrelId} disconnected`);
  }

  // Broadcast message to all players except one
  private broadcastToOthers(excludeSquirrelId: string, message: any): void {
    for (const [squirrelId, playerConnection] of this.gameState.activePlayers) {
      if (squirrelId !== excludeSquirrelId) {
        this.sendMessage(playerConnection.socket, message);
      }
    }
  }

  // Safe message sending with error handling
  private sendMessage(socket: WebSocket, message: any): void {
    try {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error("[ForestManager] Failed to send message:", error);
    }
  }

  // Connection monitoring for cleanup
  private setupConnectionMonitoring(playerConnection: PlayerConnection): void {
    // Start heartbeat if not already running
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.cleanupStaleConnections();
      }, 30000); // Check every 30 seconds
    }
  }

  // Clean up stale connections
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const [squirrelId, playerConnection] of this.gameState.activePlayers) {
      if (now - playerConnection.lastActivity > STALE_THRESHOLD) {
        console.log(`[ForestManager] Cleaning up stale connection: ${squirrelId}`);
        this.handlePlayerDisconnect(squirrelId);
      }
    }
  }

  // Get player session info for position restoration
  private async getPlayerSessionInfo(squirrelId: string): Promise<any> {
    try {
      const sessionId = this.env.SQUIRREL.idFromName(squirrelId);
      const sessionObject = this.env.SQUIRREL.get(sessionId);

      const response = await sessionObject.fetch("https://internal/session-info");
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error(`[ForestManager] Failed to get session info for ${squirrelId}:`, error);
    }
    return null;
  }

  // Handle join requests (create session and return token)
  private async handleJoinRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId") || crypto.randomUUID();

    try {
      // Create/update session via SquirrelSession
      const sessionId = this.env.SQUIRREL.idFromName(squirrelId);
      const sessionObject = this.env.SQUIRREL.get(sessionId);

      const response = await sessionObject.fetch(`https://internal/join?squirrelId=${squirrelId}`);
      const sessionData = await response.json();

      if (sessionData.success) {
        return new Response(JSON.stringify({
          squirrelId: sessionData.squirrelId,
          token: sessionData.token,
          position: sessionData.position,
          stats: sessionData.stats
        }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        throw new Error("Failed to create session");
      }
    } catch (error) {
      console.error("[ForestManager] Join request failed:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to join game",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle terrain seed requests
  private async handleTerrainSeed(): Promise<Response> {
    const seed = await this.getTerrainSeed();
    return new Response(JSON.stringify({ seed }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Handle map state requests
  private async handleMapState(): Promise<Response> {
    const walnuts = await this.getWalnuts();
    return new Response(JSON.stringify(walnuts), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  // Get or generate terrain seed
  private async getTerrainSeed(): Promise<number> {
    if (this.gameState.terrainSeed === 0) {
      const stored = await this.state.storage.get<number>("terrainSeed");
      if (stored) {
        this.gameState.terrainSeed = stored;
      } else {
        this.gameState.terrainSeed = Math.random() * 1000;
        await this.state.storage.put("terrainSeed", this.gameState.terrainSeed);
      }
    }
    return this.gameState.terrainSeed;
  }

  // Get map objects (trees, bushes, etc.)
  private async getMapObjects(): Promise<any[]> {
    if (this.gameState.mapObjects.length === 0) {
      // Generate or load map objects
      this.gameState.mapObjects = this.generateMapObjects();
      await this.state.storage.put("mapObjects", this.gameState.mapObjects);
    }
    return this.gameState.mapObjects;
  }

  // Get walnuts
  private async getWalnuts(): Promise<any[]> {
    if (this.gameState.walnuts.length === 0) {
      const stored = await this.state.storage.get<any[]>("walnuts");
      if (stored) {
        this.gameState.walnuts = stored;
      } else {
        this.gameState.walnuts = this.generateWalnuts();
        await this.state.storage.put("walnuts", this.gameState.walnuts);
      }
    }
    return this.gameState.walnuts;
  }

  // Generate map objects
  private generateMapObjects(): any[] {
    const objects = [];
    // Add trees, bushes, etc.
    for (let i = 0; i < 50; i++) {
      objects.push({
        type: "tree",
        id: `tree-${i}`,
        position: {
          x: (Math.random() - 0.5) * 200,
          y: 0,
          z: (Math.random() - 0.5) * 200
        }
      });
    }
    return objects;
  }

  // Generate initial walnuts
  private generateWalnuts(): any[] {
    const walnuts = [];
    for (let i = 0; i < 100; i++) {
      walnuts.push({
        id: `game-walnut-${i}`,
        ownerId: "system",
        origin: "game",
        hiddenIn: Math.random() > 0.5 ? "buried" : "bush",
        location: {
          x: (Math.random() - 0.5) * 200,
          y: 0,
          z: (Math.random() - 0.5) * 200
        },
        found: false,
        timestamp: Date.now()
      });
    }
    return walnuts;
  }
}