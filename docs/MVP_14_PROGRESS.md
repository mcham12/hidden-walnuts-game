# MVP 14: Tree Growing Bonuses & Polish - Progress Tracker

**Started**: 2025-11-03
**Status**: 🔄 IN PROGRESS - Backend Complete (70%)
**Last Updated**: 2025-11-03

---

## ⚠️ REFACTOR ALERT - Design Change

**Original Design**: Bonus for maintaining 20 hidden walnuts simultaneously
**New Design**: Bonus for growing 20 trees total (cumulative lifetime achievement)

**Rationale**: Play-tester feedback - cumulative trees grown is more rewarding than simultaneous hidden count

---

## Overview

MVP 14 focuses on rewarding strategic tree growing behavior and fixing critical bugs.

**Key Goals**:
- Incentivize strategic walnut hiding that leads to tree growth
- Reward players for growing 20 trees total (cumulative)
- Add admin configuration for bonus parameters
- Fix golden walnut point award bug
- Polish UI with special bonus announcement

---

## Progress Summary

| Phase | Status | Tasks Complete | Notes |
|-------|--------|----------------|-------|
| Refactoring | ✅ COMPLETE | 6/6 | All refactor tasks complete (commit 4cb5f89) |
| Phase 4: Admin APIs | ✅ COMPLETE | 3/3 | Both endpoints + docs (commits 2808864, f3dc6cc) |
| Phase 3: Special UI | ⏳ NOT STARTED | 0/3 | Custom bonus announcement |
| Phase 5: Bug Fixes | ⏳ NOT STARTED | 0/1 | Golden walnut points fix |
| Phase 6: Testing | ⏳ NOT STARTED | 0/1 | User acceptance testing |

**Overall Progress**: 9/13 tasks complete (69%)

---

## 🔧 Refactoring Plan

### What Changes From Walnut Hiding → Tree Growing

**Old System (implemented but needs refactor)**:
- Track `hiddenWalnutIds: Set<string>` - walnuts currently hidden
- Bonus when 20 walnuts SIMULTANEOUSLY hidden
- Remove from set when picked up or grown

**New System (simpler!)**:
- Track `treesGrownCount: number` - cumulative counter
- Bonus when 20 trees GROWN TOTAL (lifetime achievement)
- Counter only increments, never decrements

### Refactor Tasks

#### ✅ Task R.1: Update Data Structures
- **Status**: COMPLETE (commit 4cb5f89)
- Removed: `hiddenWalnutIds: Set<string>` ✅
- Kept: `bonusMilestones: Set<number>` ✅ (for 20, 40, 60, etc.)
- Added: `treesGrownCount: number` ✅
- **Location**: ForestManager.ts lines 52-54

#### ✅ Task R.2: Refactor Config Object
- **Status**: COMPLETE (commit 4cb5f89)
- Renamed: `walnutHidingBonus` → `treeGrowingBonus` ✅
- Updated: `requiredCount: 20` (trees, not walnuts) ✅
- Updated: `pointsAwarded: 20` (per user feedback) ✅
- **Location**: ForestManager.ts lines 169-173

#### ✅ Task R.3: Remove Walnut Tracking Logic
- **Status**: COMPLETE (commit 4cb5f89)
- Removed: `hiddenWalnutIds.add()` in walnut_hidden handler ✅
- Removed: `hiddenWalnutIds.delete()` in walnut_found handler ✅
- Removed: `hiddenWalnutIds.delete()` in growWalnutIntoTree ✅

#### ✅ Task R.4: Add Tree Growing Counter
- **Status**: COMPLETE (commit 4cb5f89)
- Added: `treesGrownCount++` in growWalnutIntoTree (after owner check) ✅
- Added: Call `checkTreeGrowingBonus()` after incrementing ✅
- **Location**: ForestManager.ts lines 3029-3031

