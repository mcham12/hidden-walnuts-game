// API entry point for Hidden Walnuts game - Simplified
// MVP 7.1: Bot protection with Turnstile and rate limiting
// MVP 16: Authentication system with JWT sessions
// Deployment test: 2025-11-05 - Verifying Phase 2 client compatibility

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

// Cloudflare Workers ScheduledEvent type (for cron triggers)
interface ScheduledEvent {
  scheduledTime: number; // Unix timestamp in milliseconds
  cron: string; // Cron expression that triggered this event
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

      // MVP 16: Handle /auth/* routes (authentication system)
      // Transform /auth/signup → PlayerIdentity DO with action=signup
      if (pathname.startsWith("/auth/")) {
        const action = pathname.replace("/auth/", "");

        // For most auth actions, we need to extract email/username from request body
        let identifier: string | null = null;

        try {
          const bodyText = await request.text();
          const body = bodyText ? JSON.parse(bodyText) : {};

          // Different actions use different identifiers
          if (action === 'signup' || action === 'login' || action === 'requestPasswordReset') {
            identifier = body.email || body.username;
          } else if (action === 'refreshToken' || action === 'logout' || action === 'logoutAll' || action === 'changePassword') {
            // These require JWT token in Authorization header
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
              const token = authHeader.substring(7);
              // We'll need to decode the JWT to get the username
              // For now, extract from body if available
              identifier = body.username || body.email;
            }
          } else if (action === 'verifyEmail' || action === 'resetPassword') {
            // These use tokens, extract username from body or token
            identifier = body.username || body.email;
          }

          if (!identifier) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing identifier',
              message: 'Email or username required for this action'
            }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
          }

          // Get PlayerIdentity DO instance (one per email/username)
          const id = env.PLAYER_IDENTITY.idFromName(identifier);
          const stub = env.PLAYER_IDENTITY.get(id);

          // Create new URL with action parameter
          const newUrl = new URL(request.url);
          newUrl.searchParams.set('action', action);
          newUrl.pathname = '/api/identity';

          // Recreate request with modified URL and original body
          const newRequest = new Request(newUrl, {
            method: request.method,
            headers: request.headers,
            body: bodyText || undefined
          });

          // Forward to PlayerIdentity DO
          const response = await stub.fetch(newRequest);

          // Add CORS headers
          return new Response(response.body, {
            status: response.status,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json"
            }
          });
        } catch (error) {
          console.error('Auth route error:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid request',
            message: error instanceof Error ? error.message : 'Failed to process request'
          }), {
            status: 400,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
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

      // MVP 13: Handle all /admin routes - forward to ForestManager
      if (pathname.startsWith("/admin/")) {
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
  },

  // MVP 15: Cron handler for daily game resets and weekly leaderboard resets
  // Daily: 8am UTC (2am CST) - reset mapstate, forest, positions
  // Weekly: Sunday 8:05am UTC (2:05am CST) - reset leaderboard
  async scheduled(event: ScheduledEvent, env: EnvWithBindings, ctx: ExecutionContext): Promise<void> {
    const triggerTime = new Date(event.scheduledTime);
    console.log(`⏰ Cron triggered: ${triggerTime.toISOString()}`);

    try {
      const dayOfWeek = triggerTime.getUTCDay(); // 0 = Sunday
      const hour = triggerTime.getUTCHours();
      const minute = triggerTime.getUTCMinutes();

      // Weekly leaderboard reset: Sunday at 8:05am UTC
      if (dayOfWeek === 0 && hour === 8 && minute === 5) {
        console.log(`📊 Running weekly leaderboard reset...`);
        const leaderboard = getObjectInstance(env, "leaderboard", "global-leaderboard") as unknown as Leaderboard;
        await leaderboard.scheduledReset();
        console.log(`✅ Weekly leaderboard reset completed`);
      }
      // Daily game reset: Every day at 8am UTC
      else if (hour === 8 && minute === 0) {
        console.log(`🌲 Running daily game reset...`);
        const forest = getObjectInstance(env, "forest", "daily-forest") as unknown as ForestManager;

        // Create admin requests for each reset operation
        const resetMapStateReq = new Request("https://internal/admin/reset-mapstate", {
          method: "POST",
          headers: { "X-Admin-Secret": env.ADMIN_SECRET }
        });

        const resetForestReq = new Request("https://internal/admin/reset-forest", {
          method: "POST",
          headers: { "X-Admin-Secret": env.ADMIN_SECRET }
        });

        const resetPositionsReq = new Request("https://internal/admin/reset-positions", {
          method: "POST",
          headers: { "X-Admin-Secret": env.ADMIN_SECRET }
        });

        // Execute resets sequentially
        await forest.fetch(resetMapStateReq);
        console.log(`  ✓ Map state reset (golden walnuts)`);

        await forest.fetch(resetForestReq);
        console.log(`  ✓ Forest objects reset`);

        await forest.fetch(resetPositionsReq);
        console.log(`  ✓ Player positions reset`);

        console.log(`✅ Daily game reset completed`);
      } else {
        console.log(`⚠️ Cron triggered at unexpected time: ${triggerTime.toISOString()}`);
      }
    } catch (error) {
      console.error(`❌ Scheduled task failed:`, error);
    }
  }
};
