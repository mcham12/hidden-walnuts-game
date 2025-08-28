# Hidden Walnuts Game Vision
## Overview
*Hidden Walnuts* is a 3D online synchronous multiplayer game set in a persistent forest map that refreshes every 24 hours. Players hide and seek walnuts in a dynamic 3D world with predators and competitive scoring.
## Core Features
### Game World
- **Persistent Forest Map**: 3D world resetting every 24 hours
- **Walnut Placement**: 100 game-hidden walnuts + 3 per player
- **Hot Zones**: Map indicators for recent activity
### Gameplay Mechanics
- **Entry**: Players join anytime, get Player ID + 3 walnuts
- **Hiding**: Press "H" to hide walnuts (buried/bushes)
- **Seeking**: Search for walnuts, steal/rehide others'
- **Predators**: Hawks/wolves with defenses (chatter, projectiles)
- **Power-Ups**: Scent Sniff, Fast Dig, Decoy Nut
### Scoring & Participation
- **Points**: Game walnuts (3 buried, 1 bushes), Player walnuts (2 buried, 1 bushes)
- **Multiplier**: Scales with time played (1.1x to 2x)
- **Leaderboard**: Real-time 24-hour cycle scoring
### Asynchronous Play
- **Persistent Walnuts**: Remain if players log off
- **Catch-Up**: "Fresh Player Boost" for late joiners
- **Mini-Events**: "Nut Rush" every 4 hours
## Technical Architecture
### Client
- Three.js for 3D rendering (`game.hiddenwalnuts.com`)
- WebSocket communication with backend
- Handles player input and real-time updates
- Simplified structure: Core logic in `Game.ts` (no ECS)
### Server
- Cloudflare Workers (`api.hiddenwalnuts.com`)
- Durable Objects: ForestManager, PlayerSession, WalnutRegistry, Leaderboard
- WebSocket protocol for real-time updates
### Project Structure
hidden-walnuts-game/
├── client/ # Three.js game client
├── workers/ # Cloudflare Workers backend
├── docs/ # Documentation
└── public/assets/ # 3D models, textures, animations
## Implementation Status (Updated August 28, 2025)
- ✅ Simplified Architecture: Single `Game.ts` for core logic, terrain, forest, and animated character system
- ✅ Terrain System: Procedural generation with height mapping and character terrain-following
- ✅ Player Movement: WASD controls with smooth camera following and gravity physics
- ✅ Character Animations: Colobus character with idle/run/jump animations and proper terrain positioning
- ✅ Asset Loading: GLTF models with separate animation files and bounding box positioning
- ✅ Character Physics: Gravity, jumping (Space key), and proper ground contact detection
- 🔄 Walnut Mechanics: Not yet implemented (next priority after character system complete)
- 📋 Multiplayer Integration: Backend ready, client integration pending
- 📋 Scoring System: Backend ready (Leaderboard DO), client integration pending
- 📋 Daily Reset: Backend configured, not active in single-player mode