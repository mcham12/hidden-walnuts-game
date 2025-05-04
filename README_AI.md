# Hidden Walnuts – AI Coding Context

This project is a 3D online synchronous multiplayer game using:
- Three.js frontend (in /client)
- Cloudflare Workers as API backend (/workers/api.ts)
- Durable Objects as stateful entities (/workers/objects/)
- Registry pattern for accessing Durable Objects

Each player is a "squirrel" with a SquirrelSession Durable Object.
The forest map and walnut logic are coordinated through ForestManager and WalnutRegistry Durable Objects.

### Coding Principles for AI

- Always route Durable Object access via registry.ts
- Do not put fetch logic outside api.ts
- Use the types in types.ts for Squirrel and Walnut shape
- Use constants.ts for any point values, durations, or feature flags
- Use `// AI NOTE:` comments to mark data models, assumptions, and interactions

### Durable Objects

| Name           | Purpose                                |
|----------------|----------------------------------------|
| ForestManager  | Daily map cycle, walnut spawning       |
| SquirrelSession| Per-player state (score, power-ups)    |
| WalnutRegistry | Track all walnut states and ownership  |
| Leaderboard    | Manage leaderboard and bonuses         |

Start all new functionality inside the appropriate Durable Object.
If routing logic is needed, first add it to api.ts.
