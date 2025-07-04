# Project Structure Documentation

## Overview
This document provides a comprehensive guide to the Hidden Walnuts game project structure, explaining the purpose and organization of all major files and directories.

## Root Directory Structure

```
hidden-walnuts-game/
├── client/                  # Three.js game client
├── workers/                 # Cloudflare Workers backend
├── public/                  # Shared 3D assets
├── docs/                    # Documentation files
└── configuration files      # Build and deployment configs
```

## Client Architecture (`client/`)

### Entry Point & Bootstrap
- **`main.ts`** - Application bootstrap and initialization
  - Sets up canvas and event handlers
  - Initializes dependency injection container
  - Starts game manager and debug overlays
  - Handles window resize and error boundaries

- **`GameComposition.ts`** - System orchestration and DI setup
  - Configures all game systems with dependency injection
  - Manages system execution order
  - Handles game loop and error recovery
  - Coordinates between client and server systems

### Core Framework (`src/core/`)
- **`Container.ts`** - Dependency injection container
  - Service registration and resolution
  - Singleton and factory pattern support
  - Lifecycle management for all services

- **`EventBus.ts`** - Observer pattern implementation
  - Decoupled communication between systems
  - Type-safe event publishing and subscription
  - Performance-optimized event handling

- **`Logger.ts`** - Production-grade logging system
  - Zero performance cost in production builds
  - Categorized logging (CORE, NETWORK, TERRAIN, etc.)
  - External error reporting integration

- **`types.ts`** - Core type definitions
  - Vector3, Rotation, and other domain models
  - System interfaces and component types
  - Network message types

### ECS Framework (`src/ecs/`)
- **`index.ts`** - Entity-Component-System implementation
  - Entity management with O(1) lookups
  - Component storage and filtering
  - System execution pipeline
  - Memory management and cleanup

### Game Systems (`src/systems/`)
10 optimized systems in execution order:

1. **`InputSystem.ts`** - Player input handling
   - WASD movement controls
   - Input state management
   - Event-driven input processing

2. **`ClientPredictionSystem.ts`** - Local movement prediction
   - Zero-latency input response
   - Position prediction and reconciliation
   - Input history management

3. **`MovementSystem.ts`** - Remote player movement
   - Remote player position updates
   - Movement validation and correction
   - Anti-cheat measures

4. **`InterpolationSystem.ts`** - Smooth movement
   - Remote player interpolation
   - Position smoothing algorithms
   - Visual consistency maintenance

5. **`AreaOfInterestSystem.ts`** - Spatial optimization
   - Distance-based player culling
   - Network traffic optimization
   - Visibility range management

6. **`RenderSystem.ts`** - Visual updates
   - Three.js scene management
   - Entity rendering and updates
   - Camera and lighting control

7. **`NetworkCompressionSystem.ts`** - Message batching
   - RLE compression for network messages
   - Message batching and optimization
   - Bandwidth usage reduction

8. **`NetworkTickSystem.ts`** - Rate-limited updates
   - 5Hz network tick rate (optimized for free tier)
   - State history management
   - Memory cleanup and optimization

9. **`NetworkSystem.ts`** - WebSocket handling
   - Connection management and authentication
   - Message sending and receiving
   - Error handling and reconnection

10. **`PlayerManager.ts`** - Player lifecycle
    - Player entity creation and destruction
    - Session management
    - Player state synchronization

### Domain Services (`src/services/`)
- **`TerrainService.ts`** - Height calculations
  - Procedural terrain generation
  - Height map management
  - Terrain collision detection

### Entity Management (`src/entities/`)
- **`PlayerFactory.ts`** - Player creation
  - Squirrel model loading and setup
  - Player component initialization
  - Entity configuration

### Rendering (`src/rendering/`)
- **`IRenderAdapter.ts`** - Render abstraction
  - Interface for different rendering backends
  - Three.js implementation
  - Future-proof rendering architecture

### World Generation
- **`terrain.ts`** - Terrain generation
  - Procedural height map creation
  - Terrain mesh generation
  - Material and texture application

- **`forest.ts`** - Forest object creation
  - Tree and shrub placement
  - 3D model loading and positioning
  - Environmental object management

