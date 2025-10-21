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

### **🚨 CRITICAL: Build Validation Required**
**After making ANY batch of coding changes, Cursor AI MUST:**

1. **Build Client Locally**: Run `cd client && npm run build:preview` to catch TypeScript errors
2. **Build Worker Locally**: Run `cd workers && npm run build` to validate worker code  
3. **Fix All Build Errors**: Resolve any TypeScript/compilation issues before proceeding
4. **Only Then Push**: After successful local builds, changes can be pushed to GitHub

**Why This Matters**: 
- Prevents Cloudflare Pages build failures during auto-deployment
- Catches TypeScript errors early (like `Property 'id' does not exist on type 'never'`)
- Saves deployment time and reduces failed builds in preview environment
- Ensures code quality before it reaches the CI/CD pipeline

**Build Commands:**
```bash
# From project root - validate both client and worker
cd client && npm run build:preview
cd ../workers && npm run build

# Or validate just the component being changed
cd client && npm run build:preview  # For client changes
cd workers && npm run build         # For worker changes
```

**Development Server Commands:**
```bash
# Start client development server (from project root)
cd client && npm run dev

# Start worker development server (from project root)
cd workers && npx wrangler dev --port 8787

# Start both servers (in separate terminals)
# Terminal 1: cd client && npm run dev
# Terminal 2: cd workers && npx wrangler dev --port 8787
```

**⚠️ IMPORTANT**: Always run wrangler commands from the `workers/` directory, not from the project root. The worker configuration expects to be run from within the workers directory.

### **🚨 CRITICAL: Git Commit Summary Required**
**After completing ANY batch of changes, AI MUST provide:**

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

**Workflow:**
1. **Complete changes** - Make all necessary code/documentation changes
2. **Build validation** - Run local builds to ensure no errors
3. **Provide commit summary** - Give user the single-line commit message
4. **Wait for approval** - Let user copy/paste and commit

This ensures AI contributions are targeted, efficient, and aligned with the project's goals.

## 🚨 CRITICAL: AI Documentation Procedures

**ALL AI CONVERSATIONS MUST FOLLOW THESE DOCUMENTATION PROCEDURES:**

### **📁 Documentation Organization**
1. **MVP-Based Structure**: All documentation goes in `docs/mvp-<number>/` directories
2. **Task Documentation**: Each task gets 4 files: `README.md`, `testing.md`, `implementation.md`, `completion.md`
3. **Navigation Updates**: Always update `docs/DOCUMENTATION.md` with new links
4. **No Root Documentation**: Never create documentation files in project root

### **📝 File Naming Conventions**
- **Task directories**: `01-authentication/`, `02-error-handling/`, etc.
- **Task files**: `README.md`, `testing.md`, `implementation.md`, `completion.md`
- **MVP directories**: `mvp-7/`, `mvp-8/`, etc.
- **Navigation**: `DOCUMENTATION.md` (not README.md in docs)

### **🔄 Documentation Workflow**
1. **Reference** `docs/DOCUMENTATION.md` for complete structure
2. **Create** task documentation in appropriate `docs/mvp-<number>/tasks/` directory
3. **Use** consistent file naming for all task documentation
4. **Update** navigation in `docs/DOCUMENTATION.md`
5. **Cross-reference** related documents appropriately

### **❌ NEVER DO THIS:**
- Create standalone documentation files in project root
- Use inconsistent file naming
- Skip navigation updates
- Create documentation outside the established structure

### **✅ ALWAYS DO THIS:**
- Follow the MVP-based organization in `docs/`
- Use the established file naming conventions
- Update navigation files when adding documentation
- Reference the documentation structure in `docs/DOCUMENTATION.md` 