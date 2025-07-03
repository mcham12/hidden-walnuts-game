// AI NOTE:
// This Durable Object tracks a single player's state during a daily forest cycle.
// It stores their score, participation time, multiplier, power-up usage, hidden and found walnuts.
// It delegates walnut tracking to the WalnutRegistry and updates the map through ForestManager.
// This object must persist score and session data across reconnects during the 24-hour cycle.

import { POINTS, PARTICIPATION_INTERVAL_SECONDS, PARTICIPATION_MAX_MULTIPLIER, DEFAULT_POWERUPS } from "../constants";
import type { Squirrel, Walnut, HidingMethod } from "../types";
import { getObjectInstance } from "./registry";
import type { EnvWithBindings } from "./registry";
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
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

interface SessionState {
  squirrelId: string;
  token: string;
  isAuthenticated: boolean;
  joinedAt: number;
  lastActivity: number;
  position: { x: number; y: number; z: number };
  rotationY: number;
  connectionState: 'connecting' | 'authenticated' | 'active' | 'disconnected';
}

interface PlayerStats {
  walnuts: { hidden: number; found: number };
  score: number;
  timeOnline: number;
}

export default class SquirrelSession {
  private state: DurableObjectState;
  private sessionState: SessionState | null = null;
  private playerStats: PlayerStats | null = null;
  private sessionTimeout: any = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    
    // Initialize Logger with environment from DO context
    initializeLogger(env.ENVIRONMENT);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Handle player join/authentication
      if (pathname === "/join") {
        return await this.handleJoin(request);
      }

      // Handle session validation
      if (pathname === "/validate") {
        return await this.handleValidation(request);
      }

      // Handle player state updates
      if (pathname === "/update-state") {
        return await this.handleStateUpdate(request);
      }

      // Handle session cleanup
      if (pathname === "/disconnect") {
        return await this.handleDisconnect(request);
      }

