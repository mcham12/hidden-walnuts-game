# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: MVP 9 (Combat Completeness & World Resources) - 🎯 **NEXT**

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

---

## 🎯 MVP 9: Combat Completeness & World Resources (4-6 hours)

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

### Success Criteria
- ✅ Can see everyone's health at a glance
- ✅ NPCs behave intelligently (eat, flee when low HP)
- ✅ NPCs die and respawn properly
- ✅ Walnuts replenish naturally from trees
- ✅ Leaderboard is manageable and cheat-resistant

---

## 🔊 MVP 10: Audio Polish (3-5 hours)

**Goal**: Professional audio experience with ambient soundscapes and character

### Features

**1. Additional Sound Effects** (1-2 hours)
- Walnut impact sounds (hit player, hit ground, hit tree)
- Character footsteps (vary by surface)
- Eating/healing sounds
- Death/respawn audio
- UI feedback sounds (buttons, notifications)

**2. Ambient Soundtrack** (1-2 hours)
- Looping background music (calm forest theme)
- Dynamic intensity (changes based on combat proximity)
- Fade in/out transitions
- Volume controls in settings

**3. Voiceover Work** (1-2 hours)
- Character selection voice lines (one per character)
- Combat reactions ("Ouch!", "Gotcha!", "Oh no!")
- Victory/defeat voiceovers
- Optional: Narrator intro ("Welcome to the forest...")

### Success Criteria
- ✅ Rich audio environment (not silent)
- ✅ Sound effects enhance gameplay feedback
- ✅ Music sets mood without being intrusive
- ✅ Characters feel more alive with voices

---

## ⚔️ MVP 11: Predators & Threats (6-8 hours)

**Goal**: Add AI predators that create PvE danger and excitement

### Features

**1. Hawks (Aerial Threat)** (3-4 hours)
- Fly overhead, dive-bomb players
- Steal 1-2 walnuts on successful grab
- ~30s cooldown between attacks
- Avoidable with movement/awareness

**2. Wolves (Ground Threat)** (3-4 hours)
- Patrol forest, chase players
- Deal 30 damage on bite
- Faster than players (must evade strategically)
- Can be distracted by throwing walnuts

**3. AI Behaviors**
- Predators target players with most walnuts
- Predators avoid NPCs (or treat them equally)
- Visual/audio warnings before attack
- Respawn at random intervals

### Success Criteria
- ✅ Hawks and wolves add meaningful danger
- ✅ Players must stay alert (not just PvP)
- ✅ Predators are challenging but fair
- ✅ Creates "close call" exciting moments

---

## 🔐 MVP 12: Full Authentication (8-12 hours)

**Goal**: Secure player accounts with passwords, email, cross-device sync

### Features

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

### Success Criteria
- ✅ Players can create secure accounts
- ✅ Password recovery works reliably
- ✅ Can play on multiple devices
- ✅ No major security vulnerabilities

---

## 🧹 MVP 13: Code Cleanup & Optimization

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

---

## 📅 Timeline

| MVP | Focus | Status |
|-----|-------|--------|
| 1.5-8 | Core Game Complete | ✅ Complete |
| **9** | **Combat Completeness & Resources** | 🎯 **NEXT** |
| 10 | Audio Polish | Pending |
| 11 | Predators & Threats | Pending |
| 12 | Full Authentication | Pending |
| 13 | Code Cleanup | Pending |

---

**Next Step**: Begin MVP 9 (Combat Completeness & World Resources) 🌳
