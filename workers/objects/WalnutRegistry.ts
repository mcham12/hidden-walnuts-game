// Simplified WalnutRegistry - Basic walnut storage and retrieval

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

interface Walnut {
  id: string;
  ownerId: string;
  origin: 'game' | 'player';
  hiddenIn: 'buried' | 'bush';
  location: { x: number, y: number, z: number };
  found: boolean;
  timestamp: number;
  grownIntoTree?: boolean; // MVP 9: Track if walnut has grown into tree
}

export default class WalnutRegistry {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  walnuts: Map<string, Walnut> = new Map();
  initialized = false;

  constructor(state: DurableObjectState, env?: any) {
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
    await this.init();

    const url = new URL(request.url);
    const path = url.pathname;

    // Add walnut
    if (path.endsWith("/add") && request.method === "POST") {
      try {
        const walnut = await request.json() as Walnut;
        
        if (!this.validateWalnut(walnut)) {
          return new Response(JSON.stringify({
            error: "Invalid walnut object"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        this.walnuts.set(walnut.id, walnut);
        await this.storage.put(walnut.id, walnut);
        
        return new Response(JSON.stringify({
          success: true,
          message: `Walnut ${walnut.id} added successfully`
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to add walnut"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Get all walnuts
    if (path.endsWith("/all") && request.method === "GET") {
      const walnutArray = Array.from(this.walnuts.values());
      return new Response(JSON.stringify({
        walnuts: walnutArray,
        count: walnutArray.length
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Find walnut by ID
    if (path.endsWith("/find") && request.method === "POST") {
      try {
        const { walnutId, playerId } = await request.json() as { walnutId: string; playerId: string };

        if (!walnutId || !playerId) {
          return new Response(JSON.stringify({
            error: "Missing walnutId or playerId"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const walnut = this.walnuts.get(walnutId);
        if (!walnut) {
          return new Response(JSON.stringify({
            error: "Walnut not found"
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Mark as found
        walnut.found = true;
        this.walnuts.set(walnutId, walnut);
        await this.storage.put(walnutId, walnut);

        // Simple scoring
        const points = walnut.hiddenIn === 'buried' ? 3 : 1;

        return new Response(JSON.stringify({
          success: true,
          walnut: walnut,
          points: points
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to find walnut"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // MVP 9: Check for walnuts ready to grow into trees
    if (path.endsWith("/check-growth") && request.method === "POST") {
      try {
        const GROWTH_TIME_MS = 60 * 1000; // 1 minute
        const now = Date.now();
        const readyToGrow: Walnut[] = [];

        // Find player-hidden walnuts that are old enough, not found, not grown
        for (const walnut of this.walnuts.values()) {
          if (
            walnut.origin === 'player' &&
            !walnut.found &&
            !walnut.grownIntoTree &&
            (now - walnut.timestamp >= GROWTH_TIME_MS)
          ) {
            readyToGrow.push(walnut);
          }
        }

        return new Response(JSON.stringify({
          walnuts: readyToGrow
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to check growth"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // MVP 9: Mark walnut as grown into tree
    if (path.endsWith("/mark-grown") && request.method === "POST") {
      try {
        const { walnutId } = await request.json() as { walnutId: string };

        if (!walnutId) {
          return new Response(JSON.stringify({
            error: "Missing walnutId"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        const walnut = this.walnuts.get(walnutId);
        if (!walnut) {
          return new Response(JSON.stringify({
            error: "Walnut not found"
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Mark as grown
        walnut.grownIntoTree = true;
        this.walnuts.set(walnutId, walnut);
        await this.storage.put(walnutId, walnut);

        return new Response(JSON.stringify({
          success: true
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: "Failed to mark grown"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  }

  // Load all walnuts from storage
  private async loadAll(): Promise<void> {
    try {
      const walnutMap = await this.storage.list<Walnut>();
      this.walnuts = new Map(walnutMap);
    } catch (error) {
      console.error('Error loading walnuts from storage:', error);
    }
  }

  // Simple walnut validation
  private validateWalnut(walnut: any): walnut is Walnut {
    return (
      typeof walnut === 'object' &&
      walnut !== null &&
      typeof walnut.id === 'string' &&
      typeof walnut.ownerId === 'string' &&
      (walnut.origin === 'game' || walnut.origin === 'player') &&
      (walnut.hiddenIn === 'buried' || walnut.hiddenIn === 'bush') &&
      typeof walnut.location === 'object' &&
      typeof walnut.location.x === 'number' &&
      typeof walnut.location.y === 'number' &&
      typeof walnut.location.z === 'number' &&
      typeof walnut.found === 'boolean' &&
      typeof walnut.timestamp === 'number'
    );
  }
}