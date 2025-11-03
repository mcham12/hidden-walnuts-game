# Admin API Reference

Complete reference for Hidden Walnuts admin endpoints.

**Base URL (Production)**: `https://api.hiddenwalnuts.com`
**Authentication**: All endpoints require `X-Admin-Secret` header

---

## Table of Contents

1. [Game State Management](#game-state-management)
2. [Player Management](#player-management)
3. [Monitoring & Metrics](#monitoring--metrics)
4. [NPC & Predator Control](#npc--predator-control)
5. [Tree Growth Configuration](#tree-growth-configuration)
6. [Leaderboard Management](#leaderboard-management)

---

## Game State Management

### Reset Map State

Resets golden walnut spawn state, forcing them to respawn.

**Endpoint**: `POST /admin/reset-mapstate`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/reset-mapstate \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "message": "mapState reset - golden walnuts will respawn on next connection"
}
```

**Effects**:
- Clears all golden walnut spawn data
- Forces re-initialization on next player connection
- Does NOT affect player-hidden walnuts or trees
- Does NOT affect active predators

**Use Cases**:
- Testing golden walnut spawn logic
- Fixing stuck golden walnut state
- Resetting after game updates

---

### Reset Forest

Regenerates all forest objects (trees, rocks, bushes).

**Endpoint**: `POST /admin/reset-forest`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/reset-forest \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "message": "Forest reset - will regenerate with landmark exclusions on next connection"
}
```

**Effects**:
- Clears all trees, rocks, bushes
- Preserves landmark spawn zones (clear areas)
- Forces regeneration on next player connection
- Predators respawn at random locations

**Use Cases**:
- Testing forest generation algorithm
- Fixing forest object placement issues
- Updating landmark exclusion zones

---

### Reset Player Positions

Resets all player spawn positions to default.

**Endpoint**: `POST /admin/reset-positions`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/reset-positions \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "message": "Player positions reset - players will spawn at default position on next connection"
}
```

**Effects**:
- Clears saved spawn positions for all players
- Players spawn at origin (0, 2, 0) on next login
- Preserves player scores, ranks, and inventory
- Does NOT kick active players

**Use Cases**:
- Testing spawn system
- Fixing players stuck in walls/rocks
- Resetting after map changes

---

## Player Management

### Get Active Players

Returns list of currently connected players with stats.

**Endpoint**: `GET /admin/players/active`
**Auth**: Required

**Request**:
```bash
curl https://api.hiddenwalnuts.com/admin/players/active \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "players": [
    {
      "id": "player-123",
      "username": "Alice",
      "score": 245,
      "rank": "Slick",
      "health": 85,
      "inventory": 3,
      "position": { "x": 12.5, "y": 2, "z": -8.3 },
      "characterId": "colobus",
      "connectedAt": 1699123456789
    },
    {
      "id": "player-456",
      "username": "Bob",
      "score": 102,
      "rank": "Dabbler",
      "health": 100,
      "inventory": 5,
      "position": { "x": -5.2, "y": 2, "z": 15.7 },
      "characterId": "chipmunk",
      "connectedAt": 1699123500000
    }
  ],
  "count": 2,
  "npcs": 3,
  "predators": 2,
  "timestamp": 1699123600000
}
```

**Use Cases**:
- Monitoring active player count
- Checking player locations for bugs
- Identifying players to kick/ban
- Server health monitoring

---

### Kick Player

Force disconnects a player (no ban).

**Endpoint**: `POST /admin/players/:playerId/kick`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/players/player-123/kick \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing admin tools"}'
```

**Body** (optional):
```json
{
  "reason": "Reason for kick (optional, for logs)"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "playerId": "player-123",
  "message": "Player kicked successfully"
}
```

**Effects**:
- Closes player's WebSocket connection
- Player can reconnect immediately
- Does NOT ban or reset player data

**Use Cases**:
- Testing disconnect handling
- Removing disruptive players temporarily
- Forcing reconnection to fix bugs

---

### Reset Player Data

Resets player's score, inventory, and position (keeps username).

**Endpoint**: `POST /admin/players/:playerId/reset`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/players/player-123/reset \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "success": true,
  "playerId": "player-123",
  "message": "Player data reset successfully",
  "newState": {
    "score": 0,
    "rank": "Rookie",
    "inventory": 0,
    "health": 100,
    "position": { "x": 0, "y": 2, "z": 0 }
  }
}
```

**Effects**:
- Resets score to 0 (Rookie rank)
- Clears walnut inventory
- Resets health to 100
- Resets position to spawn
- Preserves username and character selection
- Kicks player if online (forces reconnect with new state)

**Use Cases**:
- Testing new player experience
- Fixing corrupted player data
- Resetting player after cheating investigation

---

## Monitoring & Metrics

### Get Server Metrics

Returns comprehensive server health and game state metrics.

**Endpoint**: `GET /admin/metrics`
**Auth**: Required

**Request**:
```bash
curl https://api.hiddenwalnuts.com/admin/metrics \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "timestamp": 1699123600000,
  "uptime": 43200000,
  "players": {
    "active": 12,
    "peakToday": 45,
    "totalEver": 1234
  },
  "npcs": {
    "active": 3,
    "deathsToday": 15
  },
  "predators": {
    "active": 2,
    "cardinal": 1,
    "toucan": 0,
    "wildebeest": 1,
    "fleeCount": 8
  },
  "walnuts": {
    "hidden": 45,
    "found": 123,
    "golden": 5,
    "treesGrown": 12
  },
  "combat": {
    "projectilesThrown": 456,
    "hits": 234,
    "eliminations": 67
  },
  "leaderboard": {
    "topScore": 1250,
    "topPlayer": "Legend42",
    "weeklyPlayers": 89
  }
}
```

**Use Cases**:
- Server health monitoring
- Game economy analysis
- Performance tracking
- Debugging game state issues

---

### Get Predator Status

Returns details about active predators.

**Endpoint**: `GET /admin/predators`
**Auth**: Required

**Request**:
```bash
curl https://api.hiddenwalnuts.com/admin/predators \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "predators": [
    {
      "id": "predator-1",
      "type": "cardinal",
      "state": "patrol",
      "position": { "x": 25.3, "y": 15.2, "z": -12.8 },
      "targetId": null,
      "spawnTime": 1699120000000,
      "attackCount": 3
    },
    {
      "id": "predator-2",
      "type": "wildebeest",
      "state": "targeting",
      "position": { "x": -18.5, "y": 2, "z": 8.9 },
      "targetId": "player-456",
      "targetUsername": "Bob",
      "spawnTime": 1699121000000,
      "attackCount": 1,
      "annoyanceLevel": 2
    }
  ],
  "count": 2,
  "maxPredators": 2
}
```

**Use Cases**:
- Debugging predator AI
- Monitoring predator spawns
- Checking predator targeting

---

### Reset Metrics

Resets all server metrics to defaults (clears corrupted storage).

**Endpoint**: `POST /admin/reset-metrics`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/reset-metrics \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Metrics reset to defaults",
  "metrics": {
    "treesGrownToday": 0,
    "projectilesThrownToday": 0,
    "hitsToday": 0,
    "npcDeathsToday": 0,
    "predatorFleesCount": 0,
    "peakPlayersToday": 0,
    "totalUniquePlayersEver": 0
  }
}
```

