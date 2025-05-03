import { getObjectInstance } from "./objects/registry";
import type { EnvWithBindings } from "./objects/registry";

// Cloudflare Workers ExecutionContext type
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
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
        return await forest.fetch(request);
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
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      // Handle unexpected errors
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: error.message
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
