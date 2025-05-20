# Hidden Walnuts – Multiplayer 3D Squirrel Game

Hidden Walnuts is an online, synchronous 3D multiplayer game built using:
- Three.js for rendering a persistent forest world
- Cloudflare Workers + Durable Objects for backend logic
- Cloudflare Pages for frontend hosting
- Vibe-driven development (AI-assisted coding via Cursor + ChatGPT)

Gameplay Summary:
- Persistent forest map resets every 24 hours.
- Players join anytime, get 3 walnuts to hide (under bushes or buried).
- Players search for walnuts hidden by others or the system.
- Points awarded based on type/location, with time-based multipliers.
- Dynamic events (e.g., Nut Rush) and mini-interactions (e.g., "Squirrel Chatter").
- Power-ups, predators, leaderboard, and social mechanics included.

Project Structure (Simplified for AI-Focused Dev):

hidden-walnuts-game/
├── public/assets/           → 3D models, textures
├── client/                  → Three.js logic (game entry point, input, rendering)
├── workers/                 → Cloudflare Workers + Durable Objects
│   ├── api.ts               → Main API router
│   └── objects/
│       ├── ForestManager.ts
│       ├── SquirrelSession.ts
│       ├── WalnutRegistry.ts
│       ├── Leaderboard.ts
│       └── registry.ts      → Central helper for DO routing
├── wrangler.toml            → DO bindings and config
├── package.json             → Worker deps and build
└── README.md                → ← this file

Cloudflare Deployment Strategy:

Local Dev (Fast Iteration)
Use `wrangler dev` for rapid testing of:
- API logic (via api.ts)
- Individual Durable Object behavior
- Basic HTTP routes (/join, /hide, /state, etc.)

Note: Local Durable Object simulation is limited. Use:
wrangler dev --remote
to simulate more realistic Durable Object behavior.

Preview Deploys (Multiplayer Testing)
Use preview deploys for:
- Accurate Durable Object placement & concurrency
- Player-to-player interactions
- Persistent state and map updates

Deploy with:
wrangler deploy --env preview

Vibe Coding Guidelines (AI Dev Principles):

1. Centralize routing logic
   Always route Durable Object access through registry.ts

2. Modularize Durable Objects
   One file per object (ForestManager, SquirrelSession, etc.)

3. Comment context for AI
   Use `// AI NOTE:` comments to preserve structure across prompts

4. Avoid scattered logic
   Keep all fetch routing inside api.ts

5. Refactor deliberately
   Use prompts like:
   "Refactor X to move Y into Z and update all routing, bindings, and registry."

6. Durable Object bindings must match
   Keep wrangler.toml, env access, and class_name definitions synced

Starter Prompts to Use with Cursor AI:

- Create a new power-up called Scent Sniff that highlights nearby walnuts
- Modify SquirrelSession.ts to track hidden walnut locations per player
- Update ForestManager to reset the map every 24h and spawn 100 walnuts
- In api.ts, add a route to claim bonus points when the cycle ends
- Add a Nut Rush mini-event every 4 hours that temporarily doubles points and spawns 20 extra walnuts

Future Enhancements (Vision):

- Persistent leaderboard (exported to R2 or Logpush)
- WebSocket support for real-time movement or quick-time events
- Procedural terrain generator or daily theme variation
- Nut Rush event handler (every 4 hours)
- Asset preloading and optimization

Optional External Services:

- Cloudflare R2: for large asset storage (models, audio, textures)
- Analytics: Cloudflare Logpush or event hooks
- Backup/export: Supabase, KV, or downloadable JSON dumps

Final Notes:

This repo is designed to support vibe coding: you describe the game system, and AI implements it incrementally using structured, modular code. When AI loses focus during a refactor, return to this file to re-anchor structure and gameplay goals.

Happy hiding. 🐿️🌰

## MVP 4: Multiplayer World State Sync

- Implemented WebSocket-based state synchronization.
- Clients receive and render walnut map state upon connection.
- Real-time updates handled via 'walnut-rehidden' messages.

## Building the Frontend for Production

1. Navigate to the `client/` directory.
2. Ensure all dependencies are installed by running `npm install`.
3. Run the build script with `npm run build`.
4. Verify that a `dist/` directory is created, containing `index.html`, bundled JS, and assets.
5. If there are any build errors, resolve them by checking dependencies and configurations.

## API Endpoint Configuration

- The production API endpoint is `https://api.hiddenwalnuts.com`.
- Developers should set the `VITE_API_URL` environment variable to this URL for production builds.
- For local development, the default is `http://localhost:8787`.

## Environment Configuration

- **VITE_API_URL**: Set this environment variable to `https://api.hiddenwalnuts.com` for production builds. For local development, it defaults to `http://localhost:8787`.

## Deployment Configuration

- **Frontend**: Deployed to Cloudflare Pages at `game.hiddenwalnuts.com`.
- **Backend**: Deployed to Cloudflare Workers at `api.hiddenwalnuts.com`.

## Deployment Checklist

1. **Environment Variables:**
   - Ensure `VITE_API_URL` is set correctly for the target environment.
   - Verify any other required environment variables are configured.

2. **Frontend Deployment:**
   - Build the frontend using `npm run build` in the `client/` directory.
   - Deploy the `dist/` directory to Cloudflare Pages.

3. **Backend Deployment:**
   - Deploy the Cloudflare Worker and Durable Objects to production.
   - Verify all routes and bindings are correctly configured.

4. **Testing:**
   - Test the application on the production URLs to ensure everything is functioning as expected....
