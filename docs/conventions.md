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

## Logging System - **SIMPLIFIED**

**🚨 SIMPLIFIED: Use basic console.log for development**

The codebase now uses **simple console logging** instead of complex enterprise logging systems.

### **Client-Side Logging**
```typescript
// Simple development logging
console.log('🎮 Game initialized successfully');
console.log('🌐 WebSocket connected:', { playerId });
console.warn('⚠️ Height lookup failed, using fallback:', { x, z });
console.error('❌ Failed to spawn player:', error);

// Use emojis for easy visual scanning
console.log('🐿️ Player moved to:', position);
console.log('🌲 Forest loaded with', treeCount, 'trees');
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
- **Workflow**: Test locally, then deploy to Cloudflare Pages for production validation.

## Development Setup
**⚠️ CRITICAL: Correct Directory Structure**
```
hidden-walnuts-game/
├── client/          # Vite + Three.js frontend
├── workers/         # Cloudflare Workers backend
└── public/          # Shared assets
```

**Development Commands:**
```bash
# Start client development server
cd client && npm run dev

# Start worker development server (MUST be from workers directory)
cd workers && npx wrangler dev --port 8787

# Build validation
cd client && npm run build:preview
cd workers && npm run build
```

**⚠️ IMPORTANT**: 
- Always run wrangler commands from the `workers/` directory
- Never run `npx wrangler dev` from the project root
- The worker configuration expects to be executed from within the workers directory

## Contribution Workflow
- **Branches**: Use `mvp-<number>` (e.g., `mvp-6`) for feature development.
- **Commits**: Prefix with MVP number (e.g., `MVP-6: Add squirrel avatar`).
- **PRs**: Include test results and logs in descriptions.
- **AI Usage**: Document AI contributions in `README_AI.md` (e.g., code generation, debugging).

### **🚨 MANDATORY: Local Build Validation**
**Before pushing ANY changes to GitHub:**

1. **Validate Client Build**: `cd client && npm run build:preview`
2. **Validate Worker Build**: `cd workers && npm run build`  
3. **Fix ALL TypeScript errors** before proceeding
4. **Only push after successful local builds**

This prevents Cloudflare Pages deployment failures and catches compilation errors early.

### **🚨 MANDATORY: Git Commit Summary**
**After completing ANY batch of changes, provide:**

**Git Commit Summary Format (NO LINE BREAKS):**
```
MVP-7: [Task Number] - [Brief Description] - [Key Changes Made] - [Files Modified]
```

**Examples:**
- `MVP-7: Task 8 - Core Multiplayer Events - Implement player_join/leave events - NetworkSystem.ts, PlayerManager.ts, api.ts`
- `MVP-7: Task 9 - Client Prediction - Add position reconciliation logic - ClientPredictionSystem.ts, MovementSystem.ts`
- `MVP-7: Documentation - Reorganize docs structure - Move files to docs/ directory - docs/DOCUMENTATION.md, README.md`

**Requirements:**
- **NO LINE BREAKS** - Single line for easy copy/paste
- **Include MVP number** - MVP-7, MVP-8, etc.
- **Include task number** - Task 8, Task 9, etc.
- **Brief description** - What was accomplished
- **Key changes** - Main technical changes made
- **Files modified** - Primary files that were changed

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
├── docs/
│   ├── DOCUMENTATION.md          # Main documentation index
│   ├── PROJECT_STRUCTURE.md      # Architecture guide
│   ├── GameVision.md             # Game design & features
│   ├── MVP_Plan_Hidden_Walnuts-2.md # Development roadmap
│   ├── conventions.md            # This file - coding standards
│   ├── README_AI.md              # AI usage guidelines
│   ├── repo_structure.txt        # File tree
│   └── mvp-7/                    # MVP-specific documentation
│       ├── README.md             # MVP overview
│       ├── COMPLETION_SUMMARY.md # Overall completion
│       └── tasks/                # Individual task docs
│           ├── 01-authentication/
│           │   ├── README.md
│           │   ├── testing.md
│           │   ├── implementation.md
│           │   └── completion.md
│           └── ... (other tasks)
```

## 🚨 CRITICAL: Documentation Organization

**ALL NEW DOCUMENTATION MUST FOLLOW THIS STRUCTURE:**

1. **📁 MVP-Based Organization**: Place all task documentation in `docs/mvp-<number>/tasks/`
2. **📝 Consistent File Naming**: Each task gets 4 files: `README.md`, `testing.md`, `implementation.md`, `completion.md`
3. **🔄 Update Navigation**: Always update `docs/DOCUMENTATION.md` with new links
4. **📋 Never Create Root Files**: All documentation goes in `docs/` directory, never in project root
5. **🔗 Cross-Reference**: Link between related documents and maintain navigation structure

**AI CONVERSATIONS MUST:**
- Reference `docs/DOCUMENTATION.md` for the complete documentation structure
- Follow the established MVP-based organization
- Use consistent file naming conventions
- Update navigation files when adding new documentation

These conventions guide development for MVP 6 and beyond, ensuring a consistent and scalable codebase. 