#### ✅ Task R.5: Refactor Bonus Check Method
- **Status**: COMPLETE (commit 4cb5f89)
- Renamed: `checkWalnutHidingBonus` → `checkTreeGrowingBonus` ✅
- Changed: Check `treesGrownCount` instead of `hiddenWalnutIds.size` ✅
- Updated message: "You've grown a thriving forest! +20 bonus points!" ✅
- Updated message type: `tree_growing_bonus` instead of `walnut_hiding_bonus` ✅
- **Location**: ForestManager.ts lines 2233-2264

#### ✅ Task R.6: Storage Persistence
- **Status**: COMPLETE (commit 4cb5f89)
- Saved: `treeGrowingBonus` config to Durable Object storage ✅
- Loaded: Config on Durable Object restart ✅
- **Location**: Storage loading at ForestManager.ts lines 448-451

---

## ✅ Phase 1 & 2: Backend Logic (COMPLETE - Replaced by Refactoring)

**Note**: Phase 1 and 2 were completely replaced by the refactoring tasks (R.1-R.6) above. The simpler tree counter approach eliminated the need for separate Phase 1 and 2 tasks.

**What Was Implemented**:
- ✅ Tree growing counter (`treesGrownCount`) instead of Set tracking
- ✅ Bonus configuration object (`treeGrowingBonus`)
- ✅ Bonus check logic (`checkTreeGrowingBonus()`)
- ✅ Bonus award message with WebSocket notification
- ✅ Score update and leaderboard reporting
- ✅ Milestone tracking to prevent duplicate awards

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
  - Listen for `tree_growing_bonus` message type (updated from walnut_hiding_bonus)
  - Extract bonus amount and message
  - Trigger overlay display
  - Play celebration sound effect (if available)

---

## ✅ Phase 4: Admin Configuration APIs (COMPLETE)

**Goal**: Allow runtime configuration of tree growing bonus parameters

### ✅ Task 4.1: POST /admin/config/tree-growing-count
- **Status**: COMPLETE (commit 2808864)
- **Endpoint**: `POST /admin/config/tree-growing-count`
- **Body**: `{ count: 20 }`
- **Validation**: 1-100 trees ✅
- **Files**: `workers/objects/ForestManager.ts` lines 1207-1248
- **Features**:
  - Admin authentication via X-Admin-Secret header ✅
  - Request validation ✅
  - Storage persistence ✅
  - Returns previous and new values ✅

### ✅ Task 4.2: POST /admin/config/tree-growing-points
- **Status**: COMPLETE (commit 2808864)
- **Endpoint**: `POST /admin/config/tree-growing-points`
- **Body**: `{ points: 20 }`
- **Validation**: 0-1000 points ✅
- **Files**: `workers/objects/ForestManager.ts` lines 1250-1291
- **Features**:
  - Admin authentication via X-Admin-Secret header ✅
  - Request validation ✅
  - Storage persistence ✅
  - Returns previous and new values ✅
  - **Bug Fix**: Fixed auth condition on line 1254 (was `adminSecret ||`, now `!adminSecret ||`)

### ✅ Task 4.3: Update ADMIN_API_REFERENCE.md
- **Status**: COMPLETE (commit f3dc6cc)
- **Files**: `docs/ADMIN_API_REFERENCE.md`
- **Updates**:
  - Added "Tree Growing Configuration" section ✅
  - Documented both endpoints with zsh-safe examples ✅
  - Updated table of contents ✅
  - Emphasized JSON formatting without spaces for shell compatibility ✅

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

## Phase 6: Testing (1 hour)

**Goal**: Test in preview environment

### ⏳ Task 6.1: User Testing
- **Status**: NOT STARTED (pending Phase 3 and 5 completion)
- **Tests**:
  - [ ] Deploy to preview
  - [ ] Grow 20 trees from hidden walnuts, verify bonus awarded
  - [ ] Verify special UI overlay displays correctly (Phase 3)
  - [ ] Test admin APIs to change count/points (Phase 4 complete)
  - [ ] Verify golden walnut fix (Phase 5 pending)
  - [ ] Test on mobile + desktop

