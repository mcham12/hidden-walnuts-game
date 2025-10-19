// Simplified ForestManager - Basic WebSocket and world state management
// Updated for MVP 3.5 - Multiple character support
// MVP 7: NPC System integration
// MVP 7.1: Turnstile bot protection and rate limiting

import { DurableObject } from 'cloudflare:workers';
import { NPCManager } from './NPCManager';
import { Env } from '../types';

// Use Cloudflare's built-in types - no need to redefine interfaces

interface PlayerConnection {
  squirrelId: string;
  socket: WebSocket;
  position: { x: number; y: number; z: number };
  rotationY: number;
  lastActivity: number;
  characterId: string;

  // MVP 5.8: Session management
  isDisconnected: boolean;
  disconnectedAt: number | null;

  // MVP 6: Player identity
  sessionToken: string;
  username: string;

  // MVP 7.1: Position save throttling
  lastPositionSave: number;

  // MVP 8: Combat system
  walnutInventory: number; // 0-10 walnuts (ammo/health)
  lastThrowTime: number; // For throw cooldown tracking
}

interface Walnut {
  id: string;
  ownerId: string;
  origin: 'game' | 'player';
  hiddenIn: 'buried' | 'bush' | 'ground'; // MVP 8: 'ground' = dropped from throw
  location: { x: number, y: number, z: number };
  found: boolean;
  timestamp: number;
  isGolden?: boolean; // MVP 8: true = golden bonus walnut (5pts), false/undefined = regular (3pts/1pt)
  immunePlayerId?: string; // MVP 8: Player who can't pick up this walnut (hit by projectile)
  immuneUntil?: number; // MVP 8: Timestamp when immunity expires (1.5 seconds after hit)
}

interface ForestObject {
  id: string;
  type: 'tree' | 'shrub' | 'rock' | 'stump';
  x: number;
  y: number;
  z: number;
  scale: number;
  modelVariant?: number; // For rocks (1-5) and other models with variants
}

// MVP 7: NPC System - Behavior states for AI decision making
enum NPCBehavior {
  IDLE = 'idle',           // Standing still, resting
  WANDER = 'wander',       // Random walking
  APPROACH = 'approach',   // Moving toward player/NPC
  GATHER = 'gather',       // Moving toward walnut
  THROW = 'throw'          // Throwing walnut animation
}

// MVP 7: NPC System - Server-side NPC data structure
interface NPC {
  id: string;                    // "npc-001", "npc-002", etc.
  characterId: string;           // Random from 11 character types
  username: string;              // "NPC - [CharacterName]"
  position: { x: number; y: number; z: number };
  rotationY: number;
  velocity: { x: number; z: number };  // Current movement direction
  currentBehavior: NPCBehavior;
  behaviorTimer: number;         // Time in current behavior (seconds)
  behaviorDuration: number;      // How long to stay in current behavior
  targetPosition?: { x: number; y: number; z: number };  // Where NPC is walking to
  targetEntityId?: string;       // Player/NPC being tracked
  animation: string;             // Current animation state ('idle', 'walk', 'run')
  walnutInventory: number;       // Walnuts carried (for throwing)
  lastThrowTime: number;         // Cooldown tracking (timestamp)
  aggressionLevel: number;       // 0-1 personality trait (0.3=passive, 0.7=aggressive)
}

export default class ForestManager extends DurableObject {
  // state and ctx are inherited from DurableObject base class
  storage: any; // Reference to ctx.storage for convenience
  env: Env; // MVP 7.1: Typed environment bindings

  // Simple state management
  mapState: Walnut[] = [];
  terrainSeed: number = 0;
  forestObjects: ForestObject[] = [];

  // Simple WebSocket management
  activePlayers: Map<string, PlayerConnection> = new Map();

  // MVP 7: NPC System
  npcManager: NPCManager;
  private lastNPCUpdate: number = 0;
  // MVP 7.1: Reduced from 150ms to 200ms (7Hz → 5Hz) for 25% cost reduction while maintaining smooth movement
  private readonly NPC_UPDATE_INTERVAL = 200; // 200ms = 5 updates/sec (cost-optimized)

  // MVP 7.1: Rate limiting state
  private connectionAttempts: Map<string, number[]> = new Map(); // IP -> timestamps
  private messageRateLimits: Map<string, {
    position: number[];
    walnutHide: number[];
    walnutFind: number[];
    chat: number[];
  }> = new Map(); // squirrelId -> action timestamps

  constructor(ctx: any, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.env = env;

    // MVP 7: Initialize NPC Manager
    this.npcManager = new NPCManager(this);
  }

