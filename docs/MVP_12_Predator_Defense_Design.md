# MVP 12: Predator Defense Mechanics Design

**Date**: 2025-01-30
**Status**: Design Approved → Implementation
**Context**: Players need ways to defend against aerial and ground predators without making combat feel grindy or violent. The design should fit the game's casual forest theme.

---

## Core Design Philosophy

**Non-violent, creative defense mechanics:**
- Predators are **driven away**, not killed
- Each predator type has **distinct counterplay**
- Mechanics feel **fair and skill-based**
- Fits the game's **casual, nature-focused theme**

---

## Aerial Predators (Cardinal, Toucan)

### Defense Mechanic: **Distraction by Walnut Throw**

**Concept**: Birds get distracted by thrown walnuts (like cats chasing toys) and fly off to chase them.

### Core Rules

1. **No Health Bar**: Birds don't show any health or damage indicators

2. **Line-of-Sight Requirement**:
   - Bird must be **visible to the local player** when walnut is thrown
   - "Visible" = within player's camera frustum (what they can actually see on screen)
   - Implementation: Use Three.js Frustum.containsPoint() for bird position

3. **Distraction Behavior**:
   - When walnut thrown while bird is visible → bird immediately stops attacking
   - Bird flies toward thrown walnut trajectory
   - Bird enters "DISTRACTED" state
   - Bird follows walnut until it lands + 2 seconds
   - After distraction ends: Bird returns to patrol behavior (doesn't immediately re-target)

4. **Multiple Birds**:
   - Each bird checks independently if it's in view
   - Throw can distract multiple birds if they're all visible
   - Realistic: They all see the same throw

5. **Visual Feedback**:
   - Bird plays "chase" animation
   - Head/eyes track toward walnut
   - Maybe particle effect (sparkle/attention mark)

6. **Audio Feedback**:
   - Excited bird call when distracted (different from attack sound)
   - Chirping as they chase

### Strategic Implications

- **Defensive tool**: Throw walnut to escape when bird is diving
- **Proactive use**: Distract birds before they attack
- **Resource cost**: Uses 1 walnut per distraction
- **Skill element**: Must time throw when bird is on-screen
- **Positioning matters**: Camera angle affects which birds you can distract

---

## Ground Predator (Wildebeest)

### Defense Mechanic: **Annoyance Bar (Drive Away)**

**Concept**: Wildebeest has a "boss-style" bar showing annoyance level. Hit it 4 times with walnuts to annoy it enough that it leaves.

### Core Rules

1. **Annoyance Bar Display**:
   - Boss-style bar at top of screen (similar to boss health bars in games)
   - Label: "Wildebeest Annoyance" or just "Wildebeest"
   - Color: Orange/yellow (not red like health - semantic difference matters)
   - Shows segments/ticks for 4 hits
   - Only visible when wildebeest is actively targeting/attacking a player

2. **Annoyance Mechanics**:
   - Starts at 0/4 when wildebeest spawns
   - Each walnut hit adds +1 annoyance
   - Bar fills: 0 → 1 → 2 → 3 → 4
   - **No decay**: Annoyance persists until driven away (design choice: makes it achievable)

3. **Hit Detection**:
   - Any walnut projectile hit counts
   - From any player (co-op defense possible)
   - Must actually hit wildebeest (not just thrown near it)

4. **At 4 Hits (Bar Full)**:
   - Wildebeest becomes "fed up" and flees
   - Enters "FLEEING" state
   - Stops attacking, runs away from all players
   - Runs toward map edge (50+ units away)
   - Despawns when far enough / out of bounds
   - **Does not die** - just leaves the area

5. **Visual Feedback**:
   - Hit 1-3: Flinch animation, shake head, maybe paw ground
   - Hit 4: Loud bellow, turn animation, run away with dust trail
   - Each hit: Impact particle effect

6. **Audio Feedback**:
   - Hits 1-3: Irritated grunt/snort (escalating intensity)
   - Hit 4: Loud bellow/roar
   - Running away: Galloping sound fading out

### Strategic Implications

- **Teamwork encouraged**: Multiple players can contribute hits
- **Resource investment**: 4 walnuts minimum to drive away
- **Achievable goal**: Clear progress bar shows you're making an impact
- **Risk/reward**: Do you spend walnuts to defend or run away?
- **No grinding**: 4 hits is achievable but not trivial

---

## Technical Implementation Plan

### Phase 1: Server-Side Predator State Updates

**Files to modify:**
- `workers/objects/PredatorManager.ts`
- `workers/objects/ForestManager.ts`

**Changes:**

1. **Add new predator states**:
   ```typescript
   state: 'idle' | 'patrol' | 'targeting' | 'attacking' | 'distracted' | 'fleeing' | 'returning'
   ```

2. **Add annoyance tracking for wildebeest**:
   ```typescript
   interface Predator {
     // ... existing fields
     annoyanceLevel: number; // 0-4 for wildebeest, unused for aerial
     distractedUntil?: number; // Timestamp for aerial distraction end
     distractedByWalnut?: string; // Walnut ID that distracted aerial predator
   }
   ```

3. **Modify `damagePredator()` → `handleWalnutHit()`**:
   - Remove health system entirely
   - For wildebeest: Increment annoyanceLevel
   - At annoyanceLevel === 4: Enter FLEEING state
   - Return hit result for client feedback

4. **Add bird distraction logic**:
   ```typescript
   distractPredator(predatorId: string, walnutId: string, throwerId: string): boolean {
     const predator = this.predators.get(predatorId);
     if (!predator || predator.type === 'wildebeest') return false;

     // Only aerial predators can be distracted
     predator.state = 'distracted';
     predator.distractedByWalnut = walnutId;
     predator.distractedUntil = Date.now() + 2000; // 2 second chase duration
     predator.targetId = null; // Stop targeting player

     return true;
   }
   ```

5. **Update predator AI behavior**:
   - DISTRACTED state: Fly toward walnut trajectory, wait until distractedUntil expires
   - FLEEING state: Run away from players toward map edge, despawn when far enough
   - After distraction/flee: Return to PATROL (not TARGETING - grace period)

### Phase 2: Client-Side Walnut Throw Detection

**Files to modify:**
- `client/src/ProjectileManager.ts`
- `client/src/Game.ts`

**Changes:**

1. **Add line-of-sight check for birds**:
   ```typescript
   // In Game.ts when player throws walnut
   getVisibleAerialPredators(): string[] {
     const frustum = new THREE.Frustum();
     frustum.setFromProjectionMatrix(
       new THREE.Matrix4().multiplyMatrices(
         this.camera.projectionMatrix,
         this.camera.matrixWorldInverse
       )
     );

     const visibleIds: string[] = [];
     for (const [id, predator] of this.predators) {
       if (predator.type === 'wildebeest') continue; // Only aerial

       const position = new THREE.Vector3(
         predator.mesh.position.x,
         predator.mesh.position.y,
         predator.mesh.position.z
       );

       if (frustum.containsPoint(position)) {
         visibleIds.push(id);
       }
     }

     return visibleIds;
   }
   ```

2. **Send visible predator list with throw**:
   ```typescript
   // When throwing walnut
   const visibleBirds = this.getVisibleAerialPredators();
   socket.send(JSON.stringify({
     type: 'throw_walnut',
     // ... existing throw data
     visiblePredators: visibleBirds // New field
   }));
   ```

### Phase 3: Server-Side Walnut Throw Handler

**Files to modify:**
- `workers/objects/ForestManager.ts`

**Changes:**

1. **Handle walnut throw with visible predators**:
   ```typescript
   // In handleThrowWalnut or similar
   if (data.visiblePredators && data.visiblePredators.length > 0) {
     for (const predatorId of data.visiblePredators) {
       // Distract each visible aerial predator
       this.predatorManager.distractPredator(
         predatorId,
         walnutId,
         playerId
       );
     }

     // Broadcast distraction to all clients
     this.broadcastToAll({
       type: 'predator_distracted',
       predatorIds: data.visiblePredators,
       walnutId: walnutId
     });
   }
   ```

### Phase 4: Projectile Hit Detection

**Files to modify:**
- `client/src/ProjectileManager.ts`

**Changes:**

1. **Add predator collision check** (already exists for NPCs/players):
   ```typescript
   // In projectile update loop
   for (const [predatorId, predator] of this.game.predators) {
     if (predator.type !== 'wildebeest') continue; // Only wildebeest takes hits

     const distance = projectilePos.distanceTo(predator.mesh.position);
     if (distance < 1.5) { // Hit radius
       // Send hit to server
       this.networkSystem.sendMessage({
         type: 'predator_hit',
         predatorId: predatorId,
         projectileId: projectile.id
       });

       // Remove projectile
       this.removeProjectile(projectile.id);
       break;
     }
   }
   ```

### Phase 5: Client-Side Annoyance Bar UI

**Files to modify:**
- `client/src/Game.ts` or create new `client/src/PredatorUI.ts`
- `client/index.html`

**Changes:**

1. **Create annoyance bar HTML**:
   ```html
   <div id="wildebeest-annoyance-bar" style="display: none;">
     <div class="annoyance-label">Wildebeest</div>
     <div class="annoyance-bar-container">
       <div class="annoyance-bar-fill"></div>
     </div>
     <div class="annoyance-ticks">
       <span class="tick"></span>
       <span class="tick"></span>
       <span class="tick"></span>
       <span class="tick"></span>
     </div>
   </div>
   ```

2. **Update bar on server broadcast**:
   ```typescript
   // On 'predator_hit' message from server
   case 'predator_hit':
     this.updateWildebeestAnnoyanceBar(
       data.predatorId,
       data.annoyanceLevel // 0-4
     );
     break;
   ```

3. **Show/hide bar based on targeting**:
   - Show when wildebeest is targeting any player
   - Hide when wildebeest is idle/patrol/fleeing
   - Or: Only show when targeting local player

### Phase 6: Visual & Audio Polish

**Files to modify:**
- `client/src/Game.ts`
- `client/src/AudioManager.ts`

**Changes:**

1. **Bird distraction visuals**:
   - Play "chase" animation if available
   - Rotate bird to face walnut trajectory
   - Add particle effect (sparkle/attention mark above head)

2. **Wildebeest hit visuals**:
   - Play flinch animation
   - Shake/rotate head
   - Impact particle effect at hit location
   - At 4th hit: Play bellow animation + flee

3. **Audio cues**:
   - Bird distraction: Excited chirp/call
   - Wildebeest hits 1-3: Escalating grunts
   - Wildebeest hit 4: Loud bellow
   - Fleeing: Galloping sound fading out

### Phase 7: Message Cooldown

**Files to modify:**
- `client/src/Game.ts` (or wherever "can't eat when dead" message is shown)

**Changes:**

1. **Add cooldown tracking**:
   ```typescript
   private lastDeadEatMessageTime: number = 0;
   private readonly DEAD_EAT_MESSAGE_COOLDOWN = 3000; // 3 seconds

   // When player tries to eat while dead
   if (this.playerHealth <= 0) {
     const now = Date.now();
     if (now - this.lastDeadEatMessageTime >= this.DEAD_EAT_MESSAGE_COOLDOWN) {
       this.showMessage("You can't eat when you're dead!");
       this.lastDeadEatMessageTime = now;
     }
     return;
   }
   ```

---

## Testing Checklist

### Bird Distraction
- [ ] Bird in view + throw walnut → bird chases walnut
- [ ] Bird out of view + throw walnut → bird NOT distracted
- [ ] Multiple birds in view → all distracted by one throw
- [ ] Bird distracted → returns to patrol after 2 seconds
- [ ] Bird distracted → doesn't immediately re-target player

### Wildebeest Annoyance
- [ ] Hit wildebeest → annoyance bar appears and fills 25%
- [ ] Hit 4 times → wildebeest flees and despawns
- [ ] Multiple players can contribute hits
- [ ] Annoyance doesn't decay over time
- [ ] Bar only shows when wildebeest is targeting/attacking
- [ ] At 4 hits → plays flee animation + sound

### Message Cooldown
- [ ] Try to eat while dead → message shows
- [ ] Try again within 3 seconds → no message
- [ ] Try after 3 seconds → message shows again

### Audio/Visual
- [ ] Birds play excited sound when distracted
- [ ] Wildebeest grunts on hits 1-3
- [ ] Wildebeest bellows on hit 4
- [ ] Impact particles on wildebeest hits
- [ ] Fleeing animation plays correctly

---

## Open Questions / Future Enhancements

1. **Bird re-spawn**: How long after distraction before birds can spawn again?
2. **Wildebeest cooldown**: After fleeing, how long before a new wildebeest can spawn?
3. **Walnut recovery**: Can players pick up walnuts after they land (from distraction throws)?
4. **Co-op bonus**: Should there be bonus effects when multiple players hit same wildebeest?
5. **Rank scaling**: Should higher-ranked players need more hits to drive away wildebeest?

---

## Design Rationale

**Why this design?**

1. **Non-violent**: Fits the game's forest/nature theme better than killing animals
2. **Distinct mechanics**: Each predator type requires different strategy
3. **Skill-based**: Bird distraction requires awareness + timing
4. **Fair feedback**: Annoyance bar shows clear progress
5. **Resource cost**: Encourages walnut gathering (4+ walnuts to defend)
6. **Co-op friendly**: Multiple players can help drive away wildebeest
7. **Creative problem-solving**: More interesting than "shoot until dead"

**Industry inspiration:**
- Zelda: Distraction mechanics (throw items to redirect enemies)
- Monster Hunter: Drive away rather than kill certain creatures
- Don't Starve: Enemies flee when weakened
- Stardew Valley: Non-lethal animal interactions

---

## Success Metrics

After implementation, this design succeeds if:
- Players understand mechanics without lengthy tutorial
- Feels fair and skill-based (not frustrating)
- Creates "close call" exciting moments
- Encourages walnut gathering/management
- Fits the game's casual, nature-focused tone
- Players feel clever when using mechanics effectively
