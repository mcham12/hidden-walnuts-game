# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: Multiplayer foundation complete with smooth animations ✅

---

## 📋 Table of Contents
- [Completed Work](#completed-work)
- [Current Work: MVP 2.0](#mvp-20-multiplayer-foundation)
- [Upcoming MVPs](#upcoming-mvps)
- [Timeline Summary](#timeline-summary)

---

## ✅ Completed Work

### MVP 1.5: Animated Character System
- 3D forest terrain with procedural generation
- Colobus character with idle/walk/run/jump animations
- WASD movement + camera following + physics
- Smooth animation transitions and movement

### MVP 1.9: Backend Simplification
- Simplified Cloudflare Workers architecture
- Basic Durable Objects (ForestManager, WalnutRegistry, Leaderboard)
- WebSocket connections working
- Production-ready with CORS fixes

---

## 🎯 MVP 2.0: Multiplayer Foundation

**Goal**: Multiple players can see each other moving in real-time

**Status**: IN PROGRESS

### Core Features
✅ WebSocket connections
✅ Basic player position sync
✅ Smooth animation synchronization
⏳ Player identification UI
⏳ Loading states & error handling
⏳ Connection recovery

### NEW: Player Identification System
**Player Name Tags** - Floating UI above each character
```typescript
// Display name tag above player with unique icon/badge
interface PlayerTag {
  playerId: string;
  displayName: string;  // "Player 1", "Player 2", or custom name
  iconShape: 'circle' | 'square' | 'triangle';  // Unique visual marker
  tagColor: string;     // Background color for tag (not character)
}
```

**UI Features**:
- Floating name tag above character (always facing camera)
- Small icon/shape next to name (circle, square, triangle, star)
- Clean, minimal design (semi-transparent background)
- Distance-based scaling (smaller when far away)

### NEW: Loading & Error States
- **Loading Screen**: Progress bar while assets load
- **Connection Status**: Visual indicator (connected/disconnected)
- **Reconnection**: Automatic retry with user feedback
- **Error Messages**: Clear notifications for network issues

---

## 🥜 MVP 3: Core Walnut Mechanics

**Goal**: Players can hide and find walnuts with proper game rules

### Part 1: Walnut Interaction (Week 1)

**Hiding Walnuts** - Press H key
```typescript
private onHideWalnut() {
  if (this.playerWalnuts > 0) {
    this.setAction('eat');  // Digging animation
    const walnut = this.createWalnut(this.character.position, 'buried');
    this.sendWalnutHide(walnut);
    this.playerWalnuts--;
  }
}
```

**Finding Walnuts** - Click on walnut
```typescript
private onMouseClick(event: MouseEvent) {
  const walnut = this.getWalnutAtPosition(mousePos);
  if (walnut && this.isNearPlayer(walnut.position)) {
    this.setAction('bounce');  // Excited animation
    this.collectWalnut(walnut);
    this.score += walnut.points;
  }
}
```

**Walnut Types & Visual Indicators**:

**1. Buried Walnuts** (3 points - harder to find)
- **Visual Clue**: Small mound of disturbed earth
  - Slightly raised terrain bump (subtle, 0.1 units high)
  - Darker soil texture where dug
  - Particle effect: tiny dirt particles occasionally puff up
  - Proximity hint: Cursor changes when hovering over area
- **Finding**: Click on mound when within 2 units
- **Difficulty**: Subtle - requires careful exploration

**2. Bush Walnuts** (1 point - easier to spot)
- **Visual Clue**: Walnut partially visible in bush foliage
  - Brown walnut shell peeking through leaves
  - Subtle glint/shimmer effect (catches light)
  - Bush leaves slightly disturbed/parted
  - Proximity hint: Cursor highlights when hovering
- **Finding**: Click on visible walnut
- **Difficulty**: Easier - visually obvious when near bush

**3. Game Walnuts** (Special bonus multiplier)
- **Visual Clue**: Golden/glowing walnut
  - Bright golden color (stands out)
  - Gentle pulsing glow effect
  - Sparkle particles around it
  - Visible from greater distance
- **Finding**: Click to collect
- **Difficulty**: Very easy - meant to be found quickly

**Detection System**:
```typescript
// Raycasting for walnut detection
interface WalnutDetection {
  // Visual feedback when player looks at walnut area
  cursorHighlight: boolean;      // Change cursor to "hand" icon
  proximityGlow: boolean;         // Faint glow when within 3 units
  soundCue: 'rustle' | 'none';   // Audio hint when very close
}
```

**Proximity Indicators** (help players know they're close):
- **Very Close** (< 1 unit): Walnut outline appears through terrain/bush
- **Close** (< 3 units): Cursor changes to search icon
- **Medium** (< 5 units): Subtle audio cue (leaves rustling for bush, dirt shifting for buried)
- **Far** (> 5 units): No indicators (pure exploration)

### Part 2: World Navigation (Week 1)

**Navigation Landmarks** - Help players orient themselves
- Colored stone towers at cardinal directions (North, South, East, West)
- Unique rock formations (arch, pillar, cluster)
- Special trees with ribbons/markers
- Spawn point beacon (always visible "home")

**Grid Location System** - A1 to Z26 coordinate grid
- Simple A1-style grid overlay on minimap
- Location shown in corner of screen ("Current: M12")
- Makes it easier to communicate locations

**Minimap** - Corner of screen
- Shows player positions (friendly dots)
- Landmarks marked
- Grid lines visible

### Part 3: Basic HUD (Week 1)

**Player Information Display**:
- Walnut inventory count (e.g., "Walnuts: 3")
- Current score
- Controls reminder (togglable with F key)
- Current location grid (e.g., "Location: M12")

### Part 4: Walnut Persistence (Week 2)

**Server Integration**:
```typescript
interface WalnutMessage {
  type: 'HIDE_WALNUT' | 'FIND_WALNUT';
  walnutId: string;
  position: Vector3;
  walnutType: 'buried' | 'bush';
  playerId: string;
}
```

**Persistence Features**:
- Walnuts remain after players leave
- Server validates walnut positions (anti-cheat)
- Walnut ownership tracking
- WalnutRegistry Durable Object integration

### Part 5: Text-Based Tutorial System (MVP 3 Foundation)

**Tutorial Messages** - Guide players with text overlays
- Welcome message: "Welcome to the Hidden Walnuts! You have 3 walnuts to hide..."
- Tutorial tips: "Press H to hide a walnut..." "Click to collect walnuts..."
- Achievement callouts: "First walnut hidden!" "10 walnuts found!"
- Event announcements: "New walnut available!"

**Technical Implementation**:
```typescript
class TutorialSystem {
  showMessage(event: 'welcome' | 'tutorial' | 'achievement' | 'hint', text: string);
  // Simple text overlay - temporary display with fade out
}
```

**Note**: Voice acting for narrator and NPCs moved to **MVP 6.5** (optional polish)

---

## 🏆 MVP 3.5: Multiple Character Selection

**Goal**: Players can choose from 2-3 different characters (visual variety only)

### Simple Character Selection

**Available Characters** (8 total - no unique abilities yet):
1. **Colobus** (monkey) ✅ Already implemented
2. **Muskrat** (rodent) - Forest/walnut theme
3. **Pudu** (small deer) - Forest dweller
4. **Gecko** (lizard) - Agile climber
5. **Sparrow** (bird) - Aerial character
6. **Taipan** (snake) - Ground movement
7. **Herring** (fish) - Aquatic (save for water mechanics)
8. **Inkfish** (octopus) - Aquatic (save for water mechanics)

**Initial MVP 3.5 Release** (land-based only):
- Start with 3-4 land characters: Colobus, Muskrat, Pudu, Gecko
- Same movement/physics for all
- Same animations (idle/walk/run/jump)
- Save aquatic characters (Herring, Inkfish) for water mechanics later

**Character Select Screen**:
- Simple grid showing available characters
- Click to preview character
- Confirm selection before joining game

**Why Now?**:
- Character assets already exist
- Low implementation effort
- Increases player engagement
- Players can express preference

**What's Saved for Later**:
- Unique character abilities
- Character unlocks/progression
- Full 8-character roster
- Ability-based balancing

---

## 👥 MVP 4: Competitive Multiplayer

**Goal**: Full competitive multiplayer with leaderboards

### Competitive Features

**Walnut Stealing**:
- Find other players' hidden walnuts
- Collect them for points
- Re-hide them in new locations

**Real-time Leaderboard**:
```typescript
interface GameScore {
  playerId: string;
  displayName: string;
  score: number;
  walnuts Hidden: number;
  walnutsFound: number;
  timeMultiplier: number;  // 1.1x to 2x based on play time
}
```

**Leaderboard UI**:
- Top 10 players visible
- Your current rank highlighted
- Live updates as scores change
- 24-hour cycle stats

**Competition Balance**:
- Proximity rules (can't hide/find too close to other players)
- Fresh player boost (catch-up mechanic for late joiners)
- Time multiplier rewards (longer play = higher multiplier)

### NEW: Communication System

**Quick Chat** - Predefined messages
- "Nice find!"
- "Over here!"
- "Good hiding spot!"
- "Want to team up?"

**Emotes** - Character gestures
- Wave
- Point
- Celebrate
- Shrug

### Tutorial & Onboarding

**First-Time Player Guide**:
- 5-step interactive tutorial
- Shows controls (WASD, H, mouse)
- Explains walnut hiding/finding
- Teaches scoring system
- Optional skip for experienced players

**In-Game Hints**:
- Context-sensitive tips
- Appears when relevant (e.g., "Press H to hide" when near good spot)
- Can be disabled in settings

---

## 🌍 MVP 5: Persistent 24-Hour World

**Goal**: World resets every 24 hours with persistent player progress

### World Persistence

**24-Hour Cycle**:
- Forest regenerates at reset
- 100 game walnuts spawn randomly
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

### NEW: Performance Optimization

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

## 🎨 MVP 6.5: Advanced Animation & Visual Polish (Optional)

**Goal**: AAA-quality animation smoothness and visual refinements

**Status**: Current implementation is good enough for gameplay. This is optional polish.

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
- **Narrator Voiceover System** - Record and implement voice-acted tutorial and achievement callouts
  - ~50 narrator lines (calm, guiding voice)
  - Tutorial/onboarding, game state announcements, achievement unlocks, contextual tips
  - Simple audio playback triggered by game events
- **NPC Voiceovers** - Squirrel, Owl, Chipmunk character voices (added in MVP 7 with ambient NPCs)
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

### NEW: Ambient NPCs

**Non-Interactive NPCs** - Add life to forest
- Birds flying overhead
- Squirrels running on branches
- Deer grazing in clearings
- Butterflies near flowers

**Purpose**:
- Make world feel alive
- Atmospheric immersion
- Not game-critical (purely visual)

**Voiceover Integration**:
- **NPC Voiceovers Added Here** - Squirrel, Owl, Chipmunk voices
  - Position-based audio (quieter when far from NPC)
  - Ambient comments as players pass by
  - Contextual hints about nearby walnuts
- Narrator event announcements (continues from MVP 3)
- Predator warning callouts

---

## 📱 MVP 7.5: Mobile/Touch Controls

**Goal**: Make the game playable on iPhone/iPad without keyboard

### Touch Control System

**Virtual Joystick** - Left side of screen
- Drag to move in any direction
- Release to stop
- Visual feedback (joystick circle + thumb indicator)

**Action Buttons** - Right side of screen
- **H Button**: Hide walnut (large button, bottom-right)
- **Jump Button**: Space equivalent (if needed)
- **Camera Control**: Two-finger drag to rotate camera (optional)

**Touch Gestures**:
- **Single Tap**: Click to find walnut / interact with objects
- **Long Press**: Alternate hide action (if near bush)
- **Pinch**: Zoom in/out (optional camera control)

**UI Considerations**:
- Buttons sized for touch (minimum 44x44pt for iOS)
- Semi-transparent so they don't block gameplay
- Position adjustable in settings (left-handed mode)
- Auto-hide when not in use (fade out after 3s of no input)

**Platform Detection**:
```typescript
// Detect mobile and show touch controls
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
if (isMobile) {
  this.showTouchControls();
}
```

**Technical Implementation**:
- HTML5 touch events (touchstart, touchmove, touchend)
- Virtual joystick library or custom implementation
- Separate control layer (doesn't interfere with game canvas)
- Responsive layout (adapts to portrait/landscape)

**Why Important**:
- Huge potential playerbase on mobile
- Many players prefer casual mobile gaming
- Touch controls are expected on iOS/Android
- Increases accessibility and reach

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

## 📅 Timeline Summary

| MVP | Focus | Status |
|-----|-------|--------|
| 1.5 | Animated Character | ✅ Complete |
| 1.9 | Backend Cleanup | ✅ Complete |
| 2.0 | Multiplayer Foundation | ✅ Complete |
| 3 | Walnut Mechanics + Navigation + Narrator | 🎯 Starting |
| 3.5 | Multiple Characters | Pending |
| 4 | Competitive Multiplayer + Tutorial | Pending |
| 5 | Persistent World + Performance | Pending |
| 6 | Code Cleanup | Pending |
| 6.5 | Animation Polish | Optional |
| 7 | Predators + NPCs + Polish | Pending |
| 7.5 | Mobile/Touch Controls | Pending |
| 8 | Player Authentication | Pending |

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
- [ ] Leaderboard tracks top players
- [ ] Can steal others' walnuts
- [ ] Tutorial teaches new players
- [ ] Quick chat works

### MVP 5 Success
- [ ] 24-hour cycle resets world
- [ ] 60 FPS maintained with many objects
- [ ] Players can rejoin mid-cycle

### MVP 7 Success
- [ ] Predators add challenge
- [ ] Power-ups are fun
- [ ] Audio enhances immersion
- [ ] Ambient NPCs add atmosphere

### MVP 8 Success
- [ ] Players can create accounts
- [ ] Progress persists across sessions
- [ ] Leaderboard shows persistent identities

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
