# Hidden Walnuts Game

A modern, scalable 3D online asynchronous multiplayer game using TypeScript, Three.js, and a custom ECS (Entity-Component-System) engine.

## Tech Stack

### Client-Side (3D World + UI)
- **Three.js** — 3D rendering in the browser
- **GLTFLoader** — Loads 3D models (GLTF format)
- **HTML/CSS** — UI overlays (score, minimap, notifications)
- **Vanilla JS/TypeScript** — Game logic, event handling, and state sync
- **Optional:** Preact or Svelte for complex UI
- **AssetManager** — Handles loading/caching of models, textures, and sounds

### Backend (Game State & Multiplayer)
- **Cloudflare Workers** — Serverless backend for game logic, event handling, and HTTP/WebSocket APIs
- **Cloudflare Durable Objects** — Persistent state for each 24-hour forest cycle (walnut locations, player scores, etc.)
- **Cloudflare R2** — Object storage for 3D models, textures, and audio assets
- **WebSockets via Workers** — Real-time updates (e.g., Nut Rush, walnut stolen alerts)
- **Cloudflare Pages** — Serves the front-end (static site hosting)
- **Optional:** Cloudflare KV or D1 for player profiles or more complex data

### Assets (3D Models, Textures, Audio)
- **Blender** — For creating low-poly models (squirrel, trees, walnuts, etc.)
- **GLTF** — Model format for efficient loading and animation
- **PNG/JPG** — Textures for terrain, objects, UI
- **Audio** — Sound effects and background music (optional)

### Development & Deployment
- **VS Code + Cursor** — Code editing and AI assistance
- **Vitest** — Unit testing for engine logic
- **ESLint/Prettier** — Linting and code formatting
- **Git/GitHub** — Version control and collaboration
- **Cloudflare CLI/Pages/Workers** — Deployment and management

### Architecture Overview
- **Client:**
  - Renders the 3D world, handles player input, and communicates with backend for state sync
  - Loads assets from Cloudflare R2 via AssetManager
  - UI overlays for score, minimap, notifications, and events
- **Backend:**
  - Cloudflare Workers handle HTTP/WebSocket requests, validate actions, and update game state
  - Durable Objects store persistent state for each forest cycle and player
  - R2 serves static assets (models, textures, audio)
  - WebSockets broadcast real-time events to clients
- **Deployment:**
  - Front-end deployed to Cloudflare Pages
  - Backend logic and asset serving via Workers and R2

## Project Structure

```
src/
  engine/         # Reusable engine code (ECS, rendering, input, assets, etc.)
    ecs/
      Component.ts
      Entity.ts
      SceneManager.ts
      components/
        Transform.ts
    assets/
      AssetManager.ts
      three-jsm-globals.d.ts  # Custom type declarations for Three.js examples
  game/           # Game-specific logic, components, entities, scenes
    components/
    entities/
    scenes/
  assets/         # Static assets (models, textures, sounds, etc.)
main.ts           # Entry point
```

## Getting Started

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the development server:**
   ```sh
   npm run dev
   ```
3. **Run tests:**
   ```sh
   npx vitest run
   ```

## Development Best Practices

- **Separation of Concerns:**
  - Keep reusable engine code in `src/engine/`.
  - Place game-specific logic in `src/game/`.
- **ECS Pattern:**
  - Use the provided `Entity`, `Component`, and `SceneManager` classes for scalable, type-safe game logic.
- **Asset Management:**
  - Use `AssetManager` for loading and caching models, textures, and (optionally) sounds.
  - Example usage:
    ```ts
    import { AssetManager } from './engine/assets/AssetManager';
    const assets = new AssetManager();
    const texture = await assets.loadTexture('assets/texture.png');
    const model = await assets.loadModel('assets/model.glb');
    ```
- **Type Safety:**
  - TypeScript strict mode is enabled for maximum safety.
  - For Three.js example loaders (like GLTFLoader), a custom type declaration is provided in `src/engine/assets/three-jsm-globals.d.ts` to resolve linter warnings.
- **Logging:**
  - Use the logger utility in `src/engine/utils/logger.ts` for consistent log/error output.
- **Testing:**
  - Add unit tests for engine logic in the `tests/` directory using Vitest.
- **Documentation:**
  - Use JSDoc comments for all core classes and methods.
- **Version Control:**
  - `.gitignore` is set up to exclude dependencies, build output, and environment files.
- **Naming Conventions:**
  - Use `PascalCase` for classes and `camelCase` for variables/functions.

## Special Notes

- **GLTFLoader Type Declarations:**
  - If you use Three.js example modules (like GLTFLoader), the custom type declaration in `src/engine/assets/three-jsm-globals.d.ts` ensures type safety and removes linter warnings.
- **Extending AssetManager:**
  - You can add methods for loading sounds, fonts, or other asset types as needed.

## Key Features
- Type-safe, extensible ECS (Entity-Component-System)
- Three.js scene management
- AssetManager for loading/caching models and textures
- Logger utility for consistent error/log handling
- JSDoc documentation on core classes
- Vitest for unit testing engine logic

## Contributing
- Keep engine code reusable and game code separate
- Use JSDoc for new classes/methods
- Add tests for new engine features

---

© 2024 Hidden Walnuts 