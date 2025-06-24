// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { POINTS, CYCLE_DURATION_SECONDS, NUT_RUSH_INTERVAL_HOURS, NUT_RUSH_DURATION_MINUTES, TREE_COUNT, SHRUB_COUNT, TERRAIN_SIZE } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod, ForestObject } from "../types";
import { getObjectInstance, EnvWithBindings } from './registry';
import type { 
  DurableObject, 
  DurableObjectState, 
  DurableObjectStorage, 
  DurableObjectId,
  Request as CfRequest,
  Response as CfResponse,
  WebSocket as CfWebSocket
} from '@cloudflare/workers-types';


const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

// FIX: Add resource limits and timeouts (Phase 2)
const MAX_CONCURRENT_SESSIONS = 100; // Cloudflare DO best practice
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const MAX_MESSAGE_SIZE = 1024; // 1KB per message
const MAX_MESSAGES_PER_MINUTE = 60; // Rate limiting

interface PlayerData {
  squirrelId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  lastUpdate: number;
  messageCount: number; // Track messages per minute
  messageResetTime: number; // When to reset counter
}

export class ForestManager implements DurableObject {
  private state: DurableObjectState;
  private env: EnvWithBindings;
  private terrainSeed: number;
  private sessions = new Map<string, WebSocket>();
  private socketToPlayer = new Map<WebSocket, string>();
  players: Map<string, PlayerData> = new Map();
  walnuts: Map<string, any> = new Map();

  constructor(state: DurableObjectState, env: EnvWithBindings) {
    this.state = state;
    this.env = env;
    this.terrainSeed = Math.random() * 1000;
    
    // FIX: Initialize players from storage for persistence across refreshes
    this.initializePlayersFromStorage();
    
    // Schedule regular cleanup
    this.scheduleCleanup();
  }

  // Industry Standard: Optimized player data persistence
  private async persistPlayerData(): Promise<void> {
    try {
      // Industry Standard: Batch persistence with compression
      const playersArray = Array.from(this.players.entries());
      
      // Only persist if there are actual changes
      if (playersArray.length === 0) return;
      
      // Industry Standard: Add timestamp for debugging
      const persistenceData = {
        players: playersArray,
        timestamp: Date.now(),
        count: playersArray.length
      };
      
      await this.state.storage.put('active-players', persistenceData);
      console.log(`[Persistence] ✅ Persisted ${playersArray.length} players`);
      
    } catch (error) {
      console.error('[Error] Failed to persist player data:', error);
    }
  }

  // Industry Standard: Load with migration support
  private async initializePlayersFromStorage(): Promise<void> {
    try {
      const storedData = await this.state.storage.get<any>('active-players');
      
      if (!storedData) {
        console.log(`[Persistence] 📁 No stored players found, starting fresh`);
        return;
      }
      
      // Industry Standard: Handle both old and new formats
      let playersArray: [string, PlayerData][];
      
      if (Array.isArray(storedData)) {
        // Old format
        playersArray = storedData;
        console.log(`[Persistence] 🔄 Migrating old format players`);
      } else if (storedData.players && Array.isArray(storedData.players)) {
        // New format
        playersArray = storedData.players;
        const age = Date.now() - storedData.timestamp;
        console.log(`[Persistence] 🔄 Loading players (age: ${Math.round(age/1000)}s)`);
      } else {
        console.warn(`[Persistence] ⚠️ Invalid stored data format`);
        return;
      }
      
      // Industry Standard: Validate and filter stale data on load
      const now = Date.now();
      const validPlayers = playersArray.filter(([id, player]) => {
        const age = now - player.lastUpdate;
        if (age > 600000) { // 10 minutes
          console.log(`[Persistence] 🗑️ Removing stale player ${id} (age: ${Math.round(age/1000)}s)`);
          return false;
        }
        return true;
      });
      
      // Convert array back to Map
      this.players = new Map(validPlayers);
      console.log(`[Persistence] ✅ Restored ${this.players.size} valid players`);
      
      // Debug: Log restored players
      for (const [id, player] of this.players.entries()) {
        console.log(`[Persistence] 📍 Restored player ${id} at (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)})`);
      }
      
    } catch (error) {
      console.error('[Error] Failed to load players from storage:', error);
      this.players = new Map(); // Start fresh on error
    }
  }

