# Hidden Walnuts Game Vision

## Overview
*Hidden Walnuts* is a 3D online synchronous multiplayer game set in a persistent forest map that refreshes every 24 hours. Players hide and seek walnuts in a dynamic 3D world with predators and competitive scoring.

## Core Features

### Game World
- **Persistent Forest Map**: 3D world resetting every 24 hours
- **Walnut Placement**: 100 game-hidden walnuts + 3 per player
- **Hot Zones**: Map indicators for recent activity

### Gameplay Mechanics
- **Entry**: Players join anytime, get Squirrel ID + 3 walnuts
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
- **Catch-Up**: "Fresh Squirrel Boost" for late joiners
- **Mini-Events**: "Nut Rush" every 4 hours

## Technical Architecture

### Client
- Three.js for 3D rendering (`game.hiddenwalnuts.com`)
- WebSocket communication with backend
- Handles player input and real-time updates

### Server
- Cloudflare Workers (`api.hiddenwalnuts.com`)
- Durable Objects: ForestManager, SquirrelSession, WalnutRegistry, Leaderboard
- WebSocket protocol for real-time updates

### Project Structure
```
hidden-walnuts-game/
├── client/                  # Three.js game client
├── workers/                 # Cloudflare Workers backend
├── docs/                    # Documentation
└── public/assets/           # 3D models, textures, animations
```

## Implementation Status
- ✅ Multiplayer Foundation, Terrain System, Player Movement
- ✅ Asset Loading, ECS Architecture, Durable Objects
- 🔄 Walnut Mechanics (MVP 8)
- 📋 Scoring System (MVP 9), Daily Reset (MVP 10) 