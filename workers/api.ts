import { getObjectInstance } from "./objects/registry";
import type { EnvWithBindings } from "./objects/registry";

// Import the Durable Objects so we can export them
import ForestManager from "./objects/ForestManager";
import SquirrelSession from "./objects/SquirrelSession";
import WalnutRegistry from "./objects/WalnutRegistry";
import Leaderboard from "./objects/Leaderboard";

// Export the Durable Objects so they can be used by the worker
export { ForestManager, SquirrelSession, WalnutRegistry, Leaderboard };

// Cloudflare Workers ExecutionContext type
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // For dev, allow all. For production, restrict as needed.
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Handle WebSocket connections
      if (pathname === "/ws") {
        // Check if this is a WebSocket upgrade request
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        // Forward the WebSocket request to the ForestManager DO
        const forest = getObjectInstance(env, "forest", "daily-forest");
        
        // Pass the request as-is to maintain WebSocket upgrade headers
        return forest.fetch(request);
      }

      // Route /join WebSocket requests to ForestManager Durable Object
      if (pathname === '/join') {
        const id = env.FOREST.idFromName('global-forest');
        const stub = env.FOREST.get(id);
        return stub.fetch(request);
      }

      // Handle /join route
      if (pathname === "/join") {
        // Get squirrelId from query string or generate a new one
        const id = url.searchParams.get("squirrelId") || crypto.randomUUID();
        
        // Create a modified request with the ID in the path
        // This ensures the ID is available even if we can't modify the original request
        const newUrl = new URL(request.url);
        newUrl.pathname = "/join";
        
        // Get SquirrelSession Durable Object instance
        const squirrel = getObjectInstance(env, "squirrel", id);
        
        // Forward the request to the Durable Object
        return await squirrel.fetch(new Request(newUrl, request));
      }

      // Handle /hide route
      if (pathname === "/hide") {
        // Get squirrelId from query string
        const id = url.searchParams.get("squirrelId");
        
        // Validate squirrelId is provided
        if (!id) {
          return new Response(JSON.stringify({
            error: "Missing squirrelId",
            message: "A squirrelId query parameter is required"
          }), { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // Create a modified request with the ID in the path
        const newUrl = new URL(request.url);
        newUrl.pathname = "/hide";
        
        // Get SquirrelSession Durable Object instance and forward the request
        const squirrel = getObjectInstance(env, "squirrel", id);
        return await squirrel.fetch(new Request(newUrl, request));
      }

      // Handle /map-state route
      if (pathname === "/map-state") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        const resp = await forest.fetch(request);
        // Clone and add CORS headers
        const headers = new Headers(resp.headers);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
        return new Response(await resp.text(), { status: resp.status, headers });
      }

      // Handle /leaderboard route
      if (pathname === "/leaderboard") {
        const leaderboard = getObjectInstance(env, "leaderboard", "global");
        return await leaderboard.fetch(request);
      }

      // Handle not found case
      return new Response(JSON.stringify({
        error: "Not found",
        message: "The requested endpoint does not exist"
      }), { 
        status: 404,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    } catch (error: unknown) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: errorMessage
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
