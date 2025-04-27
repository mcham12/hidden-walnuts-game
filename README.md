# Hidden Walnuts Game

A modern, scalable game project using TypeScript, Three.js, and a custom ECS (Entity-Component-System) engine.

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