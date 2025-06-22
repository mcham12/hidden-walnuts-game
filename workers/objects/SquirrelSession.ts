// AI NOTE:
// This Durable Object tracks a single player's state during a daily forest cycle.
// It stores their score, participation time, multiplier, power-up usage, hidden and found walnuts.
// It delegates walnut tracking to the WalnutRegistry and updates the map through ForestManager.
// This object must persist score and session data across reconnects during the 24-hour cycle.

import { POINTS, PARTICIPATION_INTERVAL_SECONDS, PARTICIPATION_MAX_MULTIPLIER, DEFAULT_POWERUPS } from "../constants";
import type { Squirrel, Walnut, HidingMethod } from "../types";
import { getObjectInstance } from "./registry";
import type { EnvWithBindings } from "./registry";

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

interface ValidateBody {
  token: string;
}

export default class SquirrelSession {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env!: EnvWithBindings;
  squirrel: Squirrel | null = null;

  constructor(state: DurableObjectState, env: EnvWithBindings) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();

    try {
      if (path.endsWith("/join")) {
        const providedId = url.searchParams.get("squirrelId") || crypto.randomUUID();
        this.squirrel = {
          id: providedId,
          joinedAt: now,
          lastSeen: now,
          participationSeconds: 0,
          multiplier: 1.0,
          powerUps: Object.fromEntries(DEFAULT_POWERUPS.map(p => [p, true])),
          hiddenWalnuts: [],
          foundWalnuts: [],
          score: 0,
          firstFinderAchieved: false
        };
        await this.save();
        return new Response(JSON.stringify(this.squirrel), { 
          headers: { "Content-Type": "application/json" }
        });
      }

      if (!this.squirrel) {
        this.squirrel = await this.storage.get<Squirrel>("session");
        if (!this.squirrel) {
          return new Response("Must join first", { status: 400 });
        }
      }

      if (path.endsWith("/hide")) {
        const body = await request.json() as unknown;
        if (!this.isValidHideRequest(body)) {
          return new Response(JSON.stringify({ 
            error: "Missing required fields: location and hiddenIn"
          }), { 
            status: 400, 
            headers: { "Content-Type": "application/json" }
          });
        }
        const walnut: Walnut = {
          id: `p-${crypto.randomUUID()}`,
          ownerId: this.squirrel.id,
          origin: "player",
          hiddenIn: body.hiddenIn,
          location: body.location,
          found: false,
          timestamp: now
        };
        const registry = getObjectInstance(this.env, "walnuts", "global");
        const registryResponse = await registry.fetch(new Request("https://internal/add", {
          method: "POST",
          body: JSON.stringify(walnut)
        }));
        if (!registryResponse.ok) {
          return new Response(JSON.stringify({ 
            error: "Failed to register walnut", 
            details: await registryResponse.text() 
          }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" }
          });
        }
        this.squirrel.hiddenWalnuts.push(walnut.id);
        await this.save();
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Walnut hidden successfully",
          walnut: { id: walnut.id, hiddenIn: walnut.hiddenIn, timestamp: walnut.timestamp }
        }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" }
        });
      }

      if (path.endsWith("/ping")) {
        await this.updateParticipation();
        await this.save();
        return new Response("Participation updated");
      }

      if (path === "/generate-token") {
        const token = await this.generateToken();
        return new Response(token);
      }

      if (path === "/validate" && request.method === "POST") {
        const body = await request.json() as ValidateBody;
        const providedToken = body.token;
        const isValid = await this.validateToken(providedToken);
        return new Response(isValid ? "Valid" : "Invalid", { status: isValid ? 200 : 401 });
      }

      return new Response("Not found", { status: 404 });
    } catch (error) {
      console.error('Error in SquirrelSession fetch:', error);
      return new Response(JSON.stringify({ error: "Internal server error" }), { 
        status: 500, 
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  async updateParticipation(): Promise<void> {
    if (!this.squirrel) return;
    
    const now = Date.now();
    const elapsed = Math.floor((now - this.squirrel.lastSeen) / 1000);
    this.squirrel.participationSeconds += elapsed;
    this.squirrel.lastSeen = now;

    const step = Math.floor(this.squirrel.participationSeconds / PARTICIPATION_INTERVAL_SECONDS);
    this.squirrel.multiplier = Math.min(1 + step * 0.1, PARTICIPATION_MAX_MULTIPLIER);
  }

  async save(): Promise<void> {
    if (this.squirrel) {
      await this.storage.put("session", this.squirrel);
    }
  }

  // Type guard for hide request body
  private isValidHideRequest(body: unknown): body is { 
    hiddenIn: HidingMethod; 
    location: { x: number; y: number; z: number; }
  } {
    if (!body || typeof body !== 'object') return false;
    
    const hideRequest = body as Record<string, unknown>;
    
    // Check required fields exist
    if (!hideRequest.location || !hideRequest.hiddenIn) return false;
    
    // Validate hiding method
    if (hideRequest.hiddenIn !== "buried" && hideRequest.hiddenIn !== "bush") return false;
    
    // Validate location has x, y, z numeric coordinates
    const location = hideRequest.location as Record<string, unknown>;
    if (typeof location !== 'object') return false;
    
    if (typeof location.x !== 'number' || 
        typeof location.y !== 'number' || 
        typeof location.z !== 'number') {
      return false;
    }
    
    return true;
  }

  async generateToken(): Promise<string> {
    const token = crypto.randomUUID();
    await this.storage.put("token", token);
    return token;
  }

  async validateToken(providedToken: string): Promise<boolean> {
    const storedToken = await this.storage.get<string>("token");
    return storedToken === providedToken;
  }
}
