# Hidden Walnuts - 3D Multiplayer Game

A 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. Built with Three.js, TypeScript, and Cloudflare Workers.

## 🎯 **Current Status**

- **Current Phase**: MVP Simple 1 (Simplified Architecture) ✅ **COMPLETED**
- **Architecture**: Stripped down from complex ECS to simple, focused game logic
- **Deployment**: Hosted on Cloudflare Workers with Durable Objects
- **Focus**: Simple, fun gameplay over enterprise complexity

## 🚀 **Key Features**

### **Recently Completed** ✅
- **Simple Game Architecture** - Replaced complex ECS with straightforward Game.ts class
- **Basic Multiplayer** - WebSocket connection with position sync
- **3D Forest Environment** - Terrain and forest with Three.js
- **Player Movement** - WASD controls with camera following
- **Clean Codebase** - Reduced from 31 files to 8 focused files

### **Next Steps** 🎯
- **Walnut Mechanics** - Hide and seek gameplay
- **Scoring System** - Points for finding walnuts
- **Player Synchronization** - Better multiplayer visual sync
- **Game Polish** - Improved graphics and animations

## 🛠️ **Technology Stack**

- **Frontend**: Three.js, TypeScript, Vite
- **Backend**: Cloudflare Workers, Durable Objects, WebSockets
- **Architecture**: Simple, focused classes instead of complex ECS
- **Deployment**: Cloudflare Pages and Workers

## 📚 **Documentation**

- [Game Vision](docs/GameVision.md) - Original game design vision
- [MVP Plan](docs/MVP_Plan_Hidden_Walnuts-2.md) - Development roadmap (historical)
- [Project Structure](docs/PROJECT_STRUCTURE.md) - Current codebase organization

## 🚀 **Quick Start**

```bash
# Install dependencies
npm run install:all

# Start backend (separate terminal)
npm run dev:worker

# Start frontend (separate terminal)  
npm run dev:client

# Or manually:
cd workers && npx wrangler dev --port 8787
cd client && npm run dev
```

## 📊 **Simplified Architecture**

Instead of complex enterprise patterns, we now have:

- **Game.ts** - Main game logic (3D scene, multiplayer, input)
- **main.ts** - Simple entry point
- **terrain.ts & forest.ts** - 3D world generation
- **Backend** - Cloudflare Workers with WebSocket support

**Game runs at**: http://localhost:5173
**Backend at**: http://localhost:8787

## 🎮 **Controls**

- **WASD** - Move player
- **Mouse** - Look around (camera follows player)
- **Game loads automatically** - No complex setup needed

The focus is now on making a **fun, playable game** rather than an enterprise-grade system!