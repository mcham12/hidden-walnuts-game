# Coding Conventions for Hidden Walnuts

These conventions ensure consistency and maintainability in the *Hidden Walnuts* codebase, covering naming, structure, and workflows.

## File and Folder Naming
- **Files**: Use `snake_case` for source files (e.g., `main.ts`, `terrain.ts`).
- **Assets**: Use `PascalCase` for 3D models (e.g., `Tree_01.glb`, `Bush_01.glb`, `Squirrel.glb`).
- **Folders**: Lowercase with hyphens (e.g., `client/src`, `public/assets/models`).

## Code Structure
- **Language**: TypeScript for frontend (`client/src`) and backend (`workers`).
- **Types**: Define interfaces in `types.ts` (e.g., `Walnut`, `ForestObject`).
- **Constants**: Store in `constants.ts` (e.g., `FOREST_SIZE`, `TERRAIN_SIZE`).
- **Comments**: Use `// AI NOTE:` for AI-generated code sections, explaining intent.
- **Modules**: Organize by feature (e.g., `terrain.ts` for terrain logic, `forest.ts` for foliage).

## Frontend (Three.js)
- **Scene Setup**: Initialize in `main.ts` (scene, camera, renderer, lights).
- **Assets**: Store in `client/public/assets/models/` (e.g., `Tree_01.glb`).
- **Movement**: Use WASD for avatar control, OrbitControls for mouse navigation (disabled during WASD).
- **Rendering**: Optimize draw calls (e.g., reuse geometries, update only changed objects).

## Backend (Cloudflare Workers)
- **API**: Route requests via `api.ts` (e.g., `/map-state`, `/terrain-seed`).
- **Persistence**: Use Durable Objects in `registry.ts` for walnut and map state.
- **WebSocket**: Handle events (e.g., `player-join`, `player-move`) with minimal data transfer.

## Deployment Conventions
- **Cloudflare Pages**:
  - Project: `hidden-walnuts-game`.
  - Domains: `hidden-walnuts-game.pages.dev`, `game.hiddenwalnuts.com`.
  - Build: `npm run build:preview` (Vite, output to `client/dist`).
- **Cloudflare Worker**:
  - Name: `hidden-walnuts-api`.
  - Route: `api.hiddenwalnuts.com/*`.
  - Preview: `hidden-walnuts-api.mattmcarroll.workers.dev`.
  - Durable Objects: Defined in `workers/wrangler.toml` (e.g., `FOREST`, `SQUIRREL`).
- **GitHub Actions**:
  - Workflow: `deploy-worker.yml` for Worker builds (`main` for production, `mvp-*` for preview).
  - Pages: Automatic builds via GitHub integration.
- See `deployment_setup.md` for detailed configurations.

## Debug Logging
- **Format**: Use `console.log` with descriptive prefixes (e.g., `[Log] Camera moved via WASD`).
- **Production**: Toggle logs with a `DEBUG` flag (planned for MVP 16).
- **Examples**:
  - `console.log('Camera position:', camera.position.toArray())`
  - `console.log('Player joined:', player.id, position)`

## Testing
- **Current**: Manual testing on Cloudflare preview (`hidden-walnuts-game.pages.dev`, `hidden-walnuts-api.mattmcarroll.workers.dev`) via deployment URLs.
- **Future**: Develop automated testing script for inputs (e.g., WebSocket events, player movements).
- **MVP 7 Tasks**:
  - Verify secure WebSocket connections and event handling.
  - Test multi-player avatar synchronization across browsers.
  - Confirm token-based authentication and error handling.
- **Tools**: Use browser dev tools for logs, Cloudflare dashboard for deployment checks.
- **Workflow**: Test on preview deployments, validate via build logs.
- See `MVP_Plan_Hidden_Walnuts.md` for MVP-specific testing goals.

## Contribution Workflow
- **Branches**: Use `mvp-<number>` (e.g., `mvp-7`) for feature development.
- **Commits**: Prefix with MVP number (e.g., `MVP-7: Add WebSocket events`).
- **PRs**: Include test results and logs in descriptions.
- **AI Usage**: Document AI contributions in `README_AI.md`.