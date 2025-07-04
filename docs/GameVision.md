# Hidden Walnuts Game Vision

## Overview
*Hidden Walnuts* is a 3D online synchronous multiplayer game set in a persistent forest map that refreshes every 24 hours (Daily Forest Cycle). Players, assigned unique "Squirrel IDs," hide and seek walnuts in a dynamic 3D world filled with trees, shrubs, and predators like hawks and wolves. The game supports rolling entry, asynchronous play, and competitive scoring with a real-time leaderboard.

## Core Features

### Game World
- **Persistent Forest Map**: A 3D world with trees and shrubs, resetting every 24 hours.
- **Walnut Placement**:
  - 100 game-hidden walnuts at cycle start (3 points for buried, 1 point for bushes).
  - Players hide 3 walnuts each upon joining (2 points for buried, 1 point for bushes).
- **Dynamic Updates**: Map updates as players join and hide walnuts.
- **Hot Zones**: Map indicators show recent activity (e.g., walnuts found/hidden in last 5 minutes).

### Gameplay Mechanics
- **Entry Point**: Players join at any time, receive a Squirrel ID, and get 3 walnuts to hide.
- **Hiding Mechanic**:
  - Press "H" to hide walnuts (bury or place in bushes).
  - Walnuts tagged with Squirrel ID for scoring if undiscovered.
- **Seeking Mechanic**:
  - Search for game- and player-hidden walnuts.
  - Steal and rehide others' walnuts, triggering notifications and quick-time events for owners to reclaim.
- **Predators**:
  - Hawks and wolves threaten players.
  - Defenses: "Chatter" (sound blast), "Insane Squirrel Chatter" (stronger blast), walnut throwing, or other projectiles.