---

## Implementation Notes

### Tree Growing System (Implemented)

**PlayerConnection Enhancement:**
```typescript
interface PlayerConnection {
  // ... existing fields
  treesGrownCount: number;         // NEW: Cumulative count of trees grown from player's hidden walnuts
  bonusMilestones: Set<number>;    // NEW: Track awarded bonuses (prevent duplicates)
}
```

**Tree Growing Bonus Logic:**
```typescript
// In growWalnutIntoTree() - after tree successfully grows
ownerPlayer.treesGrownCount++;
await this.checkTreeGrowingBonus(ownerPlayer);

// In checkTreeGrowingBonus()
private async checkTreeGrowingBonus(player: PlayerConnection): Promise<void> {
  const count = player.treesGrownCount;
  const threshold = this.treeGrowingBonus.requiredCount;

  if (count === threshold && !player.bonusMilestones.has(threshold)) {
    player.bonusMilestones.add(threshold);
    player.score += this.treeGrowingBonus.pointsAwarded;

    // Send special bonus message
    this.sendMessage(player.socket, {
      type: 'tree_growing_bonus',
      points: this.treeGrowingBonus.pointsAwarded,
      count: count,
      message: `You've grown a thriving forest! +${this.treeGrowingBonus.pointsAwarded} bonus points!`
    });

    await this.reportScoreToLeaderboard(player);

    // Send score update
    this.sendMessage(player.socket, {
      type: 'score_update',
      score: player.score
    });
  }
}
```

**Key Differences from Original Design**:
- Uses simple counter (`treesGrownCount`) instead of Set tracking
- Counter only increments (never decrements)
- Cumulative lifetime achievement vs temporary state
- Simpler implementation, more rewarding player experience

### Special UI Overlay Ideas (Pending Implementation)

**Creative Messages:**
- "You've grown a thriving forest! 🌳✨"
- "Master tree grower! 🏆"
- "Your forest is flourishing! 🌲🎉"
- "Nature's architect! 🌿"

**Animation Style:**
- Fade in from top with bounce
- Large text with particle effects
- Tree or forest animation
- Green/nature-themed colors
- Golden/sparkle effect
- Auto-dismiss after 3-4 seconds

---

## Success Criteria

MVP 14 is complete when:

- ✅ Players can earn bonus for growing 20 trees total (cumulative)
- ⏳ Special UI overlay announces bonus (not standard toast) - PENDING
- ✅ Admin can configure bonus count and points via API - COMPLETE
- ⏳ Golden walnut point award matches toast message - PENDING
- ⏳ All features tested in preview environment - PENDING
- ✅ Documentation updated - COMPLETE

**Current Status**: 3/6 criteria met (50%)

---

## Timeline

- **Start Date**: 2025-11-03
- **Target Completion**: TBD
- **Estimated Time**: 6-8 hours total (revised after refactoring)
  - ✅ Refactoring: ~2 hours (COMPLETE - commit 4cb5f89)
  - ✅ Phase 4 Admin APIs: ~1.5 hours (COMPLETE - commits 2808864, f3dc6cc)
  - ⏳ Phase 3 UI Overlay: 2-3 hours (PENDING)
  - ⏳ Phase 5 Bug Fix: 30 minutes (PENDING)
  - ⏳ Phase 6 Testing: 1 hour (PENDING)

---

## Next Steps

**Completed**:
1. ✅ Refactor to tree growing system (commit 4cb5f89)
2. ✅ Add admin configuration APIs (commit 2808864)
3. ✅ Update documentation (commit f3dc6cc)
4. ✅ Update MVP_14_PROGRESS.md with completion status

**Remaining**:
1. ⏳ Create special UI overlay for tree growing bonus (Phase 3)
2. ⏳ Fix golden walnut points bug (Phase 5)
3. ⏳ Test in preview environment (Phase 6)

---

**Last Updated**: 2025-11-03 by Claude Code
**Next Update**: After completing Phase 3 (UI overlay)
