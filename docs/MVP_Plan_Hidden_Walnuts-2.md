# Revised MVP Plan for Hidden Walnuts

This plan outlines the development roadmap for *Hidden Walnuts*, a 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. It reorders **Predators** to follow **Performance Optimizations** to ensure the game is visually polished and performs efficiently before adding predator mechanics. The sequence maintains logical progression while addressing priorities for a robust multiplayer foundation, walnut mechanics, and enhanced gameplay features.

---

## Current Status
- **Current MVP**: MVP 8 (Animated Squirrel Players & NPC Characters, next up)
- **Recently Completed**: MVP 7 (Multiplayer Foundation) ✅ **COMPLETED**
- **Deployment**: Hosted on Cloudflare Workers with Durable Objects
- **Testing**: AI-driven automated testing infrastructure implemented ✅
- **Focus**: Moving to MVP 8 - Animated Squirrel Players & NPC Characters

---

## MVP 4.5: Deployment and Bug Fixing (Completed)
- Deployed to Cloudflare with persistent walnut positions.
- Fixed camera movement issues and ensured proper terrain navigation.

---

## MVP 5: Basic Forest Environment (Completed)
- Created a navigable terrain with hills, trees, and shrubs.
- Optimized terrain height calculations and rendering.

---

## MVP 6: Player Avatar and Movement (In Progress)
- Implemented squirrel avatar model with WASD movement.
- Added third-person camera following the player.
- **Status**: Core movement and camera implemented; refining for multiplayer integration.

---

## MVP 7: Multiplayer Foundation ✅ **COMPLETED**

**Objective**: Establish robust multiplayer infrastructure with client prediction, server reconciliation, and interest management.

**Key Achievements**:
- ✅ **Authentication & Session Management** - Secure player authentication with session persistence
- ✅ **Enhanced Error Handling & Logging** - Comprehensive error tracking and debugging
- ✅ **Durable Objects Optimization** - Free tier compliance with efficient state management
- ✅ **Multiplayer Visual Synchronization** - Real-time player position and movement sync
- ✅ **API Architecture Consolidation** - Clean, maintainable API structure
- ✅ **Authoritative Server Architecture** - Server-side validation and anti-cheat measures
- ✅ **WebSocket Lifecycle Management** - Robust connection handling and reconnection
- ✅ **Core Events System** - Event-driven architecture for scalability
- ✅ **Client Prediction & Reconciliation** - Zero-latency input with server authority
- ✅ **Interest Management** - Spatial optimization for scalable multiplayer
- ✅ **Testing & Validation** - AI-driven automated testing infrastructure

**Infrastructure**: Cloudflare Workers with Durable Objects, WebSocket connections, client-side prediction
**Performance**: 60 FPS target, 0ms input latency, 60-80% network traffic reduction
**Testing**: 90%+ coverage on critical multiplayer sync systems

---

## Automated Testing Infrastructure (MVP-7+)

- **Framework:** Vitest (AI-optimized, fast, and Vite-native)
- **Coverage:** 90%+ on all critical multiplayer sync and core systems
- **Philosophy:**
  - All tests are designed for AI comprehension and maintenance
  - Automated, repeatable, and coverage-enforced
  - Focus on multiplayer state sync, prediction, reconciliation, and network reliability
- **Workflow:**
  1. All new features and bugfixes must include or update automated tests
  2. Tests must pass locally (`npm run test:run`) before PR/merge
  3. Coverage reports (`npm run test:coverage`) must meet thresholds
  4. AI (Cursor) is responsible for designing, maintaining, and running all tests
- **Future MVPs:**
  - All MVPs after MVP-7 must include automated test requirements for new features
  - Test coverage and requirements must be documented in each MVP's README

---

## MVP 8: Animated Squirrel Players & NPC Characters 🎯 **CURRENT FOCUS**

**Objective**: Implement animated squirrel player avatars and NPC characters to create a vibrant, living forest environment.

**Planned Features**:
- **Animated Squirrel Avatars** - Rigged 3D squirrel models with smooth animations
- **Player Animation System** - Running, walking, jumping, digging, and idle animations
- **NPC Squirrel Characters** - AI-driven non-player characters with realistic behaviors
- **Animation Blending** - Smooth transitions between different animation states
- **Performance Optimization** - Efficient animation system for multiple characters
- **Visual Polish** - High-quality textures and lighting for character models

**Technical Requirements**:
- Extend existing multiplayer infrastructure for animated characters
- Implement animation state management and synchronization
- Add NPC AI system with pathfinding and behavior trees
- Create efficient animation rendering pipeline
- Integrate with existing terrain and forest systems
- Add character customization options

**Animation System**:
- **Player Animations**: Run, walk, jump, dig, idle, look around
- **NPC Behaviors**: Patrol, forage, socialize, flee from predators
- **Animation Sync**: Real-time synchronization across multiplayer
- **Performance**: Support 20+ animated characters simultaneously

**Estimated Time**: 3-4 weeks
**Dependencies**: MVP 7 (Multiplayer Foundation) ✅ **COMPLETED**

---

## MVP 9: Enhanced Gameplay Features

**Objective**: Add engaging gameplay mechanics and features to create a compelling multiplayer experience.

