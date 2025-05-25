# Revised MVP Plan for Hidden Walnuts

This document outlines the revised MVP stages for *Hidden Walnuts*, integrating performance optimizations, visual enhancements, and code refinements into the existing plan. The optimizations are folded into the MVP stages to improve gameplay, visuals, and maintainability without creating separate phases.

---

## Game Vision Recap
- **Core Concept**: Players hide and seek walnuts in a 3D forest, earning points for finds and hides.
- **World**: A persistent forest map with trees, shrubs, and terrain, resetting every 24 hours.
- **Multiplayer**: Real-time gameplay with synchronized walnut and player positions.
- **Features**: Avatars, scoring, leaderboards, power-ups, predators, events, and social interactions.

---

## Current State (MVP 4.5 in Progress)
- A green "ground" with a walnut model (not hidden).
- No player avatar, trees, shrubs, or game mechanics.
- **MVP 4.5 Focus**: Deploying to Cloudflare and fixing the walnut location persistence bug.

---

## MVP Stages with Integrated Optimizations

### MVP 4.5: Deployment and Bug Fixing (Complete)
- **Tasks**:
  - Deploy the game to Cloudflare (Workers for backend, Pages for frontend).
  - Fix the walnut location persistence bug:
    - Store walnut positions in the backend (e.g., Cloudflare Durable Objects).
    - Ensure positions persist across browser refreshes.
- **Estimated Time**: 1-2 weeks
- **Outcome**: Game live on Cloudflare with persistent walnut positions.

---

### MVP 5: Basic Forest Environment (complete)
- **Tasks**:
  - Create navigable terrain with hills and flat areas.
    - **Optimization**: Cache terrain height calculations (e.g., 2D grid) for performance.
    - **Enhancement**: Use Perlin or Simplex noise for natural height variations.
    - **Enhancement**: Apply grass textures (diffuse, normal, roughness maps) for visual appeal.
  - Place trees and shrubs to form a basic forest.
- **Estimated Time**: 2-3 weeks (increased from 1-2 weeks due to enhancements)
- **Outcome**: A visually rich 3D forest environment with optimized terrain.

---

### MVP 6: Player Avatar and Movement
- **Tasks**:
  - Create a squirrel avatar model.
  - Implement WASD movement for the avatar.
  - Add a third-person camera following the player.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can control a squirrel avatar in the forest.
- **Note**: Camera fix (W and S key reversal) handled by Cursor AI separately.

---

### MVP 7: Walnut Hiding Mechanics
- **Tasks**:
  - Enable walnut pickup and hiding with visual indicators.
  - Store walnut positions persistently in the backend.
  - **Optimization**: Update only changed walnuts in rendering for efficiency.
  - **Enhancement**: Implement level of detail (LOD) for walnuts (simpler models for distant walnuts).
- **Estimated Time**: 3-4 weeks (increased from 2-3 weeks due to enhancements)
- **Outcome**: Players can hide walnuts with optimized rendering and detailed visuals.

---

### MVP 8: Multiplayer Synchronization
- **Tasks**:
  - Set up WebSocket for real-time communication.
  - Synchronize walnut positions across all players.
  - Synchronize player avatar positions and actions.
  - **Optimization**: Streamline WebSocket handlers (update only affected data) for performance.
- **Estimated Time**: 3-4 weeks
- **Outcome**: Real-time multiplayer with efficient synchronization.

---

### MVP 9: Walnut Seeking and Scoring
- **Tasks**:
  - Enable finding and collecting hidden walnuts.
  - Add a points system for walnut finds and hides.
  - Display a real-time leaderboard.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can seek walnuts, earn points, and view rankings.

---

### MVP 10: Daily Map Reset
- **Tasks**:
  - Implement a 24-hour map reset cycle.
  - Seed 100 game-hidden walnuts at reset.
  - Reset player scores and walnut positions.
- **Estimated Time**: 1-2 weeks
- **Outcome**: A persistent world with daily refreshes.

---

### MVP 11: Power-Ups
- **Tasks**:
  - Add **Scent Sniff** power-up to reveal nearby walnuts.
  - Add **Fast Dig** power-up to speed up hiding or finding walnuts.
  - Implement power-up spawning and usage mechanics.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can use power-ups to enhance gameplay.

---

### MVP 12: Predators
- **Tasks**:
  - Introduce hawk and wolf predator models.
  - Add predator AI to patrol the forest and chase players.
  - Implement player evasion mechanics (e.g., hiding in bushes).
- **Estimated Time**: 3-4 weeks
- **Outcome**: Predators add challenge and risk to the game.

---

### MVP 13: Dynamic Events
- **Tasks**:
  - Add **Nut Rush** event with extra walnuts and bonus points.
  - Schedule random event triggers (e.g., every few hours).
  - Notify players of active events.
  - **Enhancement**: Adjust lighting dynamically (e.g., based on event or time of day) for immersion.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Dynamic events increase engagement with enhanced visuals.

---

### MVP 14: Social Interactions
- **Tasks**:
  - Enable pre-set messages (e.g., "Nice hide!" or "Found you!").
  - Add notifications for when a player’s walnut is found.
  - Implement basic friend system or player tagging.
  - **Optimization**: Add a DEBUG flag to manage logs in production for code quality.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can interact socially with cleaner, maintainable code.

---

## Risks and Mitigations
- **Risk**: Multiplayer sync issues (e.g., latency).  
  - **Mitigation**: Test WebSocket early and optimize with streamlined handlers.
- **Risk**: Over-scoping the forest or predator AI.  
  - **Mitigation**: Start with simple implementations and iterate; leverage noise functions and LOD for efficiency.
- **Risk**: Resource constraints with added optimizations.  
  - **Mitigation**: Integrate optimizations into existing tasks to minimize delays; prioritize high-impact enhancements.

---

## Timeline Impact
The integration of optimizations increases the estimated time for some MVPs (e.g., MVP 5 from 1-2 to 2-3 weeks, MVP 7 from 2-3 to 3-4 weeks) due to the additional tasks. However, implementing these enhancements early improves performance and visuals incrementally, reducing the need for later rework and keeping the overall development on track.

---