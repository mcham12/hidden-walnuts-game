// AI NOTE:
// This Durable Object manages the state of the daily forest map.
// It is responsible for spawning system-generated walnuts, resetting the map every 24 hours,
// tracking walnut activity (for hot zones), and handling Nut Rush mini-events.
// Each day is identified by a cycle key like "2025-05-03".
// This object should also maintain a list of walnut spawn locations and recent actions.

import { POINTS, CYCLE_DURATION_SECONDS, NUT_RUSH_INTERVAL_HOURS, NUT_RUSH_DURATION_MINUTES } from "../constants";
import type { Walnut, WalnutOrigin, HidingMethod } from "../types";

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
  
  // Use only sessions for WebSocket management
  sessions: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade") || "";
    const url = new URL(request.url);
    const path = url.pathname;

    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*', // For dev, allow all. For production, restrict as needed.
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight CORS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // Handle WebSocket upgrade requests (do NOT add CORS headers here)
    if (request.method === "GET" && upgradeHeader.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      await this.handleWebSocket(server);
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (path.endsWith("/reset")) {
      console.log("Handling /reset for DO ID:", this.state.id.toString());
      this.cycleStartTime = Date.now();
      // Reset mapState to a single test-walnut at origin
      this.mapState = [{
        id: "test-walnut",
        ownerId: "system",
        origin: "game" as WalnutOrigin,
        hiddenIn: "buried" as HidingMethod,
        location: { x: 0, y: 0, z: 0 },
        found: false,
        timestamp: Date.now()
      }];
      await this.storage.put("cycleStart", this.cycleStartTime);
      await this.storage.put("mapState", this.mapState);
      this.broadcast("map_reset", { mapState: this.mapState });
      return new Response(JSON.stringify({ message: "Map reset and walnuts respawned." }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    if (path.endsWith("/hotzones")) {
      const zones = await this.getRecentActivity();
      return new Response(JSON.stringify(zones), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    if (path.endsWith("/state") || path.endsWith("/map-state")) {
      await this.initialize(); // Ensure mapState is loaded
      return new Response(JSON.stringify(this.mapState), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    console.log(`Incoming request: ${request.method} ${url.pathname}`);

    if (path === "/join" && request.method === "GET") {
      const squirrelId = url.searchParams.get('squirrelId') ?? crypto.randomUUID();
      console.log(`Handling WebSocket join for: ${squirrelId}`);
      const [client, server] = Object.values(new WebSocketPair());
      this.handleSocket(server, squirrelId);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (path === "/find" && request.method === "POST") {
      const { walnutId, squirrelId } = await request.json() as { walnutId?: string, squirrelId?: string };
      if (!walnutId || !squirrelId) return new Response(JSON.stringify({ error: "Missing walnutId or squirrelId" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
      return this.handleFind(walnutId, squirrelId);
    }
    if (path === "/rehide" && request.method === "POST") {
      const { walnutId, squirrelId, location } = await request.json() as { walnutId?: string, squirrelId?: string, location?: { x: number, y: number, z: number } };
      if (!walnutId || !squirrelId || !location) return new Response(JSON.stringify({ error: "Missing walnutId, squirrelId, or location" }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
      return this.handleRehide(walnutId, squirrelId, location);
    }

    if (path === "/rehide-test" && request.method === "POST") {
      console.log("Handling /rehide-test for DO ID:", this.state.id.toString());
      await this.initialize();

      const testWalnutId = "test-walnut";
      const newLocation = {
        x: Math.random() * 20,
        y: 0,
        z: Math.random() * 20
      };

      // Ensure only one test-walnut exists in mapState
      const walnutIndex = this.mapState.findIndex(w => w.id === testWalnutId);
      if (walnutIndex !== -1) {
        // Update existing walnut's location
        this.mapState[walnutIndex].location = newLocation;
        console.log(`Updated test-walnut location to:`, newLocation);
      } else {
        // Add new test walnut without replacing mapState
        this.mapState.push({
          id: testWalnutId,
          ownerId: "system",
          origin: "game" as WalnutOrigin,
          hiddenIn: "bush" as HidingMethod,
          location: newLocation,
          found: false,
          timestamp: Date.now()
        });
        console.log(`Added new test-walnut with location:`, newLocation);
      }

      await this.persistMapState();

      const msg = JSON.stringify({
        type: "walnut-rehidden",
        walnutId: testWalnutId,
        location: newLocation
      });

      for (const session of this.sessions.values()) {
        try {
          session.send(msg);
          console.log(`Sent walnut-rehidden message to session:`, msg);
        } catch (err) {
          console.warn("Failed to send to session:", err);
        }
      }

      return new Response(JSON.stringify({ message: "Rehidden test message sent", newLocation }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // Fallback (should not happen during WebSocket connection)
    console.log('No matching route — returning 404');
    return new Response('Not Found', {
      status: 404,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  handleSocket(socket: WebSocket, squirrelId: string): void {
    this.sessions.add(socket);
    
    socket.accept();
    
    console.log(`[ForestManager] 🚀 New connection: ${squirrelId}. Total connections: ${this.sessions.size}`);

    socket.addEventListener("open", () => {
      console.log(`[ForestManager] WebSocket opened for ${squirrelId}`);
    });

    this.initialize().then(() => {
      socket.send(JSON.stringify({
        type: "init",
        mapState: this.mapState
      }));
    });
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        console.log(`[ForestManager] 📩 Received message: ${JSON.stringify(message)}`);
        
        if (message.type === "ping") {
          console.log(`[ForestManager] 🏓 Ping received: ${JSON.stringify(message.data)}`);
          this.broadcast("pong", message.data);
          return;
        }
        
        this.broadcastExceptSender(squirrelId, event.data);
      } catch (error) {
        console.error(`[ForestManager] ❌ Error processing message:`, error);
      }
    };
    
    socket.onclose = () => {
      this.sessions.delete(socket);
      console.log(`[ForestManager] 🔴 Disconnected. Remaining connections: ${this.sessions.size}`);
    };
    
    socket.onerror = (event) => {
      console.error(`[ForestManager] ⚠️ WebSocket error:`, event);
    };
  }

  private async handleWebSocket(ws: WebSocket) {
    ws.accept();
    this.sessions.add(ws);
    console.log("WebSocket accepted and added to sessions. Total sessions:", this.sessions.size);
    console.log("DO ID for WebSocket:", this.state.id.toString());

    ws.addEventListener("open", () => {
      console.log(`[ForestManager] WebSocket opened`);
    });

    await this.initialize();
    ws.send(JSON.stringify({
      type: "init",
      mapState: this.mapState
    }));

    ws.addEventListener("message", (event) => {});
    ws.onclose = () => {
      this.sessions.delete(ws);
      console.log(`[ForestManager] 🔴 Disconnected. Remaining connections: ${this.sessions.size}`);
    };
  }

  broadcast(type: string, data: object): void {
    const message = { type, data };
    const serializedMessage = JSON.stringify(message);
    
    console.log(`[ForestManager] 📢 Broadcasting '${type}' event to ${this.sessions.size} connections`);
    
    let successCount = 0;
    for (const socket of this.sessions) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(serializedMessage);
          successCount++;
          console.log(`[ForestManager] Successfully sent '${type}' to a session`);
        } else {
          console.warn(`[ForestManager] Socket is not open (state: ${socket.readyState})`);
        }
      } catch (error) {
        console.error(`[ForestManager] ❌ Error broadcasting:`, error);
      }
    }
    
    console.log(`[ForestManager] ✅ Broadcast complete: ${successCount}/${this.sessions.size} connections received '${type}'`);
  }

  broadcastExceptSender(senderId: string, message: string | ArrayBuffer) {
    for (const socket of this.sessions) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  async resetMap(): Promise<void> {
    this.cycleStartTime = Date.now();
    this.mapState = this.generateWalnuts();
    await this.storage.put("cycleStart", this.cycleStartTime);
    await this.storage.put("mapState", this.mapState);
    
    // Notify all connected clients about the map reset 
    this.broadcast("map_reset", { mapState: this.mapState });
  }

  generateWalnuts(count: number = 100): Walnut[] {
    const walnuts: Walnut[] = [];
    for (let i = 0; i < count; i++) {
      walnuts.push({
        id: `sys-${crypto.randomUUID()}`,
        ownerId: "system",
        origin: "game" as WalnutOrigin,
        hiddenIn: Math.random() < 0.5 ? "buried" as HidingMethod : "bush" as HidingMethod,
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

  // Stub for handleFind
  handleFind(walnutId: string, squirrelId: string): Response {
    return new Response(`handleFind called with walnutId=${walnutId}, squirrelId=${squirrelId}`);
  }

  // Stub for handleRehide
  handleRehide(walnutId: string, squirrelId: string, location: { x: number, y: number, z: number }): Response {
    return new Response(`handleRehide called with walnutId=${walnutId}, squirrelId=${squirrelId}, location=${JSON.stringify(location)}`);
  }

  private async initialize(): Promise<void> {
    const storedMapState = await this.storage.get('mapState');
    if (storedMapState) {
      this.mapState = Array.isArray(storedMapState) ? storedMapState : [];
      console.log('Loaded mapState from storage:', this.mapState);
    }
    if (this.mapState.length === 0 || !this.mapState.some(w => w.id === "test-walnut")) {
      const testWalnut: Walnut = {
        id: "test-walnut",
        ownerId: "system",
        origin: "game" as WalnutOrigin,
        hiddenIn: "buried" as HidingMethod,
        location: { x: 0, y: 0, z: 0 },
        found: false,
        timestamp: Date.now()
      };
      if (this.mapState.length === 0) {
        this.mapState = [testWalnut];
      } else {
        this.mapState.push(testWalnut);
      }
      await this.storage.put('mapState', this.mapState);
      console.log('Seeded test walnut:', testWalnut);
    }
  }

  private async persistMapState(): Promise<void> {
    await this.storage.put("mapState", this.mapState);
  }
}