import { getObjectInstance } from "./objects/registry";
import type { EnvWithBindings } from "./objects/registry";

export default {
  async fetch(request: Request, env: EnvWithBindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Example: /join?squirrelId=abc123
    if (pathname === "/join") {
      const id = url.searchParams.get("squirrelId") || crypto.randomUUID();
      const squirrel = getObjectInstance(env, "squirrel", id);
      return squirrel.fetch(request);
    }

    if (pathname === "/hide") {
      const id = url.searchParams.get("squirrelId");
      if (!id) return new Response("Missing squirrelId", { status: 400 });
      const squirrel = getObjectInstance(env, "squirrel", id);
      return squirrel.fetch(request);
    }

    if (pathname === "/map-state") {
      const forest = getObjectInstance(env, "forest", "daily-forest");
      return forest.fetch(request);
    }

    if (pathname === "/leaderboard") {
      const leaderboard = getObjectInstance(env, "leaderboard", "global");
      return leaderboard.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
