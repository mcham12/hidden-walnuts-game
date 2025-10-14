# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: MVP 5.7 (Mobile/Touch Controls) - Final testing on iPhone ✅

---

## 📋 Table of Contents
- [Completed Work](#completed-work)
- [Current: MVP 5.8 - Startup Experience](#mvp-58-startup-experience--ux-polish)
- [Upcoming MVPs](#mvp-6-code-cleanup)
- [Timeline Summary](#timeline-summary)
- [Success Criteria](#success-criteria)

---

## ✅ Completed Work

### MVP 1.5: Animated Character System
- 3D forest terrain with procedural generation
- Multiple character models with idle/walk/run/jump animations
- WASD movement + camera following + physics
- Smooth animation transitions and movement

### MVP 1.9: Backend Simplification
- Simplified Cloudflare Workers architecture
- Basic Durable Objects (ForestManager, WalnutRegistry, Leaderboard)
- WebSocket connections working
- Production-ready with CORS fixes

### MVP 2.0: Multiplayer Foundation
- WebSocket connections with real-time sync
- Multiple players can see each other moving
- Smooth animation synchronization
- Player name tags and identification
- Loading states & connection status
- Error handling and recovery

### MVP 3: Core Walnut Mechanics
- Hide walnuts with H key (context-based: bush vs buried)
- Find walnuts by clicking
- Walnut types: buried (3pts), bush (1pt), golden (bonus)
- Proximity indicators and cursor feedback
- Cardinal direction landmarks (N/S/E/W towers)
- Minimap with player positions and landmarks
- Server-synchronized world state

### MVP 3.5: Multiple Character Selection
- 11 playable characters across categories (mammals, reptiles, birds, aquatic)
- Character preview with 3D model rotation
- Characters.json-based configuration system
- Dynamic character loading and selection UI

### MVP 4: Competitive Multiplayer
- Real-time leaderboard with live updates
- Walnut stealing mechanics
- Quick chat system with predefined messages
- Emote system with character gestures
- Competitive scoring and rankings

### MVP 5: Game Feel & Polish
- Audio system with sound effects (hide, find, footsteps, ambient)
- Particle effects (bury, find, footsteps, score, confetti)
- Score pop-up animations with tweening
- Animated loading screen with walnut GLB model
- Settings menu with volume controls
- Enhanced walnut click detection and hover effects
- Connection status indicator
- Loading progress bar

### MVP 5.5: Physics & Collision Detection
- Player collision with landmark trees
- Player collision with regular forest trees
- Smooth sliding movement around obstacles
- Spatial partitioning for performance
- Camera shake on collision feedback

### MVP 5.7: Mobile/Touch Controls
- Drag-to-move touch controls for mobile
- Mobile device detection (iPad, iPhone, Android)
- Mobile UI optimizations (responsive layouts)
- Performance optimizations (disabled shadows/AA on mobile)
- iOS audio policy handling
- Touch state management (character stops when touch ends)
- VPN/Cloudflare troubleshooting documentation

---

## 🎯 Current Focus

## 🎨 MVP 5.8: Startup Experience & UX Polish

**Goal**: Fix janky loading experience and create professional first impression

**Why Now?** (Before Code Cleanup)
- **First impressions matter**: Loading is the first thing users see
- **Currently broken**: Double loading, backwards progress bar, visual bugs
- **Quick wins**: Most issues are simple fixes that dramatically improve UX
- **Before cleanup**: Fix UX issues before cleaning up code

### Current Problems

**Issue 1: No Welcome Screen**
- Currently jumps straight to loading screen
- No branding or introduction to the game
- Users confused about what they're loading into

**Issue 2: Double Loading Screen** (CRITICAL UX BUG)
- First load: Character preview assets
- Second load: Game world assets (AFTER character selection)
- Progress bar resets and goes backwards
- Feels unprofessional and confusing

**Issue 3: Minimap Visible on Character Select** ✅ FIXED in MVP 5.7
- ~~Minimap outline shows on character selection~~
- Fixed with `display: none` by default

**Issue 4: Progress Bar Goes Backwards**
- When second loading screen appears, progress resets from 100% to 0%
- Violates user expectations (progress should only go forward)

**Issue 5: Asset Loading Not Optimized**
- Loading character preview requires separate GLB fetch
- Then loading game world requires another set of fetches
- Could consolidate into single loading phase

### Implementation Plan

**Phase 1: Welcome/Splash Screen** (30 minutes)
```typescript
// Add before LoadingScreen in main.ts
class WelcomeScreen {
  show() {
    // Simple overlay with game title/logo
    // "Hidden Walnuts" title
    // Tagline: "A Multiplayer Forest Adventure"
    // "Click to Start" button
    // Fades in smoothly
  }

  hide() {
    // Fade out and remove from DOM
  }
}

// Flow: WelcomeScreen → LoadingScreen → CharacterSelect → Game
```

**Phase 2: Consolidate Asset Loading** (1 hour)
```typescript
// Instead of loading in two phases, load once upfront:
async function preloadAllAssets() {
  const loadingScreen = new LoadingScreen();
  await loadingScreen.show();

  // Load character models (for preview AND game)
  loadingScreen.updateProgress(0.2, 'Loading characters...');
  await loadCharacters();

  // Load audio (desktop only)
  loadingScreen.updateProgress(0.4, 'Loading audio...');
  if (!isMobile) await audioManager.waitForLoad();

  // Preload environment assets
  loadingScreen.updateProgress(0.6, 'Loading forest...');
  await preloadEnvironmentAssets();

  // Ready
  loadingScreen.updateProgress(1.0, 'Ready!');

  // Now show character select (no second loading needed!)
}
```

**Phase 3: Fix Progress Bar** (15 minutes)
- Remove second loading screen entirely (consolidate loading)
- Progress only goes 0% → 100% once
- Never resets or goes backwards

**Phase 4: Smooth Transitions** (30 minutes)
- Fade transitions between screens
- Welcome → Loading → Character Select → Game
- No jarring cuts
- Professional feel

### Technical Details

**Loading Strategy Changes**:
```typescript
// BEFORE (current - buggy):
// 1. LoadingScreen (loads basic assets)
// 2. Character Select (interactive, loads preview)
// 3. Start button clicked
// 4. LoadingScreen AGAIN (loads game world) ← PROBLEM!
// 5. Game starts

// AFTER (fixed):
// 1. WelcomeScreen (title, click to start)
// 2. LoadingScreen (loads ALL assets once)
// 3. Character Select (everything already loaded)
// 4. Start button clicked
// 5. Game starts immediately (no second load!)
```

**Asset Preloading**:
- Character GLB models (all characters, not just selected)
- Audio files (if desktop)
- Environment textures/models (bushes, trees, landmarks)
- UI assets (walnut icons, etc.)

**Performance Consideration**:
- Total loading time might be slightly longer upfront
- But no second loading screen = better UX
- User only waits once, not twice

### Success Criteria

- [ ] Welcome screen shows before loading (with game title)
- [ ] Single loading screen (no double load)
- [ ] Progress bar only goes forward (0% → 100%)
- [ ] No second loading after character selection
- [ ] Smooth fade transitions between all screens
- [ ] Minimap hidden on character select ✅ (already fixed)
- [ ] Loading feels professional and polished

### Time Estimate

- **Total**: 2-3 hours of focused work
- **Impact**: Massive UX improvement for minimal effort
- **Priority**: HIGH (first impression is everything)

---

## 🗑️ MVP 6: Code Cleanup

**Goal**: Remove unused ECS/enterprise code

### Files to Delete

```bash
# Delete entire unused folders
rm -rf client/src/ecs/
rm -rf client/src/entities/
rm -rf client/src/systems/
rm -rf client/src/services/
rm -rf client/src/core/
rm -rf client/src/rendering/
rm -rf client/src/test/

# Delete complex orchestration files
rm client/src/GameComposition.ts
rm client/src/ENTERPRISE_ARCHITECTURE.md
rm client/src/ARCHITECTURE_README.md
```

### Keep Simple Architecture

**Keep These Files**:
- Game.ts (main game class)
- main.ts (bootstrap)
- terrain.ts (terrain generation)
- forest.ts (forest generation)
- style.css, vite-env.d.ts, types.ts

**Result**:
- ~8 files instead of ~30
- ~500 lines instead of ~7,500
- Clean, maintainable codebase

---

## 🔌 MVP 6.3: Session & Connection Management

**Goal**: Properly handle disconnected/abandoned players following standard gaming practices

**Why Now?** (Before Player Authentication)
- **Clean multiplayer state**: Remove ghost players from world
- **Performance**: Don't track inactive connections
- **UX**: Other players don't see frozen/abandoned characters
- **Foundation for auth**: Session management needed before user accounts

### Abandoned Player Cleanup

**Standard Gaming Practices:**
- **Disconnect timeout**: 30 seconds of no heartbeat = disconnected
- **Reconnection grace period**: 2 minutes to reconnect and resume
- **Abandoned cleanup**: 5 minutes of inactivity = full cleanup

**Implementation:**
```typescript
interface PlayerSession {
  playerId: string;
  lastHeartbeat: number;
  disconnectedAt: number | null;
  isAbandoned: boolean;
}

class SessionManager {
  private sessions: Map<string, PlayerSession> = new Map();

  // Check heartbeats every 10 seconds
  startSessionMonitoring() {
    setInterval(() => {
      const now = Date.now();

      for (const [playerId, session] of this.sessions) {
        // No heartbeat for 30 seconds = disconnected
        if (now - session.lastHeartbeat > 30000) {
          if (!session.disconnectedAt) {
            this.handlePlayerDisconnect(playerId);
            session.disconnectedAt = now;
          }

          // Abandoned after 5 minutes of disconnect
          if (now - session.disconnectedAt > 300000) {
            this.cleanupAbandonedPlayer(playerId);
            this.sessions.delete(playerId);
          }
        }
      }
    }, 10000);
  }

  handlePlayerDisconnect(playerId: string) {
    // Hide player character (keep in memory for reconnect)
    // Show "Disconnected" status in UI
    // Stop broadcasting their position
  }

  cleanupAbandonedPlayer(playerId: string) {
    // Remove player character from world
    // Remove from leaderboard (temp players only)
    // Clear their walnuts (or mark as "abandoned" for scavenging)
    // Free up server resources
  }
}
```

### Heartbeat System

**Client → Server:**
- Send heartbeat every 10 seconds
- Include playerId and timestamp
- Piggybacked on existing messages when possible

**Server → Client:**
- Acknowledge heartbeats
- Broadcast player disconnect/reconnect events
- Send reconnection token (for resuming session)

### Reconnection Flow

**When Player Reconnects:**
```typescript
// Client sends reconnection request
interface ReconnectMessage {
  type: 'reconnect';
  playerId: string;
  reconnectToken: string; // Stored in localStorage
}

// Server validates and restores session
if (session.disconnectedAt && now - session.disconnectedAt < 120000) {
  // Within grace period - restore player
  session.disconnectedAt = null;
  session.lastHeartbeat = now;

  // Send full world state to reconnecting player
  // Show "Player reconnected" to others
} else {
  // Grace period expired - start fresh
  createNewSession(playerId);
}
```

### Visual Feedback

**Disconnected Players:**
- Character fades to 50% opacity
- "Disconnected" label above character
- No longer move or interact
- Still visible for 2-minute grace period

**Abandoned Cleanup:**
- Character fades out completely (2-second animation)
- Removed from leaderboard (if temp player)
- Walnuts marked as "abandoned" (can be found by others)

### Server Optimizations

**Resource Management:**
- Close WebSocket connections after timeout
- Clear player state from memory
- Update player count in real-time
- Broadcast abandoned player cleanup to all clients

**Database Updates:**
- Update "lastSeen" timestamp for authenticated users
- Mark session as "abandoned" in database
- Keep session history for analytics (7 days)

### Success Criteria

- [ ] Players automatically disconnected after 30s no heartbeat
- [ ] 2-minute grace period for reconnection
- [ ] Full cleanup after 5 minutes of inactivity
- [ ] Disconnected players visually indicated
- [ ] Reconnection works seamlessly (restore position/state)
- [ ] No ghost players in world
- [ ] Server resources properly freed

### What's Saved for Later

**Advanced Features:**
- Cross-device reconnection (needs full auth)
- Session migration (switch device mid-game)
- Spectator mode for disconnected players
- Session analytics and metrics

---

## 🔐 MVP 6.5: Player Authentication & Identity

**Goal**: Players can create a username and come back as the same identity

**Why Now?** (Moved from MVP 8)
- **Player stickiness**: Can't build engagement without persistent identity
- **Meaningful leaderboard**: Real names instead of "Player 1234"
- **Community building**: Players recognize each other across sessions
- **Foundation for progression**: Enables future stat tracking and unlocks
- **Must have before adding more content**: Need this working before predators/combat

### Simple Username System

**No passwords** (for now - keep it simple!)
- Just username on first launch
- Stored in localStorage + server
- Can add full auth later if needed

**Implementation**:
```typescript
interface PlayerIdentity {
  id: string;              // UUID
  username: string;        // 3-20 characters, unique
  createdAt: number;
  lastSeen: number;
}

// On first visit
const username = prompt("Choose your username:");
localStorage.setItem('playerId', uuid());
localStorage.setItem('username', username);

// Server validates and stores
// Returns existing identity if username taken
```

**Features**:
- Username picker on first launch
- Persistent across browser sessions
- Leaderboard shows real usernames
- "Playing as: [username]" shown in UI
- Can change username in settings (with cooldown)

**Server Changes**:
- New PlayerIdentity Durable Object
- Username uniqueness check
- Rate limiting on username changes

**What's Saved for Later**:
- Password/email authentication
- Account recovery
- OAuth (Google, Discord, etc.)
- Cross-device sync (needs full auth)

---

## 🐿️ MVP 6.7: NPC Characters & World Life

**Goal**: Add AI-controlled characters to make the world feel alive before there are many real players

**Why Now?** (Moved up from MVP 7)
- **World feels empty**: Game needs life before reaching critical player mass
- **Player engagement**: Solo players have something to watch/interact with
- **Testing & balance**: NPCs help test multiplayer mechanics
- **Atmosphere**: Forest feels inhabited and dynamic

### NPC Behavior System

**NPC Characters** - Use existing character models
- Spawn 3-5 NPCs randomly across the map
- Can be any character (Squirrel, Gecko, Pudu, etc.)
- Each NPC has simple AI behaviors

**Basic AI Behaviors**:
```typescript
class NPCController {
  private behaviors = ['wander', 'rest', 'hide_walnut', 'search'];

  update() {
    // Switch behaviors every 30-60 seconds
    switch(this.currentBehavior) {
      case 'wander':
        this.moveRandomly();  // Walk around forest
        break;
      case 'rest':
        this.playIdleAnimation();  // Sit and observe
        break;
      case 'hide_walnut':
        this.hideWalnutNearby();  // Hide in random spot
        break;
      case 'search':
        this.lookForWalnuts();  // Walk toward walnuts
        break;
    }
  }
}
```

**NPC Actions**:
- **Wander**: Walk around forest aimlessly (70% of time)
- **Rest**: Stop and play idle animation (15% of time)
- **Hide Walnut**: Find nearby bush/ground and hide a walnut (10% of time)
- **Find Walnut**: Walk toward visible walnuts and collect them (5% of time)

### NPC Characteristics

**Visual Differentiation**:
- Name tags: "NPC - [CharacterName]" (e.g., "NPC - Squirrel")
- Slightly different movement speed (slower than players)
- No player glow effects

**Gameplay Integration**:
- NPCs contribute to leaderboard (encourages competition)
- Players can steal NPC walnuts (worth points)
- NPCs don't chase players or compete aggressively
- NPCs respawn if they wander too far (teleport back)

**Simple Pathfinding**:
- Raycasting for obstacle avoidance
- Random waypoints for wandering
- No complex A* navigation (keep it simple!)

### Implementation

**NPC Spawning**:
```typescript
interface NPCConfig {
  id: string;
  character: string;        // Random from available characters
  spawnPosition: Vector3;
  personality: 'shy' | 'curious' | 'competitive';  // Affects behavior weights
}

// Spawn NPCs on game start
spawnNPCs(count: number) {
  for (let i = 0; i < count; i++) {
    const character = this.getRandomCharacter();
    const position = this.getRandomSpawnPosition();
    this.createNPC(character, position);
  }
}
```

**Server Sync**:
- NPCs controlled by server (prevents cheating)
- Server broadcasts NPC positions just like players
- Clients render NPCs using same system as remote players

### Balancing

**NPC Difficulty**:
- **Easy Mode** (default): NPCs hide walnuts poorly (obvious spots)
- **Medium Mode**: NPCs hide in bushes and decent ground spots
- **Hard Mode**: NPCs hide strategically (mimics player behavior)

**NPC Limits**:
- Max 5 NPCs active at once
- NPCs don't spawn if 10+ real players online
- Automatically scale down as player count increases

### Future Enhancements (Post-MVP)

**Optional NPC Features** (save for later):
- Voice lines when players get close
- Emotes and reactions to events
- Different personality types (friendly, competitive, sneaky)
- NPCs group together occasionally
- NPCs react to predators (MVP 7+)

**Why Not Now**:
- Basic wandering NPCs sufficient for MVP
- Voice acting requires additional assets
- Complex behaviors can wait until core gameplay is polished

---

## 🎨 MVP 6.8: Advanced Animation & Visual Polish (Optional)

**Goal**: AAA-quality animation smoothness and visual refinements

**Status**: Current implementation is good enough for gameplay. This is optional polish.

**Note**: Previously MVP 6.6, renumbered due to NPC addition

### Current Implementation ✅
- Manual delta time calculation
- Capped frame time (prevents lag spikes)
- Seamless animation loops
- Smooth camera interpolation
- Acceleration/deceleration physics

### Future Refinements (If Time Permits)

**Animation Improvements**:
- **Hermite Interpolation** - Smoother remote player movement
- **Dead Reckoning** - Predict position during network lag
- **Input Buffering** - Prevent dropped inputs during lag
- **Adaptive Delay** - Adjust interpolation based on network quality

**Visual Improvements**:
- **Buried Walnut Visual** - Replace flattened upside-down dirt cone with natural-looking dirt mound
  - Current: Inverted cone geometry (functional but unpolished)
  - Target: Rounded mound with texture detail and proper terrain blending

**Audio Improvements**:
- **Audio Responsiveness Refinement** - Optimize audio system for instant playback with zero delay
  - Refactor audio context management for better browser compatibility
  - Implement proper audio pooling for frequently-played sounds
  - Add failsafe mechanisms for audio context suspension
  - Test across different browsers and devices
- **Narrator Voiceover System** - Record and implement voice-acted tutorial and achievement callouts
  - ~50 narrator lines (calm, guiding voice)
  - Tutorial/onboarding, game state announcements, achievement unlocks, contextual tips
  - Simple audio playback triggered by game events
- **NPC Voiceovers** - Squirrel, Owl, Chipmunk character voices (added in MVP 6.7 with NPCs)
  - Position-based audio (quieter when far from NPC)
  - Ambient comments as players pass by
  - Contextual hints about nearby walnuts

---

## 🐺 MVP 7: Predators & Polish

**Goal**: Add predators, power-ups, and final game polish

### Predator System

**Predator Types**:
- Hawks (aerial, dive attacks)
- Wolves (ground, chase players)
- Spawns randomly, avoids safe zones

**Predator Behavior**:
```typescript
class Predator {
  update() {
    if (this.detectNearbyPlayers()) {
      this.chasePlayer();
      this.triggerPlayerFear();  // "Fear" animation
    }
  }
}
```

**Defense Mechanics**:
- **Chatter Defense**: Rapid key presses to scare away
- **Projectile Defense**: Throw objects at predators
- **Group Defense**: Predators avoid multiple players together

### Power-up System

**Power-up Types**:
- **Scent Sniff**: Reveals nearby buried walnuts (10 second duration)
- **Fast Dig**: Hide/find walnuts 2x faster (20 seconds)
- **Decoy Nut**: Fake walnut that gives no points (trap for others)

**Spawn Mechanics**:
- Random spawns every 5 minutes
- Glowing effect to indicate location
- First player to collect gets power-up

### Game Polish

**Visual Polish**:
- Hot zones (glowing areas of recent activity)
- Particle effects (digging, finding, power-ups)
- Weather effects (rain, fog for atmosphere)

**Audio Polish**:
- Background forest ambience (birds, wind, streams)
- Footstep sounds (different per terrain)
- Digging/finding sound effects
- Predator sounds (hawk screech, wolf howl)
- Power-up collection sound

**UI Polish**:
- Cycle countdown timer
- Score animations (pop-up when gaining points)
- Walnut counter with icon
- Settings menu (audio volume, sensitivity)

**Voiceover Integration**:
- Narrator event announcements (continues from MVP 3)
- Predator warning callouts
- NPC voice lines (if implemented in MVP 6.7)

---

## 🥊 MVP 7.2: Walnut Combat & Throwing

**Goal**: Add direct player-vs-player interaction with throwable walnuts

**Philosophy**: Complements hide-and-seek with action combat

### Throwable Walnut Mechanics

**Walnut GLB Asset** - Physical walnut object (already added to assets/environment)
- Appears as ground loot (unburied walnuts)
- Can be picked up and thrown at other players
- Physics-based projectile with arc trajectory

**Picking Up Walnuts**:
```typescript
// Walk over unburied walnut to pick it up
interface WalnutInventory {
  walnutCount: number;     // Max 5 walnuts
  canThrow: boolean;       // Cooldown check
  lastThrowTime: number;
}
```

**Throwing Mechanics**:
```typescript
// Press T key (or click while holding walnut)
interface ThrowPhysics {
  throwPower: number;      // Based on hold duration
  trajectory: THREE.Vector3;  // Arc calculation
  collisionCheck: boolean;    // Hits player or ground
}
```

**Scoring System**:
- **Pick up unburied walnut**: +1 point (encourages ground loot)
- **Hit another player**: +1 point (skill-based)
- **Get hit**: -1 point + "death" animation (2 second stun)

**Balance Mechanics**:
- **Inventory limit**: Max 5 walnuts (prevents hoarding)
- **Throw cooldown**: 2 seconds between throws (prevents spam)
- **Death animation**: 2 second stun when hit (gives others time to escape)
- **Walnut physics**: Arc trajectory requires skill to hit moving targets

### Visual & Audio Feedback

**Animations**:
- Throw animation (wind-up and release)
- Death/hit animation (stumble, brief fall)
- Pick-up animation (quick bend)

**Effects**:
- Projectile trail (walnut spinning through air)
- Hit particles (impact burst)
- Miss effect (walnut bounces on ground)

**Sounds**:
- Throw sound (whoosh)
- Hit sound (bonk + player grunt)
- Miss sound (thud on ground)
- Pick-up sound (collect chime)

### UI Elements

**HUD Updates**:
- Walnut count indicator (how many you're carrying)
- Throw cooldown timer (visual feedback)
- Damage indicator (red flash when hit)

**Controls**:
- **T key**: Throw walnut (if carrying any)
- **Walk over walnut**: Auto-pickup (if inventory not full)
- **Mouse aim**: Throw direction

### Server Sync

**Throwing Message**:
```typescript
interface ThrowMessage {
  type: 'THROW_WALNUT';
  throwerId: string;
  position: Vector3;     // Starting position
  velocity: Vector3;     // Trajectory
  timestamp: number;
}
```

**Hit Detection**:
```typescript
interface HitMessage {
  type: 'WALNUT_HIT';
  throwerId: string;     // Who threw it
  targetId: string;      // Who got hit
  position: Vector3;     // Where hit landed
}
```

**Why This Fits Now**:
- After predators (MVP 7), players expect dynamic threats
- Walnut asset is ready
- Physics system already exists
- Adds replayability and skill ceiling
- Natural evolution from pure exploration

**What's Saved for Later**:
- Special walnut types (explosive, freeze, etc.)
- Team combat modes
- Combat leaderboard separate from hide-and-seek
- Throwing physics upgrades (power-ups)

---

## 📱 MVP 7.5: Mobile/Touch Controls

**Status**: ⬆️ **MOVED TO MVP 5.7** (right after Physics & Collision)

**Reason for move**: Mobile controls are too important to wait until MVP 7.5. Moving them earlier (right after physics is done) allows for:
- Earlier mobile testing and feedback
- Broader player base before NPCs are needed
- Performance testing on mobile devices early
- Lower barrier to entry for new players

See **MVP 5.7** for full mobile controls implementation details.

---

## 🔐 MVP 8: Player Authentication

**Goal**: Players can save progress and return later

**Why Last?**:
- Core gameplay must be fun first
- Can launch without it (anonymous play works)
- Authentication adds complexity
- Important for retention, not for validation

### Simple Authentication

**Guest Mode** (default):
- Click "Play" to start immediately
- Random display name ("Player 1234")
- Progress saved to session only

**Account Creation** (optional):
- Simple username/password
- Or magic link email (passwordless)
- Progress persists across devices
- Leaderboard shows persistent identity

**Backend**:
- Cloudflare D1 database for user storage
- Or external service (Auth0, Firebase)
- Secure password hashing
- Session management

**Features**:
- Save character preference
- Save total stats (all-time walnuts found)
- Persistent leaderboard rank
- Account recovery (email reset)

---

## 🌍 MVP 9: Advanced Systems (Future)

**Goal**: Enterprise-level features for long-term retention (ONLY after core gameplay is polished)

**Warning**: DO NOT implement until MVPs 1-8 are complete and the game feels AMAZING to play!

### 24-Hour World Cycle

**Persistent World**:
- Forest regenerates every 24 hours
- 100 game walnuts spawn randomly at reset
- Each player gets 3 walnuts on join
- Leaderboard tracks cycle rankings

**Session Management**:
- Join anytime during cycle
- Your walnuts remain when you leave
- Rejoin to continue (same position)
- Cycle countdown timer in UI

**Backend Integration**:
- ForestManager: world state & reset logic
- WalnutRegistry: persistent walnut locations
- PlayerSession: track progress across sessions
- Leaderboard: cycle-based rankings

### Performance Optimization (ONLY if needed)

**LOD System** - Level of Detail
- Distant objects use simpler models
- Reduces polygon count for far terrain
- Improves FPS in dense forest areas

**Object Pooling**:
- Reuse walnut/NPC objects instead of creating new
- Reduces memory allocation/garbage collection
- Smoother performance with many objects

**Occlusion Culling**:
- Don't render objects behind trees/terrain
- Significant FPS boost in forest

**Auto-Quality Adjustment**:
- Detect low FPS
- Automatically reduce quality settings
- Maintain smooth gameplay

**Important**: Only implement performance optimizations if you measure actual FPS problems. Profile first, optimize second!

---

## 📅 Timeline Summary

| MVP | Focus | Status |
|-----|-------|--------|
| 1.5 | Animated Character | ✅ Complete |
| 1.9 | Backend Cleanup | ✅ Complete |
| 2.0 | Multiplayer Foundation | ✅ Complete |
| 3 | Walnut Mechanics + Navigation | ✅ Complete |
| 3.5 | Multiple Characters | ✅ Complete |
| 4 | Competitive Multiplayer | ✅ Complete |
| 5 | Game Feel & Polish | ✅ Complete |
| 5.5 | Physics & Collision Detection | ✅ Complete |
| 5.7 | Mobile/Touch Controls | ✅ Complete |
| 5.8 | **Startup Experience & UX Polish** 🆕 | 🎯 **NEXT** |
| 6 | Code Cleanup | Pending |
| 6.5 | Player Authentication & Identity | Pending |
| 6.7 | NPC Characters & World Life | Pending |
| 6.8 | Advanced Animation Polish | Optional |
| 7 | Predators + Polish | Pending |
| 7.2 | Walnut Combat & Throwing | Pending |
| 7.5 | ~~Mobile/Touch Controls~~ | ⬆️ Moved to 5.7 |
| 8 | ~~Player Authentication~~ | ⬆️ Moved to 6.5 |
| 9 | Advanced Systems (24hr Cycle + Performance) | Future |

---

## 🎯 Success Criteria

### MVP 2.0 Success
- [x] Players connect via WebSocket
- [x] See other players moving smoothly
- [ ] Player name tags visible
- [ ] Connection recovery works

### MVP 3 Success
- [x] Can hide walnuts with H key (context-based: bush vs buried)
- [x] Can find walnuts by clicking
- [x] Basic walnut visuals (mounds, glints, glow for game walnuts)
- [x] Proximity indicators (cursor changes, visual glow within 3 units)
- [x] Cardinal direction landmarks (N/S/E/W colored towers with labels)
- [x] Bush/tree positions synchronized from server (multiplayer-ready)
- [x] Minimap shows player position, other players, and landmarks
- [ ] Grid location system (A1-Z26)
- [ ] Text-based tutorial messages (voice acting in MVP 6.5)

### MVP 4 Success
- [x] Leaderboard tracks top players
- [x] Can steal others' walnuts
- [x] Quick chat works
- [x] Emotes work

### MVP 5 Success (Game Feel & Polish)
- [x] Audio system with sound effects (hide, find, footsteps, ambient)
- [x] Particle effects (bury, find, footsteps, score)
- [x] Score pop-up animations
- [x] **Animated loading screen with walnut GLB model**
- [x] Settings menu with volume controls and controls reference
- [x] Enhanced debug overlay (FPS, memory, latency) - user confirmed done
- [x] Improved walnut visuals (better mound, bush glints, golden glow) - user said "fine for now"
- [x] Better click detection and feedback (increased hitboxes + hover effects)
- [x] Connection status indicator
- [x] Loading progress bar
- [x] Game feels satisfying and polished

### MVP 5.5 Success (Physics & Collision Detection)
- [x] Cannot walk through landmark trees
- [x] Cannot walk through regular forest trees
- [x] Smooth sliding movement around obstacles (no jarring stops)
- [x] Performance remains smooth (60 FPS with many trees)
- [x] Debug visualization available for testing
- [x] Subtle audio/visual feedback on collision (camera shake)

### MVP 5.7 Success (Mobile/Touch Controls)
- [x] Game fully playable on mobile browsers
- [x] Touch controls feel natural and responsive (drag-to-move)
- [x] Can hide walnuts with double-tap
- [x] Can find walnuts with single tap
- [x] Camera controls work (two-finger drag)
- [x] UI optimized for mobile (larger touch targets)
- [x] Performance optimized (disabled shadows/antialiasing on mobile)
- [x] Works in Safari (iOS) and Chrome (Android)
- [x] iPad/tablet support with proper touch detection
- [x] Character stops when touch ends (critical bug fixed)

### MVP 5.8 Success (Startup Experience & UX Polish)
- [ ] Welcome/splash screen shows before loading
- [ ] Single consolidated loading screen (no double load)
- [ ] Progress bar only goes forward (0% → 100%)
- [ ] No second loading after character selection
- [ ] Smooth fade transitions between all screens
- [ ] All assets preloaded before character selection
- [ ] Loading feels professional and polished

### MVP 6.7 Success
- [ ] NPCs spawn and wander around forest
- [ ] NPCs hide and find walnuts occasionally
- [ ] NPCs appear on leaderboard
- [ ] World feels more alive with NPC activity

### MVP 7 Success
- [ ] Predators add challenge
- [ ] Power-ups are fun
- [ ] Audio enhances immersion

### MVP 8 Success
- [ ] Players can create accounts
- [ ] Progress persists across sessions
- [ ] Leaderboard shows persistent identities

### MVP 9 Success (Advanced Systems)
- [ ] 24-hour cycle resets world
- [ ] 100 game walnuts spawn at reset
- [ ] Players can rejoin mid-cycle
- [ ] 60 FPS maintained with many objects (if performance optimization needed)

---

## 🎬 Voice Actor Script Outline

### Narrator Lines (~50 total) - **MVP 3**

**Welcome/Tutorial** (10 lines):
- "Welcome to the Hidden Walnuts forest!"
- "You have 3 walnuts to hide. Choose your spots wisely."
- "Press H near the ground to bury a walnut."
- "Click on suspicious spots to find hidden walnuts."
- "Buried walnuts are worth 3 points, bush walnuts worth 1."
- [... more tutorial lines]

**Achievements** (15 lines):
- "First walnut hidden!"
- "You've found 10 walnuts!"
- "Top of the leaderboard!"
- [... more achievement callouts]

**Events** (15 lines):
- "Nut Rush begins in 5 minutes!"
- "The forest will reset in one hour."
- "A predator has been spotted nearby..."
- [... more event announcements]

**Contextual Tips** (10 lines):
- "This looks like a good hiding spot."
- "Other players are nearby. Be careful!"
- "You've been here before..."
- [... more contextual hints]

### NPC Lines (~30 per character) - **MVP 7** (when NPCs added)

**Squirrel** (friendly, helpful):
- "Good hiding spot!"
- "I saw someone over by the big oak tree."
- "Shhh! Someone's coming!"
- [... more squirrel lines]

**Owl** (wise, mysterious):
- "The forest remembers all secrets..."
- "Patience brings great rewards."
- "Not all that glitters is a walnut..."
- [... more owl lines]

**Chipmunk** (playful, cheeky):
- "Ooh, shiny! Is that yours?"
- "Bet you can't find mine!"
- "Hehe, too slow!"
- [... more chipmunk lines]

---

**Next Step**: Complete MVP 2.0 multiplayer foundation 🚀
