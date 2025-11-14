# Hidden Walnuts - Project Structure

**Last Updated**: MVP 16 (Authentication & Character System)

This document provides a comprehensive guide to the Hidden Walnuts game project structure, detailing the architecture, file organization, and key components of both client and server code.

## Overview

Hidden Walnuts is a **production-ready multiplayer 3D browser game** built entirely on Cloudflare's edge platform:
- **Client**: Vite + TypeScript + Three.js (deployed to Cloudflare Pages)
- **Server**: Cloudflare Workers + Durable Objects (WebSocket-based multiplayer)
- **Assets**: GLTF 3D models, animations, textures, sounds

## Root Directory Structure

```
hidden-walnuts-game/
├── client/                 # Three.js game client (47+ TypeScript files)
├── workers/                # Cloudflare Workers backend (5 Durable Objects)
├── public/                 # Shared 3D assets (models, sounds, textures)
├── docs/                   # Comprehensive documentation
├── .github/workflows/      # GitHub Actions (auto-deploy)
├── package.json            # Root scripts and workspace configuration
├── wrangler.toml           # Cloudflare Workers configuration
└── README.md               # Project overview
```

---

## Client Architecture (`client/`)

### Directory Structure

```
client/
├── src/
│   ├── main.ts                     # Application bootstrap (457 lines)
│   ├── Game.ts                     # Core game engine (8,349 lines)
│   ├── WelcomeScreen.ts            # Login/guest flow (596 lines)
│   │
│   ├── components/                 # UI Components
│   │   ├── AuthModal.ts            # Authentication screens (800+ lines)
│   │   ├── LoginForm.ts            # Email/password login
│   │   ├── SignupForm.ts           # Account creation
│   │   ├── ForgotPasswordForm.ts   # Password reset request
│   │   ├── ResetPasswordForm.ts    # Password reset completion
│   │   ├── CharacterGrid.ts        # Character selection UI (400+ lines)
│   │   ├── CharacterCard.ts        # Individual character display
│   │   ├── CharacterPreview3D.ts   # 3D character rotation viewer
│   │   ├── CharacterPreviewModal.ts # Fullscreen character preview
│   │   ├── LoadingOverlay.ts       # Progress bar during game load
│   │   ├── TutorialOverlay.ts      # First-time player guide (400+ lines)
│   │   └── DeathScreen.ts          # Player elimination UI
│   │
│   ├── systems/                    # Game Systems (ECS-style)
│   │   ├── NetworkSystem.ts        # WebSocket multiplayer (1,200+ lines)
│   │   ├── InputSystem.ts          # Keyboard/mouse/touch input
│   │   ├── InterpolationSystem.ts  # Smooth remote player movement
│   │   ├── ClientPredictionSystem.ts # Local movement prediction
│   │   ├── PlayerManager.ts        # Remote player entity management
│   │   ├── NetworkTickSystem.ts    # 50Hz network update loop
│   │   ├── AreaOfInterestSystem.ts # Spatial culling
│   │   └── CollisionSystem.ts      # Physics collision detection (400+ lines)
│   │
│   ├── services/                   # Shared Services
│   │   ├── AuthService.ts          # JWT authentication (399 lines)
│   │   ├── SessionManager.ts       # Session token persistence (120 lines)
│   │   ├── CharacterRegistry.ts    # Character definitions (302 lines)
│   │   ├── CharacterModelLoader.ts # GLTF model loading & caching
│   │   ├── EnticementService.ts    # Player retention prompts
│   │   └── WebSocketService.ts     # WebSocket connection management
│   │
│   ├── managers/                   # Game Managers
│   │   ├── AudioManager.ts         # Sound effects & music (Howler.js)
│   │   ├── SettingsManager.ts      # User settings UI (400+ lines)
│   │   ├── TipsManager.ts          # Contextual gameplay tips (300+ lines)
│   │   ├── VFXManager.ts           # Particle effects (400+ lines)
│   │   ├── ProjectileManager.ts    # Walnut throwing physics (700+ lines)
│   │   └── OverlayManager.ts       # UI overlay coordination
│   │
│   ├── ui/                         # HUD & In-Game UI
│   │   ├── initLeaderboard.ts      # Leaderboard display (weekly/alltime)
│   │   ├── initChatAndEmotes.ts    # Chat messages & emote buttons
│   │   └── initSettingsMenu.ts     # Settings panel initialization
│   │
│   ├── world/                      # 3D World Generation
│   │   ├── terrain.ts              # Procedural terrain (Perlin noise)
│   │   ├── forest.ts               # Trees, shrubs, rocks placement
│   │   └── heightfield.ts          # Terrain height optimization
│   │
│   ├── controls/                   # Input Handlers
│   │   └── TouchControls.ts        # Mobile touch controls (400+ lines)
│   │
│   └── validation/                 # Client-Side Validation
│       └── validation.ts           # Email, password, username validation
│
├── public/                         # Static Assets
│   ├── models/                     # 3D GLTF models
│   ├── textures/                   # Terrain & character textures
│   └── sounds/                     # Audio files
│
├── dist/                           # Build output (generated)
├── index.html                      # HTML entry point
├── vite.config.ts                  # Vite build configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # Dependencies
├── .env.development                # Local dev API URL
├── .env.preview                    # Preview deployment API URL
└── .env.production                 # Production API URL
```

