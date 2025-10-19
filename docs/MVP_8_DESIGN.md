# MVP 8: Combat & Health - Game Design Document

## 🎮 Design Philosophy

**Core Concept**: Squirrels throwing walnuts at each other in a whimsical forest battle royale where walnuts are EVERYTHING.

**What Makes This Fun:**
- **Resource Tension** - Walnuts are currency, ammo, AND health packs. Every walnut creates a meaningful choice.
- **Silly Combat** - Squirrels bonking each other with flying nuts is inherently funny and light-hearted.
- **Opt-In PvP** - You can be a peaceful gatherer or an aggressive fighter. Both are viable.
- **Living World** - NPCs make the world dynamic and unpredictable.
- **Low Stakes** - Death is a minor setback (3 seconds), encouraging risky plays and experimentation.
- **Emergent Gameplay** - Alliances, revenge, territorial control all emerge naturally.

**Design Principles:**
1. **Simple to Learn, Hard to Master** - 2 new keys (Throw, Eat), intuitive mechanics
2. **Whimsy Over Realism** - This is silly squirrel chaos, not military sim
3. **Choices Matter** - Every walnut usage is strategic
4. **Quick Feedback** - Instant gratification for hits, finds, escapes
5. **No Grinding** - Jump in, play, have fun immediately

---

## 🌰 The Walnut Economy

**Walnuts are EVERYTHING** - This is the core innovation that makes the game unique.

### Three Uses for Every Walnut:

1. **Score** - Hold walnuts at end of session (NOT points, just walnuts found/held)
2. **Ammo** - Throw at opponents to damage them (offensive)
3. **Health** - Eat to restore HP (defensive)

### The Strategic Choice:

```
Found a walnut! What do you do?
├─ Throw it → Damage opponent (+2 points if hit, +5 if knockout)
├─ Eat it → Restore 25 HP (survive longer)
└─ Save it → Keep inventory high, more options later
```

Every walnut creates this decision tree. This is FUN.

---

## 📊 Scoring System (Revised)

