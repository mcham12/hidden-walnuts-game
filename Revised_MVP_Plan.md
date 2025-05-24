# Revised MVP Plan for Hidden Walnuts

## Introduction
This plan outlines the MVP stages for *Hidden Walnuts*, starting from MVP 4.5 (in progress) and extending through whole-numbered MVPs to achieve the full game vision. Each MVP focuses on a specific feature, progressing from the current basic 3D scene to a fully functional multiplayer walnut-hiding experience with daily resets, power-ups, predators, events, and social interactions.

## Game Vision Recap
- **Core Concept**: Players hide and seek walnuts in a 3D forest, earning points for finds and hides.
- **World**: A persistent forest map with trees, shrubs, and terrain, resetting every 24 hours.
- **Multiplayer**: Real-time gameplay with synchronized walnut and player positions.
- **Features**: Avatars, scoring, leaderboards, power-ups, predators, events, and social interactions.

## Current State (MVP 4.5 in Progress)
- A green "ground" with a walnut model (not hidden).
- No player avatar, trees, shrubs, or game mechanics.
- **MVP 4.5 Focus**: Deploying to Cloudflare and fixing the walnut location persistence bug.

## MVP Stages
1. **MVP 4.5: Deployment and Bug Fixing** (in progress)
2. **MVP 5: Basic Forest Environment**
3. **MVP 6: Player Avatar and Movement**
4. **MVP 7: Walnut Hiding Mechanics**
5. **MVP 8: Multiplayer Synchronization**
6. **MVP 9: Walnut Seeking and Scoring**
7. **MVP 10: Daily Map Reset**
8. **MVP 11: Power-Ups**
9. **MVP 12: Predators**
10. **MVP 13: Dynamic Events**
11. **MVP 14: Social Interactions**

## Task Breakdown and Timeline

### MVP 4.5: Deployment and Bug Fixing (In Progress)
- **Tasks**:
  - Deploy the game to Cloudflare (Workers for backend, Pages for frontend).
  - Fix the walnut location persistence bug:
    - Store walnut positions in the backend (e.g., Cloudflare Durable Objects).
    - Ensure positions persist across browser refreshes.
- **Estimated Time**: 1-2 weeks
- **Outcome**: Game live on Cloudflare with persistent walnut positions.

### MVP 5: Basic Forest Environment
- **Tasks**:
  - Add simple terrain (e.g., hills, flat areas).
  - Place trees and shrubs to form a basic forest.
  - Ensure the environment is navigable.
- **Estimated Time**: 1-2 weeks
- **Outcome**: A 3D forest environment with trees and shrubs.

### MVP 6: Player Avatar and Movement
- **Tasks**:
  - Create a squirrel avatar model.
  - Implement WASD movement for the avatar.
  - Add a third-person camera following the player.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can control a squirrel avatar in the forest.

### MVP 7: Walnut Hiding Mechanics
- **Tasks**:
  - Allow players to pick up and hide walnuts (e.g., bury or place in bushes).
  - Add visual indicators for hidden walnuts.
  - Store walnut positions persistently in the backend.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can hide walnuts with persistent locations.

### MVP 8: Multiplayer Synchronization
- **Tasks**:
  - Set up WebSocket for real-time communication.
  - Synchronize walnut positions across all players.
  - Synchronize player avatar positions and actions.
- **Estimated Time**: 3-4 weeks
- **Outcome**: Real-time multiplayer with synced walnuts and players.

### MVP 9: Walnut Seeking and Scoring
- **Tasks**:
  - Enable finding and collecting hidden walnuts.
  - Add a points system for walnut finds and hides.
  - Display a real-time leaderboard.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can seek walnuts, earn points, and view rankings.

### MVP 10: Daily Map Reset
- **Tasks**:
  - Implement a 24-hour map reset cycle.
  - Seed 100 game-hidden walnuts at reset.
  - Reset player scores and walnut positions.
- **Estimated Time**: 1-2 weeks
- **Outcome**: A persistent world with daily refreshes.

### MVP 11: Power-Ups
- **Tasks**:
  - Add **Scent Sniff** power-up to reveal nearby walnuts.
  - Add **Fast Dig** power-up to speed up hiding or finding walnuts.
  - Implement power-up spawning and usage mechanics.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can use power-ups to enhance gameplay.

### MVP 12: Predators
- **Tasks**:
  - Introduce hawk and wolf predator models.
  - Add predator AI to patrol the forest and chase players.
  - Implement player evasion mechanics (e.g., hiding in bushes).
- **Estimated Time**: 3-4 weeks
- **Outcome**: Predators add challenge and risk to the game.

### MVP 13: Dynamic Events
- **Tasks**:
  - Add **Nut Rush** event with extra walnuts and bonus points.
  - Schedule random event triggers (e.g., every few hours).
  - Notify players of active events.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Dynamic events increase engagement and variety.

### MVP 14: Social Interactions
- **Tasks**:
  - Enable pre-set messages (e.g., "Nice hide!" or "Found you!").
  - Add notifications for when a player’s walnut is found.
  - Implement basic friend system or player tagging.
- **Estimated Time**: 2-3 weeks
- **Outcome**: Players can interact socially, enhancing multiplayer experience.

## Risks and Mitigations
- **Risk**: Multiplayer sync issues (e.g., latency).  
  - **Mitigation**: Test WebSocket early and optimize updates.
- **Risk**: Over-scoping the forest or predator AI.  
  - **Mitigation**: Start with simple implementations and iterate.
- **Risk**: Resource constraints.  
  - **Mitigation**: Focus on one MVP at a time.

## Next Steps
- Complete MVP 4.5 (deployment and bug fix).
- Start MVP 5 (forest environment).