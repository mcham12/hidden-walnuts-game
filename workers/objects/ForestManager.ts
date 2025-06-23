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

  // FIX: Load persisted player data on startup
  private async initializePlayersFromStorage(): Promise<void> {
    try {
      // FIX: Expect array format, not Map format
      const storedPlayers = await this.state.storage.get<[string, PlayerData][]>('active-players');
      if (storedPlayers && Array.isArray(storedPlayers)) {
        // Convert array back to Map
        this.players = new Map(storedPlayers);
        console.log(`[Log] 🔄 Restored ${this.players.size} players from storage`);
        
        // Debug: Log restored players
        for (const [id, player] of this.players.entries()) {
          console.log(`[Log] 📍 Restored player ${id} at position:`, player.position);
        }
      } else {
        console.log(`[Log] 📁 No stored players found, starting fresh`);
      }
    } catch (error) {
      console.error('[Error] Failed to load players from storage:', error);
    }
  }

  // FIX: Persist player data to storage
  private async persistPlayerData(): Promise<void> {
    try {
      // Convert Map to Array for storage
      const playersArray = Array.from(this.players.entries());
      await this.state.storage.put('active-players', playersArray);
    } catch (error) {
      console.error('[Error] Failed to persist player data:', error);
    }
  }

  async fetch(request: CfRequest): Promise<CfResponse> {
    const url = new URL(request.url);
    console.log(`[Log] ForestManager fetch called for path: ${url.pathname}`);

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        console.error('[Error] Missing Upgrade header for WebSocket');
        return new Response('Expected Upgrade: websocket', { status: 426 }) as unknown as CfResponse;
      }

      const squirrelId = url.searchParams.get('squirrelId');
      const token = url.searchParams.get('token');
      if (!squirrelId || !token) {
        console.error('[Error] Missing squirrelId or token');
        return new Response('Missing squirrelId or token', { status: 400 }) as unknown as CfResponse;
      }

      console.log(`[Log] Upgrading to WebSocket for squirrelId: ${squirrelId}`);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      await this.handleSocket(server, squirrelId, token);
      return new Response(null, { status: 101, webSocket: client }) as unknown as CfResponse;
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
      
      return new Response(JSON.stringify({
        storedPlayers: storedPlayers || [],
        currentPlayers: currentPlayers,
        activeSessions: Array.from(this.sessions.keys())
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
    // FIX: Check resource limits before accepting new connections
    if (this.sessions.size >= MAX_CONCURRENT_SESSIONS) {
      console.warn(`[Warning] Session limit reached (${MAX_CONCURRENT_SESSIONS}), rejecting ${squirrelId}`);
      socket.close(4003, "Server at capacity");
      return;
    }

    // FIX: Implement proper authentication before accepting socket
    console.log(`[Log] Validating WebSocket connection for ${squirrelId}`);
    
    try {
      // Validate token with SquirrelSession (single source of truth)
      const isValid = await this.validateToken(squirrelId, token);
      if (!isValid) {
        console.error(`[Error] Invalid token for ${squirrelId}, rejecting WebSocket`);
        socket.close(4001, "Invalid token");
        return;
      }
      
      // Only accept socket after successful validation
      socket.accept();
      console.log(`[Log] ✅ WebSocket authenticated for ${squirrelId}`);
      
    } catch (error) {
      console.error(`[Error] Token validation failed for ${squirrelId}:`, error);
      socket.close(4002, "Authentication error");
      return;
    }

    // Store authenticated session with timeout
    this.sessions.set(squirrelId, socket);
    this.socketToPlayer.set(socket, squirrelId);

    // FIX: Set connection timeout
    const connectionTimeout = setTimeout(() => {
      console.log(`[Log] Connection timeout for ${squirrelId}`);
      this.handlePlayerLeave(squirrelId);
      socket.close(4004, "Connection timeout");
    }, SESSION_TIMEOUT);

    // Send initial map state
    const mapState = await this.getMapState();
    socket.send(JSON.stringify({ type: 'init', mapState }));

    // FIX: Check if player already exists (reconnection) or create new
    let existingPlayer = this.players.get(squirrelId);
    if (!existingPlayer) {
      // New player - initialize with default position
      existingPlayer = {
        squirrelId,
        position: { x: 50, y: 2, z: 50 }, // Better spawn position
        rotationY: 0,
        lastUpdate: Date.now(),
        messageCount: 1,
        messageResetTime: Date.now() + 60000
      };
      this.players.set(squirrelId, existingPlayer);
      await this.persistPlayerData(); // FIX: Persist new player
      console.log(`[Log] 🆕 Created new player ${squirrelId} at spawn position`);
    } else {
      // Returning player - update connection time but keep position
      existingPlayer.lastUpdate = Date.now();
      existingPlayer.messageCount = 1;
      existingPlayer.messageResetTime = Date.now() + 60000;
      this.players.set(squirrelId, existingPlayer);
      console.log(`[Log] 🔄 Reconnected player ${squirrelId} at stored position:`, existingPlayer.position);
    }

    // FIX: Send existing players to new connection (always, for reconnections too)
    const existingPlayers = Array.from(this.players.entries())
      .filter(([id]) => id !== squirrelId)
      .map(([id, player]) => ({
        squirrelId: id,
        position: player.position,
        rotationY: player.rotationY
      }));

    if (existingPlayers.length > 0) {
      socket.send(JSON.stringify({ 
        type: 'existing_players', 
        players: existingPlayers 
      }));
      console.log(`[Log] 📤 Sent ${existingPlayers.length} existing players to ${squirrelId}`);
    }

    // FIX: Wait for client ready acknowledgment before broadcasting join
    let clientReady = false;
    const clientReadyTimeout = setTimeout(() => {
      if (!clientReady) {
        console.log(`[Log] ⚠️ Client ${squirrelId} didn't send ready signal, proceeding anyway`);
        this.broadcastPlayerJoin(squirrelId, existingPlayer);
      }
    }, 5000); // 5 second timeout

    socket.addEventListener('message', async (event) => {
      try {
        // FIX: Message size validation
        if (event.data.length > MAX_MESSAGE_SIZE) {
          console.warn(`[Warning] Message too large from ${squirrelId}: ${event.data.length} bytes`);
          return;
        }

        const data = JSON.parse(event.data);
        
        // FIX: Handle client ready signal
        if (data.type === 'client_ready' && !clientReady) {
          clientReady = true;
          clearTimeout(clientReadyTimeout);
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

  private async handlePlayerUpdate(squirrelId: string, position: { x: number; y: number; z: number }, rotationY: number): Promise<void> {
    this.players.set(squirrelId, {
      squirrelId,
      position,
      rotationY,
      lastUpdate: Date.now(),
      messageCount: 1, // Initialize message counter
      messageResetTime: Date.now() + 60000 // Reset counter in 1 minute
    });
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