### Configuration & Types
- **`types.ts`** - Game-specific types
  - Player, walnut, and game object types
  - Network message interfaces
  - System configuration types

- **`vite.config.ts`** - Build configuration
  - Development and production builds
  - Asset optimization
  - Environment-specific settings

- **`tsconfig.json`** - TypeScript configuration
  - Compiler options and paths
  - Type checking rules
  - Module resolution

### Environment Configuration
- **`.env.development`** - Development environment
- **`.env.preview`** - Preview/staging environment
- **`.env.production`** - Production environment

## Server Architecture (`workers/`)

### API Layer
- **`api.ts`** - Main API router
  - HTTP and WebSocket request handling
  - Route delegation to Durable Objects
  - CORS and security headers
  - Error handling and logging

### Durable Objects (`objects/`)
- **`ForestManager.ts`** - Map cycle and multiplayer
  - Daily forest reset and walnut spawning
  - WebSocket connection management
  - Player synchronization and validation
  - Anti-cheat and movement validation

- **`SquirrelSession.ts`** - Player state management
  - Individual player session persistence
  - Score tracking and statistics
  - Power-up and ability management
  - Session timeout and cleanup

- **`WalnutRegistry.ts`** - Game object tracking
  - Walnut positions and states
  - Ownership and scoring
  - Hiding and finding mechanics
  - Spatial indexing for performance

- **`Leaderboard.ts`** - Scoring system
  - Real-time leaderboard management
  - Score calculation and ranking
  - Bonus point distribution
  - Competition tracking

- **`registry.ts`** - DO access and routing
  - Centralized Durable Object access
  - Instance management and caching
  - Error handling and fallbacks

### Configuration & Types
- **`types.ts`** - Server-side type definitions
  - API request/response types
  - Durable Object interfaces
  - WebSocket message types

- **`constants.ts`** - Server constants
  - Game configuration values
  - Network timeouts and limits
  - Environment-specific settings

- **`Logger.ts`** - Server logging system
  - Consistent logging across client/server
  - Performance monitoring
  - Error tracking and reporting

## Shared Assets (`public/`)

### 3D Models (`assets/models/`)
- **Environment Objects**: Trees, bushes, rocks, ground textures
- **Player Models**: Squirrel avatar and animations
- **Game Objects**: Walnuts, power-ups, decorative elements

### Textures (`assets/textures/`)
- **Terrain Textures**: Ground, grass, and surface materials
- **Object Textures**: Tree bark, leaf textures, rock surfaces
- **UI Elements**: Icons, buttons, and interface graphics

## Documentation (`docs/`)

### Project Documentation
- **`README.md`** - Main project overview and setup
- **`PROJECT_STRUCTURE.md`** - This file - detailed architecture guide
- **`GameVision.md`** - Game design and feature specifications
- **`MVP_Plan_Hidden_Walnuts-2.md`** - Development roadmap and milestones
- **`conventions.md`** - Coding standards and best practices
- **`README_AI.md`** - AI usage guidelines and workflow

### MVP Documentation (`docs/mvp-7/`)
- **Task Documentation**: Individual task specifications and completion status
- **Testing Documentation**: Test plans and validation procedures
- **Implementation Summaries**: Technical details and architectural decisions

## Configuration Files

### Build Configuration
- **`package.json`** - Project dependencies and scripts
- **`tsconfig.json`** - TypeScript compiler configuration
- **`wrangler.toml`** - Cloudflare Workers deployment settings

### Development Tools
- **`.gitignore`** - Git ignore patterns
- **`hide-walnut.sh`** - Development utility scripts

## Development Workflow

### Local Development
```bash
# Start client development server
cd client && npm run dev

# Start worker development server
cd workers && npx wrangler dev --port 8787

# Build validation
cd client && npm run build:preview
cd workers && npm run build
```

### Deployment
- **Client**: Deployed to Cloudflare Pages via GitHub Actions
- **Workers**: Deployed to Cloudflare Workers via Wrangler
- **Assets**: Served from Cloudflare CDN

This structure provides a clean separation of concerns, with clear documentation, organized code, and standardized configuration management. 