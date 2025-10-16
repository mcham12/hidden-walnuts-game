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

**Goal**: Add 3-5 AI characters to make world feel alive

**Behaviors**:
- **Wander** (70%) - Walk around randomly
- **Rest** (15%) - Idle animation
- **Hide Walnut** (10%) - Hide in bushes/ground
- **Find Walnut** (5%) - Collect visible walnuts

**Characteristics**:
- Name tags: "NPC - [Character]"
- Slower movement than players
- Contribute to leaderboard
- Simple pathfinding (raycasting)

**Balancing**:
- Max 5 NPCs at once
- Don't spawn if 10+ real players online
- Scale down as player count increases

**Success**:
- NPCs spawn and wander
- NPCs hide/find walnuts occasionally
- NPCs on leaderboard
- World feels more alive

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
3-5 AI characters that wander and hide/find walnuts. Makes world feel alive. (TBD)

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
