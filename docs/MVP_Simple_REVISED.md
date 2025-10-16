# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: MVP 6 (Player Authentication & Identity) - ✅ **COMPLETE**

---

## ✅ Completed Work

- **MVP 1.5**: Animated Character System - 3D terrain, multiple characters, WASD movement, animations
- **MVP 1.9**: Backend Simplification - Cloudflare Workers, Durable Objects, WebSocket connections
- **MVP 2.0**: Multiplayer Foundation - Real-time sync, player visibility, name tags, connection handling
- **MVP 3**: Core Walnut Mechanics - Hide/find system, scoring, landmarks, minimap, server sync
- **MVP 3.5**: Multiple Character Selection - 11 characters, 3D preview, dynamic loading
- **MVP 4**: Competitive Multiplayer - Leaderboard, stealing, quick chat, emotes
- **MVP 5**: Game Feel & Polish - Audio, particles, animations, loading screen, settings menu
- **MVP 5.5**: Physics & Collision - Tree collision, smooth sliding, spatial partitioning
- **MVP 5.7**: Mobile/Touch Controls - Drag-to-move, iOS Safari audio, iPhone landscape fixes
- **MVP 5.8**: Startup UX + Arrow Keys + Session Management - Welcome screen, arrow keys, heartbeat/disconnect system
- **MVP 5.9**: World Boundaries - Soft push-back system with visual feedback
- **MVP 6**: Player Authentication & Identity - Username system, session tokens, position persistence

---

## 🎯 MVP 5.8: Startup UX + Arrow Keys + Session Management

**Goal**: Polish three critical UX issues before moving to new features

### Part 1: Startup Experience (2 hours)
**Problems**:
- No welcome screen (jumps straight to loading)
- Double loading screen (loads assets twice)
- Progress bar goes backwards (100% → 0% → 100%)

**Solution**:
- Add welcome/splash screen with game title
- Consolidate all asset loading into single phase
- Load once: characters, audio, environment
- Flow: Welcome → Loading (all assets) → Character Select → Game

**Success**:
- Welcome screen before loading
- Single loading phase only
- Progress 0% → 100% once
- Smooth fade transitions

### Part 2: Arrow Key Support (40 minutes)
**Goal**: Add ↑←↓→ controls for accessibility

**Implementation**:
- Add arrow key handlers to keyboard input (same as WASD)
- Update UI to show both control schemes
- Update settings menu and control guide

**Success**:
- Arrow keys work for movement
- Both WASD and arrows work simultaneously
- UI shows both options

### Part 3: Session Management (1.5 hours)
**Goal**: Handle disconnected/abandoned players properly

**System**:
- Heartbeat every 10 seconds
- 30s no heartbeat = disconnected
- 2-minute reconnection grace period
- 5-minute full cleanup

**Visual Feedback**:
- Disconnected: 50% opacity, "Disconnected" label
- Abandoned: Fade out, remove from world

**Success**:
- Auto-disconnect after 30s
- Reconnection works seamlessly
- No ghost players in world
- Server resources freed properly

**Time Estimate**: 4 hours total

---

## 🛡️ MVP 5.9: World Boundaries ✅ **COMPLETE**

**Goal**: Prevent players from falling off world edge

**Implemented**: Soft Boundaries (Option 2)

**Features**:
- Soft push-back system (gentle force toward center)
- Push zone: 10 units from edge (starts at 190 units from center)
- Push strength: Gradual increase from 0% → 100%
- Visual feedback: Radial vignette darkens screen edges
- Warning text: "⚠️ Turn Back" appears when close to edge
- Smooth, AAA-quality feel (no jarring collision)
- Works in all directions (radial distance calculation)

**Deferred to MVP 9 (Audio Polish)**:
- Audio cue: Wind rustling/ambient change when approaching boundary
- Reason: Prioritizing core gameplay first, audio polish comes later

**Success Criteria** ✅:
- ✅ Players can't walk past boundaries
- ✅ Smooth collision (no jarring stops)
- ✅ Works in all directions (N/S/E/W)
- ✅ Subtle warning before edge (vignette + text)

**Time**: ~1 hour

---

## 🔐 MVP 6: Player Authentication & Identity ✅ **COMPLETE**

**Goal**: Simple username system for persistent identity

**Implemented**:
- ✅ Username picker on first launch (PlayerIdentity Durable Object)
- ✅ SessionManager with cookie + localStorage (30-day persistence)
- ✅ Position persistence by sessionToken (spawn at last location)
- ✅ Username system with collision handling
- ✅ Leaderboard shows real usernames
- ✅ Username change with cooldown (5 minutes)