### Key Client Files

#### **`main.ts`** - Application Bootstrap (457 lines)
**Path**: `/client/src/main.ts`

Entry point that orchestrates game initialization:

```typescript
// Initialization Flow
1. Load character registry
2. Restore authentication session (JWT tokens)
3. Start token refresh timer (auto-renew every 25 days)
4. Determine username flow:
   - Returning user → Show "Welcome Back"
   - New user → Show username input + Turnstile
   - Private browsing → Guest mode
5. Character selection:
   - Guest → Auto-assign Squirrel
   - Auth + saved character → Skip selection
   - Auth + no character → Show CharacterGrid
6. Initialize Game engine
7. Connect to WebSocket (with Turnstile token)
8. Show loading overlay with progress
9. Render first frames
10. Hide loading, start gameplay
```

**Key Features**:
- Turnstile bot verification before WebSocket connection
- Two-overlay architecture (WelcomeScreen → LoadingOverlay)
- Private browsing support (localStorage fallback)
- Audio context unlocking (iOS Safari compatibility)

#### **`Game.ts`** - Core Engine (8,349 lines)
**Path**: `/client/src/Game.ts`

Monolithic game engine containing:

**Scene Setup**:
- Three.js scene, camera (PerspectiveCamera, 60° FOV), WebGL renderer
- 400×400 unit procedural terrain with height-based colors
- Ambient + directional lighting
- Shadow mapping for characters and objects

**Character System**:
- GLTF model loading with static cache (prevents duplicate fetches)
- Animation mixer with state machine (idle → walk → run → attack → death)
- Idle animation variants (idle_a, idle_b, idle_c) for natural behavior
- Per-character scale multipliers (Squirrel=1.0, Badger=2.5, etc.)
- 10 playable characters (6 free auth, 4 premium)

**Movement Physics**:
- Velocity-based acceleration (20 units/s²) and deceleration (15 units/s²)
- Normal move speed: 5 units/second
- Rotation speed: 72°/second (Math.PI/2.5)
- Raycasting ground detection (terrain-following feet placement)
- Soft world boundaries (200-unit radius push-back)

**Multiplayer Entity Management**:
- Remote player interpolation buffer (stores 5-10 frames)
- Velocity extrapolation for prediction between server updates
- Quaternion slerp for smooth rotation
- Position sync at 50 Hz (20ms intervals)

**Render Loop (60 FPS)**:
```typescript
requestAnimationFrame() {
  1. Update animation mixer (state transitions)
  2. Process input (WASD, touch drag)
  3. Apply acceleration/deceleration
  4. Raycast ground detection
  5. Interpolate remote players
  6. Update camera position (smooth follow)
  7. Collision checks (30-unit radius)
  8. Render scene
}
```

**WebSocket Message Handling**:
- `player-join`: Spawn new player mesh
- `player-update`: Update position/rotation
- `walnut-spawn`: Add walnut to scene
- `walnut-found`: Play find animation + score popup
- `projectile-throw`: Spawn projectile with physics
- `health-update`: Update health bar
- `player-disconnect`: Remove player mesh

#### **`WelcomeScreen.ts`** - Login/Guest Flow (596 lines)
**Path**: `/client/src/WelcomeScreen.ts`

Handles authentication and guest entry:

