# 🎮 Hidden Walnuts - MVP Development Plan

**Current Status**: MVP 12 (World Polish and Predators) - 🎯 **NEXT**

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

## ⚔️ MVP 12: World Polish and Predators & Threats (6-8 hours)

**Goal**: Add AI predators that create PvE danger and excitement

### Features

**1. Cardinal, Toucan (Aerial Threat)s** (3-4 hours)
- Fly overhead, dive-bomb players
- Steal 1-2 walnuts on successful grab
- ~30s cooldown between attacks
- Avoidable with movement/awareness

**2. Wildebeest (Ground Threat)** (3-4 hours)
- Patrol forest, chase players
- Deal 30 damage on bite
- Faster than players (must evade strategically)
- Can be distracted by throwing walnuts

**3. AI Behaviors**
- Predators target players with most walnuts
- Predators avoid NPCs (or treat them equally)
- Visual/audio warnings before attack
- Respawn at random intervals

**4.UX Polish**
- Add some fun sky elements. (like a sun, not sure what else, open to ideas)
- better tutorial experience.  research similar games and how to do this, likely different tutorial for desktop (because of key usage) vs ipad/iphone


**5. remove any debug logging added for this MVP, both client and worker**

### Success Criteria
- ✅ predators add meaningful danger
- ✅ Players must stay alert (not just PvP)
- ✅ Predators are challenging but fair
- ✅ Creates "close call" exciting moments

## MVP 11.5: voiceover
**3. Voiceover Work** (1-2 hours)
- Character selection voice lines (one per character)
- Combat reactions ("Ouch!", "Gotcha!", "Oh no!")
- Victory/defeat voiceovers
- Optional: Narrator intro ("Welcome to the forest...")
- remove any debug logging added for this MVP, both client and worker

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

**6. remove any debug logging added for this MVP, both client and worker

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
| 1.5-11 | Core Game Complete | ✅ Complete |
| **12** | **World Polish and Predators** | 🎯 **NEXT** |
| 13 | Full Authentication | Pending |
| 14 | Code Cleanup | Pending |

---

**Next Step**: Begin MVP 12 (World Polish and Predators & Threats) ⚔️
