# MVP 14: Walnut Hiding Bonuses & Polish - Progress Tracker

**Started**: 2025-11-03
**Status**: 🎯 IN PROGRESS (0%)
**Last Updated**: 2025-11-03

---

## Overview

MVP 14 focuses on rewarding strategic walnut hiding behavior and fixing critical bugs.

**Key Goals**:
- Incentivize walnut hiding with special bonus system
- Add admin configuration for bonus parameters
- Fix golden walnut point award bug
- Polish UI with special bonus announcement

---

## Progress Summary

| Phase | Status | Tasks Complete | Notes |
|-------|--------|----------------|-------|
| Phase 1: Walnut Hiding Tracking | ⏳ NOT STARTED | 0/3 | Track player-hidden walnuts |
| Phase 2: Bonus System | ⏳ NOT STARTED | 0/4 | Implement 20-walnut bonus |
| Phase 3: Special UI | ⏳ NOT STARTED | 0/3 | Custom bonus announcement |
| Phase 4: Admin APIs | ⏳ NOT STARTED | 0/2 | Configuration endpoints |
| Phase 5: Bug Fixes | ⏳ NOT STARTED | 0/1 | Golden walnut points fix |
| Phase 6: Testing | ⏳ NOT STARTED | 0/1 | User acceptance testing |

**Overall Progress**: 0/14 tasks complete (0%)

---

## Phase 1: Walnut Hiding Tracking (2-3 hours)

**Goal**: Track per-player hidden walnut counts

### ⏳ Task 1.1: Add Player Walnut Tracking
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - Add `hiddenWalnutIds: Set<string>` to PlayerConnection interface
  - Track when player hides a walnut
  - Remove from count when walnut is picked up by another player
  - Remove from count when walnut grows into tree
- **Storage**: Persist to Durable Object storage for reconnects

### ⏳ Task 1.2: Update Walnut Pick-Up Logic
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - When walnut is picked up, check if it was player-hidden
  - If yes, remove from original player's hiddenWalnutIds
  - Track who hid each walnut in mapState

### ⏳ Task 1.3: Update Tree Growth Logic
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - When walnut grows into tree, remove from player's hiddenWalnutIds
  - Ensure count decrements properly

---

## Phase 2: Bonus System (3-4 hours)

**Goal**: Award bonus for maintaining 20 hidden walnuts

### ⏳ Task 2.1: Add Bonus Configuration
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  ```typescript
  private walnutHidingBonus = {
    requiredCount: 20,      // Walnuts needed for bonus
    pointsAwarded: 10       // Bonus points
  };
  ```
- **Storage**: Persist configuration to Durable Object storage

### ⏳ Task 2.2: Implement Bonus Check Logic
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - Check after each walnut hide if player reaches requiredCount
  - Award bonus points once per milestone
  - Track bonus awards to prevent duplicate awards
  - Bonus resets if count drops below threshold

### ⏳ Task 2.3: Bonus Award Message
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - Send special message to player when bonus awarded
  - Include creative message (e.g., "Stored enough for winter!")
  - Trigger special UI overlay (handled in Phase 3)

### ⏳ Task 2.4: Score Update & Leaderboard
- **Status**: NOT STARTED
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  - Add bonus points to player score
  - Report to leaderboard
  - Broadcast score update to player

---

## Phase 3: Special UI Overlay (2-3 hours)

**Goal**: Create custom bonus announcement UI (not standard toast)

### ⏳ Task 3.1: Design Bonus Overlay Component
- **Status**: NOT STARTED
- **Files**: `client/src/UI.ts` (or new file)
- **Design**:
  - Full-screen or large centered overlay
  - Animated entrance/exit
  - Creative winter/squirrel theme
  - Auto-dismiss after 3-4 seconds
  - Semi-transparent backdrop

### ⏳ Task 3.2: Implement Overlay HTML/CSS
- **Status**: NOT STARTED
- **Files**: `client/src/UI.ts`, `client/index.html`
- **Implementation**:
  - Create DOM elements dynamically
  - CSS animations (fade in, scale, fade out)
  - Z-index above game but below settings/leaderboard
  - Responsive design (mobile + desktop)

### ⏳ Task 3.3: Connect to WebSocket Message
- **Status**: NOT STARTED
- **Files**: `client/src/main.ts`
- **Implementation**:
  - Listen for `walnut_hiding_bonus` message type
  - Extract bonus amount and message
  - Trigger overlay display
  - Play celebration sound effect (if available)

---

## Phase 4: Admin Configuration APIs (1-2 hours)

**Goal**: Allow runtime configuration of bonus parameters

### ⏳ Task 4.1: POST /admin/config/walnut-hiding-count
- **Status**: NOT STARTED
- **Endpoint**: `POST /admin/config/walnut-hiding-count`
- **Body**: `{ count: 20 }`
- **Validation**: 1-100 walnuts
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**:
  ```typescript
  // Set required walnut count for bonus
  if (path === "/admin/config/walnut-hiding-count" && request.method === "POST") {
    const { count } = await request.json();
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return error(400, "Count must be between 1 and 100");
    }
    this.walnutHidingBonus.requiredCount = count;
    await this.storage.put('walnutHidingBonus', this.walnutHidingBonus);
    return success({ config: this.walnutHidingBonus });
  }
  ```

