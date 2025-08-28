// Simplified SquirrelSession - Basic player state management

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
  position: { x: number; y: number; z: number };
  rotationY: number;
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
        this.sessionState = {
          squirrelId,
          token: this.generateToken(),
          joinedAt: Date.now(),
          lastActivity: Date.now(),
          position: { x: 0, y: 2, z: 0 },
          rotationY: 0
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

      return new Response(JSON.stringify({
        success: true,
        squirrelId: this.sessionState.squirrelId,
        token: this.sessionState.token,
        stats: this.playerStats,
        position: this.sessionState.position,
        rotationY: this.sessionState.rotationY
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
}