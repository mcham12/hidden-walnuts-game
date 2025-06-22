import { ForestManager } from './objects/ForestManager';
import { getObjectInstance, EnvWithBindings } from './objects/registry';
import SquirrelSession from "./objects/SquirrelSession";
import WalnutRegistry from "./objects/WalnutRegistry";
import Leaderboard from "./objects/Leaderboard";

// Export the Durable Objects so they can be used by the worker......
export { ForestManager, SquirrelSession, WalnutRegistry, Leaderboard };

// Cloudflare Workers ExecutionContext type
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Ensure CORS headers are applied consistently
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

interface Env extends EnvWithBindings {
  SQUIRREL: DurableObjectNamespace;
  FOREST: DurableObjectNamespace;
  WALNUT: DurableObjectNamespace;
  LEADERBOARD: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: EnvWithBindings): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/join') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader === 'websocket') {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        console.log('Forwarding WebSocket /join request to ForestManager');
        return await forest.fetch(request);
      } else {
        const id = url.searchParams.get('squirrelId') || crypto.randomUUID();
        const token = crypto.randomUUID();
        const squirrel = env.SQUIRREL.get(env.SQUIRREL.idFromName(id));
        const joinUrl = new URL(request.url);
        joinUrl.pathname = '/join';
        const response = await squirrel.fetch(new Request(joinUrl, { method: 'GET' }));
        const data = await response.json();
        return new Response(JSON.stringify({ squirrelId: id, token }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // Consolidated routing for terrain-seed and ws endpoints
      if (pathname === "/terrain-seed" || pathname === "/ws") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        return forest.fetch(request);
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

      // Handle /forest-objects route
      if (pathname === "/forest-objects") {
        try {
          const forest = getObjectInstance(env, "forest", "daily-forest");
          console.log("Fetching forest objects from ForestManager");
          const resp = await forest.fetch(request);
          const result = await resp.text();
          console.log("Forest objects response:", result);
          return new Response(result, {
            status: resp.status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        } catch (error) {
          console.error('Error in /forest-objects route:', error);
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        }
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
