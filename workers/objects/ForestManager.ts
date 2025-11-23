// Simplified ForestManager - Basic WebSocket and world state management
// Test comment for IDE integration
// Additional test comment for IDE integration
// Updated for MVP 3.5 - Multiple character support
// MVP 7: NPC System integration
// MVP 7.1: Turnstile bot protection and rate limiting
// MVP 12: Predator System integration

import { DurableObject } from 'cloudflare:workers';
import { NPCManager } from './NPCManager';
import { PredatorManager } from './PredatorManager';
import { Env } from '../types';
import { isCharacterAvailable } from '../constants/CharacterTiers';

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
  isAuthenticated: boolean; // MVP 16: Auth status
  emailVerified: boolean; // MVP 16: Email verification status

  // MVP 7.1: Position save throttling
  lastPositionSave: number;

  // MVP 8: Combat system
  walnutInventory: number; // 0-10 walnuts (ammo/health)
  lastThrowTime: number; // For throw cooldown tracking
  health: number; // 0-100 HP
  maxHealth: number; // Always 100
  score: number; // Player's current score (tracked server-side)
  lastAttackerId: string | null; // Who hit this player last (for knockout credit)
  combatStats: { // MVP 8: Track combat actions for scoring
    hits: number; // Successful hits on opponents
    knockouts: number; // Players knocked out
    deaths: number; // Times player died
  };
  invulnerableUntil: number | null; // MVP 8: Timestamp when respawn invulnerability expires
  lastCollisionDamageTime: number; // Cooldown for collision damage

  // MVP 12: Player Ranking System
  titleId: string; // Player's current title ID ('rookie', 'apprentice', etc.)
  titleName: string; // Player's current title name ('Rookie', 'Apprentice', etc.)

  // MVP 14: Tree growing bonus tracking
  treesGrownCount: number; // Cumulative count of trees grown from player's hidden walnuts
  bonusMilestones: Set<number>; // Track awarded bonuses to prevent duplicates (e.g., Set{20, 40})
}

interface Walnut {
  id: string;
  ownerId: string; // MVP 14: Already tracks who hid the walnut!
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

  // MVP 12: Predator System
  predatorManager: PredatorManager;
  private lastPredatorUpdate: number = 0;
  private readonly PREDATOR_UPDATE_INTERVAL = 100; // 100ms = 10 updates/sec (predators need responsive AI)

  // MVP 9: Tree walnut drop system
  // Purpose: Replenish walnut pool when players/NPCs consume walnuts for health
  // Frequency: 30s-2min random intervals, ONE random tree per drop
  private lastTreeWalnutDrop: number = 0;
  private nextTreeDropInterval: number = 30000 + Math.random() * 90000; // 30-120 seconds (0.5-2 minutes)

  // MVP 9: Tree growth system
  private lastTreeGrowthCheck: number = 0;

  // MVP 7.1: Rate limiting state
  private connectionAttempts: Map<string, number[]> = new Map(); // IP -> timestamps
  private messageRateLimits: Map<string, {
    position: number[];
    walnutHide: number[];
    walnutFind: number[];
    chat: number[];
  }> = new Map(); // squirrelId -> action timestamps

  // MVP 13: Metrics tracking
  private metrics = {
    treesGrownToday: 0,
    projectilesThrownToday: 0,
    hitsToday: 0,
    npcDeathsToday: 0,
    predatorFleesCount: 0,
    peakPlayersToday: 0,
    totalUniquePlayersEver: 0
  };
  private uniquePlayerIds: Set<string> = new Set();

  // MVP 13: Tree growth configuration
  private treeGrowthConfig = {
    pointsAwarded: 20,        // Points for growing a tree
    walnutsDropped: 5,        // Walnuts dropped when tree grows
    growthChance: 100         // 0-100% chance walnut grows after timer
  };

  // MVP 14: Tree growing bonus configuration
  private treeGrowingBonus = {
    requiredCount: 20,        // Trees needed for bonus
    pointsAwarded: 20         // Bonus points
  };

  constructor(ctx: any, env: Env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.env = env;

    // MVP 7: Initialize NPC Manager
    this.npcManager = new NPCManager(this);

    // MVP 12: Initialize Predator Manager
    this.predatorManager = new PredatorManager();

    // MVP 13: Set up predator flee callback
    this.predatorManager['onPredatorFlee'] = () => {
      this.metrics.predatorFleesCount++;
    };
  }

