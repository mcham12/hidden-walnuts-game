# Hidden Walnuts - Complete Game Mechanics Documentation

## Executive Summary

Hidden Walnuts is a real-time 3D multiplayer game where players control squirrels hunting for walnuts in a shared forest ecosystem. Players compete to find hidden walnuts, hide their own for bonus points, engage in combat with projectiles, defend against AI predators, and progress through 7 player ranks. The game combines exploration, resource management, and social multiplayer features within daily 24-hour cycles.

---

## 1. CORE GAMEPLAY LOOP

**Primary Objectives:**
1. Find walnuts scattered throughout forest (3 pts for buried game walnuts, 1 pt for bush)
2. Hide walnuts strategically (earn 1 pt if unfound at cycle end, 20 pts if grows into tree)
3. Compete in real-time combat using walnut projectiles
4. Survive predator encounters (wildebeest, cardinal, toucan)
5. Accumulate score to rank up through 7 player titles

**Game Cycles:**
- Daily: 24 hours (resets 8:00 AM UTC)
- Weekly: 7 days (leaderboard resets Sunday 8:05 AM UTC)
- Session: Indefinite within cycle, with position persistence on reconnect

**Player Progression - Titles:**
- Rookie (0-20 pts): Learning phase, no NPC/predator threat
- Apprentice (21-100 pts): Safe zone continues
- Dabbler (101-200 pts): First predator targeting begins
- Slick (201-300 pts): NPCs become aggressive
- Maestro (301-500 pts): Moderate difficulty increase
- Ninja (501-1000 pts): High difficulty, skilled players
- Legend (1001+ pts): Extreme difficulty, ultimate challenge

---

## 2. WALNUT MECHANICS

**Walnut Types:**

Game Walnuts (spawn: "g-" prefix)
- System-generated, respawn after pickup
- Buried: 3 points
- In bush: 1 point
- Higher strategic value

Player Walnuts (spawn: "p-" prefix)
- Hidden by players, remain until found
- Buried: 2 points
- In bush: 1 point
- Can grow into trees after 60+ seconds
- Owner earns 1 bonus point if unfound at cycle end

**Walnut Spawning:**
- Tree drops: Random tree drops 5 walnuts every 30-120 seconds
- Growth triggers: After 60 seconds, player-hidden walnuts become visual trees
- Inventory pickup: Walnuts collected up to 10-unit maximum
- Dropped from combat: When projectiles hit ground, create pickupable walnut

**Collection Mechanics:**
- Pickup radius: 1-2 units from character
- Maximum inventory: 10 walnuts
- Consumption: Eat 1 walnut to restore 10 HP
- Projectile drops: Thrown walnuts pickupable 1.5 seconds after impact

**Tree Growing System:**
- Growth condition: Unfound player walnut exists 60+ seconds
- Growth reward: 20 points to hider
- Walnut drop: Tree drops 5 new walnuts
- Milestone bonus: Extra 20 points at 20/40/60 trees grown
- Visibility: Grown trees appear as visual forest objects

---

## 3. HEALTH & SURVIVAL

**Health System:**
- Starting: 100 HP
- Max: 100 HP
- Display: Visible health bars for all characters (players, NPCs, predators)

**Damage Sources:**
- Walnut projectile hit: 10 HP damage
- Predator/Wildebeest bite: 30 HP damage
- Collision: Minimal damage (knockback only)

**Healing:**
- Eating walnut: +10 HP (1 walnut from inventory)
- Respawn: Automatic 100 HP reset
- No natural regeneration: Must consume walnuts

**Death Mechanics:**
- Trigger: Health <= 0 HP
- Respawn location: Forest center (0, 2, 0)
- Respawn invulnerability: 2-second grace period
- Walnut drop: Inventory drops at death location for others to collect
- Score impact: No score penalty for death
- Knockout credit: Last attacker receives 5-10 bonus points

---

## 4. PREDATOR SYSTEM

**Three Predator Types:**

Aerial Predators (Cardinal, Toucan):
- Speed: 6.5 units/sec
- Attack: Dives at players, steals 1-2 walnuts
- Cooldown: 45 seconds between attacks
- Cruise height: 2.5 units (vulnerable to throws)
- Behavior: Patrol, detect targets within 30 units, flee when damaged

Ground Predators (Wildebeest):
- Speed: 5.5 units/sec (faster than player 5.0)
- Attack: Charging bite, 30 HP damage per hit
- Cooldown: 8 seconds between attacks
- Defense: "Annoyance" system - 4 hits drives away (no health)
- Behavior: Patrol, charge at detected targets

**Targeting Rules:**
- Rookie/Apprentice: Completely ignored
- Dabbler+: Begin targeting with escalating preference:
  - Dabbler: 40% weight
  - Slick: 70% weight
  - Maestro: 90% weight
  - Ninja: 110% weight
  - Legend: 130% weight

**Predator Behaviors:**
- Idle: Stationary resting
- Patrol: Random walking in territory
- Targeting: Moving toward detected player/NPC
- Attacking: Active combat (dive/bite)
- Distracted: Pursuing dropped walnut
- Fleeing: Driven away (4 hits)
- Returning: Back to patrol

