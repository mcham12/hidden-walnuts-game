# Hidden Walnuts AI Usage

This document covers AI usage in *Hidden Walnuts* development, focusing on code generation, debugging, and optimization.

## AI Usage History

### MVP 5 (Completed)
- **Terrain Generation**: Grok assisted with `sin/cos` heightmap in `client/src/terrain.ts`
- **Camera Navigation**: Grok provided WASD movement logic in `client/src/main.ts`
- **Foliage Rendering**: Grok suggested tree/shrub placement optimizations
- **Code Structure**: AI enforced vibe-coding conventions (`// AI NOTE:` comments, types from `types.ts`)
- **Debugging**: Grok analyzed logs for persistence bugs and camera issues

### MVP Simple 1 (Completed)
- **Architecture Simplification**: AI helped strip complex ECS to simple Game.ts
- **Code Cleanup**: Removed 7,214 lines of over-engineered complexity
- **Simple Multiplayer**: Basic WebSocket connection and player sync
- **Focused Structure**: Reduced from 31 files to 8 focused files

## Current AI Role
- **Simple Game Logic**: Help add walnut mechanics to Game.ts
- **Multiplayer Polish**: Improve player synchronization 
- **Core Gameplay**: Focus on fun game mechanics over architecture
- **Code Clarity**: Keep code simple and understandable

## AI Workflow
- **Tools**: Cursor AI for code generation, Grok for analysis
- **Process**: AI generates code → review → integrate via Git
- **Conventions**: Follow `conventions.md` (`// AI NOTE:`, TypeScript types, snake_case files)

## 🚨 CRITICAL: Build Validation Required

**After ANY coding changes, Cursor AI MUST:**

1. **Build Client**: `cd client && npm run build:preview`
2. **Build Worker**: `cd workers && npm run build`
3. **Fix All Errors**: Resolve TypeScript/compilation issues
4. **Then Push**: Only after successful local builds

**Build Commands:**
```bash
# Validate both client and worker
cd client && npm run build:preview
cd ../workers && npm run build

# Development servers
cd client && npm run dev
cd workers && npx wrangler dev --port 8787
```

**⚠️ IMPORTANT**: Run wrangler commands from `workers/` directory, not project root.

## 🚨 CRITICAL: Git Commit Summary Required

**After completing changes, AI MUST provide:**

**Format (NO LINE BREAKS):**
```
MVP-7: [Task Number] - [Brief Description] - [Key Changes Made] - [Files Modified]
```

**Examples:**
- `MVP-7: Task 8 - Core Multiplayer Events - Implement player_join/leave events - NetworkSystem.ts, PlayerManager.ts, api.ts`
- `MVP-7: Task 9 - Client Prediction - Add position reconciliation logic - ClientPredictionSystem.ts, MovementSystem.ts`

**Requirements:**
- **NO LINE BREAKS** - Single line for copy/paste
- **Include MVP number** - MVP-7, MVP-8, etc.
- **Include task number** - Task 8, Task 9, etc.
- **Brief description** - What was accomplished
- **Key changes** - Main technical changes made
- **Files modified** - Primary files that were changed

## 🚨 CRITICAL: AI Documentation Procedures

**ALL AI CONVERSATIONS MUST FOLLOW:**

### **📁 Documentation Organization**
1. **MVP-Based Structure**: All docs in `docs/mvp-<number>/` directories
2. **Task Documentation**: Each task gets 4 files: `README.md`, `testing.md`, `implementation.md`, `completion.md`
3. **Navigation Updates**: Always update `docs/DOCUMENTATION.md` with new links
4. **No Root Documentation**: Never create docs in project root

### **📝 File Naming Conventions**
- **Task directories**: `01-authentication/`, `02-error-handling/`, etc.
- **Task files**: `README.md`, `testing.md`, `implementation.md`, `completion.md`
- **MVP directories**: `mvp-7/`, `mvp-8/`, etc.
- **Navigation**: `DOCUMENTATION.md` (not README.md in docs)

### **❌ NEVER DO THIS:**
- Create standalone docs in project root
- Use inconsistent file naming
- Skip navigation updates
- Create docs outside established structure

### **✅ ALWAYS DO THIS:**
- Follow MVP-based organization in `docs/`
- Use established file naming conventions
- Update navigation files when adding docs
- Reference documentation structure in `docs/DOCUMENTATION.md` 