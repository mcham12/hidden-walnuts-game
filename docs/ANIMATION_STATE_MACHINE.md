# Animation State Machine Design

## Problem Analysis

Current system has **scattered animation control** across multiple boolean flags and methods:
- 5 different boolean flags (`isDead`, `isStunned`, `isEatingWalnut`, `emoteInProgress`, `isPlayingOneShotAnimation`)
- Animation changes triggered from 9+ different locations
- `playOneShotAnimation()` doesn't know what to return to
- Watchdog systems needed to detect stuck states

## Core Insight

Animations fall into TWO categories:
1. **PERSISTENT** (base layer): idle, walk, run - continuous, determined by input
2. **TEMPORARY** (override layer): hit, eat, throw, emote, death - play once, then return

## Design: Two-Layer Animation System

### Architecture
```
OVERRIDE LAYER (temporary)
    ↓  (when null or expired)
BASE LAYER (persistent)
```

### State Structure
```typescript
interface AnimationState {
  // Base layer - always updated based on movement
  baseAnimation: 'idle' | 'walk' | 'run';

  // Override layer - temporary animations
  overrideAnimation: string | null;
  overrideEndTime: number | null;  // when it expires
  overridePriority: number;         // prevent low-priority interrupting high

  // Movement blocking
  blocksMovement: boolean;          // true during eat, hit, etc.
}
```

### Priority System
```
Priority 3: DEAD (blocks everything)
Priority 2: STUN (hit, fear)
Priority 1: EMOTE/ACTION (eat, throw, emote)
Priority 0: IDLE_VARIATION (subtle animations)
```

Higher priority can interrupt lower priority.

### Animation Flow

1. **Every frame**: Update base animation based on velocity/input
2. **On temporary animation request**:
   - Check priority vs current override
   - If priority >= current, set override
   - Set endTime = now + duration
3. **Every frame**: Check if override expired
   - If expired, clear override
   - Play baseAnimation

### Key Benefits
1. **Base layer always correct** - automatically returns to right animation
2. **Single update point** - one method handles all logic
3. **No boolean flags** - priority system replaces them
4. **Self-recovering** - expired overrides automatically clear
5. **Predictable** - easy to reason about

## Implementation Plan

### Phase 1: Add State System (Non-Breaking)
- Add `AnimationState` interface
- Add `animState` property to Game class
- Add `updateAnimationState()` method (called from game loop)
- Add `requestAnimation()` method (replaces scattered calls)
- Keep old system working in parallel

### Phase 2: Migration Points
Migrate in order of risk (safest first):

1. ✅ Emotes → use `requestAnimation('jump', PRIORITY_EMOTE, duration)`
2. ✅ Eat/Throw → use `requestAnimation('eat', PRIORITY_ACTION, duration)`
3. ✅ Hit/Fear → use `requestAnimation('hit', PRIORITY_STUN, duration)`
4. ✅ Death → use `requestAnimation('death', PRIORITY_DEAD, duration)`
5. ✅ Movement → update base layer in `updatePlayer()`
6. ✅ Idle variations → use PRIORITY_IDLE_VARIANT

### Phase 3: Clean Up
- Remove old flags (`isStunned`, `isEatingWalnut`, etc)
- Remove `playOneShotAnimation()`
- Remove watchdog systems (no longer needed)
- Remove `resetAnimationState()` (no longer needed)

### Phase 4: Polish
- Add animation blending if needed
- Performance optimization

## Code Changes Required

### New Code (~100 lines)
```typescript
// Priority constants
const ANIM_PRIORITY_DEAD = 3;
const ANIM_PRIORITY_STUN = 2;
const ANIM_PRIORITY_ACTION = 1;
const ANIM_PRIORITY_IDLE_VARIANT = 0;

// State interface
interface AnimationState {
  baseAnimation: string;
  overrideAnimation: string | null;
  overrideEndTime: number | null;
  overridePriority: number;
  blocksMovement: boolean;
}

// Methods
private updateAnimationState(delta: number): void;
private requestAnimation(name: string, priority: number, duration: number, blocksMovement: boolean): boolean;
private clearOverride(): void;
private playAnimation(name: string): void;
```

### Modified Code
- `updatePlayer()` - update base layer
- All animation trigger points - use `requestAnimation()`
- Movement input handling - check `blocksMovement`

### Removed Code
- 5 boolean flags (~5 lines declarations + ~50 lines usage)
- `playOneShotAnimation()` (~40 lines)
- `resetAnimationState()` (~40 lines)
- Watchdog systems (~40 lines)
- Scattered `setAction()` calls (~20 locations)

**Net change**: ~+100 new, ~-200 old = **-100 lines total** (cleaner!)

## Testing Strategy

1. Test each migration point individually
2. Verify smooth transitions
3. Check priority interrupts work
4. Confirm movement blocking works
5. Test edge cases (rapid state changes, death during emote, etc)

## Rollback Plan

Keep old system in place during Phase 1. If issues found, revert migrations one by one.