**Spawning Rules:**
- Maximum: 2 active predators
- Spawn chance: 40% per 15-second check
- Spawn interval: Minimum 90 seconds between spawns
- Lifetime: 5 minutes (auto-despawn if too old)
- Flee condition: Despawn when >100 units from center

**Defense Mechanics:**
- Projectile hits: Damage/annoy predators
- Distraction: Drop walnut distracts aerial predators temporarily
- NPC help: AI companions also attack predators
- Avoidance: Predators have limited vision (30-unit radius)

---

## 5. SCORING & LEADERBOARDS

**Point Awards:**

Finding Walnuts:
- Game walnut buried: 3 points
- Game walnut bush: 1 point
- Player walnut buried: 2 points
- Player walnut bush: 1 point

Achievements:
- First finder (first 10 finds): 3 bonus points
- Tree growth: 20 points
- Tree milestones: 20 bonus at 20/40 trees

Hidden Walnut Bonus:
- Per unfound walnut at cycle end: 1 point
- Encourages hiding strategy

**Score Multiplier System:**
- Base: 1.0x
- Max: 2.0x
- Increment: Every 5 minutes of active play
- Max time: ~50 minutes to reach 2.0x
- Application: Multiplier applies to all points earned
- Reset: Daily with cycle

**Leaderboard Types:**

Daily:
- Current cycle scores
- All players included
- Ranks reset with daily cycle

Weekly:
- Current week scores (reset Sunday 8:05 AM UTC)
- Top 10 restricted to authenticated players only
- All players can participate, top spots for authenticated
- Shows total players on leaderboard

All-Time:
- Lifetime hall of fame
- Authenticated players only
- Never resets
- Global lifetime rankings

**Anti-Cheat Rules:**
- Max score increase: 100 points per minute
- Absolute max: 100,000 points sanity check
- Rate limiting: Detects impossible gains
- Archive system: Weekly snapshots for verification

---

## 6. CHARACTER SYSTEM

**Available Characters:**

Guest Mode (No Account):
- Squirrel (only option)

Free Authentication:
- Squirrel (default)
- Hare
- Goat
- Chipmunk
- Turkey
- Mallard
(Total: 6 free characters)

Premium Characters ($1.99 each):
- Lynx
- Bear
- Moose
- Badger
(Total: 4 premium, ~$7.96 for all)

**Character Features:**
- Movement: All characters move at 5.0 units/sec
- Animations: Unique walk, idle, attack animations
- Emotes: Character-specific emote expressions
- Models: Different visual appearance, same gameplay
- Persistence: Last selected character remembered

**NPC Characters:**
- 11 different character types (random selection)
- Named "NPC - [Character Name]"
- Aggression scales with player rank
- Combat behavior: Gather and throw walnuts

---

## 7. MULTIPLAYER & SOCIAL FEATURES

**Real-Time Synchronization:**

Position Updates:
- Frequency: 20 updates per second
- Content: X, Y, Z coordinates + rotation
- Interpolation: 150ms delay for smooth rendering
- Extrapolation: Velocity-based prediction between updates

Chat System:
- Message broadcast to all players
- Rate limit: 5 messages per 10 seconds
- No profanity filter mentioned
- Username included with message

Emote System:
- Character animation broadcast
- Rate limit: 5 per 10 seconds (shared with chat)
- Examples: wave, dance, taunt
- Visible to all players

**Network Events Broadcast:**
- Walnut hidden: Player notification
- Walnut found: Owner notified
- Combat hit: All nearby players see hit
- Death/respawn: Global broadcast
- Predator spawn/despawn: Server notifies all
- Health updates: Real-time HP changes
- Inventory updates: Walnut count changes

**Remote Rendering:**
- Health bars: Visual above all entities
- Name labels: Username above each player
- Animation blending: Smooth transitions
- Collision: Character collision radius 0.3 units
- Physics: Knockback on collision (minimal damage)

**Server Authority:**
- All position updates validated server-side
- Speed checks: Flag impossible speeds
- Range validation: Projectiles max 15 units
- Teleport detection: Reject jumps >10 units
- Anti-cheat: Acceleration limits 20 units/sec²

---

## 8. SESSION MANAGEMENT

**Guest Sessions (No Authentication):**
- Session ID: Unique squirrel-{timestamp}-{random} identifier
- Storage: Cloudflare Durable Object per session
- Character: Squirrel only
- Scope: Single browser/device
- Persistence: Position/score saved, restored on reconnect
- Duration: Until browser data cleared
- Upgrade: Can link to email authentication

**Authenticated Sessions:**
- Multiple sessions: Different devices/browsers simultaneously
- Session token: Per-connection identifier
- JWT tokens: Access + refresh token pair
- Token storage: Secure HTTP-only cookies (optional)
- Device tracking: Optional device info stored
- Cross-device: Username recognizes all linked sessions
- Session revocation: Logout from device or all devices

**State Persistence:**

Saved on Disconnect:
- Position (x, y, z)
- Rotation (rotationY facing direction)
- Score (total points)
- Inventory (walnut count 0-10)
- Health (HP 0-100)
- Player title/rank
- Walnuts hidden (IDs)
- Walnuts found (IDs)

