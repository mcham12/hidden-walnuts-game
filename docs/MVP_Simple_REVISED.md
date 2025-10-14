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

## ✨ MVP 5: Game Feel & Polish

**Goal**: Make the existing gameplay feel AMAZING with audio, visual juice, and quality of life improvements

**Philosophy**: Polish the core experience before adding complex systems

### Audio System 🔊

**Sound Effects**:
- **Walnut Actions**: Hide sound (digging), find sound (success chime)
- **Movement**: Footstep sounds (grass, dirt, leaves)
- **UI Feedback**: Button clicks, score pop sounds
- **Ambient**: Forest background (birds chirping, wind rustling, distant streams)

**Implementation**:
```typescript
class AudioManager {
  playSound(type: 'hide' | 'find' | 'footstep' | 'ui' | 'ambient');
  setVolume(category: 'sfx' | 'ambient' | 'master', level: number);
  toggleMute(): void;
}
```

**Audio Library Options**:
- Howler.js (recommended - simple, powerful)
- Web Audio API (native, more complex)
- THREE.PositionalAudio (for 3D spatial audio)

### Visual Juice ✨

**Particle Effects**:
- **Bury Walnut**: Dirt/soil particles spray up
- **Find Walnut**: Sparkle burst effect
- **Footsteps**: Dust/leaf particles on movement
- **Score**: Confetti/stars on point gain

**Score Feedback**:
- Animated "+3 points!" text pop-up (flies up and fades)
- Screen shake on big finds (subtle, satisfying)
- Player glow effect when scoring
- Score counter animates (number tween)

**Walnut Visual Improvements**:
- Better buried walnut mound (rounded, natural-looking)
- More obvious bush walnuts (better glint effect)
- Enhanced golden walnut glow (pulsing animation)

**Implementation**:
```typescript
class VFXManager {
  spawnParticles(type: 'dirt' | 'sparkle' | 'dust', position: Vector3);
  showScorePopup(points: number, position: Vector3);
  screenShake(intensity: number, duration: number);
  playerGlow(playerId: string, duration: number);
}
```

### Quality of Life 🎮

**Settings Menu**:
- Audio volume sliders (SFX, Ambient, Master)
- Mouse sensitivity control
- Graphics quality toggle (if needed)
- Debug overlay toggle (F key functionality)
- Controls reference

**Better Feedback**:
- Clear error messages (network, loading, etc.)
- Connection status indicator (connected/disconnected/reconnecting)
- Loading progress bar with percentage
- Toast notifications for events

**Tutorial Improvements**:
- Clearer first-time onboarding
- Contextual hints that fade in/out
- Skip tutorial option
- Help menu (H key reference)

**Player Spawn Improvements** (Future):
- Fix player spawn position (currently spawning south of origin despite coordinate updates)
- Investigate coordinate system vs terrain orientation
- Ensure saved positions clear properly on reset
- Consider spawn facing direction (look at origin landmark)

### Bug Fixes & Stability 🐛

**Multiplayer**:
- Fix remaining sync edge cases
- Improve animation transitions
- Better handling of player disconnect/reconnect
- Test with multiple simultaneous players

**Interaction**:
- Improve walnut click detection (larger hitboxes)
- Better raycasting for buried walnuts
- Proximity detection refinement
- Click feedback (cursor change, highlight)

**Performance**:
- Profile current FPS in various scenarios
- Optimize only if needed (measure first!)
- Memory leak checks
- Browser compatibility testing

---

## 🎯 MVP 5.5: Physics & Collision Detection

**Goal**: Add collision detection so players can't walk through trees and obstacles

**Why Now?**:
- **Game feel is broken without it**: Walking through solid objects destroys immersion
- **Before NPCs (MVP 6.7)**: NPCs will need obstacle avoidance and pathfinding
- **Before Predators (MVP 7)**: Chase mechanics require collision
- **Before Code Cleanup (MVP 6)**: Don't clean up code then add more systems

### Core Collision System

**Player vs Landmark Trees**:
- Landmark trees are HUGE (10x scale, East is 17.5x) - should be solid obstacles
- Use simple cylinder colliders around tree trunks
- Player bounces/slides around trees smoothly

**Player vs Regular Forest Trees**:
- Regular trees from ForestManager also need collision
- Smaller cylinder colliders (scale with tree size)
- Bushes might be passable or have smaller collision

