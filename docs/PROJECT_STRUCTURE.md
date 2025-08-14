# Project Structure Documentation

## Overview
This document provides a guide to the **simplified** Hidden Walnuts game project structure. The project was recently streamlined from a complex enterprise architecture to a focused, simple game architecture.

## Root Directory Structure

```
hidden-walnuts-game/
├── client/                  # Three.js game client (simplified)
├── workers/                 # Cloudflare Workers backend  
├── public/                  # Shared 3D assets
├── docs/                    # Documentation files
└── configuration files      # Build and deployment configs
```

## Client Architecture (`client/`) - **SIMPLIFIED**

### Current Simple Structure
```
client/src/
├── Game.ts                  # Main game logic class
├── main.ts                  # Simple entry point  
├── terrain.ts               # 3D terrain generation
├── forest.ts                # 3D forest objects
├── types.ts                 # Basic type definitions
├── style.css                # Styling
├── vite-env.d.ts           # Vite types
└── test/setup.ts           # Test setup
```

### Key Files

**`main.ts`** - Simple application bootstrap
- Creates Game instance  
- Initializes 3D scene
- Connects to multiplayer
- Handles errors gracefully

**`Game.ts`** - Core game logic (300 lines total)
- Three.js scene setup
- Basic multiplayer WebSocket connection
- Player movement with WASD
- Camera following
- Simple networking

**`terrain.ts`** - 3D world generation
- Procedural terrain creation
- Height calculations
- Material and texture application

**`forest.ts`** - Environmental objects  
- Tree and shrub placement
- 3D model loading
- Forest object management

## ~~Removed Complex Architecture~~

The following complex systems were **removed** for simplicity:

- ~~ECS Framework~~ (10+ systems, complex)
- ~~Dependency Injection~~ (Container, ServiceTokens)
- ~~Enterprise Logging~~ (LogCategory, production logging)
- ~~Client Prediction System~~ (reconciliation, anti-cheat)
- ~~Area of Interest Management~~ (spatial optimization)
- ~~Network Compression~~ (RLE, message batching)
- ~~Complex Event Bus~~ (observer patterns)
- ~~PlayerManager System~~ (lifecycle management)
- ~~Interpolation System~~ (smooth movement)

**Result**: From **31 files** down to **8 files** - much cleaner!

## Server Architecture (`workers/`) - **KEPT SIMPLE**

The backend remains functional with Durable Objects:

**`api.ts`** - Main API router  
- HTTP and WebSocket handling
- Route delegation to Durable Objects
- Basic error handling

**Durable Objects (`objects/`)**
- `ForestManager.ts` - Map and multiplayer state
- `SquirrelSession.ts` - Player sessions  
- `WalnutRegistry.ts` - Game object tracking
- `Leaderboard.ts` - Scoring system

## 3D Assets (`public/assets/`)

**Models (`models/`)**
- Environment: Trees, bushes, rocks, terrain
- Characters: Squirrel avatars (multiple characters available)
- Game Objects: Walnuts and interactive items

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
```

### Simple Architecture Benefits
- **Easy to understand** - No complex patterns
- **Quick to modify** - Change game logic in Game.ts
- **Fast development** - No system dependencies
- **Maintainable** - Clear, focused code

### Game Controls
- **WASD** - Player movement
- **Mouse** - Camera control (follows player)
- **Multiplayer** - Automatic connection to other players

## Next Development Focus

With the simplified architecture, development can focus on:

1. **Core Gameplay** - Walnut hiding/seeking mechanics
2. **Player Sync** - Better multiplayer visual synchronization  
3. **Scoring System** - Points and leaderboards
4. **Game Polish** - Graphics and user experience

The goal is to create a **fun, playable game** rather than an enterprise-grade system!