**Features**:
- 3D Squirrel preview (rotating, idle animation)
- Turnstile bot protection widget (production vs testing keys)
- Username input field (max 20 characters)
- "PLAY AS GUEST" button (disabled until Turnstile verified)
- "Sign Up Free" / "Log In" buttons → AuthModal
- Welcome Back message for returning users (2s auto-continue)

**MVP 16 Fix**:
- Waits for Turnstile verification before showing "Welcome Back"
- Prevents destroying Turnstile widget prematurely
- 10-second timeout fallback (prevents hanging)

**Mobile Responsive**:
- Desktop: Centered card layout
- Mobile: Full-screen, auto-focus input
- Decorative floating leaves

#### **`AuthModal.ts`** - Authentication UI (800+ lines)
**Path**: `/client/src/components/AuthModal.ts`

Multi-screen authentication modal:

**Screens**:
1. **Signup**: Email, username, password + strength indicator
2. **Login**: Email, password + "Remember me" checkbox
3. **Forgot Password**: Email field + reset email request
4. **Reset Password**: New password with token validation
5. **Verify Email**: Email verification landing page

**Features**:
- Form validation (email format, password strength, username uniqueness)
- Error display with red highlights
- Loading spinners during API calls
- Enter-to-submit keyboard support
- Responsive design (600px desktop, full-screen mobile)
- Auto-dismiss on successful auth

#### **`CharacterGrid.ts`** - Character Selection (400+ lines)
**Path**: `/client/src/components/CharacterGrid.ts`

Responsive grid showing all available characters:

**Layout**:
- Desktop (1025px+): 4×3 grid
- iPad Portrait: 3×4 grid
- iPad Landscape: 4×3 grid
- iPhone (≤430px): 2×6 grid (vertical scroll)
- iPhone Landscape: Horizontal scroll

**Features**:
- Character cards with name, tier (Guest/Free/Premium), price
- Click card → 3D preview modal → Select button
- CTA banner for unauthenticated users ("Sign up for 6 FREE characters!")
- Premium character purchase flow (future: $1.99 per character)

#### **`NetworkSystem.ts`** - Multiplayer (1,200+ lines)
**Path**: `/client/src/systems/NetworkSystem.ts`

WebSocket-based multiplayer synchronization:

**Connection**:
```typescript
URL: wss://server/ws?username={username}&characterId={characterId}
     &sessionToken={token}&turnstileToken={token}&accessToken={jwt}
```

**Message Protocol**:
```typescript
// Send (Client → Server, 50 Hz)
{ type: 'player_update', position: {x,y,z}, rotationY, characterId, timestamp }

// Receive (Server → Client)
{ type: 'player_joined', squirrelId, position, characterId }
{ type: 'player_update', squirrelId, position, rotationY }
{ type: 'player_left', squirrelId }
{ type: 'heartbeat', timestamp }  // Every 30s for latency measurement
```

**Interpolation**:
- Stores position history buffer (5-10 frames)
- Interpolates between buffered positions for smooth 60 FPS visuals
- Uses velocity for prediction between server updates
- Quaternion slerp for rotation smoothness

**Auto-Reconnection**:
- Max 10 reconnection attempts
- Retry interval: 5 seconds
- On reconnect: Re-authenticate, request full state, re-add players

#### **`AudioManager.ts`** - Sound System
**Path**: `/client/src/managers/AudioManager.ts`

Howler.js-based audio engine:

**Volume Categories**:
- `sfx`: 0.7 (sound effects)
- `ambient`: 0.5 (background loops)
- `music`: 0.4 (game music)
- `master`: 1.0 (master volume)

**Sounds** (28 total):
- **Actions**: hide, find, throw_walnut, walnut_hit, walnut_miss, walnut_found, walnut_eat
- **Movement**: footstep_grass, footstep_dirt, footstep_leaves, walking, jump
- **Combat**: player_death, player_collision, player_eliminated
- **Predators**: flying_predator_nearby, flying_predator_attack, ground_predator_nearby, ground_predator_attack
- **UI**: button_click, chat_send, chat_receive, emote_send, emote_receive, score_pop
- **World**: tree_growth, health_boost, find_big
- **Music**: game_music (ambient forest theme), ambient_forest

**iOS Handling**:
- `unlock()` method plays silent sound to initialize AudioContext
- Called before `startBackgroundAudio()` (iOS Safari requirement)

#### **`CharacterRegistry.ts`** - Character Definitions (302 lines)
**Path**: `/client/src/services/CharacterRegistry.ts`

