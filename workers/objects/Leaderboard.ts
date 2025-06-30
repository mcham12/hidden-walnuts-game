// AI NOTE:
// This Durable Object manages real-time player scores during each 24-hour forest cycle.
// It handles score submission, participation multipliers, bonus awards, and final ranking.
// Players send updates via `/report`, and this object calculates adjusted scores (score × multiplier).
// At the end of the cycle, it returns the top players and awards cosmetic rewards.

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

type ScoreRecord = {
    playerId: string;
    rawScore: number;
    multiplier: number;
    bonuses: string[]; // e.g., ["FirstFinder"]
    updatedAt: number;
  };
  
  export default class Leaderboard {
    state: DurableObjectState;
    storage: DurableObjectStorage;
    scores: Map<string, ScoreRecord> = new Map();
  
    constructor(state: DurableObjectState, env?: any) {
      this.state = state;
      this.storage = state.storage;
      
      // Initialize Logger with environment from DO context if available
      if (env?.ENVIRONMENT) {
        initializeLogger(env.ENVIRONMENT);
      }
    }
  
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
  
      if (path.endsWith("/report") && request.method === "POST") {
        const record = await request.json() as ScoreRecord;
        this.scores.set(record.playerId, record);
        await this.storage.put(record.playerId, record);
        return new Response("Score updated");
      }
  
      if (path.endsWith("/top")) {
        const top = this.getTopPlayers();
        return new Response(JSON.stringify(top), {
          headers: { "Content-Type": "application/json" }
        });
      }
  
      if (path.endsWith("/reset")) {
        this.scores.clear();
        await this.storage.deleteAll();
        return new Response("Leaderboard reset");
      }
  
      return new Response("Not found", { status: 404 });
    }
  
    getTopPlayers(limit: number = 10): Array<{ playerId: string; adjustedScore: number }> {
      const ranked = Array.from(this.scores.values())
        .map((r) => ({
          playerId: r.playerId,
          adjustedScore: Math.floor(r.rawScore * r.multiplier)
        }))
        .sort((a, b) => b.adjustedScore - a.adjustedScore)
        .slice(0, limit);
      return ranked;
    }
  
    async alarm(): Promise<void> {
      // Optional: export leaderboard at end of day
    }
  }
  