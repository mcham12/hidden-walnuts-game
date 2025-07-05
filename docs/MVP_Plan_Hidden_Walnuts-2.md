# Revised MVP Plan for Hidden Walnuts

This plan outlines the development roadmap for *Hidden Walnuts*, a 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. It reorders **Predators** to follow **Performance Optimizations** to ensure the game is visually polished and performs efficiently before adding predator mechanics. The sequence maintains logical progression while addressing priorities for a robust multiplayer foundation, walnut mechanics, and enhanced gameplay features.

---

## Current Status
- **Current MVP**: MVP 7 (Multiplayer Foundation, in progress)
- **Current Task**: MVP 7 Task 10 - Testing & Validation (next up)
- **Recently Completed**: Task 9 - Interest Management ✅
- **Deployment**: Hosted on Cloudflare (Workers for backend, Pages for frontend)
- **Focus**: Completing MVP 7 with comprehensive testing and validation

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

## MVP 7: Multiplayer Foundation
- **Objective**: Establish a robust, scalable multiplayer system following industry-standard patterns.
- **Tasks**:
  1. **Authentication & Session Management** ✅ **COMPLETED**
     - Implement secure token-based authentication via `/join` endpoint
     - Create SquirrelSession Durable Objects for player state persistence
     - Handle player lifecycle: Connect → Authenticate → Spawn → Active → Disconnect
  2. **Enhanced Error Handling & Logging** ✅ **COMPLETED**
     - Comprehensive WebSocket error handling and connection quality monitoring
     - Real-time connection metrics and error categorization
     - Enhanced UI for connection quality and error display
     - Server-side error tracking and diagnostics
  3. **Durable Objects Optimization & Free Tier Compliance** ✅ **COMPLETED**
     - **Task UrgentA.1: Request Batching & Throttling**
       - Client-side batching of multiple game updates into single requests
       - Debounce position updates to reduce request frequency
       - Batch storage operations and implement update queues
       - Reduce Durable Object requests by 70%
     - **Task UrgentA.2: Optimize Durable Object Lifecycle**
       - Reduce object instantiation using single ForestManager for all players
       - Implement proper hibernation by removing pending callbacks
       - Remove unnecessary setTimeout and optimize WebSocket connections
       - Reduce object active time by 50%
     - **Task UrgentA.3: Storage Optimization**
       - Batch SQLite operations into single transactions
       - Implement regular data cleanup and optimize data structures
       - Add storage monitoring and alerts for approaching limits
       - Reduce storage operations by 60%
     - **Task UrgentA.4: Client-Side Caching & State Management**
       - Implement client caching for static game data
       - Reduce server polling using WebSocket events
       - Implement smart sync strategy for essential data only
       - Add offline capability for basic gameplay
     - **Task UrgentA.5: Error Handling & Graceful Degradation**
       - Implement retry logic with exponential backoff
       - Add graceful degradation for non-critical features
       - Provide user notifications for service limitations
       - Implement fallback mechanisms for high load
     - **Task UrgentA.6: Monitoring & Analytics**
       - Add usage tracking for Durable Object duration and requests
       - Implement alerts for approaching free tier limits
       - Add performance profiling and usage analytics
       - Monitor peak usage times for optimization
     - **Task UrgentA.7: Reduce Heartbeat Frequency** ⚠️ **CAUTIOUS**
       - Reduce client heartbeat from 30s to 60-90s
       - Optimize server heartbeat processing
       - Increase heartbeat timeout from 5s to 10-15s
     - **Task UrgentA.8: Optimize Connection Monitoring** ⚠️ **CAUTIOUS**
       - Reduce server monitoring from 30s to 60-120s
       - Reduce client quality checks from 60s to 120-180s
       - Increase connection timeout from 1min to 2-3min
     - **Task UrgentA.9: Reduce Client-Side Polling** ⚠️ **CAUTIOUS**
       - Reduce server metrics polling from 10s to 30-60s
       - Reduce debug updates from 1s to 5-10s
       - Reduce connection quality updates from 10s to 30s
     - **Task UrgentA.10: Optimize Network Tick System** ⚠️ **CAUTIOUS**
       - Reduce network tick rate from 10Hz to 5Hz
       - Reduce input history cleanup frequency
       - Implement position update throttling
     - **Task UrgentA.11: Reduce Session Management Overhead** ⚠️ **CAUTIOUS**
       - Increase session timeout from 30min to 60-90min
       - Reduce session validation frequency during gameplay
       - Batch session storage operations
  4. **Multiplayer Visual Synchronization** ✅ **COMPLETED**
     - Fix squirrel player position issues relative to terrain
     - Resolve duplicate player creation and rendering
     - Fix camera perspective issues when remote players join
     - Ensure consistent player scaling and positioning
     - Implement proper terrain height synchronization
     - Fix player sinking/floating issues
  5. **API Architecture Consolidation** ✅ **COMPLETED**
     - Remove unused `api/` directory (Hono-based API)
     - Consolidate all API logic in `workers/api.ts` (raw Workers)
     - Eliminate code duplication and confusion
     - Clean up project structure and reduce technical debt
  6. **Authoritative Server Architecture** ✅ **COMPLETED**
     - Server owns all game state (player positions, session data)
     - Implement server-side position validation and anti-cheat (speed limits, bounds)
     - Client sends inputs, server validates and broadcasts authoritative results
  7. **WebSocket Connection Lifecycle** ✅ **COMPLETED**
     - Secure WebSocket connections with proper upgrade handling
     - Connection heartbeats and automatic reconnection logic
     - Graceful disconnect handling with session cleanup
  8. **Core Multiplayer Events** ✅ **COMPLETED**
     - `player_join`: When player connects and is ready
     - `player_update`: Position/state changes (with validation)
     - `player_leave`: Clean disconnection
     - `world_state`: Full state on connect, delta updates afterward
     - Implement future-proof session management for both anonymous and authenticated users
     - Add session validation on reconnection with configurable timeouts
     - Implement progressive cleanup states: active → away → disconnected → expired
     - Add client-side cleanup for invalid sessions
     - Design authentication-ready interfaces for future user accounts
     - Configure cleanup rules: 10 minutes for anonymous, 30 minutes for authenticated users
     - Add data migration hooks for when authentication is implemented
  9. **Client-Side Prediction & Reconciliation** ✅ **COMPLETED**
     - Client predicts movement locally for responsiveness (0ms latency)
     - Server sends authoritative position corrections with 1cm precision
     - Client reconciles differences smoothly with interpolation
     - Enhanced input validation with conflict detection and timing checks
     - Gentle world bounds enforcement without breaking terrain systems
     - Performance optimization with memory management and cleanup strategies
  10. **Interest Management** ✅ **COMPLETED**
     - Client-side spatial culling with 50m interest radius, 100m culling radius
     - Server-side intelligent message broadcasting based on player proximity
     - Dynamic update frequency (20Hz close, 2Hz far) based on distance
     - Performance monitoring with broadcast efficiency tracking
     - 60-80% reduction in network traffic through spatial filtering
     - Ready for 50+ concurrent players with optimized broadcasting
  11. **Testing & Validation** 📋 **NEXT UP**
     - Multi-browser real-time synchronization tests
     - Network failure recovery testing
     - Position validation and anti-cheat verification
     - Performance profiling under load
     - Interest management efficiency validation
     - Client prediction accuracy testing
