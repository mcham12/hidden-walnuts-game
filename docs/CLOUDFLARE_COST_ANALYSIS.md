# Cloudflare Workers Cost Analysis & Containment

## 🚨 CRITICAL ISSUE: 500,000 Requests/Day with Zero Players

**Date**: 2025-01-19
**Severity**: CRITICAL - Burning money with no users
**Impact**: ~500k requests/day = Potential $50+/month waste on idle processing

---

## 🔍 Root Cause Analysis

### Primary Issue: NPC Alarm Loop Running Forever

**Location**: `workers/objects/ForestManager.ts:241-293`

**The Problem**:
```typescript
async alarm(): Promise<void> {
  const now = Date.now();

  // Update NPCs every 200ms (5 Hz)
  if (now - this.lastNPCUpdate >= this.NPC_UPDATE_INTERVAL) {
    this.npcManager.update();  // NPCs update even with 0 players
    this.lastNPCUpdate = now;
  }

  // Check player disconnects every 10s
  // ... (only runs every 10s)

  // ⚠️ CRITICAL BUG: Reschedules alarm if NPCs exist, regardless of players
  if (this.activePlayers.size > 0 || this.npcManager.getNPCCount() > 0) {
    await this.storage.setAlarm(Date.now() + this.NPC_UPDATE_INTERVAL);
  }
}
```

**Why This is Catastrophic**:

1. **NPCs spawn on first player connection** (`initializeWorld()` line 752)
2. **NPCs NEVER despawn when players leave** (only despawn at 15+ players, never at 0)
3. **Alarm reschedules itself every 200ms if NPCs exist**
4. **Result**: Infinite alarm loop running 24/7

**Math**:
```
200ms interval = 5 alarms/second
5 alarms/sec × 86,400 seconds/day = 432,000 requests/day
```

This perfectly explains the ~500k requests/day with zero active players!

---

## 📊 Cloudflare Cost Structure (Refresher)

### Durable Objects Pricing:
- **Requests**: $5/month for first 1M, then $0.15 per million
- **Duration (GB-s)**: $12.50/GB-month
- **Key Insight**: **Inactive objects (not handling requests) incur ZERO duration charges**

### What Triggers Billing:
- ✅ HTTP requests to Durable Object
- ✅ WebSocket messages
- ✅ **Alarm invocations** (each alarm = 1 request)
- ✅ Active JavaScript execution
- ❌ Storage alone (no execution)

### What Prevents Cost Savings:
From Cloudflare docs:
> "Events, for example alarms, incoming requests, and scheduled callbacks using setTimeout/setInterval, can prevent a Durable Object from being inactive and therefore prevent this cost saving."

**Translation**: Continuous alarms = continuous billing, even with 0 players!

---

## 🐛 Secondary Issues Found

### 2. NPC Despawn Logic Flawed

**Location**: `workers/objects/NPCManager.ts:120-129`

```typescript
despawnNPCsIfNeeded(): void {
  const playerCount = this.forestManager.activePlayers.size;

  // Only despawns if >= 15 players (too many humans)
  // NEVER despawns at 0 players!
  if (playerCount >= this.DESPAWN_PLAYER_THRESHOLD && this.npcs.size > 0) {
    for (const [npcId, npc] of this.npcs.entries()) {
      this.broadcastNPCDespawn(npcId);
      this.npcs.delete(npcId);
    }
  }
}
```

**Problem**: NPCs are only despawned when there are TOO MANY players (15+), not when there are ZERO players.

**Result**: NPCs remain active forever after last player leaves.

---

### 3. Position Save Frequency (Already Optimized in MVP 7.1)

**Location**: `workers/objects/ForestManager.ts:417-425`

**Current State** (GOOD):
```typescript
// Throttle position saves to once every 30 seconds
const POSITION_SAVE_INTERVAL = 30000; // 30 seconds
if (timeSinceLastSave >= POSITION_SAVE_INTERVAL) {
  await this.savePlayerPosition(playerConnection.sessionToken, playerConnection.position);
  playerConnection.lastPositionSave = now;
}
```

