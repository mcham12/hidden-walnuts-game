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
- **Assets**: Store in `<game-root>/public/assets/models/` (e.g., `Tree_01.glb`).
- **Movement**: Use WASD for avatar control, OrbitControls for mouse navigation (disabled during WASD).
- **Rendering**: Optimize draw calls (e.g., reuse geometries, update only changed objects).

## Backend (Cloudflare Workers)
- **API**: Route requests via `api.ts` (e.g., `/map-state`, `/terrain-seed`).
- **Persistence**: Use Durable Objects in `registry.ts` for walnut and map state.
- **WebSocket**: Handle events (e.g., `map_reset`, `walnut-rehidden`) with minimal data transfer.

## Logging System

**🚨 CRITICAL: Use the Logger system, NOT console.log calls**

The codebase uses a sophisticated, production-ready logging system with categories, levels, and environment-aware behavior. **Never use direct console.log/warn/error calls.**

### **Client-Side Logging**
```typescript
import { Logger, LogCategory } from '../core/Logger';

// Proper logging with categories
Logger.info(LogCategory.CORE, 'Game initialized successfully');
Logger.debug(LogCategory.NETWORK, 'WebSocket connected', { playerId, sessionId });
Logger.warn(LogCategory.TERRAIN, 'Height lookup failed, using fallback', { x, z });
Logger.error(LogCategory.PLAYER, 'Failed to spawn player', error);

// Performance tracking
const perfId = Logger.perfStart(LogCategory.RENDER, 'terrain_generation');
// ... expensive operation ...
Logger.perfEnd(perfId);
```

### **Server-Side Logging (Workers)**
```typescript
import { Logger, LogCategory } from '../Logger';

// Consistent logging across client/server
Logger.debug(LogCategory.WEBSOCKET, 'Player joined forest', { playerId, forestId });
Logger.info(LogCategory.AUTH, 'Session validated', { sessionId });
Logger.error(LogCategory.NETWORK, 'WebSocket upgrade failed', error);
```

### **Available Categories**
- `LogCategory.CORE` - Application lifecycle, initialization
- `LogCategory.NETWORK` - WebSocket, HTTP requests, multiplayer
- `LogCategory.AUTH` - Authentication, session management  
- `LogCategory.WEBSOCKET` - WebSocket connection lifecycle
- `LogCategory.PLAYER` - Player spawning, movement, state
- `LogCategory.FOREST` - Forest/world management
- `LogCategory.TERRAIN` - Terrain generation, height queries
- `LogCategory.ECS` - Entity Component System operations
- `LogCategory.RENDER` - Graphics, rendering optimizations

### **Environment Behavior**
- **Development**: All categories visible with performance metrics
- **Production**: Only ERROR level logged, with external error reporting
- **Automatic**: Environment detection based on build flags

### **❌ NEVER DO THIS:**
```typescript
console.log('Player moved to:', position);        // ❌ Wrong
console.warn('Network timeout');                  // ❌ Wrong  
console.error('Failed to load terrain');          // ❌ Wrong
```

### **✅ ALWAYS DO THIS:**
```typescript
Logger.debug(LogCategory.PLAYER, 'Player moved to position', { position });     // ✅ Correct
Logger.warn(LogCategory.NETWORK, 'Network timeout occurred', { timeout });      // ✅ Correct
Logger.error(LogCategory.TERRAIN, 'Failed to load terrain', error);             // ✅ Correct
```

## Testing
- **MVP 6 Tasks**:
  - Verify squirrel avatar rendering (`Squirrel.glb`) and animations.
  - Test WASD movement for smoothness, ensuring no terrain clipping.
  - Confirm third-person camera follows avatar with proper offset.
- **Tools**: Use browser dev tools for logs, Cloudflare dashboard for deployment checks.
- **Workflow**: Test locally (`npm run dev`), then deploy to Cloudflare Pages for production validation.

## Contribution Workflow
- **Branches**: Use `mvp-<number>` (e.g., `mvp-6`) for feature development.
- **Commits**: Prefix with MVP number (e.g., `MVP-6: Add squirrel avatar`).
- **PRs**: Include test results and logs in descriptions.
- **AI Usage**: Document AI contributions in `README_AI.md` (e.g., code generation, debugging).

## Example File Structure
```
hidden-walnuts/
├── client/
│   ├── src/
│   │   ├── main.ts
│   │   ├── terrain.ts
│   │   ├── forest.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   ├── public/
│   │   ├── assets/
│   │   │   ├── models/
│   │   │   │   ├── Tree_01.glb
│   │   │   │   ├── Bush_01.glb
│   │   │   │   ├── Squirrel.glb
├── workers/
│   ├── api.ts
│   ├── registry.ts
├── README.md
├── README_AI.md
├── conventions.md
```

These conventions guide development for MVP 6 and beyond, ensuring a consistent and scalable codebase.