Centralized character data:

**Character Tiers**:
- `no-auth`: Squirrel (guest only)
- `free`: Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard (authenticated)
- `premium`: Lynx, Bear, Moose, Badger ($1.99 each)
- `future`: Skunk (seasonal, not yet released)

**Character Definition**:
```typescript
{
  id: string,                 // 'squirrel', 'hare', etc.
  name: string,               // Display name
  tier: CharacterTier,
  modelPath: string,          // '/models/characters/squirrel.glb'
  animations: {               // Animation file paths
    idle: string,
    idle_b?: string,
    idle_c?: string,
    walk: string,
    run: string,
    attack?: string,
    death?: string,
    ...
  },
  scale: number,              // 1.0 (Squirrel) to 2.5 (Badger)
  category: 'mammal' | 'bird' | 'reptile' | 'aquatic'
}
```

**Key Methods**:
- `isCharacterAvailable(charId, isAuth, unlocked)` - Check tier-based access
- `getAvailableCharacters(isAuth, unlocked)` - Filter by auth status
- `validateCharacter(charId, animations)` - Ensure animations exist

---

## Server Architecture (`workers/`)

### Directory Structure

```
workers/
├── api.ts                     # Main Worker entry point (routing)
│
├── objects/                   # Durable Objects
│   ├── ForestManager.ts       # World state & WebSocket hub (129 KB)
│   ├── PlayerIdentity.ts      # Authentication & identity (33 KB)
│   ├── Leaderboard.ts         # Scoring & rankings (22 KB)
│   ├── WalnutRegistry.ts      # Walnut storage (7.3 KB)
│   ├── SquirrelSession.ts     # Player session state (11 KB)
│   ├── NPCManager.ts          # NPC AI logic (36 KB)
│   └── PredatorManager.ts     # Predator AI logic (24 KB)
│
├── shared/                    # Shared Code
│   ├── PlayerRanks.ts         # Rank/title system (Rookie → Legend)
│   ├── constants.ts           # Game constants & anti-cheat values
│   ├── Logger.ts              # Structured logging
│   └── types.ts               # TypeScript interfaces
│
├── utils/                     # Utilities
│   ├── PasswordUtils.ts       # Bcrypt hashing, validation
│   ├── EmailService.ts        # SMTP email sending
│   ├── AuthMiddleware.ts      # JWT verification middleware
│   └── JWTUtils.ts            # JWT token generation/validation
│
├── dist/                      # Build output (generated)
├── wrangler.toml              # Worker configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies
```

### Key Server Files

#### **`api.ts`** - Worker Entry Point
**Path**: `/workers/api.ts`

Main request router:

**Routes**:
```
GET  /ws                          → ForestManager (WebSocket upgrade)
POST /auth/signup                 → PlayerIdentity (create account)
POST /auth/login                  → PlayerIdentity (authenticate)
POST /auth/verifyEmail            → PlayerIdentity (email verification)
POST /auth/requestPasswordReset   → PlayerIdentity (send reset email)
POST /auth/resetPassword          → PlayerIdentity (set new password)
POST /auth/changePassword         → PlayerIdentity (change password, authenticated)
POST /auth/refreshToken           → PlayerIdentity (renew access token)
POST /auth/logout                 → PlayerIdentity (revoke current device token)
POST /auth/logoutAll              → PlayerIdentity (revoke all device tokens)
GET  /api/identity                → PlayerIdentity (check username exists)
POST /api/identity                → PlayerIdentity (create/update identity)
GET  /api/leaderboard/top         → Leaderboard (get rankings)
GET  /api/leaderboard/player      → Leaderboard (get player rank)
POST /api/leaderboard/report      → Leaderboard (update score)
POST /admin/*                     → ForestManager (admin APIs, requires X-Admin-Secret header)
```

**Cron Triggers**:
```
Daily:  0 8 * * *     (8am UTC) → Reset map, forest, positions
Weekly: 5 8 * * 0     (8:05am UTC Sunday) → Reset leaderboard
```

**Security**:
- CORS headers on all responses (Origin: *)
- Admin routes require `X-Admin-Secret` header
- Turnstile bot verification on WebSocket connections
- Rate limiting: 5 connections per 5 minutes per IP

#### **`ForestManager.ts`** - World State (129 KB)
**Path**: `/workers/objects/ForestManager.ts`

