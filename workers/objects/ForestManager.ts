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
  
  // Track WebSocket connections directly with a Set
  sockets: Set<WebSocket> = new Set();

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade requests
    if (request.headers.get("Upgrade") === "websocket") {
      const upgradeWebSocketPair = new WebSocketPair();
      const [client, server] = Object.values(upgradeWebSocketPair);
      
      // Handle the WebSocket server-side - IMPORTANT: This must be done before returning the response
      this.handleSocket(server);
      
      // Return the client end of the WebSocket to the client
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

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

  handleSocket(socket: WebSocket): void {
    // Add the socket to our set of active sockets
    this.sockets.add(socket);
    
    // Accept the WebSocket connection
    socket.accept();
    
    // Generate a session ID for this connection
    const sessionId = crypto.randomUUID();
    
    console.log(`[ForestManager] 🟢 New connection: ${sessionId}. Total connections: ${this.sockets.size}`);
    
    // --- MVP 2.5 Task 7: Send at least one test walnut if mapState is empty ---
    let mapStateToSend = this.mapState;
    if (!mapStateToSend || mapStateToSend.length === 0) {
      mapStateToSend = [
        {
          id: `test-walnut-1`,
          ownerId: "system",
          origin: "game",
          hiddenIn: "buried",
          location: { x: 10, y: 0, z: 10 },
          found: false,
          timestamp: Date.now()
        },
        {
          id: `test-walnut-2`,
          ownerId: "system",
          origin: "game",
          hiddenIn: "bush",
          location: { x: 20, y: 0, z: 20 },
          found: false,
          timestamp: Date.now()
        }
      ];
    }
    // --- End Task 7 addition ---
    // Send initial state to the client
    socket.send(JSON.stringify({
      type: "init",
      sessionId,
      mapState: mapStateToSend
    }));
    
    // Set up message handler using onmessage property
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        
        console.log(`[ForestManager] 📩 Received message: ${JSON.stringify(message)}`);
        
        // Handle ping message for testing WebSocket functionality
        if (message.type === "ping") {
          console.log(`[ForestManager] 🏓 Ping received: ${JSON.stringify(message.data)}`);
          
          // Broadcast pong message to all connected clients
          this.broadcast("pong", message.data);
          return;
        }
        
        // Process other incoming messages here
        // For now, just echo back the message with the session ID
        socket.send(JSON.stringify({
          type: "echo",
          sessionId,
          data: message
        }));
      } catch (error) {
        console.error(`[ForestManager] ❌ Error processing message:`, error);
      }
    };
    
    // Set up close handler using onclose property
    socket.onclose = () => {
      // Remove the socket from our set
      this.sockets.delete(socket);
      console.log(`[ForestManager] 🔴 Disconnected. Remaining connections: ${this.sockets.size}`);
    };
    
    // Set up error handler using onerror property
    socket.onerror = (event) => {
      console.error(`[ForestManager] ⚠️ WebSocket error:`, event);
      // The socket will automatically be closed by Cloudflare on error
    };
  }
  
  // Broadcast an event with type and data to all connected clients
  broadcast(type: string, data: object): void {
    const message = { type, data };
    const serializedMessage = JSON.stringify(message);
    
    console.log(`[ForestManager] 📢 Broadcasting '${type}' event to ${this.sockets.size} connections`);
    
    let successCount = 0;
    for (const socket of this.sockets) {
      try {
        socket.send(serializedMessage);
        successCount++;
      } catch (error) {
        console.error(`[ForestManager] ❌ Error broadcasting to socket:`, error);
        // The socket will be removed in the onclose handler when it fails
      }
    }
    
    console.log(`[ForestManager] ✅ Broadcast complete: ${successCount}/${this.sockets.size} connections received '${type}'`);
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