  /**
   * MVP 7.1: Validate Cloudflare Turnstile token
   * Returns true if token is valid, false otherwise
   */
  private async validateTurnstileToken(token: string): Promise<boolean> {
    // Skip validation in development mode or if no secret configured
    if (!this.env.TURNSTILE_SECRET || this.env.TURNSTILE_SECRET === '') {
      console.log('⚠️ Turnstile validation skipped (no secret configured)');
      return true;
    }

    // MVP 7.1: Accept testing tokens (from Cloudflare's testing site key)
    // Testing tokens start with 'XXXX.' and are used in preview/dev environments
    if (token.startsWith('XXXX.')) {
      console.log('⚠️ Turnstile testing token detected - skipping validation (preview/dev mode)');
      return true;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.env.TURNSTILE_SECRET,
          response: token,
        }),
      });

      const data = await response.json() as any;

      if (data.success) {
        console.log('✅ Turnstile validation successful');
        return true;
      } else {
        console.warn('❌ Turnstile validation failed:', data['error-codes']);
        return false;
      }
    } catch (error) {
      console.error('❌ Turnstile validation error:', error);
      // Fail open in case of network issues (better UX, but log for monitoring)
      return true;
    }
  }

  /**
   * MVP 7.1: Check connection rate limit (per IP address)
   * Limits: 5 connections per 5 minutes per IP
   */
  private async checkConnectionRateLimit(request: Request): Promise<boolean> {
    // Skip rate limiting if binding not configured (local dev)
    if (!this.env.RATE_LIMITER) {
      return true;
    }

    // Get client IP from CF-Connecting-IP header
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

    try {
      const result = await this.env.RATE_LIMITER.limit({
        key: `connection:${clientIP}`,
        limit: 5,        // 5 connections
        period: 300,     // per 5 minutes (300 seconds)
      });

      if (!result.success) {
        console.warn(`🚫 Connection rate limit exceeded for IP ${clientIP}, retry after ${result.retryAfter}s`);
        return false;
      }

      console.log(`✅ Connection rate limit OK for IP ${clientIP} (${result.remaining}/${result.limit} remaining)`);
      return true;
    } catch (error) {
      console.error('❌ Rate limit check error:', error);
      // Fail open on error
      return true;
    }
  }

  /**
   * MVP 7.1: Check message rate limit for specific action types
   * Returns true if rate limit allows, false if exceeded
   */
  private checkMessageRateLimit(squirrelId: string, actionType: 'position' | 'walnutHide' | 'walnutFind' | 'chat'): boolean {
    const now = Date.now();

    // Get or create rate limit tracking for this player
    if (!this.messageRateLimits.has(squirrelId)) {
      this.messageRateLimits.set(squirrelId, {
        position: [],
        walnutHide: [],
        walnutFind: [],
        chat: []
      });
    }

    const limits = this.messageRateLimits.get(squirrelId)!;

    // Define rate limits for each action type
    const rateLimitConfig = {
      position: { limit: 20, window: 1000 },      // 20 updates per second
      walnutHide: { limit: 10, window: 60000 },   // 10 hides per minute
      walnutFind: { limit: 20, window: 60000 },   // 20 finds per minute
      chat: { limit: 5, window: 10000 }           // 5 messages per 10 seconds
    };

    const config = rateLimitConfig[actionType];
    const timestamps = limits[actionType];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(ts => now - ts < config.window);
    limits[actionType] = validTimestamps;

    // Check if limit exceeded
    if (validTimestamps.length >= config.limit) {
      console.warn(`🚫 Rate limit exceeded for ${squirrelId} action=${actionType} (${validTimestamps.length}/${config.limit})`);
      return false;
    }

    // Add current timestamp
    validTimestamps.push(now);
    return true;
  }

  /**
   * MVP 5.8: Durable Object Alarm for session management
   * MVP 7: Also handles NPC updates (200ms intervals)
   * MVP 7.1: Reduced from 150ms to 200ms for 25% cost reduction
   * MVP 7.2: Cost optimization - stop alarm when no players/NPCs (prevent idle processing)
   * Runs every 200ms for NPCs, checks player disconnects less frequently
   */
  async alarm(): Promise<void> {
    const now = Date.now();

    // MVP 7.2 CRITICAL: Check if we should even be running (cost optimization)
    const hasPlayers = this.activePlayers.size > 0;
    const hasNPCs = this.npcManager.getNPCCount() > 0;

    if (!hasPlayers && !hasNPCs) {
      console.log('⏸️ Stopping alarm: No players or NPCs (object will go inactive and save costs)');
      return; // DON'T reschedule - let object hibernate
    }

    // MVP 7.1: Update NPCs every 200ms (only if they exist)
    if (hasNPCs && now - this.lastNPCUpdate >= this.NPC_UPDATE_INTERVAL) {
      this.npcManager.update();
      this.lastNPCUpdate = now;
    }

    // MVP 5.8: Check player disconnects every 10 seconds
    const DISCONNECT_CHECK_INTERVAL = 10000; // 10 seconds
    const DISCONNECT_TIMEOUT = 60 * 1000; // 60 seconds
    const REMOVAL_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    // Only check disconnects every 10 seconds (not every 100ms)
    if (now - this.lastDisconnectCheck >= DISCONNECT_CHECK_INTERVAL) {
      this.lastDisconnectCheck = now;

      for (const [playerId, player] of this.activePlayers.entries()) {
        const timeSinceActivity = now - player.lastActivity;

        // Remove player completely if inactive for 5+ minutes
        if (timeSinceActivity > REMOVAL_TIMEOUT) {
          console.log(`⏰ Removing player ${playerId} (inactive for ${Math.round(timeSinceActivity / 1000)}s)`);
          this.activePlayers.delete(playerId);
          this.broadcastToOthers(playerId, {
            type: 'player_leave',
            squirrelId: playerId,
            username: player.username, // MVP 6: Include username
            characterId: player.characterId // MVP 6: Include characterId
          });

          // MVP 7.2 CRITICAL: If that was the last player, despawn all NPCs immediately
          if (this.activePlayers.size === 0) {
            console.log('👋 Last player removed - despawning all NPCs to stop idle processing');
            this.npcManager.despawnAllNPCs();
          }
        }
        // Mark as disconnected if inactive for 60+ seconds (but not already disconnected)
        else if (timeSinceActivity > DISCONNECT_TIMEOUT && !player.isDisconnected) {
          console.log(`⚠️ Marking player ${playerId} as disconnected (inactive for ${Math.round(timeSinceActivity / 1000)}s)`);
          player.isDisconnected = true;
          player.disconnectedAt = now;
          this.broadcastToOthers(playerId, {
            type: 'player_disconnected',
            squirrelId: playerId,
            username: player.username, // MVP 6: Include username
            characterId: player.characterId // MVP 6: Include characterId
          });
        }
      }
    }

    // MVP 7.2 CRITICAL: Only reschedule if there are active players OR NPCs
    // Re-check after potential NPC despawn above
    if (this.activePlayers.size > 0 || this.npcManager.getNPCCount() > 0) {
      await this.storage.setAlarm(Date.now() + this.NPC_UPDATE_INTERVAL);
    } else {
      console.log('⏸️ Not rescheduling alarm - no players or NPCs (object will go inactive and save costs)');
    }
  }

  private lastDisconnectCheck: number = 0;

  /**
   * MVP 5.8 + MVP 7: Schedule alarm if not already scheduled OR if expired
   * MVP 7.1: Use 200ms interval for NPC updates (5 Hz for cost-optimized performance)
   * FIX: Check if alarm is in the past and reschedule if so
   */
  private async ensureAlarmScheduled(): Promise<void> {
    const currentAlarm = await this.storage.getAlarm();
    const now = Date.now();

    // Schedule alarm if it doesn't exist OR is in the past (expired/never fired)
    // MVP 7.1: Removed logging to reduce DO CPU usage
    if (currentAlarm === null || currentAlarm <= now) {
      const scheduleTime = now + this.NPC_UPDATE_INTERVAL;
      await this.storage.setAlarm(scheduleTime);
    }
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
      const sessionToken = url.searchParams.get("sessionToken") || ""; // MVP 6: Player session
      const username = url.searchParams.get("username") || "Anonymous"; // MVP 6: Player username
      const turnstileToken = url.searchParams.get("turnstileToken"); // MVP 7.1: Bot protection

      if (!squirrelId) {
        return new Response("Missing squirrelId", { status: 400 });
      }

      // MVP 7.1: Check connection rate limit (per IP)
      const rateLimitOK = await this.checkConnectionRateLimit(request);
      if (!rateLimitOK) {
        return new Response('Too many connection attempts. Please try again later.', {
          status: 429,
          headers: {
            'Retry-After': '300' // 5 minutes
          }
        });
      }

      // MVP 7.1: Validate Turnstile token (if provided)
      if (turnstileToken) {
        const isValidTurnstile = await this.validateTurnstileToken(turnstileToken);
        if (!isValidTurnstile) {
          console.warn(`❌ Turnstile validation failed for ${squirrelId}, rejecting connection`);
          return new Response('Turnstile verification failed. Please refresh the page.', { status: 403 });
        }
      } else {
        // No token provided - log but allow (for backwards compatibility during rollout)
        console.warn(`⚠️ No Turnstile token provided for ${squirrelId} (${username})`);
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      await this.setupPlayerConnection(squirrelId, characterId, server, sessionToken, username);

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

    // Admin endpoint to reset mapState (forces golden walnuts to respawn)
    if (path === "/admin/reset-mapstate" && request.method === "POST") {
      await this.storage.delete('mapState');
      this.mapState = []; // Also clear in-memory state
      this.isInitialized = false; // Force re-initialization on next connection
      console.log('🔄 Admin: mapState cleared (storage and memory), will reinitialize with golden walnuts');
      return new Response(JSON.stringify({
        message: "mapState reset - golden walnuts will respawn on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // Admin endpoint to reset forest (forces regeneration with landmark exclusions)
    if (path === "/admin/reset-forest" && request.method === "POST") {
      await this.storage.delete('forestObjects');
      this.forestObjects = []; // Clear in-memory state
      this.isInitialized = false; // Force re-initialization on next connection
      console.log('🔄 Admin: forestObjects cleared, will regenerate with landmark exclusions');
      return new Response(JSON.stringify({
        message: "Forest reset - will regenerate with landmark exclusions on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // Admin endpoint to reset player positions
    if (path === "/admin/reset-positions" && request.method === "POST") {
      const playerKeys = await this.storage.list({ prefix: 'player:' });
      for (const key of playerKeys.keys()) {
        await this.storage.delete(key);
      }
      console.log('🔄 Admin: All player positions cleared');
      return new Response(JSON.stringify({
        message: "Player positions reset - players will spawn at default position on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Simple player connection setup
  private async setupPlayerConnection(squirrelId: string, characterId: string, socket: WebSocket, sessionToken: string, username: string): Promise<void> {
    // MVP 5.8: Check if player is reconnecting (still in active players but disconnected)
    const existingPlayer = this.activePlayers.get(squirrelId);
    const isReconnecting = existingPlayer && existingPlayer.isDisconnected;

    if (isReconnecting) {
      // Player is reconnecting - reattach socket and mark as reconnected
      console.log(`🔄 Player ${squirrelId} (${username}) reconnecting after ${Math.round((Date.now() - existingPlayer.disconnectedAt!) / 1000)}s`);
      existingPlayer.socket = socket;
      existingPlayer.isDisconnected = false;
      existingPlayer.disconnectedAt = null;
      existingPlayer.lastActivity = Date.now();
      // MVP 6: Update session token and username (may have changed)
      existingPlayer.sessionToken = sessionToken;
      existingPlayer.username = username;

      // MVP 5.8: Ensure alarm is scheduled for disconnect checking
      await this.ensureAlarmScheduled();

      // Setup message handlers
      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data as string);
          await this.handlePlayerMessage(existingPlayer, message);
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error, 'Raw data:', event.data);
        }
      };

      // MVP 5.8: Mark as disconnected instead of removing on close
      socket.onclose = () => {
        console.log(`🔌 WebSocket closed for ${squirrelId}, marking as disconnected`);
        existingPlayer.isDisconnected = true;
        existingPlayer.disconnectedAt = Date.now();
        this.broadcastToOthers(squirrelId, {
          type: 'player_disconnected',
          squirrelId: squirrelId,
          username: existingPlayer.username, // MVP 6: Include username
          characterId: existingPlayer.characterId // MVP 6: Include characterId
        });

        // MVP 7.2 CRITICAL: If no connected players remain, despawn NPCs immediately (cost optimization)
        const connectedPlayers = Array.from(this.activePlayers.values())
          .filter(p => !p.isDisconnected).length;

        if (connectedPlayers === 0) {
          console.log('👋 Last player disconnected - despawning all NPCs immediately to stop idle processing');
          this.npcManager.despawnAllNPCs();
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
      };

      // Send current world state with saved position
      await this.sendWorldState(socket, existingPlayer.position, existingPlayer.rotationY);
      await this.sendExistingPlayers(socket, squirrelId);

      // MVP 8 FIX: Spawn NPCs if none exist (they may have been despawned when last player left)
      if (this.npcManager.getNPCCount() === 0) {
        console.log('🔄 No NPCs exist, spawning fresh batch...');
        this.npcManager.spawnNPCs();
      }

      // MVP 7: Send existing NPCs to reconnecting player
      await this.sendExistingNPCs(socket);

      // Broadcast reconnection
      this.broadcastToOthers(squirrelId, {
        type: 'player_reconnected',
        squirrelId,
        position: existingPlayer.position,
        rotationY: existingPlayer.rotationY,
        characterId: existingPlayer.characterId
      });
    } else {
      // MVP 6: Check if there's already a player with this username (private browsing duplicate bug)
      // If so, disconnect the old one (force logout previous session)
      for (const [existingId, existingPlayerConn] of this.activePlayers.entries()) {
        if (existingPlayerConn.username === username) {
          console.log(`⚠️ Username "${username}" already connected with squirrelId ${existingId}, disconnecting old session`);
          // Close the old socket
          try {
            existingPlayerConn.socket.close();
          } catch (e) {
            console.error('Failed to close old socket:', e);
          }
          // Remove from active players
          this.activePlayers.delete(existingId);
          // Broadcast player_leave
          this.broadcastToOthers(existingId, {
            type: 'player_leave',
            squirrelId: existingId,
            username: existingPlayerConn.username,
            characterId: existingPlayerConn.characterId
          });
          break; // Only one match possible per username
        }
      }

      // New player connection
      // MVP 6: Load position by sessionToken (true persistent identity across sessions)
      // Username is just a display name and can be shared by multiple people
      const savedPosition = await this.loadPlayerPosition(sessionToken);

      const playerConnection: PlayerConnection = {
        squirrelId,
        socket,
        position: savedPosition || { x: 0, y: 2, z: 10 },
        rotationY: Math.PI, // Face north (-Z direction)
        lastActivity: Date.now(),
        characterId,
        // MVP 5.8: Session management
        isDisconnected: false,
        disconnectedAt: null,
        // MVP 6: Player identity
        sessionToken,
        username,
        // MVP 7.1: Position save throttling
        lastPositionSave: 0,
        // MVP 8: Combat system
        walnutInventory: 0, // Start with 0 walnuts
        lastThrowTime: 0
      };

      console.log(`✅ New player ${squirrelId} (${username}) connected`);

      this.activePlayers.set(squirrelId, playerConnection);

      // MVP 5.8: Ensure alarm is scheduled for disconnect checking
      await this.ensureAlarmScheduled();

      // Setup message handlers
      socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data as string);
          await this.handlePlayerMessage(playerConnection, message);
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error, 'Raw data:', event.data);
        }
      };

      // MVP 5.8: Mark as disconnected instead of removing on close
      socket.onclose = () => {
        console.log(`🔌 WebSocket closed for ${squirrelId}, marking as disconnected`);
        playerConnection.isDisconnected = true;
        playerConnection.disconnectedAt = Date.now();
        this.broadcastToOthers(squirrelId, {
          type: 'player_disconnected',
          squirrelId: squirrelId,
          username: playerConnection.username, // MVP 6: Include username
          characterId: playerConnection.characterId // MVP 6: Include characterId
        });

        // MVP 7.2 CRITICAL: If no connected players remain, despawn NPCs immediately (cost optimization)
        const connectedPlayers = Array.from(this.activePlayers.values())
          .filter(p => !p.isDisconnected).length;

        if (connectedPlayers === 0) {
          console.log('👋 Last player disconnected - despawning all NPCs immediately to stop idle processing');
          this.npcManager.despawnAllNPCs();
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
      };

      // Send initial data with spawn position (MVP 6: may be saved position or default)
      await this.sendWorldState(socket, playerConnection.position, playerConnection.rotationY);
      await this.sendExistingPlayers(socket, squirrelId);

      // MVP 8 FIX: Spawn NPCs if none exist (they may have been despawned when last player left)
      if (this.npcManager.getNPCCount() === 0) {
        console.log('🔄 No NPCs exist, spawning fresh batch...');
        this.npcManager.spawnNPCs();
      }

      // MVP 7: Send existing NPCs to new player
      await this.sendExistingNPCs(socket);

      // Broadcast player join
      this.broadcastToOthers(squirrelId, {
        type: 'player_joined',
        squirrelId,
        position: playerConnection.position,
        rotationY: playerConnection.rotationY,
        characterId: playerConnection.characterId,
        username: playerConnection.username // MVP 6: Send username
      });
    }
  }

  // Simple message handling
  private async handlePlayerMessage(playerConnection: PlayerConnection, data: any): Promise<void> {
    playerConnection.lastActivity = Date.now();

    // MVP 5.8: If player was disconnected and sends a message, mark as reconnected
    if (playerConnection.isDisconnected) {
      console.log(`🔄 Player ${playerConnection.squirrelId} reconnected (was disconnected, now sending messages)`);
      playerConnection.isDisconnected = false;
      playerConnection.disconnectedAt = null;
      this.broadcastToOthers(playerConnection.squirrelId, {
        type: 'player_reconnected',
        squirrelId: playerConnection.squirrelId
      });
    }

    switch (data.type) {
      case "player_update":
        // MVP 7.1: Rate limit position updates
        if (!this.checkMessageRateLimit(playerConnection.squirrelId, 'position')) {
          // Drop message silently (don't disconnect, just ignore)
          return;
        }

        if (data.position) {
          // Validate position is within world bounds
          const validatedPosition = this.validatePosition(data.position);
          playerConnection.position = validatedPosition;
        }
        if (typeof data.rotationY === 'number') {
          playerConnection.rotationY = data.rotationY;
        }

        // MVP 7.1: Throttle position saves to once every 30 seconds (was 10 Hz = 180k saves/hour!)
        // This reduces storage operations by 99% while still persisting position reasonably often
        const now = Date.now();
        const timeSinceLastSave = now - playerConnection.lastPositionSave;
        const POSITION_SAVE_INTERVAL = 30000; // 30 seconds
        if (timeSinceLastSave >= POSITION_SAVE_INTERVAL) {
          await this.savePlayerPosition(playerConnection.sessionToken, playerConnection.position);
          playerConnection.lastPositionSave = now;
        }

        // INDUSTRY STANDARD: Forward animation state with timing for multiplayer sync
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
        // MVP 7.1: Rate limit walnut hiding
        if (!this.checkMessageRateLimit(playerConnection.squirrelId, 'walnutHide')) {
          console.warn(`🚫 Walnut hide rate limit exceeded for ${playerConnection.squirrelId}`);
          return;
        }

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
        // MVP 7.1: Rate limit walnut finding
        if (!this.checkMessageRateLimit(playerConnection.squirrelId, 'walnutFind')) {
          console.warn(`🚫 Walnut find rate limit exceeded for ${playerConnection.squirrelId}`);
          return;
        }

        // Mark walnut as found in mapState
        const walnutIndex = this.mapState.findIndex(w => w.id === data.walnutId);
        if (walnutIndex !== -1) {
          this.mapState[walnutIndex].found = true;

          // MVP 8: Add walnut to player inventory (max 10)
          const MAX_INVENTORY = 10;
          if (playerConnection.walnutInventory < MAX_INVENTORY) {
            playerConnection.walnutInventory++;
            console.log(`🌰 Player ${playerConnection.squirrelId} now has ${playerConnection.walnutInventory} walnuts`);
          } else {
            console.log(`⚠️ Player ${playerConnection.squirrelId} inventory full (${MAX_INVENTORY} walnuts)`);
          }

          // Persist updated mapState
          await this.storage.put('mapState', this.mapState);

          // Broadcast to all other players (including inventory update)
          this.broadcastToOthers(playerConnection.squirrelId, {
            type: 'walnut_found',
            walnutId: data.walnutId,
            finderId: data.finderId,
            points: data.points
          });

          // MVP 8: Send inventory update to the player who found it
          this.sendMessage(playerConnection.socket, {
            type: 'inventory_update',
            walnutCount: playerConnection.walnutInventory
          });
        } else {
          console.warn(`⚠️ SERVER: Walnut ${data.walnutId} not found in mapState`);
        }
        break;

      case "chat_message":
        // MVP 7.1: Rate limit chat messages
        if (!this.checkMessageRateLimit(playerConnection.squirrelId, 'chat')) {
          console.warn(`🚫 Chat rate limit exceeded for ${playerConnection.squirrelId}`);
          return;
        }

        // Broadcast chat message to all other players
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'chat_message',
          playerId: data.playerId,
          message: data.message
        });
        break;

      case "player_emote":
        // MVP 7.1: Rate limit emotes (same as chat)
        if (!this.checkMessageRateLimit(playerConnection.squirrelId, 'chat')) {
          console.warn(`🚫 Emote rate limit exceeded for ${playerConnection.squirrelId}`);
          return;
        }

        // Broadcast emote to all other players
        this.broadcastToOthers(playerConnection.squirrelId, {
          type: 'player_emote',
          playerId: data.playerId,
          emote: data.emote
        });
        break;

      case "player_throw":
        // MVP 8: Player throwing walnut
        const THROW_COOLDOWN = 1500; // 1.5 seconds in milliseconds
        const throwTime = Date.now();

        // Validate cooldown
        if (throwTime - playerConnection.lastThrowTime < THROW_COOLDOWN) {
          console.warn(`🚫 Throw cooldown active for ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, {
            type: 'throw_rejected',
            reason: 'cooldown'
          });
          return;
        }

        // Validate inventory
        if (playerConnection.walnutInventory <= 0) {
          console.warn(`🚫 No walnuts to throw for ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, {
            type: 'throw_rejected',
            reason: 'no_ammo'
          });
          return;
        }

        // Validation passed - process throw
        playerConnection.lastThrowTime = throwTime;
        playerConnection.walnutInventory--;

        console.log(`🌰 Player ${playerConnection.squirrelId} threw walnut (${playerConnection.walnutInventory} remaining)`);

        // Broadcast throw event to ALL clients (including thrower for visual feedback)
        const throwEvent = {
          type: 'throw_event',
          throwerId: playerConnection.squirrelId,
          fromPosition: data.fromPosition,
          toPosition: data.toPosition,
          targetId: data.targetId, // Optional - who they're aiming at
          timestamp: throwTime
        };

        // Send to all players (they all need to see the projectile)
        this.activePlayers.forEach((player) => {
          this.sendMessage(player.socket, throwEvent);
        });

        // Send inventory update to thrower
        this.sendMessage(playerConnection.socket, {
          type: 'inventory_update',
          walnutCount: playerConnection.walnutInventory
        });
        break;

      case "spawn_dropped_walnut":
        // MVP 8: Create pickupable walnut on ground where projectile landed
        const droppedWalnutId = `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const dropTime = Date.now();

        const droppedWalnut: Walnut = {
          id: droppedWalnutId,
          ownerId: 'game', // No specific owner, anyone can pick it up
          origin: 'player', // Originated from player throw
          hiddenIn: 'ground', // Not buried, on ground surface
          location: data.position,
          found: false,
          timestamp: dropTime,
          // MVP 8: Immunity only applies if hit a specific player (miss = no immunity)
          immunePlayerId: data.immunePlayerId, // undefined for miss, playerId for hit
          immuneUntil: data.immunePlayerId ? dropTime + 1500 : undefined // 1.5 seconds if hit
        };

        this.mapState.push(droppedWalnut);
        await this.storage.put('mapState', this.mapState);

        console.log(`🌰 Dropped walnut created at (${data.position.x}, ${data.position.y}, ${data.position.z})`);

        // Broadcast to all players so they can see the new pickupable walnut
        this.activePlayers.forEach((player) => {
          this.sendMessage(player.socket, {
            type: 'walnut_dropped',
            walnutId: droppedWalnutId,
            position: data.position,
            immunePlayerId: droppedWalnut.immunePlayerId, // Only set if hit a player
            immuneUntil: droppedWalnut.immuneUntil // Only set if hit a player
          });
        });
        break;

      default:
        // Broadcast other messages
        this.broadcastToOthers(playerConnection.squirrelId, data);
        break;
    }
  }

  // Simple world state initialization
  // MVP 6: Now includes spawn position for returning players
  private async sendWorldState(
    socket: WebSocket,
    spawnPosition: { x: number; y: number; z: number },
    spawnRotationY: number
  ): Promise<void> {
    await this.initializeWorld();

    // AGGRESSIVE FIX: Always filter out test-walnut before sending
    const filteredMapState = this.mapState.filter(w => w.id !== 'test-walnut');
    if (filteredMapState.length !== this.mapState.length) {
      console.log(`🧹 FILTERED OUT test-walnut before sending (was in mapState despite filter)`);
      this.mapState = filteredMapState;
      await this.storage.put('mapState', this.mapState);
    }

    this.sendMessage(socket, {
      type: "world_state",
      terrainSeed: this.terrainSeed,
      mapState: this.mapState,
      forestObjects: this.forestObjects,
      // MVP 6: Send spawn position so returning players spawn at last location
      spawnPosition,
      spawnRotationY
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
        characterId: player.characterId,
        username: player.username // MVP 6: Include username
      }));

    if (existingPlayers.length > 0) {
      this.sendMessage(socket, {
        type: "existing_players",
        players: existingPlayers
      });
    }
  }

  /**
   * MVP 7: Send existing NPCs to new player
   */
  private async sendExistingNPCs(socket: WebSocket): Promise<void> {
    const existingNPCs = this.npcManager.getNPCs();
    console.log(`📤 sendExistingNPCs called: ${existingNPCs.length} NPCs exist`);

    if (existingNPCs.length > 0) {
      // Send each NPC as an npc_spawned message
      for (const npc of existingNPCs) {
        console.log(`  → Sending NPC ${npc.id} (${npc.username}) to new player`);
        this.sendMessage(socket, {
          type: 'npc_spawned',
          npc: {
            id: npc.id,
            characterId: npc.characterId,
            username: npc.username,
            position: npc.position,
            rotationY: npc.rotationY,
            animation: npc.animation
          }
        });
      }
      console.log(`📤 Sent ${existingNPCs.length} existing NPCs to new player`);
    } else {
      console.log(`⚠️ No NPCs to send to new player`);
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

  // MVP 7: Broadcast to ALL players (used by NPCManager)
  broadcastToAll(message: any): void {
    const serializedMessage = JSON.stringify(message);

    for (const playerConnection of this.activePlayers.values()) {
      if (playerConnection.socket.readyState === WebSocket.OPEN) {
        try {
          playerConnection.socket.send(serializedMessage);
        } catch (error) {
          console.error(`Failed to broadcast to ${playerConnection.squirrelId}:`, error);
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
  private isInitialized: boolean = false;

  private async initializeWorld(): Promise<void> {
    // Only initialize once per DO instance
    if (this.isInitialized) {
      console.log('⏭️ SERVER: World already initialized, skipping');
      return;
    }

    console.log('🌍 SERVER: Initializing world...');

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

    if (storedMapState && Array.isArray(storedMapState)) {
      this.mapState = storedMapState;
    } else {
      this.mapState = [];
    }

    // ALWAYS ensure golden walnuts exist (remove old ones, add fresh ones)
    // Remove ANY existing golden walnuts (found or not found) AND the old test walnut
    const beforeFilter = this.mapState.length;
    this.mapState = this.mapState.filter(w => w.origin !== 'game' && w.id !== 'test-walnut');
    const afterFilter = this.mapState.length;
    console.log(`🧹 SERVER: Removed ${beforeFilter - afterFilter} game walnuts, ${afterFilter} player walnuts remaining`);

    // Define fresh golden walnut locations
    const goldenWalnuts: Walnut[] = [
      {
        id: "game-walnut-1",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: 15, y: 0, z: 15 },
        found: false,
        timestamp: Date.now(),
        isGolden: true // MVP 8: Golden bonus walnut (5 pts)
      },
      {
        id: "game-walnut-2",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: -12, y: 0, z: 18 },
        found: false,
        timestamp: Date.now(),
        isGolden: true // MVP 8: Golden bonus walnut (5 pts)
      },
      {
        id: "game-walnut-3",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "bush" as const,
        location: { x: 20, y: 0, z: -10 },
        found: false,
        timestamp: Date.now(),
        isGolden: true // MVP 8: Golden bonus walnut (5 pts)
      }
    ];

    // Add all golden walnuts fresh
    for (const goldenWalnut of goldenWalnuts) {
      console.log(`🌟 SERVER: Adding fresh golden walnut: ${goldenWalnut.id}`);
      this.mapState.push(goldenWalnut);
    }

    // MVP 8: Add regular game-spawned walnuts (not golden, respawn when found)
    const regularGameWalnuts: Walnut[] = [
      // Buried walnuts (3 pts each)
      {
        id: "game-regular-buried-1",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: -25, y: 0, z: 30 },
        found: false,
        timestamp: Date.now(),
        isGolden: false
      },
      {
        id: "game-regular-buried-2",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: 30, y: 0, z: -25 },
        found: false,
        timestamp: Date.now(),
        isGolden: false
      },
      {
        id: "game-regular-buried-3",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "buried" as const,
        location: { x: -15, y: 0, z: -20 },
        found: false,
        timestamp: Date.now(),
        isGolden: false
      },
      // Ground walnuts (1 pt each)
      {
        id: "game-regular-ground-1",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "ground" as const,
        location: { x: 5, y: 0, z: 8 },
        found: false,
        timestamp: Date.now(),
        isGolden: false
      },
      {
        id: "game-regular-ground-2",
        ownerId: "system",
        origin: "game" as const,
        hiddenIn: "ground" as const,
        location: { x: -8, y: 0, z: -5 },
        found: false,
        timestamp: Date.now(),
        isGolden: false
      }
    ];

    // MVP 8: Add bush walnuts at actual shrub locations (not hardcoded)
    const shrubs = this.forestObjects.filter(obj => obj.type === 'shrub');
    if (shrubs.length >= 3) {
      // Select 3 random shrubs for walnuts
      const shuffled = [...shrubs].sort(() => Math.random() - 0.5);
      const selectedShrubs = shuffled.slice(0, 3);

      for (let i = 0; i < selectedShrubs.length; i++) {
        const shrub = selectedShrubs[i];
        regularGameWalnuts.push({
          id: `game-regular-bush-${i + 1}`,
          ownerId: "system",
          origin: "game" as const,
          hiddenIn: "bush" as const,
          location: { x: shrub.x, y: 0, z: shrub.z },
          found: false,
          timestamp: Date.now(),
          isGolden: false
        });
      }
      console.log(`🌿 SERVER: Added ${selectedShrubs.length} bush walnuts at shrub locations`);
    } else {
      console.warn(`⚠️ SERVER: Not enough shrubs (${shrubs.length}) to place bush walnuts`);
    }

    // Add all regular game walnuts
    for (const regularWalnut of regularGameWalnuts) {
      console.log(`🌰 SERVER: Adding regular game walnut: ${regularWalnut.id} (${regularWalnut.hiddenIn})`);
      this.mapState.push(regularWalnut);
    }

    console.log(`✅ SERVER: Total walnuts after adding game walnuts: ${this.mapState.length} (3 golden + ${regularGameWalnuts.length} regular + ${this.mapState.length - 3 - regularGameWalnuts.length} player)`);

    await this.storage.put('mapState', this.mapState);

    // MVP 7: Spawn NPCs
    console.log(`🔧 About to spawn NPCs...`);
    this.npcManager.spawnNPCs();
    const npcCount = this.npcManager.getNPCCount();
    console.log(`🤖 Spawned ${npcCount} NPCs`);

    if (npcCount > 0) {
      console.log(`✅ NPCs spawned successfully, alarm should handle updates`);
    } else {
      console.log(`⚠️ WARNING: No NPCs spawned!`);
    }

    this.isInitialized = true;
    console.log('✅ SERVER: World initialization complete');
  }

  // Simple forest object generation
  private generateForestObjects(): ForestObject[] {
    const objects: ForestObject[] = [];

    // Landmark positions to exclude (these use special tree models)
    const landmarks = [
      { x: 0, z: 0, name: 'Origin' },    // Uses Dead_straight_tree.glb
      { x: 0, z: -40, name: 'North' },   // Uses bottle_tree.glb
      { x: 0, z: 40, name: 'South' },    // Uses Big_pine.glb
      { x: 40, z: 0, name: 'East' },     // Uses Straight_sphere_tree.glb
      { x: -40, z: 0, name: 'West' }     // Uses W_branch_tree.glb
    ];

    const LANDMARK_EXCLUSION_RADIUS = 25; // Don't place Tree_01.glb within 25 units of landmarks

    // Helper function to check if position is too close to any landmark
    const isTooCloseToLandmark = (x: number, z: number): boolean => {
      for (const landmark of landmarks) {
        const distance = Math.sqrt(Math.pow(x - landmark.x, 2) + Math.pow(z - landmark.z, 2));
        if (distance < LANDMARK_EXCLUSION_RADIUS) {
          return true;
        }
      }
      return false;
    };

    // Generate 30 trees (with landmark exclusion)
    let attempts = 0;
    const maxAttempts = 300; // Prevent infinite loop
    for (let i = 0; i < 30 && attempts < maxAttempts; attempts++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;

      // Skip if too close to any landmark
      if (isTooCloseToLandmark(x, z)) {
        continue;
      }

      objects.push({
        id: `tree-${Date.now()}-${i}`,
        type: "tree",
        x,
        y: 0,
        z,
        scale: 0.8 + Math.random() * 0.4
      });
      i++;
    }

    // Generate 40 shrubs (with landmark exclusion)
    attempts = 0;
    for (let i = 0; i < 40 && attempts < maxAttempts; attempts++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;

      // Skip if too close to any landmark
      if (isTooCloseToLandmark(x, z)) {
        continue;
      }

      objects.push({
        id: `shrub-${Date.now()}-${i}`,
        type: "shrub",
        x,
        y: 0,
        z,
        scale: 0.7 + Math.random() * 0.3
      });
      i++;
    }

    // MVP 5.5: Generate 20 rocks (with landmark exclusion)
    attempts = 0;
    for (let i = 0; i < 20 && attempts < maxAttempts; attempts++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;

      // Skip if too close to any landmark
      if (isTooCloseToLandmark(x, z)) {
        continue;
      }

      objects.push({
        id: `rock-${Date.now()}-${i}`,
        type: "rock",
        x,
        y: 0,
        z,
        scale: 0.8 + Math.random() * 0.4,
        modelVariant: Math.floor(Math.random() * 5) + 1 // Random rock 1-5
      });
      i++;
    }

    // MVP 5.5: Generate 15 stumps (with landmark exclusion)
    attempts = 0;
    for (let i = 0; i < 15 && attempts < maxAttempts; attempts++) {
      const x = (Math.random() - 0.5) * 100;
      const z = (Math.random() - 0.5) * 100;

      // Skip if too close to any landmark
      if (isTooCloseToLandmark(x, z)) {
        continue;
      }

      objects.push({
        id: `stump-${Date.now()}-${i}`,
        type: "stump",
        x,
        y: 0,
        z,
        scale: 0.9 + Math.random() * 0.3
      });
      i++;
    }

    const treeCount = objects.filter(o => o.type === 'tree').length;
    const shrubCount = objects.filter(o => o.type === 'shrub').length;
    const rockCount = objects.filter(o => o.type === 'rock').length;
    const stumpCount = objects.filter(o => o.type === 'stump').length;
    console.log(`✅ Generated ${treeCount} trees, ${shrubCount} shrubs, ${rockCount} rocks, ${stumpCount} stumps`);
    console.log(`   Excluded 25-unit radius around 5 landmark positions`);
    console.log(`   Landmark trees use DIFFERENT models: Big_pine, bottle_tree, Dead_straight_tree, etc.`);

    return objects;
  }

  // MVP 6: Player position management (by sessionToken for true persistence)
  // Username is just a display name - sessionToken is the actual identity
  private async loadPlayerPosition(sessionToken: string): Promise<{ x: number; y: number; z: number } | null> {
    try {
      const savedData = await this.storage.get(`player:${sessionToken}`);
      return savedData?.position || null;
    } catch (error) {
      console.error(`❌ Failed to load position for session ${sessionToken.substring(0, 8)}...:`, error);
      return null;
    }
  }

  private async savePlayerPosition(sessionToken: string, position: { x: number; y: number; z: number }): Promise<void> {
    try {
      await this.storage.put(`player:${sessionToken}`, {
        position,
        lastUpdate: Date.now()
      });
    } catch (error) {
      console.error(`❌ Failed to save position for session ${sessionToken.substring(0, 8)}...:`, error);
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