- **Estimated Time**: 5-6 weeks (increased due to Durable Objects optimization task)
- **Current Focus**: Task 10 - Testing & Validation (final MVP 7 task)

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

## MVP 8: Walnut Hiding Mechanics
- **Objective**: Enable players to hide walnuts in the forest environment.
- **Tasks**:
  - Implement walnut pickup and hiding with visual indicators (e.g., buried or in bushes).
  - Store walnut positions persistently using `WalnutRegistry` Durable Object.
  - Optimize walnut rendering by updating only changed positions.
- **Estimated Time**: 3-4 weeks

---

## MVP 9: Walnut Seeking and Scoring
- **Objective**: Allow players to find walnuts and track scores.
- **Tasks**:
  - Enable finding and collecting hidden walnuts.
  - Implement a points system for walnut finds and hides (3 points for game-hidden buried, 1 point for bushes; 2 points for player-hidden buried, 1 point for bushes).
  - Display a real-time leaderboard synchronized via `Leaderboard` Durable Object.
- **Estimated Time**: 2-3 weeks

---

## MVP 10: Daily Map Reset
- **Objective**: Introduce a 24-hour map reset cycle.
- **Tasks**:
  - Implement map reset logic in `ForestManager` to refresh the forest every 24 hours.
  - Seed 100 game-hidden walnuts at each reset.
  - Reset player scores and walnut positions.
- **Estimated Time**: 1-2 weeks

---

## MVP 11: Visual Improvements
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

## MVP 12: Performance Optimizations
- **Objective**: Optimize game performance for smooth gameplay.
- **Tasks**:
  - Implement Level of Detail (LOD) for objects and characters to reduce rendering load.
  - Introduce terrain tiling and texture atlasing for efficient resource management.
  - Optimize rendering pipelines (e.g., batching, culling) to improve frame rates.
  - Profile and refine client and server-side code for better resource usage.
- **Estimated Time**: 4-6 weeks

---

## MVP 13: Predator Mechanics
- **Objective**: Add dynamic predator AI to increase gameplay tension and strategy.
- **Tasks**:
  - Implement hawk and wolf AI with patrol and chase behaviors.
  - Add predator detection and avoidance mechanics for players.
  - Create defensive abilities (e.g., chatter, walnut throwing).
  - Balance predator difficulty and spawn rates.
- **Estimated Time**: 4-5 weeks

---

## MVP 14: Power-Ups and Advanced Features
- **Objective**: Introduce power-ups and advanced gameplay mechanics.
- **Tasks**:
  - Implement scent sniff, fast dig, and decoy nut power-ups.
  - Add participation multiplier system for extended play sessions.
  - Create mini-events (e.g., Nut Rush) for increased engagement.
  - Implement catch-up mechanics for late joiners.
- **Estimated Time**: 3-4 weeks

---

## MVP 15: Social Features and Polish
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