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

Follow these steps **in order**. Do not skip steps.

### Step 1: Create KV Namespace for Leaderboard Archives

This stores historical leaderboard data after resets.

**1.1 Generate a strong secret key (save this somewhere safe)**
```bash
openssl rand -hex 32
```
**Output example:** `a3f2e1d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9f0e1d2`

**Save this** - you'll need it in Step 2.

**1.2 Create the KV namespace**
```bash
npx wrangler kv:namespace create "LEADERBOARD_ARCHIVES"
```

**Expected Output:**
```
🌀 Creating namespace with title "hidden-walnuts-api-LEADERBOARD_ARCHIVES"
✨ Success!
Add the following to your wrangler.toml:
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**1.3 Copy the ID from the output**

In the output above, copy: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (your ID will be different)

**1.4 Update wrangler.toml**

Open `/Users/mattcarroll/Documents/hiddenwalnuts/hidden-walnuts-game/wrangler.toml`

Find this section (around line 27):
```toml
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "leaderboard_archives_dev"  # Will be different for production
```

Replace `leaderboard_archives_dev` with the ID you copied:
```toml
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"  # YOUR ACTUAL ID
```

**Save the file**.

### Step 2: Set Admin Secret in Cloudflare

This authenticates admin operations (reset, cleanup).

**2.1 Set the secret for development/preview**
```bash
npx wrangler secret put ADMIN_SECRET
```

**Prompt will appear:**
```
Enter a secret value:
```

**Paste the secret from Step 1.1** (the output of `openssl rand -hex 32`)

Press Enter.

**Expected Output:**
```
🌀 Creating the secret for the Worker "hidden-walnuts-api-preview"
✨ Success! Uploaded secret ADMIN_SECRET
```

**2.2 Set the secret for production (if deploying to production)**
```bash
npx wrangler secret put ADMIN_SECRET --env production
```

Again, paste the same secret from Step 1.1.

**Verification:**
```bash
npx wrangler secret list
```

**Expected Output:**
```
[
  {
    "name": "ADMIN_SECRET",
    "type": "secret_text"
  },
  {
    "name": "TURNSTILE_SECRET",
    "type": "secret_text"
  }
]
```

You should see `ADMIN_SECRET` in the list.

### Step 3: Build and Deploy

**3.1 Build the project**
```bash
cd /Users/mattcarroll/Documents/hiddenwalnuts/hidden-walnuts-game
npm run build
```

**Expected Output (should end with):**
```
✓ built in X.XXs
```

**3.2 Deploy to Cloudflare**
```bash
npx wrangler deploy
```

**Expected Output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded hidden-walnuts-api-preview (X.XX sec)
Published hidden-walnuts-api-preview (X.XX sec)
  https://hidden-walnuts-api-preview.mattmcarroll.workers.dev
```

**3.3 Verify deployment**

Open your browser to:
```
https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/top
```

**Expected Response:**
```json
{
  "leaderboard": [],
  "count": 0,
  "totalPlayers": 0,
  "lastResetAt": 0,
  "resetCount": 0
}
```

If you see this JSON response, deployment succeeded.

### Step 4: Verify KV Namespace is Working

**4.1 Check KV namespace binding**
```bash
npx wrangler kv:namespace list
```

**Expected Output:**
```
[
  {
    "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "title": "hidden-walnuts-api-LEADERBOARD_ARCHIVES"
  }
]
```

Your namespace should appear in the list.

### Step 5: Test Admin Reset (Optional but Recommended)

**5.1 Get your admin secret**

If you saved it from Step 1.1, use that. Otherwise, generate a new one:
```bash
openssl rand -hex 32
npx wrangler secret put ADMIN_SECRET
```

**5.2 Test manual reset**
```bash
curl -X POST https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/reset \
  -H "X-Admin-Secret: YOUR_SECRET_FROM_STEP_1" \
  -H "Content-Type: application/json" \
  -d '{"note": "Initial deployment test"}'
```

**Replace `YOUR_SECRET_FROM_STEP_1`** with the actual secret.

**Expected Response:**
```json
{
  "success": true,
  "message": "Leaderboard reset and archived",
  "archiveKey": "manual-2025-10-26-1729958400000",
  "resetCount": 1
}
```

If you see this, the reset system works!

**5.3 Verify archive was created**
```bash
curl https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/archives
```

**Expected Response:**
```json
{
  "archives": [
    {
      "key": "manual-2025-10-26-1729958400000",
      "timestamp": 1729958400000,
      "resetType": "manual",
      "playerCount": 0,
      "topPlayers": []
    }
  ],
  "count": 1
}
```

### ✅ Setup Complete

Your leaderboard admin system is now fully configured and deployed!

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
