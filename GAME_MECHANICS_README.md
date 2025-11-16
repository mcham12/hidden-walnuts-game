# Game Mechanics Documentation Files

This directory contains comprehensive documentation of the Hidden Walnuts game mechanics and rules.

## Files Created

### 1. GAME_MECHANICS.md (Primary Reference)
**Length**: ~3,500 words  
**Purpose**: Complete, detailed game mechanics documentation suitable for:
- Developer onboarding
- Game design reference
- Feature specification
- Player documentation
- Game design document (GDD)

**Contents**:
- Executive summary
- 13 major sections covering all game systems
- Detailed explanations of every mechanic
- Technical architecture overview
- Constraints and limits
- Monetization model

**Best For**: 
- Full understanding of how the game works
- Reference when implementing features
- Teaching new team members
- Player guides and wiki

---

### 2. GAME_MECHANICS_QUICK_REFERENCE.md (Quick Lookup)
**Length**: ~600 words  
**Purpose**: Fast reference for specific values and rules

**Contents**:
- Point value tables
- Walnut mechanics quick stats
- Title difficulty chart
- Predator stats summary
- Chat/emote rate limits
- Multiplayer sync rates
- Game cycle timing
- Character availability
- Physics constraints
- Anti-cheat rules
- Session type comparison

**Best For**:
- Quick lookups during gameplay
- Checking specific values
- Testing reference
- Admin tools documentation
- Player FAQ

---

## Key Systems Documented

### 1. Core Gameplay Loop
- Primary objectives (find, hide, combat, survive, rank up)
- Game cycles (24h daily, 7d weekly, indefinite session)
- 7 player titles with progressive difficulty

### 2. Walnut Mechanics
- Game walnuts vs player-hidden walnuts
- Point values (1-3 points based on type/difficulty)
- Spawning rules (trees drop every 30-120 sec)
- Tree growth system (60+ second timer)
- Collection and inventory (max 10)

### 3. Health & Survival
- 100 HP system
- Damage sources (projectiles 10 HP, wildebeest 30 HP)
- Healing via eating walnuts (10 HP per walnut)
- Death and respawn mechanics
- No starvation - health only from combat

### 4. Predator System
- Three types: Wildebeest (ground), Cardinal/Toucan (aerial)
- Rank-based targeting (ignore Rookie/Apprentice)
- Behaviors (idle, patrol, targeting, attacking, fleeing)
- Spawn rules (max 2, 40% chance per 15 sec, 90 sec min interval)
- Defense mechanics (throw walnuts, distraction)

### 5. Scoring & Leaderboards
- Point awards table (1-20 points per action)
- Participation multiplier (1.0x to 2.0x, +0.1x per 5 min)
- Three leaderboard types (daily, weekly, all-time)
- Anti-cheat: max 100 pts/min, 100k absolute max
- Archive system for weekly snapshots

### 6. Character System
- Guest: 1 (squirrel)
- Free auth: 6 (squirrel, hare, goat, chipmunk, turkey, mallard)
- Premium: 4 at $1.99 each (lynx, bear, moose, badger)
- All characters: identical stats, different visuals
- NPC characters: 11 types, scaled aggression

### 7. Multiplayer Features
- Real-time chat (5 msg/10 sec rate limit)
- Emotes (5/10 sec, shared rate limit)
- Position sync (20 updates/sec for players, 5 for NPCs)
- Health/inventory broadcasts
- Remote player rendering with 150ms interpolation
- Server-authoritative anti-cheat validation

### 8. Session Management
- Guest mode: Browser-stored session, squirrel only
- Authenticated: Email/password, multiple devices, JWT tokens
- Position persistence: Saved on all disconnects
- Reconnection: Immediate state restoration, indefinite window
- Bot protection: Cloudflare Turnstile required

### 9. Advanced Systems
- Participation multiplier (tracks active time)
- Tree growing bonus (20 pts at 20/40 trees)
- First finder achievement (3 pts for first 10 finds)
- Rank-up notifications (title progression)
- NPC companions (~2 spawned, respawn every 30 sec)

### 10. Technical Architecture
- WebSocket for real-time communication
- Durable Objects: ForestManager, SquirrelSession, WalnutRegistry, Leaderboard, PlayerIdentity, NPCManager, PredatorManager
- Rate limiting per action type
- Server-authoritative physics validation
- Admin dashboard for metrics

### 11. Gameplay Constraints
- Movement: max 5.0 units/sec, 20 units/sec² acceleration
- World bounds: ±100 (X,Z), -5 to 50 (Y)
- Inventory: max 10 walnuts
- Combat: projectile 15 unit max range, 10 HP damage
- Predator despawn: 5 minute lifetime

### 12. Monetization
- Free-to-play base game
- Optional $1.99 premium characters (cosmetic only)
- No pay-to-win mechanics
- Total max cost: $7.96 for all premium

---

## How to Use These Documents

### For Game Design
1. Read GAME_MECHANICS.md sections 1-6 for core mechanics
2. Reference GAME_MECHANICS_QUICK_REFERENCE.md for exact values
3. Consult Technical Architecture (section 10) for implementation

### For Player Guides
1. Use sections 1-2 (loop, walnuts) for beginners
2. Use sections 3-4 (health, predators) for intermediate
3. Reference section 6 (progression) for advanced strategies

### For Testing
1. Use Quick Reference for all test values
2. Check section 11 (constraints) for boundary testing
3. Review section 10 (anti-cheat) for validation testing

### For Feature Implementation
1. Find relevant section in GAME_MECHANICS.md
2. Check Quick Reference for exact constants
3. Review Technical Architecture for system integration

---

## Source Code References

### Client Code
- `/client/src/Game.ts` - Main game loop and rendering
- `/client/src/services/WebSocketService.ts` - Network communication
- `/client/src/services/CharacterRegistry.ts` - Character availability

### Server Code
- `/workers/api.ts` - API entry point
- `/workers/objects/ForestManager.ts` - Game state and physics
- `/workers/objects/NPCManager.ts` - AI behavior
- `/workers/objects/PredatorManager.ts` - Predator logic
- `/workers/objects/Leaderboard.ts` - Score tracking
- `/workers/objects/PlayerIdentity.ts` - Authentication
- `/workers/objects/SquirrelSession.ts` - Player sessions
- `/workers/objects/WalnutRegistry.ts` - Walnut tracking
- `/workers/constants.ts` - Game constants
- `/workers/shared/PlayerRanks.ts` - Title system

---

## Key Insights

1. **Skill-Based Progression**: 7 titles create natural difficulty scaling
2. **Beginner Protection**: Rookies/Apprentices safe from threats
3. **Resource Management**: Walnuts serve dual purpose (points + health)
4. **Emergent Gameplay**: Hidden walnuts grow into trees creating ecosystem
5. **Social Integration**: Chat, emotes, shared environment
6. **Anti-Cheat**: Server authority + rate limiting prevents cheating
7. **Daily/Weekly Cycles**: Fresh leaderboards encourage regular play
8. **Cosmetic-Only Monetization**: Fair pricing, no pay-to-win
9. **Cross-Device Support**: Authenticated accounts work everywhere
10. **Position Persistence**: Reconnect anytime without losing progress

---

## Contact & Questions

For questions about specific mechanics, refer to the detailed sections in GAME_MECHANICS.md or check the source code references for implementation details.