**Impact**: 99% reduction in storage operations (from 10 Hz to once/30s)
**Status**: ✅ Already optimized in MVP 7.1

---

## 💡 Solutions & Recommendations

### 🔥 IMMEDIATE FIX (Critical - Deploy ASAP)

#### Fix 1: Despawn NPCs When All Players Leave

**Change**: `workers/objects/NPCManager.ts`

Add method to despawn ALL NPCs:
```typescript
/**
 * Despawn all NPCs (called when last player leaves)
 */
despawnAllNPCs(): void {
  if (this.npcs.size === 0) return;

  console.log(`🧹 Despawning all ${this.npcs.size} NPCs (no players remaining)`);

  for (const [npcId, npc] of this.npcs.entries()) {
    this.broadcastNPCDespawn(npcId);
  }

  this.npcs.clear();
}
```

#### Fix 2: Stop Alarm When No Players/NPCs

**Change**: `workers/objects/ForestManager.ts:241-293`

Update alarm() method:
```typescript
async alarm(): Promise<void> {
  const now = Date.now();

  // ⚠️ CRITICAL: Check if we should even be running
  const hasPlayers = this.activePlayers.size > 0;
  const hasNPCs = this.npcManager.getNPCCount() > 0;

  if (!hasPlayers && !hasNPCs) {
    console.log('⏸️ Stopping alarm: No players or NPCs');
    return; // DON'T reschedule - let object go inactive
  }

  // Update NPCs every 200ms (only if they exist)
  if (hasNPCs && now - this.lastNPCUpdate >= this.NPC_UPDATE_INTERVAL) {
    this.npcManager.update();
    this.lastNPCUpdate = now;
  }

  // Check player disconnects every 10 seconds
  if (now - this.lastDisconnectCheck >= DISCONNECT_CHECK_INTERVAL) {
    this.lastDisconnectCheck = now;

    for (const [playerId, player] of this.activePlayers.entries()) {
      const timeSinceActivity = now - player.lastActivity;

      // Remove player completely if inactive for 5+ minutes
      if (timeSinceActivity > REMOVAL_TIMEOUT) {
        console.log(`⏰ Removing player ${playerId} (inactive for ${Math.round(timeSinceActivity / 1000)}s)`);
        this.activePlayers.delete(playerId);
        this.broadcastToOthers(playerId, {
          type: 'player_leave',
          squirrelId: playerId,
          username: player.username,
          characterId: player.characterId
        });

        // 🆕 CRITICAL: If that was the last player, despawn all NPCs
        if (this.activePlayers.size === 0) {
          console.log('👋 Last player removed - despawning all NPCs');
          this.npcManager.despawnAllNPCs();
        }
      }
      // Mark as disconnected if inactive for 60+ seconds
      else if (timeSinceActivity > DISCONNECT_TIMEOUT && !player.isDisconnected) {
        console.log(`⚠️ Marking player ${playerId} as disconnected`);
        player.isDisconnected = true;
        player.disconnectedAt = now;
        this.broadcastToOthers(playerId, {
          type: 'player_disconnected',
          squirrelId: playerId,
          username: player.username,
          characterId: player.characterId
        });
      }
    }
  }

  // 🆕 CRITICAL: Only reschedule if there are active players OR NPCs
  // Re-check after potential NPC despawn above
  if (this.activePlayers.size > 0 || this.npcManager.getNPCCount() > 0) {
    await this.storage.setAlarm(Date.now() + this.NPC_UPDATE_INTERVAL);
  } else {
    console.log('⏸️ Not rescheduling alarm - no players or NPCs (object will go inactive)');
  }
}
```

#### Fix 3: Despawn NPCs on Disconnection

**Change**: `workers/objects/ForestManager.ts` WebSocket onclose handlers

