# MVP 9: Leaderboard Admin Tools - Implementation Guide

## Overview
Industry-standard leaderboard reset system with archival, anti-cheat, and admin controls.

## Features Implemented

### 1. **Automatic Weekly Reset** (Industry Standard: Monday 00:00 UTC)
- Archives top 100 players before reset
- Configurable via environment variables
- Runs via Cloudflare Cron Triggers

### 2. **Manual Admin Reset**
- Authenticated via `ADMIN_SECRET` environment variable
- Archives leaderboard before reset
- Optional admin notes for tracking resets

### 3. **Leaderboard Archival** (PlayFab Pattern)
- Saves to KV storage with 90-day retention
- Keeps last 12 archives (configurable)
- Includes top 100 players, timestamps, reset type

### 4. **Anti-Cheat Validation** (Server-Authoritative)
- Rate limiting: Max 100 points/minute
- Absolute score cap: 100,000 points
- Suspicious activity logging

### 5. **Cleanup Tool**
- Removes corrupted entries
- Removes stale inactive players (>90 days with 0 score)
- Admin-authenticated

---

## Setup Instructions

### Step 1: Create KV Namespace

```bash
# Development environment
npx wrangler kv:namespace create "LEADERBOARD_ARCHIVES"

# Production environment
npx wrangler kv:namespace create "LEADERBOARD_ARCHIVES" --env production
```

**Important**: Copy the namespace ID from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "YOUR_KV_ID_HERE"  # Replace with actual ID
```

### Step 2: Set Admin Secret

```bash
# Development (add to .env or wrangler secret)
npx wrangler secret put ADMIN_SECRET

# Production
npx wrangler secret put ADMIN_SECRET --env production
```

When prompted, enter a strong secret (e.g., generated with `openssl rand -hex 32`).

### Step 3: Deploy

```bash
npm run build
npx wrangler deploy
```

---

## API Endpoints

### 1. Manual Reset (Admin Only)

**Request:**
```bash
POST https://your-api.workers.dev/api/leaderboard/reset
Headers:
  X-Admin-Secret: YOUR_SECRET_HERE
  Content-Type: application/json
Body:
{
  "note": "Season 1 end - top player was Alice123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Leaderboard reset and archived",
  "archiveKey": "manual-2025-10-26-1729958400000",
  "resetCount": 1
}
```

### 2. Get Archives

**Request:**
```bash
GET https://your-api.workers.dev/api/leaderboard/archives?limit=5
```

**Response:**
```json
{
  "archives": [
    {
      "key": "weekly-2025-10-21-1729468800000",
      "timestamp": 1729468800000,
      "resetType": "weekly",
      "playerCount": 142,
      "topPlayers": [
        { "playerId": "alice123", "score": 523, "rank": 1 },
        { "playerId": "bob456", "score": 487, "rank": 2 }
      ]
    }
  ],
  "count": 1
}
```

### 3. Cleanup Corrupted Entries (Admin Only)

**Request:**
```bash
POST https://your-api.workers.dev/api/leaderboard/cleanup
Headers:
  X-Admin-Secret: YOUR_SECRET_HERE
```

**Response:**
```json
{
  "success": true,
  "removed": 3,
  "remaining": 139
}
```

### 4. Get Top Players (Public)

**Request:**
```bash
GET https://your-api.workers.dev/api/leaderboard/top?limit=10
```

**Response:**
```json
{
  "leaderboard": [
    { "playerId": "alice123", "score": 523, "walnuts": {"hidden": 12, "found": 45}, "rank": 1 }
  ],
  "count": 10,
  "totalPlayers": 142,
  "lastResetAt": 1729468800000,
  "resetCount": 4
}
```

---

## Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
# Enable/disable weekly auto-reset
LEADERBOARD_RESET_ENABLED = "true"

# Day of week for reset (0=Sunday, 1=Monday, etc.)
LEADERBOARD_RESET_DAY = "1"  # Monday

# Number of archives to keep (older ones deleted)
LEADERBOARD_ARCHIVE_LIMIT = "12"  # 12 weeks
```

