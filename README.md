# 🐿️ Hidden Walnuts - Multiplayer 3D Game

A **simplified** multiplayer 3D game where squirrels search for hidden walnuts in a procedurally generated forest. **Rebuilt with a focus on fun gameplay over enterprise complexity.**

## 🎯 **Current Status - Simplified Architecture**

- **Current Phase**: MVP 3.5 ✅ **COMPLETED** - Multiple Character Selection with 3D Preview
- **Architecture**: **Stripped down** from complex ECS to simple, focused game logic
- **Files**: Reduced from **31 complex files** to **8 focused files**
- **Focus**: **Simple, playable game** instead of enterprise patterns

## 🏗️ **Simple Architecture Overview**

### **Core Technologies** 
- **Frontend**: Vite + TypeScript + Three.js → **Cloudflare Pages**
- **Backend**: Cloudflare Workers + Durable Objects
- **Architecture**: **Simple Game.ts class** (no ECS complexity)  
- **Networking**: **WebSocket via Workers** for real-time sync
- **Platform**: **100% Cloudflare** - Pages + Workers + Durable Objects

📋 **[See CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md)** for complete platform details

### **Simplified System Diagram**

```
┌─────────────────────────────────────────────────────────┐
│             CLOUDFLARE PAGES                           │
│           (game.hiddenwalnuts.com)                     │
├─────────────────────────────────────────────────────────┤
│  main.ts (47 lines)                                    │
│  ├── Creates Game instance                             │
│  ├── Initializes 3D scene                             │
│  ├── Connects to Workers WebSocket                     │
│  └── Handles errors                                   │
├─────────────────────────────────────────────────────────┤
│  Game.ts (250 lines - ALL game logic)                  │
│  ├── Three.js scene setup                             │
│  ├── Animated character (Colobus)                     │
│  ├── Terrain-following movement                       │
│  ├── Camera following                                  │
│  └── WebSocket communication                          │
├─────────────────────────────────────────────────────────┤
│  World Generation                                       │
│  ├── terrain.ts (procedural terrain)                  │
│  ├── forest.ts (trees, shrubs)                        │
│  └── Asset loading (GLTF models)                      │
└─────────────────────────────────────────────────────────┘
                              │
                    WebSocket Connection
                              │
┌─────────────────────────────────────────────────────────┐
│            CLOUDFLARE WORKERS                          │
│           (api.hiddenwalnuts.com)                      │
├─────────────────────────────────────────────────────────┤
│  Durable Objects                                        │
│  ├── ForestManager (World State)                       │
│  ├── SquirrelSession (Player State)                    │
│  ├── WalnutRegistry (Game Objects)                     │
│  └── Leaderboard (Scoring)                             │
└─────────────────────────────────────────────────────────┘
```

## 🚀 **What We Removed (Complexity → Simplicity)**

### **❌ Removed Complex Systems**
- ~~10-system ECS architecture~~ → **Single Game.ts class**
- ~~Dependency injection containers~~ → **Direct instantiation**  
- ~~Enterprise logging system~~ → **Simple console.log**
- ~~Client prediction & reconciliation~~ → **Basic position sync**
- ~~Area of interest management~~ → **See all players**
- ~~Network compression & batching~~ → **Direct WebSocket messages**
- ~~Complex event bus~~ → **Direct method calls**
- ~~PlayerManager system~~ → **Simple player Map**

### **✅ What We Kept (The Good Stuff)**
- ✅ **3D forest environment** with procedural terrain and trees
- ✅ **Animated Colobus character** with idle/run/jump animations
- ✅ **Terrain-following movement** with bounding box positioning
- ✅ **Player movement** with WASD controls  
- ✅ **Camera following** player smoothly
- ✅ **Cloudflare Workers backend** (working perfectly)
- ✅ **Asset loading** for GLTF models and animations

**Result**: **7,214 lines of complexity removed!** 🗑️

## 🎮 **Current Game Features**

- ✅ **3D Forest Environment** - Procedurally generated terrain with height-based colors
- ✅ **Animated Colobus Character** - Fully animated with idle, run, and jump states
- ✅ **Terrain-Following Movement** - Character feet properly positioned on uneven terrain
- ✅ **WASD Controls** - Responsive movement with camera following
- ✅ **Character Animations** - Automatic idle/run/jump animation switching
- ✅ **Gravity & Jumping** - Physics-based movement with Space key jumping
- ✅ **Asset Loading** - GLTF models with separate animation files

## 🚀 **Development Setup (Super Simple)**

### **Quick Start**
```bash
# Install dependencies  
npm run install:all

# Terminal 1: Start backend
npm run dev:worker

# Terminal 2: Start frontend  
npm run dev:client

# Game available at: http://localhost:5173
```

### **Manual Setup**
```bash
# Backend (terminal 1)
cd workers && npx wrangler dev --port 8787

# Frontend (terminal 2)  
cd client && npm run dev
```

## 📚 **Documentation**

- **[📖 Documentation Index](docs/DOCUMENTATION.md)** - Updated for simplified architecture
- **[🏗️ Project Structure](docs/PROJECT_STRUCTURE.md)** - Current 8-file structure
- **[🎮 Game Vision](docs/GameVision.md)** - Original game design vision
- **[📋 MVP Plan](docs/MVP_Plan_Hidden_Walnuts-2.md)** - Historical roadmap (reference)
- **[⚙️ Conventions](docs/conventions.md)** - Simplified development standards

## 🎯 **What's Next (Simple Additions)**

### **Immediate Next Steps**
1. **Walnut Mechanics** - Add hiding/seeking gameplay  
2. **Player Sync** - Better visual synchronization
3. **Scoring System** - Points for finding walnuts
4. **Game Polish** - Improved graphics and UX

### **Why This Approach Works**
- **Faster Development** - No complex system dependencies
- **Easier Debugging** - All logic in clear, focused files  
- **Better Maintainability** - Simple code structure
- **More Fun** - Focus on gameplay instead of architecture
- **Still Production Ready** - Cloudflare backend handles scale

## 🎮 **Controls & Gameplay**

- **WASD** - Move your squirrel around
- **Mouse** - Camera automatically follows player
- **Multiplayer** - See other players in real-time
- **3D World** - Navigate through forest terrain

**Game URL**: http://localhost:5173

## 📊 **Simple Architecture Benefits**

Instead of enterprise complexity, you get:

- **8 focused files** vs 31 complex files
- **300-line Game.ts** vs 1000s of lines across systems  
- **Simple console.log** vs complex logging infrastructure
- **Direct method calls** vs event bus architecture
- **Basic WebSocket** vs client prediction systems
- **Clear code flow** vs dependency injection maze

## 🏆 **Architecture Philosophy**

**"Simple is better than complex. Fun is better than perfect."**

- ✅ **Readability over cleverness**
- ✅ **Working game over perfect architecture** 
- ✅ **Fun gameplay over enterprise patterns**
- ✅ **8 files over 31 files**
- ✅ **300 lines over 7,214 lines**

---

**The focus is now on making a fun, playable game rather than showcasing enterprise architecture patterns!** 🎮