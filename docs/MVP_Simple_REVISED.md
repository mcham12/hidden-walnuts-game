# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: MVP 13 (Game Admin APIs) - 🎯 **IN PROGRESS**

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
- **MVP 7**: NPC Characters & World Life - Server-side AI with behaviors, walnut gathering, animation/collision fixes
- **MVP 7.1**: Cloudflare Cost Mitigation & Bot Protection - Turnstile, rate limiting, cost optimizations
- **MVP 8**: Combat, Health & Resource Management - Projectile throwing, damage/health system, eating walnuts, death/respawn, inventory limits
- **MVP 9**: Combat Completeness & World Resources - Health bars, NPC AI improvements, tree growth system, collision fixes, comprehensive logging cleanup
- **MVP 11**: Sound Effects & Audio Enhancement - Comprehensive sound system with combat, player, and ambient sounds; iOS Safari audio support
- **MVP 12**: World Polish, Predators & Defense - AI predators (cardinal, toucan, wildebeest), rank-based targeting system, defense mechanics, sky elements, tutorial redesign, UX polish

---

## ✅ MVP 9: Combat Completeness & World Resources (COMPLETE)

**Goal**: Finish the health/combat ecosystem and ensure sustainable resources

### Features

**1. Remote Health Visibility** (1-2 hours)
- Health bars above all players and NPCs
- Color-coded: green (60-100%) → yellow (30-60%) → red (0-30%)
- Always visible or show on damage
- Smooth updates via WebSocket

**2. NPC Health AI** (1 hour)
- NPCs eat walnuts when HP < 50
- NPCs prioritize survival over aggression when low HP
- Smart inventory management (save walnuts for healing)

**3. NPC Death System** (1 hour)
- Verify NPCs can die (should already work)
- NPCs respawn after 30s as different random character
- NPCs drop all walnuts on death
- Maintain stable NPC population (~3 active)

**4. Tree-Drop Walnut System** (2-3 hours)
- Random trees drop walnuts every 60-120 seconds
- Walnuts fall from canopy with physics (bounce/roll)
- Ensures resources never run out
- Visual: Walnut appears in tree, falls, bounces to rest
- Server-authoritative (prevents exploits)


**5. Leaderboard Admin Tools** (30-60 min)
- Admin command to reset leaderboard
- Basic anti-cheat: Server validates score changes
- Clean up stale/corrupted entries
- Persistent storage optimization

**6. Fix Collision Between Players**
- It appears that players collide when they are visually too far apart
- Find a solution to make it appear that collisions happen when players are close together
- Don't negatively impact other collision, like with trees, rocks, etc

**7. Fix Floating Rock Issue**
- One specific rock model floats above the terrain, other rock models do not
- Debug, maybe with a temporary filename label on the rocks, so we can find the culprit model
- Fix the floating rock issue
- Remove temporary labels from rocks

**8. Updated Hide Walnut Mechanism: Grow Trees!**
- If a player hides a walnut, make it glow green (same effect as the system golden walnut, but make it green glow)
- If, after x time (make it 2 minutes to start), no other player picks up your walnut, then it grows into a tree, and the player who hid the walnut instantly gets 5 "Tree grown, 10 bonus points!" or something similar award
- If a player picks up another player's hidden walnut, they get extra 5 points, and just a normal walnut added to inventory
- Consider a creative way to make the tree grow: if the walnut is too close to other objects, make it nearby, not in the hidden walnut's exact hidden location. Consider some scaling mechanism as the tree grows, use the internet as a resource to come up with a good solution
- Moving forward, the tree should be added to the normal tree pool, and will drop walnuts at the normal frequency

**9. make sure NPCs face their target before throwing walnuts at the target**
-  It appears that NPCs can face away from their target but still throw at a target. doesn't seem realistic and hurts game consistency and feel

**10. Improve settings UI**
-  Make the Settings UI more compact, more like the Leaderboard.
-  improve desktop, and iphone portrait/landscape and ipad portrait/landscape
-  Make the Settings display be able to be dismissed by clicking/tapping outside of the window in ipad, iphone, and desktop browsers

