# Hidden Walnuts

*Hidden Walnuts* is a 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. The game features a dynamic forest with terrain, trees, shrubs, and walnuts, with plans for player avatars, real-time synchronization, scoring, power-ups, predators, events, and social interactions.

## Project Status
- **Current MVP**: MVP 5 completed (Basic Forest Environment).
- **Next MVP**: MVP 6 (Player Avatar and Movement, in progress).
- **Deployment**: Hosted on Cloudflare (Workers for backend, Pages for frontend).

## MVP 5 Achievements
- Deployed to Cloudflare with persistent walnut positions (MVP 4.5).
- Implemented a navigable 200x200 terrain with hills (0–20 units height) using sin/cos noise.
- Added 50 trees and 100 shrubs, grounded on terrain.
- Rendered a walnut model with click detection (not yet hidden).
- Fixed camera movement issues (WASD navigation, OrbitControls) to prevent jumping and clipping.

## MVP 6 Goals
- Create a squirrel avatar model.
- Implement WASD movement for the avatar.
- Add a third-person camera following the player.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/hidden-walnuts.git
   cd hidden-walnuts
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set environment variables in `.env`:
   ```env
   VITE_API_URL=https://hidden-walnuts-api.yourdomain.workers.dev
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

## Development & Deployment Workflow

### **Development Process**
- **Local Development**: Code changes made locally, optional `npm run dev` for build validation
- **Testing**: ALL multiplayer testing done in Cloudflare preview environment (not local)
- **No Local WebSocket**: WebSocket connections only tested via Cloudflare preview URLs

### **Deployment Pipeline**
1. **Code → GitHub**: Developer commits and pushes changes to GitHub
2. **Auto-Build Workers**: GitHub Actions automatically builds/deploys workers (if changes detected)
3. **Auto-Build Frontend**: Cloudflare Pages auto-builds frontend from GitHub push
4. **Preview URLs**: Testing occurs using Cloudflare-generated preview URLs
5. **Iteration**: Based on preview testing results, repeat cycle

### **Deployment Details**
- **Frontend**: Deployed to Cloudflare Pages via GitHub integration 
- **Backend**: Deployed to Cloudflare Workers via GitHub Actions (`deploy-pages.yml`).
- **Assets**: Served from `<game-root>/public/` (e.g., `Tree_01.glb`, `Bush_01.glb`).
- **Routes**: `_routes.json` excludes `.glb` and `.txt` from SPA fallback.

### **Why This Workflow**
- **Real Environment Testing**: Multiplayer features tested in actual deployment environment
- **Automatic Deployment**: No manual deployment steps, reduces errors
- **Preview Isolation**: Each commit gets its own preview URL for testing

## Revised MVP Plan

### MVP 4.5: Deployment and Bug Fixing (Completed)
- Deployed to Cloudflare.
- Fixed walnut location persistence using Durable Objects.

### MVP 5: Basic Forest Environment (Completed)
- Navigable terrain with hills, trees, and shrubs.
- Optimized terrain height calculations and rendering.

### MVP 6: Player Avatar and Movement (In Progress)
- Squirrel avatar model.
- WASD movement for avatar.
- Third-person camera following player.


### MVP 7: Walnut Hiding Mechanics
- Walnut pickup and hiding with visual indicators.
- Persistent walnut positions in backend.
- Optimize walnut rendering (update only changed walnuts).
- Implement level of detail (LOD) for walnuts.

### MVP 8: Multiplayer Synchronization
- WebSocket for real-time communication.
- Synchronize walnut and player positions.
- Streamline WebSocket handlers.

### MVP 9: Walnut Seeking and Scoring
- Find and collect hidden walnuts.
- Points system for finds and hides.
- Real-time leaderboard.

### MVP 10: Daily Map Reset
- 24-hour map reset cycle.
- Seed 100 game-hidden walnuts at reset.
- Reset scores and walnut positions.

### MVP 11: Power-Ups
- **Scent Sniff** and **Fast Dig** power-ups.
- Spawning and usage mechanics.

### MVP 12: Predators
- Hawk and wolf predator models.
- Patrol and chase AI.
- Player evasion mechanics.

### MVP 13: Dynamic Events
- **Nut Rush** event with extra walnuts.
- Random event triggers.
- Dynamic lighting for events.

### MVP 14: Social Interactions
- Pre-set messages and notifications.
- Basic friend system or tagging.
- Add DEBUG flag for production logs.

## Risks and Mitigations
- **Multiplayer Sync**: Test WebSocket early, optimize handlers.
- **Over-Scoping**: Start with simple implementations, iterate.
- **Resources**: Prioritize high-impact tasks, integrate optimizations incrementally.

## Contributing
See `conventions.md` for coding standards and contribution guidelines.
