// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod, ForestObject } from "../types";
import { Logger, LogCategory } from '../Logger';

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

// Enhanced player connection for multiplayer
interface PlayerConnection {
  squirrelId: string;
  socket: WebSocket;
  isAuthenticated: boolean;
  lastActivity: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
}

export default class ForestManager {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env: any;
  cycleStartTime: number = 0;
  mapState: Walnut[] = [];
  terrainSeed: number = 0;
  forestObjects: ForestObject[] = [];
  
  // WebSocket management - supporting both old and new approaches
  sessions: Set<WebSocket> = new Set();
  activePlayers: Map<string, PlayerConnection> = new Map();
  heartbeatInterval: any = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight CORS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Enhanced WebSocket with authentication (new approach)
    if (path === "/ws") {
      return await this.handleWebSocketUpgrade(request);
    }

    // Legacy WebSocket upgrade removed - using /ws path only

    // RESTORED: Map reset endpoint
    if (path.endsWith("/reset")) {
      Logger.info(LogCategory.MAP, "Handling /reset for DO ID:", this.state.id.toString());
      await this.resetMap();
      return new Response(JSON.stringify({ message: "Map reset and walnuts respawned." }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // RESTORED: Hot zones endpoint
    if (path.endsWith("/hotzones")) {
      const zones = await this.getRecentActivity();
      return new Response(JSON.stringify(zones), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // RESTORED: Map state endpoint
    if (path.endsWith("/state") || path.endsWith("/map-state")) {
      try {
        await this.initialize();
        Logger.info(LogCategory.MAP, 'Returning mapState for /map-state:', JSON.stringify(this.mapState));
        return new Response(JSON.stringify(this.mapState), {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        });
      } catch (error: any) {
        Logger.error(LogCategory.MAP, 'Error in /map-state handler:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: error?.message || 'Unknown error' }), {
          status: 500,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // RESTORED: Terrain seed endpoint
    if (path.endsWith("/terrain-seed")) {
      await this.initialize();
      return new Response(JSON.stringify({ seed: this.terrainSeed }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // RESTORED: Forest objects endpoint
    if (path.endsWith("/forest-objects")) {
      try {
        await this.initialize();
        Logger.info(LogCategory.MAP, `🌲 Serving ${this.forestObjects.length} forest objects`);
        return new Response(JSON.stringify(this.forestObjects), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      } catch (error) {
        Logger.error(LogCategory.MAP, 'Error serving /forest-objects:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch forest objects' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
          },
        });
      }
    }

    // Legacy GET /join removed - using POST /join with authentication only

    // Enhanced join with authentication (new approach)
    if (path === "/join" && request.method === "POST") {
      return await this.handleJoinRequest(request);
    }

    // RESTORED: Walnut finding endpoint
    if (path === "/find" && request.method === "POST") {
      const { walnutId, squirrelId } = await request.json() as { walnutId?: string, squirrelId?: string };
      if (!walnutId || !squirrelId) return new Response(JSON.stringify({ error: "Missing walnutId or squirrelId" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
      return this.handleFind(walnutId, squirrelId);
    }

    // RESTORED: Walnut rehiding endpoint
    if (path === "/rehide" && request.method === "POST") {
      const { walnutId, squirrelId, location } = await request.json() as { walnutId?: string, squirrelId?: string, location?: { x: number, y: number, z: number } };
      if (!walnutId || !squirrelId || !location) return new Response(JSON.stringify({ error: "Missing walnutId, squirrelId, or location" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
      return this.handleRehide(walnutId, squirrelId, location);
    }

    // RESTORED: Test rehiding endpoint
    if (path === "/rehide-test" && request.method === "POST") {
      Logger.info(LogCategory.MAP, "Handling /rehide-test for DO ID:", this.state.id.toString());
      await this.initialize();

      const testWalnutId = "test-walnut";
      const newLocation = {
        x: Math.random() * 20,
        y: 0,
        z: Math.random() * 20
      };

      // Ensure only one test-walnut exists in mapState
      const walnutIndex = this.mapState.findIndex(w => w.id === testWalnutId);
      if (walnutIndex !== -1) {
        // Update existing walnut's location
        this.mapState[walnutIndex].location = newLocation;
        Logger.info(LogCategory.MAP, `Updated test-walnut location to:`, newLocation);
      } else {
        // Add new test walnut without replacing mapState
        this.mapState.push({
          id: testWalnutId,
          ownerId: "system",
          origin: "game" as WalnutOrigin,
          hiddenIn: "bush" as HidingMethod,
          location: newLocation,
          found: false,
          timestamp: Date.now()
        });
        Logger.info(LogCategory.MAP, `Added new test-walnut with location:`, newLocation);
      }

      await this.persistMapState();

      const msg = JSON.stringify({
        type: "walnut-rehidden",
        walnutId: testWalnutId,
        location: newLocation
      });

      for (const session of this.sessions.values()) {
        try {
          session.send(msg);
          Logger.info(LogCategory.WEBSOCKET, `Sent walnut-rehidden message to session:`, msg);
        } catch (err) {
          Logger.warn(LogCategory.WEBSOCKET, "Failed to send to session:", err);
        }
      }

      return new Response(JSON.stringify({ message: "Rehidden test message sent", newLocation }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Enhanced WebSocket upgrade with authentication
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId");
    const token = url.searchParams.get("token");

    if (!squirrelId || !token) {
      return new Response("Missing squirrelId or token", { status: 400 });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const isAuthenticated = await this.authenticatePlayer(squirrelId, token);
    if (!isAuthenticated) {
      return new Response("Authentication failed", { status: 401 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    server.accept();

    await this.setupPlayerConnection(squirrelId, server);
    Logger.info(LogCategory.PLAYER, `🎮 WebSocket connection established for player ${squirrelId}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // Enhanced join request with session management - environment-aware
  private async handleJoinRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId") || crypto.randomUUID();

    Logger.info(LogCategory.PLAYER, `🎮 Join request for squirrel ID: ${squirrelId}`);

    try {
      // Check environment
      const isDevelopment = this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'dev';
      
      if (isDevelopment) {
        // Development: Simple token generation
        const token = btoa(squirrelId + ':' + Date.now());
        
        // Generate random spawn position
        const position = {
          x: (Math.random() - 0.5) * 100,
          y: 2,
          z: (Math.random() - 0.5) * 100
        };

        const responseData = {
          squirrelId: squirrelId,
          token: token,
          position: position,
          stats: { found: 0, hidden: 0 }
        };

        Logger.info(LogCategory.PLAYER, '✅ Development join successful for:', squirrelId);
        
        return new Response(JSON.stringify(responseData), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } else {
        // Production/Preview: Full SQUIRREL Durable Object session management
        const sessionId = this.env.SQUIRREL.idFromName(squirrelId);
        const sessionObject = this.env.SQUIRREL.get(sessionId);

        const response = await sessionObject.fetch(`https://internal/join?squirrelId=${squirrelId}`);
        const sessionData = await response.json();

        if (sessionData.success) {
          Logger.info(LogCategory.PLAYER, '✅ Production join successful for:', squirrelId);
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
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, "[ForestManager] Join request failed:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to join game",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }

  // Player authentication - environment-aware
  private async authenticatePlayer(squirrelId: string, token: string): Promise<boolean> {
    Logger.info(LogCategory.AUTH, `Authenticating player ${squirrelId} with token: ${token.substring(0, 10)}...`);
    
    // Check environment
    const isDevelopment = this.env.ENVIRONMENT === 'development' || this.env.ENVIRONMENT === 'dev';
    
    if (isDevelopment) {
      // Development: Simplified authentication
      if (!token || token.length === 0) {
        Logger.warn(LogCategory.AUTH, 'Authentication failed: empty token (development mode)');
        return false;
      }
      
      Logger.info(LogCategory.AUTH, 'Authentication successful (development mode)');
      return true;
    } else {
      // Production/Preview: Full SQUIRREL Durable Object authentication
      try {
        const sessionId = this.env.SQUIRREL.idFromName(squirrelId);
        const sessionObject = this.env.SQUIRREL.get(sessionId);

        const response = await sessionObject.fetch("https://internal/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });

        const result = await response.json() as { valid: boolean };
        Logger.info(LogCategory.AUTH, `Production authentication result: ${result.valid}`);
        return result.valid;
      } catch (error) {
        Logger.error(LogCategory.AUTH, `Production authentication error for ${squirrelId}:`, error);
        return false;
      }
    }
  }

  // Enhanced player connection setup
  private async setupPlayerConnection(squirrelId: string, socket: WebSocket): Promise<void> {
    const sessionInfo = await this.getPlayerSessionInfo(squirrelId);
    
    const playerConnection: PlayerConnection = {
      squirrelId,
      socket,
      isAuthenticated: true,
      lastActivity: Date.now(),
      position: sessionInfo?.position || { x: 50, y: 2, z: 50 },
      rotationY: sessionInfo?.rotationY || 0
    };

    this.activePlayers.set(squirrelId, playerConnection);
    this.sessions.add(socket); // Also add to original sessions for compatibility

    await this.sendWorldState(socket);
    await this.sendExistingPlayers(socket, squirrelId);
    this.broadcastPlayerJoin(squirrelId, playerConnection);
    this.setupMessageHandlers(playerConnection);
    this.setupConnectionMonitoring(playerConnection);

    Logger.info(LogCategory.PLAYER, `Player ${squirrelId} connected at position`, playerConnection.position);
  }

  // Setup message handlers for enhanced connections
  private setupMessageHandlers(playerConnection: PlayerConnection): void {
    const { squirrelId, socket } = playerConnection;
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        Logger.debug(LogCategory.WEBSOCKET, `Enhanced handler received message from ${squirrelId}: ${JSON.stringify(message)}`);
        
        // Update last activity
        playerConnection.lastActivity = Date.now();
        
        await this.handlePlayerMessage(playerConnection, message);
      } catch (error) {
        Logger.error(LogCategory.WEBSOCKET, `Error processing enhanced message from ${squirrelId}:`, error);
      }
    };

    socket.onclose = () => {
      Logger.info(LogCategory.WEBSOCKET, `Enhanced handler: Player ${squirrelId} disconnected`);
      this.handlePlayerDisconnect(squirrelId);
    };

    socket.onerror = (event) => {
      Logger.error(LogCategory.WEBSOCKET, `Enhanced handler WebSocket error for ${squirrelId}:`, event);
    };
  }

  // Send world state to new player
  private async sendWorldState(socket: WebSocket): Promise<void> {
    await this.initialize();
    const worldState = {
      type: "world_state",
      terrainSeed: this.terrainSeed,
      mapState: this.mapState,
      forestObjects: this.forestObjects,
      timestamp: Date.now()
    };

    this.sendMessage(socket, worldState);
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
        players: existingPlayers,
        timestamp: Date.now()
      });
    }
  }

  // Broadcast player join
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

  // Handle player messages
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    switch (data.type) {
      case "player_update":
        await this.handlePlayerUpdate(playerConnection, data);
        break;
      case "ping":
        Logger.debug(LogCategory.WEBSOCKET, `Ping received from ${playerConnection.squirrelId}`);
        this.broadcast("pong", data.data || {});
        break;
      default:
        Logger.debug(LogCategory.WEBSOCKET, `Received message from ${playerConnection.squirrelId}:`, data.type);
        // Broadcast to other players for compatibility
        this.broadcastExceptSender(playerConnection.squirrelId, JSON.stringify(data));
    }
  }

  // Handle player position updates
  private async handlePlayerUpdate(playerConnection: PlayerConnection, data: any): Promise<void> {
    if (!this.isValidPosition(data.position)) {
      Logger.warn(LogCategory.PLAYER, `Invalid position from ${playerConnection.squirrelId}:`, data.position);
      return;
    }

    // Update player position
    playerConnection.position = data.position;
    playerConnection.rotationY = data.rotationY || 0;

    // Update session
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

  // Validate position
  private isValidPosition(position: any): boolean {
    return position && 
           typeof position.x === 'number' && 
           typeof position.y === 'number' && 
           typeof position.z === 'number' &&
           Math.abs(position.x) < 1000 &&
           Math.abs(position.z) < 1000 &&
           position.y > -10 && position.y < 100;
  }

  // Update player session - simplified for development
  private async updatePlayerSession(playerConnection: PlayerConnection): Promise<void> {
    // For development, just log the position update
    Logger.debug(LogCategory.PLAYER, `Position update for ${playerConnection.squirrelId}: (${playerConnection.position.x.toFixed(1)}, ${playerConnection.position.z.toFixed(1)})`);
    
    /* TODO: Restore proper session management for production
    try {
      const sessionId = this.env.SQUIRREL.idFromName(playerConnection.squirrelId);
      const sessionObject = this.env.SQUIRREL.get(sessionId);

      await sessionObject.fetch("https://internal/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: playerConnection.position,
          rotationY: playerConnection.rotationY
        })
      });
          } catch (error) {
        Logger.error(LogCategory.SESSION, `Failed to update session for ${playerConnection.squirrelId}:`, error);
      }
    */
  }

  // Handle player disconnect
  private handlePlayerDisconnect(squirrelId: string): void {
    const playerConnection = this.activePlayers.get(squirrelId);
    if (playerConnection) {
      this.activePlayers.delete(squirrelId);
      this.sessions.delete(playerConnection.socket);

      this.broadcastToOthers(squirrelId, {
        type: "player_leave",
        squirrelId,
        timestamp: Date.now()
      });

      console.log(`🔴 Player ${squirrelId} disconnected. Active players: ${this.activePlayers.size}`);
    }
  }

  // Get player session info - simplified for development
  private async getPlayerSessionInfo(squirrelId: string): Promise<any> {
    console.log(`📋 Getting session info for: ${squirrelId}`);
    
    // For development, return default session info
    return {
      position: { 
        x: (Math.random() - 0.5) * 100, 
        y: 2, 
        z: (Math.random() - 0.5) * 100 
      },
      rotationY: 0,
      stats: { found: 0, hidden: 0 }
    };
    
    /* TODO: Restore proper session management for production
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
    */
  }

  // Connection monitoring
  private setupConnectionMonitoring(playerConnection: PlayerConnection): void {
    if (!this.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.cleanupStaleConnections();
      }, 30000);
    }
  }

  // Clean up stale connections
  private cleanupStaleConnections(): void {
    const now = Date.now();
    const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    for (const [squirrelId, playerConnection] of this.activePlayers) {
      if (now - playerConnection.lastActivity > STALE_THRESHOLD) {
        console.log(`[ForestManager] Cleaning up stale connection: ${squirrelId}`);
        this.handlePlayerDisconnect(squirrelId);
      }
    }
  }

  // Legacy methods removed - using enhanced WebSocket handling only

  // RESTORED: Original broadcast methods
  broadcast(type: string, data: object): void {
    const message = { type, data };
    const serializedMessage = JSON.stringify(message);
    
    console.log(`📢 Broadcasting '${type}' event to ${this.sessions.size} connections`);
    
    let successCount = 0;
    for (const socket of this.sessions) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializedMessage);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error broadcasting:`, error);
      }
    }
    
    console.log(`✅ Broadcast complete: ${successCount}/${this.sessions.size} connections received '${type}'`);
  }

  broadcastExceptSender(senderId: string, message: string | ArrayBuffer) {
    for (const socket of this.sessions) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  // Enhanced broadcast to others
  private broadcastToOthers(excludeSquirrelId: string, message: any): void {
    const serializedMessage = JSON.stringify(message);
    
    for (const [squirrelId, playerConnection] of this.activePlayers) {
      if (squirrelId !== excludeSquirrelId && playerConnection.socket.readyState === WebSocket.OPEN) {
        try {
          playerConnection.socket.send(serializedMessage);
        } catch (error) {
          console.error(`Failed to send message to ${squirrelId}:`, error);
        }
      }
    }
  }

  // Send message to specific socket
  private sendMessage(socket: WebSocket, message: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    }
  }

  // RESTORED: Map reset functionality
  async resetMap(): Promise<void> {
    this.cycleStartTime = Date.now();
    this.terrainSeed = Math.random() * 1000;
    this.mapState = [{
      id: "test-walnut",
      ownerId: "system",
      origin: "game" as WalnutOrigin,
      hiddenIn: "buried" as HidingMethod,
      location: { x: 0, y: 0, z: 0 },
      found: false,
      timestamp: Date.now()
    }];
    this.forestObjects = this.generateForestObjects();
    await this.storage.put("cycleStart", this.cycleStartTime);
    await this.storage.put("terrainSeed", this.terrainSeed);
    await this.storage.put("mapState", this.mapState);
    await this.storage.put("forestObjects", this.forestObjects);
    console.log('🔄 Reset map with forestObjects:', this.forestObjects);
    this.broadcast("map_reset", { mapState: this.mapState });
  }

  // RESTORED: Forest object generation
  generateForestObjects(): ForestObject[] {
    const objects: ForestObject[] = [];
    
    // Generate trees
    for (let i = 0; i < TREE_COUNT; i++) {
      objects.push({
        id: `tree-${crypto.randomUUID()}`,
        type: "tree",
        x: (Math.random() - 0.5) * TERRAIN_SIZE,
        y: 0,
        z: (Math.random() - 0.5) * TERRAIN_SIZE,
        scale: 0.8 + Math.random() * 0.4
      });
    }
    
    // Generate shrubs
    for (let i = 0; i < SHRUB_COUNT; i++) {
      objects.push({
        id: `shrub-${crypto.randomUUID()}`,
        type: "shrub",
        x: (Math.random() - 0.5) * TERRAIN_SIZE,
        y: 0,
        z: (Math.random() - 0.5) * TERRAIN_SIZE,
        scale: 0.7 + Math.random() * 0.3
      });
    }
    
    return objects;
  }

  // RESTORED: Walnut generation
  generateWalnuts(count: number = 100): Walnut[] {
    const walnuts: Walnut[] = [];
    for (let i = 0; i < count; i++) {
      walnuts.push({
        id: `sys-${crypto.randomUUID()}`,
        ownerId: "system",
        origin: "game" as WalnutOrigin,
        hiddenIn: Math.random() < 0.5 ? "buried" as HidingMethod : "bush" as HidingMethod,
        location: {
          x: Math.random() * 100,
          y: 0,
          z: Math.random() * 100
        },
        found: false,
        timestamp: Date.now()
      });
    }
    return walnuts;
  }

  // RESTORED: Activity tracking
  async getRecentActivity(): Promise<Record<string, number>> {
    // TODO: Track found/hide timestamps and calculate activity density per zone
    return {
      "zone-A": 3,
      "zone-B": 7,
      "zone-C": 2
    };
  }

  // RESTORED: Walnut finding
  handleFind(walnutId: string, squirrelId: string): Response {
    // TODO: Implement walnut finding logic
    return new Response(JSON.stringify({ message: "Walnut found!" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // RESTORED: Walnut rehiding
  handleRehide(walnutId: string, squirrelId: string, location: { x: number, y: number, z: number }): Response {
    // TODO: Implement walnut rehiding logic
    return new Response(JSON.stringify({ message: "Walnut rehidden!" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // RESTORED: Initialization
  private async initialize(): Promise<void> {
    const storedMapState = await this.storage.get('mapState');
    if (storedMapState) {
      this.mapState = Array.isArray(storedMapState) ? storedMapState : [];
      console.log('Loaded mapState from storage:', this.mapState);
    }
    
    const storedSeed = await this.storage.get('terrainSeed');
    if (storedSeed !== null && typeof storedSeed === 'number') {
      this.terrainSeed = storedSeed;
      console.log('Loaded terrainSeed from storage:', this.terrainSeed);
    } else {
      this.terrainSeed = Math.random() * 1000;
      await this.storage.put('terrainSeed', this.terrainSeed);
      console.log('Initialized new terrainSeed:', this.terrainSeed);
    }
    
    const storedForestObjects = await this.storage.get('forestObjects');
    if (storedForestObjects) {
      this.forestObjects = Array.isArray(storedForestObjects) ? storedForestObjects : [];
      console.log('Loaded forestObjects from storage:', this.forestObjects);
    } else {
      this.forestObjects = this.generateForestObjects();
      await this.storage.put('forestObjects', this.forestObjects);
      console.log('Initialized forestObjects:', this.forestObjects);
    }
    
    if (this.mapState.length === 0 || !this.mapState.some(w => w.id === "test-walnut")) {
      const testWalnut: Walnut = {
        id: "test-walnut",
        ownerId: "system",
        origin: "game" as WalnutOrigin,
        hiddenIn: "buried" as HidingMethod,
        location: { x: 0, y: 0, z: 0 },
        found: false,
        timestamp: Date.now()
      };
      if (this.mapState.length === 0) {
        this.mapState = [testWalnut];
      } else {
        this.mapState.push(testWalnut);
      }
      await this.storage.put('mapState', this.mapState);
      console.log('Seeded test walnut:', testWalnut);
    }
  }

  // RESTORED: State persistence
  private async persistMapState(): Promise<void> {
    await this.storage.put("mapState", this.mapState);
  }
}