# Hidden Walnuts Documentation

Welcome to the Hidden Walnuts project documentation. This directory contains documentation for the **simplified** 3D multiplayer game.

## 📁 Documentation Structure

### **Core Project Documentation**
- **[Project Structure](PROJECT_STRUCTURE.md)** - Simplified architecture guide and file organization
- **[Game Vision](GameVision.md)** - Original game design, features, and technical specifications  
- **[MVP Plan](MVP_Plan_Hidden_Walnuts-2.md)** - Historical development roadmap (reference only)
- **[Coding Conventions](conventions.md)** - Standards, best practices, and development guidelines
- **[AI Usage Guidelines](README_AI.md)** - AI workflow and contribution guidelines

## 🎯 **Current Status - Simplified Architecture**

- **Current Phase**: MVP Simple 1 ✅ **COMPLETED**
- **Architecture**: Stripped down from complex ECS to simple Game.ts class
- **Files**: Reduced from 31 complex files to 8 focused files
- **Focus**: Simple, playable game instead of enterprise patterns

## 🔄 **Recent Major Change - Architecture Simplification**

The project underwent a **major simplification**:

### **Before (Complex)**
- 10+ ECS systems (InputSystem, NetworkSystem, etc.)
- Dependency injection containers
- Enterprise logging and error handling
- Client prediction and reconciliation
- Complex multiplayer synchronization
- 31+ files with intricate dependencies

### **After (Simple)**  
- Single `Game.ts` class handles everything
- Simple `main.ts` entry point
- Basic WebSocket multiplayer
- Clean 8-file structure
- Focus on gameplay over architecture

## 📚 **For New Developers**

1. Start with [Game Vision](GameVision.md) to understand the project
2. Review [Project Structure](PROJECT_STRUCTURE.md) for current architecture
3. Read [Coding Conventions](conventions.md) for development standards
4. Check out the simplified `client/src/Game.ts` file

## 🛠️ **For Current Development**

1. **Main game logic**: Edit `client/src/Game.ts` 
2. **Entry point**: Modify `client/src/main.ts`
3. **3D world**: Update `client/src/terrain.ts` or `client/src/forest.ts`
4. **Backend**: Cloudflare Workers in `workers/` directory

## 🚀 **Quick Development**

```bash
# Start the game (2 terminals)
cd workers && npx wrangler dev --port 8787  # Terminal 1
cd client && npm run dev                    # Terminal 2

# Game runs at: http://localhost:5173
```

## ✅ **What's Working**

- ✅ 3D forest environment with terrain
- ✅ Basic multiplayer connection  
- ✅ Player movement with WASD
- ✅ Camera following player
- ✅ WebSocket communication with backend
- ✅ Clean, understandable codebase

## 🎯 **What's Next**

- Add walnut hiding/seeking mechanics
- Improve multiplayer player synchronization
- Add scoring and points system
- Polish graphics and user experience

## 📊 **Architecture Benefits**

The simplified approach provides:
- **Faster development** - No complex system dependencies
- **Easier debugging** - All logic in clear, focused files
- **Better maintainability** - Simple code structure
- **More fun** - Focus on gameplay instead of architecture

## 🚨 **Development Notes**

- The **complex ECS system** has been **removed**
- **MVP 7 and 8b documentation** has been **removed** (outdated)
- Current focus is on **simple, working gameplay**
- Architecture documentation reflects **current simplified state**

This simplified documentation structure provides clear guidance for the current development phase while maintaining focus on creating a fun, playable game.