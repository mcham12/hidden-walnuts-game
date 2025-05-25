# Hidden Walnuts AI Usage

This document details how AI tools, including Cursor AI and Grok, are used in the development of *Hidden Walnuts*. It covers past and planned AI contributions, focusing on code generation, debugging, and optimization.

## AI Usage in MVP 5 (Completed)
- **Terrain Generation**: Grok assisted in designing the `sin/cos`-based heightmap in `client/src/terrain.ts`, ensuring smooth hills and integration with backend seed fetching.
- **Camera Navigation**: Grok provided multiple iterations of WASD movement logic in `client/src/main.ts`, debugging jumping issues and implementing OrbitControls to prevent terrain clipping. Cursor AI is handling the final W/S key reversal fix.
- **Foliage Rendering**: Grok suggested optimizations for tree and shrub placement in `client/src/forest.ts`, ensuring grounding via `getTerrainHeight`.
- **Code Structure**: AI enforced vibe-coding conventions (e.g., `// AI NOTE:` comments, types from `types.ts`).
- **Debugging**: Grok analyzed logs to diagnose persistence bugs and camera issues, proposing fixes integrated into Cloudflare deployments.

## Planned AI Usage in MVP 6 (In Progress)
- **Squirrel Avatar**:
  - AI will assist in generating or refining a 3D squirrel model (e.g., suggesting `.glb` asset creation or sourcing).
  - Tasks include rigging the model for animations (e.g., running, digging).
- **WASD Movement**:
  - Grok will support smooth avatar movement, leveraging lessons from MVP 5 to avoid issues like jumping.
  - AI will propose physics-based movement (e.g., terrain collision) for the squirrel.
- **Third-Person Camera**:
  - AI will design a camera system following the avatar, with adjustable offset and collision detection to avoid clipping.
  - Suggestions for smooth transitions (e.g., damping) will be provided.
- **Code Optimization**:
  - AI will recommend performance tweaks (e.g., reducing draw calls for avatar rendering).
  - Enforce conventions for new assets (e.g., `Squirrel.glb` naming).

## Future AI Roles
- **Multiplayer (MVP 8)**: Optimize WebSocket event handling, suggest efficient synchronization algorithms.
- **AI Mechanics (MVP 12)**: Design predator AI behaviors (patrol, chase) using pathfinding.
- **Visuals (MVP 5, 7, 13)**: Generate noise functions, textures, and dynamic lighting shaders.
- **Code Quality (MVP 14)**: Implement debug log toggling and refactor suggestions.

## AI Workflow
- **Tools**: Cursor AI for code generation and debugging, Grok for analysis and planning.
- **Process**: AI generates code snippets, which are reviewed and integrated via Git commits. Debug logs are analyzed to refine solutions.
- **Conventions**: AI adheres to `conventions.md` (e.g., `// AI NOTE:`, TypeScript types, snake_case for files).

This ensures AI contributions are targeted, efficient, and aligned with the project’s goals.