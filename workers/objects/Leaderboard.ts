// Simplified Leaderboard - Basic scoring system

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

interface ScoreRecord {
  playerId: string;
  score: number;
  walnuts: { hidden: number; found: number };
  updatedAt: number;
}

export default class Leaderboard {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  scores: Map<string, ScoreRecord> = new Map();
  initialized = false;

  constructor(state: DurableObjectState, env?: any) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize scores from storage
    if (!this.initialized) {
      await this.loadScores();
      this.initialized = true;
    }

    // Update player score
    if (path.endsWith("/report") && request.method === "POST") {
      try {
        const record = await request.json() as ScoreRecord;

        console.log(`📥 Leaderboard received score report: ${record.playerId} = ${record.score}`);

        // Validate record
        if (!record.playerId || typeof record.score !== 'number') {
          console.error(`❌ Invalid score record:`, record);
          return new Response(JSON.stringify({
            error: "Invalid score record"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        record.updatedAt = Date.now();
        this.scores.set(record.playerId, record);
        await this.storage.put(record.playerId, record);

        console.log(`✅ Leaderboard saved: ${record.playerId} = ${record.score} (Total players: ${this.scores.size})`);

        return new Response(JSON.stringify({
          success: true,
          message: "Score updated"
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        console.error(`❌ Leaderboard error:`, error);
        return new Response(JSON.stringify({
          error: "Failed to update score"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Get top players
    if (path.endsWith("/top")) {
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const topPlayers = this.getTopPlayers(limit);

      console.log(`📊 Leaderboard /top request: ${topPlayers.length} players returned (${this.scores.size} total in DB)`);

      return new Response(JSON.stringify({
        leaderboard: topPlayers,
        count: topPlayers.length,
        totalPlayers: this.scores.size
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get player's current rank and score
    if (path.endsWith("/player") && request.method === "GET") {
      const playerId = url.searchParams.get("playerId");
      
      if (!playerId) {
        return new Response(JSON.stringify({
          error: "Missing playerId"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const playerRecord = this.scores.get(playerId);
      const rank = this.getPlayerRank(playerId);

      return new Response(JSON.stringify({
        playerId,
        score: playerRecord?.score || 0,
        walnuts: playerRecord?.walnuts || { hidden: 0, found: 0 },
        rank: rank,
        totalPlayers: this.scores.size
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Reset leaderboard (admin endpoint)
    if (path.endsWith("/reset") && request.method === "POST") {
      this.scores.clear();
      await this.storage.deleteAll();
      
      return new Response(JSON.stringify({
        success: true,
        message: "Leaderboard reset"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // Get top players by score
  private getTopPlayers(limit: number = 10): Array<{ playerId: string; score: number; walnuts: { hidden: number; found: number }; rank: number }> {
    const sortedPlayers = Array.from(this.scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((record, index) => ({
        playerId: record.playerId,
        score: record.score,
        walnuts: record.walnuts,
        rank: index + 1
      }));

    return sortedPlayers;
  }

  // Get a player's current rank
  private getPlayerRank(playerId: string): number {
    const playerRecord = this.scores.get(playerId);
    if (!playerRecord) {
      return -1; // Player not found
    }

    const sortedScores = Array.from(this.scores.values())
      .sort((a, b) => b.score - a.score);

    const rank = sortedScores.findIndex(record => record.playerId === playerId);
    return rank >= 0 ? rank + 1 : -1;
  }

  // Load scores from storage
  private async loadScores(): Promise<void> {
    try {
      const scoresMap = await this.storage.list<ScoreRecord>();
      this.scores = new Map(scoresMap);
    } catch (error) {
      console.error('Error loading scores from storage:', error);
    }
  }
}