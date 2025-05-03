// AI NOTE:
// This Durable Object tracks a single player's state during a daily forest cycle.
// It stores their score, participation time, multiplier, power-up usage, hidden and found walnuts.
// It delegates walnut tracking to the WalnutRegistry and updates the map through ForestManager.
// This object must persist score and session data across reconnects during the 24-hour cycle.

import { POINTS, PARTICIPATION_INTERVAL_SECONDS, PARTICIPATION_MAX_MULTIPLIER } from "../constants";
import type { Squirrel, Walnut } from "../types";
import { getObjectInstance } from "./registry";
import type { EnvWithBindings } from "./registry";

export default class SquirrelSession {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env!: EnvWithBindings;
  squirrel: Squirrel | null = null;

  constructor(state: DurableObjectState, env: EnvWithBindings) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();

    if (!this.squirrel) {
      this.squirrel = await this.storage.get<Squirrel>("session");
      if (!this.squirrel) {
        const id = this.state.id.toString();
        this.squirrel = {
          id,
          joinedAt: now,
          lastSeen: now,
          participationSeconds: 0,
          multiplier: 1.0,
          powerUps: {},
          hiddenWalnuts: [],
          foundWalnuts: [],
          score: 0,
          firstFinderAchieved: false
        };
      }
    }

    if (path.endsWith("/join")) {
      await this.save();
      return new Response(JSON.stringify(this.squirrel), { headers: { "Content-Type": "application/json" } });
    }

    if (path.endsWith("/hide")) {
      const body = await request.json();
      const walnut: Walnut = {
        id: `p-${crypto.randomUUID()}`,
        ownerId: this.squirrel.id,
        origin: "player",
        hiddenIn: body.hiddenIn, // "buried" or "bush"
        location: body.location, // { x, y, z }
        found: false,
        timestamp: now
      };
      const registry = getObjectInstance(this.env, "walnuts", "global");
      await registry.fetch(new Request("https://internal/add", {
        method: "POST",
        body: JSON.stringify(walnut)
      }));
      this.squirrel.hiddenWalnuts.push(walnut.id);
      await this.save();
      return new Response("Walnut hidden");
    }

    if (path.endsWith("/ping")) {
      await this.updateParticipation();
      await this.save();
      return new Response("Participation updated");
    }

    return new Response("Not found", { status: 404 });
  }

  async updateParticipation(): Promise<void> {
    const now = Date.now();
    const elapsed = Math.floor((now - this.squirrel.lastSeen) / 1000);
    this.squirrel.participationSeconds += elapsed;
    this.squirrel.lastSeen = now;

    const step = Math.floor(this.squirrel.participationSeconds / PARTICIPATION_INTERVAL_SECONDS);
    this.squirrel.multiplier = Math.min(1 + step * 0.1, PARTICIPATION_MAX_MULTIPLIER);
  }

  async save(): Promise<void> {
    await this.storage.put("session", this.squirrel);
  }
}