Singleton Durable Object managing game state:

**Responsibilities**:
- WebSocket connection hub (all players connect here)
- Player position synchronization
- Walnut spawning (30 game-generated walnuts on load)
- Combat system (health tracking, projectile hits, knockouts)
- NPC AI management (up to 2 NPCs via NPCManager)
- Predator AI management (up to 2 predators via PredatorManager)
- Terrain generation (Perlin noise seed)
- Forest objects (trees, shrubs, rocks)
- Admin APIs (reset map, kick players, adjust AI settings)
- Metrics tracking (daily stats)

**State**:
```typescript
class ForestManager {
  activePlayers: Map<string, PlayerConnection>
  mapState: Walnut[]                 // Game-generated golden walnuts
  forestObjects: ForestObject[]      // Trees, shrubs, rocks
  terrainSeed: number                // Procedural terrain seed

  npcManager: NPCManager
  predatorManager: PredatorManager

  metrics: {
    treesGrownToday: number
    projectilesThrownToday: number
    hitsToday: number
    peakPlayersToday: number
    predatorFleesCount: number
  }
}
```

**WebSocket Lifecycle (MVP 16)**:
```
1. GET /ws?squirrelId=...&characterId=...&accessToken=...&turnstileToken=...
2. Turnstile bot verification (REQUIRED)
3. Rate limit check (5 connections per 5 min per IP)
4. JWT access token verification (for authentication)
5. Character tier validation (check if unlocked)
6. WebSocketPair created
7. Send existing players + NPCs + walnuts to new player
8. Broadcast new player to all connected players
9. Message loop (position updates, walnut finds, throws, chat)
10. Player disconnect → broadcast to others
```

**Message Types**:
```typescript
// Server → Client
{ type: 'player-join', squirrelId, position, character, title }
{ type: 'player-update', squirrelId, position, rotationY }
{ type: 'walnut-spawn', walnutId, position, origin, hiddenIn }
{ type: 'walnut-found', walnutId, foundBy, points }
{ type: 'projectile-throw', throwerId, position, targetId }
{ type: 'health-update', squirrelId, health }
{ type: 'rank-up', squirrelId, newTitle, points }
{ type: 'npc-update', npcId, position, behavior, animation }
{ type: 'predator-update', predatorId, type, position, state }
{ type: 'tree-grown', treeId, position, grownByPlayerId, points }
{ type: 'player-disconnect', squirrelId }

// Client → Server
{ type: 'position', position, rotationY }
{ type: 'walnut-hide', location, hidingMethod }
{ type: 'walnut-find', walnutId }
{ type: 'throw-walnut', targetPosition }
{ type: 'chat', message }
```

**Admin APIs** (require `X-Admin-Secret` header):
```
POST /admin/reset-mapstate        → Clear golden walnuts
POST /admin/reset-forest          → Regenerate forest objects
POST /admin/reset-positions       → Clear player positions
GET  /admin/players/active        → List connected players
POST /admin/players/{id}/kick     → Disconnect player
POST /admin/players/{id}/reset    → Reset player position
GET  /admin/metrics               → Game statistics
GET  /admin/predators             → Predator status
POST /admin/predators/clear       → Remove all predators
POST /admin/predators/adjust      → Tune predator behavior
POST /admin/npcs/adjust           → Tune NPC settings
POST /admin/config/tree-*         → Configure tree growth bonuses
```

#### **`PlayerIdentity.ts`** - Authentication (33 KB)
**Path**: `/workers/objects/PlayerIdentity.ts`

Per-username Durable Object for identity management:

**Data Model**:
```typescript
interface PlayerIdentityData {
  // Basic identity
  username: string
  sessionTokens: string[]          // Multiple browser sessions
  created: number
  lastSeen: number

  // Email/Password Authentication (MVP 16)
  email?: string                   // Unique (enforced via EMAIL_INDEX KV)
  passwordHash?: string            // bcrypt, cost=12
  emailVerified: boolean
  emailVerificationToken?: string  // UUID v4
  emailVerificationExpiry?: number // 24 hours

  // Password reset
  passwordResetToken?: string
  passwordResetExpiry?: number     // 1 hour

  // JWT tokens
  authTokens: {
    tokenId: string                // For revocation
    created: number
    expiresAt: number
    deviceInfo?: string
    lastUsed?: number
  }[]

  // Character entitlements
  unlockedCharacters: string[]     // ['lynx', 'bear', ...]
  lastCharacterId?: string

  // Status flags
  isAuthenticated: boolean
  accountCreated?: number
  lastPasswordChange?: number
}
```