**11. Death = drop walnuts before respawn**
-  re-introduce the lost functionality where a player (human or NPC) dies, upon dying, all of their inventory of walnuts is dropped before being respawinging with 0 walnuts

**12. Remove Debug Logging**
- Remove any non-critical logging added for this MVP, both client console and worker logs

### Success Criteria

- ✅ Can see everyone's health at a glance
- ✅ NPCs behave intelligently (eat, flee when low HP)
- ✅ NPCs die and respawn properly
- ✅ Walnuts replenish naturally from trees
- ✅ Leaderboard is manageable and cheat-resistant
- ✅ Selected bugs fixed and visual polish improved

---

## ✅ MVP 11: Sound Effects & Audio Enhancement (COMPLETE)

**Goal**: Complete audio experience with comprehensive sound effects

### Implemented Features

**Gameplay Sounds:**
- ✅ `thrown_walnut.mp3` - Walnut throw action
- ✅ `walnut_hit_player.mp3` - Successful hit on NPC/player
- ✅ `walnut_miss_player_and_drop_from_tree.mp3` - Miss or tree drop
- ✅ `Walnut_found.mp3` - Walnut pickup
- ✅ `walnut_eat.mp3` - Eating walnut
- ✅ `player_collision.mp3` - Bumping into NPCs/players (volume: 0.25)
- ✅ `tree_growth.mp3` - Hidden walnut grows into tree

**Player Event Sounds:**
- ✅ `healthboost-localplayer.mp3` - Health boost (only when eating, not passive regen)
- ✅ `death_sound_localplayer.mp3` - Local player death
- ✅ `Eliminate_remoteplayer_or_NPC.mp3` - Remote player/NPC elimination
- ⏸️ `walking_localplayer.mp3` - Loaded but not implemented (deferred)

**Background Audio:**
- ✅ `game-music-loop.mp3` - Background music (volume: 0.35)
- ✅ `forest-ambience.mp3` - Forest ambient sounds (volume: 0.3)
- ✅ Layered approach: Both ambient and music play together for rich atmosphere

**Audio System Improvements:**
- ✅ iOS Safari audio unlock with HTML5 Audio mode for mobile
- ✅ Separate volume controls for sfx, ambient, music, and master
- ✅ Sound cooldowns to prevent spam (collision: 2s)
- ✅ Smart healthboost: Only plays when eating walnuts, not passive regen

### Success Criteria
- ✅ All gameplay actions have appropriate sound feedback
- ✅ Combat feels impactful with hit/miss/collision sounds
- ✅ Ambient audio creates immersive forest atmosphere
- ✅ Volume controls work properly (4 categories)
- ✅ Audio works on iOS Safari with proper unlock flow
- ✅ No annoying repetitive sounds (collision reduced to 0.25, healthboost only on eating)

---

## ✅ MVP 12: World Polish, Predators & Defense (COMPLETE)

**Goal**: Add AI predators that create PvE danger and excitement

### Completed Features

**1. Aerial Predators (Cardinal, Toucan)** ✅
- Fly overhead with smooth wandering AI (Craig Reynolds steering)
- Dive-bomb players to steal 1-2 walnuts
- 45s cooldown between attacks (reduced aggression)
- Can be distracted by throwing walnuts (5-8s distraction window)
- Audio warnings: proximity sound + attack sound
- Bob up/down for visibility (Zelda-style)

**2. Ground Predator (Wildebeest)** ✅
- Patrol forest with natural idle/walk behavior
- Chase players and deal 30 damage on bite
- Faster than players (5.5 vs 5.0) - must evade strategically
- Annoyance system: 4 walnut hits = flees from map
- Audio warnings: proximity growl + attack sound
- Natural boundary handling (no rapid spinning)