**Planned Features**:
- **Walnut Collection System** - Players can find, collect, and hide walnuts
- **Scoring & Leaderboards** - Track player performance and achievements
- **Enhanced Terrain Interaction** - Climbing, jumping, and environmental obstacles
- **Player Progression** - Experience points, levels, and unlockable abilities
- **Social Features** - Chat system, player names, and friend lists
- **Game Modes** - Hide & seek, time trials, and cooperative challenges

**Technical Requirements**:
- Extend existing multiplayer infrastructure
- Add persistent data storage for player progress
- Implement real-time leaderboard updates
- Create scalable achievement system
- Add client-side caching for performance

**Estimated Time**: 4-5 weeks
**Dependencies**: MVP 8 (Animated Squirrel Players & NPC Characters)

---

## MVP 10: Walnut Seeking and Scoring
- **Objective**: Allow players to find walnuts and track scores.
- **Tasks**:
  - Enable finding and collecting hidden walnuts.
  - Implement a points system for walnut finds and hides (3 points for game-hidden buried, 1 point for bushes; 2 points for player-hidden buried, 1 point for bushes).
  - Display a real-time leaderboard synchronized via `Leaderboard` Durable Object.
- **Estimated Time**: 2-3 weeks

---

## MVP 11: Daily Map Reset
- **Objective**: Introduce a 24-hour map reset cycle.
- **Tasks**:
  - Implement map reset logic in `ForestManager` to refresh the forest every 24 hours.
  - Seed 100 game-hidden walnuts at each reset.
  - Reset player scores and walnut positions.
- **Estimated Time**: 1-2 weeks

---

## MVP 12: Visual Improvements
- **Objective**: Enhance the game's visual quality and immersion.
- **Tasks**:
  - Upgrade textures for terrain, trees, shrubs, and avatars (e.g., higher resolution).
  - Implement advanced lighting techniques (e.g., dynamic shadows).
  - Add environmental details (e.g., grass, weather effects) for a richer game world.
  - Ensure visual consistency across devices and browsers.
  - **Window Resize Handling**: Fix camera aspect ratio and renderer sizing when browser window is resized; ensure responsive canvas behavior and proper projection matrix updates.
  - **Debug UI Polish**: Fix server metrics debug panel data persistence issues (totalConnections, uptime, latency calculations) and add production toggle for debug panels.
  - **Player Height Synchronization**: Fix player height inconsistencies between local and remote players; ensure consistent terrain height calculations and proper player positioning relative to terrain surface.
- **Estimated Time**: 4-6 weeks

---

## MVP 13: Performance Optimizations
- **Objective**: Optimize game performance for smooth gameplay.
- **Tasks**:
  - Implement Level of Detail (LOD) for objects and characters to reduce rendering load.
  - Introduce terrain tiling and texture atlasing for efficient resource management.
  - Optimize rendering pipelines (e.g., batching, culling) to improve frame rates.
  - Profile and refine client and server-side code for better resource usage.
- **Estimated Time**: 4-6 weeks

---

## MVP 14: Predator Mechanics
- **Objective**: Add dynamic predator AI to increase gameplay tension and strategy.
- **Tasks**:
  - Implement hawk and wolf AI with patrol and chase behaviors.
  - Add predator detection and avoidance mechanics for players.
  - Create defensive abilities (e.g., chatter, walnut throwing).
  - Balance predator difficulty and spawn rates.
- **Estimated Time**: 4-5 weeks

---

## MVP 15: Power-Ups and Advanced Features
- **Objective**: Introduce power-ups and advanced gameplay mechanics.
- **Tasks**:
  - Implement scent sniff, fast dig, and decoy nut power-ups.
  - Add participation multiplier system for extended play sessions.
  - Create mini-events (e.g., Nut Rush) for increased engagement.
  - Implement catch-up mechanics for late joiners.
- **Estimated Time**: 3-4 weeks

---

## MVP 16: Social Features and Polish
- **Objective**: Add social features and final polish for a complete game experience.
- **Tasks**:
  - Implement squirrel messages and notifications.
  - Add cosmetic rewards and progression systems.
  - Create hot zone indicators for recent activity.
  - Finalize UI/UX polish and accessibility features.
- **Estimated Time**: 2-3 weeks

---

## Development Guidelines

### **Priority Order**
1. **Multiplayer Foundation** (MVP 7) - Critical for core gameplay
2. **Walnut Mechanics** (MVP 8-9) - Essential game loop
3. **Daily Reset** (MVP 10) - Core game cycle
4. **Visual Polish** (MVP 11) - User experience
5. **Performance** (MVP 12) - Scalability
6. **Advanced Features** (MVP 13-15) - Game depth

### **Technical Considerations**
- **Cloudflare Free Tier**: All optimizations must respect DO usage limits
- **Performance**: Maintain 60 FPS target with 30 FPS minimum
- **Scalability**: Support 50+ concurrent players
- **Compatibility**: Chrome/Edge/Firefox/Safari support

### **Quality Assurance**
- **Testing**: Each MVP includes comprehensive testing phase
- **Documentation**: Update technical docs with each major change
- **Performance**: Monitor and optimize throughout development
- **User Feedback**: Gather feedback after each MVP release

This roadmap ensures a solid foundation while building toward the complete *Hidden Walnuts* vision with proper prioritization and technical considerations. 