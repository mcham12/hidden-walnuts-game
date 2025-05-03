// AI NOTE:
// This Durable Object stores and manages the state of all walnuts in the current forest cycle.
// It tracks their location, whether they are found or re-hidden, and who owns them.
// Called by SquirrelSession (to add player-hidden walnuts) and ForestManager (to register game walnuts).
// It may also support stealing/re-hiding and hot zone analytics.

import type { Walnut, HidingMethod } from "../types";

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

export default class WalnutRegistry {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  walnuts: Map<string, Walnut> = new Map();
  initialized = false;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  // Initialize by loading all walnuts from storage
  async init() {
    if (!this.initialized) {
      await this.loadAll();
      this.initialized = true;
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Ensure walnuts are loaded from storage
    await this.init();

    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/add") && request.method === "POST") {
      try {
        // Parse the walnut from request body
        const walnut = await request.json() as Walnut;
        
        // Validate required fields
        if (!this.validateWalnut(walnut)) {
          return new Response(JSON.stringify({
            error: "Invalid walnut object",
            message: "Walnut must have id, ownerId, origin, hiddenIn, location, and timestamp"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Add the walnut to our in-memory map
        this.walnuts.set(walnut.id, walnut);
        
        // Persist to storage using ID as key
        await this.storage.put(walnut.id, walnut);
        
        // Return success response
        return new Response(JSON.stringify({
          success: true,
          message: `Walnut ${walnut.id} added successfully`,
          walnut: {
            id: walnut.id,
            ownerId: walnut.ownerId,
            hiddenIn: walnut.hiddenIn,
            location: walnut.location
          }
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error: unknown) {
        // Handle JSON parsing errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({
          error: "Failed to add walnut",
          message: errorMessage
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (path.endsWith("/all")) {
      try {
        // Make sure we've loaded all walnuts from storage
        await this.loadAll();
        
        // Convert the Map to an array of walnuts
        const allWalnuts = Array.from(this.walnuts.values());
        
        // Add debugging metadata
        const response = {
          total: allWalnuts.length,
          timestamp: Date.now(),
          walnuts: allWalnuts
        };
        
        // Return as JSON with appropriate headers
        return new Response(JSON.stringify(response, null, 2), {
          headers: { 
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        });
      } catch (error: unknown) {
        // Handle any errors that might occur
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(JSON.stringify({
          error: "Failed to retrieve walnuts",
          message: errorMessage
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    if (path.endsWith("/reset")) {
      await this.storage.deleteAll();
      this.walnuts.clear();
      return new Response(JSON.stringify({
        success: true,
        message: "All walnuts reset"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      error: "Not found",
      message: "The requested endpoint does not exist"
    }), { 
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }

  async loadAll(): Promise<void> {
    const entries = await this.storage.list<Walnut>();
    for (const [key, walnut] of entries) {
      this.walnuts.set(key, walnut);
    }
  }

  // Validate a walnut object has all required fields
  private validateWalnut(walnut: any): walnut is Walnut {
    if (!walnut) return false;
    
    // Check for required fields
    if (!walnut.id || !walnut.ownerId || !walnut.origin || 
        !walnut.hiddenIn || !walnut.location || !walnut.timestamp) {
      return false;
    }
    
    // Validate hiding method
    if (walnut.hiddenIn !== "buried" && walnut.hiddenIn !== "bush") {
      return false;
    }
    
    // Validate location has x, y, z coordinates
    if (typeof walnut.location.x !== 'number' || 
        typeof walnut.location.y !== 'number' || 
        typeof walnut.location.z !== 'number') {
      return false;
    }
    
    return true;
  }

  async alarm(): Promise<void> {
    // Optional: for pruning, analytics, or backup logic
  }
}
