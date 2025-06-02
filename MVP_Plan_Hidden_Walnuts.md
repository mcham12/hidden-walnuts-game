# Revised MVP Plan for Hidden Walnuts

This plan reorders **Predators** to follow **Performance Optimizations**, ensuring the game is visually polished and performs efficiently before adding predator mechanics. The sequence maintains logical progression while addressing your priorities.

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

---

## MVP 7: Multiplayer Foundation
- **Objective**: Establish a secure, scalable multiplayer system.
- **Tasks**:
  - Implement secure WebSocket connections (`wss://`) for real-time communication.
  - Define WebSocket events (`player-join`, `player-move`, `player-leave`).
  - Use Durable Objects to manage player states and session data.
  - Render multiple player avatars on the client-side based on WebSocket updates.
  - Implement basic token-based authentication for player validation.
  - Add error handling for network issues and logging for diagnostics.
  - Test with multiple browser windows to confirm real-time avatar synchronization.
- **Estimated Time**: 3-4 weeks

---

## MVP 8: Walnut Hiding Mechanics
- **Objective**: Enable players to hide walnuts in the forest environment.
- **Tasks**:
  - Implement walnut pickup and hiding with visual indicators (e.g., buried or in bushes).
  - Store walnut positions persistently using Durable Objects.
  - Optimize walnut rendering by updating only changed positions.
- **Estimated Time**: 3-4 weeks

---

## MVP 9: Walnut Seeking and Scoring
- **Objective**: Allow players to find walnuts and track scores.
- **Tasks**:
  - Enable finding and collecting hidden walnuts.
  - Implement a points system for walnut finds and hides.
  - Display a real-time leaderboard synchronized via Durable Objects.
- **Estimated Time**: 2-3 weeks

---

## MVP 10: Daily Map Reset
- **Objective**: Introduce a 24-hour map reset cycle.
- **Tasks**:
  - Implement map reset logic to refresh the forest every 24 hours.
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
- **MVP 13: Predators** now follows **MVP 12: Performance Optimizations**, ensuring the game is optimized before introducing predator mechanics.
- **MVP 14: Power-Ups** has been shifted to follow **Predators**.
- **MVP 15 to MVP 17** remain in sequence, with **Enhanced Authentication** as the final MVP.

This updated plan ensures the game is visually appealing, performs efficiently, and has a solid foundation before adding advanced features. Let me know if you'd like further adjustments!