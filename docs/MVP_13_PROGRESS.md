# MVP 13: Game Admin APIs - Progress Tracker

**Started**: 2025-11-01
**Status**: IN PROGRESS (~20% complete)
**Last Updated**: 2025-11-01

---

## Overview

MVP 13 adds secure admin APIs for game maintenance, monitoring, and moderation.

**Key Goals**:
- Secure all existing admin endpoints with authentication
- Implement new endpoints for player management and monitoring
- Enable game control and debugging capabilities

---

## Progress Summary

| Phase | Status | Tasks Complete | Notes |
|-------|--------|----------------|-------|
| Phase 0: Documentation | ✅ COMPLETE | 2/2 | ADMIN_API_REFERENCE.md and ADMIN_API_SECURITY.md created |
| Phase 1: Security Fix | 🔄 IN PROGRESS | 0/5 | Critical: 3 endpoints lack auth |
| Phase 2: Player APIs | ⏳ NOT STARTED | 0/3 | - |
| Phase 3: Monitoring APIs | ⏳ NOT STARTED | 0/4 | - |
| Phase 4: Testing | ⏳ NOT STARTED | 0/3 | - |

**Overall Progress**: 2/17 tasks complete (12%)

---

## Phase 0: Documentation ✅ COMPLETE

### ✅ Task 0.1: Security Documentation
- **File**: `docs/ADMIN_API_SECURITY.md`
- **Status**: Complete
- **Notes**: Covers secrets vs passwords, calling from terminal/web, preview vs production

### ✅ Task 0.2: API Reference Documentation
- **File**: `docs/ADMIN_API_REFERENCE.md`
- **Status**: Complete
- **Notes**: Complete reference for all 12 endpoints with examples

---

## Phase 1: Critical Security Fix ✅ COMPLETE

**Goal**: Secure the 3 unprotected forest admin endpoints

### ✅ Task 1.1: Add ADMIN_SECRET to ForestManager
- **File**: `workers/types.ts` (line 119)
- **Status**: COMPLETE
- **Action**: Added `ADMIN_SECRET?: string` to Env interface
- **Commit**: Added in current session

### ✅ Task 1.2: Secure /admin/reset-mapstate
- **File**: `workers/objects/ForestManager.ts` (lines 491-501)
- **Status**: COMPLETE
- **Action**: Added X-Admin-Secret header validation
- **Security**: Now requires authentication via X-Admin-Secret header or query param

### ✅ Task 1.3: Secure /admin/reset-forest
- **File**: `workers/objects/ForestManager.ts` (lines 517-526)
- **Status**: COMPLETE
- **Action**: Added X-Admin-Secret header validation
- **Security**: Now requires authentication via X-Admin-Secret header or query param

### ✅ Task 1.4: Secure /admin/reset-positions
- **File**: `workers/objects/ForestManager.ts` (lines 542-551)
- **Status**: COMPLETE
- **Action**: Added X-Admin-Secret header validation
- **Security**: Now requires authentication via X-Admin-Secret header or query param

### 🔄 Task 1.5: Test Existing Endpoints
- **Status**: READY FOR TESTING
- **Tests Needed**:
  - [ ] Deploy to preview environment
  - [ ] Set ADMIN_SECRET in preview
  - [ ] Test with valid ADMIN_SECRET (should succeed)
  - [ ] Test with invalid secret (should return 401)
  - [ ] Test with no secret (should return 401)
  - [ ] Verify mapState reset functionality still works
  - [ ] Verify forest reset functionality still works
  - [ ] Verify positions reset functionality still works
  - [ ] Confirm resets work with predators/NPCs in current game state

---

## Phase 2: Player Management APIs ⏳ NOT STARTED

**Goal**: Implement endpoints for viewing and managing players

### ⏳ Task 2.1: GET /admin/players/active
- **Status**: NOT STARTED
- **Returns**: List of connected players with stats
- **Data**: username, score, rank, health, inventory, position, characterId, connectedAt
- **Also Include**: NPC count, predator count, timestamp
- **Implementation Location**: TBD (ForestManager.ts or separate admin handler)

### ⏳ Task 2.2: POST /admin/players/:playerId/kick
- **Status**: NOT STARTED
- **Action**: Force disconnect player's WebSocket
- **Body**: `{ reason?: string }` (optional, for logging)
- **Behavior**: Player can reconnect immediately (no ban)

### ⏳ Task 2.3: POST /admin/players/:playerId/reset
- **Status**: NOT STARTED
- **Action**: Reset player's score, inventory, health, position
- **Preserve**: Username and character selection
- **Behavior**: Kick player if online to force state refresh

---

## Phase 3: Monitoring & Game Control APIs ⏳ NOT STARTED

**Goal**: Implement endpoints for monitoring and controlling game state

### ⏳ Task 3.1: GET /admin/metrics
- **Status**: NOT STARTED
- **Returns**: Comprehensive server and game state metrics
- **Data Sections**:
  - Server: timestamp, uptime
  - Players: active count, peak today, total ever
  - NPCs: active count, deaths today
  - Predators: active count, by type, flee count
  - Walnuts: hidden count, found count, golden count, trees grown
  - Combat: projectiles thrown, hits, eliminations
  - Leaderboard: top score, top player, weekly players

### ⏳ Task 3.2: GET /admin/predators
- **Status**: NOT STARTED
- **Returns**: Details about active predators
- **Data**: id, type, state, position, targetId, targetUsername, spawnTime, attackCount, annoyanceLevel
- **Also Include**: count, maxPredators

### ⏳ Task 3.3: POST /admin/npcs/adjust
- **Status**: NOT STARTED
- **Body**: `{ count: number }`
- **Action**: Dynamically change NPC count
- **Behavior**:
  - If count > current: Spawn new NPCs at random locations
  - If count < current: Despawn random NPCs