### Current System Issues:
- ❌ Hiding gives points (user: shouldn't reward prep work)
- ❌ Bush vs buried give different points (arbitrary complexity)
- ❌ No combat scoring
- ❌ Confusing what actions are rewarded

### Proposed Simple Scoring:

| Action | Points | Reasoning |
|--------|--------|-----------|
| **Find walnut** | +1 | Reward exploration (regardless of bush/buried type) |
| **Hit opponent** | +2 | Reward accuracy and combat skill |
| **Knockout opponent** | +5 | Big reward for successful elimination |
| **Die** | -2 | Light penalty (not devastating, keeps playing fun) |
| Hide walnut | 0 | Prep work, not scored |
| Eat walnut | 0 | Strategic choice, not scored |
| Steal walnut | 0 | Already got points for finding it |

### Why This Works:
- **Clear Rewards** - 3 positive actions (find, hit, knockout)
- **Light Penalty** - Death isn't devastating (-2 vs +5 for knockout = fair)
- **Encourages Action** - Combat is rewarded but not required
- **Simple Math** - Easy to understand point changes

### Leaderboard Display:
```
1. PlayerName - 47 points (12 walnuts, 8 knockouts)
2. NPCName - 35 points (25 walnuts, 2 knockouts)
3. PlayerName2 - 28 points (18 walnuts, 4 knockouts)
```

Show both points AND stats for context.

---

## ⚔️ Combat System

### Health:
- **Starting HP**: 100
- **Max HP**: 100
- **Natural Regen**: +1 HP per 5 seconds (slow, encourages eating)
- **Display**: Health bar above character + HUD element

### Damage:
- **Hit by walnut**: -20 HP (5 hits to knockout)
- **Visual feedback**: Damage number floats up, hit flash, hurt sound
- **Knockback**: Small push-back on hit (2-3 units backward from projectile direction)

### Death & Respawn:
- **At 0 HP**: Play death animation (simple fall/fade)
- **Drop walnuts**: ALL walnuts drop at death location (becomes loot!)
- **Respawn timer**: 3 seconds (countdown on death screen: "3...2...1...")
- **Respawn location**: Random spawn point (prevent spawn camping)
- **Respawn state**: 100 HP, 0 walnuts, clean slate
- **Invulnerability**: 3 seconds after respawn (shimmer effect, can't attack or be attacked)

**Why dropping all walnuts is GOOD:**
- Creates emergent gameplay (rush to loot death sites)
- Rewards the knockout (free walnuts!)
- Makes death meaningful but not devastating
- Creates "high-value zones" dynamically

---

## 🎯 Throwing Mechanics

### Player Throwing:
- **Input**: T key (desktop) / THROW button (mobile)
- **Cost**: 1 walnut (can't throw if inventory empty)
- **Cooldown**: 1.5 seconds (prevents spam)
- **Range**: 15 units max
- **Targeting**:
  - Desktop: Aim with mouse/camera direction (manual control)
  - Mobile: Aim with camera + subtle aim assist (±15° magnetism if target within 30° cone)
- **Animation**: Quick throw motion (use existing if available)

### Projectile Physics:
- **Arc trajectory**: Realistic parabola (1-second flight time)
- **Gravity**: -9.8 m/s² (natural feel)
- **Visual**: Flying walnut mesh, spinning during flight
- **Hit detection**: Raycast each frame, 0.5 unit hit radius
- **On hit**: Particle explosion, damage, sound
- **On miss**: Walnut disappears after 3 seconds (don't litter world)

### NPC Throwing:
- Already implemented: Decision logic, cooldown, inventory check
- Need to add: Spawn actual projectile when `npc_throw` event fires
- NPC accuracy: 70% (imperfect, gives players chance to dodge)
- Same physics/damage as player throws

---

## 🍽️ Eating Mechanics

### Eating:
- **Input**: E key (desktop) / EAT button (mobile)
- **Cost**: 1 walnut (can't eat if inventory empty)
- **Cooldown**: 2 seconds (prevents spam)
- **Healing**: +25 HP (4 eats to full health from 0)
- **Caps at max**: Can't eat at 100 HP (visual feedback: "Already full!")
- **Animation**: Optional quick eating motion (low priority)

### Strategic Considerations:
```
Health: 30 HP, Walnuts: 3, Enemy approaching!

Option A: Eat walnut (30→55 HP), survive longer but less ammo
Option B: Throw walnut, try to knockout first
Option C: Run away, eat while fleeing
```

This creates INTERESTING CHOICES every engagement.

---

## 🎒 Inventory System

### Limits:
- **Players**: 10 walnuts max
- **NPCs**: 5 walnuts max (already implemented)
- **Can't pickup when full**: Visual feedback "Inventory full!"
- **Display**: Walnut icon + number in HUD

### Inventory Management:
- **Pickup**: Walk over walnut, auto-collect (existing)
- **Use**: Throw (T) or Eat (E)
- **Drop on death**: All walnuts
- **Ground loot**: Dropped walnuts have subtle golden glow, pickable for 60s (then despawn)

### Why 10 walnuts?
- **Not too low**: Allows some stockpiling and strategy
- **Not too high**: Forces meaningful choices, can't hoard forever
- **Round number**: Easy to remember and display

---

## 🎨 Walnut Types (Simplified)

### Current: Bush vs Buried
- Bush: Hide/find in bushes, +1 point
- Buried: Hide/find in ground, +3 points

### Proposed: Keep Both Types, Equal Points

**Bush Walnuts:**
- Hide/find location: Bushes
- Hide time: 2 seconds
- Find time: 1 second
- Visibility: More obvious (bush shakes slightly)
- Points: +1 when found
- **Tactical use**: Quick to hide, good for rapid setup

**Buried Walnuts:**
- Hide/find location: Ground anywhere
- Hide time: 3 seconds
- Find time: 2 seconds
- Visibility: Less obvious (small mound)
- Points: +1 when found (CHANGED from +3)
- **Tactical use**: Better for long-term hiding, less visible

**Why equal points?**
- **Simplicity**: One rule "find walnut = +1"
- **Clarity**: No need to remember which is worth more
- **Balance**: Tactical differences (speed vs stealth) are reward enough
- **User feedback**: "I don't know that hidden in ground or bush should make a difference in points"

The types still feel different (speed vs stealth) without arbitrary scoring differences.

---

## 🎯 Core Gameplay Loop

```
┌─────────────────────────────────────┐
│ SPAWN (100 HP, 0 walnuts)           │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ EXPLORE & GATHER                    │
│ • Search bushes (fast)              │
│ • Search ground (hidden)            │
│ • Find dropped loot (death sites)   │
│ • Earn +1 per walnut found          │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ STRATEGIC CHOICE                    │
│ • Throw? (attack, +2/+5 points)     │
│ • Eat? (heal, survive longer)       │
│ • Save? (more options later)        │
│ • Hide? (create future finds)       │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ COMBAT (Optional but rewarding)     │
│ • Dodge incoming walnuts            │
│ • Throw to damage opponents         │
│ • Eat to sustain in fights          │
│ • Knockout for +5 points            │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ SURVIVE or DIE                      │
│ If alive: Keep playing              │
│ If dead: -2 points, respawn 3s      │
│          Drop all walnuts (loot!)   │
└─────────┬───────────────────────────┘
          │
          └─────► Loop back to EXPLORE
```

**Session Flow:**
- Players can join/leave anytime
- Leaderboard tracks points over session
- No "rounds" or "matches" - persistent world
- Walnuts constantly cycling (found, thrown, eaten, hidden)

---

## 🎭 NPCs (Already Implemented, Needs Projectiles)

### Current NPC System (MVP 7):
- ✅ Server-side AI with behaviors
- ✅ IDLE, WANDER, APPROACH, GATHER states
- ✅ THROW state (has logic, cooldown, targeting)
- ✅ Perception system (detect players, NPCs, walnuts)
- ✅ Walnut inventory (0-5 walnuts)
- ✅ Name tags (cyan gradient, italic)
- ✅ Smooth interpolation and animations

### What MVP 8 Adds:
- ❌ Actual projectile spawning when NPCs throw
- ❌ NPC health (100 HP, same as players)
- ❌ NPCs take damage and die
- ❌ NPCs drop walnuts on death
- ❌ NPC respawn (30s after death as different random character)

### NPC Behavior with Health:
```
NPC Decision Tree (every 2-5 seconds):

If HP < 30 and has walnuts:
  └─> Eat walnut (survival priority)

If has walnuts and enemy in range (5-15 units):
  └─> Throw at enemy (aggression-based probability)

If low on walnuts:
  └─> GATHER (find more walnuts)

Else:
  └─> WANDER or IDLE (chill vibes)
```

NPCs should feel smart but not perfect (70% accuracy, sometimes make bad choices).

---

## 🎮 Controls Summary

| Action | Desktop | Mobile | Cooldown |
|--------|---------|--------|----------|
| Move | WASD / Arrows | Drag joystick | - |
| Find walnut | Space (hold) | FIND button | - |
| Hide walnut | H (hold) | HIDE button | - |
| Throw walnut | T | THROW button | 1.5s |
| Eat walnut | E | EAT button | 2s |
| Chat | C | CHAT button | - |
| Emote | 1-4 | EMOTE menu | - |

**Total: 2 new inputs** (Throw, Eat) - Keeps it simple!

---

## 📱 UI/UX Updates Needed

### HUD (always visible):
```
┌─────────────────────────────────────┐
│ ❤️ ████████░░ 85 HP                  │
│ 🌰 7/10 walnuts                      │
│ 🏆 Points: 23                        │
└─────────────────────────────────────┘
```

### Above Character:
- Health bar (green → yellow → red as HP drops)
- Username + character name
- Damage numbers (float up when hit/hitting)

### Death Screen:
```
╔═══════════════════════════════════╗
║    💀 You were knocked out!       ║
║                                   ║
║    Respawning in 3... 2... 1...   ║
║                                   ║
║    -2 points                      ║
╚═══════════════════════════════════╝
```

### Mobile Controls:
```
Left side: Movement joystick
Right side:
  [FIND] [HIDE]
  [THROW] [EAT]
  [CHAT] [EMOTE]
```

### Status Messages:
- "Inventory full!" (tried to pick up at 10 walnuts)
- "Already at full health!" (tried to eat at 100 HP)
- "No walnuts to throw!" (tried to throw with empty inventory)
- "No walnuts to eat!" (tried to eat with empty inventory)
- "+1 Found walnut!" (found walnut)
- "+2 Hit PlayerName!" (hit opponent)
- "+5 Knockout NPCName!" (knockout)
- "-2 Knocked out!" (died)

---

## ⚖️ Balance Considerations

### What Could Go Wrong:

**Problem**: Spawn camping (killing players right after respawn)
**Solution**:
- Random spawn points (hard to camp all)
- 3-second invulnerability after respawn (optional)
- Spawn away from other players

**Problem**: Walnut scarcity (everyone runs out)
**Solution**:
- Players can hide unlimited walnuts (player-generated content)
- Death drops create loot circulation
- 60-second despawn keeps world from cluttering

**Problem**: Snowballing (rich get richer)
**Solution**:
- Death drops ALL walnuts (resets advantage)
- 10 walnut cap prevents infinite stockpiling
- NPCs compete for walnuts too

**Problem**: Combat required to win
**Solution**:
- Finding walnuts gives points (gatherer playstyle viable)
- Can hide and avoid combat
- Knockout is +5 but finding 5 walnuts is also +5

**Problem**: Too chaotic (constant death)
**Solution**:
- 5 hits to die (not instant death)
- Natural regen helps recovery
- Eating provides sustain
- Can retreat and heal

**Problem**: Too slow/boring
**Solution**:
- NPCs ensure action (they initiate combat)
- Quick respawn (3s) keeps pace up
- Small map encourages encounters

### Tuning Knobs (for iteration):
- Damage per hit (currently 20, could be 15-30)
- Healing per eat (currently 25, could be 20-35)
- Respawn time (currently 3s, could be 2-5s)
- Inventory max (currently 10, could be 5-15)
- Throw cooldown (currently 1.5s, could be 1-3s)
- Point values (flexible, can adjust)
- NPC count (currently ~3, could scale)

---

## 🎪 Whimsy & Tone

**This is a SILLY game about SQUIRRELS throwing WALNUTS.**

### Visual Whimsy:
- Walnuts spin comically while flying
- Hit effects: Cartoon "bonk" particles (stars, sparkles)
- Death animation: Squirrel spins and flops over (not gory)
- Respawn: Pop! Squirrel appears with sparkle effect
- Full inventory: Squirrel juggling walnuts

### Audio Whimsy:
- Throw: "Whoosh!"
- Hit: "Bonk!" or "Thwack!"
- Eat: "Crunch crunch" (cute munching)
- Death: Cartoon "boing" or descending whistle
- Respawn: Magic sparkle sound
- Full health eat attempt: "Burp!" or "Already stuffed!"

### Animation Whimsy:
- Throw: Wind-up and toss
- Eat: Quick nibble animation
- Hit: Flinch/recoil
- Death: Dramatic fall (over-acted)
- Victory: Dance when getting knockout

### Personality Through NPCs:
- Aggressive NPCs: Chase players, throw often
- Timid NPCs: Gather peacefully, flee when hit
- Names: "NPC - Colobus", "NPC - Mandrill" (keeps it light)

**Golden Rule**: If it makes you smile, it's working.

---

## 🛠️ Features to Create/Update

### NEW Features (MVP 8):

**Client-side:**
- [ ] ProjectileManager.ts (new file)
  - Manages flying walnut projectiles
  - Arc physics calculation
  - Hit detection (raycast)
  - Visual effects (spinning walnut mesh)
  - Cleanup on impact/timeout

- [ ] Health system in Game.ts
  - Health property for players/NPCs
  - Health bar rendering (above character + HUD)
  - Damage application on hit
  - Death detection (0 HP)
  - Respawn handling

- [ ] Throw input handling
  - T key listener (desktop)
  - THROW button (mobile)
  - Cooldown tracking (1.5s)
  - Inventory check
  - Send `player_throw` message to server

- [ ] Eat input handling
  - E key listener (desktop)
  - EAT button (mobile)
  - Cooldown tracking (2s)
  - Inventory/HP check
  - Send `player_eat` message to server

- [ ] UI components
  - Health bar HUD element
  - Walnut inventory display
  - Death screen overlay
  - Damage number floaters
  - Mobile THROW/EAT buttons
  - Status messages

- [ ] Visual effects
  - Hit particles
  - Death animation
  - Respawn effect
  - Damage numbers

**Server-side:**

- [ ] Player health tracking in ForestManager.ts
  - Health property in player connection data
  - Natural regen (+1 HP per 5s)
  - Max HP cap (100)

- [ ] NPC health system in NPCManager.ts
  - Health property for NPCs
  - Death handling (drop walnuts, despawn or respawn)
  - Eating behavior (low HP → eat walnut)

- [ ] Throw validation in ForestManager.ts
  - Validate `player_throw` message
  - Check inventory (has walnut?)
  - Check cooldown
  - Calculate trajectory
  - Broadcast `throw` event to all clients
  - Decrement inventory

- [ ] Hit detection in ForestManager.ts
  - Receive `hit` message from client
  - Validate hit (distance, timing)
  - Apply damage to target
  - Broadcast `entity_hit` event
  - Track for scoring

- [ ] Eat validation in ForestManager.ts
  - Validate `player_eat` message
  - Check inventory (has walnut?)
  - Check HP (not at 100?)
  - Apply healing (+25 HP)
  - Broadcast `entity_heal` event
  - Decrement inventory

- [ ] Death handling in ForestManager.ts
  - Detect 0 HP
  - Drop all walnuts at death location
  - Broadcast `entity_death` event
  - Update scoring (-2 points)
  - Start respawn timer (3s)
  - Respawn at random location

- [ ] Scoring updates in Leaderboard.ts
  - Remove hide walnut points
  - Add hit opponent points (+2)
  - Add knockout points (+5)
  - Update death penalty (-2)
  - Normalize find points (+1 regardless of type)

- [ ] Inventory management
  - Track current walnut count (0-10)
  - Prevent pickup at max
  - Drop on death

**Updated Features:**

- [ ] NPC throw behavior (NPCManager.ts)
  - Wire up existing throw logic to spawn projectiles
  - Same ProjectileManager as players

- [ ] Message types (workers/types.ts, client/src/types.ts)
  - `player_throw` message
  - `player_eat` message
  - `hit` message (client reports hits)
  - `entity_hit` broadcast (server confirms)
  - `entity_heal` broadcast
  - `entity_death` broadcast
  - `entity_respawn` broadcast

- [ ] Mobile UI (TouchControls.ts)
  - Add THROW button
  - Add EAT button
  - Position near existing controls

- [ ] Settings/Controls guide (SettingsManager.ts)
  - Document T key (throw)
  - Document E key (eat)

---

## 📋 Implementation Phases (Refined)

### Phase 1: Projectile Foundation (3-4 hours)
**Goal**: Flying walnuts work for both players and NPCs

- Create ProjectileManager class
- Implement arc physics
- Add hit detection (raycast)
- Visual effects (flying walnut, hit particles)
- Wire up NPC throw events (they already have logic)
- Test: NPCs can hit players with projectiles

### Phase 2: Player Throwing (2-3 hours)
**Goal**: Players can throw walnuts

- T key input + mobile THROW button
- Client → Server message (`player_throw`)
- Server validation (inventory, cooldown)
- Server broadcasts throw event
- Client spawns projectile via ProjectileManager
- Inventory decrements on throw
- Test: Players can throw at NPCs/players

### Phase 3: Health & Damage (3-4 hours)
**Goal**: Hits deal damage, death works

- Add health property (players + NPCs)
- Health bar rendering (above character + HUD)
- Damage application on hit (-20 HP)
- Death at 0 HP
- Drop all walnuts on death
- Respawn after 3s at random location
- Test: Can knockout and respawn

### Phase 4: Eating & Healing (1-2 hours)
**Goal**: Can eat walnuts to restore health

- E key input + mobile EAT button
- Client → Server message (`player_eat`)
- Server validation (inventory, HP < 100)
- Apply healing (+25 HP)
- Inventory decrements
- Visual feedback
- Test: Eating restores HP correctly

### Phase 5: Scoring & Polish (2-3 hours)
**Goal**: Scoring rules updated, everything feels good

- Update scoring system (remove hide, add combat)
- Leaderboard reflects new rules
- Visual polish (damage numbers, death screen)
- Audio feedback (throw, hit, eat sounds)
- Mobile UI complete (throw/eat buttons)
- Balance testing
- Bug fixes

**Total: 11-16 hours** (realistic estimate)

---

## ✅ Success Criteria

MVP 8 is complete when:

**Core Mechanics:**
- [ ] Walnuts fly through air with arc physics
- [ ] Players can throw walnuts (T key / mobile)
- [ ] NPCs can throw walnuts (projectiles spawn)
- [ ] Hits deal 20 damage accurately
- [ ] Health bars display correctly
- [ ] Players can eat walnuts (E key / mobile)
- [ ] Eating restores 25 HP
- [ ] Death drops all walnuts
- [ ] Respawn works (3s, random location)
- [ ] Inventory limited to 10 walnuts

**Scoring:**
- [ ] Finding walnut = +1 point (bush or buried)
- [ ] Hitting opponent = +2 points
- [ ] Knockout = +5 points
- [ ] Death = -2 points
- [ ] Hiding walnut = 0 points
- [ ] Leaderboard updates correctly

**Polish:**
- [ ] Damage numbers float up on hit
- [ ] Hit particles/effects
- [ ] Death animation
- [ ] Respawn effect
- [ ] Audio feedback (throw, hit, eat)
- [ ] Mobile UI works (throw/eat buttons)
- [ ] Status messages ("Inventory full!", etc.)

**Balance:**
- [ ] Combat feels fair (not too easy/hard to kill)
- [ ] Gatherer playstyle is viable (can avoid combat)
- [ ] NPCs feel challenging but not OP
- [ ] Death isn't too punishing
- [ ] Walnuts circulation works (no scarcity)

**Fun:**
- [ ] Throwing walnuts feels satisfying
- [ ] Dodging is exciting
- [ ] Choices feel meaningful (throw vs eat)
- [ ] Quick respawn keeps momentum
- [ ] World feels chaotic and alive
- [ ] Makes you smile 😊

---

## 🚧 CURRENT PROGRESS (As of Oct 19, 2025)

### ✅ COMPLETE - Core Combat System

**Server-Side Foundation:**
- [x] PlayerConnection interface extended with health, score, combatStats, invulnerability
- [x] Server-authoritative hit validation (`player_hit` message handler)
  - Distance validation (max 20 units)
  - Invulnerability check (3s spawn protection)
  - Self-hit prevention
  - Server applies damage (-20 HP)
- [x] Combat scoring system:
  - Hit opponent: +2 points
  - Knockout: +5 points (to killer)
  - Death: -2 points (to victim)
- [x] Death handling (`handlePlayerDeath` method):
  - Drops all walnuts at death location
  - Respawns after 3s at random location
  - 3s spawn protection on respawn
- [x] Eat validation (`player_eat` message handler):
  - Inventory validation
  - Health cap validation (can't eat at 100 HP)
  - +25 HP healing
  - Inventory decrement
- [x] Health/score broadcast in `player_update` messages
- [x] Combat stats tracking (hits, knockouts, deaths)

**Client-Side:**
- [x] Client sends `player_hit` to server for validation
- [x] Optimistic damage application (instant feedback)
- [x] All animations go through state machine (collision, throw, eat, pickup)
- [x] Animation state machine fully debugged and working

**Total Implementation:** ~300 lines of code (server + client)

### 🔨 REMAINING WORK

**HIGH PRIORITY:**
1. **Real Leaderboard Integration** (1-2 hours)
   - Replace `getMockLeaderboardData()` with real API call
   - Call Leaderboard Durable Object `/top` endpoint
   - Send score updates to leaderboard (report on changes)
   - Display real player rankings

**MEDIUM PRIORITY (Polish):**
2. **Damage Floaters** (30-45 min)
   - Create VFXManager method for floating damage numbers
   - Spawn "-20" text on hit, floats up and fades
   - Red color, bold font
   - Follow standard game UX patterns

3. **Respawn Invulnerability Visual** (30-45 min)
   - Add shimmer shader to player mesh
   - Apply when `invulnerableUntil > Date.now()`
   - Pulse/glow effect (light blue/white)
   - Fade out as timer expires

4. **Knockback on Hit** (30-45 min)
   - Apply velocity push-back when hit
   - Direction: away from attacker
   - Magnitude: 2-3 units
   - Short duration (0.3s)

**CLEANUP:**
5. **Remove Debug Logs** (15-30 min)
   - Remove all MVP 8 `console.log` for combat features
   - Keep only error/warning logs
   - Clean up commented code

**Estimated Remaining Time:** 3-4 hours

### 📝 NOTES FOR NEXT SESSION

**Testing Priorities:**
1. Hit validation working? (server rejects invalid hits)
2. Scoring accurate? (+2 hit, +5 knockout, -2 death)
3. Death/respawn smooth? (3s countdown, spawn protection)
4. Eat validation working? (can't eat at full HP)
5. Animation state machine stable? (no stuck animations)

**Known Issues:**
- Leaderboard still showing mock data
- No visual feedback for invulnerability
- No damage numbers on hit
- No knockback physics

---

## ✅ Design Decisions (Finalized)

### 1. NPC Respawn
**Decision**: Respawn after 30 seconds as a **different random character**
- Keeps NPC count stable (~3 active at all times)
- Adds variety (don't fight same NPC repeatedly)
- Creates dynamic world (new personalities appear)
- Implementation: On death, start 30s timer, respawn with random characterId

### 2. Invulnerability After Respawn
**Decision**: **3 seconds of invulnerability** with visual indicator
- Prevents spawn camping (fair gameplay)
- Visual: Slight shimmer/glow effect on character
- Shimmer fades as invulnerability expires (clear feedback)
- Can't attack while invulnerable (prevents abuse)

### 3. Knockback on Hit
**Decision**: **Yes, slight push-back**
- Adds physicality and feedback to hits
- Small push (2-3 units backward from projectile direction)
- Makes combat more dynamic (position matters)
- Helps visualize "I got hit!" without looking at HP

### 4. Throw Charging
**Decision**: **Keep it instant** (press T, throws immediately)
- Simpler mechanics (easier to learn)
- Faster paced combat (no charge time)
- Can iterate to charged throws in future if needed
- Cooldown (1.5s) provides pacing instead

### 5. Mobile Throwing Aim
**Decision**: **Aim assist (slight magnetism)** but balanced vs desktop
- Desktop: Aim with camera direction (full manual control)
- Mobile: Aim at camera direction + subtle aim assist (±15° magnetism to nearest target)
- **Balance**: Aim assist only activates if target within 30° cone
- **Not auto-aim**: Player still aims, just gets help with precision
- Keeps mobile competitive without making it OP

### 6. Walnut Types (Future)
**Decision**: **Keep golden walnuts** for future, **rotten walnuts are a great idea**
- MVP 8: Focus on core mechanics (regular walnuts only)
- MVP 9/10: Add special walnut types
  - Golden walnuts: +50 HP when eaten, +30 damage when thrown
  - Rotten walnuts: Confuse/slow opponent when hit
- Keeps MVP 8 scope manageable

### 7. Death Drops Visibility
**Decision**: **Subtle glow/highlight** for better visibility
- Dropped walnuts have faint golden glow (easier to spot loot)
- Not too bright (keeps natural aesthetic)
- Helps players find death site loot (key mechanic)
- 60-second lifetime (then despawn)

### 8. Combat Opt-Out
**Decision**: **No safe zones, no pacifist mode** (open-world PvP)
- Opt-in PvP via player choice (can run/hide)
- Encourages emergent gameplay (alliances, territories)
- Matches game's chaotic, whimsical tone
- Death penalty is light (-2 points), so risk is acceptable

---

## 🎯 What Happens After MVP 8?

With combat complete, the game loop is DONE:
- ✅ Exploration (movement, world)
- ✅ Gathering (finding walnuts)
- ✅ Hiding (creating content)
- ✅ Social (chat, emotes, multiplayer)
- ✅ NPCs (world life)
- ✅ Combat (throwing, health, death)
- ✅ Survival (eating, healing)
- ✅ Competition (scoring, leaderboard)

**The game is PLAYABLE and FUN.**

Future MVPs add polish and depth:
- MVP 9: Animation polish (optional)
- MVP 10: Predators, power-ups (optional)
- MVP 11: Full authentication (growth)
- MVP 12: Advanced systems (scale)

But after MVP 8, we have a **real game** that people can play and enjoy.

---

**This is going to be fun.** 🌰🐿️⚔️
