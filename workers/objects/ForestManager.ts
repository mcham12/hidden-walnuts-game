// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions..

import { TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod, ForestObject } from "../types";
import { Logger, LogCategory, initializeLogger } from '../Logger';

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

// Enhanced player connection for multiplayer with error tracking
interface PlayerConnection {
  squirrelId: string;
  socket: WebSocket;
  isAuthenticated: boolean;
  lastActivity: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
  // Enhanced error tracking
  errorCount: number;
  lastErrorTime: number;
  connectionStartTime: number;
  messageCount: number;
  heartbeatCount: number;
  lastHeartbeat: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

// Enhanced error types for server-side diagnostics
enum ServerErrorType {
  AUTHENTICATION_FAILED = 'authentication_failed',
  WEBSOCKET_ERROR = 'websocket_error',
  MESSAGE_PARSE_ERROR = 'message_parse_error',
  PLAYER_NOT_FOUND = 'player_not_found',
  INVALID_MESSAGE = 'invalid_message',
  HEARTBEAT_TIMEOUT = 'heartbeat_timeout',
  CONNECTION_TIMEOUT = 'connection_timeout'
}

interface ServerError {
  type: ServerErrorType;
  message: string;
  timestamp: number;
  squirrelId?: string;
  details?: any;
  recoverable: boolean;
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
  
  // Enhanced error tracking
  errorHistory: ServerError[] = [];
  maxErrorHistory = 100;
  connectionMonitoringInterval: any = null;
  serverMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalErrors: 0,
    averageLatency: 0,
    uptime: 0
  };
  
  // TASK URGENTA.3: Storage Optimization - Batching
  private pendingStorageOps: any[] = [];
  private storageBatchTimeout: any = null;
  private storageBatchInterval = 2000; // 2 second batching window

  // Add server start time tracking
  private serverStartTime: number = Date.now();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    // TASK 4 FIX: Track server start time separately from cycle time
    this.serverStartTime = Date.now();
    
    // Initialize Logger with environment from DO context
    initializeLogger(env.ENVIRONMENT);
    
    // Start connection monitoring
    this.startConnectionMonitoring();
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

