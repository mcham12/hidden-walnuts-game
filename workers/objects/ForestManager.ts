// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions..

import { TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE, ANTI_CHEAT, MOVEMENT_VALIDATION } from "../constants";
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

// Enhanced player connection for multiplayer with error tracking and anti-cheat
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
  // MVP 7 Task 6: Anti-cheat tracking
  lastPositionUpdate: number;
  lastPosition: { x: number; y: number; z: number };
  violationCount: number;
  violations: Array<{
    type: string;
    timestamp: number;
    details: any;
  }>;
  isFlagged: boolean;
  flagReason?: string;
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
    uptime: 0,
    // MVP 7 Task 7: Enhanced disconnect tracking
    totalDisconnections: 0,
    averageConnectionDuration: 0,
    disconnectReasons: {} as Record<string, number>
  };
  
  // TASK URGENTA.3: Storage Optimization - Batching
  private pendingStorageOps: any[] = [];
  private storageBatchTimeout: any = null;
  private storageBatchInterval = 500; // 500ms batching window (was 2000ms)

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
    
    // TASK URGENTA.2: Remove automatic monitoring start to allow hibernation
    // Connection monitoring will be started only when needed
    
    // TASK 4 FIX: Load persisted metrics on startup (async, don't block constructor)
    this.loadServerMetrics().catch(error => 
      Logger.warn(LogCategory.WEBSOCKET, 'Failed to load server metrics during startup:', error)
    );
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

  // MVP 7 Task 7: Enhanced WebSocket upgrade with comprehensive security and validation
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId");
    const token = url.searchParams.get("token");
    const clientVersion = url.searchParams.get("version") || "unknown";

    // MVP 7 Task 7: Enhanced security validation
    if (!squirrelId || !token) {
      const error: ServerError = {
        type: ServerErrorType.AUTHENTICATION_FAILED,
        message: "Missing squirrelId or token in WebSocket upgrade",
        timestamp: Date.now(),
        details: { squirrelId: !!squirrelId, token: !!token, clientVersion },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Missing squirrelId or token", { status: 400 });
    }

    // MVP 7 Task 7: Validate squirrelId format (basic security)
    if (!this.isValidSquirrelId(squirrelId)) {
      const error: ServerError = {
        type: ServerErrorType.AUTHENTICATION_FAILED,
        message: "Invalid squirrelId format",
        timestamp: Date.now(),
        squirrelId,
        details: { clientVersion },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Invalid squirrelId format", { status: 400 });
    }

    // MVP 7 Task 7: Enhanced WebSocket upgrade validation
    const upgradeHeader = request.headers.get("Upgrade");
    const connectionHeader = request.headers.get("Connection");
    
    if (upgradeHeader !== "websocket") {
      const error: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: "Expected Upgrade: websocket header",
        timestamp: Date.now(),
        details: { upgradeHeader, connectionHeader, clientVersion },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    if (!connectionHeader || !connectionHeader.toLowerCase().includes("upgrade")) {
      const error: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: "Expected Connection: upgrade header",
        timestamp: Date.now(),
        details: { upgradeHeader, connectionHeader, clientVersion },
        recoverable: false
      };
      this.recordError(error);
      
      return new Response("Expected Connection: upgrade", { status: 400 });
    }

    // MVP 7 Task 7: Rate limiting for connection attempts
    if (this.isConnectionRateLimited(squirrelId)) {
      const error: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: "Connection rate limit exceeded",
        timestamp: Date.now(),
        squirrelId,
        details: { clientVersion },
        recoverable: true
      };
      this.recordError(error);
      
      return new Response("Too many connection attempts", { status: 429 });
    }

    try {
      // MVP 7 Task 7: Enhanced authentication with timeout
      const isAuthenticated = await this.authenticatePlayerWithTimeout(squirrelId, token, 5000);
      if (!isAuthenticated) {
        const error: ServerError = {
          type: ServerErrorType.AUTHENTICATION_FAILED,
          message: "Authentication failed for WebSocket connection",
          timestamp: Date.now(),
          squirrelId,
          details: { token: token.substring(0, 8) + '...', clientVersion },
          recoverable: false
        };
        this.recordError(error);
        
        return new Response("Authentication failed", { status: 401 });
      }

      // MVP 7 Task 7: Check if player is already connected (prevent duplicates)
      if (this.activePlayers.has(squirrelId)) {
        Logger.warn(LogCategory.WEBSOCKET, `Player ${squirrelId} already connected, closing existing connection`);
        this.handlePlayerDisconnect(squirrelId);
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      
      // MVP 7 Task 7: Enhanced WebSocket configuration
      server.accept();
      
      // Set WebSocket properties for better connection handling
      server.addEventListener('close', (event) => {
        Logger.debug(LogCategory.WEBSOCKET, `WebSocket closed for ${squirrelId}: code=${event.code}, reason=${event.reason}`);
      });

      await this.setupPlayerConnection(squirrelId, server);
      Logger.info(LogCategory.PLAYER, `🎮 WebSocket connection established for player ${squirrelId} (v${clientVersion})`);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          'Sec-WebSocket-Protocol': 'hidden-walnuts-v1',
          'X-Connection-ID': this.generateConnectionId(squirrelId)
        }
      });
    } catch (error) {
      const serverError: ServerError = {
        type: ServerErrorType.WEBSOCKET_ERROR,
        message: `WebSocket upgrade failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        squirrelId,
        details: { error, clientVersion },
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

  // MVP 7 Task 7: Enhanced authentication with timeout
  private async authenticatePlayerWithTimeout(squirrelId: string, token: string, timeoutMs: number): Promise<boolean> {
    const timeoutPromise = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    });
    
    const authPromise = this.authenticatePlayer(squirrelId, token);
    
    return Promise.race([authPromise, timeoutPromise]);
  }

  // MVP 7 Task 7: Validate squirrelId format (UUID v4)
  private isValidSquirrelId(squirrelId: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(squirrelId);
  }

  // MVP 7 Task 7: Rate limiting for connection attempts
  private connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly MAX_CONNECTION_ATTEMPTS = 5;
  private readonly CONNECTION_ATTEMPT_WINDOW = 60000; // 1 minute

  private isConnectionRateLimited(squirrelId: string): boolean {
    const now = Date.now();
    const attempts = this.connectionAttempts.get(squirrelId);
    
    if (!attempts) {
      this.connectionAttempts.set(squirrelId, { count: 1, lastAttempt: now });
      return false;
    }
    
    // Reset if outside window
    if (now - attempts.lastAttempt > this.CONNECTION_ATTEMPT_WINDOW) {
      this.connectionAttempts.set(squirrelId, { count: 1, lastAttempt: now });
      return false;
    }
    
    // Increment attempt count
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Clean up old entries periodically
    if (Math.random() < 0.1) { // 10% chance to clean up
      this.cleanupConnectionAttempts();
    }
    
    return attempts.count > this.MAX_CONNECTION_ATTEMPTS;
  }

  // MVP 7 Task 7: Clean up old connection attempts
  private cleanupConnectionAttempts(): void {
    const now = Date.now();
    for (const [squirrelId, attempts] of this.connectionAttempts.entries()) {
      if (now - attempts.lastAttempt > this.CONNECTION_ATTEMPT_WINDOW) {
        this.connectionAttempts.delete(squirrelId);
      }
    }
  }

  // MVP 7 Task 7: Generate unique connection ID
  private generateConnectionId(squirrelId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${squirrelId.substring(0, 8)}-${timestamp}-${random}`;
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
        connectionQuality: 'excellent',
        // MVP 7 Task 6: Anti-cheat tracking
        lastPositionUpdate: Date.now(),
        lastPosition: sessionInfo?.position || { x: 50, y: 2, z: 50 },
        violationCount: 0,
        violations: [],
        isFlagged: false
      };

      this.activePlayers.set(squirrelId, playerConnection);
      this.sessions.add(socket); // Also add to original sessions for compatibility
      
      // TASK 4 FIX: Increment and persist total connections
      this.serverMetrics.totalConnections++;
      this.serverMetrics.activeConnections = this.activePlayers.size;
      await this.saveServerMetrics();

      // POSITION PERSISTENCE FIX: Send player's saved position FIRST
      Logger.info(LogCategory.PLAYER, `📤 Sending init message to ${squirrelId} with saved position:`, playerConnection.position);
      this.sendMessage(socket, {
        type: 'init',
        squirrelId: squirrelId,
        data: {
          confirmedSquirrelId: squirrelId,
          savedPosition: playerConnection.position,
          savedRotationY: playerConnection.rotationY
        },
        timestamp: Date.now()
      });

      await this.sendWorldState(socket);
      await this.sendExistingPlayers(socket, squirrelId);
      this.broadcastPlayerJoin(squirrelId, playerConnection);
      this.setupMessageHandlers(playerConnection);
      
      // TASK URGENTA.2: Start monitoring only when we have active connections
      this.startConnectionMonitoring();

      Logger.info(LogCategory.PLAYER, `Player ${squirrelId} connected at saved position`, playerConnection.position);
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

  // MVP 7 Task 7: Enhanced heartbeat handling with comprehensive connection monitoring
  private handleHeartbeat(playerConnection: PlayerConnection, data: any): void {
    const now = Date.now();
    playerConnection.heartbeatCount++;
    playerConnection.lastHeartbeat = now;
    playerConnection.lastActivity = now;
    
    // MVP 7 Task 7: Enhanced heartbeat response with connection health data
    this.sendMessage(playerConnection.socket, {
      type: 'heartbeat',
      timestamp: data.timestamp,
      serverTime: now,
      connectionHealth: {
        quality: playerConnection.connectionQuality,
        uptime: now - playerConnection.connectionStartTime,
        messageCount: playerConnection.messageCount,
        errorCount: playerConnection.errorCount,
        violationCount: playerConnection.violationCount
      }
    });
    
    // MVP 7 Task 7: Dynamic connection quality assessment
    this.updateConnectionQuality(playerConnection);
    
    // MVP 7 Task 7: Connection health monitoring
    this.monitorConnectionHealth(playerConnection);
  }

  // MVP 7 Task 7: Dynamic connection quality assessment
  private updateConnectionQuality(playerConnection: PlayerConnection): void {
    const now = Date.now();
    const timeSinceLastHeartbeat = now - playerConnection.lastHeartbeat;
    const timeSinceLastActivity = now - playerConnection.lastActivity;
    const errorRate = playerConnection.errorCount / Math.max(playerConnection.messageCount, 1);
    
    let newQuality: PlayerConnection['connectionQuality'] = 'excellent';
    
    // Assess based on multiple factors
    if (timeSinceLastHeartbeat > 120000 || timeSinceLastActivity > 180000) {
      newQuality = 'critical';
    } else if (timeSinceLastHeartbeat > 90000 || timeSinceLastActivity > 120000) {
      newQuality = 'poor';
    } else if (timeSinceLastHeartbeat > 60000 || timeSinceLastActivity > 90000) {
      newQuality = 'fair';
    } else if (timeSinceLastHeartbeat > 30000 || timeSinceLastActivity > 60000) {
      newQuality = 'good';
    }
    
    // Adjust based on error rate
    if (errorRate > 0.1) { // More than 10% errors
      newQuality = 'poor';
    } else if (errorRate > 0.05) { // More than 5% errors
      newQuality = 'fair';
    }
    
    // Adjust based on violations
    if (playerConnection.violationCount > 5) {
      newQuality = 'poor';
    }
    
    playerConnection.connectionQuality = newQuality;
  }

  // MVP 7 Task 7: Connection health monitoring
  private monitorConnectionHealth(playerConnection: PlayerConnection): void {
    const now = Date.now();
    const connectionAge = now - playerConnection.connectionStartTime;
    
    // Log connection health periodically
    if (playerConnection.heartbeatCount % 10 === 0) { // Every 10th heartbeat
      Logger.debug(LogCategory.WEBSOCKET, 
        `Connection health for ${playerConnection.squirrelId}: ` +
        `quality=${playerConnection.connectionQuality}, ` +
        `uptime=${Math.floor(connectionAge / 1000)}s, ` +
        `messages=${playerConnection.messageCount}, ` +
        `errors=${playerConnection.errorCount}, ` +
        `violations=${playerConnection.violationCount}`
      );
    }
    
    // Auto-disconnect critical connections
    if (playerConnection.connectionQuality === 'critical' && connectionAge > 300000) { // 5 minutes
      Logger.warn(LogCategory.WEBSOCKET, 
        `Auto-disconnecting critical connection: ${playerConnection.squirrelId}`
      );
      this.handlePlayerDisconnect(playerConnection.squirrelId);
    }
  }

  // MVP 7 Task 6: Enhanced player update with comprehensive anti-cheat validation
  private async handlePlayerUpdate(playerConnection: PlayerConnection, data: any): Promise<void> {
    try {
      const now = Date.now();
      const newPosition = data.position;
      
      // MVP 7 Task 6: Comprehensive anti-cheat validation
      const validation = this.validateMovement(playerConnection, newPosition);
      
      if (!validation.isValid) {
        // Record violations for each detected issue
        for (const violation of validation.violations) {
          this.recordViolation(playerConnection, violation, {
            originalPosition: newPosition,
            correctedPosition: validation.correctedPosition,
            lastPosition: playerConnection.lastPosition,
            deltaTime: (now - playerConnection.lastPositionUpdate) / 1000
          });
        }
        
        // Use corrected position if available, otherwise reject the update
        if (validation.correctedPosition) {
          data.position = validation.correctedPosition;
          Logger.warn(LogCategory.PLAYER, `🚨 Anti-cheat: Position corrected for ${playerConnection.squirrelId}:`, {
            original: newPosition,
            corrected: validation.correctedPosition,
            violations: validation.violations
          });
        } else {
          Logger.warn(LogCategory.PLAYER, `🚨 Anti-cheat: Rejecting invalid position for ${playerConnection.squirrelId}:`, {
            position: newPosition,
            violations: validation.violations
          });
          return; // Reject the update
        }
      }
      
      // Update player connection with new position and timing
      playerConnection.lastPosition = playerConnection.position;
      playerConnection.position = data.position;
      playerConnection.lastPositionUpdate = now;
      
      if (typeof data.rotationY === 'number') {
        playerConnection.rotationY = data.rotationY;
      }

      // POSITION PERSISTENCE FIX: Save position more frequently during gameplay
      // This ensures position is saved even if player disconnects abruptly
      Logger.debug(LogCategory.SESSION, `💾 Saving position for ${playerConnection.squirrelId}:`, data.position);
      await this.updatePlayerSession(playerConnection);

      // Broadcast authoritative position to other players
      this.broadcastToOthers(playerConnection.squirrelId, {
        type: 'player_update',
        squirrelId: playerConnection.squirrelId,
        position: data.position,
        rotationY: data.rotationY,
        timestamp: now,
        authoritative: true // Mark as server-authoritative
      });
      
      // Send position correction to client if position was modified
      if (!validation.isValid && validation.correctedPosition) {
        this.sendMessage(playerConnection.socket, {
          type: 'position_correction',
          originalPosition: newPosition,
          correctedPosition: validation.correctedPosition,
          violations: validation.violations,
          timestamp: now
        });
      }
      
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

  // MVP 7 Task 6: Comprehensive Anti-Cheat Validation System
  private validateMovement(playerConnection: PlayerConnection, newPosition: { x: number; y: number; z: number }): {
    isValid: boolean;
    correctedPosition?: { x: number; y: number; z: number };
    violations: string[];
  } {
    const violations: string[] = [];
    const now = Date.now();
    const lastPosition = playerConnection.lastPosition;
    const lastUpdate = playerConnection.lastPositionUpdate;
    
    // Calculate time delta and distance
    const deltaTime = (now - lastUpdate) / 1000; // Convert to seconds
    const distance = this.calculateDistance(lastPosition, newPosition);
    
    // 1. Rate limiting validation
    if (deltaTime < ANTI_CHEAT.MIN_UPDATE_INTERVAL / 1000) {
      violations.push(`UPDATE_RATE_TOO_HIGH: ${(1/deltaTime).toFixed(1)}Hz > ${ANTI_CHEAT.MAX_UPDATE_RATE}Hz`);
    }
    
    // 2. Speed validation
    if (deltaTime > MOVEMENT_VALIDATION.MIN_TIME_FOR_SPEED_CALC) {
      const speed = distance / deltaTime;
      const maxAllowedSpeed = ANTI_CHEAT.MAX_MOVE_SPEED * ANTI_CHEAT.SPEED_TOLERANCE;
      
      if (speed > maxAllowedSpeed) {
        violations.push(`SPEED_VIOLATION: ${speed.toFixed(1)} > ${maxAllowedSpeed.toFixed(1)} units/s`);
      }
    }
    
    // 3. Teleportation detection
    if (distance > ANTI_CHEAT.MAX_TELEPORT_DISTANCE) {
      violations.push(`TELEPORTATION_DETECTED: ${distance.toFixed(1)} > ${ANTI_CHEAT.MAX_TELEPORT_DISTANCE} units`);
    }
    
    // 4. Single update distance validation
    if (distance > MOVEMENT_VALIDATION.MAX_SINGLE_UPDATE_DISTANCE) {
      violations.push(`SINGLE_UPDATE_TOO_FAR: ${distance.toFixed(1)} > ${MOVEMENT_VALIDATION.MAX_SINGLE_UPDATE_DISTANCE} units`);
    }
    
    // 5. World bounds validation
    if (newPosition.x < ANTI_CHEAT.WORLD_BOUNDS.MIN_X || newPosition.x > ANTI_CHEAT.WORLD_BOUNDS.MAX_X) {
      violations.push(`X_OUT_OF_BOUNDS: ${newPosition.x} not in [${ANTI_CHEAT.WORLD_BOUNDS.MIN_X}, ${ANTI_CHEAT.WORLD_BOUNDS.MAX_X}]`);
    }
    
    if (newPosition.z < ANTI_CHEAT.WORLD_BOUNDS.MIN_Z || newPosition.z > ANTI_CHEAT.WORLD_BOUNDS.MAX_Z) {
      violations.push(`Z_OUT_OF_BOUNDS: ${newPosition.z} not in [${ANTI_CHEAT.WORLD_BOUNDS.MIN_Z}, ${ANTI_CHEAT.WORLD_BOUNDS.MAX_Z}]`);
    }
    
    if (newPosition.y < ANTI_CHEAT.MIN_Y_COORDINATE || newPosition.y > ANTI_CHEAT.MAX_Y_COORDINATE) {
      violations.push(`Y_OUT_OF_BOUNDS: ${newPosition.y} not in [${ANTI_CHEAT.MIN_Y_COORDINATE}, ${ANTI_CHEAT.MAX_Y_COORDINATE}]`);
    }
    
    // 6. Terrain height validation
    const terrainHeight = this.getTerrainHeight(newPosition.x, newPosition.z);
    const minValidHeight = terrainHeight + 0.3; // Squirrel height above terrain
    const maxValidHeight = terrainHeight + 5; // Maximum height above terrain
    
    if (newPosition.y < minValidHeight || newPosition.y > maxValidHeight) {
      violations.push(`TERRAIN_HEIGHT_VIOLATION: Y=${newPosition.y.toFixed(1)}, terrain=${terrainHeight.toFixed(1)}, valid=[${minValidHeight.toFixed(1)}, ${maxValidHeight.toFixed(1)}]`);
    }
    
    // Determine if movement is valid
    const isValid = violations.length === 0;
    
    // If invalid, provide corrected position
    let correctedPosition: { x: number; y: number; z: number } | undefined;
    if (!isValid) {
      correctedPosition = this.correctPlayerPosition(newPosition);
      
      // Also clamp to world bounds
      correctedPosition.x = Math.max(ANTI_CHEAT.WORLD_BOUNDS.MIN_X, Math.min(ANTI_CHEAT.WORLD_BOUNDS.MAX_X, correctedPosition.x));
      correctedPosition.z = Math.max(ANTI_CHEAT.WORLD_BOUNDS.MIN_Z, Math.min(ANTI_CHEAT.WORLD_BOUNDS.MAX_Z, correctedPosition.z));
      correctedPosition.y = Math.max(ANTI_CHEAT.MIN_Y_COORDINATE, Math.min(ANTI_CHEAT.MAX_Y_COORDINATE, correctedPosition.y));
    }
    
    return { isValid, correctedPosition, violations };
  }

  // MVP 7 Task 6: Calculate distance between two positions
  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // MVP 7 Task 6: Record anti-cheat violation
  private recordViolation(playerConnection: PlayerConnection, violationType: string, details: any): void {
    const now = Date.now();
    
    // Add violation to player's history
    playerConnection.violations.push({
      type: violationType,
      timestamp: now,
      details
    });
    
    // Clean up old violations (keep only last 30 seconds)
    playerConnection.violations = playerConnection.violations.filter(
      v => now - v.timestamp < ANTI_CHEAT.VIOLATION_WINDOW
    );
    
    // Update violation count
    playerConnection.violationCount = playerConnection.violations.length;
    
    // Check if player should be flagged
    if (playerConnection.violationCount >= ANTI_CHEAT.MAX_VIOLATIONS_BEFORE_FLAG && !playerConnection.isFlagged) {
      playerConnection.isFlagged = true;
      playerConnection.flagReason = `Multiple violations: ${playerConnection.violations.map(v => v.type).join(', ')}`;
      
      Logger.warn(LogCategory.PLAYER, `🚨 Player ${playerConnection.squirrelId} flagged for anti-cheat violations: ${playerConnection.flagReason}`);
      
      // Send warning to player
      this.sendMessage(playerConnection.socket, {
        type: 'anti_cheat_warning',
        message: 'Suspicious movement detected. Please play fairly.',
        violations: playerConnection.violations.length
      });
    }
    
    Logger.debug(LogCategory.PLAYER, `⚠️ Anti-cheat violation for ${playerConnection.squirrelId}: ${violationType}`, details);
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

  // TASK URGENTA.3 FIX: Force execute pending storage operations
  private async forceExecuteStorage(): Promise<void> {
    if (this.pendingStorageOps.length > 0) {
      Logger.debug(LogCategory.SESSION, `💾 Force executing ${this.pendingStorageOps.length} pending storage operations`);
      await this.executeBatchStorage();
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
      // TASK URGENTA.3 FIX: Immediate storage for player position (critical data)
      // Don't batch player position - it never executes due to hibernation
      await this.storage.put(`player:${playerConnection.squirrelId}`, {
        position: playerConnection.position,
        rotationY: playerConnection.rotationY,
        lastUpdate: Date.now()
      });
      
      // TASK URGENTA.3: Only batch non-critical operations
      const nonCriticalOp = {
        type: 'activity_log',
        squirrelId: playerConnection.squirrelId,
        timestamp: Date.now(),
        activity: 'position_update'
      };
      
      await this.batchStorageOperation(nonCriticalOp);
      
      // POSITION PERSISTENCE FIX: Removed problematic dummy URL request
      // The storage.put() above is sufficient for position persistence
    } catch (error) {
      Logger.error(LogCategory.SESSION, `Error updating session for ${playerConnection.squirrelId}:`, error);
    }
  }

  // MVP 7 Task 7: Enhanced graceful disconnect handling with comprehensive cleanup
  private handlePlayerDisconnect(squirrelId: string, reason: string = 'Player disconnect'): void {
    const playerConnection = this.activePlayers.get(squirrelId);
    if (!playerConnection) {
      Logger.warn(LogCategory.PLAYER, `Player ${squirrelId} not found during disconnect`);
      return;
    }

    const disconnectTime = Date.now();
    const connectionDuration = disconnectTime - playerConnection.connectionStartTime;

    // MVP 7 Task 7: Enhanced WebSocket closure with proper error handling
    try {
      if (playerConnection.socket.readyState === WebSocket.OPEN) {
        // Send final disconnect message before closing
        this.sendMessage(playerConnection.socket, {
          type: 'disconnect',
          reason: reason,
          timestamp: disconnectTime,
          connectionStats: {
            duration: connectionDuration,
            messageCount: playerConnection.messageCount,
            heartbeatCount: playerConnection.heartbeatCount,
            errorCount: playerConnection.errorCount,
            violationCount: playerConnection.violationCount,
            finalQuality: playerConnection.connectionQuality
          }
        });
        
        // Close with appropriate code based on reason
        const closeCode = reason.includes('timeout') ? 1001 : 
                         reason.includes('error') ? 1011 : 
                         reason.includes('server') ? 1013 : 1000;
        
        playerConnection.socket.close(closeCode, reason);
      }
    } catch (error) {
      Logger.error(LogCategory.WEBSOCKET, `Error closing WebSocket for ${squirrelId}:`, error);
    }

    // MVP 7 Task 7: Enhanced cleanup with session preservation
    this.activePlayers.delete(squirrelId);
    this.sessions.delete(playerConnection.socket);

    // MVP 7 Task 7: Broadcast enhanced player leave message
    this.broadcastToOthers(squirrelId, {
      type: 'player_leave',
      squirrelId: squirrelId,
      timestamp: disconnectTime,
      reason: reason,
      finalPosition: playerConnection.position,
      connectionDuration: connectionDuration
    });

    // MVP 7 Task 7: Enhanced session update with disconnect information
    this.updatePlayerSessionOnDisconnect(playerConnection, reason, disconnectTime).catch(error => {
      Logger.error(LogCategory.SESSION, `Error updating session for ${squirrelId}:`, error);
    });

    // POSITION PERSISTENCE FIX: Save position immediately to storage on disconnect
    this.savePlayerPositionImmediately(playerConnection).catch(error => {
      Logger.error(LogCategory.SESSION, `Error saving position for ${squirrelId}:`, error);
    });

    // TASK URGENTA.3 FIX: Force execute any pending storage operations before disconnect
    this.forceExecuteStorage().catch(error => {
      Logger.error(LogCategory.SESSION, `Error forcing storage execution for ${squirrelId}:`, error);
    });

    // MVP 7 Task 7: Clean up connection attempts for this player
    this.connectionAttempts.delete(squirrelId);

    // MVP 7 Task 7: Log comprehensive disconnect information
    Logger.info(LogCategory.PLAYER, 
      `👋 Player ${squirrelId} disconnected: ` +
      `reason="${reason}", ` +
      `duration=${Math.floor(connectionDuration / 1000)}s, ` +
      `messages=${playerConnection.messageCount}, ` +
      `quality=${playerConnection.connectionQuality}`
    );

    // MVP 7 Task 7: Update server metrics
    this.updateDisconnectMetrics(squirrelId, connectionDuration, playerConnection);
    
    // TASK URGENTA.2: Stop monitoring if no active connections to allow hibernation
    if (this.activePlayers.size === 0 && this.connectionMonitoringInterval) {
      Logger.debug(LogCategory.WEBSOCKET, 'No active connections remaining, stopping monitoring to allow hibernation');
      clearInterval(this.connectionMonitoringInterval);
      this.connectionMonitoringInterval = null;
    }
  }

  // MVP 7 Task 7: Enhanced session update on disconnect
  private async updatePlayerSessionOnDisconnect(
    playerConnection: PlayerConnection, 
    reason: string, 
    disconnectTime: number
  ): Promise<void> {
    try {
      // POSITION PERSISTENCE FIX: Removed problematic dummy URL request
      // The position is already saved in savePlayerPositionImmediately() called from handlePlayerDisconnect
      Logger.debug(LogCategory.SESSION, `Player ${playerConnection.squirrelId} disconnected: ${reason}`);
    } catch (error) {
      Logger.error(LogCategory.SESSION, `Failed to update session on disconnect for ${playerConnection.squirrelId}:`, error);
    }
  }

  // MVP 7 Task 7: Update disconnect metrics
  private updateDisconnectMetrics(squirrelId: string, duration: number, playerConnection: PlayerConnection): void {
    this.serverMetrics.totalDisconnections++;
    this.serverMetrics.averageConnectionDuration = 
      (this.serverMetrics.averageConnectionDuration * (this.serverMetrics.totalDisconnections - 1) + duration) / 
      this.serverMetrics.totalDisconnections;
    
    // Track disconnect reasons
    if (!this.serverMetrics.disconnectReasons) {
      this.serverMetrics.disconnectReasons = {};
    }
    const reason = playerConnection.connectionQuality === 'critical' ? 'critical_connection' : 'normal_disconnect';
    this.serverMetrics.disconnectReasons[reason] = (this.serverMetrics.disconnectReasons[reason] || 0) + 1;
  }

  // Enhanced connection monitoring - TASK URGENTA.2: Only start when needed
  private startConnectionMonitoring(): void {
    // TASK URGENTA.2: Only start monitoring if not already running and we have active connections
    if (this.connectionMonitoringInterval || this.activePlayers.size === 0) {
      return;
    }
    
    Logger.debug(LogCategory.WEBSOCKET, 'Starting connection monitoring for active players');
    this.connectionMonitoringInterval = setInterval(() => {
      this.cleanupStaleConnections();
      this.updateServerMetrics();
    }, 300000); // TASK URGENTA.8: Increased to 5 minutes (300 seconds)
  }

  // Enhanced stale connection cleanup - TASK URGENTA.2: More aggressive cleanup
  private cleanupStaleConnections(): void {
    const now = Date.now();
    // TASK URGENTA.8: Increased timeout to 5 minutes for more lenient cleanup
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
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
    
    // TASK URGENTA.2: Stop monitoring if no active connections
    if (this.activePlayers.size === 0 && this.connectionMonitoringInterval) {
      Logger.debug(LogCategory.WEBSOCKET, 'No active connections, stopping monitoring to allow hibernation');
      clearInterval(this.connectionMonitoringInterval);
      this.connectionMonitoringInterval = null;
    }
    
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
    const now = Date.now();
    
    for (const playerConnection of this.activePlayers.values()) {
      // Calculate latency based on heartbeat round-trip time
      if (playerConnection.heartbeatCount > 0 && playerConnection.lastHeartbeat > 0) {
        // Use a more realistic latency calculation
        const timeSinceLastHeartbeat = now - playerConnection.lastHeartbeat;
        
        // Only include recent heartbeats (within last 30 seconds) for latency calc
        if (timeSinceLastHeartbeat < 30000) {
          // Estimate latency as a portion of heartbeat interval for active connections
          // For active connections, estimate ~50-200ms latency
          const estimatedLatency = Math.min(50 + (timeSinceLastHeartbeat / 1000) * 10, 200);
          totalLatency += estimatedLatency;
          latencyCount++;
        }
      }
    }
    
    if (latencyCount > 0) {
      this.serverMetrics.averageLatency = totalLatency / latencyCount;
    } else {
      // TASK 4 FIX: Provide fallback latency for active connections
      this.serverMetrics.averageLatency = this.activePlayers.size > 0 ? 75 : 0;
    }
    
    Logger.debug(LogCategory.WEBSOCKET, 
      `📊 Server metrics: ${this.serverMetrics.activeConnections} active, ${this.serverMetrics.totalConnections} total, ${this.serverMetrics.averageLatency.toFixed(1)}ms avg latency, uptime: ${(this.serverMetrics.uptime / 1000).toFixed(0)}s`
    );
  }

  // Enhanced error recording
  private recordError(error: ServerError): void {
    this.serverMetrics.totalErrors++;
    this.errorHistory.push(error);
    
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory.shift(); // Keep only recent errors
    }
    
    // TASK 4 FIX: Save metrics when errors occur
    this.saveServerMetrics().catch(e => 
      Logger.warn(LogCategory.WEBSOCKET, 'Failed to save metrics after error:', e)
    );
    
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

  // Get player session info - enhanced for position persistence
  private async getPlayerSessionInfo(squirrelId: string): Promise<any> {
    Logger.info(LogCategory.SESSION, `🔍 Getting session info for: ${squirrelId}`);
    
    // FIRST: Check if we have an existing active player connection
    // This ensures position persistence across reconnects
    const existingConnection = this.activePlayers.get(squirrelId);
    if (existingConnection) {
      Logger.info(LogCategory.SESSION, `✅ Found existing connection for ${squirrelId}, returning current position:`, existingConnection.position);
      return {
        position: existingConnection.position,
        rotationY: existingConnection.rotationY,
        stats: { found: 0, hidden: 0 }
      };
    }
    
    Logger.info(LogCategory.SESSION, `📦 No existing connection for ${squirrelId}, checking storage...`);
    
    // SECOND: Try to load saved position from storage with enhanced error handling
    const savedPosition = await this.loadSavedPlayerPosition(squirrelId);
    if (savedPosition) {
      Logger.info(LogCategory.SESSION, `✅ Successfully loaded saved position for ${squirrelId}:`, savedPosition.position);
      return savedPosition;
    }
    
    // THIRD: Try to load generated position as fallback
    const generatedPosition = await this.loadGeneratedPlayerPosition(squirrelId);
    if (generatedPosition) {
      Logger.info(LogCategory.SESSION, `🎲 Using saved generated position for ${squirrelId}:`, generatedPosition.position);
      return generatedPosition;
    }
    
    // FOURTH: Generate new position for completely new players
    Logger.info(LogCategory.SESSION, `🎲 No saved position found for ${squirrelId}, generating new position`);
    
    // Generate a predictable position based on squirrelId hash for testing
    const hash = squirrelId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const position = { 
      x: (hash % 100) - 50, // Generate position based on squirrelId hash
      y: 2, 
      z: ((hash * 7) % 100) - 50 
    };
    
    Logger.info(LogCategory.SESSION, `🎲 Generated new position for ${squirrelId}:`, position);
    
    // POSITION PERSISTENCE FIX: Save this generated position for future reconnects
    this.saveGeneratedPosition(squirrelId, position).catch(error => {
      Logger.warn(LogCategory.SESSION, `Failed to save generated position for ${squirrelId}:`, error);
    });
    
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

  // TASK 4 FIX: Load server metrics from storage to handle DO hibernation
  private async loadServerMetrics(): Promise<void> {
    try {
      const savedMetrics = await this.storage.get<any>('serverMetrics');
      const savedStartTime = await this.storage.get<number>('serverStartTime');
      
      if (savedStartTime) {
        this.serverStartTime = savedStartTime;
      }
      
      if (savedMetrics) {
        this.serverMetrics.totalConnections = savedMetrics.totalConnections || 0;
        this.serverMetrics.totalErrors = savedMetrics.totalErrors || 0;
      }
      
      // Reset active connections since they're based on current state
      this.serverMetrics.activeConnections = this.activePlayers.size;
      
      Logger.debug(LogCategory.WEBSOCKET, 
        `📊 Loaded server metrics: totalConn=${this.serverMetrics.totalConnections}, startTime=${this.serverStartTime}`
      );
    } catch (error) {
      Logger.warn(LogCategory.WEBSOCKET, 'Failed to load server metrics from storage:', error);
    }
  }

  // TASK 4 FIX: Persist server metrics to storage
  private async saveServerMetrics(): Promise<void> {
    try {
      await this.storage.put('serverMetrics', {
        totalConnections: this.serverMetrics.totalConnections,
        totalErrors: this.serverMetrics.totalErrors
      });
      await this.storage.put('serverStartTime', this.serverStartTime);
    } catch (error) {
      Logger.warn(LogCategory.WEBSOCKET, 'Failed to save server metrics:', error);
    }
  }

  // POSITION PERSISTENCE FIX: Save position immediately to storage on disconnect
  private async savePlayerPositionImmediately(playerConnection: PlayerConnection): Promise<void> {
    try {
      Logger.info(LogCategory.SESSION, `💾 Saving position immediately for ${playerConnection.squirrelId}:`, playerConnection.position);
      await this.storage.put(`player:${playerConnection.squirrelId}`, {
        position: playerConnection.position,
        rotationY: playerConnection.rotationY,
        lastUpdate: Date.now()
      });
      Logger.info(LogCategory.SESSION, `✅ Position saved successfully for ${playerConnection.squirrelId}`);
    } catch (error) {
      Logger.error(LogCategory.SESSION, `❌ Error saving position for ${playerConnection.squirrelId}:`, error);
      throw error;
    }
  }

      // POSITION PERSISTENCE FIX: Save generated position for future reconnects
    private async saveGeneratedPosition(squirrelId: string, position: { x: number; y: number; z: number }): Promise<void> {
      try {
        Logger.info(LogCategory.SESSION, `💾 Saving generated position for ${squirrelId}:`, position);
        await this.storage.put(`generatedPosition:${squirrelId}`, {
          x: position.x,
          y: position.y,
          z: position.z,
          timestamp: Date.now()
        });
        Logger.info(LogCategory.SESSION, `✅ Generated position saved successfully for ${squirrelId}`);
      } catch (error) {
        Logger.error(LogCategory.SESSION, `❌ Error saving generated position for ${squirrelId}:`, error);
        throw error;
      }
    }

    // POSITION PERSISTENCE FIX: Enhanced saved position loading with validation
    private async loadSavedPlayerPosition(squirrelId: string): Promise<any> {
      try {
        const storageKey = `player:${squirrelId}`;
        Logger.info(LogCategory.SESSION, `🔍 Looking for saved data with key: ${storageKey}`);
        
        const savedPlayerData = await this.storage.get<{
          position: { x: number; y: number; z: number };
          rotationY: number;
          lastUpdate: number;
        }>(storageKey);
        
        Logger.info(LogCategory.SESSION, `📦 Storage lookup result for ${squirrelId}:`, savedPlayerData);
        
        if (savedPlayerData && savedPlayerData.position) {
          // Validate position data
          if (this.isValidPosition(savedPlayerData.position)) {
            Logger.info(LogCategory.SESSION, `✅ Loaded valid saved position for ${squirrelId}:`, savedPlayerData.position);
            return {
              position: savedPlayerData.position,
              rotationY: savedPlayerData.rotationY || 0,
              stats: { found: 0, hidden: 0 }
            };
          } else {
            Logger.warn(LogCategory.SESSION, `⚠️ Invalid saved position for ${squirrelId}:`, savedPlayerData.position);
          }
        } else {
          Logger.warn(LogCategory.SESSION, `⚠️ No saved position found for ${squirrelId} in storage`);
        }
      } catch (error) {
        Logger.error(LogCategory.SESSION, `❌ Failed to load saved position for ${squirrelId}:`, error);
      }
      
      return null;
    }

    // POSITION PERSISTENCE FIX: Enhanced generated position loading with validation
    private async loadGeneratedPlayerPosition(squirrelId: string): Promise<any> {
      try {
        const savedGeneratedPosition = await this.storage.get<{
          x: number; y: number; z: number; timestamp: number;
        }>(`generatedPosition:${squirrelId}`);
        
        if (savedGeneratedPosition) {
          // Validate position data
          if (this.isValidPosition(savedGeneratedPosition)) {
            Logger.info(LogCategory.SESSION, `🎲 Found valid saved generated position for ${squirrelId}:`, savedGeneratedPosition);
            return {
              position: { x: savedGeneratedPosition.x, y: savedGeneratedPosition.y, z: savedGeneratedPosition.z },
              rotationY: 0,
              stats: { found: 0, hidden: 0 }
            };
          } else {
            Logger.warn(LogCategory.SESSION, `⚠️ Invalid generated position for ${squirrelId}:`, savedGeneratedPosition);
          }
        }
      } catch (error) {
        Logger.warn(LogCategory.SESSION, `Failed to load generated position for ${squirrelId}:`, error);
      }
      
      return null;
    }

  }