  /**
   * MVP 7.1: Validate Cloudflare Turnstile token
   * Returns true if token is valid, false otherwise
   */
  private async validateTurnstileToken(token: string): Promise<boolean> {
    // Skip validation in development mode or if no secret configured
    if (!this.env.TURNSTILE_SECRET || this.env.TURNSTILE_SECRET === '') {
      return true;
    }

    // MVP 7.1: Accept testing tokens (from Cloudflare's testing site key)
    // Testing tokens start with 'XXXX.' and are used in preview/dev environments
    if (token.startsWith('XXXX.')) {
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
    const hasPredators = this.predatorManager.getCount() > 0;

    if (!hasPlayers && !hasNPCs && !hasPredators) {
      return; // DON'T reschedule - let object hibernate
    }

    // MVP 7.1: Update NPCs every 200ms (only if they exist)
    if (hasNPCs && now - this.lastNPCUpdate >= this.NPC_UPDATE_INTERVAL) {
      this.npcManager.update();
      this.lastNPCUpdate = now;
    }

    // MVP 12: Update Predators every 100ms (only if players exist - predators target players)
    if (hasPlayers && now - this.lastPredatorUpdate >= this.PREDATOR_UPDATE_INTERVAL) {
      this.updatePredators();
      this.lastPredatorUpdate = now;
    }

    // MVP 9: Tree walnut drops (only if players exist - no need to drop for NPCs only)
    if (hasPlayers && now - this.lastTreeWalnutDrop >= this.nextTreeDropInterval) {
      await this.dropTreeWalnut();
      this.lastTreeWalnutDrop = now;
      // Randomize next drop interval: 30-120 seconds (0.5-2 minutes)
      this.nextTreeDropInterval = 30000 + Math.random() * 90000;
    }

    // MVP 9: Check for walnuts ready to grow into trees every 20 seconds
    const TREE_GROWTH_CHECK_INTERVAL = 20000; // 20 seconds
    if (hasPlayers && now - this.lastTreeGrowthCheck >= TREE_GROWTH_CHECK_INTERVAL) {
      this.lastTreeGrowthCheck = now;
      await this.checkTreeGrowth();
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
          this.activePlayers.delete(playerId);
          this.broadcastToOthers(playerId, {
            type: 'player_leave',
            squirrelId: playerId,
            username: player.username, // MVP 6: Include username
            characterId: player.characterId // MVP 6: Include characterId
          });

          // MVP 7.2 CRITICAL: If that was the last player, despawn all NPCs immediately
          if (this.activePlayers.size === 0) {
            this.npcManager.despawnAllNPCs();
          }
        }
        // Mark as disconnected if inactive for 60+ seconds (but not already disconnected)
        else if (timeSinceActivity > DISCONNECT_TIMEOUT && !player.isDisconnected) {
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
    // MVP 13: Load metrics and config from storage on first request
    const storedMetrics = await this.storage.get('metrics') as any;
    if (storedMetrics) {
      // Merge stored metrics with defaults to handle new properties
      this.metrics = {
        treesGrownToday: storedMetrics.treesGrownToday ?? this.metrics.treesGrownToday,
        projectilesThrownToday: storedMetrics.projectilesThrownToday ?? this.metrics.projectilesThrownToday,
        hitsToday: storedMetrics.hitsToday ?? this.metrics.hitsToday,
        npcDeathsToday: storedMetrics.npcDeathsToday ?? this.metrics.npcDeathsToday,
        predatorFleesCount: storedMetrics.predatorFleesCount ?? this.metrics.predatorFleesCount,
        peakPlayersToday: storedMetrics.peakPlayersToday ?? this.metrics.peakPlayersToday,
        totalUniquePlayersEver: storedMetrics.totalUniquePlayersEver ?? this.metrics.totalUniquePlayersEver
      };
    }

    const storedConfig = await this.storage.get('treeGrowthConfig');
    if (storedConfig) {
      this.treeGrowthConfig = storedConfig;
    }

    const storedBonusConfig = await this.storage.get('treeGrowingBonus');
    if (storedBonusConfig) {
      this.treeGrowingBonus = storedBonusConfig;
    }

    const storedPlayerIds = await this.storage.get('uniquePlayerIds');
    if (storedPlayerIds && Array.isArray(storedPlayerIds)) {
      this.uniquePlayerIds = new Set(storedPlayerIds);
    }

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

      // MVP 7.1: ENFORCE Turnstile token (REQUIRED for all connections)
      // SECURITY FIX: Tokens are now mandatory to prevent bot bypass
      if (!turnstileToken) {
        console.warn(`❌ No Turnstile token provided for ${squirrelId} (${username}), rejecting connection`);
        return new Response('Bot verification required. Please refresh the page.', { status: 403 });
      }

      const isValidTurnstile = await this.validateTurnstileToken(turnstileToken);
      if (!isValidTurnstile) {
        console.warn(`❌ Turnstile validation failed for ${squirrelId}, rejecting connection`);
        return new Response('Bot verification failed. Please refresh the page.', { status: 403 });
      }

      console.log(`✅ Turnstile validation successful for ${username}`);

      // MVP 16: Validate character selection based on authentication and unlocked characters
      let isAuthenticated = false;
      let emailVerified = false;
      let unlockedCharacters: string[] = [];

      // MVP 16 FIX: Check for JWT access token in URL parameter (WebSocket doesn't support Authorization headers)
      const accessToken = url.searchParams.get('accessToken');
      let persistedStats: { score: number, titleId: string, titleName: string } | undefined;

      if (accessToken) {
        try {
          // Verify JWT access token directly (can't use AuthMiddleware with URL params)
          const { verifyAccessToken } = await import('../services/AuthService');
          const payload = verifyAccessToken(accessToken, this.env.JWT_SECRET);

          if (payload) {
            isAuthenticated = payload.isAuthenticated;
            emailVerified = payload.emailVerified || false;
            unlockedCharacters = payload.unlockedCharacters || [];
            console.log(`✅ Authenticated WebSocket: ${username} (${unlockedCharacters.length} characters)`);

            // Fetch persistent stats
            try {
              const playerIdentityId = this.env.PLAYER_IDENTITY.idFromName(username);
              const playerIdentity = this.env.PLAYER_IDENTITY.get(playerIdentityId);
              const statsResponse = await playerIdentity.fetch(new Request('http://internal/api/identity?action=getStats'));
              if (statsResponse.ok) {
                persistedStats = await statsResponse.json() as any;
              }
            } catch (e) { console.error('Failed to fetch stats', e); }
          }
        } catch (error) {
          console.error(`Failed to verify access token for ${username}:`, error);
          // Fall through to sessionToken lookup
        }
      }

      // Fallback: Look up auth status from PlayerIdentity DO using sessionToken (backward compatibility)
      if (!isAuthenticated && sessionToken) {
        try {
          const playerIdentityId = this.env.PLAYER_IDENTITY.idFromName(username);
          const playerIdentity = this.env.PLAYER_IDENTITY.get(playerIdentityId);

          // Call the 'check' action to get player data
          const checkUrl = new URL('http://internal/api/identity?action=check&username=' + encodeURIComponent(username));
          const checkRequest = new Request(checkUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
          });

          const checkResponse = await playerIdentity.fetch(checkRequest);
          if (checkResponse.ok) {
            const playerData = await checkResponse.json() as {
              exists: boolean;
              isAuthenticated?: boolean;
              emailVerified?: boolean;
              unlockedCharacters?: string[];
              score?: number;
              titleId?: string;
              titleName?: string;
            };
            // Check if this sessionToken is linked to an authenticated account
            isAuthenticated = playerData.isAuthenticated || false;
            emailVerified = playerData.emailVerified || false;
            unlockedCharacters = playerData.unlockedCharacters || [];

            if (playerData.score !== undefined) {
              persistedStats = {
                score: playerData.score,
                titleId: playerData.titleId || 'rookie',
                titleName: playerData.titleName || 'Rookie'
              };
            }
            console.log(`📋 SessionToken lookup: ${username} (auth: ${isAuthenticated}, ${unlockedCharacters.length} characters)`);
          }
        } catch (error) {
          console.error(`Failed to lookup player data for ${username}:`, error);
          // Default to no-auth if both methods fail
        }
      }

      // Validate character availability
      if (!isCharacterAvailable(characterId, isAuthenticated, unlockedCharacters)) {
        console.warn(`❌ Character ${characterId} not available for user ${username} (auth: ${isAuthenticated})`);
        return new Response(JSON.stringify({
          error: 'Character not available',
          message: `The character '${characterId}' is not available for your account. ${isAuthenticated
            ? 'This is a premium character that requires purchase.'
            : 'Please sign in to access more characters.'
            }`
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      server.accept();
      server.accept();
      await this.setupPlayerConnection(squirrelId, characterId, server, sessionToken, username, isAuthenticated, emailVerified, persistedStats);

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
      // MVP 13: Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      await this.storage.delete('mapState');
      this.mapState = []; // Also clear in-memory state
      this.isInitialized = false; // Force re-initialization on next connection
      return new Response(JSON.stringify({
        message: "mapState reset - golden walnuts will respawn on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // Admin endpoint to reset forest (forces regeneration with landmark exclusions)
    if (path === "/admin/reset-forest" && request.method === "POST") {
      // MVP 13: Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      await this.storage.delete('forestObjects');
      this.forestObjects = []; // Clear in-memory state
      this.isInitialized = false; // Force re-initialization on next connection
      return new Response(JSON.stringify({
        message: "Forest reset - will regenerate with landmark exclusions on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // Admin endpoint to reset player positions
    if (path === "/admin/reset-positions" && request.method === "POST") {
      // MVP 13: Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const playerKeys = await this.storage.list({ prefix: 'player:' });
      for (const key of playerKeys.keys()) {
        await this.storage.delete(key);
      }
      return new Response(JSON.stringify({
        message: "Player positions reset - players will spawn at default position on next connection"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Get active players
    if (path === "/admin/players/active" && request.method === "GET") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const players = Array.from(this.activePlayers.values())
        .filter(p => !p.isDisconnected)
        .map(p => ({
          id: p.squirrelId,
          username: p.username,
          score: p.score,
          rank: p.titleName,
          health: p.health,
          inventory: p.walnutInventory,
          position: p.position,
          characterId: p.characterId,
          connectedAt: p.lastActivity
        }));

      return new Response(JSON.stringify({
        players,
        count: players.length,
        npcs: this.npcManager.getNPCs().length,
        predators: this.predatorManager.getPredators().length,
        timestamp: Date.now()
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Kick player
    if (path.startsWith("/admin/players/") && path.endsWith("/kick") && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const playerId = path.split("/")[3];
      const player = this.activePlayers.get(playerId);

      if (!player) {
        return new Response(JSON.stringify({
          error: "Not found",
          message: "Player not found or not connected"
        }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      // Close the player's WebSocket
      player.socket.close(1000, "Kicked by admin");

      return new Response(JSON.stringify({
        success: true,
        playerId: playerId,
        message: "Player kicked successfully"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Reset player data
    if (path.startsWith("/admin/players/") && path.endsWith("/reset") && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const playerId = path.split("/")[3];
      const player = this.activePlayers.get(playerId);

      if (!player) {
        return new Response(JSON.stringify({
          error: "Not found",
          message: "Player not found"
        }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      // Reset player state
      player.score = 0;
      player.walnutInventory = 0;
      player.health = 100;
      player.position = { x: 0, y: 2, z: 0 };
      player.titleId = 'rookie';
      player.titleName = 'Rookie';
      player.combatStats = { hits: 0, knockouts: 0, deaths: 0 };

      // Delete stored player data
      await this.storage.delete(`player:${playerId}`);

      // Kick player to force reconnect with new state
      player.socket.close(1000, "Player data reset by admin");

      return new Response(JSON.stringify({
        success: true,
        playerId: playerId,
        message: "Player data reset successfully",
        newState: {
          score: 0,
          rank: "Rookie",
          inventory: 0,
          health: 100,
          position: { x: 0, y: 2, z: 0 }
        }
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Get server metrics
    if (path === "/admin/metrics" && request.method === "GET") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const activePlayers = Array.from(this.activePlayers.values()).filter(p => !p.isDisconnected);
      const npcs = this.npcManager.getNPCs();
      const predators = this.predatorManager.getPredators();

      // Count walnuts
      const hiddenWalnuts = this.mapState.filter(w => !w.found).length;
      const foundWalnuts = this.mapState.filter(w => w.found).length;
      const goldenWalnuts = this.mapState.filter(w => w.origin === 'game').length;

      // Count predators by type
      const predatorCounts = predators.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return new Response(JSON.stringify({
        timestamp: Date.now(),
        players: {
          active: activePlayers.length,
          peakToday: this.metrics.peakPlayersToday,
          totalEver: this.metrics.totalUniquePlayersEver
        },
        npcs: {
          active: npcs.length,
          deathsToday: this.metrics.npcDeathsToday
        },
        predators: {
          active: predators.length,
          cardinal: predatorCounts['cardinal'] || 0,
          toucan: predatorCounts['toucan'] || 0,
          wildebeest: predatorCounts['wildebeest'] || 0,
          fleeCount: this.metrics.predatorFleesCount
        },
        walnuts: {
          hidden: hiddenWalnuts,
          found: foundWalnuts,
          golden: goldenWalnuts,
          treesGrown: this.metrics.treesGrownToday
        },
        combat: {
          projectilesThrown: this.metrics.projectilesThrownToday,
          hits: this.metrics.hitsToday,
          eliminations: activePlayers.reduce((sum, p) => sum + (p.combatStats?.knockouts || 0), 0)
        }
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Get predator status
    if (path === "/admin/predators" && request.method === "GET") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const predators = this.predatorManager.getPredators().map(p => ({
        id: p.id,
        type: p.type,
        state: p.state,
        position: p.position,
        targetId: p.targetId || null,
        targetUsername: p.targetId ? this.activePlayers.get(p.targetId)?.username : null,
        spawnTime: p.spawnTime,
        attackCount: 0, // TODO: Track attack count
        annoyanceLevel: p.annoyanceLevel || 0
      }));

      return new Response(JSON.stringify({
        predators,
        count: predators.length,
        maxPredators: 2 // TODO: Get from config
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Adjust NPC count
    if (path === "/admin/npcs/adjust" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { count: number };
      const targetCount = body.count;

      if (typeof targetCount !== 'number' || targetCount < 0 || targetCount > 10) {
        return new Response(JSON.stringify({
          error: "Invalid count",
          message: "Count must be a number between 0 and 10"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const currentNPCs = this.npcManager.getNPCs();
      const currentCount = currentNPCs.length;
      let spawned = 0;
      let despawned = 0;

      if (targetCount > currentCount) {
        // Spawn new NPCs
        spawned = targetCount - currentCount;
        // Use the existing spawnNPCs method which handles broadcasting
        const originalMax = (this.npcManager as any).MAX_NPCS;
        (this.npcManager as any).MAX_NPCS = targetCount;
        this.npcManager.spawnNPCs();
        (this.npcManager as any).MAX_NPCS = originalMax;
      } else if (targetCount < currentCount) {
        // Despawn NPCs
        despawned = currentCount - targetCount;
        for (let i = 0; i < despawned; i++) {
          const npc = currentNPCs[i];
          (this.npcManager as any).broadcastNPCDespawn(npc.id);
          (this.npcManager as any).npcs.delete(npc.id);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        previousCount: currentCount,
        newCount: targetCount,
        spawned,
        despawned,
        message: spawned > 0
          ? `NPC count adjusted - spawned ${spawned} new NPCs`
          : despawned > 0
            ? `NPC count adjusted - despawned ${despawned} NPCs`
            : "NPC count unchanged"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Clear all predators
    if (path === "/admin/predators/clear" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const predators = this.predatorManager.getPredators();
      const clearedCount = predators.length;

      // Remove all predators and broadcast to clients
      predators.forEach(p => {
        this.predatorManager.removePredator(p.id);

        // Broadcast predator despawn to all players
        this.broadcastToOthers('', {
          type: 'predator_despawn',
          predatorId: p.id
        });
      });

      return new Response(JSON.stringify({
        success: true,
        clearedCount,
        message: "All predators cleared"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Adjust predator count
    if (path === "/admin/predators/adjust" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { count: number };
      const targetCount = body.count;

      if (typeof targetCount !== 'number' || targetCount < 0 || targetCount > 5) {
        return new Response(JSON.stringify({
          error: "Invalid count",
          message: "Count must be a number between 0 and 5"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const currentPredators = this.predatorManager.getPredators();
      const currentCount = currentPredators.length;
      let spawned = 0;
      let despawned = 0;

      // Predator type rotation: cardinal, toucan, wildebeest
      const predatorTypes: Array<'cardinal' | 'toucan' | 'wildebeest'> = ['cardinal', 'toucan', 'wildebeest'];

      if (targetCount > currentCount) {
        // Spawn new predators
        spawned = targetCount - currentCount;
        const getTerrainHeight = (_x: number, _z: number) => 0; // Simple flat terrain for admin spawning
        for (let i = 0; i < spawned; i++) {
          const type = predatorTypes[i % predatorTypes.length];
          this.predatorManager.spawnPredator(type, getTerrainHeight);
        }
      } else if (targetCount < currentCount) {
        // Despawn predators
        despawned = currentCount - targetCount;
        for (let i = 0; i < despawned; i++) {
          const predator = currentPredators[i];
          this.predatorManager.removePredator(predator.id);

          // Broadcast predator despawn to all players
          this.broadcastToOthers('', {
            type: 'predator_despawn',
            predatorId: predator.id
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        previousCount: currentCount,
        newCount: targetCount,
        spawned,
        despawned,
        message: spawned > 0
          ? `Predator count adjusted - spawned ${spawned} new predators`
          : despawned > 0
            ? `Predator count adjusted - despawned ${despawned} predators`
            : "Predator count unchanged"
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Set tree growth points
    if (path === "/admin/config/tree-growth-points" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { points: number };
      const points = body.points;

      if (typeof points !== 'number' || points < 0 || points > 1000) {
        return new Response(JSON.stringify({
          error: "Invalid points value",
          message: "Points must be a number between 0 and 1000"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const previousPoints = this.treeGrowthConfig.pointsAwarded;
      this.treeGrowthConfig.pointsAwarded = points;
      await this.storage.put('treeGrowthConfig', this.treeGrowthConfig);

      return new Response(JSON.stringify({
        success: true,
        previousPoints,
        newPoints: points,
        message: `Tree growth points set to ${points}`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Set tree walnut drops
    if (path === "/admin/config/tree-walnut-drops" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { drops: number };
      const drops = body.drops;

      if (typeof drops !== 'number' || drops < 0 || drops > 20) {
        return new Response(JSON.stringify({
          error: "Invalid drops value",
          message: "Drops must be a number between 0 and 20"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const previousDrops = this.treeGrowthConfig.walnutsDropped;
      this.treeGrowthConfig.walnutsDropped = drops;
      await this.storage.put('treeGrowthConfig', this.treeGrowthConfig);

      return new Response(JSON.stringify({
        success: true,
        previousDrops,
        newDrops: drops,
        message: `Tree walnut drops set to ${drops}`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Set tree growth chance
    if (path === "/admin/config/tree-growth-chance" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { chance: number };
      const chance = body.chance;

      if (typeof chance !== 'number' || chance < 0 || chance > 100) {
        return new Response(JSON.stringify({
          error: "Invalid chance value",
          message: "Chance must be a number between 0 and 100"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const previousChance = this.treeGrowthConfig.growthChance;
      this.treeGrowthConfig.growthChance = chance;
      await this.storage.put('treeGrowthConfig', this.treeGrowthConfig);

      return new Response(JSON.stringify({
        success: true,
        previousChance,
        newChance: chance,
        message: `Tree growth chance set to ${chance}%`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 13: Reset metrics to defaults (for fixing corrupted storage)
    if (path === "/admin/reset-metrics" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      // Delete stored metrics to force reload with defaults
      await this.storage.delete('metrics');

      // Reset to defaults
      this.metrics = {
        treesGrownToday: 0,
        projectilesThrownToday: 0,
        hitsToday: 0,
        npcDeathsToday: 0,
        predatorFleesCount: 0,
        peakPlayersToday: 0,
        totalUniquePlayersEver: 0
      };

      return new Response(JSON.stringify({
        success: true,
        message: "Metrics reset to defaults",
        metrics: this.metrics
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 14: Set tree growing bonus count
    if (path === "/admin/config/tree-growing-count" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { count: number };
      const count = body.count;

      if (typeof count !== 'number' || count < 1 || count > 100) {
        return new Response(JSON.stringify({
          error: "Invalid count value",
          message: "Count must be a number between 1 and 100"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const previousCount = this.treeGrowingBonus.requiredCount;
      this.treeGrowingBonus.requiredCount = count;
      await this.storage.put('treeGrowingBonus', this.treeGrowingBonus);

      return new Response(JSON.stringify({
        success: true,
        previousCount,
        newCount: count,
        config: this.treeGrowingBonus,
        message: `Tree growing bonus count set to ${count} trees`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 14: Set tree growing bonus points
    if (path === "/admin/config/tree-growing-points" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { points: number };
      const points = body.points;

      if (typeof points !== 'number' || points < 0 || points > 1000) {
        return new Response(JSON.stringify({
          error: "Invalid points value",
          message: "Points must be a number between 0 and 1000"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const previousPoints = this.treeGrowingBonus.pointsAwarded;
      this.treeGrowingBonus.pointsAwarded = points;
      await this.storage.put('treeGrowingBonus', this.treeGrowingBonus);

      return new Response(JSON.stringify({
        success: true,
        previousPoints,
        newPoints: points,
        config: this.treeGrowingBonus,
        message: `Tree growing bonus points set to ${points}`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 16: Clear all users for testing (clears EMAIL_INDEX, USERNAME_INDEX, PlayerIdentity storage, and disconnects all players)
    // MVP 16: Clear all users for testing (clears EMAIL_INDEX, USERNAME_INDEX,
    if (path === "/admin/users/clear-all" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      // Optional: Accept array of emails/usernames to force-clear
      let forceClearIdentifiers: string[] = [];
      try {
        const bodyText = await request.text();
        if (bodyText) {
          const body = JSON.parse(bodyText) as { identifiers?: string[] };
          forceClearIdentifiers = body.identifiers || [];
        }
      } catch (e) {
        // No body or invalid JSON - that's fine, we'll just clear from KV
      }

      // Count operations
      let emailsCleared = 0;
      let usernamesCleared = 0;
      let identitiesCleared = 0;
      let playersDisconnected = 0;

      // Set of identifiers to clear (from both indexes)
      const identifiersToClear = new Set<string>();

      // 1. Scan EMAIL_INDEX
      const emailList = await this.env.EMAIL_INDEX.list();
      console.log(`📧 Found ${emailList.keys.length} emails in EMAIL_INDEX`);
      for (const key of emailList.keys) {
        const username = await this.env.EMAIL_INDEX.get(key.name);
        if (username) {
          identifiersToClear.add(username);
        }
        // Also try to clear DO by email directly (in case DO is keyed by email)
        const emailWithoutPrefix = key.name.replace('email:', '');
        identifiersToClear.add(emailWithoutPrefix);

        // Delete email index entry immediately
        await this.env.EMAIL_INDEX.delete(key.name);
        emailsCleared++;
      }

      // 2. Scan USERNAME_INDEX
      const usernameList = await this.env.USERNAME_INDEX.list();
      console.log(`👤 Found ${usernameList.keys.length} usernames in USERNAME_INDEX`);
      for (const key of usernameList.keys) {
        // Key format: "username:someuser"
        const parts = key.name.split(':');
        if (parts.length > 1) {
          identifiersToClear.add(parts[1]);
        }
        // Delete username index entry immediately
        await this.env.USERNAME_INDEX.delete(key.name);
        usernamesCleared++;
      }

      console.log(`🎯 Total unique identifiers from KV: ${identifiersToClear.size}`);

      // Add force-clear identifiers (if provided in request body)
      for (const identifier of forceClearIdentifiers) {
        identifiersToClear.add(identifier.toLowerCase().trim());
      }

      console.log(`🎯 Total identifiers to clear (including force-clear): ${identifiersToClear.size}`);

      // 3. Clear PlayerIdentity DOs for all found identifiers
      for (const identifier of identifiersToClear) {
        try {
          // Get PlayerIdentity DO for this identifier
          const id = this.env.PLAYER_IDENTITY.idFromName(identifier);
          const stub = this.env.PLAYER_IDENTITY.get(id);

          // Call admin clear action on the PlayerIdentity DO
          const clearUrl = new URL('https://internal/api/identity');
          clearUrl.searchParams.set('action', 'adminClear');

          const clearRequest = new Request(clearUrl.toString(), {
            method: 'POST',
            headers: { 'X-Admin-Secret': adminSecret }
          });

          await stub.fetch(clearRequest);
          identitiesCleared++;
        } catch (error) {
          console.error(`Failed to clear PlayerIdentity for ${identifier}:`, error);
        }
      }

      // 4. Disconnect all active players and close their WebSockets
      for (const [squirrelId, player] of this.activePlayers.entries()) {
        try {
          player.socket.close(1000, "Admin: All users cleared for testing");
          playersDisconnected++;
        } catch (error) {
          console.error(`Failed to close socket for player ${squirrelId}:`, error);
        }
      }

      // Clear active players map
      this.activePlayers.clear();

      const message = emailsCleared === 0 && usernamesCleared === 0
        ? `⚠️ No entries found in KV indexes. This usually means they were already cleared. Cleared ${identitiesCleared} DOs and disconnected ${playersDisconnected} players. Note: If you signed up but don't see data cleared, the DO might be keyed by email - use /admin/users/clear-user with the email instead.`
        : `Cleared ${emailsCleared} email registrations, ${usernamesCleared} username registrations, ${identitiesCleared} user identities, and disconnected ${playersDisconnected} active players`;

      return new Response(JSON.stringify({
        success: true,
        emailsCleared,
        usernamesCleared,
        identitiesCleared,
        playersDisconnected,
        message
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    // MVP 16: Clear specific user (fixes "Zombie DO" issue where user exists in DO but not in KV)
    if (path === "/admin/users/clear-user" && request.method === "POST") {
      // Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }), {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      const body = await request.json() as { username?: string; email?: string };
      let { username, email } = body;

      if (!username && !email) {
        return new Response(JSON.stringify({
          error: "Missing identifier",
          message: "Must provide username or email"
        }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        });
      }

      // If only email provided, try to look up username from KV
      if (!username && email) {
        const emailKey = `email:${email.toLowerCase().trim()}`;
        const foundUsername = await this.env.EMAIL_INDEX.get(emailKey);
        if (foundUsername) {
          username = foundUsername;
        }
        // If not found in KV, we proceed with just the email.
        // This allows clearing "Zombie DOs" that are keyed by email but missing from KV.
      }

      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      const normalizedUsername = username ? username.toLowerCase().trim() : null;

      let message = `Cleared user request: ${username || 'N/A'}, ${email || 'N/A'}`;
      let foundInEmailIndex = false;
      let foundInUsernameIndex = false;
      let identitiesCleared = 0;

      // IDs to clear - we might have DOs keyed by username OR email
      const idsToClear = new Set<string>();
      if (normalizedUsername) idsToClear.add(normalizedUsername);
      if (normalizedEmail) idsToClear.add(normalizedEmail);

      for (const idName of idsToClear) {
        try {
          // Get PlayerIdentity DO for this identifier
          const id = this.env.PLAYER_IDENTITY.idFromName(idName);
          const stub = this.env.PLAYER_IDENTITY.get(id);

          // Call admin clear action on the PlayerIdentity DO
          const clearUrl = new URL('https://internal/api/identity');
          clearUrl.searchParams.set('action', 'adminClear');

          const clearRequest = new Request(clearUrl.toString(), {
            method: 'POST',
            headers: { 'X-Admin-Secret': adminSecret }
          });

          const response = await stub.fetch(clearRequest);
          if (response.ok) {
            identitiesCleared++;
            const data = await response.json() as any;
            // If we found an email/username in the DO that we didn't know, try to clear that too
            if (data.email && !email) email = data.email;
            if (data.username && !username) username = data.username;
          }
        } catch (error) {
          console.error(`Failed to clear PlayerIdentity for ${idName}:`, error);
          message += ` (DO clear failed for ${idName}: ${error})`;
        }
      }

      // 2. Clear from USERNAME_INDEX
      if (username) {
        const usernameKey = `username:${username.toLowerCase().trim()}`;
        const existingEmail = await this.env.USERNAME_INDEX.get(usernameKey);
        if (existingEmail) {
          foundInUsernameIndex = true;
          await this.env.USERNAME_INDEX.delete(usernameKey);
          if (!email) email = existingEmail;
        }
      }

      // 3. Clear from EMAIL_INDEX
      if (email) {
        const emailKey = `email:${email.toLowerCase().trim()}`;
        const existingUsername = await this.env.EMAIL_INDEX.get(emailKey);
        if (existingUsername) {
          foundInEmailIndex = true;
          await this.env.EMAIL_INDEX.delete(emailKey);
        }
      }

      // 4. Disconnect active player if connected
      let disconnected = false;
      for (const [squirrelId, player] of this.activePlayers.entries()) {
        if (player.username === username) {
          try {
            player.socket.close(1000, "Admin: User cleared");
            this.activePlayers.delete(squirrelId);
            disconnected = true;
          } catch (e) { console.error('Failed to close socket', e); }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        username,
        email,
        identitiesCleared,
        foundInUsernameIndex,
        foundInEmailIndex,
        disconnected,
        message: `User ${username} cleared. DO: ${identitiesCleared}, KV-User: ${foundInUsernameIndex}, KV-Email: ${foundInEmailIndex}, Active: ${disconnected}`
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  // MVP 16: Admin endpoint to manually verify a user (bypassing email)
  // Useful when email delivery fails (e.g., Apple 554 error)
  private async handleAdminVerifyUser(request: Request): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
    };

    // Require admin authentication
    const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");
    if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
      return new Response(JSON.stringify({
        error: "Unauthorized",
        message: "Invalid or missing admin secret"
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    try {
      const body = await request.json() as { username?: string; email?: string };
      let { username, email } = body;

      if (!username && !email) {
        return new Response(JSON.stringify({
          error: "Missing identifier",
          message: "Must provide username or email"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Resolve email to username if needed
      if (!username && email) {
        const emailKey = `email:${email.toLowerCase().trim()}`;
        const foundUsername = await this.env.EMAIL_INDEX.get(emailKey);
        if (foundUsername) {
          username = foundUsername;
        } else {
          // Fallback: try using email as ID (zombie case)
          username = email.toLowerCase().trim();
        }
      }

      if (!username) {
        return new Response(JSON.stringify({
          error: "Resolution failed",
          message: "Could not resolve user identifier"
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Call PlayerIdentity DO
      const id = this.env.PLAYER_IDENTITY.idFromName(username);
      const stub = this.env.PLAYER_IDENTITY.get(id);

      const verifyUrl = new URL('https://internal/api/identity');
      verifyUrl.searchParams.set('action', 'adminVerify');

      const verifyRequest = new Request(verifyUrl.toString(), {
        method: 'POST',
        headers: { 'X-Admin-Secret': adminSecret }
      });

      const response = await stub.fetch(verifyRequest);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error('Admin verify error:', error);
      return new Response(JSON.stringify({
        error: "Internal Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  // Simple player connection setup
  private async setupPlayerConnection(
    squirrelId: string,
    characterId: string,
    socket: WebSocket,
    sessionToken: string,
    username: string,
    isAuthenticated: boolean,
    emailVerified: boolean,
    persistedStats?: { score: number, titleId: string, titleName: string }
  ): Promise<void> {
    // MVP 5.8: Check if player is reconnecting (still in active players but disconnected)
    const existingPlayer = this.activePlayers.get(squirrelId);
    const isReconnecting = existingPlayer && existingPlayer.isDisconnected;

    if (isReconnecting) {
      // Player is reconnecting - reattach socket and mark as reconnected
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
        existingPlayer.isDisconnected = true;
        existingPlayer.disconnectedAt = Date.now();

        // MVP 9: Mark disconnect in SquirrelSession for reconnection window (non-blocking)
        (async () => {
          try {
            const squirrelSessionId = this.env.SQUIRREL.idFromName(squirrelId);
            const squirrelSession = this.env.SQUIRREL.get(squirrelSessionId);
            await squirrelSession.fetch(new Request('http://session/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ squirrelId })
            }));
          } catch (error) {
            console.warn(`⚠️ Failed to mark disconnect for ${squirrelId}:`, error);
          }
        })(); // Fire and forget

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
          this.npcManager.despawnAllNPCs();
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
      };

      // Send current world state with saved position
      // MVP 12: For reconnections, fetch title from playerConnection (already stored)
      const titleId = (existingPlayer as any).titleId || 'rookie';
      const titleName = (existingPlayer as any).titleName || 'Rookie';
      await this.sendWorldState(socket, existingPlayer.position, existingPlayer.rotationY, titleId, titleName, false);
      await this.sendExistingPlayers(socket, squirrelId);

      // MVP 8 FIX: Send initial inventory and health state to sync UI (prevents grayed-out buttons on reconnect)
      this.sendMessage(socket, {
        type: 'inventory_update',
        walnutCount: existingPlayer.walnutInventory
      });
      this.sendMessage(socket, {
        type: 'health_update',
        playerId: squirrelId,
        health: existingPlayer.health,
        maxHealth: existingPlayer.maxHealth
      });
      // MVP 16: Send score update
      this.sendMessage(socket, {
        type: 'score_update',
        score: existingPlayer.score
      });

      // MVP 8 FIX: Spawn NPCs if none exist (they may have been despawned when last player left)
      if (this.npcManager.getNPCCount() === 0) {
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

        isAuthenticated,
        emailVerified,
        // MVP 7.1: Position save throttling
        lastPositionSave: 0,
        // MVP 8: Combat system
        walnutInventory: 0, // Start with 0 walnuts
        lastThrowTime: 0,
        health: 100, // Start at full health
        maxHealth: 100,
        score: 0, // Will be restored from session if reconnecting
        lastAttackerId: null,
        combatStats: {
          hits: 0,
          knockouts: 0,
          deaths: 0
        },
        invulnerableUntil: Date.now() + 3000, // 3 seconds spawn protection
        lastCollisionDamageTime: 0, // No collision damage cooldown initially
        // MVP 12: Player Ranking System (will be updated from session below)
        titleId: 'rookie',
        titleName: 'Rookie',
        // MVP 14: Tree growing bonus tracking
        treesGrownCount: 0,
        bonusMilestones: new Set<number>()
      };

      // MVP 9: Check for recent disconnect and restore score (.io game pattern)
      // MVP 12: Call /join first to create/load session (this sets isFirstJoin flag correctly)
      // Industry standard: 5-minute reconnection window
      const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
      const squirrelSessionId = this.env.SQUIRREL.idFromName(squirrelId);
      const squirrelSession = this.env.SQUIRREL.get(squirrelSessionId);

      // MVP 12: Store title data for sending in world_state
      let titleId = 'rookie';
      let titleName = 'Rookie';
      let isFirstJoin = false;

      try {
        // CRITICAL FIX: Call /join first (creates new session if doesn't exist, sets isFirstJoin)
        const joinResponse = await squirrelSession.fetch(new Request(`http://session/join?squirrelId=${squirrelId}`, {
          method: 'POST'
        }));

        if (joinResponse.ok) {
          const joinData = await joinResponse.json() as any;
          console.log(`✅ Join response for ${username}:`, JSON.stringify(joinData));

          // Extract title and isFirstJoin from join response
          if (joinData.titleId && joinData.titleName) {
            titleId = joinData.titleId;
            titleName = joinData.titleName;
          }

          if (joinData.isFirstJoin === true) {
            isFirstJoin = true;
            console.log(`✨ First join detected for ${username} - will show welcome overlay`);
          }

          // Restore score from session if available
          if (joinData.stats?.score) {
            playerConnection.score = joinData.stats.score;
            console.log(`♻️ Restored score for ${username}: ${joinData.stats.score}`);
          }

          // MVP 16: Override with persisted stats if authenticated (verified or not)
          // FIX: Allow unverified users to restore score too
          if (persistedStats && isAuthenticated) {
            playerConnection.score = persistedStats.score;
            titleId = persistedStats.titleId;
            titleName = persistedStats.titleName;
            console.log(`♻️ Restored persisted stats for ${username}: Score=${playerConnection.score}, Rank=${titleName}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Could not join/restore session for ${username}:`, error);
      }

      // MVP 12: Store title info on playerConnection for future use
      playerConnection.titleId = titleId;
      playerConnection.titleName = titleName;


      this.activePlayers.set(squirrelId, playerConnection);

      // MVP 13: Track unique players and peak
      if (!this.uniquePlayerIds.has(squirrelId)) {
        this.uniquePlayerIds.add(squirrelId);
        this.metrics.totalUniquePlayersEver++;
        await this.storage.put('metrics', this.metrics);
        await this.storage.put('uniquePlayerIds', Array.from(this.uniquePlayerIds));
      }

      // Update peak players if current count is higher
      const activeCount = Array.from(this.activePlayers.values()).filter(p => !p.isDisconnected).length;
      if (activeCount > this.metrics.peakPlayersToday) {
        this.metrics.peakPlayersToday = activeCount;
        await this.storage.put('metrics', this.metrics);
      }

      // MVP 9: Only report to leaderboard if score > 0 (don't report initial joins)
      // This prevents overwriting existing scores with 0 on rejoin
      // MVP 16: ALWAYS report for authenticated players to ensure metadata (badges) is updated
      if (playerConnection.score > 0 || playerConnection.isAuthenticated) {
        await this.reportScoreToLeaderboard(playerConnection);
      }

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
        playerConnection.isDisconnected = true;
        playerConnection.disconnectedAt = Date.now();

        // MVP 9: Mark disconnect in SquirrelSession for reconnection window (non-blocking)
        (async () => {
          try {
            const squirrelSessionId = this.env.SQUIRREL.idFromName(squirrelId);
            const squirrelSession = this.env.SQUIRREL.get(squirrelSessionId);
            await squirrelSession.fetch(new Request('http://session/disconnect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ squirrelId })
            }));
          } catch (error) {
            console.warn(`⚠️ Failed to mark disconnect for ${squirrelId}:`, error);
          }
        })(); // Fire and forget

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
          this.npcManager.despawnAllNPCs();
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket error:', event);
      };

      // Send initial data with spawn position (MVP 6: may be saved position or default)
      // MVP 12: Include title information in world_state
      console.log(`🌍 Sending world_state to ${username} - isFirstJoin: ${isFirstJoin}, titleId: ${titleId}, titleName: ${titleName}`);
      await this.sendWorldState(socket, playerConnection.position, playerConnection.rotationY, titleId, titleName, isFirstJoin);
      await this.sendExistingPlayers(socket, squirrelId);

      // MVP 8 FIX: Send initial inventory and health state to sync UI (prevents grayed-out buttons)
      this.sendMessage(socket, {
        type: 'inventory_update',
        walnutCount: playerConnection.walnutInventory
      });
      this.sendMessage(socket, {
        type: 'health_update',
        playerId: squirrelId,
        health: playerConnection.health,
        maxHealth: playerConnection.maxHealth
      });
      // MVP 16: Send initial score (persisted)
      this.sendMessage(socket, {
        type: 'score_update',
        score: playerConnection.score
      });

      // MVP 8 FIX: Spawn NPCs if none exist (they may have been despawned when last player left)
      if (this.npcManager.getNPCCount() === 0) {
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

          // Check for collisions with other players/NPCs
          this.checkCollisions(playerConnection);
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
          health: playerConnection.health, // MVP 8: Broadcast health for UI
          score: playerConnection.score, // MVP 8: Broadcast score for leaderboard
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

        // MVP 8: Validate player has walnuts to hide
        if (playerConnection.walnutInventory <= 0) {
          console.warn(`🚫 Hide rejected: No walnuts for ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, {
            type: 'hide_rejected',
            reason: 'no_walnuts'
          });
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

        // MVP 9: Add walnut to registry for tree growth tracking
        const walnutRegistryId = this.env.WALNUTS.idFromName('global');
        const walnutRegistry = this.env.WALNUTS.get(walnutRegistryId);
        await walnutRegistry.fetch(new Request('http://registry/add', {
          method: 'POST',
          body: JSON.stringify(newWalnut)
        }));

        // MVP 8: Decrement player inventory
        playerConnection.walnutInventory--;

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

        // MVP 8: Send inventory update to player
        this.sendMessage(playerConnection.socket, {
          type: 'inventory_update',
          walnutCount: playerConnection.walnutInventory
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
          const walnut = this.mapState[walnutIndex];
          walnut.found = true;

          // MVP 9: Mark walnut as found in registry (prevents tree growth)
          const walnutRegistryId = this.env.WALNUTS.idFromName('global');
          const walnutRegistry = this.env.WALNUTS.get(walnutRegistryId);
          await walnutRegistry.fetch(new Request('http://registry/find', {
            method: 'POST',
            body: JSON.stringify({
              walnutId: data.walnutId,
              playerId: playerConnection.squirrelId
            })
          }));

          // MVP 8: Add walnut to player inventory (max 10)
          const MAX_INVENTORY = 10;
          if (playerConnection.walnutInventory < MAX_INVENTORY) {
            playerConnection.walnutInventory++;
          }

          // MVP 14 FIX: Award correct points based on walnut type
          // Golden walnuts (isGolden=true) = 5 points, buried = 3 points, others = 1 point
          const points = walnut.isGolden ? 5 : (walnut.hiddenIn === 'buried' ? 3 : 1);
          playerConnection.score += points;

          // Persist updated mapState
          await this.storage.put('mapState', this.mapState);

          // Broadcast to all other players (including inventory update)
          this.broadcastToOthers(playerConnection.squirrelId, {
            type: 'walnut_found',
            walnutId: data.walnutId,
            finderId: data.finderId,
            points: points
          });

          // MVP 16: Update auth status from client message (if provided)
          if (typeof data.isAuthenticated === 'boolean') {
            playerConnection.isAuthenticated = data.isAuthenticated;
          }
          if (typeof data.emailVerified === 'boolean') {
            playerConnection.emailVerified = data.emailVerified;
          }

          // MVP 8: Send inventory + score update to the player who found it
          this.sendMessage(playerConnection.socket, {
            type: 'inventory_update',
            walnutCount: playerConnection.walnutInventory
          });
          this.sendMessage(playerConnection.socket, {
            type: 'score_update',
            score: playerConnection.score
          });

          // MVP 8: Report updated score to leaderboard
          await this.reportScoreToLeaderboard(playerConnection);

          // MVP 16: Sync persistent stats if authenticated AND verified
          if (playerConnection.isAuthenticated && playerConnection.emailVerified) {
            const playerIdentityId = this.env.PLAYER_IDENTITY.idFromName(playerConnection.username);
            const playerIdentity = this.env.PLAYER_IDENTITY.get(playerIdentityId);
            // Fire and forget
            playerIdentity.fetch(new Request('http://internal/api/identity?action=updateStats', {
              method: 'POST',
              body: JSON.stringify({
                score: playerConnection.score,
                titleId: playerConnection.titleId,
                titleName: playerConnection.titleName
              })
            })).catch(e => console.error('Failed to sync stats', e));
          }
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

        // MVP 13: Track projectiles thrown
        this.metrics.projectilesThrownToday++;
        await this.storage.put('metrics', this.metrics);

        // MVP 12: Distract visible aerial predators with thrown walnut
        if (data.visiblePredators && Array.isArray(data.visiblePredators) && data.visiblePredators.length > 0) {
          const distractedIds: string[] = [];

          for (const predatorId of data.visiblePredators) {
            const success = this.predatorManager.distractPredator(predatorId, `walnut-${throwTime}`);
            if (success) {
              distractedIds.push(predatorId);
            }
          }

          // Broadcast distraction to all clients for visual feedback
          if (distractedIds.length > 0) {
            this.broadcastToAll({
              type: 'predators_distracted',
              predatorIds: distractedIds,
              throwerId: playerConnection.squirrelId
            });
          }
        }

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
        // Use client's ID to prevent duplicates (client already created local walnut)
        const droppedWalnutId = data.walnutId || `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

      case "player_hit":
        // MVP 8/9: Server-side hit validation and damage application (players and NPCs)
        const { targetId, damage: requestedDamage, position: hitPosition } = data;

        // MVP 9: Check if target is a player or NPC
        const targetPlayer = this.activePlayers.get(targetId);
        const targetNPC = this.npcManager.getNPCById(targetId);

        if (!targetPlayer && !targetNPC) {
          console.warn(`🚫 Hit rejected: Target ${targetId} not found`);
          return;
        }

        // Validate attacker is not hitting themselves
        if (targetId === playerConnection.squirrelId) {
          console.warn(`🚫 Hit rejected: Cannot hit yourself`);
          return;
        }

        // Get target position (either player or NPC)
        const targetPosition = targetPlayer ? targetPlayer.position : targetNPC!.position;

        // Validate target is not invulnerable (spawn protection - players only)
        if (targetPlayer && targetPlayer.invulnerableUntil && Date.now() < targetPlayer.invulnerableUntil) {
          console.warn(`🚫 Hit rejected: Target ${targetId} has spawn protection`);
          return;
        }

        // Validate distance (prevent cheating - max projectile range is ~15 units)
        const distance = Math.sqrt(
          Math.pow(targetPosition.x - playerConnection.position.x, 2) +
          Math.pow(targetPosition.z - playerConnection.position.z, 2)
        );
        if (distance > 20) { // 20 units = generous validation (15 range + 5 margin)
          console.warn(`🚫 Hit rejected: Distance too far (${distance.toFixed(1)} units)`);
          return;
        }

        // Apply damage (server authoritative - ignore client damage value)
        const DAMAGE_PER_HIT = 20;
        let actualDamage = 0;
        let newHealth = 0;

        if (targetPlayer) {
          // MVP 9: Check if player is already dead (prevent double-death from rapid hits)
          if (targetPlayer.health <= 0) {
            console.warn(`🚫 Hit rejected: Player ${targetId} is already dead`);
            return;
          }

          // Damage player
          const oldHealth = targetPlayer.health;
          targetPlayer.health = Math.max(0, targetPlayer.health - DAMAGE_PER_HIT);
          actualDamage = oldHealth - targetPlayer.health;
          newHealth = targetPlayer.health;

          // Track attacker for knockout credit
          if (actualDamage > 0) {
            targetPlayer.lastAttackerId = playerConnection.squirrelId;
          }
        } else if (targetNPC) {
          // MVP 9: Check if NPC is already dead (prevent double-death from rapid hits)
          if (targetNPC.health <= 0) {
            console.warn(`🚫 Hit rejected: NPC ${targetId} is already dead`);
            return;
          }

          // MVP 9: Damage NPC
          console.log(`[NPC-HIT] Before damage: ${targetNPC.username} health=${targetNPC.health}`);
          actualDamage = this.npcManager.applyDamageToNPC(targetId, DAMAGE_PER_HIT);
          // Get fresh NPC reference to ensure we have the updated health value
          const updatedNPC = this.npcManager.getNPCById(targetId);
          newHealth = updatedNPC ? updatedNPC.health : 0;
          console.log(`[NPC-HIT] After damage: actualDamage=${actualDamage}, newHealth=${newHealth}, updatedNPC exists=${!!updatedNPC}`);
        }

        // Award +2 points for successful hit
        playerConnection.score += 2;
        playerConnection.combatStats.hits += 1;

        // MVP 13: Track hits
        this.metrics.hitsToday++;
        await this.storage.put('metrics', this.metrics);

        // MVP 8: Report score to leaderboard + send to player for HUD
        await this.reportScoreToLeaderboard(playerConnection);
        this.sendMessage(playerConnection.socket, {
          type: 'score_update',
          score: playerConnection.score
        });

        // Broadcast damage event to all players
        this.activePlayers.forEach((player) => {
          this.sendMessage(player.socket, {
            type: 'entity_damaged',
            targetId: targetId,
            attackerId: playerConnection.squirrelId,
            damage: actualDamage,
            newHealth: newHealth,
            position: targetPosition
          });
        });

        // Check for death/knockout
        console.log(`[DEATH-CHECK] newHealth=${newHealth}, newHealth <= 0 is ${newHealth <= 0}, targetPlayer=${!!targetPlayer}, targetNPC=${!!targetNPC}`);
        if (newHealth <= 0) {
          if (targetPlayer) {
            console.log(`[DEATH-CHECK] Handling player death`);
            await this.handlePlayerDeath(targetPlayer, playerConnection);
          } else if (targetNPC) {
            // MVP 9: Handle NPC death
            console.log(`[DEATH-CHECK] Handling NPC death for ${targetId}`);
            await this.npcManager.handleNPCDeath(targetId);
          } else {
            console.log(`[DEATH-CHECK] WARNING: newHealth <= 0 but no target found!`);
          }
        }
        break;

      case "player_eat":
        // MVP 8: Server-side eat validation and healing
        const EAT_HEAL_AMOUNT = 25;

        // Validate inventory
        if (playerConnection.walnutInventory <= 0) {
          console.warn(`🚫 Eat rejected: No walnuts for ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, {
            type: 'eat_rejected',
            reason: 'no_walnuts'
          });
          return;
        }

        // Validate not at full health
        if (playerConnection.health >= playerConnection.maxHealth) {
          console.warn(`🚫 Eat rejected: Already at full health for ${playerConnection.squirrelId}`);
          this.sendMessage(playerConnection.socket, {
            type: 'eat_rejected',
            reason: 'full_health'
          });
          return;
        }

        // Consume walnut and heal
        playerConnection.walnutInventory -= 1;
        const oldHp = playerConnection.health;
        playerConnection.health = Math.min(playerConnection.maxHealth, playerConnection.health + EAT_HEAL_AMOUNT);
        const actualHealing = playerConnection.health - oldHp;

        // Broadcast heal event
        this.activePlayers.forEach((player) => {
          this.sendMessage(player.socket, {
            type: 'entity_healed',
            playerId: playerConnection.squirrelId,
            healing: actualHealing,
            newHealth: playerConnection.health
          });
        });

        // Send inventory update to player
        this.sendMessage(playerConnection.socket, {
          type: 'inventory_update',
          walnutCount: playerConnection.walnutInventory
        });
        break;

      case "predator_hit":
        // MVP 12: Handle walnut hit on wildebeest predator
        const predatorId = data.predatorId;

        if (!predatorId) {
          console.warn(`🚫 Predator hit rejected: No predatorId provided`);
          return;
        }

        // Validate attacker distance (prevent cheating)
        // Note: We can't easily validate exact predator position without complex state sync
        // Trust client hit detection for now (they already validated locally)

        // Apply hit to predator (increments annoyance)
        const hitResult = this.predatorManager.handleWalnutHit(predatorId);

        if (hitResult.hit) {
          console.log(`🎯 Wildebeest ${predatorId} hit! Annoyance: ${hitResult.annoyanceLevel}/4`);

          // MVP 13: Track hits (including predator hits)
          this.metrics.hitsToday++;
          await this.storage.put('metrics', this.metrics);

          // Broadcast annoyance update to all clients for UI
          this.broadcastToAll({
            type: 'predator_annoyance_update',
            predatorId: predatorId,
            annoyanceLevel: hitResult.annoyanceLevel,
            fleeing: hitResult.fleeing
          });

          // Award points if wildebeest was driven away
          if (hitResult.fleeing) {
            playerConnection.score += 10; // Reward for driving away predator
            await this.reportScoreToLeaderboard(playerConnection);
            this.sendMessage(playerConnection.socket, {
              type: 'score_update',
              score: playerConnection.score
            });
          }
        }
        break;

      default:
        // Broadcast other messages
        this.broadcastToOthers(playerConnection.squirrelId, data);
        break;
    }
  }

  /**
   * MVP 8: Handle player death and respawn
   */
  private async handlePlayerDeath(victim: PlayerConnection, killer: PlayerConnection): Promise<void> {

    // Award knockout points to killer (+5)
    killer.score += 5;
    killer.combatStats.knockouts += 1;

    // Apply death penalty to victim (-2)
    victim.score = Math.max(0, victim.score - 2);
    victim.combatStats.deaths += 1;

    // MVP 8: Report scores to leaderboard + send to players for HUD
    await this.reportScoreToLeaderboard(killer);
    await this.reportScoreToLeaderboard(victim);
    this.sendMessage(killer.socket, {
      type: 'score_update',
      score: killer.score
    });
    this.sendMessage(victim.socket, {
      type: 'score_update',
      score: victim.score
    });

    // Drop all walnuts at death location
    // MVP 9 FIX: Wrap in try-catch to ensure death broadcast happens even if walnut drop fails
    const droppedWalnuts = victim.walnutInventory;
    if (droppedWalnuts > 0) {
      try {
        // Create dropped walnuts at death position
        for (let i = 0; i < droppedWalnuts; i++) {
          const walnutId = `death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const walnut: Walnut = {
            id: walnutId,
            ownerId: 'game', // Dropped walnuts are neutral
            origin: 'game',
            hiddenIn: 'ground',
            location: {
              x: victim.position.x + (Math.random() - 0.5) * 2, // Spread around death location
              y: victim.position.y,
              z: victim.position.z + (Math.random() - 0.5) * 2
            },
            found: false,
            timestamp: Date.now()
          };

          this.mapState.push(walnut);

          // Broadcast dropped walnut
          this.activePlayers.forEach((player) => {
            this.sendMessage(player.socket, {
              type: 'walnut_dropped',
              walnutId: walnut.id,
              position: walnut.location
            });
          });
        }

        await this.storage.put('mapState', this.mapState);
        victim.walnutInventory = 0;
      } catch (error) {
        console.error(`❌ Failed to drop walnuts for ${victim.username}:`, error);
      }
    }

    // Broadcast death event
    this.activePlayers.forEach((player) => {
      this.sendMessage(player.socket, {
        type: 'player_death',
        victimId: victim.squirrelId,
        killerId: killer.squirrelId,
        deathPosition: victim.position
      });
    });

    // Respawn after 3 seconds
    setTimeout(async () => {
      // Respawn at random location
      const spawnPoints = [
        { x: 0, z: 10 },
        { x: 10, z: 0 },
        { x: -10, z: 0 },
        { x: 0, z: -10 },
        { x: 15, z: 15 },
        { x: -15, z: 15 },
        { x: 15, z: -15 },
        { x: -15, z: -15 }
      ];
      const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

      victim.position = { x: randomSpawn.x, y: 2, z: randomSpawn.z };
      victim.health = victim.maxHealth;
      victim.lastAttackerId = null;
      victim.invulnerableUntil = Date.now() + 3000; // 3s spawn protection

      // Broadcast respawn
      this.activePlayers.forEach((player) => {
        this.sendMessage(player.socket, {
          type: 'player_respawn',
          playerId: victim.squirrelId,
          position: victim.position,
          health: victim.health,
          invulnerableUntil: victim.invulnerableUntil,
          walnutInventory: victim.walnutInventory // MVP 8: Include inventory (should be 0 after death)
        });
      });
    }, 3000);
  }

  // Simple world state initialization
  // MVP 6: Now includes spawn position for returning players
  private async sendWorldState(
    socket: WebSocket,
    spawnPosition: { x: number; y: number; z: number },
    spawnRotationY: number,
    titleId?: string,
    titleName?: string,
    isFirstJoin?: boolean
  ): Promise<void> {
    await this.initializeWorld();

    // AGGRESSIVE FIX: Always filter out test-walnut before sending
    const filteredMapState = this.mapState.filter(w => w.id !== 'test-walnut');
    if (filteredMapState.length !== this.mapState.length) {
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
      spawnRotationY,
      // MVP 12: Send player title information
      titleId,
      titleName,
      isFirstJoin
    });
  }

  /**
   * MVP 14: Check if player earned tree growing bonus
   */
  private async checkTreeGrowingBonus(player: PlayerConnection): Promise<void> {
    const count = player.treesGrownCount;
    const threshold = this.treeGrowingBonus.requiredCount;

    // Check if reached threshold and hasn't received this bonus yet
    if (count === threshold && !player.bonusMilestones.has(threshold)) {
      player.bonusMilestones.add(threshold);
      player.score += this.treeGrowingBonus.pointsAwarded;

      console.log(`🎉 ${player.username} earned tree growing bonus! ${count} trees grown, +${this.treeGrowingBonus.pointsAwarded} points`);

      // Send special bonus message (triggers custom UI overlay on client)
      this.sendMessage(player.socket, {
        type: 'tree_growing_bonus',
        points: this.treeGrowingBonus.pointsAwarded,
        count: count,
        message: `You've grown a thriving forest! +${this.treeGrowingBonus.pointsAwarded} bonus points!`
      });

      // Update score in leaderboard
      await this.reportScoreToLeaderboard(player);

      // Send score update to player
      this.sendMessage(player.socket, {
        type: 'score_update',
        score: player.score
      });
    }
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

  // MVP 8: Report player score to leaderboard
  // MVP 9: Also update SquirrelSession for score persistence
  private async reportScoreToLeaderboard(playerConnection: any): Promise<void> {
    try {
      // MVP 9: Update SquirrelSession for score persistence across reconnects
      const squirrelSessionId = this.env.SQUIRREL.idFromName(playerConnection.squirrelId);
      const squirrelSession = this.env.SQUIRREL.get(squirrelSessionId);

      try {
        // MVP 12: Check for rank-ups when updating score
        const sessionResponse = await squirrelSession.fetch(new Request('http://session/update-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            squirrelId: playerConnection.squirrelId,
            score: playerConnection.score
          })
        }));

        // MVP 12: Parse response to check for rank-up
        const sessionData = await sessionResponse.json() as any;
        if (sessionData.rankedUp && sessionData.newTitle) {
          // Player ranked up! Send rank-up notification via WebSocket
          try {
            playerConnection.socket.send(JSON.stringify({
              type: 'rank_up',
              titleId: sessionData.newTitle.id,
              titleName: sessionData.newTitle.name,
              description: sessionData.newTitle.description
            }));
          } catch (sendError) {
            console.warn(`⚠️ Failed to send rank-up notification to ${playerConnection.username}:`, sendError);
          }

          // MVP 12: Update player's title on connection object
          playerConnection.titleId = sessionData.newTitle.id;
          playerConnection.titleName = sessionData.newTitle.name;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to update session score for ${playerConnection.username}:`, error);
      }

      // Get leaderboard Durable Object
      const leaderboardId = this.env.LEADERBOARD.idFromName("global");
      const leaderboard = this.env.LEADERBOARD.get(leaderboardId);

      // Prepare score record
      // MVP 16: Use username for authenticated players, squirrelId for guests
      // FIX: Don't use "Anonymous" as ID, fall back to squirrelId
      const shouldUseUsername = playerConnection.isAuthenticated &&
        playerConnection.username &&
        playerConnection.username !== 'Anonymous';

      const scoreRecord = {
        playerId: shouldUseUsername ? playerConnection.username : playerConnection.squirrelId,
        score: playerConnection.score,
        walnuts: {
          hidden: 0, // TODO: Track these stats
          found: 0
        },
        updatedAt: Date.now(),
        // MVP 16: Include auth status for All-Time leaderboard filtering
        isAuthenticated: !!playerConnection.isAuthenticated,
        emailVerified: !!playerConnection.emailVerified,
        characterId: playerConnection.characterId || 'squirrel'
      };

      // Report to leaderboard
      const response = await leaderboard.fetch(new Request('http://leaderboard/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreRecord)
      }));

      if (!response.ok) {
        console.warn(`⚠️ Failed to report score to leaderboard for ${playerConnection.username} (status: ${response.status})`);
      }

      // MVP 16: Sync persistent stats if authenticated AND verified
      if (playerConnection.isAuthenticated && playerConnection.emailVerified) {
        const playerIdentityId = this.env.PLAYER_IDENTITY.idFromName(playerConnection.username);
        const playerIdentity = this.env.PLAYER_IDENTITY.get(playerIdentityId);
        // Fire and forget
        playerIdentity.fetch(new Request('http://internal/api/identity?action=updateStats', {
          method: 'POST',
          body: JSON.stringify({
            score: playerConnection.score,
            titleId: playerConnection.titleId,
            titleName: playerConnection.titleName
          })
        })).catch(e => console.error('Failed to sync stats', e));
      }
    } catch (error) {
      console.error('❌ Error reporting score to leaderboard:', error);
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
    const BUSH_WALNUT_COUNT = 8; // MVP 8 FIX: Increased from 3 to 8 for more exploration
    if (shrubs.length >= BUSH_WALNUT_COUNT) {
      // Select random shrubs for walnuts
      const shuffled = [...shrubs].sort(() => Math.random() - 0.5);
      const selectedShrubs = shuffled.slice(0, BUSH_WALNUT_COUNT);

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
      console.warn(`⚠️ SERVER: Not enough shrubs (${shrubs.length}) to place ${BUSH_WALNUT_COUNT} bush walnuts`);
    }

    // Add all regular game walnuts
    for (const regularWalnut of regularGameWalnuts) {
      this.mapState.push(regularWalnut);
    }


    await this.storage.put('mapState', this.mapState);

    // MVP 7: Spawn NPCs
    console.log(`🔧 About to spawn NPCs...`);
    this.npcManager.spawnNPCs();
    const npcCount = this.npcManager.getNPCCount();
    console.log(`🤖 Spawned ${npcCount} NPCs`);

    if (npcCount > 0) {
    } else {
    }

    this.isInitialized = true;
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

      // MVP 16: Skip Rock_02 (variant 2) due to floating/positioning issues
      const availableRockVariants = [1, 3, 4, 5]; // Exclude Rock_02
      objects.push({
        id: `rock-${Date.now()}-${i}`,
        type: "rock",
        x,
        y: 0,
        z,
        scale: 0.8 + Math.random() * 0.4,
        modelVariant: availableRockVariants[Math.floor(Math.random() * availableRockVariants.length)]
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

  /**
   * MVP 12: Update predator AI
   * Called every 100ms when players are active
   */
  private updatePredators(): void {
    // MVP 12: Build player data for predator AI (include score for rank-based targeting)
    const players = new Map<string, any>();
    this.activePlayers.forEach((player, id) => {
      players.set(id, {
        id,
        username: player.username,
        position: player.position,
        inventory: player.walnutInventory,
        score: player.score, // MVP 12: For rank-based targeting
        isPlayer: true // MVP 12: Distinguish players from NPCs
      });
    });

    // MVP 12: Build NPC data for predator AI (include spawn time for time-based targeting)
    const npcs = new Map<string, any>();
    this.npcManager.getAllNPCs().forEach(npc => {
      npcs.set(npc.id, {
        id: npc.id,
        username: `NPC_${npc.id.slice(0, 4)}`,
        position: npc.position,
        inventory: npc.walnutInventory || 0,
        spawnTime: (npc as any).spawnTime || 0, // MVP 12: For time-based targeting
        isPlayer: false // MVP 12: Distinguish NPCs from players
      });
    });

    // Simple terrain height function (flat ground at y=0 for server-side AI)
    // Client will render predators at correct height
    const getTerrainHeight = (_x: number, _z: number) => 0;

    // Update all predators
    this.predatorManager.update(0.1, players, npcs, getTerrainHeight); // 0.1s = 100ms

    // Broadcast predator state to all clients
    const predators = this.predatorManager.getPredators();
    if (predators.length > 0) {
      const message = {
        type: 'predators_update',
        predators: predators.map(p => ({
          id: p.id,
          type: p.type,
          position: p.position,
          rotationY: p.rotationY,
          state: p.state,
          targetId: p.targetId,
        })),
      };

      // Broadcast to all players
      this.broadcastToOthers('', message); // Empty string = don't exclude anyone
    }
  }

  /**
   * MVP 9: Drop a walnut from ONE random tree
   * Purpose: Replenish walnut supply when players/NPCs eat walnuts for health
   * Frequency: Called every 30s-2min
   */
  private async dropTreeWalnut(): Promise<void> {
    const trees = this.forestObjects.filter(obj => obj.type === 'tree');
    if (trees.length === 0) {
      console.warn('⚠️ No trees available for walnut drop');
      return;
    }

    // Select ONE random tree
    const randomTree = trees[Math.floor(Math.random() * trees.length)];

    // Create walnut at ground level under tree
    const walnutPosition = {
      x: randomTree.x,
      y: 0.3, // Ground level (same as other walnuts)
      z: randomTree.z
    };

    const walnutId = `tree-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add walnut to mapState so server can track pickup
    const treeWalnut: Walnut = {
      id: walnutId,
      ownerId: 'game',
      origin: 'game',
      hiddenIn: 'ground',
      location: walnutPosition,
      found: false,
      timestamp: Date.now(),
      isGolden: false
    };
    this.mapState.push(treeWalnut);

    // Broadcast drop event so clients can animate
    const treeCanopyHeight = 8 + (randomTree.scale * 2); // Approximate canopy height based on tree scale
    this.broadcastToAll({
      type: 'tree_walnut_drop',
      treePosition: {
        x: randomTree.x,
        y: treeCanopyHeight,
        z: randomTree.z
      },
      groundPosition: walnutPosition,
      walnutId: walnutId,
      ownerId: 'game'
    });

    // Save mapState with new tree walnut
    await this.storage.put('mapState', this.mapState);
  }

  /**
   * MVP 9: Drop multiple walnuts from a specific tree in rapid succession
   * Used when a tree grows from a hidden walnut
   */
  private async dropWalnutsFromTree(tree: ForestObject, count: number): Promise<void> {
    const DROP_INTERVAL_MS = 200; // 200ms between each drop for "rapid succession"
    const treeCanopyHeight = 8 + (tree.scale * 2); // Approximate canopy height based on tree scale

    for (let i = 0; i < count; i++) {
      // Wait between drops for rapid succession effect (except first drop)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DROP_INTERVAL_MS));
      }

      // Create walnut at ground level under tree
      const walnutPosition = {
        x: tree.x,
        y: 0.3, // Ground level (same as other walnuts)
        z: tree.z
      };

      const walnutId = `grown-tree-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add walnut to mapState so server can track pickup
      const treeWalnut: Walnut = {
        id: walnutId,
        ownerId: 'game',
        origin: 'game',
        hiddenIn: 'ground',
        location: walnutPosition,
        found: false,
        timestamp: Date.now(),
        isGolden: false
      };
      this.mapState.push(treeWalnut);

      // Broadcast drop event so clients can animate (same as regular tree drops)
      this.broadcastToAll({
        type: 'tree_walnut_drop',
        treePosition: {
          x: tree.x,
          y: treeCanopyHeight,
          z: tree.z
        },
        groundPosition: walnutPosition,
        walnutId: walnutId,
        ownerId: 'game'
      });

    }

    // Save mapState with all new walnuts
    await this.storage.put('mapState', this.mapState);
  }

  /**
   * MVP 9: Check for walnuts ready to grow into trees
   * Called every 20 seconds from alarm()
   */
  private async checkTreeGrowth(): Promise<void> {
    try {
      // Query WalnutRegistry for walnuts ready to grow
      const walnutRegistryId = this.env.WALNUTS.idFromName('global');
      const walnutRegistry = this.env.WALNUTS.get(walnutRegistryId);

      const response = await walnutRegistry.fetch(new Request('http://registry/check-growth', {
        method: 'POST'
      }));

      if (!response.ok) {
        console.error('Failed to check walnut growth:', await response.text());
        return;
      }

      const data = await response.json() as { walnuts: any[] };

      if (data.walnuts.length === 0) {
        return; // No walnuts ready to grow
      }

      // Process each walnut
      for (const walnut of data.walnuts) {
        await this.growWalnutIntoTree(walnut);
      }
    } catch (error) {
      console.error('Error checking tree growth:', error);
    }
  }

  /**
   * MVP 9: Grow a single walnut into a tree
   * Includes collision detection and placement logic
   */
  private async growWalnutIntoTree(walnut: any): Promise<void> {
    // MVP 13: RNG check - walnut only grows if random chance succeeds
    // If fails, walnut stays hidden forever (players can still pick it up)
    const roll = Math.random() * 100;
    if (roll > this.treeGrowthConfig.growthChance) {
      // RNG failed - walnut stays hidden, no tree growth
      return;
    }

    // Find suitable placement position (spiral search if original spot blocked)
    const treePosition = this.findTreePlacement(walnut.location);

    if (!treePosition) {
      console.warn(`Cannot grow walnut ${walnut.id} - no valid placement found`);
      return;
    }

    // Create new tree object
    const treeId = `grown-tree-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTree: ForestObject = {
      id: treeId,
      type: 'tree',
      x: treePosition.x,
      y: 0, // Always 0 - client will resample terrain height via raycasting
      z: treePosition.z,
      scale: 0.8 + Math.random() * 0.4, // 0.8-1.2 scale (varied sizes)
      modelVariant: 1 // Tree_01.glb
    };

    // Add to forest objects (now part of tree pool for walnut drops)
    this.forestObjects.push(newTree);
    await this.storage.put('forestObjects', this.forestObjects);

    // Remove walnut from mapState
    const walnutIndex = this.mapState.findIndex(w => w.id === walnut.id);
    if (walnutIndex !== -1) {
      this.mapState.splice(walnutIndex, 1);
      await this.storage.put('mapState', this.mapState);
    }

    // Mark walnut as grown in registry
    const walnutRegistryId = this.env.WALNUTS.idFromName('global');
    const walnutRegistry = this.env.WALNUTS.get(walnutRegistryId);
    await walnutRegistry.fetch(new Request('http://registry/mark-grown', {
      method: 'POST',
      body: JSON.stringify({ walnutId: walnut.id })
    }));

    // MVP 13: Increment trees grown counter
    this.metrics.treesGrownToday++;
    await this.storage.put('metrics', this.metrics);

    // Award points to owner (only if player is online)
    const ownerPlayer = this.activePlayers.get(walnut.ownerId);
    if (ownerPlayer) {
      ownerPlayer.score += this.treeGrowthConfig.pointsAwarded; // MVP 13: Configurable points

      // MVP 14: Increment tree growing counter (check bonus AFTER tree_grown broadcast)
      ownerPlayer.treesGrownCount++;

      // Report to leaderboard
      await this.reportScoreToLeaderboard(ownerPlayer);

      // Send score update to owner
      if (ownerPlayer.socket.readyState === WebSocket.OPEN) {
        try {
          ownerPlayer.socket.send(JSON.stringify({
            type: 'score_update',
            score: ownerPlayer.score,
            reason: 'tree_grown'
          }));
        } catch (error) {
          console.error(`Failed to send score update to ${walnut.ownerId}:`, error);
        }
      }
    }

    // Broadcast tree growth to all players (BEFORE bonus check for correct message order)
    this.broadcastToAll({
      type: 'tree_grown',
      tree: newTree,
      walnutId: walnut.id,
      ownerId: walnut.ownerId,
      originalPosition: walnut.location,
      newPosition: treePosition
    });

    // MVP 14: Check for tree growing bonus AFTER tree_grown broadcast
    // This ensures tree grows visually before bonus overlay appears
    if (ownerPlayer) {
      await this.checkTreeGrowingBonus(ownerPlayer);
    }

    // MVP 13: Drop configurable number of walnuts from newly grown tree
    await this.dropWalnutsFromTree(newTree, this.treeGrowthConfig.walnutsDropped);
  }

  /**
   * MVP 9: Find valid placement for new tree using spiral search
   * Returns null if no valid spot found within search radius
   */
  private findTreePlacement(preferredPosition: { x: number; y: number; z: number }): { x: number; y: number; z: number } | null {
    const TREE_MIN_DISTANCE = 3; // Minimum distance from other trees
    const ROCK_MIN_DISTANCE = 2; // Minimum distance from rocks
    const PLAYER_MIN_DISTANCE = 5; // Minimum distance from active players

    // Try preferred position first
    if (this.isPositionValidForTree(preferredPosition, TREE_MIN_DISTANCE, ROCK_MIN_DISTANCE, PLAYER_MIN_DISTANCE)) {
      return preferredPosition;
    }

    // Spiral search: Check distances 1, 2, 3, 4, 5 units in 8 compass directions
    const directions = [
      { x: 0, z: 1 },   // N
      { x: 1, z: 1 },   // NE
      { x: 1, z: 0 },   // E
      { x: 1, z: -1 },  // SE
      { x: 0, z: -1 },  // S
      { x: -1, z: -1 }, // SW
      { x: -1, z: 0 },  // W
      { x: -1, z: 1 }   // NW
    ];

    for (let radius = 1; radius <= 5; radius++) {
      for (const dir of directions) {
        const testPosition = {
          x: preferredPosition.x + (dir.x * radius),
          y: preferredPosition.y,
          z: preferredPosition.z + (dir.z * radius)
        };

        if (this.isPositionValidForTree(testPosition, TREE_MIN_DISTANCE, ROCK_MIN_DISTANCE, PLAYER_MIN_DISTANCE)) {
          return testPosition;
        }
      }
    }

    return null; // No valid position found
  }

  /**
   * MVP 9: Check if position is valid for tree placement
   */
  private isPositionValidForTree(
    position: { x: number; y: number; z: number },
    treeMinDist: number,
    rockMinDist: number,
    playerMinDist: number
  ): boolean {
    // Check distance from all forest objects
    for (const obj of this.forestObjects) {
      const distance = Math.sqrt(
        Math.pow(obj.x - position.x, 2) + Math.pow(obj.z - position.z, 2)
      );

      if (obj.type === 'tree' && distance < treeMinDist) {
        return false;
      }
      if ((obj.type === 'rock' || obj.type === 'stump') && distance < rockMinDist) {
        return false;
      }
    }

    // Check distance from active players
    for (const player of this.activePlayers.values()) {
      const distance = Math.sqrt(
        Math.pow(player.position.x - position.x, 2) + Math.pow(player.position.z - position.z, 2)
      );

      if (distance < playerMinDist) {
        return false;
      }
    }

    return true;
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

  /**
   * MVP 11: Add NPC-dropped walnuts to mapState and broadcast to all players
   * Called when NPC dies and drops inventory
   */
  async addNPCDroppedWalnuts(walnuts: any[]): Promise<void> {
    // Add to mapState
    for (const walnut of walnuts) {
      this.mapState.push(walnut);
    }

    // Persist to storage
    await this.storage.put('mapState', this.mapState);

    // Broadcast to all players
    for (const walnut of walnuts) {
      this.activePlayers.forEach((player) => {
        this.sendMessage(player.socket, {
          type: 'walnut_dropped',
          walnutId: walnut.id,
          position: walnut.location
        });
      });
    }
  }

  /**
   * Server-side collision detection for player vs player/NPC collisions
   * Applies damage to BOTH parties when they collide
   */
  private checkCollisions(movingPlayer: PlayerConnection): void {
    const now = Date.now();
    const COLLISION_RADIUS = 1.5; // Match client-side collision radius
    const COLLISION_DAMAGE = 10; // Match client-side damage
    const COLLISION_DAMAGE_COOLDOWN = 2000; // 2 seconds between collision damage

    // Check cooldown for moving player
    if (now - movingPlayer.lastCollisionDamageTime < COLLISION_DAMAGE_COOLDOWN) {
      return; // Still on cooldown
    }

    // Check invulnerability for moving player
    if (movingPlayer.invulnerableUntil && now < movingPlayer.invulnerableUntil) {
      return; // Moving player is invulnerable
    }

    const movingPos = movingPlayer.position;

    // Check collisions with other players
    for (const [otherId, otherPlayer] of this.activePlayers) {
      if (otherId === movingPlayer.squirrelId) continue; // Skip self

      // Check cooldown for other player
      if (now - otherPlayer.lastCollisionDamageTime < COLLISION_DAMAGE_COOLDOWN) {
        continue; // Other player on cooldown
      }

      // Check invulnerability for other player
      if (otherPlayer.invulnerableUntil && now < otherPlayer.invulnerableUntil) {
        continue; // Other player is invulnerable
      }

      const otherPos = otherPlayer.position;
      const dx = movingPos.x - otherPos.x;
      const dz = movingPos.z - otherPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < COLLISION_RADIUS) {
        // Collision detected! Apply damage to BOTH players
        this.applyCollisionDamage(movingPlayer, otherPlayer);
        movingPlayer.lastCollisionDamageTime = now;
        otherPlayer.lastCollisionDamageTime = now;
        return; // Only one collision per update
      }
    }

    // Check collisions with NPCs
    if (this.npcManager) {
      const npcs = this.npcManager.getAllNPCs();
      for (const npc of npcs) {
        // Check NPC cooldown
        if (now - npc.lastCollisionDamageTime < COLLISION_DAMAGE_COOLDOWN) {
          continue;
        }

        const npcPos = npc.position;
        const dx = movingPos.x - npcPos.x;
        const dz = movingPos.z - npcPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance < COLLISION_RADIUS) {
          // Collision detected! Apply damage to BOTH player and NPC
          this.applyCollisionDamageToNPC(movingPlayer, npc);
          movingPlayer.lastCollisionDamageTime = now;
          npc.lastCollisionDamageTime = now;
          return; // Only one collision per update
        }
      }
    }
  }

  /**
   * Apply collision damage to both players
   */
  private applyCollisionDamage(player1: PlayerConnection, player2: PlayerConnection): void {
    const COLLISION_DAMAGE = 10;

    // Damage player 1
    player1.health = Math.max(0, player1.health - COLLISION_DAMAGE);
    player1.lastAttackerId = player2.squirrelId;

    // Damage player 2
    player2.health = Math.max(0, player2.health - COLLISION_DAMAGE);
    player2.lastAttackerId = player1.squirrelId;

    // Broadcast damage to both players
    this.broadcastToAll({
      type: 'entity_damaged',
      targetId: player1.squirrelId,
      attackerId: player2.squirrelId,
      damage: COLLISION_DAMAGE,
      newHealth: player1.health
    });

    this.broadcastToAll({
      type: 'entity_damaged',
      targetId: player2.squirrelId,
      attackerId: player1.squirrelId,
      damage: COLLISION_DAMAGE,
      newHealth: player2.health
    });

    // Check for deaths
    if (player1.health <= 0) {
      this.handlePlayerDeath(player1, player2);
    }
    if (player2.health <= 0) {
      this.handlePlayerDeath(player2, player1);
    }
  }

  /**
   * Apply collision damage between player and NPC
   */
  private async applyCollisionDamageToNPC(player: PlayerConnection, npc: any): Promise<void> {
    const COLLISION_DAMAGE = 10;

    // Damage player
    player.health = Math.max(0, player.health - COLLISION_DAMAGE);
    player.lastAttackerId = npc.id;

    // Damage NPC (via NPCManager) - broadcasts damage automatically
    if (this.npcManager) {
      this.npcManager.damageNPC(npc.id, COLLISION_DAMAGE, player.squirrelId);
    }

    // Broadcast damage to player
    this.broadcastToAll({
      type: 'entity_damaged',
      targetId: player.squirrelId,
      attackerId: npc.id,
      damage: COLLISION_DAMAGE,
      newHealth: player.health
    });

    // Check for player death (killed by NPC)
    if (player.health <= 0) {
      // Can't use handlePlayerDeath since killer is NPC, not PlayerConnection
      // Handle death manually
      player.score = Math.max(0, player.score - 2);
      player.combatStats.deaths += 1;
      await this.reportScoreToLeaderboard(player);

      // Drop walnuts
      const droppedWalnuts = player.walnutInventory;
      if (droppedWalnuts > 0) {
        try {
          for (let i = 0; i < droppedWalnuts; i++) {
            const walnutId = `death-drop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const walnut: Walnut = {
              id: walnutId,
              ownerId: 'game',
              origin: 'game',
              hiddenIn: 'ground',
              location: {
                x: player.position.x + (Math.random() - 0.5) * 2,
                y: player.position.y,
                z: player.position.z + (Math.random() - 0.5) * 2
              },
              found: false,
              timestamp: Date.now()
            };

            this.mapState.push(walnut);
            this.activePlayers.forEach((p) => {
              this.sendMessage(p.socket, {
                type: 'walnut_dropped',
                walnutId: walnut.id,
                position: walnut.location
              });
            });
          }
          await this.storage.put('mapState', this.mapState);
          player.walnutInventory = 0;
        } catch (error) {
          console.error(`❌ Failed to drop walnuts for ${player.username}:`, error);
        }
      }

      // Broadcast death
      this.broadcastToAll({
        type: 'player_death',
        victimId: player.squirrelId,
        killerId: npc.id,
        deathPosition: player.position
      });

      // Respawn after 3 seconds
      setTimeout(async () => {
        const spawnPoints = [
          { x: 0, z: 10 }, { x: 10, z: 0 }, { x: -10, z: 0 }, { x: 0, z: -10 },
          { x: 15, z: 15 }, { x: -15, z: 15 }, { x: 15, z: -15 }, { x: -15, z: -15 }
        ];
        const randomSpawn = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];

        player.position = { x: randomSpawn.x, y: 2, z: randomSpawn.z };
        player.health = player.maxHealth;
        player.lastAttackerId = null;
        player.invulnerableUntil = Date.now() + 3000;

        this.broadcastToAll({
          type: 'player_respawn',
          playerId: player.squirrelId,
          position: player.position,
          health: player.health,
          walnutInventory: player.walnutInventory
        });
      }, 3000);
    }
  }
}