- **Power-Ups**:
  - **Scent Sniff**: Highlights nearby walnuts (1-minute cooldown, 30 seconds for late joiners' first 3 minutes).
  - **Fast Dig**: Speeds up burying/finding.
  - **Decoy Nut**: Distracts predators/players.
  - Late joiners get 1 free use of each power-up.

### Scoring & Participation
- **Points**:
  - Game-hidden walnuts: 3 (buried), 1 (bushes).
  - Player-hidden walnuts: 2 (buried), 1 (bushes).
  - Bonus: 1 point per undiscovered walnut at cycle end, 3 points for "First Finder" (first to find 10 walnuts).
- **Participation Multiplier**:
  - Scales points based on time played (e.g., 1.1x after 5 minutes, up to 2x after 30 minutes).
- **Leaderboard**: Tracks scores in real-time for the 24-hour cycle.
- **Rewards**: Cosmetic skins, power-up boosts (Top 3: rare, Top 10: standard, all: participation).

### Asynchronous Play
- **Persistent Walnuts**: Hidden walnuts remain on map if players log off, scored at cycle end.
- **Catch-Up Mechanic**: Late joiners get a "Fresh Squirrel Boost" (reduced Scent Sniff cooldown for 3 minutes).
- **Mini-Events**: "Nut Rush" every 4 hours (10 minutes, 20 extra walnuts, double points).

### Social Features
- **Squirrel Messages**: Pre-set phrases (e.g., "Nice hiding spot!") when finding walnuts.
- **Notifications**: Alerts for stolen walnuts, enabling quick-time events.

### Winning
- At cycle end, the player with the highest adjusted score (points × Participation Multiplier) wins.
- Rewards distributed based on leaderboard rankings.

## Technical Considerations

### Architecture
- **Client**:
  - Built with Three.js for 3D rendering of the forest map, squirrel avatars, and walnut objects, hosted on Cloudflare Pages (`game.hiddenwalnuts.com`).
  - Handles player input (e.g., "H" for hiding, WASD/mouse for navigation) and renders real-time updates.
  - Communicates with the backend via WebSocket for state synchronization (e.g., walnut map updates, `walnut-rehidden` messages).
- **Server**:
  - Uses Cloudflare Workers for API logic (`workers/api.ts`) and Durable Objects for stateful persistence, deployed at `api.hiddenwalnuts.com`.
  - Durable Objects include:
    - `ForestManager`: Manages the daily map cycle and spawns 100 game-hidden walnuts.
    - `SquirrelSession`: Tracks per-player state (score, power-ups, hidden walnuts).
    - `WalnutRegistry`: Manages walnut states and ownership.
    - `Leaderboard`: Handles real-time leaderboard and bonus points.
  - Routes all Durable Object access through `registry.ts` for modularity.
- **Networking**:
  - WebSocket protocol for real-time updates, including walnut hiding, player movements, and event triggers (e.g., Nut Rush, hot zones).
  - API endpoints (e.g., `/join`, `/hide`, `/state`) handled by `api.ts`.
- **Project Structure**:
  ```
  hidden-walnuts-game/
  ├── client/                  # Three.js logic
  │   ├── src/                 # Game entry, rendering, input
  │   ├── public/              # Static assets
  │   │   ├── assets/          # 3D models, textures
  │   │   ├── index.html       # Game entry point
  ├── workers/                 # Cloudflare Workers
  │   ├── api.ts               # API router
  │   ├── objects/             # Durable Objects
  │   │   ├── ForestManager.ts # Map cycle
  │   │   ├── SquirrelSession.ts # Player state
  │   │   ├── WalnutRegistry.ts # Walnut states
  │   │   ├── Leaderboard.ts   # Leaderboard
  │   │   ├── registry.ts      # DO routing
  ├── wrangler.toml            # DO bindings
  ├── package.json             # Dependencies
  ├── docs/                    # Documentation
  │   ├── README.md            # Project overview
  │   ├── README_AI.md         # AI coding context
  │   ├── conventions.md       # Coding conventions
  ```
- **Dependencies**:
  - Client: `three` for 3D rendering.
  - Server: Cloudflare Workers SDK (`@cloudflare/workers-types`), WebSocket libraries.
  - Development: `vite` for client bundling, `wrangler` for Worker deployment, Cursor AI for coding.

### Implementation Notes
- **3D Rendering**: Three.js supports rendering of GLTF models for trees, shrubs, and squirrels, with physics for walnut interactions.
- **Persistence**: Durable Objects provide serverless state management, storing map, player, and walnut data across the 24-hour cycle.
- **Multiplayer Sync**: WebSocket ensures low-latency updates for walnut hiding and seeking, with `registry.ts` centralizing DO access.
- **Daily Reset**: `ForestManager` handles map resets and walnut spawning via a scheduled task.
- **Scalability**: Cloudflare Workers and Durable Objects support concurrent players, with potential for R2 storage for assets.

## Technical Implementation

### Current Implementation Status
- ✅ **Multiplayer Foundation**: WebSocket connections, player synchronization
- ✅ **Terrain System**: Procedural height generation with Three.js
- ✅ **Player Movement**: WASD controls with third-person camera
- ✅ **Asset Loading**: GLTF model loading and caching
- ✅ **ECS Architecture**: 10-system Entity-Component-System implementation
- ✅ **Durable Objects**: ForestManager, SquirrelSession, WalnutRegistry, Leaderboard
- ✅ **Network Optimization**: 5Hz tick rate, client prediction, area of interest
- 🔄 **Walnut Mechanics**: In development (MVP 8)
- 📋 **Scoring System**: Planned (MVP 9)
- 📋 **Daily Reset**: Planned (MVP 10)

### Performance Targets
- **Frame Rate**: 60 FPS target, 30 FPS minimum
- **Network Latency**: <100ms for smooth multiplayer
- **Memory Usage**: <100MB baseline
- **Load Time**: <3 seconds initial load
- **DO Usage**: Within Cloudflare free tier limits

### Protocol Version
- **Client Version**: `1.0.0`
- **Protocol Version**: `hidden-walnuts-v1`
- **API Version**: `v1`
- **Compatibility**: Backward compatible within major version 