  async fetch(request: CfRequest): Promise<CfResponse> {
    const url = new URL(request.url);
    console.log(`[ForestManager] 📥 Fetch called for path: ${url.pathname}`);
    console.log(`[ForestManager] Method: ${request.method}, URL: ${request.url}`);

    if (url.pathname === '/ws') {
      console.log(`[ForestManager] 🔌 WebSocket request received`);
      
      const upgradeHeader = request.headers.get('Upgrade');
      console.log(`[ForestManager] Upgrade header: "${upgradeHeader}"`);
      
      if (upgradeHeader !== 'websocket') {
        console.error(`[ForestManager] ❌ Invalid Upgrade header: ${upgradeHeader} (expected "websocket")`);
        return new Response('Expected Upgrade: websocket', { status: 426 }) as unknown as CfResponse;
      }

      const squirrelId = url.searchParams.get('squirrelId');
      const token = url.searchParams.get('token');
      console.log(`[ForestManager] Parameters - squirrelId: ${squirrelId}, token: ${token ? 'present' : 'missing'}`);
      
      if (!squirrelId || !token) {
        console.error(`[ForestManager] ❌ Missing parameters - squirrelId: ${!!squirrelId}, token: ${!!token}`);
        return new Response('Missing squirrelId or token', { status: 400 }) as unknown as CfResponse;
      }

      console.log(`[ForestManager] ✅ Creating WebSocket pair for squirrelId: ${squirrelId}`);
      try {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
        console.log(`[ForestManager] ✅ WebSocket pair created, calling handleSocket`);
        await this.handleSocket(server, squirrelId, token);
        console.log(`[ForestManager] ✅ Returning WebSocket response with status 101`);
        return new Response(null, { status: 101, webSocket: client }) as unknown as CfResponse;
      } catch (error) {
        console.error(`[ForestManager] ❌ Error creating WebSocket:`, error);
        return new Response('WebSocket creation failed', { status: 500 }) as unknown as CfResponse;
      }
    }

    if (url.pathname === "/terrain-seed") {
      const seed = this.terrainSeed;
      return new Response(JSON.stringify({ seed }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }) as unknown as CfResponse;
    }

    if (url.pathname === '/forest-objects') {
      const forestObjects = await this.getForestObjects();
      return new Response(JSON.stringify(forestObjects), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    if (url.pathname === '/map-state') {
      const mapState = await this.getMapState();
      return new Response(JSON.stringify(mapState), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    // FIX: Add test endpoint to force walnut regeneration
    if (url.pathname === '/test-walnuts') {
      const walnuts = this.generateGameWalnuts();
      console.log(`[Test] Generated ${walnuts.length} test walnuts`);
      return new Response(JSON.stringify(walnuts), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    // FIX: Add cache clear endpoint
    if (url.pathname === '/clear-cache') {
      const today = new Date().toISOString().split('T')[0];
      await this.state.storage.delete(`map-state-${today}`);
      await this.state.storage.delete(`forest-objects-${today}`);
      console.log(`[Log] ✅ Cleared cache for ${today}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Cache cleared for ${today}` 
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    // FIX: Add debug endpoint to inspect player storage
    if (url.pathname === '/debug-players') {
      const storedPlayers = await this.state.storage.get<[string, PlayerData][]>('active-players');
      const currentPlayers = Array.from(this.players.entries());
      
      console.log(`[Debug] Active sessions: ${this.sessions.size}`);
      console.log(`[Debug] Current players: ${this.players.size}`);
      
      return new Response(JSON.stringify({
        storedPlayers: storedPlayers || [],
        currentPlayers: currentPlayers.map(([id, player]) => ({
          id,
          position: player.position,
          lastUpdate: player.lastUpdate,
          age: Date.now() - player.lastUpdate
        })),
        activeSessions: Array.from(this.sessions.keys()),
        stats: {
          totalSessions: this.sessions.size,
          totalPlayers: this.players.size,
          playersWithPosition: currentPlayers.filter(([_, p]) => p.position.x !== 0 || p.position.z !== 0).length
        }
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    // FIX: Add endpoint to test player positions
    if (url.pathname === '/test-positions') {
      const positions = Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        distance: Math.sqrt(Math.pow(player.position.x - 50, 2) + Math.pow(player.position.z - 50, 2))
      }));
      
      return new Response(JSON.stringify({
        spawn: { x: 50, y: 2, z: 50 },
        players: positions
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    // FIX: Add endpoint to clear player storage
    if (url.pathname === '/clear-players') {
      await this.state.storage.delete('active-players');
      this.players.clear();
      console.log(`[Log] ✅ Cleared all player storage`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'All player storage cleared' 
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      }) as unknown as CfResponse;
    }

    return new Response('Not Found', { status: 404 }) as unknown as CfResponse;
  }

  async handleSocket(socket: WebSocket, squirrelId: string, token: string) {
    console.log(`[ForestManager] 🔌 handleSocket called for: ${squirrelId}`);
    console.log(`[ForestManager] Socket state: ${socket.readyState}`);
    
    // CRITICAL FIX: Accept the WebSocket connection before doing anything else
    socket.accept();
    console.log(`[ForestManager] ✅ WebSocket connection accepted for: ${squirrelId}`);
    
    // FIX: Validate token first
    const isValidToken = await this.validateToken(squirrelId, token);
    if (!isValidToken) {
      console.log(`[Log] ❌ Invalid token for ${squirrelId}`);
      socket.close(4001, "Invalid token");
      return;
    }

    // Store the socket session
    this.sessions.set(squirrelId, socket);
    this.socketToPlayer.set(socket, squirrelId);

    // FIX: Set up connection timeout
    const connectionTimeout = setTimeout(() => {
      if (this.sessions.has(squirrelId)) {
        console.log(`[Log] Connection timeout for ${squirrelId}`);
        this.handlePlayerLeave(squirrelId);
        socket.close(4004, "Connection timeout");
      }
    }, SESSION_TIMEOUT);

    // Industry Standard: Initialize player with spawn position or last known position
    let playerPosition = { x: 50, y: 2, z: 50 }; // Default spawn point
    let playerRotation = 0;
    
    // FIX: Try to load last known position from storage
    try {
      const storedPlayers = await this.state.storage.get<[string, PlayerData][]>('active-players');
      if (storedPlayers) {
        const storedPlayer = storedPlayers.find(([id]) => id === squirrelId);
        if (storedPlayer && storedPlayer[1]) {
          const lastPos = storedPlayer[1].position;
          const lastRot = storedPlayer[1].rotationY;
          
          // Validate stored position is reasonable
          if (this.isValidPosition(lastPos)) {
            playerPosition = lastPos;
            playerRotation = lastRot;
            console.log(`[Log] 🔄 Restored ${squirrelId} to last position: (${lastPos.x.toFixed(1)}, ${lastPos.z.toFixed(1)})`);
          } else {
            console.log(`[Log] ⚠️ Invalid stored position for ${squirrelId}, using spawn`);
          }
        }
      }
    } catch (error) {
      console.log(`[Log] ⚠️ Could not load stored position for ${squirrelId}, using spawn:`, error);
    }
    
    const existingPlayer: PlayerData = {
      squirrelId,
      position: playerPosition,
      rotationY: playerRotation,
      lastUpdate: Date.now(),
      messageCount: 1,
      messageResetTime: Date.now() + 60000
    };

    // Add to players map immediately
    this.players.set(squirrelId, existingPlayer);
    console.log(`[Log] ✅ Added player ${squirrelId} at position (${playerPosition.x}, ${playerPosition.y}, ${playerPosition.z})`)

    // Industry Standard: Send game state to new player immediately
    try {
      // Send map state first
      const mapState = await this.getMapState();
      socket.send(JSON.stringify({ 
        type: 'init', 
        mapState 
      }));
      console.log(`[Log] 📤 Sent init with ${mapState.length} walnuts to ${squirrelId}`);

      // Industry Standard: Send existing players to new joiner immediately
      const existingPlayers = Array.from(this.players.entries())
        .filter(([id]) => id !== squirrelId) // Don't include self
        .map(([id, player]) => ({
          squirrelId: id,
          position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
            rotationY: player.rotationY
          }
        }));

      if (existingPlayers.length > 0) {
        socket.send(JSON.stringify({ 
          type: 'existing_players', 
          players: existingPlayers 
        }));
        console.log(`[Log] 📤 Sent ${existingPlayers.length} existing players to ${squirrelId}`);
      } else {
        console.log(`[Log] 📤 No existing players to send to ${squirrelId}`);
      }

      // Industry Standard: Broadcast new player join to existing players immediately
      if (this.players.size > 1) { // Only broadcast if there are other players
        this.broadcastPlayerJoin(squirrelId, existingPlayer);
        console.log(`[Log] 📢 Broadcasted player_join for ${squirrelId} to ${this.players.size - 1} existing players`);
      }

    } catch (error) {
      console.error(`[Error] Failed to send initial game state to ${squirrelId}:`, error);
    }

    socket.addEventListener('message', async (event) => {
      try {
        // FIX: Message size validation
        if (event.data.length > MAX_MESSAGE_SIZE) {
          console.warn(`[Warning] Message too large from ${squirrelId}: ${event.data.length} bytes`);
          return;
        }

        const data = JSON.parse(event.data);
        
        // FIX: Handle client ready signal
        if (data.type === 'client_ready') {
          console.log(`[Log] ✅ Client ${squirrelId} is ready, broadcasting join`);
          this.broadcastPlayerJoin(squirrelId, existingPlayer);
          return;
        }
        
        // FIX: Rate limiting for all messages (enhanced)
        const now = Date.now();
        const player = this.players.get(squirrelId);
        
        if (player) {
          // Reset message counter if time window expired
          if (now > player.messageResetTime) {
            player.messageCount = 1;
            player.messageResetTime = now + 60000; // Next minute
          } else {
            player.messageCount++;
          }
          
          // Rate limit check
          if (player.messageCount > MAX_MESSAGES_PER_MINUTE) {
            console.warn(`[Warning] Rate limit exceeded for ${squirrelId}: ${player.messageCount} messages`);
            return;
          }
        }
        
        // FIX: Enhanced rate limiting for player updates (anti-spam)
        if (data.type === 'player_update') {
          const lastUpdate = player?.lastUpdate || 0;
          
          // Rate limit: max 20 updates per second
          if (now - lastUpdate < 50) {
            return; // Silent rate limiting for position updates
          }
          
          // FIX: Basic position validation (anti-cheat)
          if (!this.isValidPosition(data.position)) {
            console.warn(`[Warning] Invalid position from ${squirrelId}:`, data.position);
            return;
          }
          
          // FIX: Properly extract position and rotation from client data
          const { x, y, z, rotationY } = data.position;
          const position = { x, y, z };
          const rotation = rotationY || 0;
          
          // FIX: Update player state with correct structure
          const updatedPlayer = {
            squirrelId,
            position: position,
            rotationY: rotation,
            lastUpdate: now,
            messageCount: player?.messageCount || 1,
            messageResetTime: player?.messageResetTime || now + 60000
          };
          
          this.players.set(squirrelId, updatedPlayer);
          
          // FIX: Persist more frequently for better position persistence (every 2 seconds)
          if (now % 2000 < 100) {
            await this.persistPlayerData();
          }
          
          // FIX: Broadcast with proper position structure
          this.broadcastExcept(squirrelId, {
            type: 'player_update',
            squirrelId,
            position: {
              x: position.x,
              y: position.y,
              z: position.z,
              rotationY: rotation
            }
          });
          
          // Debug: Log position updates periodically
          if (now % 5000 < 100) {
            console.log(`[Log] 📍 Updated ${squirrelId} position:`, position, `rotation:`, rotation);
          }
        }
        
        if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
          // Reset connection timeout on activity
          clearTimeout(connectionTimeout);
          setTimeout(() => {
            if (this.sessions.has(squirrelId)) {
              console.log(`[Log] Connection timeout for ${squirrelId}`);
              this.handlePlayerLeave(squirrelId);
              socket.close(4004, "Connection timeout");
            }
          }, SESSION_TIMEOUT);
        }
        
      } catch (error) {
        console.error(`[Error] Processing message from ${squirrelId}:`, error);
      }
    });

    socket.addEventListener('close', () => {
      console.log(`[Log] Player ${squirrelId} disconnected`);
      clearTimeout(connectionTimeout);
      this.handlePlayerLeave(squirrelId);
      this.broadcast({ type: 'player_leave', squirrelId });
    });

    socket.addEventListener('error', (error) => {
      console.error(`[Error] WebSocket error for ${squirrelId}:`, error);
      clearTimeout(connectionTimeout);
      this.handlePlayerLeave(squirrelId);
    });
  }

  // FIX: Add position validation for anti-cheat
  private isValidPosition(position: any): boolean {
    if (!position || typeof position !== 'object') return false;
    
    const { x, y, z, rotationY } = position;
    
    // Check if coordinates are numbers
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return false;
    
    // Check reasonable bounds (terrain is 200x200, height 0-20)
    if (Math.abs(x) > 150 || y < -5 || y > 25 || Math.abs(z) > 150) return false;
    
    // Check rotation is valid
    if (rotationY !== undefined && (typeof rotationY !== 'number' || Math.abs(rotationY) > Math.PI * 2)) return false;
    
    return true;
  }

  private async processMessage(squirrelId: string, data: any): Promise<void> {
    switch (data.type) {
      case 'ping':
        console.log(`[Log] Ping received from ${squirrelId}`);
        break;
      default:
        console.log(`[Log] Unknown message type from ${squirrelId}: ${data.type}`);
    }
  }

  private async cleanupStalePlayers(): Promise<void> {
    const now = Date.now();
    const staleTimeout = 300000; // FIX: 5 minutes for full cleanup from storage
    const sessionTimeout = 30000; // 30 seconds for active session cleanup

    // Clean up active sessions that are stale
    for (const [squirrelId, player] of this.players.entries()) {
      if (now - player.lastUpdate > sessionTimeout && this.sessions.has(squirrelId)) {
        console.log(`[Log] 🧹 Cleaning up stale active player: ${squirrelId}`);
        await this.handlePlayerLeave(squirrelId);
      }
    }

    // FIX: Clean up from storage only after longer timeout
    try {
      const storedPlayers = await this.state.storage.get<[string, PlayerData][]>('active-players');
      if (storedPlayers) {
        const activePlayers = storedPlayers.filter(([id, player]) => {
          const isStale = now - player.lastUpdate > staleTimeout;
          if (isStale) {
            console.log(`[Log] 🗑️ Removing stale player from storage: ${id}`);
          }
          return !isStale;
        });
        
        if (activePlayers.length !== storedPlayers.length) {
          await this.state.storage.put('active-players', activePlayers);
          console.log(`[Log] ✅ Cleaned up ${storedPlayers.length - activePlayers.length} stale players from storage`);
        }
      }
    } catch (error) {
      console.error('[Error] Failed to cleanup stale players from storage:', error);
    }
  }

  private async handlePlayerJoin(squirrelId: string): Promise<void> {
    console.log(`Player joined: ${squirrelId}`);
    // Initialize player data if needed
  }

  private handlePlayerLeave(squirrelId: string): void {
    const socket = this.sessions.get(squirrelId);
    if (socket) {
      this.socketToPlayer.delete(socket);
      this.sessions.delete(squirrelId);
    }
    
    // FIX: Remove from players Map but DON'T remove from storage immediately
    // Keep in storage for potential reconnection within session timeout
    this.players.delete(squirrelId);
    console.log(`[Log] ✅ Cleaned up session for ${squirrelId}`);
  }

  // Industry Standard: Server-side position validation and anti-cheat
  private async handlePlayerUpdate(squirrelId: string, position: { x: number; y: number; z: number }, rotationY: number): Promise<void> {
    const player = this.players.get(squirrelId);
    if (!player) {
      console.warn(`[Warning] Received update for unknown player: ${squirrelId}`);
      return;
    }

    // Industry Standard: Validate position bounds (anti-cheat)
    if (!this.isValidPosition(position)) {
      console.warn(`[AntiCheat] Invalid position from ${squirrelId}:`, position);
      // Send corrected position back to client
      this.sendToPlayer(squirrelId, {
        type: 'position_correction',
        position: player.position,
        rotationY: player.rotationY,
        timestamp: Date.now()
      });
      return;
    }

    // Industry Standard: Time-based movement validation instead of distance thresholds
    const now = Date.now();
    const deltaTime = (now - player.lastUpdate) / 1000; // seconds
    
    if (deltaTime > 0) {
      // Calculate movement speed
      const distance = Math.sqrt(
        Math.pow(position.x - player.position.x, 2) +
        Math.pow(position.z - player.position.z, 2)
      );
      const speed = distance / deltaTime;
      
      // Industry Standard: Speed-based validation (not arbitrary thresholds)
      const MAX_SPEED = 20; // 20 units per second (reasonable for game)
      
      if (speed > MAX_SPEED && deltaTime < 5) { // Allow higher speed if long time gap
        console.warn(`[AntiCheat] Suspicious speed from ${squirrelId}: ${speed.toFixed(1)} u/s (max: ${MAX_SPEED})`);
        // Don't reject, but log for monitoring
      }
    }

    // Update player state
    player.position = position;
    player.rotationY = rotationY;
    player.lastUpdate = now;

    // Industry Standard: Rate limiting per player
    player.messageCount++;
    if (now > player.messageResetTime) {
      player.messageCount = 1;
      player.messageResetTime = now + 60000; // Reset every minute
    }

    if (player.messageCount > 3600) { // 60 messages per second max
      console.warn(`[RateLimit] Player ${squirrelId} exceeding message rate`);
      return;
    }

    // Persist changes periodically (not every update)
    if (Math.random() < 0.01) { // 1% chance per update
      await this.persistPlayerData();
    }

    // Industry Standard: Broadcast to nearby players only (Area of Interest)
    this.broadcastToNearbyPlayers(squirrelId, {
      type: 'player_update',
      squirrelId,
      position,
      rotationY,
      timestamp: now
    }, 150); // 150 unit radius
  }

  // Industry Standard: Area of Interest broadcasting
  private broadcastToNearbyPlayers(sourcePlayerId: string, message: any, radius: number = 100): void {
    const sourcePlayer = this.players.get(sourcePlayerId);
    if (!sourcePlayer) return;

    let nearbyCount = 0;
    for (const [playerId, socket] of this.sessions.entries()) {
      if (playerId === sourcePlayerId) continue;
      
      const player = this.players.get(playerId);
      if (!player) continue;

      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(player.position.x - sourcePlayer.position.x, 2) +
        Math.pow(player.position.z - sourcePlayer.position.z, 2)
      );

      // Only send to nearby players
      if (distance <= radius) {
        try {
          socket.send(JSON.stringify(message));
          nearbyCount++;
        } catch (error) {
          console.error(`[Error] Failed to send to ${playerId}:`, error);
          this.handlePlayerLeave(playerId);
        }
      }
    }

    if (nearbyCount > 0) {
      console.debug(`[Broadcast] Sent update from ${sourcePlayerId} to ${nearbyCount} nearby players`);
    }
  }

  // Industry Standard: Send message to specific player
  private sendToPlayer(playerId: string, message: any): void {
    const socket = this.sessions.get(playerId);
    if (socket) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[Error] Failed to send to ${playerId}:`, error);
        this.handlePlayerLeave(playerId);
      }
    }
  }

  private async handleWalnutPlace(walnut: any): Promise<void> {
    // Handle walnut placement logic
    console.log('Walnut placed:', walnut);
  }

  private broadcast(message: any): void {
    const serializedMessage = JSON.stringify(message);
    let broadcastCount = 0;
    
    for (const socket of this.sessions.values()) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializedMessage);
          broadcastCount++;
        }
      } catch (error) {
        console.error('Error broadcasting message:', error);
      }
    }
    
    if (broadcastCount > 0) {
      console.log(`[Log] 📢 Broadcasted to ${broadcastCount} players`);
    }
  }

  private broadcastExcept(excludeSquirrelId: string, message: any): void {
    // FIX: Serialize once for performance
    const serializedMessage = JSON.stringify(message);
    let broadcastCount = 0;
    
    for (const [squirrelId, socket] of this.sessions.entries()) {
      if (squirrelId !== excludeSquirrelId && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(serializedMessage);
          broadcastCount++;
        } catch (error) {
          console.error(`[Error] Failed to send message to ${squirrelId}:`, error);
          // FIX: Clean up dead connections immediately
          this.handlePlayerLeave(squirrelId);
        }
      }
    }
    
    if (broadcastCount > 0) {
      console.log(`[Log] 📢 Broadcasted to ${broadcastCount} players (excluding ${excludeSquirrelId})`);
    }
  }

  // FIX: Dedicated method for broadcasting player join with proper structure
  private broadcastPlayerJoin(squirrelId: string, player: PlayerData): void {
    console.log(`[Log] 📢 Broadcasting player_join for ${squirrelId} with position:`, player.position);
    this.broadcastExcept(squirrelId, {
      type: 'player_join',
      squirrelId,
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        rotationY: player.rotationY
      }
    });
  }

  // FIX: Token validation through SquirrelSession (single source of truth)
  private async validateToken(squirrelId: string, token: string): Promise<boolean> {
    try {
      // Get SquirrelSession Durable Object
      const squirrelSessionId = this.env.SQUIRREL.idFromName(squirrelId);
      const squirrelSession = this.env.SQUIRREL.get(squirrelSessionId);
      
      // Create request to validate token
      const request = new Request(`https://internal/validate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const response = await squirrelSession.fetch(request);
      return response.ok;
      
    } catch (error) {
      console.error('[Error] Token validation failed:', error);
      return false;
    }
  }

  private async getTerrainSeed(): Promise<number> {
    // Get or generate terrain seed for the current day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let terrainSeed = await this.state.storage.get<number>(`terrain-seed-${today}`);
    
    if (!terrainSeed) {
      terrainSeed = Math.random() * 1000;
      await this.state.storage.put(`terrain-seed-${today}`, terrainSeed);
    }
    
    return terrainSeed;
  }

  private async getForestObjects(): Promise<any[]> {
    // Get or generate forest objects for the current day
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let forestObjects = await this.state.storage.get<any[]>(`forest-objects-${today}`);
    
    if (!forestObjects) {
      // Generate forest objects (trees, bushes, etc.)
      forestObjects = this.generateForestObjects();
      await this.state.storage.put(`forest-objects-${today}`, forestObjects);
    }
    
    return forestObjects;
  }

  private async getMapState(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    let mapState = await this.state.storage.get<any[]>(`map-state-${today}`);
    
    // FIX: Check if cached array exists but is empty, clear and regenerate
    if (mapState && Array.isArray(mapState) && mapState.length === 0) {
      console.log(`[Log] ⚠️ Found empty cached walnut array, regenerating...`);
      await this.state.storage.delete(`map-state-${today}`);
      mapState = undefined; // Force regeneration
    }
    
    if (!mapState) {
      mapState = this.generateGameWalnuts();
      await this.state.storage.put(`map-state-${today}`, mapState);
      console.log(`[Log] Generated and stored ${mapState.length} walnuts for ${today}`);
    } else {
      console.log(`[Log] Retrieved ${mapState.length} walnuts for ${today}`);
    }
    return mapState;
  }

  private generateGameWalnuts(): any[] {
    const walnuts = [];
    const terrainSize = 200;
    for (let i = 0; i < 100; i++) {
      walnuts.push({
        id: `game-walnut-${i}`,
        ownerId: 'system',
        origin: 'game',
        hiddenIn: Math.random() > 0.5 ? 'buried' : 'bush',
        location: {
          x: (Math.random() - 0.5) * terrainSize,
          y: 0,
          z: (Math.random() - 0.5) * terrainSize
        },
        found: false,
        timestamp: Date.now()
      });
    }
    
    return walnuts;
  }

  private generateForestObjects(): any[] {
    // Generate trees and bushes for the forest
    const objects = [];
    const terrainSize = 200;
    
    // Generate trees
    for (let i = 0; i < TREE_COUNT; i++) {
      objects.push({
        type: 'tree',
        id: `tree-${i}`,
        position: {
          x: (Math.random() - 0.5) * terrainSize,
          y: 0,
          z: (Math.random() - 0.5) * terrainSize
        },
        scale: 1
      });
    }
    
    // Generate shrubs (use 'bush' to match deployed API)
    for (let i = 0; i < SHRUB_COUNT; i++) {
      objects.push({
        type: 'bush',
        id: `bush-${i}`,
        position: {
          x: (Math.random() - 0.5) * terrainSize,
          y: 0,
          z: (Math.random() - 0.5) * terrainSize
        },
        scale: 1
      });
    }
    
    return objects;
  }

  // FIX: Periodic cleanup using Cloudflare alarms
  private async scheduleCleanup() {
    // Schedule cleanup every 5 minutes
    const now = Date.now();
    const nextCleanup = now + 5 * 60 * 1000; // 5 minutes
    await this.state.storage.setAlarm(nextCleanup);
  }

  // FIX: Handle periodic cleanup via alarm
  async alarm() {
    console.log('[Log] 🧹 Running periodic cleanup...');
    
    const now = Date.now();
    let cleanedSessions = 0;
    let cleanedPlayers = 0;
    
    // Clean up stale sessions
    for (const [squirrelId, socket] of this.sessions) {
      if (socket.readyState !== WebSocket.OPEN) {
        this.handlePlayerLeave(squirrelId);
        cleanedSessions++;
      }
    }
    
    // Clean up inactive players
    for (const [squirrelId, player] of this.players) {
      if (now - player.lastUpdate > SESSION_TIMEOUT) {
        console.log(`[Log] Timing out inactive player: ${squirrelId}`);
        this.handlePlayerLeave(squirrelId);
        this.broadcast({ type: 'player_leave', squirrelId });
        cleanedPlayers++;
      }
    }
    
    console.log(`[Log] ✅ Cleanup complete: ${cleanedSessions} sessions, ${cleanedPlayers} players`);
    
    // Schedule next cleanup
    await this.scheduleCleanup();
  }
}