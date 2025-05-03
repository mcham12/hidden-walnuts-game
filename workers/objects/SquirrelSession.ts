// AI NOTE:
// This Durable Object tracks a single player's state during a daily forest cycle.
// It stores their score, participation time, multiplier, power-up usage, hidden and found walnuts.
// It delegates walnut tracking to the WalnutRegistry and updates the map through ForestManager.
// This object must persist score and session data across reconnects during the 24-hour cycle.

import { POINTS, PARTICIPATION_INTERVAL_SECONDS, PARTICIPATION_MAX_MULTIPLIER, DEFAULT_POWERUPS } from "../constants";
import type { Squirrel, Walnut } from "../types";
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

    // Load squirrel data if not already loaded
    if (!this.squirrel) {
      this.squirrel = await this.storage.get<Squirrel>("session");
    }

    // Handle join request - this will either create a new squirrel or update an existing one
    if (path.endsWith("/join")) {
      await this.handleJoin(request);
      return new Response(JSON.stringify(this.squirrel), { 
        headers: { "Content-Type": "application/json" }
      });
    }

    // All other endpoints require an existing squirrel
    if (!this.squirrel) {
      return new Response("Must join first", { status: 400 });
    }

    if (path.endsWith("/hide")) {
      try {
        // Parse and validate request body
        const body = await request.json();
        
        // Validate required fields
        if (!body.location || !body.hiddenIn) {
          return new Response(JSON.stringify({ 
            error: "Missing required fields: location and hiddenIn"
          }), { 
            status: 400, 
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Validate hiding method
        if (body.hiddenIn !== "buried" && body.hiddenIn !== "bush") {
          return new Response(JSON.stringify({ 
            error: "hiddenIn must be 'buried' or 'bush'"
          }), { 
            status: 400, 
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Validate location has x, y, z coordinates
        if (typeof body.location.x !== 'number' || 
            typeof body.location.y !== 'number' || 
            typeof body.location.z !== 'number') {
          return new Response(JSON.stringify({ 
            error: "location must have numeric x, y, z coordinates"
          }), { 
            status: 400, 
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Create the walnut object
        const walnut: Walnut = {
          id: `p-${crypto.randomUUID()}`,
          ownerId: this.squirrel.id,
          origin: "player",
          hiddenIn: body.hiddenIn,
          location: body.location,
          found: false,
          timestamp: now
        };
        
        // Send to WalnutRegistry
        const registry = getObjectInstance(this.env, "walnuts", "global");
        const registryResponse = await registry.fetch(new Request("https://internal/add", {
          method: "POST",
          body: JSON.stringify(walnut)
        }));
        
        // Check if the registry accepted the walnut
        if (!registryResponse.ok) {
          return new Response(JSON.stringify({ 
            error: "Failed to register walnut", 
            details: await registryResponse.text() 
          }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Update the squirrel's hidden walnuts
        this.squirrel.hiddenWalnuts.push(walnut.id);
        await this.save();
        
        // Return success with walnut details
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Walnut hidden successfully",
          walnut: {
            id: walnut.id,
            hiddenIn: walnut.hiddenIn,
            timestamp: walnut.timestamp
          }
        }), { 
          status: 200, 
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        // Handle JSON parsing or other errors
        return new Response(JSON.stringify({ 
          error: "Invalid request", 
          details: error.message 
        }), { 
          status: 400, 
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (path.endsWith("/ping")) {
      await this.updateParticipation();
      await this.save();
      return new Response("Participation updated");
    }

    return new Response("Not found", { status: 404 });
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

  private async handleJoin(request: Request): Promise<void> {
    const currentTime = Date.now();
    const url = new URL(request.url);
    
    // Check if this is a new squirrel or returning one
    if (!this.squirrel) {
      // Extract ID from URL params or generate a new one
      const providedId = url.searchParams.get("squirrelId");
      const squirrelId = providedId || crypto.randomUUID();
      
      // Create a new squirrel with default values
      this.squirrel = {
        id: squirrelId,
        joinedAt: currentTime,
        lastSeen: currentTime,
        participationSeconds: 0,
        multiplier: 1.0,
        powerUps: Object.fromEntries(DEFAULT_POWERUPS.map(p => [p, true])),
        hiddenWalnuts: [],
        foundWalnuts: [],
        score: 0,
        firstFinderAchieved: false
      };
    } else {
      // Update existing squirrel's participation data
      const secondsSinceLastSeen = Math.floor((currentTime - this.squirrel.lastSeen) / 1000);
      this.squirrel.participationSeconds += secondsSinceLastSeen;
      this.squirrel.lastSeen = currentTime;
      
      // Update multiplier based on participation time
      const participationIntervals = Math.floor(this.squirrel.participationSeconds / PARTICIPATION_INTERVAL_SECONDS);
      const newMultiplier = 1.0 + (participationIntervals * 0.1);
      this.squirrel.multiplier = Math.min(newMultiplier, PARTICIPATION_MAX_MULTIPLIER);
    }
    
    // Save squirrel data
    await this.save();
  }
}
