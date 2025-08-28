# Project Structure Documentation

## Overview
This document provides a guide to the **simplified** Hidden Walnuts game project structure. The project was streamlined to focus on simple gameplay, with current emphasis on single-player animated Colobus character in a Three.js scene.

## Root Directory Structure
hidden-walnuts-game/
├── client/ # Three.js game client (simplified)
├── workers/ # Cloudflare Workers backend
├── public/ # Shared 3D assets
├── docs/ # Documentation files
└── configuration files # Build and deployment configs


## Client Architecture (`client/`) - **SIMPLIFIED**
### Current Simple Structure
client/src/
├── Game.ts # Main game logic class (scene, camera, renderer, character animation, movement)
├── main.ts # Simple entry point with character selection
├── terrain.ts # 3D terrain generation
├── forest.ts # 3D forest objects
├── vite-env.d.ts # Vite types
└── index.html # Entry HTML with canvas and basic UI


### Key Files
**`main.ts`** - Simple application bootstrap
- Shows character select (currently only Colobus)
- Creates Game instance
- Initializes 3D scene
- Handles errors gracefully

**`Game.ts`** - Core game logic (~300 lines total)
- Three.js scene setup
- Colobus character loading with basic animations (idle, run, jump)
- Player movement with WASD
- Camera following
- Terrain and forest integration

**`terrain.ts`** - 3D world generation
- Procedural terrain creation
- Height calculations
- Material and texture application

**`forest.ts`** - Environmental objects
- Tree and shrub placement
- 3D model loading
- Forest object management

## Server Architecture (`workers/`) - **KEPT SIMPLE**
The backend remains functional with Durable Objects (multiplayer-ready, but current focus is single-player):
**`api.ts`** - Main API router
- HTTP and WebSocket handling
- Route delegation to Durable Objects
- Basic error handling

**Durable Objects (`objects/`)**
- `ForestManager.ts` - Map and multiplayer state (future use)
- `SquirrelSession.ts` - Player sessions (future use)
- `WalnutRegistry.ts` - Game object tracking (future use)
- `Leaderboard.ts` - Scoring system (future use)

## 3D Assets (`public/assets/`)
**Models (`models/`)**
- Environment: Trees, bushes, rocks, terrain
- Characters: Colobus avatar with animations (idle, run, jump)
- Game Objects: Walnuts and interactive items (pending)

**Textures (`textures/`)**
- Terrain textures and materials
- Character textures and skins
- Environmental surface materials

## Configuration Files
**Build & Deploy**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `wrangler.toml` - Cloudflare Workers settings
- `vite.config.ts` - Build configuration

**Development**
- `.gitignore` - Git ignore patterns
- Environment files for different stages

## Development Workflow
### Local Development
```bash
# Start backend (terminal 1)
cd workers && npx wrangler dev --port 8787
# Start frontend (terminal 2)
cd client && npm run dev
# Game available at: http://localhost:5173
# Backend API at: http://localhost:8787

Simple Architecture Benefits

Easy to understand - No complex patterns
Quick to modify - Change game logic in Game.ts
Fast development - No system dependencies
Maintainable - Clear, focused code

Game Controls

WASD - Player movement
Space - Jump (with animation)
Auto - Idle animation when stopped

Next Development Focus
With the simplified architecture and single-player Colobus animation working:

Polish Animations - Add more states if needed
Add Walnuts - Basic hiding/seeking
Enable Multiplayer - Sync positions/animations
Deployment Testing - Verify preview/prod workflows