### Cron Schedule (wrangler.toml)

```toml
[triggers]
crons = ["0 0 * * 1"]  # Monday at 00:00 UTC
```

To change the schedule:
- Daily: `"0 0 * * *"`
- Weekly (Sunday): `"0 0 * * 0"`
- Monthly: `"0 0 1 * *"`

---

## Anti-Cheat Details

### Rate Limiting
- **Max Score Increase**: 100 points/minute
- **Detection**: Compares score delta vs time delta
- **Action**: Rejects update with HTTP 429

Example log:
```
⚠️ Suspicious score increase rate: player123 gained 500 points in 2.5 minutes (200 pts/min)
```

### Absolute Limits
- **Max Score**: 100,000 points
- **Min Score**: 0 points
- **Detection**: Validates on every score report
- **Action**: Rejects update with HTTP 400

### Server-Authoritative
- All score changes validated server-side
- Client cannot directly modify scores
- Durable Object ensures atomic operations

---

## Archive Retention

### Storage Details
- **Location**: Cloudflare KV (key-value store)
- **Retention**: 90 days (automatic expiration)
- **Limit**: Last 12 archives (configurable)
- **Size**: ~50KB per 100 players

### Archive Naming
```
{resetType}-{YYYY-MM-DD}-{timestamp}
```

Examples:
- `weekly-2025-10-21-1729468800000`
- `manual-2025-10-26-1729958400000`
- `monthly-2025-11-01-1730419200000`

### Cleanup Logic
1. List all archives in KV
2. Sort by timestamp (embedded in key name)
3. Keep last N (LEADERBOARD_ARCHIVE_LIMIT)
4. Delete older archives

---

## Testing

### 1. Test Manual Reset (Local)

```bash
# Start local dev server
npx wrangler dev

# In another terminal, test reset
curl -X POST http://localhost:8787/api/leaderboard/reset \
  -H "X-Admin-Secret: your-test-secret" \
  -H "Content-Type: application/json" \
  -d '{"note": "Test reset"}'
```

### 2. Test Cron Trigger (Local)

```bash
# Manually trigger cron
curl "http://localhost:8787/__scheduled?cron=0+0+*+*+1"
```

### 3. Test Anti-Cheat

```bash
# Send rapid score updates
for i in {1..10}; do
  curl -X POST http://localhost:8787/api/leaderboard/report \
    -H "Content-Type: application/json" \
    -d '{"playerId":"test","score":'$((i*100))',"walnuts":{"hidden":0,"found":0},"updatedAt":'$(date +%s000)'}'
  sleep 0.1
done

# Should see rate limit error on later requests
```

---

## Monitoring

### Key Metrics to Watch

1. **Archive Count**
   - Should stay at LEADERBOARD_ARCHIVE_LIMIT (12)
   - Check: GET /api/leaderboard/archives

2. **Player Count**
   - Monitor growth/decline
   - Check: GET /api/leaderboard/top (totalPlayers field)

3. **Reset Count**
   - Should increment weekly
   - Check: GET /api/leaderboard/top (resetCount field)

4. **Suspicious Activity**
   - Check Cloudflare logs for "⚠️ Suspicious" entries
   - Review rejected score updates (HTTP 429, 400)

### Cloudflare Dashboard

1. Go to Workers & Pages → Your Worker
2. Click "Logs" tab
3. Filter for:
   - `🔄 Starting scheduled` - Cron executions
   - `✅ Leaderboard manually reset` - Admin resets
   - `⚠️ Suspicious` - Anti-cheat triggers
   - `⚠️ Unauthorized reset` - Failed auth attempts

---

## Troubleshooting

### Issue: Cron not running

**Check:**
1. Verify cron syntax in wrangler.toml
2. Check Cloudflare dashboard → Triggers
3. Ensure LEADERBOARD_RESET_ENABLED="true"