**Player vs Terrain**:
- Already have terrain height detection (getTerrainHeight)
- Add steep slope detection (prevent climbing cliffs)
- Optional: Add rocks/boulders as solid obstacles

**Player vs Other Players** (Optional):
- Light collision (can push through slightly)
- Prevents players stacking exactly on top of each other
- Soft collision feels better than hard blocking

### Technical Implementation

**Collision Library Options**:
```typescript
// Option 1: cannon-es (full physics engine)
// PRO: Complete physics, realistic collisions
// CON: Heavier, more complex

// Option 2: Three.js Raycasting (manual collision)
// PRO: Lightweight, full control
// CON: More code to write

// Option 3: rapier (Rust-based, very fast)
// PRO: Excellent performance
// CON: WebAssembly dependency
```

**Recommended: Start with Three.js Raycasting**
```typescript
class CollisionSystem {
  private colliders: THREE.Mesh[] = [];

  // Add collider for each landmark/tree
  addCollider(position: Vector3, radius: number, height: number) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height);
    const collider = new THREE.Mesh(geometry);
    collider.position.copy(position);
    collider.visible = false; // Invisible collision geometry
    this.colliders.push(collider);
  }

  // Check if player movement would hit a collider
  checkCollision(from: Vector3, to: Vector3): boolean {
    const direction = to.clone().sub(from).normalize();
    const raycaster = new THREE.Raycaster(from, direction);
    const intersects = raycaster.intersectObjects(this.colliders);
    return intersects.length > 0 && intersects[0].distance < from.distanceTo(to);
  }

  // Slide player around obstacle
  resolveCollision(from: Vector3, to: Vector3): Vector3 {
    // If collision detected, calculate slide vector
    // Return adjusted position that slides around obstacle
  }
}
```

### Visual Feedback

**Debug Visualization** (for development):
- Show collision cylinders (wireframe)
- Highlight active collisions (red when blocked)
- Toggle with debug overlay (F key)

**Player Feedback**:
- Subtle "bump" sound when hitting tree
- Brief camera shake on hard collision
- Movement feels smooth (no jarring stops)

### Performance Considerations

**Spatial Partitioning**:
- Only check collisions for nearby objects
- Use grid-based partitioning (divide world into chunks)
- Don't check collisions with trees 50+ units away

**Optimization**:
```typescript
// Only check collisions within player's local area
const COLLISION_CHECK_RADIUS = 20; // units

checkNearbyCollisions(playerPos: Vector3) {
  const nearbyColliders = this.colliders.filter(c =>
    c.position.distanceTo(playerPos) < COLLISION_CHECK_RADIUS
  );
  // Only raycast against nearby colliders
}
```

### Success Criteria

- [ ] Cannot walk through landmark trees
- [ ] Cannot walk through regular forest trees
- [ ] Smooth sliding movement around obstacles (no jarring stops)
- [ ] Performance remains smooth (60 FPS with many trees)
- [ ] Debug visualization available for testing
- [ ] Optional: Subtle audio/visual feedback on collision

### What's Saved for Later

**Advanced Physics** (not needed now):
- Full rigid body physics
- Character controller with acceleration/momentum
- Jumping with gravity
- Climbing mechanics

**Complex Collision Shapes** (keep it simple):
- Per-triangle mesh collision
- Convex hull colliders
- Heightmap terrain collision (we have height function already)

---

## 📱 MVP 5.7: Mobile/Touch Controls

**Goal**: Make the game playable on mobile browsers (iPhone, iPad, Android)

**Why Now?** (Moved up from MVP 7.5)
- **Massive market**: Mobile browsers are 50%+ of potential players
- **Early testing**: Get mobile UX feedback while we can still iterate
- **Real players > NPCs**: Could bring enough real players that NPCs (6.7) aren't as critical
- **Performance insights**: Discover mobile performance issues early
- **Accessibility**: Lower barrier to entry - no keyboard/mouse needed
- **Shareability**: Easier to share link and play immediately on phone

### Touch Control System

**Virtual Joystick** - Left side of screen
- Drag to move in any direction
- Release to stop
- Visual feedback (joystick circle + thumb indicator)

**Action Buttons** - Right side of screen
- **H Button**: Hide walnut (large button, bottom-right)
- **Tap on Walnut**: Find/collect walnut
- **Camera Control**: Two-finger drag to rotate camera