**Server Architecture**:
- PlayerIdentity Durable Object for username management
- SessionToken = true identity (unique per browser)
- Username = display name (can be shared, like Discord)
- Position/character data tied to sessionToken (not username)
- Rate limiting on username changes (5 min cooldown)

**Critical Bugs Fixed**:
- Position persistence server → client communication
- Username collision design flaw (identity theft prevention)
- Loading screen race condition (blank canvas)
- Upside-down camera flash during spawn
- Connection loop from spawn position race condition

**Cleanup Completed**:
- ✅ Removed ALL client-side debug logging (Game.ts, main.ts, SessionManager.ts)
- ✅ Removed verbose loading logs (audio, models, walnuts)
- ✅ Removed unused variables from build
- ✅ Kept only console.error/warn for critical issues

**What's Saved for Later**:
- Passwords/email (see MVP 11)
- Account recovery
- OAuth
- Cross-device sync

---

## 🐿️ MVP 7: NPC Characters & World Life

**Goal**: Add ~10 AI characters to make world feel alive and provide gameplay challenge

**Architecture**: Server-side authoritative NPCs (all players see same NPCs)

### Implementation Plan

**Phase 1: Server-Side NPC Infrastructure** (3-4 hours)

**1.1 NPC Data Structures** (workers/objects/ForestManager.ts)
```typescript
interface NPC {
  id: string;                    // "npc-001", "npc-002", etc.
  characterId: string;           // Random from 11 character types
  position: { x, y, z };
  rotationY: number;
  velocity: { x, z };            // Current movement direction
  currentBehavior: NPCBehavior;
  behaviorTimer: number;         // Time in current behavior
  targetPosition?: { x, y, z };  // Where NPC is walking to
  targetEntityId?: string;       // Player/NPC being tracked
  animation: string;             // Current animation state
  walnutInventory: number;       // Walnuts carried (for throwing)
  lastThrowTime: number;         // Cooldown tracking
  aggressionLevel: number;       // 0-1 personality trait
}

enum NPCBehavior {
  IDLE = 'idle',           // Standing still, resting
  WANDER = 'wander',       // Random walking
  APPROACH = 'approach',   // Moving toward player/NPC
  GATHER = 'gather',       // Moving toward walnut
  THROW = 'throw'          // Throwing walnut animation
}
```

**1.2 NPCManager Class** (new file: workers/objects/NPCManager.ts)
- Spawn NPCs on server start (~10 NPCs)
- Despawn NPCs if player count exceeds threshold (>15 players)
- Track all active NPCs in Map<string, NPC>
- Main update loop: `updateNPCs(delta: number)` runs every 100ms
- Assign random character types and aggression levels on spawn
- Generate random NPC names: "NPC - [CharacterName]"

**1.3 NPC Update Loop Integration**
- Add Durable Object alarm for NPC updates (100ms tick rate)
- Separate from player heartbeat system
- Balance performance: 10 NPCs × 10 updates/sec = 100 updates/sec

**Phase 2: NPC AI System** (4-5 hours)

**2.1 Perception System**
```typescript
findNearbyPlayers(npc: NPC, radius: number): PlayerConnection[]
findNearbyNPCs(npc: NPC, radius: number): NPC[]
findNearbyWalnuts(npc: NPC, radius: number): Walnut[]
```
- Vision radius: 30 units for entities, 20 units for walnuts
- Only detect entities within line-of-sight (no wall-hacking)
- Cache perception results to reduce computation

**2.2 Behavior State Machine**
```
IDLE (15% time)
  ├─> WANDER (if bored, 70% probability)
  ├─> GATHER (if walnut visible, 10% probability)
  └─> APPROACH (if entity nearby, 5% probability)

WANDER (random walk)
  ├─> IDLE (reached destination or timeout)
  ├─> GATHER (if walnut spotted)
  └─> APPROACH (if aggressive + entity nearby)

APPROACH (move toward target)
  ├─> THROW (if has walnut + in range 5-15 units)
  ├─> IDLE (if lost target)
  └─> WANDER (if target too far)

GATHER (move toward walnut)
  ├─> IDLE (after collecting walnut)
  └─> WANDER (if walnut taken by someone else)

THROW (animation + projectile)
  └─> IDLE (after throw completes, 1.5s cooldown)
```

