Coding Conventions for Hidden Walnuts
These conventions ensure consistency and maintainability, updated for the simplified architecture and single-player focus (Colobus character animation).
File and Folder Naming

Files: Use PascalCase for TypeScript classes (e.g., Game.ts), snake_case for others.
Assets: Use PascalCase for 3D models (e.g., Colobus_LOD0.glb).
Folders: Lowercase with hyphens (e.g., client/src, public/assets/models).

Code Structure

Language: TypeScript for frontend (client/src) and backend (workers).
Types: Define interfaces in separate files if needed (e.g., no dedicated types.ts yet).
Constants: Inline or in class (e.g., in Game.ts for speeds).
Comments: Use // NOTE: for explanations; focus on clarity.
Modules: Organize by feature (e.g., terrain.ts for terrain, forest.ts for foliage).

Frontend (Three.js)

Scene Setup: Initialize in Game.ts (scene, camera, renderer, lights, character).
Assets: Store in <game-root>/public/assets/models/ (e.g., Colobus_LOD0.glb).
Movement: WASD for character control; auto camera follow.
Animations: Use Three.js AnimationMixer; states like idle/run/jump for Colobus.
Rendering: Keep simple; update in animate loop.

Backend (Cloudflare Workers)

API: Route in api.ts (e.g., /ws for future multiplayer).
Persistence: Use Durable Objects sparingly (multiplayer focus later).
WebSocket: Basic position sync (pending full integration).

Logging System - SIMPLIFIED
Use basic console.log for development (client-side); workers retain Logger for categories if needed.