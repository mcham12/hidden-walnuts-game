// API entry point for Hidden Walnuts game - Simplified
// MVP 7.1: Bot protection with Turnstile and rate limiting

import { getObjectInstance } from "./objects/registry";
import type { EnvWithBindings } from "./objects/registry";

// Import the Durable Objects so we can export them
import ForestManager from "./objects/ForestManager";
import SquirrelSession from "./objects/SquirrelSession";
import WalnutRegistry from "./objects/WalnutRegistry";
import Leaderboard from "./objects/Leaderboard";
import { PlayerIdentity } from "./objects/PlayerIdentity";

// Export the Durable Objects so they can be used by the worker
export { ForestManager, SquirrelSession, WalnutRegistry, Leaderboard, PlayerIdentity };

// Cloudflare Workers ExecutionContext type
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Simple CORS headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {
    
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
        return forest.fetch(request);
      }

      // MVP 6: Handle /api/identity routes (player identity management)
      // FIXED: Use username as DO ID (not sessionToken) for private browsing support
      if (pathname.startsWith("/api/identity")) {
        const username = url.searchParams.get('username');

        if (!username) {
          return new Response(JSON.stringify({ error: 'Missing username' }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        // Get PlayerIdentity Durable Object instance (one per username)
        // This ensures same username = same identity, even across browser sessions
        const id = env.PLAYER_IDENTITY.idFromName(username);
        const stub = env.PLAYER_IDENTITY.get(id);

        // Forward request to PlayerIdentity DO
        const response = await stub.fetch(request);

        // Add CORS headers
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      // Handle /join route
      if (pathname === "/join") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        const response = await forest.fetch(request);
        
        // Add CORS headers
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
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


      // Handle /api/leaderboard routes (MVP 8)
      if (pathname.startsWith("/api/leaderboard")) {
        const leaderboard = getObjectInstance(env, "leaderboard", "global");
        const response = await leaderboard.fetch(request);

        // Add CORS headers
        return new Response(response.body, {
          status: response.status,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json"
          }
        });
      }

      // Handle /admin/reset-mapstate route
      if (pathname === "/admin/reset-mapstate") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        return await forest.fetch(request);
      }

      // Handle /admin/reset-forest route
      if (pathname === "/admin/reset-forest") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        return await forest.fetch(request);
      }

      // Handle /admin/reset-positions route
      if (pathname === "/admin/reset-positions") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        return await forest.fetch(request);
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
      console.error('Error handling request:', errorMessage);
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