**Effects**:
- Deletes stored metrics from Durable Object storage
- Resets all metrics counters to 0
- Fixes corrupted or null metric values
- Preserves other game state (players, walnuts, forest)

**Use Cases**:
- Fixing corrupted metrics after code updates
- Resetting daily counters manually
- Debugging metrics tracking issues

**Warning**: This resets all historical metric data. Use carefully.

---

## NPC & Predator Control

### Adjust NPC Count

Dynamically change the number of NPCs.

**Endpoint**: `POST /admin/npcs/adjust`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/npcs/adjust \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'
```

**Body**:
```json
{
  "count": 5
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "previousCount": 3,
  "newCount": 5,
  "spawned": 2,
  "message": "NPC count adjusted - spawned 2 new NPCs"
}
```

**Effects**:
- If count > current: Spawns new NPCs
- If count < current: Despawns random NPCs
- NPCs spawn at random forest locations
- New NPCs start with default stats

**Use Cases**:
- Testing NPC scaling with player count
- Adjusting difficulty dynamically
- Testing NPC spawn system

---

### Clear All Predators

Removes all active predators from the game.

**Endpoint**: `POST /admin/predators/clear`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/predators/clear \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "success": true,
  "clearedCount": 2,
  "message": "All predators cleared"
}
```

**Effects**:
- Removes all predators instantly
- Broadcasts despawn to all clients
- New predators will spawn per normal rules
- Does NOT prevent future spawns

