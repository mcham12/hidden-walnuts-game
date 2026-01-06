# Hidden Walnuts - Multiplayer 3D Browser Game

A production-ready **multiplayer 3D game** where players explore a procedurally generated forest, hide and find walnuts, defend against predators, and compete on weekly leaderboards. Built entirely on **Cloudflare's edge platform** for global low-latency gameplay.

**Play Now**: [game.hiddenwalnuts.com](https://game.hiddenwalnuts.com)

## Current Status - MVP 16

- **Phase**: Authentication & Character System
- **Status**: Production-ready multiplayer game with 22+ active players
- **Architecture**: Cloudflare Pages (client) + Cloudflare Workers + Durable Objects (backend)
- **Features**: Full authentication, 10 characters, NPCs, predators, leaderboards, combat, tree growth

## Game Features

### Core Gameplay
- **Walnut Mechanics**: Hide walnuts for future discovery, find golden walnuts for points
- **Tree Growth System**: Hidden walnuts grow into trees after 60 seconds, spawning 5 new walnuts
- **Combat System**: Use walnuts as projectiles (20 HP damage), 100 HP health system
- **Survival**: Manage health through walnut consumption, defend against predators
- **Progression**: 7-tier rank system (Rookie → Legend) based on score

### Multiplayer Features
- **Real-time sync**: See other players move, emote, and interact in real-time
- **Chat system**: Quick chat messages with 2-second cooldown
- **Emotes**: Express yourself with animated emotes
- **Weekly leaderboard**: Compete for top positions, resets every Sunday
- **Daily challenges**: Fresh forest generation and walnut spawns daily

### Character System (MVP 16)
- **Guest players**: Single character (Squirrel) with full gameplay access
- **Authenticated players**: 6 free characters (Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard)
- **Authenticated players**: Unlock additional characters (Hare, Goat, Chipmunk, Turkey, Mallard)
- **All Characters Free**: No purchases required, simply play or sign in to unlock

### PvE Content
- **NPCs**: Up to 2 AI squirrels that wander, gather walnuts, and throw at players
- **Aerial Predators**: Cardinals and Toucans that dive to steal walnuts (MVP 12)
- **Ground Predators**: Wildebeests that charge and ram players (MVP 12)
- **Rank-based difficulty**: Higher-ranked players face more aggressive AI

### Authentication System (MVP 16)
- **Email/password accounts**: Secure authentication with JWT tokens
- **Email verification**: Optional email verification for enhanced features
- **Password reset**: Forgot password flow with email recovery
- **Session persistence**: 30-day access tokens, 90-day refresh tokens
- **Character unlocking**: Sign in to unlock additional characters

### Technical Features
- **Bot protection**: Cloudflare Turnstile verification on all connections
- **Rate limiting**: 5 connections per 5 minutes per IP
- **Anti-cheat**: Server-authoritative movement, score, and combat validation
- **Mobile support**: Touch controls for iOS and Android
- **Responsive design**: Optimized for desktop, tablet, and mobile

## Architecture Overview

### Technology Stack
- **Client**: Vite + TypeScript + Three.js → Cloudflare Pages
- **Backend**: Cloudflare Workers + Durable Objects + WebSockets
- **Persistence**: Durable Object storage + KV namespaces
- **Security**: Turnstile bot protection + JWT authentication
- **Deployment**: GitHub Actions → Cloudflare (auto-deploy)

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│             CLOUDFLARE PAGES                           │
│           (game.hiddenwalnuts.com)                     │
├─────────────────────────────────────────────────────────┤
│  Client Application                                     │
│  ├── main.ts - Bootstrap & initialization              │
│  ├── Game.ts - Core engine (8,349 lines)               │
│  ├── WelcomeScreen.ts - Login/guest flow               │
│  ├── AuthModal.ts - Authentication UI                  │
│  ├── CharacterGrid.ts - Character selection            │
│  ├── NetworkSystem.ts - Multiplayer sync               │
│  ├── AudioManager.ts - Sound effects & music           │
│  └── Components/ - UI systems (HUD, settings, etc.)    │
├─────────────────────────────────────────────────────────┤
│  3D Rendering                                           │
│  ├── Three.js scene (terrain, forest, characters)      │
│  ├── 10 animated GLTF characters                       │
│  ├── 400×400 unit procedural terrain                   │
│  ├── Particle effects (sparkles, dirt, confetti)       │
│  └── Projectile physics with gravity                   │
└─────────────────────────────────────────────────────────┘
                              │
                    WebSocket (wss://)
                              │
┌─────────────────────────────────────────────────────────┐
│            CLOUDFLARE WORKERS                          │
│           (api.hiddenwalnuts.com)                      │
├─────────────────────────────────────────────────────────┤
│  Durable Objects (Stateful Backend)                    │
│  ├── ForestManager (Singleton)                         │
│  │   ├── WebSocket hub for all players                │
│  │   ├── Game state (walnuts, forest, NPCs)           │
│  │   ├── Combat system & health tracking              │
│  │   ├── Predator AI (PredatorManager)                │
│  │   └── NPC AI (NPCManager)                          │
│  │                                                      │
│  ├── PlayerIdentity (Per Username)                     │
│  │   ├── Email/password authentication                │
│  │   ├── JWT token management                         │
│  │   ├── Character unlocks & entitlements             │
│  │   └── Session token mapping                        │
│  │                                                      │
│  ├── Leaderboard (Singleton)                           │
│  │   ├── Weekly leaderboard (resets Sunday)           │
│  │   ├── All-time leaderboard                         │
│  │   └── Rank calculation & progression               │
│  │                                                      │
│  ├── WalnutRegistry (Singleton)                        │
│  │   └── Walnut storage & archival                    │
│  │                                                      │
│  └── SquirrelSession (Per Player)                      │
│      └── Individual session state & position          │
├─────────────────────────────────────────────────────────┤
│  KV Namespaces                                          │
│  ├── EMAIL_INDEX - Email uniqueness enforcement        │
│  └── LEADERBOARD_ARCHIVES - Historical snapshots       │
├─────────────────────────────────────────────────────────┤
│  Cron Triggers                                          │
│  ├── Daily (8am UTC): Reset map, forest, positions     │
│  └── Weekly (Sunday 8:05am UTC): Reset leaderboard     │
└─────────────────────────────────────────────────────────┘
```

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account (for deployment)
- Wrangler CLI (for Workers development)

### Quick Start

```bash
# Install all dependencies
npm run install:all

# Terminal 1: Start backend (Workers + Durable Objects)
npm run dev:worker

# Terminal 2: Start frontend (Vite dev server)
npm run dev:client

# Game available at: http://localhost:5173
# API available at: http://localhost:8787
```

### Manual Setup

```bash
# Backend (Cloudflare Workers)
cd workers
npm install
npx wrangler dev --port 8787

# Frontend (Vite)
cd client
npm install
npm run dev
```

## Build & Deployment

### Build Commands

```bash
# Build client
npm run build:client        # Production build
npm run build:preview       # Preview build

# Build worker
npm run build:worker
```

### Deployment (GitHub Actions)

The game auto-deploys via GitHub Actions:

```
Push to main → Production deployment
  ├── Client → game.hiddenwalnuts.com (Cloudflare Pages)
  └── Worker → api.hiddenwalnuts.com (Cloudflare Workers)

Push to mvp-* → Preview deployment
  ├── Client → <hash>.hidden-walnuts-game.pages.dev
  └── Worker → hidden-walnuts-api-preview.mattmcarroll.workers.dev
```

## Game Controls

### Desktop
- **WASD** - Move character
- **Mouse** - Camera control
- **Left Click** - Find walnut
- **Right Click** - Hide walnut
- **Space** - Throw walnut (combat)
- **F1** - Tutorial overlay
- **ESC** - Settings menu

### Mobile
- **Single finger drag** - Move character
- **Two finger drag** - Camera rotation
- **Tap** - Find walnut
- **Double tap** - Hide walnut
- **Long hold** - Throw walnut

## Documentation

### Core Documentation
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Architecture and file organization
- **[Game Vision](docs/GameVision.md)** - Design philosophy and features
- **[Cloudflare Architecture](docs/CLOUDFLARE_ARCHITECTURE.md)** - Platform details
- **[Conventions](docs/conventions.md)** - Development standards

### Technical Documentation
- **[Authentication Tech Approach](docs/Authentication_Tech_Approach.md)** - Auth implementation
- **[Character Implementation](docs/Character_Implementation.md)** - Character system
- **[Animation State Machine](docs/ANIMATION_STATE_MACHINE.md)** - Animation system
- **[Bot Prevention](docs/BOT_PREVENTION_OPTIONS.md)** - Turnstile integration
- **[Admin API](docs/ADMIN_API_REFERENCE.md)** - Management endpoints

### MVP Progress Documentation
- **[MVP 16 Progress](docs/MVP_16_Progress.md)** - Current development phase (Auth & Characters)
- **[MVP 15 Completion](docs/MVP_15_COMPLETION.md)** - Scheduled tasks & resets
- **[MVP 14 Progress](docs/MVP_14_PROGRESS.md)** - Tree growth bonuses
- **[MVP 13 Progress](docs/MVP_13_PROGRESS.md)** - Admin APIs
- **[MVP 12 Design](docs/MVP_12_Predator_Defense_Design.md)** - Predator system

## Project Statistics

### Client (TypeScript)
- **Game.ts**: 8,349 lines (core engine)
- **AuthService.ts**: 399 lines (authentication)
- **NetworkSystem.ts**: 1,200+ lines (multiplayer)
- **Total files**: 47+ TypeScript files

### Server (Cloudflare Workers)
- **ForestManager.ts**: 129 KB (game state)
- **PlayerIdentity.ts**: 33 KB (authentication)
- **Leaderboard.ts**: 22 KB (rankings)
- **Total Durable Objects**: 5 classes

### Assets
- **Characters**: 10 animated GLTF models
- **Animations**: 6-8 states per character (idle, walk, run, attack, death, etc.)
- **Sounds**: 28 sound effects + ambient audio
- **Terrain**: Procedural 400×400 unit world

## Current Metrics (Live Production)

- **Active players**: 22+ total registered
- **Weekly leaderboard**: Top 10 authenticated players
- **Uptime**: 99.9%+ (Cloudflare edge)
- **Latency**: <50ms globally (edge deployment)

## Development Roadmap

### Completed Milestones
- ✅ MVP 1-6: Core gameplay, sessions, identity
- ✅ MVP 7: NPC AI system, Turnstile bot protection
- ✅ MVP 8: Combat system with health & walnut projectiles
- ✅ MVP 9: Tree growth, reconnection, walnut drops
- ✅ MVP 12: Predator system with rank-based targeting
- ✅ MVP 13: Admin APIs and metrics tracking
- ✅ MVP 14: Tree-growing milestone bonuses
- ✅ MVP 15: Scheduled tasks (daily/weekly resets)
- ✅ MVP 16: Email/password authentication, character gating

### Next Steps
- **Mobile optimization**: Improve touch controls and performance
- **Social features**: Friend system, private messages
- **Seasonal content**: Limited-time characters and events
- **No Monetization**: 100% Free-to-play experience
- **Analytics**: Player behavior tracking and insights

## Architecture Philosophy

**Production-ready edge deployment over enterprise complexity**

- ✅ **Global performance** via Cloudflare's edge network
- ✅ **Scalability** through Durable Objects (stateful coordination)
- ✅ **Security** via Turnstile, rate limiting, server-authoritative design
- ✅ **Developer experience** with TypeScript, hot reload, preview deployments
- ✅ **Cost efficiency** - Pay only for what you use, automatic scaling

## Contributing

This is a solo development project, but feedback and bug reports are welcome via GitHub Issues.

## License

Proprietary - All rights reserved

---

**The focus is on creating a fun, engaging multiplayer game experience with professional polish and global accessibility.**
