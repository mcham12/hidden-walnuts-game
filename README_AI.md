# Hidden Walnuts AI Usage

This document details how AI tools, including Cursor AI and Grok, are used in the development of *Hidden Walnuts*. It covers past and planned AI contributions, focusing on code generation, debugging, and optimization.

## AI Usage in MVP 6 (Completed)
- **Squirrel Avatar**: AI assisted in loading `squirrel.glb` in `client/src/avatar.ts`. Model is not yet rigged for animations (e.g., running, digging), pending task (see `TODO.md`).
- **WASD Movement**: Grok provided TypeScript code in `client/src/main.ts` for smooth avatar movement with terrain collision.
- **Third-Person Camera**: AI designed a camera system with adjustable offset and damping, preventing terrain clipping.
- **Code Optimization**: AI suggested reducing draw calls for avatar rendering, adhering to `conventions.md`.
- **Debugging**: Grok analyzed Cloudflare preview logs to validate movement and camera behavior.

## Development Workflow
- **Testing**: Manual testing on Cloudflare preview (`hidden-walnuts-game.pages.dev`, `hidden-walnuts-api.mattmcarroll.workers.dev`). No local testing performed.
- **Deployment**: Cloudflare Pages builds via GitHub integration; Workers deploy via `deploy-worker.yml` (see `deployment_setup.md`).
- **Debugging**: Relies on Cloudflare build logs and manual validation of preview URLs.
- **Pending Tasks** (see `TODO.md`):
  - Correct `deploy-worker.yml` preview URL (`VITE_API_URL` to `https://hidden-walnuts-api.mattmcarroll.workers.dev`).
  - Develop automated testing script for simulating inputs (e.g., player movements).
  - Rig `squirrel.glb` for animations.

## Planned AI Usage in MVP 7 (In Progress)
- **Multiplayer Foundation**:
  - AI will generate secure WebSocket (`wss://`) code in `workers/api.ts` and `client/src/main.ts` for events (`player-join`, `player-move`, `player-leave`).
  - Suggest Durable Object updates in `workers/objects/SquirrelSession.ts` for player state management.
  - Propose token-based authentication logic for player validation.
  - Provide error handling and logging for network issues.
- **Testing**:
  - AI will recommend multi-browser testing scripts to validate avatar synchronization.
  - Analyze WebSocket logs for performance bottlenecks.
- **Optimization**:
  - Suggest delta updates for player position syncing to minimize bandwidth.

## Future AI Roles
- **Walnut Mechanics (MVP 8-9)**: Generate code for walnut hiding/seeking, optimize rendering, and sync scores via Durable Objects.
- **Performance (MVP 12)**: Propose LOD, terrain tiling, and rendering optimizations.
- **Predators (MVP 13)**: Design AI pathfinding for hawks and wolves.
- **Code Quality (MVP 16)**: Implement debug log toggling and refactor suggestions.

## AI Workflow
- **Tools**: Cursor AI for code generation and debugging, Grok for analysis and planning.
- **Process**: AI generates code snippets, reviewed and integrated via Git commits. Debug logs are analyzed to refine solutions.
- **Conventions**: AI adheres to `conventions.md` (e.g., `// AI NOTE:`, TypeScript types, snake_case for files).