**Authentication Flow**:
```
Signup:
  POST /auth/signup { email, username, password }
    → Validate password strength (8+ chars, uppercase, lowercase, number)
    → Hash password (bcrypt, cost 12, ~200-300ms)
    → Send verification email (SMTP)
    → Generate JWT token pair (access 30d, refresh 90d)
    → Return { accessToken, refreshToken, user }

Login:
  POST /auth/login { email, password }
    → Hash input password & compare with stored hash
    → Generate JWT token pair
    → Return { accessToken, refreshToken, user }

Verify Email:
  POST /auth/verifyEmail { token }
    → Check token expiry (24 hours)
    → Mark emailVerified = true
    → Return success

Refresh Token:
  POST /auth/refreshToken { refreshToken }
    → Validate refresh token JWT signature
    → Check token not revoked
    → Generate new access token
    → Return { accessToken }
```

**Security**:
- Passwords hashed with bcrypt (cost=12)
- Email uniqueness enforced via `EMAIL_INDEX` KV namespace
- JWT tokens signed with `JWT_SECRET` environment variable
- Token revocation via `tokenId` tracking
- Access tokens: 30-day expiration
- Refresh tokens: 90-day expiration

#### **`Leaderboard.ts`** - Rankings (22 KB)
**Path**: `/workers/objects/Leaderboard.ts`

Singleton Durable Object for score tracking:

**Data Model**:
```typescript
interface ScoreRecord {
  playerId: string
  score: number
  walnuts: { hidden: number; found: number }
  updatedAt: number
  lastScoreIncrease?: number

  // MVP 16: Auth filtering
  isAuthenticated?: boolean
  emailVerified?: boolean
  characterId?: string
}
```

**Leaderboard Types**:
1. **Weekly** (resets Sunday 8:05am UTC)
   - Top 10 must be authenticated players
   - Guest players shown below top 10
2. **All-Time** (never resets)
   - Authenticated players only
3. **Daily** (resets daily 8am UTC)
   - All players (no filtering)

**Anti-Cheat**:
- Max 100 points/minute per player
- Absolute cap: 100,000 points
- Server-authoritative score updates only

#### **`NPCManager.ts`** - NPC AI (36 KB)
**Path**: `/workers/objects/NPCManager.ts`

AI system for autonomous NPC characters:

**Configuration**:
```typescript
MAX_NPCS = 2
DESPAWN_PLAYER_THRESHOLD = 15     // Too many real players
NPC_SPEED = 2.4                   // 80% of player speed
UPDATE_INTERVAL = 200ms           // 5 Hz (cost-optimized)
```

**Behavior States**:
```
IDLE → Stand still (30-60s)
WANDER → Random walk (60-120s, 50-unit patrol radius)
APPROACH → Move toward player/NPC (vision: 30 units)
GATHER → Collect walnut (vision: 20 units)
THROW → Combat (800ms cooldown, 3-18 unit range)
EAT → Consume walnut to restore 20 HP (when health < 50)
```

**Rank-Based Aggression (MVP 12)**:
```typescript
// NPC aggression scales based on target player rank
Rookie (0-20): 0.0x → NPCs never throw
Apprentice (21-100): 0.0x → Still safe
Dabbler (101-200): 0.0x → But predators attack
Slick (201-300): 1.0x → Normal NPC behavior
Ninja (501-1000): 1.25x → NPCs more aggressive
Legend (1001+): 1.35x → Maximum challenge
```

#### **`PredatorManager.ts`** - Predator AI (24 KB)
**Path**: `/workers/objects/PredatorManager.ts`

Dangerous creatures for PvE challenge:

**Predator Types**:
1. **Aerial** (Cardinal, Toucan)
   - Speed: 6.5 units/sec (faster than players)
   - Attack: Dive to steal 1-2 walnuts
   - Cooldown: 45 seconds
   - Cruise height: 2.5 units
   - Dive height: 1.8 units
2. **Ground** (Wildebeest)
   - Speed: 5.5 units/sec
   - Attack: Ram for 30 HP damage
   - Cooldown: 8 seconds
   - Range: 1.5 units