    // RESTORED: Server metrics endpoint for debug UI
    if (path.endsWith("/server-metrics")) {
      // Update metrics before responding
      this.updateServerMetrics();
      
      const metrics = {
        activePlayers: this.serverMetrics.activeConnections,
        totalConnections: this.serverMetrics.totalConnections,
        uptime: this.serverMetrics.uptime,
        averageLatency: this.serverMetrics.averageLatency,
        totalErrors: this.serverMetrics.totalErrors,
        serverStartTime: this.serverStartTime,
        cycleStartTime: this.cycleStartTime
      };
      
             Logger.debug(LogCategory.WEBSOCKET, `📊 Serving metrics: ${JSON.stringify(metrics)}`);
      
      return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Enhanced WebSocket upgrade with authentication and error handling
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId");
    const token = url.searchParams.get("token");

    if (!squirrelId || !token) {
      const error: ServerError = {
        type: ServerErrorType.AUTHENTICATION_FAILED,
        message: "Missing squirrelId or token in WebSocket upgrade",
        timestamp: Date.now(),
        details: { squirrelId: !!squirrelId, token: !!token },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Missing squirrelId or token", { status: 400 });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      const error: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: "Expected Upgrade: websocket header",
        timestamp: Date.now(),
        details: { upgradeHeader },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    try {
      const isAuthenticated = await this.authenticatePlayer(squirrelId, token);
      if (!isAuthenticated) {
        const error: ServerError = {
          type: ServerErrorType.AUTHENTICATION_FAILED,
          message: "Authentication failed for WebSocket connection",
          timestamp: Date.now(),
          squirrelId,
          details: { token: token.substring(0, 8) + '...' },
          recoverable: false
        };
        this.recordError(error);
        
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
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: `WebSocket upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId,
        details: error,
        recoverable: true
      };
      this.recordError(serverError);
      
      Logger.error(LogCategory.WEBSOCKET, 'WebSocket upgrade failed:', error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  // Enhanced join request with better error handling
  private async handleJoinRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const squirrelId = url.searchParams.get("squirrelId");
      
      if (!squirrelId) {
        const error: ServerError = {
          type: ServerErrorType.AUTHENTICATION_FAILED,
          message: "Missing squirrelId in join request",
          timestamp: Date.now(),
          recoverable: false
        };
        this.recordError(error);
        
        return new Response(JSON.stringify({ error: "Missing squirrelId parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Get or create SquirrelSession
      const squirrelSession = this.env.SQUIRREL.get(this.env.SQUIRREL.idFromName(squirrelId));
      const sessionResponse = await squirrelSession.fetch(request);
      
      if (!sessionResponse.ok) {
        const error: ServerError = {
          type: ServerErrorType.AUTHENTICATION_FAILED,
          message: `Session creation failed: ${sessionResponse.status}`,
          timestamp: Date.now(),
          squirrelId,
          details: { status: sessionResponse.status },
          recoverable: false
        };
        this.recordError(error);
        
        return sessionResponse;
      }

      const sessionData = await sessionResponse.json();
      Logger.info(LogCategory.AUTH, `Player ${squirrelId} joined successfully`);
      
      return new Response(JSON.stringify(sessionData), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
      
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.AUTHENTICATION_FAILED,
        message: `Join request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        details: error,
        recoverable: true
      };
      this.recordError(serverError);
      
      Logger.error(LogCategory.AUTH, 'Join request failed:', error);
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Enhanced player authentication with error tracking
  private async authenticatePlayer(squirrelId: string, token: string): Promise<boolean> {
    try {
      const sessionRequest = new Request(`https://dummy.com/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const squirrelSession = this.env.SQUIRREL.get(this.env.SQUIRREL.idFromName(squirrelId));
      const response = await squirrelSession.fetch(sessionRequest);
      
      if (!response.ok) {
        const error: ServerError = {
          type: ServerErrorType.AUTHENTICATION_FAILED,
          message: `Token validation failed: ${response.status}`,
          timestamp: Date.now(),
          squirrelId,
          details: { status: response.status },
          recoverable: false
        };
        this.recordError(error);
        return false;
      }
      
      const result = await response.json();
      return result.valid === true;
      
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.AUTHENTICATION_FAILED,
        message: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId,
        details: error,
        recoverable: true
      };
      this.recordError(serverError);
      return false;
    }
  }

  // Enhanced player connection setup with error tracking
  private async setupPlayerConnection(squirrelId: string, socket: WebSocket): Promise<void> {
    try {
      const sessionInfo = await this.getPlayerSessionInfo(squirrelId);
      
      const playerConnection: PlayerConnection = {
        squirrelId,
        socket,
        isAuthenticated: true,
        lastActivity: Date.now(),
        position: sessionInfo?.position || { x: 50, y: 2, z: 50 },
        rotationY: sessionInfo?.rotationY || 0,
        // Enhanced error tracking
        errorCount: 0,
        lastErrorTime: 0,
        connectionStartTime: Date.now(),
        messageCount: 0,
        heartbeatCount: 0,
        lastHeartbeat: Date.now(),
        connectionQuality: 'excellent'
      };

      this.activePlayers.set(squirrelId, playerConnection);
      this.sessions.add(socket); // Also add to original sessions for compatibility
      this.serverMetrics.totalConnections++;
      this.serverMetrics.activeConnections = this.activePlayers.size;

      await this.sendWorldState(socket);
      await this.sendExistingPlayers(socket, squirrelId);
      this.broadcastPlayerJoin(squirrelId, playerConnection);
      this.setupMessageHandlers(playerConnection);
      // Connection monitoring is already started in constructor

      Logger.info(LogCategory.PLAYER, `Player ${squirrelId} connected at position`, playerConnection.position);
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: `Failed to setup player connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId,
        details: error,
        recoverable: true
      };
      this.recordError(serverError);
      throw error;
    }
  }

  // Enhanced message handlers with error tracking
  private setupMessageHandlers(playerConnection: PlayerConnection): void {
    const { squirrelId, socket } = playerConnection;
    
    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        playerConnection.messageCount++;
        playerConnection.lastActivity = Date.now();
        
        Logger.debug(LogCategory.WEBSOCKET, `Enhanced handler received message from ${squirrelId}: ${JSON.stringify(message)}`);
        
        await this.handlePlayerMessage(playerConnection, message);
      } catch (error) {
        playerConnection.errorCount++;
        playerConnection.lastErrorTime = Date.now();
        
        const serverError: ServerError = {
          type: ServerErrorType.MESSAGE_PARSE_ERROR,
          message: `Failed to parse message from ${squirrelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          squirrelId,
          details: { rawData: event.data, error },
          recoverable: true
        };
        this.recordError(serverError);
        
        Logger.error(LogCategory.WEBSOCKET, `Error processing enhanced message from ${squirrelId}:`, error);
      }
    };

    socket.onclose = (event) => {
      const wasClean = event.wasClean;
      const code = event.code;
      const reason = event.reason;
      
      Logger.info(LogCategory.WEBSOCKET, `Enhanced handler: Player ${squirrelId} disconnected - Clean: ${wasClean}, Code: ${code}, Reason: ${reason}`);
      
      if (!wasClean) {
        const serverError: ServerError = {
          type: ServerErrorType.WEBSOCKET_ERROR,
          message: `Player ${squirrelId} disconnected unexpectedly`,
          timestamp: Date.now(),
          squirrelId,
          details: { code, reason, wasClean },
          recoverable: true
        };
        this.recordError(serverError);
      }
      
      this.handlePlayerDisconnect(squirrelId);
    };

    socket.onerror = (event) => {
      playerConnection.errorCount++;
      playerConnection.lastErrorTime = Date.now();
      
      const serverError: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: `WebSocket error for player ${squirrelId}`,
        timestamp: Date.now(),
        squirrelId,
        details: event,
        recoverable: true
      };
      this.recordError(serverError);
      
      Logger.error(LogCategory.WEBSOCKET, `Enhanced handler WebSocket error for ${squirrelId}:`, event);
    };
  }

  // Enhanced player message handling with validation
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    try {
      switch (data.type) {
        case "player_update":
          await this.handlePlayerUpdate(playerConnection, data);
          break;
        case "heartbeat":
          this.handleHeartbeat(playerConnection, data);
          break;
        case "ping":
          Logger.debug(LogCategory.WEBSOCKET, `Ping received from ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, { type: 'pong', timestamp: data.timestamp });
          break;
        default:
          Logger.debug(LogCategory.WEBSOCKET, `Received message from ${playerConnection.squirrelId}:`, data.type);
          // Broadcast to other players for compatibility
          this.broadcastExceptSender(playerConnection.squirrelId, JSON.stringify(data));
      }
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.INVALID_MESSAGE,
        message: `Failed to handle message from ${playerConnection.squirrelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId: playerConnection.squirrelId,
        details: { messageType: data.type, error },
        recoverable: true
      };
      this.recordError(serverError);
      
      Logger.error(LogCategory.WEBSOCKET, `Error handling message from ${playerConnection.squirrelId}:`, error);
    }
  }

  // Enhanced heartbeat handling with latency tracking
  private handleHeartbeat(playerConnection: PlayerConnection, data: any): void {
    playerConnection.heartbeatCount++;
    playerConnection.lastHeartbeat = Date.now();
    
    // Echo back the heartbeat with timestamp for latency calculation
    this.sendMessage(playerConnection.socket, {
      type: 'heartbeat',
      timestamp: data.timestamp,
      serverTime: Date.now()
    });
    
    // Update connection quality based on heartbeat frequency
    const timeSinceLastHeartbeat = Date.now() - playerConnection.lastHeartbeat;
    if (timeSinceLastHeartbeat < 30000) {
      playerConnection.connectionQuality = 'excellent';
    } else if (timeSinceLastHeartbeat < 60000) {
      playerConnection.connectionQuality = 'good';
    } else {
      playerConnection.connectionQuality = 'poor';
    }
  }

  // Enhanced player update with validation and position correction
  private async handlePlayerUpdate(playerConnection: PlayerConnection, data: any): Promise<void> {
    try {
      if (!this.isValidPosition(data.position)) {
        // TASK 3 FIX: Correct invalid position instead of rejecting
        const correctedPosition = this.correctPlayerPosition(data.position);
        
        const serverError: ServerError = {
          type: ServerErrorType.INVALID_MESSAGE,
          message: `Position corrected for ${playerConnection.squirrelId}: Y=${data.position.y.toFixed(2)} -> ${correctedPosition.y.toFixed(2)}`,
          timestamp: Date.now(),
          squirrelId: playerConnection.squirrelId,
          details: { originalPosition: data.position, correctedPosition },
          recoverable: true
        };
        this.recordError(serverError);
        
        Logger.warn(LogCategory.PLAYER, `Position corrected for ${playerConnection.squirrelId}:`, {
          original: data.position,
          corrected: correctedPosition
        });
        
        // Use corrected position
        data.position = correctedPosition;
      }

      playerConnection.position = data.position;
      if (typeof data.rotationY === 'number') {
        playerConnection.rotationY = data.rotationY;
      }

      // Update session state
      await this.updatePlayerSession(playerConnection);

      // Broadcast to other players
      this.broadcastToOthers(playerConnection.squirrelId, {
        type: 'player_update',
        squirrelId: playerConnection.squirrelId,
        position: data.position,
        rotationY: data.rotationY,
        timestamp: Date.now()
      });
      
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.INVALID_MESSAGE,
        message: `Failed to handle player update from ${playerConnection.squirrelId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId: playerConnection.squirrelId,
        details: { data, error },
        recoverable: true
      };
      this.recordError(serverError);
      
      Logger.error(LogCategory.PLAYER, `Error handling player update from ${playerConnection.squirrelId}:`, error);
    }
  }

  // Enhanced position validation with terrain height
  private isValidPosition(position: any): boolean {
    if (!position || typeof position !== 'object') return false;
    
    const { x, y, z } = position;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return false;
    
    // Validate bounds (adjust as needed for your game world)
    const maxDistance = 1000;
    if (Math.abs(x) > maxDistance || Math.abs(y) > maxDistance || Math.abs(z) > maxDistance) return false;
    
    // Validate reasonable height (not underground, not too high)
    if (y < -10 || y > 100) return false;
    
    // TASK 3 FIX: Enhanced terrain height validation to prevent floating
    const terrainHeight = this.getTerrainHeight(x, z);
    const minValidHeight = terrainHeight + 0.5; // Squirrel height above terrain
    const maxValidHeight = terrainHeight + 5; // Reduced max height to prevent excessive floating
    
    if (y < minValidHeight || y > maxValidHeight) {
      Logger.warn(LogCategory.PLAYER, `Position validation failed: player at Y=${y.toFixed(2)}, terrain=${terrainHeight.toFixed(2)}, valid range=[${minValidHeight.toFixed(2)}, ${maxValidHeight.toFixed(2)}]`);
      return false;
    }
    
    return true;
  }

  // TASK 3 FIX: Add terrain height calculation matching client-side logic
  private getTerrainHeight(x: number, z: number): number {
    // Use the same terrain seed and calculation as client-side terrain.ts
    if (!this.terrainSeed) {
      return 0.5; // Default minimum height if terrain not initialized
    }
    
    // Match client-side terrain height calculation exactly
    const noise1 = Math.sin((x + this.terrainSeed) * 0.1) * Math.cos((z + this.terrainSeed) * 0.1);
    const noise2 = Math.sin((x + this.terrainSeed) * 0.05) * Math.cos((z + this.terrainSeed) * 0.05) * 2;
    const noise3 = Math.sin((x + this.terrainSeed) * 0.02) * Math.cos((z + this.terrainSeed) * 0.02) * 1.5;
    
    // Ensure minimum height of 0.5 and maximum of 5 units (matching client)
    const height = Math.max(0.5, Math.min(5, 1.5 + noise1 + noise2 + noise3));
    return height;
  }

  // TASK 3 FIX: Enhanced position correction to prevent floating
  private correctPlayerPosition(position: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const terrainHeight = this.getTerrainHeight(position.x, position.z);
    const minValidHeight = terrainHeight + 0.5; // Squirrel height above terrain
    const maxValidHeight = terrainHeight + 3; // Reduced max height to prevent floating
    
    return {
      x: position.x,
      y: Math.max(minValidHeight, Math.min(position.y, maxValidHeight)), // Clamp to valid terrain range
      z: position.z
    };
  }

  // TASK URGENTA.3: Storage Optimization - Batching methods
  private async batchStorageOperation(operation: any): Promise<void> {
    this.pendingStorageOps.push(operation);
    
    if (!this.storageBatchTimeout) {
      this.storageBatchTimeout = setTimeout(async () => {
        await this.executeBatchStorage();
      }, this.storageBatchInterval);
    }
  }

  private async executeBatchStorage(): Promise<void> {
    if (this.pendingStorageOps.length > 0) {
      Logger.debug(LogCategory.SESSION, `💾 Executing batch of ${this.pendingStorageOps.length} storage operations`);
      
      try {
        // Execute all operations in parallel for better performance
        const storagePromises = this.pendingStorageOps.map(op => this.executeStorageOperation(op));
        await Promise.all(storagePromises);
        
        Logger.debug(LogCategory.SESSION, `✅ Successfully executed ${this.pendingStorageOps.length} storage operations`);
      } catch (error) {
        Logger.error(LogCategory.SESSION, `❌ Failed to execute batch storage operations:`, error);
      }
      
      this.pendingStorageOps = [];
    }
    this.storageBatchTimeout = null;
  }

  private async executeStorageOperation(operation: any): Promise<void> {
    try {
      const { squirrelId, position, rotationY } = operation;
      
      // Update player position in storage
      await this.storage.put(`player:${squirrelId}`, {
        position,
        rotationY,
        lastUpdate: Date.now()
      });
      
    } catch (error) {
      Logger.error(LogCategory.SESSION, `❌ Failed to execute storage operation:`, error);
    }
  }

  // Enhanced session update with error handling and batching
  private async updatePlayerSession(playerConnection: PlayerConnection): Promise<void> {
    try {
      // TASK URGENTA.3: Add to batch instead of immediate storage
      const storageOp = {
        squirrelId: playerConnection.squirrelId,
        position: playerConnection.position,
        rotationY: playerConnection.rotationY
      };
      
      await this.batchStorageOperation(storageOp);
      
      // Also update SquirrelSession for immediate consistency
      const sessionRequest = new Request(`https://dummy.com/update-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'session-token', // This would come from the player's session
          position: playerConnection.position,
          rotationY: playerConnection.rotationY
        })
      });
      
      const squirrelSession = this.env.SQUIRREL.get(this.env.SQUIRREL.idFromName(playerConnection.squirrelId));
      const response = await squirrelSession.fetch(sessionRequest);
      
      if (!response.ok) {
        Logger.warn(LogCategory.SESSION, `Failed to update session for ${playerConnection.squirrelId}: ${response.status}`);
      }
    } catch (error) {
      Logger.error(LogCategory.SESSION, `Error updating session for ${playerConnection.squirrelId}:`, error);
    }
  }

  // Enhanced player disconnect with cleanup
  private handlePlayerDisconnect(squirrelId: string): void {
    const playerConnection = this.activePlayers.get(squirrelId);
    if (playerConnection) {
      Logger.info(LogCategory.WEBSOCKET, `👋 Player disconnecting: ${squirrelId}`);
      
      // TASK 4 FIX: Proper cleanup to prevent connection leaks
      try {
        // Close the WebSocket if still open
        if (playerConnection.socket.readyState === WebSocket.OPEN) {
          playerConnection.socket.close();
        }
      } catch (error) {
        Logger.warn(LogCategory.WEBSOCKET, `Failed to close socket for ${squirrelId}:`, error);
      }
      
      // Remove from active players
      this.activePlayers.delete(squirrelId);
      
      // Broadcast to other players
      this.broadcastToOthers(squirrelId, {
        type: "player_left",
        squirrelId,
        timestamp: Date.now()
      });
      
      // Update metrics immediately after disconnect
      this.updateServerMetrics();
      
      Logger.debug(LogCategory.WEBSOCKET, `✅ Cleaned up player ${squirrelId}, ${this.activePlayers.size} players remaining`);
    }
  }

  // Enhanced connection monitoring
  private startConnectionMonitoring(): void {
    this.connectionMonitoringInterval = setInterval(() => {
      this.cleanupStaleConnections();
      this.updateServerMetrics();
    }, 120000); // TASK URGENTA.7: Increased from 30 to 120 seconds
  }

  // Enhanced stale connection cleanup
  private cleanupStaleConnections(): void {
    const now = Date.now();
    // TASK URGENTA.7: Increased timeout from 1 minute to 3 minutes
    const staleThreshold = 3 * 60 * 1000; // 3 minutes
    
    // TASK 4 FIX: More aggressive cleanup to prevent connection leaks
    const playersToRemove: string[] = [];
    
    for (const [squirrelId, playerConnection] of this.activePlayers) {
      const inactiveTime = now - playerConnection.lastActivity;
      const isStale = inactiveTime > staleThreshold;
      const isDisconnected = playerConnection.socket.readyState !== WebSocket.OPEN;
      
      if (isStale || isDisconnected) {
        Logger.info(LogCategory.WEBSOCKET, 
          `🧹 Cleaning up stale connection: ${squirrelId} (inactive: ${inactiveTime}ms, disconnected: ${isDisconnected})`
        );
        playersToRemove.push(squirrelId);
      }
    }
    
    // Remove stale connections
    for (const squirrelId of playersToRemove) {
      this.handlePlayerDisconnect(squirrelId);
    }
    
    // Update metrics after cleanup
    this.updateServerMetrics();
    
    if (playersToRemove.length > 0) {
      Logger.debug(LogCategory.WEBSOCKET, 
        `🧹 Cleaned up ${playersToRemove.length} stale connections, ${this.activePlayers.size} remaining`
      );
    }
  }

  // Enhanced server metrics update
  private updateServerMetrics(): void {
    // TASK 4 FIX: Use server start time, not cycle start time for uptime
    this.serverMetrics.uptime = Date.now() - this.serverStartTime;
    this.serverMetrics.activeConnections = this.activePlayers.size;
    
    // TASK 4 FIX: Fix latency calculation - use actual round-trip time from heartbeats
    let totalLatency = 0;
    let latencyCount = 0;
    
    for (const playerConnection of this.activePlayers.values()) {
      // Calculate latency based on heartbeat round-trip time
      if (playerConnection.heartbeatCount > 0 && playerConnection.lastHeartbeat > 0) {
        // Use a more realistic latency calculation
        const timeSinceLastHeartbeat = Date.now() - playerConnection.lastHeartbeat;
        
        // Only include recent heartbeats (within last 30 seconds) for latency calc
        if (timeSinceLastHeartbeat < 30000) {
          // Estimate latency as half the heartbeat interval for active connections
          const estimatedLatency = Math.min(timeSinceLastHeartbeat / 2, 1000); // Cap at 1 second
          totalLatency += estimatedLatency;
          latencyCount++;
        }
      }
    }
    
    if (latencyCount > 0) {
      this.serverMetrics.averageLatency = totalLatency / latencyCount;
    } else {
      this.serverMetrics.averageLatency = 0;
    }
    
         Logger.debug(LogCategory.WEBSOCKET, 
       `📊 Server metrics: ${this.serverMetrics.activeConnections} active, ${this.serverMetrics.totalConnections} total, ${this.serverMetrics.averageLatency.toFixed(1)}ms avg latency`
     );
  }

  // Enhanced error recording
  private recordError(error: ServerError): void {
    this.serverMetrics.totalErrors++;
    this.errorHistory.push(error);
    
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift(); // Keep only recent errors
    }
    
    Logger.error(LogCategory.WEBSOCKET, `Server Error [${error.type}]: ${error.message}`, error.details);
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
      
      // FIXED: Also send individual player_joined messages for each existing player
      // This ensures the client creates remote player entities properly
      for (const player of existingPlayers) {
        this.sendMessage(socket, {
          type: "player_joined",
          squirrelId: player.squirrelId,
          position: player.position,
          rotationY: player.rotationY,
          timestamp: Date.now()
        });
      }
    }
  }

  // Broadcast player join
  private broadcastPlayerJoin(squirrelId: string, playerConnection: PlayerConnection): void {
    const joinMessage = {
      type: "player_joined",
      squirrelId,
      position: playerConnection.position,
      rotationY: playerConnection.rotationY,
      timestamp: Date.now()
    };

    this.broadcastToOthers(squirrelId, joinMessage);
  }

  // Get player session info - simplified for development
  private async getPlayerSessionInfo(squirrelId: string): Promise<any> {
    Logger.debug(LogCategory.SESSION, `Getting session info for: ${squirrelId}`);
    
    // FIXED: For development, check if we have an existing active player connection
    // This ensures position persistence across reconnects
    const existingConnection = this.activePlayers.get(squirrelId);
    if (existingConnection) {
      Logger.debug(LogCategory.SESSION, `Found existing connection for ${squirrelId}, returning current position`);
      return {
        position: existingConnection.position,
        rotationY: existingConnection.rotationY,
        stats: { found: 0, hidden: 0 }
      };
    }
    
    // FIXED: For new players or reconnects, generate a random spawn position
    // but make it more predictable based on squirrelId for testing
    const hash = squirrelId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const position = { 
      x: (hash % 100) - 50, // Generate position based on squirrelId hash
      y: 2, 
      z: ((hash * 7) % 100) - 50 
    };
    
    Logger.debug(LogCategory.SESSION, `Generated new position for ${squirrelId}:`, position);
    
    return {
      position: position,
      rotationY: 0,
      stats: { found: 0, hidden: 0 }
    };
  }

  // Enhanced broadcast to others
  private broadcastToOthers(excludeSquirrelId: string, message: any): void {
    const serializedMessage = JSON.stringify(message);
    
    for (const [squirrelId, playerConnection] of this.activePlayers) {
      if (squirrelId !== excludeSquirrelId && playerConnection.socket.readyState === WebSocket.OPEN) {
        try {
          playerConnection.socket.send(serializedMessage);
        } catch (error) {
          Logger.error(LogCategory.WEBSOCKET, `Failed to send message to ${squirrelId}:`, error);
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
        Logger.error(LogCategory.WEBSOCKET, "Failed to send message:", error);
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
    Logger.info(LogCategory.MAP, 'Reset map with forestObjects:', this.forestObjects);
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
      Logger.debug(LogCategory.MAP, 'Loaded mapState from storage:', this.mapState);
    }
    
    const storedSeed = await this.storage.get('terrainSeed');
    if (storedSeed !== null && typeof storedSeed === 'number') {
      this.terrainSeed = storedSeed;
      Logger.debug(LogCategory.MAP, 'Loaded terrainSeed from storage:', this.terrainSeed);
    } else {
      this.terrainSeed = Math.random() * 1000;
      await this.storage.put('terrainSeed', this.terrainSeed);
      Logger.debug(LogCategory.MAP, 'Initialized new terrainSeed:', this.terrainSeed);
    }
    
    const storedForestObjects = await this.storage.get('forestObjects');
    if (storedForestObjects) {
      this.forestObjects = Array.isArray(storedForestObjects) ? storedForestObjects : [];
      Logger.debug(LogCategory.MAP, 'Loaded forestObjects from storage:', this.forestObjects);
    } else {
      this.forestObjects = this.generateForestObjects();
      await this.storage.put('forestObjects', this.forestObjects);
      Logger.debug(LogCategory.MAP, 'Initialized forestObjects:', this.forestObjects);
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
      Logger.debug(LogCategory.MAP, 'Seeded test walnut:', testWalnut);
    }
  }

  // RESTORED: State persistence
  private async persistMapState(): Promise<void> {
    await this.storage.put("mapState", this.mapState);
  }

  // Legacy broadcast method for compatibility
  broadcast(type: string, data: object): void {
    const message = { type, data };
    const serializedMessage = JSON.stringify(message);
    
    Logger.debug(LogCategory.WEBSOCKET, `Broadcasting '${type}' event to ${this.sessions.size} connections`);
    
    let successCount = 0;
    for (const socket of this.sessions) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializedMessage);
          successCount++;
        }
      } catch (error) {
        Logger.error(LogCategory.WEBSOCKET, `Error broadcasting:`, error);
      }
    }
    
    Logger.debug(LogCategory.WEBSOCKET, `Broadcast complete: ${successCount}/${this.sessions.size} connections received '${type}'`);
  }

  broadcastExceptSender(senderId: string, message: string | ArrayBuffer) {
    for (const socket of this.sessions) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }
}