**Use Cases**:
- Testing predator spawn system
- Giving players a break during testing
- Fixing stuck/bugged predators

---

### Adjust Predator Count

Dynamically change the number of predators.

**Endpoint**: `POST /admin/predators/adjust`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/predators/adjust \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"count": 3}'
```

**Body**:
```json
{
  "count": 3
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "previousCount": 2,
  "newCount": 3,
  "spawned": 1,
  "despawned": 0,
  "message": "Predator count adjusted - spawned 1 new predators"
}
```

**Effects**:
- If count > current: Spawns new predators (cardinal, toucan, wildebeest rotation)
- If count < current: Despawns random predators
- Predators spawn at random locations
- Broadcasts spawn/despawn to all clients

**Validation**:
- Count must be between 0 and 5
- Invalid count returns 400 error

**Use Cases**:
- Testing predator interactions with varying numbers
- Adjusting difficulty dynamically
- Testing predator spawn system
- Creating challenging scenarios for testing

---

## Tree Growth Configuration

### Set Tree Growth Points

Configure points awarded when a tree successfully grows.

**Endpoint**: `POST /admin/config/tree-growth-points`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/config/tree-growth-points \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"points": 50}'
```

**Body**:
```json
{
  "points": 50
}
```

**Validation**:
- Must be between 0 and 1000
- Default: 20 points

**Response** (200 OK):
```json
{
  "success": true,
  "config": {
    "pointsAwarded": 50,
    "walnutsDropped": 5,
    "growthChance": 100
  },
  "message": "Tree growth points updated to 50"
}
```

**Effects**:
- Updates points awarded immediately
- Affects all future tree growth events
- Persists to Durable Object storage

**Use Cases**:
- Testing game economy balance
- Adjusting difficulty dynamically
- Special events with bonus points

---

### Set Tree Walnut Drops

Configure number of walnuts dropped when a tree grows.

**Endpoint**: `POST /admin/config/tree-walnut-drops`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/config/tree-walnut-drops \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"drops": 10}'
```

**Body**:
```json
{
  "drops": 10
}
```

**Validation**:
- Must be between 0 and 20
- Default: 5 walnuts

**Response** (200 OK):
```json
{
  "success": true,
  "config": {
    "pointsAwarded": 20,
    "walnutsDropped": 10,
    "growthChance": 100
  },
  "message": "Tree walnut drops updated to 10"
}
```

**Effects**:
- Updates walnut drop count immediately
- Affects all future tree growth events
- Persists to Durable Object storage

**Use Cases**:
- Testing walnut economy
- Creating scarcity or abundance
- Special events with bonus walnuts

---

### Set Tree Growth Chance

Configure probability (0-100%) that a hidden walnut will grow into a tree.

**Endpoint**: `POST /admin/config/tree-growth-chance`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/admin/config/tree-growth-chance \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"chance": 75}'
```

**Body**:
```json
{
  "chance": 75
}
```

**Validation**:
- Must be between 0 and 100
- Default: 100% (all hidden walnuts grow)

**Response** (200 OK):
```json
{
  "success": true,
  "config": {
    "pointsAwarded": 20,
    "walnutsDropped": 5,
    "growthChance": 75
  },
  "message": "Tree growth chance updated to 75%"
}
```

