import { ForestManager } from "../api/ForestManager";
import { SquirrelSession } from "../api/SquirrelSession";
import { Request as CfRequest } from '@cloudflare/workers-types';

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const forestManager = new ForestManager(env.FOREST_MANAGER);
    return await forestManager.fetch(request as unknown as CfRequest);
  },
  durable_object_namespace: {
    ForestManager,
    SquirrelSession,
  }
}; 