// Simplified SquirrelSession - Basic player state management
// MVP 12: Added player title/rank tracking
import { getPlayerTitle, checkForRankUp } from '../../shared/PlayerRanks.js';

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
  joinedAt: number;
  lastActivity: number;
  lastDisconnectAt?: number; // MVP 9: Track disconnect time for reconnection window
  position: { x: number; y: number; z: number };
  rotationY: number;
  currentTitleId?: string; // MVP 12: Current player title ID ('rookie', 'ninja', etc.)
  isFirstJoin?: boolean; // MVP 12: Track if this is first join (show welcome message)
}

interface PlayerStats {
  walnuts: { hidden: number; found: number };
  score: number;
}

export default class SquirrelSession {
  private state: DurableObjectState;
  private sessionState: SessionState | null = null;
  private playerStats: PlayerStats | null = null;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Handle player join
      if (pathname === "/join") {
        return await this.handleJoin(request);
      }

      // Handle token validation
      if (pathname === "/validate") {
        return await this.handleValidation(request);
      }

      // Handle session info requests
      if (pathname === "/session-info") {
        return await this.handleSessionInfo(request);
      }

      // MVP 9: Handle score update (for persistence across reconnects)
      if (pathname === "/update-score" && request.method === "POST") {
        return await this.handleScoreUpdate(request);
      }

      // MVP 9: Handle disconnect (for reconnection window)
      if (pathname === "/disconnect" && request.method === "POST") {
        return await this.handleDisconnect(request);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("SquirrelSession error:", error);
      return new Response(JSON.stringify({ 
        error: "Internal Server Error"
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle join request
  private async handleJoin(request: Request): Promise<Response> {
    try {
      // Get squirrelId from query string or generate one
      const url = new URL(request.url);
      const squirrelId = url.searchParams.get("squirrelId") || this.generateSquirrelId();
      
      // Load existing session or create new one
      await this.loadSession(squirrelId);
      
      if (!this.sessionState) {
        // Create new session
        // MVP 12: Initialize with Rookie title and mark as first join
        const initialTitle = getPlayerTitle(0);

        this.sessionState = {
          squirrelId,
          token: this.generateToken(),
          joinedAt: Date.now(),
          lastActivity: Date.now(),
          position: { x: 0, y: 2, z: 0 },
          rotationY: 0,
          currentTitleId: initialTitle.id,
          isFirstJoin: true
        };

        this.playerStats = {
          walnuts: { hidden: 0, found: 0 },
          score: 0
        };

        await this.saveSession();
      } else {
        // Update existing session
        this.sessionState.lastActivity = Date.now();
        await this.saveSession();
      }

      // MVP 12: Include title info in join response
      const currentTitle = getPlayerTitle(this.playerStats?.score || 0);

      return new Response(JSON.stringify({
        success: true,
        squirrelId: this.sessionState.squirrelId,
        token: this.sessionState.token,
        stats: this.playerStats,
        position: this.sessionState.position,
        rotationY: this.sessionState.rotationY,
        titleId: currentTitle.id,
        titleName: currentTitle.name,
        isFirstJoin: this.sessionState.isFirstJoin || false
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error in handleJoin:", error);
      return new Response(JSON.stringify({
        error: "Failed to join"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle token validation
  private async handleValidation(request: Request): Promise<Response> {
    try {
      const { token } = await request.json() as { token: string };
      
      if (!this.sessionState) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const isValid = this.sessionState.token === token;
      
      if (isValid) {
        this.sessionState.lastActivity = Date.now();
        await this.saveSession();
      }

      return new Response(JSON.stringify({ 
        valid: isValid,
        squirrelId: isValid ? this.sessionState.squirrelId : undefined
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ valid: false }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // Handle session info requests
  private async handleSessionInfo(request: Request): Promise<Response> {
    if (!this.sessionState) {
      return new Response(JSON.stringify({
        error: "No active session"
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      squirrelId: this.sessionState.squirrelId,
      position: this.sessionState.position,
      rotationY: this.sessionState.rotationY,
      stats: this.playerStats,
      joinedAt: this.sessionState.joinedAt,
      lastActivity: this.sessionState.lastActivity
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Load session from storage
  private async loadSession(squirrelId: string): Promise<void> {
    try {
      const sessionData = await this.state.storage.get<{
        sessionState: SessionState;
        playerStats: PlayerStats;
      }>(`session:${squirrelId}`);

      if (sessionData) {
        this.sessionState = sessionData.sessionState;
        this.playerStats = sessionData.playerStats;
      }
    } catch (error) {
      console.error(`Error loading session for ${squirrelId}:`, error);
    }
  }

  // Save session to storage
  private async saveSession(): Promise<void> {
    if (!this.sessionState || !this.playerStats) {
      return;
    }

    try {
      await this.state.storage.put(`session:${this.sessionState.squirrelId}`, {
        sessionState: this.sessionState,
        playerStats: this.playerStats
      });
    } catch (error) {
      console.error("Error saving session:", error);
    }
  }

  // Generate unique squirrel ID
  private generateSquirrelId(): string {
    return `squirrel-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Generate simple token
  private generateToken(): string {
    return `token-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // MVP 9: Handle score update (called when player's score changes)
  // MVP 12: Detect rank-ups and return rank change info
  private async handleScoreUpdate(request: Request): Promise<Response> {
    try {
      const data = await request.json() as { squirrelId: string; score: number };

      if (!data.squirrelId || typeof data.score !== 'number') {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Load existing session
      await this.loadSession(data.squirrelId);

      if (!this.sessionState || !this.playerStats) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // MVP 12: Check for rank-up before updating score
      const oldScore = this.playerStats.score;
      const newScore = data.score;
      const rankedUp = checkForRankUp(oldScore, newScore);

      // Update score
      this.playerStats.score = newScore;
      this.sessionState.lastActivity = Date.now();

      // MVP 12: Update current title if ranked up
      if (rankedUp) {
        this.sessionState.currentTitleId = rankedUp.id;
        console.log(`🎉 Player ${data.squirrelId} ranked up to ${rankedUp.name}!`);
      }

      // MVP 12: Clear first join flag after showing welcome (if applicable)
      if (this.sessionState.isFirstJoin) {
        this.sessionState.isFirstJoin = false;
      }

      await this.saveSession();

      // MVP 12: Return rank-up info to client
      return new Response(JSON.stringify({
        success: true,
        rankedUp: rankedUp ? true : false,
        newTitle: rankedUp ? {
          id: rankedUp.id,
          name: rankedUp.name,
          description: rankedUp.description
        } : null
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error updating score:", error);
      return new Response(JSON.stringify({ error: "Failed to update score" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // MVP 9: Handle disconnect (called when player leaves)
  private async handleDisconnect(request: Request): Promise<Response> {
    try {
      const data = await request.json() as { squirrelId: string };

      if (!data.squirrelId) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      await this.loadSession(data.squirrelId);

      if (!this.sessionState) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Mark disconnect time for reconnection window
      this.sessionState.lastDisconnectAt = Date.now();
      await this.saveSession();

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error handling disconnect:", error);
      return new Response(JSON.stringify({ error: "Failed to handle disconnect" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}