**2.3 Decision Making Logic**
- `selectBehavior(npc, nearbyPlayers, nearbyNPCs, nearbyWalnuts): NPCBehavior`
- Weighted random decisions based on:
  - Current behavior timer (don't change too fast)
  - Aggression level (0.3 = passive, 0.7 = aggressive)
  - Walnut inventory (gather more if low, throw if has walnuts)
  - Nearby entity count (avoid large groups)
- Min behavior duration: 2-5 seconds before switching

**2.4 Movement & Pathfinding**
- Simple navigation: move directly toward target (no A* yet)
- Collision avoidance: raycast to detect obstacles
- Speed: 80% of player movement speed (2.4 units/sec vs 3.0)
- Rotation: smoothly turn toward movement direction
- Stop if within 1 unit of destination

**2.5 Throwing Behavior**
- Check inventory: must have ≥1 walnut
- Check distance: target must be 5-15 units away
- Check cooldown: 3 seconds between throws
- Calculate trajectory: aim at target's current position + prediction
- Broadcast `npc_throw` message with projectile data
- Decrement walnut inventory after throw

**Phase 3: Client-Side NPC Rendering** (3-4 hours)

**3.1 NPC Entity Management** (client/src/Game.ts)
```typescript
private npcs: Map<string, THREE.Group> = new Map();
private npcNameLabels: Map<string, HTMLElement> = new Map();
```

**3.2 Message Handlers**
- `npc_spawned`: Load character model, add to scene, create name tag
- `npc_update`: Update position, rotation, animation (every 100ms)
- `npc_despawned`: Remove from scene, cleanup resources
- `npc_throw`: Play throw animation, spawn walnut projectile

**3.3 NPC Rendering**
- Reuse existing character loading system (same 11 models as players)
- Name tags: "NPC - Colobus", "NPC - Mandrill", etc.
- Position interpolation: smooth movement between server updates
- Animation sync: same system as remote players
- Visual distinction: Optional subtle shader effect (e.g., slight glow)

**3.4 NPC Name Tag Styling**
- Different color from player tags (e.g., cyan vs white)
- Font style: italic to distinguish from real players
- Position: above character head, same as player tags

**Phase 4: NPC-Player Interactions** (3-4 hours)

**4.1 Player → NPC Interactions**
- Players can throw walnuts at NPCs (reuse existing throw system)
- Hit detection: server validates hits, broadcasts to all clients
- NPC reactions: briefly change to IDLE behavior when hit
- For MVP 7: No damage/health (that's MVP 8), just interaction

**4.2 NPC → Player Interactions**
- NPCs track nearby players with perception system
- Aggressive NPCs (aggression > 0.5) prioritize approaching players
- NPCs throw walnuts at players within range
- Projectile physics: same arc trajectory as player throws

**4.3 Walnut Gathering**
- NPCs detect visible walnuts (bush walnuts, golden walnuts)
- Navigate to nearest walnut within 20 units
- Server handles walnut collection: mark found, update inventory
- Broadcast `walnut_found` message with NPC as finder
- NPCs contribute to leaderboard (score for finding walnuts)

**4.4 NPC Inventory Management**
- Start with 0 walnuts
- Max inventory: 5 walnuts (lower than player's 10 for MVP 8)
- Gather walnut: +1 inventory
- Throw walnut: -1 inventory
- Behavior logic: prioritize gathering if inventory < 3

**Phase 5: Testing, Balancing & Polish** (2-3 hours)

**5.1 Performance Testing**
- Test with 10 NPCs + 10 real players (20 entities total)
- Monitor Durable Object CPU usage
- Optimize perception system if needed (spatial partitioning)
- Adjust update frequency if lag occurs (100ms → 150ms)

**5.2 Behavior Tuning**
- Balance aggression levels (50% passive, 30% neutral, 20% aggressive)
- Adjust behavior probabilities for variety
- Tune throw accuracy (80% accuracy, not perfect)
- Test NPC gathering vs player competition

**5.3 Visual Polish**
- Ensure NPC animations transition smoothly
- Test name tag visibility at various distances
- Add subtle particle effect when NPC spawns (optional)
- Verify NPC collision with trees and terrain

**5.4 Edge Cases**
- Handle NPC stuck in corners (teleport to random position after 10s)
- Prevent NPC clumping (repulsion force from other NPCs)
- NPC boundary handling (same soft push-back as players)
- Server restart: respawn all NPCs

### Technical Considerations

**Server Performance**:
- 10 NPCs × 10 updates/sec = 100 NPC updates/sec
- Each update: perception check, behavior logic, movement
- Estimated CPU: ~5-10ms per update cycle (acceptable for Durable Objects)

**Network Bandwidth**:
- Broadcast NPC updates to all players: 10 NPCs × N players
- Each update: ~50 bytes (position, rotation, animation)
- Bandwidth: 500 bytes/sec per player (negligible)

**MVP 7 vs MVP 8 Split**:
- MVP 7: Basic throwing (animation, projectile, no damage)
- MVP 8: Health, damage, inventory limits, combat scoring

### Success Criteria

- ✅ ~10 NPCs spawn on server start
- ✅ NPCs wander naturally around the world
- ✅ NPCs detect and approach players/other NPCs
- ✅ NPCs gather walnuts and contribute to leaderboard
- ✅ NPCs throw walnuts at nearby entities (basic behavior)
- ✅ All players see identical NPC behavior (authoritative server)
- ✅ Name tags clearly identify NPCs vs real players
- ✅ Performance stable with 10 NPCs + 10 players
- ✅ World feels alive and dynamic

### Files to Create/Modify

**New Files**:
- `workers/objects/NPCManager.ts` - NPC spawning, AI, updates

**Modified Files**:
- `workers/objects/ForestManager.ts` - Integrate NPCManager, add NPC messages
- `client/src/Game.ts` - NPC rendering, message handlers
- `client/src/types.ts` - NPC message types

**Time Estimate**: 12-16 hours total

---

## 🥊 MVP 8: Combat, Health & Resource Management

**Goal**: Triple-purpose walnuts (score, throw, eat) with survival mechanics

### Core Systems

**Health**:
- Start with 100 HP
- Natural regen: +1 HP per 10s
- Eating walnut: +25 HP
- Hit by thrown walnut: -20 HP
- Death at 0 HP: 3s respawn, lose all walnuts, -5 points

**Inventory**:
- Max 10 walnuts carried
- Can't pickup when full
- Death drops all walnuts (ground loot)

**Throwing**:
- Desktop: T key (hold to charge)
- Mobile: THROW button
- 1.5s cooldown
- 20 HP damage on hit
- Arc trajectory physics

**Eating**:
- Desktop: E key
- Mobile: EAT button
- 2s cooldown
- +25 HP restore
- Can't eat at full HP

### Scoring Updates
- Find walnut: +1 (bush) / +3 (buried)
- Hit opponent: +3 points
- Knockout opponent: +5 points
- Get hit: -1 point
- Die: -5 points + lose all walnuts

**Success**:
- Health system working (damage, heal, die, respawn)
- Can throw walnuts (physics + hit detection)
- Can eat walnuts (with cooldown)
- Inventory limited to 10 walnuts
- Low health prompts eating
- Works on desktop (T/E) and mobile (buttons)

---

## 🎨 MVP 9: Advanced Animation & Visual Polish (Optional)

**Status**: Current implementation is good enough. This is optional polish.

**Potential Improvements**:
- Hermite interpolation for remote players
- Dead reckoning for network lag prediction
- Better buried walnut visual (rounded mound vs inverted cone)
- Audio pooling for instant playback
- Narrator voiceover (~50 lines)
- NPC voiceovers with position-based audio
- **Boundary audio cue** (deferred from MVP 5.9): Wind rustling/ambient change when approaching world edge

---

## 🏆 MVP 9.5: Leaderboard Management & Polish

**Goal**: Real leaderboard system with server persistence and management

**Features**:
- Server-side leaderboard storage (replace mock data)
- Real-time score updates from all players
- Persistent leaderboard across sessions
- Top 10 players displayed
- Player rank shown even if not in top 10
- Username display (already implemented in MVP 6)

**Management**:
- Admin endpoint to reset leaderboard
- Leaderboard archives (daily/weekly/all-time)
- Anti-cheat: Server-side score validation
- Rate limiting on score updates

**Polish**:
- Smooth score animations
- Rank change indicators (↑↓)
- Player highlighting in leaderboard
- Medal icons for top 3 players

**Deferred from MVP 6**:
- MVP 6 implemented username display in leaderboard
- MVP 6 implemented username labels for remote players
- MVP 6 implemented "username - Character" format for connection messages

**Success**:
- Leaderboard persists across server restarts
- Scores update in real-time for all players
- Admin can reset/manage leaderboard
- No cheating via client-side score manipulation

---

## 🐺 MVP 10: Predators & Polish

**Goal**: Add predators, power-ups, final polish

### Predators
- **Hawks** - Aerial dive attacks
- **Wolves** - Ground chase

**Defense**:
- Chatter (rapid key presses)
- Throw objects at predators
- Group safety (predators avoid groups)

### Power-ups
- **Scent Sniff** - Reveal buried walnuts (10s)
- **Fast Dig** - 2x faster hide/find (20s)
- **Decoy Nut** - Fake walnut trap

### Polish
- Hot zones (glowing activity areas)
- Weather effects (rain, fog)
- Forest ambience audio
- Predator sounds
- Cycle countdown timer

**Success**:
- Predators add challenge
- Power-ups are fun
- Audio enhances immersion

---

## 🔐 MVP 11: Player Authentication (Full)

**Goal**: Full account system with passwords/recovery

**Features**:
- Username/password or magic link email
- Account recovery (email reset)
- Cross-device sync
- Persistent stats and leaderboard

**Backend**:
- Cloudflare D1 or Auth0/Firebase
- Secure password hashing
- Session management

**Why Last**: Core gameplay must be fun first. Can launch with MVP 6 (simple username).

---

## 🌍 MVP 12: Advanced Systems (Future)

**Warning**: DO NOT implement until MVPs 1-11 complete and game feels AMAZING!

### 24-Hour World Cycle
- Forest regenerates every 24 hours
- 100 walnuts spawn at reset
- Players rejoin mid-cycle
- Leaderboard tracks cycle rankings

### Performance (ONLY if needed)
- LOD system (level of detail)
- Object pooling (reuse objects)
- Occlusion culling (don't render hidden)
- Auto-quality adjustment

**Important**: Profile first, optimize second!

---

## 🗑️ MVP 13: Code Cleanup

**Goal**: Remove unused ECS/enterprise code

**Why Last**: Don't break working code during development. Clean up when feature set is stable.

**Delete**:
- ecs/, entities/, systems/, services/, core/, rendering/, test/
- GameComposition.ts, ENTERPRISE_ARCHITECTURE.md

**Keep**:
- Game.ts, main.ts, terrain.ts, forest.ts
- AudioManager.ts, VFXManager.ts, SettingsManager.ts, TouchControls.ts, LoadingScreen.ts
- style.css, types.ts

**Result**: ~10-15 files instead of ~30+, ~2000 lines instead of ~7500

---

## 📅 Timeline

| MVP | Focus | Status |
|-----|-------|--------|
| 1.5-5.9 | Core Game & Polish | ✅ Complete |
| 6 | Player Identity (Simple) | ✅ Complete |
| **7** | **NPC Characters** | 🎯 **NEXT** |
| 8 | Combat & Health | Pending |
| 9 | Animation Polish (Optional) | Pending |
| 10 | Predators & Polish | Pending |
| 11 | Full Authentication | Pending |
| 12 | Advanced Systems | Future |
| 13 | Code Cleanup | Future |

---

## 📝 Quick Reference

### MVP 5.8: Startup UX + Arrow Keys + Session Management
Fix double loading with welcome screen, add arrow key support, implement heartbeat/disconnect system. (4 hours)

### MVP 5.9: World Boundaries
Prevent falling off edge with invisible walls, soft boundaries, or natural barriers. (30min-2hrs)

### MVP 6: Player Authentication & Identity
Simple username system for persistent identity. No passwords yet. (TBD)

### MVP 7: NPC Characters & World Life
~10 server-side AI characters with perception, behaviors (wander/approach/gather/throw), walnut throwing at players/NPCs. (12-16 hours)

### MVP 8: Combat, Health & Resource Management
Triple-purpose walnuts (score/throw/eat), 100 HP system, 10-walnut inventory, T/E keys. (TBD)

### MVP 9: Advanced Animation & Visual Polish (Optional)
AAA polish: Hermite interpolation, narrator voiceover, NPC voices. Optional. (TBD)

### MVP 9.5: Leaderboard Management & Polish
Real server-side leaderboard with persistence, admin management, anti-cheat validation. (TBD)

### MVP 10: Predators & Polish
Hawks/wolves as threats, power-ups (Scent/Fast Dig/Decoy), weather effects. (TBD)

### MVP 11: Player Authentication (Full)
Passwords, email, account recovery, cross-device sync. Builds on MVP 6. (TBD)

### MVP 12: Advanced Systems
24hr world cycle, performance optimizations. Only if needed. (TBD)

### MVP 13: Code Cleanup
Remove unused ECS code. Do last when features stable. (TBD)

---

**Next Step**: Begin MVP 7 (NPC Characters) 🐿️