**3. Player Ranking System** ✅
- **Rank Titles**: Rookie (0-20), Apprentice (21-100), Dabbler (101-200), Slick (201-300), Maestro (301-500), Ninja (501-1000), Legend (1001+)
- Welcome overlay on first join: "Welcome, your status is Rookie!"
- Rank-up overlay: "You've achieved Slick Status!" with title description
- Used "Title" terminology (friendlier than "Rank")
- Shared PlayerRanks.ts between client/worker for consistency

**4. Rank-Based AI Targeting** ✅
- **NPCs**: Friendly to Rookie/Apprentice/Dabbler, baseline aggression at Slick, gradually increase for higher ranks
- **Predators**: Ignore Rookie/Apprentice, start targeting Dabbler+ with weighted preference
- Targeting weights (reduced for balance):
  - Dabbler: 0.4x, Slick: 0.7x, Maestro: 0.9x, Ninja: 1.1x, Legend: 1.3x
- NPCs targeted by time-since-spawn (not rank)
- Multi-targeting prevention (predators don't gang up)

**5. UX Polish** ✅
- **Sky Elements**: Sun sprite (Y=250) and 1-2 clouds using THREE.Sprite billboards
- Standard depth testing (depthTest:true, depthWrite:true) - industry standard approach
- Clouds drift slowly (0.5-1.5 units/sec), respawn after 30-60s off-screen
- **Tutorial Redesign**: Single-screen "How to Play" overlay
  - Platform-specific: Desktop (keyboard shortcuts with key icons) vs Mobile (touch gestures + buttons)
  - Shows all 5 mechanics at once (move, get walnut, throw, hide, eat)
  - Glowing "?" button for easy re-access
  - Auto-show for first-time users (localStorage tracking)
  - Industry standard: No pause in multiplayer (overlay provides visual feedback)
- Removed old multi-screen tutorial and desktop control legend

**6. Production Settings Restored** ✅
- Tree growth time: 1 minute (60000ms)
- Tree growth bonus: 20 points

**7. Logging Cleanup** ✅
- Removed non-critical console.log statements from:
  - Client: Game.ts, SkyManager.ts, TutorialOverlay.ts
  - Worker: ForestManager.ts, PredatorManager.ts, NPCManager.ts, SquirrelSession.ts, Leaderboard.ts, PlayerIdentity.ts
- Kept operational logs (errors, warnings, scheduled tasks)

### Success Criteria
- ✅ Predators add meaningful PvE danger
- ✅ Players must stay alert (not just PvP focused)
- ✅ Predators are challenging but fair (reduced aggression based on testing)
- ✅ Creates "close call" exciting moments with defense mechanics
- ✅ New players protected (Rookie/Apprentice safe from predators)
- ✅ Progression system rewards skill with rank titles


---

## 🎮 MVP 13: Game Admin APIs (IN PROGRESS)

**Goal**: Admin tools for game maintenance, monitoring, and moderation

### Research Findings

Based on industry standards for casual multiplayer games (PlayFab, Unity Moderation, indie game best practices):

**Essential Admin Features:**
1. **Player Management** - View, ban, kick, reset players
2. **Real-Time Monitoring** - Active players, server health, game state
3. **Game Control** - Reset systems, spawn resources, adjust parameters
4. **Leaderboard Moderation** - Remove cheaters, manual corrections

### Part 0: Analysis & Planning
- produce a concise explainer on how secrets are used to secure cloudflare apis, including how different from passwords, and practically how the secured-by-secret apis can be used from mac os terminal and a hypothetical (potentially future) admin web page.  included differences: preview vs production.  document this somehow in docs/ folder.
- document/ list existing admin-related apis (including leaderboard-related) vs new apis to be developed via this MVP.  Document in docs/ folder
- determine which APIs are secured by a secret now and can we reuse that secret or do we need to generate a new one
- develop a plan for harmonized admin secret(s) if possible,  based on the above.  ok if not possible to harmonize.  the goal is to make secure and usable from mac os terminal
- Next, cursor performs the the steps to acquire new secret(s) as needed (if possible)
- Desk-check existing APIs (reset-mapstate, reset-forest, reset-positions) to (1) understand functionality as implemented for documentation delivered via this MVP (2) confirm that they still will work given the extensive game development that has occured since the original APIs were developed (e.g. now have predators, technical implementation may have changed etc etc).  If changes are needed, document and do as "Part 0.5" in this MVP.

### Part 0.5
-remediate any existing APIs, functionality-wise, as needed, per part 0 analysis

### Part 1: Secure Existing Admin Endpoints (1-2 hours)

**Problem**: Current forest admin endpoints lack authentication
- `/admin/reset-mapstate` - ❌ Unprotected
- `/admin/reset-forest` - ❌ Unprotected
- `/admin/reset-positions` - ❌ Unprotected

**Solution**: Add `ADMIN_SECRET` authentication (same pattern as leaderboard)
```typescript
// Add to all /admin/* endpoints:
const adminSecret = request.headers.get("X-Admin-Secret");
if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
```

**Tasks:**
- ✅ Add auth check to `/admin/reset-mapstate`
- ✅ Add auth check to `/admin/reset-forest`
- ✅ Add auth check to `/admin/reset-positions`
- ✅ Test all endpoints with valid/invalid secrets

### Part 2: New Admin API Endpoints (3-4 hours)

**Player Management APIs:**

1. **Get Active Players** - `GET /admin/players/active`
   - Returns online players with username, position, score, inventory
   - Response: `{ players: [...], count: 5, timestamp: ... }`

2. **Get Player Details** - `GET /admin/players/:playerId`
   - Full player stats: score, walnuts, position, session info
   - Response: `{ player: {...}, stats: {...}, history: [...] }`

3. **Ban Player** - `POST /admin/players/:playerId/ban`
   - Body: `{ reason: "Cheating detected", duration: 86400 }`
   - Kicks player, prevents reconnect
   - Stores ban in KV with expiry

4. **Unban Player** - `POST /admin/players/:playerId/unban`
   - Removes ban, allows reconnect

5. **Kick Player** - `POST /admin/players/:playerId/kick`
   - Force disconnect (no ban)

6. **Reset Player** - `POST /admin/players/:playerId/reset`
   - Reset score, inventory, position (keep username)

**Game State APIs:**

7. **Get Game Metrics** - `GET /admin/metrics`
   - Active players, NPC count, walnut distribution, server uptime
   - Response: `{ activeUsers: 12, npcs: 3, walnuts: {...}, uptime: ... }`

8. **Spawn Walnut** - `POST /admin/spawn/walnut`
   - Body: `{ position: {x, y, z}, type: "golden" }`
   - Manually spawn walnut for events/testing

9. **Adjust NPC Count** - `POST /admin/npcs/adjust`
   - Body: `{ count: 5 }`
   - Add or remove NPCs dynamically


**Implementation Details:**
- All endpoints require `X-Admin-Secret` header
- Ban system uses KV: `ban:{playerId}` → `{ reason, bannedAt, expiresAt, bannedBy }`
- Rate limiting: 100 admin requests/minute (prevent abuse)


### Documentation

Create: `docs/ADMIN_SETUP.md`
- How to run the apis
- Common admin tasks guide
- Troubleshooting

## MVP 14: voiceover and more gameplay polish
**1. Voiceover Work** (1-2 hours)
- Character selection voice lines (one per character)
- Combat reactions ("Ouch!", "Gotcha!", "Oh no!")
- Victory/defeat voiceovers
- Optional: Narrator intro ("Welcome to the forest...")
- remove any debug logging added for this MVP, both client and worker


**2. Walnut hiding bonus**
- add a special point bonus for hiding 50 walnuts, e.g. 50 points
- adjust tree growing mechanism because we will be encouraging walnut hiding now: instead of current state: every walnut hidden by a given player will grow to a tree based on a timer, move to future state: only the 10th, 20th, 30th, etc hidden walnut hidden by the player will grow to be a tree (subject to the same time delay as before)
- the bonus is only awarded if there are 50 walnuts currently hidden by that player (so if other players pick up walnuts hidden by the player, they are removed from the count for this awared.  also if a walnut grows into a tree it is removed from the count for this award).  
- Make a special screen overlay UI ( not the standard "toast" message) announcing the bonus.  be creative.

**3. Tune NPC and Predator behavior**
- reduce agression of NPCs against human players...still slightly increase as the localplayer rank increases, but lessen the NPC agression at every level

**4. Remove any debug logging added during this MVP, both worker and client**

---




## 🔐 MVP 15: Full Authentication (8-12 hours)

**Goal**: Continue to provide quick, no authentication option for low friction play, but offer Secure player accounts with passwords, email, cross-device sync. Secure player accounts get access to full player list of characters, and the ability to appear on specific leaderboards.  "No authentication" players should now be limited to just the Squirrel character.

### Features

**0. Architecture**
- identify options for full authentication (technical, platforms, etc including email)
- recommend options based on my use of cloudflare, and owning a custom domain (hiddenwalnuts.com) and NameCheap Private Email, and the ability to create new email account from that domain if needed.  not sure if can be used for sending emails for full authentication thought
- Research and recommend if no-authentication players can be on leaderboards, and if so, which
- Research and recommend any differentiation on player names on leaderboards (if both player types are allowed to be on the same leaderboard)
- Design UX experience for accomodating no authentication vs authenticated
- Develop a plan to refactor and implement new "no authentication or full authentication" experience
- Create a design + implementation plan for the above in the docs/folder
- Implement plan from above, keeping the design+implementation document up to date as work is completed.

**1. Password System** (3-4 hours)
- Secure password hashing (bcrypt)
- Password requirements (8+ chars, no common passwords)
- Password change functionality
- Builds on existing username system (MVP 6)

**2. Email Verification** (2-3 hours)
- Email required for account creation
- Verification email with token
- Resend verification link
- Prevents duplicate emails

**3. Account Recovery** (2-3 hours)
- "Forgot Password" flow
- Email reset link with expiring token
- Secure password reset process
- Account lockout after failed attempts

**4. Cross-Device Sync** (2-3 hours)
- Session tokens work across devices
- Position/score/inventory persists
- Multiple concurrent sessions handled gracefully
- Auto-logout old sessions (optional)

**5. Security Hardening**
- Rate limiting on auth endpoints
- Session expiration/refresh
- HTTPS enforcement
- Input sanitization

**6. remove any debug logging added for this MVP, both client and worker

### Success Criteria
- ✅ Players can create secure accounts or use no-authentication accounts
- smooth and intuitive user experience
- Different gameplay and leaderboard experience by account type
- ✅ Password recovery works reliably
- ✅ Can play on multiple devices
- ✅ No major security vulnerabilities

---

## 🧹 MVP 16: Code Cleanup & Optimization

**Goal**: Remove technical debt, optimize performance

### Tasks
- Remove unused ECS code
- Refactor duplicate logic
- Optimize network messages (reduce bandwidth)
- Profile and fix performance bottlenecks
- Document complex systems
- TypeScript strict mode cleanup

---

## 💭 Deferred for Future Consideration

These features add polish but aren't essential for core gameplay:

### Animation Polish
- **Hermite interpolation**: Smoother remote player movement (minor visual improvement)
- **Advanced animation blending**: More transitions, but diminishing returns
- **Why defer**: Current animations work well, time better spent elsewhere

### Power-Ups
- **Scent** (detect hidden walnuts), **Fast Dig** (hide faster), **Decoy** (fake walnuts)
- **Why defer**: Adds complexity without clear benefit, balance nightmare, game is fun without them

### Weather Effects
- Rain, fog, day/night cycle
- **Why defer**: Pure visual polish, no gameplay impact, performance cost

### Advanced Crafting/Building
- Crafting systems, base building, storage
- **Why defer**: Major scope creep, changes core gameplay loop

### Seasonal Events
- Holiday themes, special walnuts, limited-time modes
- **Why defer**: Only valuable with established player base


DEFERRED UNTIL LATER
5. **Analytics Dashboard** - Player metrics, economy health, error tracking
6. **Audit Logging** - Track all admin actions for accountability
7. **Security** - Role-based access, authentication, rate limiting
DEFERRED UNTIL LATER: ### Part 4: Security & Polish (1 hour)

**Security Hardening:**
1. ✅ Rate limiting on all admin endpoints (100 req/min)
2. ✅ CORS restricted to admin domain only (not wildcard)
3. ✅ Audit log for all actions (who, what, when)
4. ✅ Admin secret rotation instructions in docs
5. ✅ Input validation on all endpoints

**Polish:**
- Success/error toast notifications
- Loading states for all actions
- Keyboard shortcuts (r = refresh, ? = help)
- Dark mode toggle
DEFERRED UNTIL LATER ### Part 3: Admin Web Dashboard (4-5 hours)

**Location**: `/client/admin/index.html` (separate from game)

**Authentication Flow:**
1. Admin enters `ADMIN_SECRET` on login page
2. Secret stored in sessionStorage (client-side only)
3. All API calls include `X-Admin-Secret` header
4. Invalid secret = 401, redirect to login

**Dashboard Sections:**

**1. Overview (Home)**
```
┌─────────────────────────────────────────┐
│ Hidden Walnuts - Game Admin Dashboard  │
├─────────────────────────────────────────┤
│ 🎮 Active Players: 12                   │
│ 🤖 NPCs: 3                              │
│ 🌰 Walnuts: 45 hidden, 23 found        │
│ ⏱️  Uptime: 12h 34m                     │
│ 📊 Top Score: Alice123 (523 pts)       │
└─────────────────────────────────────────┘
```

**2. Player Management**
- Table: Username | Score | Walnuts | Position | Status | Actions
- Actions: View Details | Kick | Ban | Reset
- Search/filter by username
- Ban modal with reason input

**3. Game Control**
- Buttons: Reset Forest | Reset Map State | Reset Positions
- Confirmation dialogs for destructive actions
- Spawn walnut tool (click map to place)
- Adjust NPC count (slider: 0-10)

**4. Leaderboard**
- Current top 10 (weekly + all-time)
- Actions: Remove Player | Manual Reset | Cleanup
- View archives (last 12 resets)

**5. Metrics & Analytics**
- Player count chart (last 24h)
- Score distribution histogram
- Walnut economy graph (hidden vs found over time)
- Error rate monitor

**6. Audit Log**
- Table: Timestamp | Action | Target | Details
- Filter by action type
- Export to CSV

**Tech Stack:**
- Pure HTML/CSS/JavaScript (no framework needed)
- Chart.js for graphs (lightweight)
- Fetch API for all requests
- Responsive design (works on mobile)

**UI Design Principles:**
- Clean, minimal interface (similar to Leaderboard style)
- Confirm all destructive actions
- Real-time updates (refresh every 10s)
- Error handling with user-friendly messages

**File Structure:**
```
client/admin/
├── index.html          # Main dashboard page
├── login.html          # Admin login
├── styles.css          # Dashboard styles
├── admin.js            # Main logic, API calls
├── charts.js           # Metrics visualization
└── README.md           # Setup instructions
```
DEFERRED UNTIL LATER: **Audit Logging:**

10. **Get Admin Actions** - `GET /admin/audit`
    - Query: `?limit=50&since=<timestamp>`
    - Returns: `{ actions: [{admin, action, timestamp, details}], count }`

11. **Log Admin Action** (internal)
    - Every admin action writes to KV: `audit:{timestamp}:{action}`
    - Includes: admin identifier, action type, target, details
    - 90-day retention
---
---

**Next Step**: Begin MVP 12 (World Polish and Predators & Threats) ⚔️
