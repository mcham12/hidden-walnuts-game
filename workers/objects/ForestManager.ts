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
  
  // Track WebSocket connections
  activeSessions: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState, env: Record<string, unknown>) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle WebSocket upgrade requests
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocketConnection(request);
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

  handleWebSocketConnection(request: Request): Response {
    // Create WebSocket pair
    const upgradeWebSocketPair = new WebSocketPair();
    const [client, server] = Object.values(upgradeWebSocketPair);

    // Generate a unique ID for this connection
    const sessionId = crypto.randomUUID();
    
    // Accept the WebSocket connection
    server.accept();
    
    // Get request info for logging
    const url = new URL(request.url);
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Add the connection to our map of active sessions
    this.activeSessions.set(sessionId, server);
    
    console.log(`[ForestManager] 🟢 New connection: ${sessionId} from ${clientIP}. Total connections: ${this.activeSessions.size}`);
    
    // Set up event listeners
    server.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data as string);
        
        console.log(`[ForestManager] 📩 Received message from ${sessionId}: ${JSON.stringify(message)}`);
        
        // Handle ping message for testing WebSocket functionality
        if (message.type === "ping") {
          console.log(`[ForestManager] 🏓 Ping received from ${sessionId}: ${JSON.stringify(message.data)}`);
          
          // Broadcast pong message to all connected clients
          this.broadcast("pong", message.data);
          return;
        }
        
        // Process other incoming messages here
        // For now, just echo back the message with the session ID
        server.send(JSON.stringify({
          type: "echo",
          sessionId,
          data: message
        }));
        
        console.log(`[ForestManager] 🔄 Echoed message back to ${sessionId}`);
      } catch (error) {
        console.error(`[ForestManager] ❌ Error processing message from ${sessionId}:`, error);
      }
    });
    
    // Define cleanup function to ensure consistent handling
    const handleDisconnect = () => {
      // Remove the connection when it's closed
      if (this.activeSessions.has(sessionId)) {
        this.activeSessions.delete(sessionId);
        console.log(`[ForestManager] 🔴 Disconnected: ${sessionId}. Remaining connections: ${this.activeSessions.size}`);
      }
    };
    
    // Handle disconnect using both event listener and onclose property
    server.addEventListener("close", handleDisconnect);
    server.onclose = handleDisconnect;
    
    // Handle errors that might cause disconnection
    server.addEventListener("error", (event) => {
      console.error(`[ForestManager] ⚠️ WebSocket error for ${sessionId}:`, event);
      handleDisconnect();
    });
    
    // Send initial state to the client
    server.send(JSON.stringify({
      type: "init",
      sessionId,
      mapState: this.mapState
    }));
    
    console.log(`[ForestManager] 📤 Sent initial state to ${sessionId}`);
    
    // Return the client end of the WebSocket to the client
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  // Broadcast a message to all connected WebSocket clients
  broadcastMessage(message: any): void {
    const serializedMessage = JSON.stringify(message);
    console.log(`[ForestManager] 📢 Broadcasting generic message to ${this.activeSessions.size} connections: ${serializedMessage.substring(0, 100)}${serializedMessage.length > 100 ? '...' : ''}`);
    
    let successCount = 0;
    for (const [sessionId, socket] of this.activeSessions.entries()) {
      try {
        socket.send(serializedMessage);
        successCount++;
      } catch (error) {
        console.error(`[ForestManager] ❌ Error sending to socket ${sessionId}:`, error);
        // Remove the broken connection
        this.activeSessions.delete(sessionId);
      }
    }
    
    console.log(`[ForestManager] ✅ Successfully sent to ${successCount}/${this.activeSessions.size} connections`);
  }
  
  // Broadcast an event with type and data to all connected clients
  broadcast(type: string, data: object): void {
    const message = { type, data };
    const serializedMessage = JSON.stringify(message);
    
    // First log with a timestamp for debugging
    const timestamp = new Date().toISOString();
    console.log(`[ForestManager] 📢 ${timestamp} Broadcasting '${type}' event to ${this.activeSessions.size} connections`);
    
    let successCount = 0;
    let startTime = performance.now();
    
    for (const [sessionId, socket] of this.activeSessions.entries()) {
      try {
        socket.send(serializedMessage);
        successCount++;
      } catch (error) {
        console.error(`[ForestManager] ❌ Error broadcasting to socket ${sessionId}:`, error);
        // Remove the broken connection
        this.activeSessions.delete(sessionId);
      }
    }
    
    let duration = Math.round(performance.now() - startTime);
    console.log(`[ForestManager] ✅ Broadcast complete: ${successCount}/${this.activeSessions.size} connections received '${type}' (${duration}ms)`);
  }

  async resetMap(): Promise<void> {
    this.cycleStartTime = Date.now();
    this.mapState = this.generateWalnuts();
    await this.storage.put("cycleStart", this.cycleStartTime);
    await this.storage.put("mapState", this.mapState);
    
    // Notify all connected clients about the map reset using the new broadcast method
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
