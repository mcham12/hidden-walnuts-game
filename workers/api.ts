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

// Ensure CORS headers are applied consistently
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // Allow all origins (adjust for production if needed)
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle preflight CORS requests globally
    if (request.method === 'OPTIONS') {
      console.log('Handling OPTIONS request for', url.pathname);
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

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
        console.log('Forwarding WebSocket request to ForestManager');
        return forest.fetch(request);
      }

      // Route /join WebSocket requests to ForestManager Durable Object
      if (pathname === '/join') {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        console.log('Forwarding /join request to ForestManager');
        return await forest.fetch(request);
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
        try {
          const forest = getObjectInstance(env, "forest", "daily-forest");
          console.log("Fetching map state from ForestManager");
          const resp = await forest.fetch(request);
          const result = await resp.text();
          console.log("Map state response:", result);
          return new Response(result, { 
            status: resp.status, 
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        } catch (error: any) {
          console.error('Error in /map-state route:', error);
          return new Response(JSON.stringify({ error: 'Internal Server Error', message: error?.message || 'Unknown error' }), {
            status: 500,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }
      }

      // Handle /leaderboard route
      if (pathname === "/leaderboard") {
        const leaderboard = getObjectInstance(env, "leaderboard", "global");
        console.log("Fetching leaderboard data");
        return await leaderboard.fetch(request);
      }

      // Forward /rehide-test to ForestManager DO
      if (pathname === "/rehide-test") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        console.log("Forwarding /rehide-test request to ForestManager");
        const response = await forest.fetch(request);
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      // Add route for /reset
      if (pathname === "/reset") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        console.log("Resetting forest");
        const response = await forest.fetch(request);
        const result = await response.json();
        return new Response(JSON.stringify(result), {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      // Handle not found case
      console.log("No matching route for:", pathname);
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
      // Handle unexpected errors with detailed logging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error handling request:', {
        path: pathname,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: errorMessage
      }), { 
        status: 500,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json"
        }
      });
    }
  }
};
