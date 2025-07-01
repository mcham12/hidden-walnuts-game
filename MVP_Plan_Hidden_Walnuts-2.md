# Revised MVP Plan for Hidden Walnuts

This plan outlines the development roadmap for *Hidden Walnuts*, a 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. It reorders **Predators** to follow **Performance Optimizations** to ensure the game is visually polished and performs efficiently before adding predator mechanics. The sequence maintains logical progression while addressing priorities for a robust multiplayer foundation, walnut mechanics, and enhanced gameplay features.

---

## Current Status
- **Current MVP**: MVP 7 (Multiplayer Foundation, in progress)
- **Current Task**: Task 3 - Multiplayer Visual Synchronization
- **Deployment**: Hosted on Cloudflare (Workers for backend, Pages for frontend)
- **Focus**: Resolving issues with multiplayer visibility, model rendering (trees/shrubs with bounding boxes), and walnut visibility

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
  3. **Multiplayer Visual Synchronization** 🔄 **CURRENT TASK**
     - Fix squirrel player position issues relative to terrain
     - Resolve duplicate player creation and rendering
     - Fix camera perspective issues when remote players join
     - Ensure consistent player scaling and positioning
     - Implement proper terrain height synchronization
     - Fix player sinking/floating issues
  4. **Authoritative Server Architecture**
     - Server owns all game state (player positions, session data)
     - Implement server-side position validation and anti-cheat (speed limits, bounds)
     - Client sends inputs, server validates and broadcasts authoritative results
  5. **WebSocket Connection Lifecycle**
     - Secure WebSocket connections with proper upgrade handling
     - Connection heartbeats and automatic reconnection logic
     - Graceful disconnect handling with session cleanup
  6. **Core Multiplayer Events**
     - `player_join`: When player connects and is ready
     - `player_update`: Position/state changes (with validation)
     - `player_leave`: Clean disconnection
     - `world_state`: Full state on connect, delta updates afterward
  7. **Client-Side Prediction & Reconciliation**
     - Client predicts movement locally for responsiveness
     - Server sends authoritative position corrections
     - Client reconciles differences smoothly
  8. **Interest Management**
     - Only sync players within visible range (Area of Interest)
     - Efficient message broadcasting to relevant players only
     - Handle player entering/leaving interest zones
  9. **Testing & Validation**
     - Multi-browser real-time synchronization tests
     - Network failure recovery testing
     - Position validation and anti-cheat verification
     - Performance profiling under load
- **Estimated Time**: 4-5 weeks (increased due to visual synchronization task)
- **Current Focus**: Task 3 - Multiplayer Visual Synchronization

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

## MVP 13: Predators
- **Objective**: Add challenge with predator NPCs.
- **Tasks**:
  - Create hawk and wolf predator models.
  - Implement predator AI for patrolling and chasing players.
  - Add evasion mechanics (e.g., hiding in bushes).
- **Estimated Time**: 3-4 weeks

---

## MVP 14: Power-Ups
- **Objective**: Enhance gameplay with power-ups.
- **Tasks**:
  - Implement **Scent Sniff** power-up to reveal nearby walnuts.
  - Implement **Fast Dig** power-up for quicker hiding or finding.
  - Add power-up spawning and usage mechanics.
- **Estimated Time**: 2-3 weeks

---

## MVP 15: Dynamic Events
- **Objective**: Increase engagement with dynamic events.
- **Tasks**:
  - Implement **Nut Rush** event with extra walnuts and bonus points.
  - Schedule random event triggers (e.g., every few hours).
  - Notify players of active events.
  - Adjust lighting dynamically for events or time of day.
- **Estimated Time**: 2-3 weeks

---

## MVP 16: Social Interactions
- **Objective**: Enable player social features.
- **Tasks**:
  - Add pre-set messages (e.g., "Nice hide!" or "Found you!").
  - Implement notifications for walnut finds.
  - Add a basic friend system or player tagging.
- **Estimated Time**: 2-3 weeks

---

## MVP 17: Enhanced Authentication
- **Objective**: Implement robust authentication for improved security and user management.
- **Tasks**:
  - Integrate Cloudflare Access or OAuth for secure player authentication.
  - Implement user account management (e.g., registration, login, session handling).
  - Ensure secure handling of player data and prevent unauthorized access.
  - Update backend architecture to support authenticated sessions.
- **Estimated Time**: 3-4 weeks

---

## Summary of Changes
- **MVP 13: Predators** follows **MVP 12: Performance Optimizations** to prioritize performance before adding complex NPC mechanics.
- **MVP 14: Power-Ups** is scheduled after Predators to enhance gameplay mechanics.
- **MVP 15 to MVP 17** remain in sequence, culminating with **Enhanced Authentication** for a secure user experience.
- **Current Focus**: Completing Task 3 of MVP 7, ensuring robust WebSocket communication, multiplayer visibility, and proper rendering of game assets.

This plan ensures the game builds a solid foundation, delivering a visually appealing and performant experience before introducing advanced features like predators, power-ups, and social interactions.