**State Machine**:
```
IDLE → Patrol area (20-40s)
PATROL → Wander (detect players within 30 units)
TARGETING → Chase high-ranked player
ATTACKING → [Aerial] Dive/steal, [Ground] Ram/bite
RETURNING → Return to patrol area
DISTRACTED → Diverted by thrown walnut (5s)
FLEEING → [Ground only] Leave map after 4+ hits
```

**Rank-Based Targeting (MVP 12)**:
```typescript
// Predators ignore low-ranked players
Rookie (0-20): 0.0 → Completely ignored
Apprentice (21-100): 0.0 → Completely ignored
Dabbler (101-200): 0.4 → Weak preference
Slick (201-300): 0.7 → Normal
Ninja (501-1000): 1.1 → Highly preferred
Legend (1001+): 1.3 → Top priority
```

---

## Asset Structure (`public/`)

### Directory Organization

```
public/
├── models/
│   ├── characters/                # 10 playable characters
│   │   ├── squirrel.glb
│   │   ├── hare.glb
│   │   ├── goat.glb
│   │   ├── chipmunk.glb
│   │   ├── turkey.glb
│   │   ├── mallard.glb
│   │   ├── lynx.glb             # Premium
│   │   ├── bear.glb             # Premium
│   │   ├── moose.glb            # Premium
│   │   └── badger.glb           # Premium
│   │
│   ├── animations/                # Separate animation files
│   │   ├── squirrel/
│   │   │   ├── idle.glb
│   │   │   ├── idle_b.glb
│   │   │   ├── idle_c.glb
│   │   │   ├── walk.glb
│   │   │   ├── run.glb
│   │   │   ├── attack.glb
│   │   │   └── death.glb
│   │   ├── hare/ [similar structure]
│   │   └── ... [other characters]
│   │
│   ├── environment/               # Forest objects
│   │   ├── tree_01.glb
│   │   ├── tree_02.glb
│   │   ├── bush_01.glb
│   │   └── rock_01.glb
│   │
│   └── items/                     # Game objects
│       ├── walnut.glb
│       └── golden_walnut.glb
│
├── sounds/                        # Audio files (28 total)
│   ├── actions/
│   │   ├── hide.mp3
│   │   ├── find.mp3
│   │   ├── throw_walnut.mp3
│   │   ├── walnut_hit.mp3
│   │   └── ...
│   ├── movement/
│   │   ├── footstep_grass.mp3
│   │   ├── footstep_dirt.mp3
│   │   └── jump.mp3
│   ├── combat/
│   │   ├── player_death.mp3
│   │   └── player_collision.mp3
│   ├── predators/
│   │   ├── flying_predator_nearby.mp3
│   │   └── ground_predator_attack.mp3
│   ├── ui/
│   │   ├── button_click.mp3
│   │   ├── chat_send.mp3
│   │   └── score_pop.mp3
│   ├── world/
│   │   ├── tree_growth.mp3
│   │   └── health_boost.mp3
│   └── music/
│       ├── game_music.mp3
│       └── ambient_forest.mp3
│
└── textures/                      # Terrain & material textures
    ├── terrain_grass.jpg
    ├── terrain_dirt.jpg
    └── terrain_rock.jpg
```

---

## Configuration Files

### Root Configuration

- **`package.json`**: Workspace scripts (`install:all`, `dev:client`, `dev:worker`, `build:client`, `build:worker`)
- **`wrangler.toml`**: Cloudflare Workers configuration (Durable Objects, KV bindings, cron triggers, secrets)
- **`.gitignore`**: Git ignore patterns (node_modules, dist, .env)

### Client Configuration

- **`client/vite.config.ts`**: Vite build configuration (dev server port, build output)
- **`client/tsconfig.json`**: TypeScript configuration (strict mode, ES2020 target)
- **`client/.env.development`**: Local dev API URL (`http://localhost:8787`)
- **`client/.env.preview`**: Preview API URL (`hidden-walnuts-api-preview.mattmcarroll.workers.dev`)
- **`client/.env.production`**: Production API URL (`api.hiddenwalnuts.com`)

### Worker Configuration

- **`workers/wrangler.toml`**: Worker-specific settings (main entry, compatibility date, durable object bindings)
- **`workers/tsconfig.json`**: TypeScript configuration (NodeNext module resolution)

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Start Cloudflare Workers backend
cd workers
npx wrangler dev --port 8787