Add NPC despawn check when players disconnect:
```typescript
socket.onclose = () => {
  console.log(`🔌 WebSocket closed for ${squirrelId}, marking as disconnected`);
  playerConnection.isDisconnected = true;
  playerConnection.disconnectedAt = Date.now();

  this.broadcastToOthers(squirrelId, {
    type: 'player_disconnected',
    squirrelId: squirrelId,
    username: playerConnection.username,
    characterId: playerConnection.characterId
  });

  // 🆕 CRITICAL: If no players remain, despawn NPCs immediately
  // (Don't wait for 5-minute timeout - save costs now)
  const connectedPlayers = Array.from(this.activePlayers.values())
    .filter(p => !p.isDisconnected).length;

  if (connectedPlayers === 0) {
    console.log('👋 Last player disconnected - despawning all NPCs immediately');
    this.npcManager.despawnAllNPCs();
  }
};
```

---

### 📈 Expected Impact

**Before Fix**:
- 432,000 requests/day (alarm every 200ms, 24/7)
- NPCs updating constantly with 0 players
- Durable Object never goes inactive
- Cost: ~$50+/month in wasted requests

**After Fix**:
- 0 requests/day with 0 players (object goes inactive)
- NPCs despawn when last player leaves
- Durable Object hibernates (no duration charges)
- Cost: ~$0/month when idle

**Savings**: ~100% of idle costs = $50+/month

---

## 🎯 Additional Optimizations (Nice-to-Have)

### 1. WebSocket Hibernation API (Future)

**Benefit**: Reduce duration charges during sparse WebSocket activity

**Implementation**:
```typescript
// Use Cloudflare's WebSocket Hibernation API
server.accept();
server.hibernate(); // Object can sleep between messages
```

**Impact**: Further reduce duration (GB-s) charges
**Priority**: Medium (after critical fixes)

### 2. Batch NPC Updates (Already in MVP 7.1)

**Current**: Batched updates every 200ms
**Status**: ✅ Already optimized

### 3. Rate Limiting (Already in MVP 7.1)

**Current**: Connection + message rate limiting active
**Status**: ✅ Already implemented

---

## 🧪 Testing Plan

### 1. Verify Alarm Stops

**Test**:
1. Deploy fixes to preview
2. Connect 1 player
3. Verify NPCs spawn (should see 3 NPCs)
4. Disconnect player
5. **Check Cloudflare dashboard**: Alarm requests should STOP after 5 minutes
6. **Check logs**: Should see "Despawning all NPCs" and "Not rescheduling alarm"

**Expected**: Request count drops to 0 within 5 minutes of last player leaving

### 2. Verify NPCs Respawn

**Test**:
1. After NPCs despawned (0 players)
2. New player connects
3. Verify NPCs respawn
4. Verify alarm starts again

**Expected**: NPCs reappear, game works normally

### 3. Monitor Request Count

**Test**:
1. Leave game idle overnight (0 players)
2. Check Cloudflare dashboard next morning
3. Verify request count is 0 or near-0

**Expected**: <100 requests total (vs 432,000 before)

---

## 📋 Deployment Checklist

- [ ] Add `despawnAllNPCs()` method to NPCManager
- [ ] Update `alarm()` method to stop when no players/NPCs
- [ ] Add NPC despawn on last player disconnect
- [ ] Add NPC despawn on last player removal (5min timeout)
- [ ] Test in preview environment
- [ ] Monitor request count for 24 hours
- [ ] Deploy to production
- [ ] Monitor cost savings

---

## 📚 References

- [Cloudflare Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Durable Objects Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [WebSocket Hibernation API](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

---

## 🎓 Key Lessons Learned

1. **Alarms are requests** - Every alarm invocation = 1 billable request
2. **Continuous alarms = continuous billing** - Even with 0 active users
3. **Inactive objects are free** - Objects with no requests/alarms incur $0
4. **Always stop idle processing** - Games/apps should hibernate when unused
5. **Monitor request patterns** - Flat request count 24/7 = idle processing bug
6. **Test with 0 users** - Most cost bugs appear when idle

---

**Bottom Line**: The game was running a 5 Hz alarm loop 24/7 to update NPCs that no one was playing with. This single bug caused ~500k requests/day and $50+/month in wasted costs. The fix is simple: despawn NPCs when the last player leaves and stop the alarm.

**Next Steps**: Implement fixes, test in preview, monitor for 24 hours, then deploy to production.