- **Response**: previousCount, newCount, spawned/despawned count

### ⏳ Task 3.4: POST /admin/predators/clear
- **Status**: NOT STARTED
- **Action**: Remove all active predators
- **Behavior**:
  - Removes all predators instantly
  - Broadcasts despawn to all clients
  - New predators will spawn per normal rules

---

## Phase 4: Testing & Documentation ⏳ NOT STARTED

**Goal**: Comprehensive testing and documentation updates

### ⏳ Task 4.1: Preview Environment Testing
- **Status**: NOT STARTED
- **Tests**:
  - [ ] Deploy to preview environment
  - [ ] Set ADMIN_SECRET in preview: `npx wrangler secret put ADMIN_SECRET --env preview`
  - [ ] Test all 12 endpoints with valid secret
  - [ ] Test all endpoints with invalid secret (should return 401)
  - [ ] Verify game state changes work correctly
  - [ ] Monitor worker logs for errors: `npx wrangler tail --env preview`

### ⏳ Task 4.2: Production Deployment Testing
- **Status**: NOT STARTED
- **Tests**:
  - [ ] Deploy to production
  - [ ] Verify ADMIN_SECRET is set in production
  - [ ] Smoke test critical endpoints (metrics, active players)
  - [ ] Verify no breaking changes to game functionality

### ⏳ Task 4.3: Documentation Updates
- **Status**: NOT STARTED
- **Actions**:
  - [ ] Review ADMIN_API_REFERENCE.md for accuracy
  - [ ] Add any implementation details discovered during testing
  - [ ] Update MVP_Simple_REVISED.md to mark MVP 13 as complete
  - [ ] Document any known issues or limitations

---

## Implementation Notes

### Authentication Pattern (from Leaderboard.ts)
```typescript
const adminSecret = request.headers.get("X-Admin-Secret");
if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
  return new Response(JSON.stringify({
    error: "Unauthorized",
    message: "Invalid or missing admin secret"
  }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}
```

### Environment Variable Access
- Leaderboard.ts already has `ADMIN_SECRET` in Env interface
- ForestManager.ts needs to add it
- Both can use same secret value via Cloudflare Workers environment

### Testing Commands
```bash
# List secrets
npx wrangler secret list
npx wrangler secret list --env preview

# Set secret
npx wrangler secret put ADMIN_SECRET
npx wrangler secret put ADMIN_SECRET --env preview

# Test endpoint
curl https://api.hiddenwalnuts.com/admin/metrics \
  -H "X-Admin-Secret: YOUR_SECRET" \
  | jq .
```

---

## Issues & Blockers

### Active Issues
1. **CRITICAL**: 3 forest endpoints currently unprotected (anyone can call them)
2. **Admin secret unknown**: Need to recover or set new ADMIN_SECRET for both preview and production
3. Need to determine best location for new endpoints (ForestManager vs separate admin handler)
4. Player kick functionality requires access to WebSocket connections

### Secret Recovery Plan
If you don't know your current ADMIN_SECRET:

**Option 1: Check if secret exists (shows name only, not value)**
```bash
npx wrangler secret list                    # Production
npx wrangler secret list --env preview      # Preview
```

**Option 2: Set a new secret (RECOMMENDED)**
```bash
# Set new secret for production
npx wrangler secret put ADMIN_SECRET
# You'll be prompted to enter the secret value

# Set new secret for preview
npx wrangler secret put ADMIN_SECRET --env preview
# You'll be prompted to enter the secret value
```

**Important Notes**:
- `wrangler secret list` only shows secret *names*, never values
- If you forgot your secret, you must set a new one
- Use different secrets for preview vs production (security best practice)
- Store the new secret in a password manager
- The leaderboard endpoints are already using ADMIN_SECRET, so setting a new one will change their auth too

**After setting new secret**:
- Update any saved curl commands with new secret
- Test leaderboard endpoints to confirm they still work
- Document secret location (password manager, etc.)

### Resolved Issues
- None yet

---

## Deferred Features (Out of Scope for MVP 13)

These features were in initial planning but deferred to future MVPs:

- **Ban/Unban System**: Not in current MVP 13 spec
- **Spawn Walnut Endpoint**: Not prioritized
- **Rate Limiting**: Deferred (100 req/min per documentation)
- **Admin Web Dashboard**: Deferred to future MVP
- **Audit Logging**: Deferred to future MVP
- **CORS Restrictions**: Currently uses wildcard, can tighten later

---

## Success Criteria

MVP 13 is complete when:

- ✅ All existing admin endpoints secured with authentication
- ✅ 7 new admin endpoints implemented and tested
- ✅ All endpoints work in preview and production
- ✅ Documentation matches implementation
- ✅ No critical security vulnerabilities
- ✅ Admin can monitor and manage game from terminal

---

## Timeline

- **Start Date**: 2025-11-01
- **Target Completion**: TBD
- **Estimated Time**: 6-8 hours total
  - Phase 1: 0.5-1 hour
  - Phase 2: 2-3 hours
  - Phase 3: 2-3 hours
  - Phase 4: 1 hour

---

## Next Steps

1. ✅ Create this progress tracking document
2. 🔄 Add ADMIN_SECRET to ForestManager Env interface
3. ⏳ Add authentication to 3 forest endpoints
4. ⏳ Test secured endpoints
5. ⏳ Implement player management APIs
6. ⏳ Implement monitoring APIs
7. ⏳ Comprehensive testing in preview
8. ⏳ Deploy to production

---

**Last Updated**: 2025-11-01 by Claude Code
**Next Update**: After completing Phase 1 tasks