Reconnection:
- Immediate state restoration
- No position reset
- No score loss
- Continues where left off
- Window: Indefinite (stored in Durable Object)

**Bot Protection:**
- Cloudflare Turnstile required for all connections
- Testing token: XXXX.* tokens accepted in dev/preview
- Verification: Server validates with Cloudflare API
- Failure: Denies connection without valid token
- Rate limiting: 5 connections per 5 minutes per IP

---

## 9. ADVANCED GAME SYSTEMS

**Participation Multiplier:**
- Tracks active play time
- Increments: Every 5 minutes
- Range: 1.0x to 2.0x
- Time to max: ~50 minutes
- Application: Multiplies all points earned
- Reset: Daily with cycle

**Tree Growing Bonus:**
- Milestone: 20, 40, 60 trees grown
- Bonus: 20 points per milestone
- Display: "Tree Growing Bonus!" overlay
- Reset: Daily

**First Finder Achievement:**
- Requirement: First player to find 10 walnuts
- Points: 3 bonus (one-time per cycle)
- Tracking: Per-player per-cycle

**Rank-Up Notifications:**
- Trigger: Score crosses title threshold
- Display: Modal overlay with title details
- NPC reaction: Aggression increases
- Predator reaction: Targeting begins/increases

**NPC System:**
- Spawn count: ~2 NPCs based on player population
- AI behaviors: Idle, wander, gather, throw, eat, rest
- Combat: Attack other NPCs and aggressive players
- Aggression scaling: Based on player rank
- Death: Despawn and respawn after 30 seconds
- HP: 100 same as players

---

## 10. TECHNICAL ARCHITECTURE

**Network Protocol:**
- WebSocket: Binary JSON messages
- Update rates:
  - Player position: 20/sec (50ms)
  - NPC position: 5/sec (200ms, cost-optimized)
  - Predator position: 10/sec (100ms)
  - Chat/Emotes: Immediate
  - Health/inventory: Event-based

**Rate Limiting:**
- Position updates: 20 per second per player
- Chat messages: 5 per 10 seconds
- Walnut hide: 10 per minute
- Walnut find: 20 per minute
- Emotes: 5 per 10 seconds (shared with chat)

**Anti-Cheat Architecture:**
- Server-authoritative: All state changes validated
- Speed validation: Movement must match physics
- Position verification: Distance/time checks
- Score verification: Rate limits impossible gains
- Admin metrics: Dashboard tracks suspicious activity

**Durable Objects (Cloudflare Workers):**
- ForestManager: Central game state, WebSocket hub, physics
- SquirrelSession: Per-player session/position storage
- WalnutRegistry: Walnut state tracking
- Leaderboard: Score rankings and archival
- PlayerIdentity: Authentication and accounts
- NPCManager: AI behavior controller
- PredatorManager: Predator spawning/targeting

---

## 11. GAMEPLAY CONSTRAINTS

**Movement:**
- Max speed: 5.0 units/sec
- Acceleration: 20 units/sec²
- Deceleration: 15 units/sec²
- World bounds: ±100 units (X, Z)
- Height bounds: -5 to 50 units (Y)
- Soft boundary: Push-back zone 10 units from edge

**Inventory:**
- Maximum: 10 walnuts
- Pickup radius: 1-2 units
- Drop on death: All walnuts drop at death location

**Combat:**
- Projectile range: 15 units max
- Damage per hit: 10 HP
- Throw cooldown: Varies by entity
- Predator attacks: 30-45 second cooldowns
- Invulnerability: 2 seconds post-respawn

**Spawning:**
- Players: (0, 2, 0) forest center
- NPCs: Near active players
- Predators: World edges
- Walnuts: Throughout forest volume

**Timing:**
- Cycle: 24 hours
- Leaderboard reset: Weekly Sunday 8:05 AM UTC
- Walnut growth: 60+ seconds
- Predator despawn: 5 minutes max lifetime
- Position save: When player moves >0.5 units

---

## 12. MONETIZATION MODEL

**Free-to-Play Base:**
- Full gameplay available without payment
- Single free character (squirrel)
- Squirrel sufficient for all gameplay

**Optional Cosmetics:**
- 4 premium characters: $1.99 each
- No gameplay advantage (cosmetic only)
- No pay-to-win mechanics
- No aggressive monetization

**Account Types:**
- Guest: Free, single device
- Free auth: Free, 6 characters, cross-device
- Premium: $1.99-$7.96 for 4 additional characters

---

## 13. SUMMARY

Hidden Walnuts combines:
- **Gameplay**: Hunt/hide walnuts, combat, survival
- **Progression**: 7 ranks with scaling difficulty
- **Multiplayer**: Real-time synchronization, chat, emotes
- **AI**: NPC companions and predator threats
- **Social**: Leaderboards, rankings, achievements
- **Anti-Cheat**: Server-authoritative physics validation
- **Monetization**: Optional cosmetic-only purchases

The game rewards consistent play through multipliers and daily cycles, creating a balanced arcade-style experience suitable for casual and competitive players.

