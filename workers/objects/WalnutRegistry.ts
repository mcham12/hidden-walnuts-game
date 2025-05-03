// AI NOTE:
// This Durable Object stores and manages the state of all walnuts in the current forest cycle.
// It tracks their location, whether they are found or re-hidden, and who owns them.
// Called by SquirrelSession (to add player-hidden walnuts) and ForestManager (to register game walnuts).
// It may also support stealing/re-hiding and hot zone analytics.

import type { Walnut } from "../types";

export default class WalnutRegistry {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  walnuts: Map<string, Walnut> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.endsWith("/add") && request.method === "POST") {
      const walnut = await request.json() as Walnut;
      this.walnuts.set(walnut.id, walnut);
      await this.storage.put(walnut.id, walnut);
      return new Response(`Walnut ${walnut.id} added.`);
    }

    if (path.endsWith("/all")) {
      const all = Array.from(this.walnuts.values());
      return new Response(JSON.stringify(all), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (path.endsWith("/reset")) {
      await this.storage.deleteAll();
      this.walnuts.clear();
      return new Response("All walnuts reset.");
    }

    return new Response("Not found", { status: 404 });
  }

  async loadAll(): Promise<void> {
    const entries = await this.storage.list<Walnut>();
    for (const [key, walnut] of entries) {
      this.walnuts.set(key, walnut);
    }
  }

  async alarm(): Promise<void> {
    // Optional: for pruning, analytics, or backup logic
  }
}
