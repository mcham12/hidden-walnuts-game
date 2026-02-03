// API entry point for Hidden Walnuts game - Simplified
// MVP 7.1: Bot protection with Turnstile and rate limiting
// MVP 16: Authentication system with JWT sessions
// Deployment test: 2026-02-03 - Verified new environment setup

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
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // Normalize path: remove /api prefix if present to handle both direct and proxied requests
    // e.g. /api/auth/signup -> /auth/signup
    const normalizedPath = pathname.startsWith('/api') ? pathname.substring(4) : pathname;

    try {
      // Handle WebSocket connections
      if (normalizedPath === "/ws") {
        // Check if this is a WebSocket upgrade request
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected Upgrade: websocket', { status: 426 });
        }

        // Forward the WebSocket request to the ForestManager DO
        const forest = getObjectInstance(env, "forest", "daily-forest");

        // Optimization: Only rewrite URL if path actually changed
        // This preserves internal Cloudflare WebSocket flags on the original request
        if (pathname !== normalizedPath) {
          const newUrl = new URL(request.url);
          newUrl.pathname = normalizedPath;
          return forest.fetch(new Request(newUrl, request));
        }

        return forest.fetch(request);
      }

      // MVP 16: Handle /auth/* routes (authentication system)
      // Transform /auth/signup → PlayerIdentity DO with action=signup
      if (normalizedPath.startsWith("/auth/")) {
        const action = normalizedPath.replace("/auth/", "");

        // For most auth actions, we need to extract email/username from request body
        let identifier: string | null = null;

        try {
          const bodyText = await request.text();
          const body = bodyText ? JSON.parse(bodyText) : {};
          console.log('🔍 Auth route body:', JSON.stringify(body));

          // Different actions use different identifiers (unchanged)
          if (action === 'signup' || action === 'login' || action === 'requestPasswordReset') {
            identifier = body.email || body.username;
          } else if (action === 'refreshToken' || action === 'logout' || action === 'logoutAll' || action === 'changePassword') {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
              identifier = body.username || body.email;
            }
          } else if (action === 'verifyEmail' || action === 'verify-email' || action === 'resetPassword') {
            // For verifyEmail we can use the email if supplied
            identifier = body.email || body.username;
          } else if (action === 'resend-verification') {
            if (body.email) {
              identifier = body.email;
            }
          }

          // If identifier is missing (and not a verifyEmail request) return error
          if (!identifier && action !== 'verifyEmail' && action !== 'verify-email') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing identifier',
              message: 'Email or username required for this action'
            }), {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
            });
          }

          // Normalise identifier when present
          if (identifier) {
            identifier = identifier.toLowerCase().trim();
          }

          // Get PlayerIdentity DO instance (one per email/username) when we have an identifier
          const id = identifier ? env.PLAYER_IDENTITY.idFromName(identifier) : null;
          const stub = id ? env.PLAYER_IDENTITY.get(id) : null;

          // Normalize action name for DO (verify-email -> verifyEmail)
          const doAction = action === 'verify-email' ? 'verifyEmail' : action;

          // Create new URL with action parameter
          const newUrl = new URL(request.url);
          newUrl.searchParams.set('action', doAction);
          newUrl.pathname = '/api/identity'; // PlayerIdentity doesn't check path, but keeping it consistent

          // Recreate request with modified URL and original body
          const newRequest = new Request(newUrl, {
            method: request.method,
            headers: request.headers,
            body: bodyText || undefined
          });

          // Forward to PlayerIdentity DO (if stub exists)
          const response = await (stub ? stub.fetch(newRequest) : fetch(newRequest));

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

      // MVP 6: Handle /identity routes (player identity management)
      // FIXED: Use username as DO ID (not sessionToken) for private browsing support
      if (normalizedPath.startsWith("/identity")) {
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
        // Rewrite URL to strip /api prefix
        const newUrl = new URL(request.url);
        newUrl.pathname = normalizedPath;
        const response = await stub.fetch(new Request(newUrl, request));

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
      if (normalizedPath === "/join") {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        // Rewrite URL to strip /api prefix
        const newUrl = new URL(request.url);
        newUrl.pathname = normalizedPath;
        const response = await forest.fetch(new Request(newUrl, request));

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
      if (normalizedPath === "/hide") {
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


      // Handle /leaderboard routes (MVP 8)
      if (normalizedPath.startsWith("/leaderboard")) {
        const leaderboard = getObjectInstance(env, "leaderboard", "global");
        // Rewrite URL to strip /api prefix
        const newUrl = new URL(request.url);
        newUrl.pathname = normalizedPath;
        const response = await leaderboard.fetch(new Request(newUrl, request));

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
      if (normalizedPath.startsWith("/admin/")) {
        const forest = getObjectInstance(env, "forest", "daily-forest");
        // Rewrite URL to strip /api prefix
        const newUrl = new URL(request.url);
        newUrl.pathname = normalizedPath;
        return await forest.fetch(new Request(newUrl, request));
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