**Touch Gestures**:
- **Single Tap**: Click to find walnut / interact with objects
- **Drag (single finger)**: Control virtual joystick for movement
- **Two-finger Drag**: Rotate camera view
- **Pinch**: Zoom in/out (optional camera control)

**UI Considerations**:
- Buttons sized for touch (minimum 44x44pt for iOS)
- Semi-transparent so they don't block gameplay
- Position adjustable in settings (left-handed mode)
- Auto-hide when not in use (fade out after 3s of no input)

**Platform Detection**:
```typescript
// Detect mobile and show touch controls
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent) ||
                 ('ontouchstart' in window);
if (isMobile) {
  this.showTouchControls();
}
```

**Technical Implementation**:
```typescript
class TouchControls {
  private joystick: VirtualJoystick;
  private actionButtons: HTMLElement[];

  // Virtual joystick for movement
  initJoystick(container: HTMLElement) {
    // Create joystick base and thumb
    // Track touch start, move, end
    // Convert to WASD-equivalent inputs
  }

  // Action button (Hide walnut)
  createButton(label: string, action: () => void) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('touchstart', action);
    return button;
  }

  // Camera controls (two-finger drag)
  initCameraControls() {
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        // Calculate rotation from two-finger drag
        this.rotateCamera(delta);
      }
    });
  }
}
```

**Library Options**:
- **nipplejs**: Popular virtual joystick library (lightweight)
- **Custom HTML5 touch**: Full control, no dependencies
- **three.js OrbitControls**: Has mobile support built-in

### Mobile Optimizations

**Performance**:
- Lower default graphics quality on mobile
- Reduce particle counts
- Optimize shadow rendering
- Test on real devices (iPhone, Android)

**UI Adjustments**:
- Larger touch targets
- Simplified HUD on smaller screens
- Responsive layout (portrait and landscape)
- Font sizes readable on mobile

**Testing Checklist**:
- [ ] Virtual joystick works smoothly
- [ ] Can hide walnuts with touch button
- [ ] Can find walnuts with tap
- [ ] Camera controls feel natural (two-finger drag)
- [ ] UI elements don't overlap
- [ ] Performance is smooth (30+ FPS on mid-range phones)
- [ ] Works in Safari (iOS) and Chrome (Android)

### Success Criteria
- [ ] Game fully playable on mobile browsers
- [ ] Touch controls feel natural and responsive
- [ ] No keyboard/mouse required
- [ ] Performance acceptable on mobile devices
- [ ] UI readable and touch-friendly

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
| 5 | **Game Feel & Polish** | 🎯 **CURRENT** |
| 5.5 | **Physics & Collision Detection** 🆕 | **Critical!** |
| 5.7 | **Mobile/Touch Controls** ⬆️🆕 | **Moved Up!** |
| 6 | Code Cleanup | Pending |
| 6.5 | **Player Authentication** ⬆️ | **Moved Up!** |
| 6.7 | **NPC Characters & World Life** ⬆️🆕 | **Moved Up!** |
| 6.8 | Advanced Animation Polish | Optional |
| 7 | Predators + Polish | Pending |
| 7.2 | **Walnut Combat & Throwing** 🆕 | **New!** |
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
- [ ] Cannot walk through landmark trees
- [ ] Cannot walk through regular forest trees
- [ ] Smooth sliding movement around obstacles (no jarring stops)
- [ ] Performance remains smooth (60 FPS with many trees)
- [ ] Debug visualization available for testing
- [ ] Optional: Subtle audio/visual feedback on collision

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

### Future: Startup Experience Improvements (Post-MVP 5.7)
**Issues to Address**:
- [ ] No welcome screen (jumps straight to loading)
- [ ] Minimap outline visible on character selection screen (bug)
- [ ] Double loading screen (once for preview, once for game)
- [ ] Progress bar goes backwards on second load (bug)
- [ ] Loading experience feels janky and unprofessional

**Planned Improvements**:
- [ ] Add proper welcome/splash screen before loading
- [ ] Hide minimap until game starts (not on char select)
- [ ] Eliminate double loading screen (load assets once)
- [ ] Fix progress bar direction (should only go forward)
- [ ] Add smooth transitions between screens
- [ ] Optimize asset loading pipeline

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