# Terminal 2: Start Vite dev server
cd client
npm run dev

# Game available at: http://localhost:5173
# API available at: http://localhost:8787
```

### Build Process

```bash
# Build client
cd client
npm run build:preview    # Preview build (uses .env.preview)
npm run build           # Production build (uses .env.production)

# Build worker
cd workers
npm run build           # TypeScript compilation to dist/
```

### Deployment

**GitHub Actions Auto-Deploy**:
```
Push to main → Production
  ├── Client → game.hiddenwalnuts.com (Cloudflare Pages)
  └── Worker → api.hiddenwalnuts.com (Cloudflare Workers)

Push to mvp-* → Preview
  ├── Client → <hash>.hidden-walnuts-game.pages.dev
  └── Worker → hidden-walnuts-api-preview.mattmcarroll.workers.dev
```

**Manual Deploy**:
```bash
# Deploy client to Cloudflare Pages
npx wrangler pages deploy client/dist --project-name hidden-walnuts-game

# Deploy worker to Cloudflare Workers
cd workers
npx wrangler deploy --env preview    # Preview
npx wrangler deploy --env production # Production
```

---

## Architecture Patterns

### Client Patterns

1. **ECS-Style System Design**: Game logic separated into systems (`NetworkSystem`, `InputSystem`, etc.)
2. **Static Asset Caching**: GLTF models and animations cached in `Game.ts` static properties
3. **Component-Based UI**: Modular UI components (`AuthModal`, `CharacterGrid`, etc.)
4. **Service Layer**: Shared services (`AuthService`, `SessionManager`, `CharacterRegistry`)

### Server Patterns

1. **Durable Objects**: Stateful coordination units (singleton ForestManager, per-user PlayerIdentity)
2. **Actor Model**: Each Durable Object instance is a single-threaded actor (no race conditions)
3. **WebSocket Hub**: ForestManager acts as centralized WebSocket hub for all players
4. **Authoritative Server**: All game logic (scoring, combat, spawning) server-controlled

---

## Performance Optimizations

### Client

- **Asset caching**: GLTF models cached, cloned for instances
- **Animation sharing**: Animation clips shared across characters
- **Raycasting culling**: Only check 30-unit radius for collisions
- **Octree spatial indexing**: Terrain collision acceleration
- **Message throttling**: 100ms minimum between position updates
- **Memory cleanup**: Regular disposal of geometries/materials

### Server

- **NPC update interval**: 200ms (5 Hz) to reduce compute cost
- **Predator update interval**: 100ms (10 Hz) for responsiveness
- **Storage sync strategy**: Periodic storage writes, not every message
- **Message batching**: Combined updates in single WebSocket frame

---

## Security Measures

### Client

- Password strength validation (8+ chars, uppercase, lowercase, number)
- Email format validation
- Input sanitization (username, chat messages)
- HTTPS-only connections (enforced by Cloudflare)

### Server

- **Turnstile bot verification**: Required for all WebSocket connections
- **Rate limiting**: 5 connections per 5 minutes per IP
- **JWT authentication**: Access tokens (30d) + refresh tokens (90d)
- **Server-authoritative**: Movement, score, combat validated server-side
- **Anti-cheat**: Movement speed, teleportation, score-per-minute limits
- **Admin endpoint protection**: `X-Admin-Secret` header required
- **Email uniqueness**: EMAIL_INDEX KV prevents duplicate accounts
- **Password hashing**: Bcrypt cost=12 (~200-300ms per hash)

---

## Project Statistics

### Client
- **Total TypeScript files**: 47+
- **Game.ts**: 8,349 lines
- **AuthService.ts**: 399 lines
- **NetworkSystem.ts**: 1,200+ lines
- **CharacterRegistry.ts**: 302 lines

### Server
- **ForestManager.ts**: 129 KB
- **PlayerIdentity.ts**: 33 KB
- **Leaderboard.ts**: 22 KB
- **NPCManager.ts**: 36 KB
- **PredatorManager.ts**: 24 KB

### Assets
- **Characters**: 10 GLTF models
- **Animations**: 6-8 states per character
- **Sounds**: 28 audio files
- **Terrain**: Procedural 400×400 unit world

---

This document provides a comprehensive overview of the Hidden Walnuts project structure at MVP 16. For detailed documentation on specific systems, see the `/docs` directory.
