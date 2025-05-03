// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { POINTS, CYCLE_DURATION_SECONDS, NUT_RUSH_INTERVAL_HOURS, NUT_RUSH_DURATION_MINUTES } from "../constants";
import type { Walnut } from "../types";

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

export default class ForestManager {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  cycleStartTime: number = 0;
  mapState: Walnut[] = [];

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/reset")) {
      await this.resetMap();
      return new Response("Map reset and walnuts respawned.");
    }

    if (path.endsWith("/hotzones")) {
      const zones = await this.getRecentActivity();
      return new Response(JSON.stringify(zones), { headers: { "Content-Type": "application/json" } });
    }

    if (path.endsWith("/state")) {
      return new Response(JSON.stringify(this.mapState), { headers: { "Content-Type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
  }

  async resetMap(): Promise<void> {
    this.cycleStartTime = Date.now();
    this.mapState = this.generateWalnuts();
    await this.storage.put("cycleStart", this.cycleStartTime);
    await this.storage.put("mapState", this.mapState);
  }

  generateWalnuts(count: number = 100): Walnut[] {
    const walnuts: Walnut[] = [];
    for (let i = 0; i < count; i++) {
      walnuts.push({
        id: `sys-${crypto.randomUUID()}`,
        ownerId: "system",
        origin: "game",
        hiddenIn: Math.random() < 0.5 ? "buried" : "bush",
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

  async getRecentActivity(): Promise<Record<string, number>> {
    // TODO: Track found/hide timestamps and calculate activity density per zone
    return {
      "zone-A": 3,
      "zone-B": 7,
      "zone-C": 1
    };
  }
}
