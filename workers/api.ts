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
        // This shouldn't happen anymore since we use /ws, but handle it
        const forest = getObjectInstance(env, "forest", "daily-forest");
        console.log('Forwarding WebSocket /join request to ForestManager');
        return await forest.fetch(request);
      } else {
        // FIX: HTTP /join request - generate token and create authenticated squirrel session
        const id = url.searchParams.get('squirrelId') || crypto.randomUUID();
        
        try {
          const squirrel = env.SQUIRREL.get(env.SQUIRREL.idFromName(id));
          
          // First create the session
          const joinUrl = new URL(request.url);
          joinUrl.pathname = '/join';
          const joinResponse = await squirrel.fetch(new Request(joinUrl, { method: 'GET' }));
          
          if (!joinResponse.ok) {
            console.error('Failed to create squirrel session');
            return new Response('Failed to create session', { status: 500 });
          }
          
          // Then generate and store the token
          const tokenResponse = await squirrel.fetch(new Request('https://internal/generate-token', { method: 'POST' }));
          const token = await tokenResponse.text();
          
          console.log(`[Log] ✅ Created authenticated session for ${id} with token`);
          
          // Return token with correct structure (id field, not token field)
          return new Response(JSON.stringify({ id: token, squirrelId: id }), {
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        } catch (error) {
          console.error('Error creating authenticated squirrel session:', error);
          // FIX: Don't return mock tokens on error - this was a security hole
          return new Response(JSON.stringify({ error: 'Failed to create session' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
          });
        }
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
      // Handle /ws endpoint - forward directly to ForestManager
      if (pathname === "/ws") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        return forest.fetch(request);
      }

      // Handle terrain-seed endpoint
      if (pathname === "/terrain-seed") {
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