### ⏳ Task 4.2: POST /admin/config/walnut-hiding-points
- **Status**: NOT STARTED
- **Endpoint**: `POST /admin/config/walnut-hiding-points`
- **Body**: `{ points: 10 }`
- **Validation**: 0-1000 points
- **Files**: `workers/objects/ForestManager.ts`
- **Implementation**: Similar to 4.1, set pointsAwarded

---

## Phase 5: Bug Fixes (30 minutes)

**Goal**: Fix golden walnut point award mismatch

### ⏳ Task 5.1: Fix Golden Walnut Points
- **Status**: NOT STARTED
- **Issue**: Toast says "5 points" but actually awards 1 point
- **Files**: Check both client toast message and server point award
- **Investigation Needed**:
  - Find where golden walnut is picked up
  - Check server-side point award
  - Check client-side toast message
  - Make consistent (probably should be 5 points as toast says)

---

## Phase 6: Documentation & Testing (1 hour)

**Goal**: Document new APIs and test in preview

### ⏳ Task 6.1: Update ADMIN_API_REFERENCE.md
- **Status**: NOT STARTED
- **Files**: `docs/ADMIN_API_REFERENCE.md`
- **Updates**:
  - Add walnut hiding configuration section
  - Document both new endpoints with examples
  - Update table of contents

### ⏳ Task 6.2: User Testing
- **Status**: NOT STARTED
- **Tests**:
  - [ ] Deploy to preview
  - [ ] Hide 20 walnuts, verify bonus awarded
  - [ ] Verify special UI overlay displays correctly
  - [ ] Test admin APIs to change count/points
  - [ ] Verify golden walnut fix
  - [ ] Test on mobile + desktop

---

## Implementation Notes

### Walnut Tracking Strategy

**MapState Enhancement:**
```typescript
interface WalnutState {
  id: string;
  position: { x: number; y: number; z: number };
  found: boolean;
  origin: 'game' | 'player';
  hiddenBy?: string;  // NEW: squirrelId of player who hid it
  hiddenAt?: number;  // NEW: timestamp
}
```

**PlayerConnection Enhancement:**
```typescript
interface PlayerConnection {
  // ... existing fields
  hiddenWalnutIds: Set<string>;  // NEW: Track walnuts hidden by this player
  bonusMilestones: Set<number>;  // NEW: Track awarded bonuses (prevent duplicates)
}
```

### Bonus Award Logic

```typescript
// After player hides walnut
async function onWalnutHidden(playerId: string, walnutId: string) {
  const player = this.activePlayers.get(playerId);
  player.hiddenWalnutIds.add(walnutId);

  const count = player.hiddenWalnutIds.size;
  const threshold = this.walnutHidingBonus.requiredCount;

  // Check if just crossed threshold and hasn't received this bonus yet
  if (count === threshold && !player.bonusMilestones.has(threshold)) {
    player.bonusMilestones.add(threshold);
    player.score += this.walnutHidingBonus.pointsAwarded;

    // Send special bonus message
    this.sendMessage(player.socket, {
      type: 'walnut_hiding_bonus',
      points: this.walnutHidingBonus.pointsAwarded,
      count: count,
      message: `You've stored enough walnuts for winter! +${this.walnutHidingBonus.pointsAwarded} bonus points!`
    });

    await this.reportScoreToLeaderboard(player);
  }
}
```

### Special UI Overlay Ideas

**Creative Messages:**
- "You've stored enough for winter! 🥜❄️"
- "Winter-ready squirrel! 🌰✨"
- "Your hoard is impressive! 🎉"
- "Stockpile master! 🏆"

**Animation Style:**
- Fade in from top with bounce
- Large text with particle effects
- Squirrel icon or walnut animation
- Golden/sparkle effect
- Auto-dismiss after 3 seconds

---

## Success Criteria

MVP 14 is complete when:

- ✅ Players can earn bonus for maintaining 20 hidden walnuts
- ✅ Special UI overlay announces bonus (not standard toast)
- ✅ Admin can configure bonus count and points via API
- ✅ Golden walnut point award matches toast message
- ✅ All features tested in preview environment
- ✅ Documentation updated

---

## Timeline

- **Start Date**: 2025-11-03
- **Target Completion**: TBD
- **Estimated Time**: 8-12 hours total
  - Phase 1: 2-3 hours
  - Phase 2: 3-4 hours
  - Phase 3: 2-3 hours
  - Phase 4: 1-2 hours
  - Phase 5: 30 minutes
  - Phase 6: 1 hour

---

## Next Steps

1. ⏳ Start Phase 1: Add walnut tracking to PlayerConnection
2. ⏳ Implement walnut hiding detection
3. ⏳ Track walnut ownership in mapState
4. ⏳ Implement bonus check logic
5. ⏳ Create special UI overlay
6. ⏳ Add admin configuration APIs
7. ⏳ Fix golden walnut bug
8. ⏳ Test in preview

---

**Last Updated**: 2025-11-03 by Claude Code
**Next Update**: After completing Phase 1
