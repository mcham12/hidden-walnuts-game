# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **Hidden Walnuts**, a production-ready multiplayer 3D game where squirrels search for hidden walnuts in a procedurally generated forest. The game uses enterprise-grade architecture with professional networking patterns.

## Architecture

### Monorepo Structure
- **`client/`** - Frontend game client (Vite + TypeScript + Three.js)
- **`workers/`** - Backend services (Cloudflare Workers + Durable Objects)
- **`public/assets/`** - Game assets (3D models, textures, animations)
- **`docs/`** - Documentation organized by MVP phases

### Core Technologies
- **Frontend**: Vite + TypeScript + Three.js + WebGL
- **Backend**: Cloudflare Workers + Durable Objects
- **Architecture**: Entity-Component-System (ECS) + Dependency Injection
- **Networking**: Custom 5Hz multiplayer with client prediction

## Common Commands

### Development
```bash
# Install all dependencies
npm run install:all

# Start backend (run in separate terminal)
npm run dev:worker

# Start frontend (run in separate terminal) 
npm run dev:client

# Or use individual commands:
cd workers && npx wrangler dev --port 8787
cd client && npm run dev
```

### Building
```bash
# Build everything
npm run build

# Build individual components
npm run build:worker  # workers only
npm run build:client  # client only
```

### Testing
```bash
cd client
npm test              # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Run with coverage
npm run test:run      # Run once (CI mode)
```

### Deployment
```bash
npm run deploy        # Deploy to Cloudflare Workers
```

## Game Architecture (ECS Pattern)

### Entity-Component-System
The game uses a sophisticated ECS architecture with 10 systems executing in specific order:

1. **InputSystem** - Capture player input
2. **ClientPredictionSystem** - Immediate local movement prediction
3. **MovementSystem** - Remote player movement processing
4. **NetworkSystem** - Network message handling
5. **PlayerManager** - Player lifecycle management
6. **InterpolationSystem** - Smooth remote player movement
7. **AreaOfInterestSystem** - Spatial optimization
8. **RenderSystem** - Visual updates
9. **NetworkCompressionSystem** - Message batching
10. **NetworkTickSystem** - Rate-limited network updates

### Key Components
- **PositionComponent** - 3D world position
- **RotationComponent** - Rotation state
- **VelocityComponent** - Movement velocity
- **RenderComponent** - Three.js visual representation
- **NetworkComponent** - Multiplayer state
- **InterpolationComponent** - Smooth movement data

### Dependency Injection
All services use clean dependency injection via the Container system:
- Services are registered in `client/src/GameComposition.ts`
- Two-phase initialization: core services first, then scene-dependent services
- No circular dependencies

## Multiplayer Networking

### Client-Server Architecture
- **5Hz network tick rate** (optimized for free tier)
- **Client-side prediction** for zero input lag
- **Server reconciliation** with 1cm precision
- **Area of Interest** optimization (50m visibility, 100m culling)
- **Message compression** using RLE (60%+ bandwidth savings)

### Network Message Flow
1. Client captures input → ClientPredictionSystem applies immediately
2. Input sent to server at 5Hz
3. Server validates and broadcasts authoritative state
4. Clients reconcile predicted state with server state

## File Organization

### Client Structure
- `client/src/main.ts` - Application entry point
- `client/src/GameComposition.ts` - Dependency injection and game management
- `client/src/ecs/` - Entity-Component-System implementation
- `client/src/systems/` - Game systems (Input, Movement, Network, etc.)
- `client/src/entities/` - Entity factories
- `client/src/core/` - Core services (EventBus, Logger, Container)
- `client/src/rendering/` - Rendering abstractions
- `client/src/services/` - Game services (TerrainService)

### Worker Structure
- `workers/api.ts` - Main worker entry point
- `workers/objects/` - Durable Objects for game state
  - `ForestManager.ts` - World state management
  - `SquirrelSession.ts` - Player state
  - `WalnutRegistry.ts` - Game objects
  - `Leaderboard.ts` - Scoring system

### Documentation Structure
- `docs/DOCUMENTATION.md` - Main documentation index
- `docs/mvp-*/` - MVP-organized documentation
- All new docs must follow `docs/mvp-<number>/tasks/` structure

## Development Guidelines

### Code Conventions
- TypeScript strict mode enabled
- Use dependency injection for all services
- Follow ECS patterns for game logic
- Use EventBus for decoupled communication
- Implement proper error boundaries
- Write production-grade logging with LogCategory

### Performance Considerations
- Game targets 60 FPS with 30 FPS minimum guarantee
- Memory usage <100MB baseline (excluding assets)
- Network optimization through compression and culling
- Asset loading is progressive with intelligent caching

### Debugging
- Use `Logger.debug(LogCategory.*, message)` for debugging
- Production builds have zero console overhead
- Test multiplayer with multiple browser windows
- Use browser DevTools for Three.js scene inspection

### Error Handling
- All systems have error boundaries with graceful degradation
- Circuit breaker pattern for automatic error recovery
- Offline mode when multiplayer unavailable
- External error reporting ready for production monitoring

### Asset Management
- 3D models in GLTF format stored in `public/assets/`
- Models have LOD versions (LOD0, LOD1, LOD2, LOD3)
- Character registry system manages available characters
- AssetManager provides caching and loading abstractions

## Testing Strategy

### Client Testing
- Unit tests for ECS components and systems
- Integration tests for multiplayer synchronization
- Performance tests for frame rate and memory usage
- Files: `client/src/test/multiplayer-*.test.ts`

### Test Commands
- `npm test` - Run all tests
- `npm run test:ui` - Interactive test runner
- `npm run test:coverage` - Generate coverage reports

## Important Notes

- **MVP Documentation Structure**: All new documentation must follow the structure in `docs/DOCUMENTATION.md`
- **Two-Phase Service Registration**: Core services first, then scene-dependent services after scene initialization
- **System Execution Order**: Critical for multiplayer synchronization - do not change without understanding implications
- **Network Reconciliation**: 1cm threshold for position corrections to maintain smooth gameplay
- **Production Logging**: Use LogCategory enums and avoid console.log in production code
- **Asset Loading**: All 3D models must be loaded through AssetManager for proper caching