**Test manually:**
```bash
curl "https://your-worker.workers.dev/__scheduled?cron=0+0+*+*+1"
```

### Issue: Archives not saving

**Check:**
1. Verify KV namespace ID in wrangler.toml
2. Check binding name matches: `LEADERBOARD_ARCHIVES`
3. Review logs for "⚠️ KV namespace not configured"

**Debug:**
```bash
npx wrangler kv:namespace list
# Should show your namespace
```

### Issue: Admin reset fails

**Check:**
1. ADMIN_SECRET is set correctly
2. Header name: `X-Admin-Secret` (case-sensitive)
3. Compare secret with: `npx wrangler secret list`

**Test:**
```bash
# List all secrets
npx wrangler secret list

# Recreate if needed
npx wrangler secret put ADMIN_SECRET
```

### Issue: Rate limiting too aggressive

**Adjust constants in Leaderboard.ts:**
```typescript
private readonly MAX_SCORE_INCREASE_PER_MINUTE = 200; // Increase limit
```

---

## Migration from Old System

If you had a leaderboard before MVP 9:

### Option 1: Keep existing data (no reset)
- Deploy new code
- Existing scores preserved
- Reset counter starts at 0

### Option 2: Fresh start with archive
1. Manually export current leaderboard:
   ```bash
   curl https://your-api.workers.dev/api/leaderboard/top?limit=1000 > backup.json
   ```

2. Deploy new code

3. Manually reset with note:
   ```bash
   curl -X POST https://your-api.workers.dev/api/leaderboard/reset \
     -H "X-Admin-Secret: YOUR_SECRET" \
     -d '{"note": "Migration to MVP 9 - backed up to backup.json"}'
   ```

---

## Industry Comparison

### Our Implementation vs. Industry Standards

| Feature | Hidden Walnuts | PlayFab | Google Play | Apple Game Center |
|---------|---------------|---------|-------------|-------------------|
| Weekly Reset | ✅ Monday 00:00 UTC | ✅ Configurable | ✅ Saturday PST | ✅ Configurable |
| Archival | ✅ KV Storage | ✅ Azure Storage | ✅ Cloud Storage | ✅ iCloud |
| Anti-Cheat | ✅ Rate limiting | ✅ Advanced ML | ✅ Server-side | ✅ Server-side |
| Admin Tools | ✅ Manual reset | ✅ Full dashboard | ✅ Console | ✅ App Store Connect |
| Retention | 90 days | Unlimited (paid) | 90 days | Unlimited |

**Result**: Our implementation matches industry best practices for indie/casual games.

---

## Future Enhancements (Not in MVP 9)

### Potential Additions:
1. **Multiple Leaderboard Types**
   - All-time (never resets)
   - Monthly (in addition to weekly)
   - Daily (high-engagement games)

2. **Player Notifications**
   - Email top players before reset
   - "Season ending soon" in-game alert

3. **Rewards System**
   - Award badges to top 10 per season
   - Special items for #1 player

4. **Analytics Dashboard**
   - Player engagement trends
   - Score distribution graphs
   - Cheat detection statistics

5. **Grace Period** (PlayFab pattern)
   - Accept score updates for 10min after reset
   - Prevents data loss from in-flight requests

---

## Summary

✅ **Implemented:**
- Weekly automatic reset (Monday 00:00 UTC)
- Manual admin reset with authentication
- Leaderboard archival to KV (90-day retention)
- Anti-cheat rate limiting and validation
- Cleanup tool for corrupted entries
- Cron trigger integration

✅ **Industry-Standard Patterns:**
- PlayFab-style archival before reset
- Google Play-style UTC boundaries
- Server-authoritative scoring
- Configurable retention policies

✅ **Maintainable & Proven:**
- Clean separation of concerns
- Comprehensive error handling
- Extensive logging for debugging
- Well-documented configuration

**Next Steps:**
1. Create KV namespace
2. Set ADMIN_SECRET
3. Deploy to preview
4. Test all endpoints
5. Deploy to production
6. Monitor first weekly reset