**Effects**:
- Updates growth probability immediately
- Uses `Math.random()` RNG check on each growth timer
- If RNG fails: walnut stays hidden forever (players can pick up normally)
- If RNG succeeds: walnut grows into tree (awards points, drops walnuts)
- Persists to Durable Object storage

**Use Cases**:
- Reducing tree spam with many players
- Testing tree growth mechanics
- Adjusting game pace dynamically
- Creating variation in gameplay

**Example Probabilities**:
- `100%` - Every hidden walnut grows (default)
- `75%` - 3 out of 4 hidden walnuts grow
- `50%` - Half of hidden walnuts grow
- `25%` - 1 out of 4 hidden walnuts grow
- `0%` - No trees grow (manual walnut collection only)

---

## Leaderboard Management

### Reset Leaderboard

Manually resets weekly leaderboard (archives current scores).

**Endpoint**: `POST /api/leaderboard/reset`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/api/leaderboard/reset \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"note": "Manual reset for testing"}'
```

**Body** (optional):
```json
{
  "note": "Reason for manual reset"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "archived": "2025-11-01_manual",
  "playersArchived": 89,
  "message": "Leaderboard reset successfully"
}
```

**Effects**:
- Archives current weekly leaderboard to KV
- Clears weekly scores (preserves all-time)
- Updates reset metadata
- Players keep their scores in session until reconnect

**Note**: Scheduled auto-reset runs every Monday at 00:00 UTC.

---

### Cleanup Leaderboard

Removes corrupted or stale entries.

**Endpoint**: `POST /api/leaderboard/cleanup`
**Auth**: Required

**Request**:
```bash
curl -X POST https://api.hiddenwalnuts.com/api/leaderboard/cleanup \
  -H "X-Admin-Secret: YOUR_SECRET"
```

**Response** (200 OK):
```json
{
  "success": true,
  "removed": 3,
  "message": "Cleanup complete - removed 3 corrupted/stale entries"
}
```

**Cleanup Rules**:
- Removes entries with negative scores
- Removes entries with invalid player IDs
- Removes entries not updated in 180 days
- Preserves all valid entries

**Use Cases**:
- Fixing data corruption
- Cleaning up test accounts
- Database maintenance

---

## Error Responses

### 401 Unauthorized

Missing or invalid `X-Admin-Secret`:

```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing admin secret"
}
```

**Fix**: Check your `ADMIN_SECRET` is correct and header is set.

---

### 404 Not Found

Invalid endpoint or player ID not found:

```json
{
  "error": "Not found",
  "message": "The requested resource does not exist"
}
```

**Fix**: Check endpoint path and player ID spelling.

---

### 500 Internal Server Error

Server error during operation:

```json
{
  "error": "Internal server error",
  "message": "Failed to reset forest: storage error"
}
```

**Fix**: Check worker logs with `npx wrangler tail`. May indicate Durable Object issue.

---

## Rate Limiting

All endpoints share a rate limit:
- **Limit**: 100 requests per minute per IP
- **Header**: `X-RateLimit-Remaining` shows requests left
- **Reset**: Counter resets every 60 seconds

**Exceeded Limit** (429 Too Many Requests):
```json
{
  "error": "Rate limit exceeded",
  "message": "Please wait before making more requests"
}
```

---

## Testing Checklist

Before using admin APIs in production:

1. ✅ Test in preview environment first
2. ✅ Verify `ADMIN_SECRET` is set correctly
3. ✅ Check endpoint returns expected response
4. ✅ Test with invalid secret (should return 401)
5. ✅ Check game state after operation
6. ✅ Monitor worker logs for errors
7. ✅ Document any issues found

**Test Command Template**:
```bash
# Test in preview
curl https://your-preview.workers.dev/admin/metrics \
  -H "X-Admin-Secret: PREVIEW_SECRET" \
  | jq .

# If successful, test in production
curl https://api.hiddenwalnuts.com/admin/metrics \
  -H "X-Admin-Secret: PROD_SECRET" \
  | jq .
```