      // Handle session info requests
      if (pathname === "/session-info") {
        return await this.handleSessionInfo(request);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      Logger.error(LogCategory.SESSION, "SquirrelSession error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error"
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Industry Standard: Secure token-based authentication
  private async handleJoin(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const squirrelId = url.searchParams.get("squirrelId");
    
    if (!squirrelId) {
      return new Response(JSON.stringify({
        error: "Missing squirrelId parameter"
      }), { status: 400, headers: { "Content-Type": "application/json" }});
    }

    // Generate secure session token
    const token = crypto.randomUUID();
    const now = Date.now();
    
    // Load existing session state if it exists
    const existingState = await this.state.storage.get<SessionState>("session");
    const existingStats = await this.state.storage.get<PlayerStats>("stats");
    
    // Create or update session state
    this.sessionState = {
      squirrelId,
      token,
      isAuthenticated: true,
      joinedAt: existingState?.joinedAt || now,
      lastActivity: now,
      position: existingState?.position || { x: 50, y: 2, z: 50 }, // Default spawn
      rotationY: existingState?.rotationY || 0,
      connectionState: 'authenticated'
    };

    // Initialize or preserve player stats
    this.playerStats = existingStats || {
      walnuts: { hidden: 0, found: 0 },
      score: 0,
      timeOnline: 0
    };

    // Persist to storage
    await this.state.storage.put("session", this.sessionState);
    await this.state.storage.put("stats", this.playerStats);
    
    // Set session timeout (industry standard: 30 minutes)
    this.scheduleSessionTimeout();

    Logger.info(LogCategory.SESSION, `Player ${squirrelId} authenticated with token ${token.substring(0, 8)}...`);
    
    return new Response(JSON.stringify({
      success: true,
      token,
      squirrelId,
      position: this.sessionState.position,
      rotationY: this.sessionState.rotationY,
      stats: this.playerStats
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Industry Standard: Token validation for secure communication
  private async handleValidation(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json() as { token: string };
    
    if (!this.sessionState) {
      await this.loadSessionFromStorage();
    }

    // TASK URGENTA.2: Check session timeout on access instead of using timers
    const now = Date.now();
    const sessionTimeout = 60 * 60 * 1000; // 60 minutes
    const isExpired = this.sessionState && (now - this.sessionState.lastActivity) > sessionTimeout;
    
    if (isExpired && this.sessionState) {
      this.sessionState.connectionState = 'disconnected';
      this.sessionState.isAuthenticated = false;
      await this.state.storage.put("session", this.sessionState);
    }

    const isValid = this.sessionState?.token === body.token && 
                   this.sessionState?.isAuthenticated === true &&
                   !isExpired;

    if (isValid && this.sessionState) {
      // Update last activity
      this.sessionState.lastActivity = now;
      await this.state.storage.put("session", this.sessionState);
      this.scheduleSessionTimeout();
    }

    return new Response(JSON.stringify({ 
      valid: isValid,
      squirrelId: isValid ? this.sessionState?.squirrelId : null
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Industry Standard: State persistence with validation
  private async handleStateUpdate(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await request.json() as { 
      token: string; 
      position?: { x: number; y: number; z: number };
      rotationY?: number;
      connectionState?: 'active' | 'disconnected';
    };

    if (!this.sessionState) {
      await this.loadSessionFromStorage();
    }

    // Validate token
    if (!this.sessionState || this.sessionState.token !== body.token) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update state with validation
    if (body.position && this.isValidPosition(body.position)) {
      this.sessionState.position = body.position;
    }
    
    if (body.rotationY !== undefined) {
      this.sessionState.rotationY = body.rotationY;
    }

    if (body.connectionState) {
      this.sessionState.connectionState = body.connectionState;
    }

    this.sessionState.lastActivity = Date.now();

    // Persist to storage
    await this.state.storage.put("session", this.sessionState);
    this.scheduleSessionTimeout();

    return new Response(JSON.stringify({ 
      success: true,
      position: this.sessionState.position,
      rotationY: this.sessionState.rotationY 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Industry Standard: Graceful session cleanup
  private async handleDisconnect(request: Request): Promise<Response> {
    if (!this.sessionState) {
      await this.loadSessionFromStorage();
    }

    if (this.sessionState) {
      // Update connection state but preserve session for reconnection
      this.sessionState.connectionState = 'disconnected';
      this.sessionState.lastActivity = Date.now();
      
      // Update total time online
      if (this.playerStats) {
        this.playerStats.timeOnline += Date.now() - this.sessionState.joinedAt;
        await this.state.storage.put("stats", this.playerStats);
      }
      
      await this.state.storage.put("session", this.sessionState);
    }

    // Clear timeout
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }

    console.log(`[SquirrelSession] Player ${this.sessionState?.squirrelId} disconnected gracefully`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Get current session information
  private async handleSessionInfo(request: Request): Promise<Response> {
    if (!this.sessionState) {
      await this.loadSessionFromStorage();
    }

    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: "No active session" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      squirrelId: this.sessionState.squirrelId,
      isAuthenticated: this.sessionState.isAuthenticated,
      connectionState: this.sessionState.connectionState,
      position: this.sessionState.position,
      rotationY: this.sessionState.rotationY,
      stats: this.playerStats
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Industry Standard: Position validation (anti-cheat)
  private isValidPosition(position: { x: number; y: number; z: number }): boolean {
    const MAX_COORDINATE = 200; // Terrain bounds
    const MIN_Y = 0;
    const MAX_Y = 50;

    return position.x >= -MAX_COORDINATE && position.x <= MAX_COORDINATE &&
           position.z >= -MAX_COORDINATE && position.z <= MAX_COORDINATE &&
           position.y >= MIN_Y && position.y <= MAX_Y;
  }

  // Industry Standard: Session timeout management - TASK URGENTA.2: Remove setTimeout to allow hibernation
  private scheduleSessionTimeout(): void {
    // TASK URGENTA.2: Remove setTimeout to allow Durable Object hibernation
    // Session timeout will be checked on next access instead of using timers
    if (this.sessionTimeout) {
      clearTimeout(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    
    // Store the timeout timestamp instead of using setTimeout
    if (this.sessionState) {
      this.sessionState.lastActivity = Date.now();
    }
  }

  // Load session from persistent storage
  private async loadSessionFromStorage(): Promise<void> {
    this.sessionState = await this.state.storage.get<SessionState>("session");
    this.playerStats = await this.state.storage.get<PlayerStats>("stats");
  }
}
