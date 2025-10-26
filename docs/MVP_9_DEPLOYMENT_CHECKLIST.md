# MVP 9: Leaderboard Admin - Deployment Checklist

## Pre-Deployment Steps

### 1. Create KV Namespace ✅
```bash
# Preview/Development
npx wrangler kv:namespace create "LEADERBOARD_ARCHIVES"

# Note the ID from output, then update wrangler.toml:
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "YOUR_KV_ID_HERE"
```

### 2. Set Admin Secret ✅
```bash
# Generate a strong secret
openssl rand -hex 32

# Set in Cloudflare (preview)
npx wrangler secret put ADMIN_SECRET
# Paste the generated secret when prompted

# Set in Cloudflare (production)
npx wrangler secret put ADMIN_SECRET --env production
```

### 3. Verify Configuration ✅
Check `wrangler.toml` contains:
- [x] KV namespace binding
- [x] Cron trigger (`[triggers]` section)
- [x] Environment variables (LEADERBOARD_RESET_ENABLED, etc.)

---

## Deployment

### Build
```bash
npm run build
```

### Deploy to Preview
```bash
npx wrangler deploy
```

### Deploy to Production
```bash
npx wrangler deploy --env production
```

---

## Post-Deployment Verification

### 1. Test Manual Reset (Authenticated)
```bash
# Replace YOUR_SECRET with your actual admin secret
curl -X POST https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/reset \
  -H "X-Admin-Secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"note": "Initial MVP 9 deployment test"}'
```

**Expected:** `{"success":true,"message":"Leaderboard reset and archived","archiveKey":"manual-2025-10-26-...","resetCount":1}`

### 2. Test Archive Retrieval (Public)
```bash
curl https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/archives
```

**Expected:** `{"archives":[{"key":"manual-2025-10-26-...","timestamp":...}],"count":1}`

### 3. Test Leaderboard (Public)
```bash
curl https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/top
```

**Expected:** `{"leaderboard":[],"count":0,"totalPlayers":0,"lastResetAt":...,"resetCount":1}`

### 4. Test Anti-Cheat Rate Limiting
```bash
# Send multiple rapid score updates
for i in {1..5}; do
  curl -X POST https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/report \
    -H "Content-Type: application/json" \
    -d '{"playerId":"test-player","score":'$((i*50))',"walnuts":{"hidden":0,"found":0},"updatedAt":'$(date +%s000)'}'
  echo ""
  sleep 0.1
done
```

**Expected:** Later requests should be rejected with `{"error":"Score increase rate too high"}`

### 5. Test Unauthorized Reset Attempt
```bash
curl -X POST https://hidden-walnuts-api-preview.mattmcarroll.workers.dev/api/leaderboard/reset \
  -H "X-Admin-Secret: WRONG_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected:** `{"error":"Unauthorized - invalid admin secret"}` with HTTP 401

### 6. Verify Cron Schedule
```bash
# Check Cloudflare dashboard
# Workers & Pages → hidden-walnuts-api-preview → Triggers
# Should show: "0 0 * * 1" (Monday at 00:00 UTC)
```

---

## Monitoring Setup

### 1. Enable Log Streaming
Cloudflare Dashboard → Workers & Pages → Your Worker → Logs

**Watch for:**
- `⏰ Cron triggered:` - Weekly reset started
- `✅ Scheduled reset complete` - Reset succeeded
- `⚠️ Suspicious score increase` - Anti-cheat triggered
- `⚠️ Unauthorized reset` - Failed auth attempt

### 2. Set Up Alerts (Optional)
Cloudflare Dashboard → Notifications

**Alert on:**
- Worker errors > 10/minute
- Cron failures
- High request rate (potential DDoS)

---

## Rollback Plan

If issues occur:

### Option 1: Disable Auto-Reset
```bash
# Update wrangler.toml
LEADERBOARD_RESET_ENABLED = "false"

# Redeploy
npx wrangler deploy
```

### Option 2: Revert Code
```bash
git revert HEAD
npm run build
npx wrangler deploy
```

### Option 3: Restore from Archive
```bash
# 1. Get archive list
curl https://your-api.workers.dev/api/leaderboard/archives

# 2. Download specific archive (manual process)
#    Contact Cloudflare support or use KV API

# 3. Manually import data (requires custom script)
```

---

## First Weekly Reset

The first automatic reset will occur on **Monday, Oct 28, 2025 at 00:00 UTC**.

### What to Expect:
1. Cron triggers at 00:00 UTC
2. Current leaderboard archived to KV
3. All scores reset to 0
4. Metadata updated (lastResetAt, resetCount++)
5. Players see fresh leaderboard

### Monitoring on First Reset:
- **Saturday (2 days before)**: Check leaderboard has data to archive
- **Sunday (1 day before)**: Verify cron schedule in dashboard
- **Monday (reset day)**: Check logs for successful reset
- **Monday afternoon**: Verify archives contain previous data

---

## Troubleshooting

### Issue: KV namespace not found

**Symptoms:** Logs show "⚠️ KV namespace not configured"

**Fix:**
```bash
# List all KV namespaces
npx wrangler kv:namespace list

# Update wrangler.toml with correct ID
[[kv_namespaces]]
binding = "LEADERBOARD_ARCHIVES"
id = "YOUR_ACTUAL_ID"

# Redeploy
npx wrangler deploy
```

### Issue: Admin secret not working

**Symptoms:** Reset returns 401 Unauthorized

**Fix:**
```bash
# List secrets (won't show values)
npx wrangler secret list

# Delete old secret
npx wrangler secret delete ADMIN_SECRET

# Create new secret
npx wrangler secret put ADMIN_SECRET
```

### Issue: Cron not triggering

**Symptoms:** No reset on Monday

**Fix:**
```bash
# Manually trigger (for testing)
curl "https://your-api.workers.dev/__scheduled?cron=0+0+*+*+1"

# Verify syntax in wrangler.toml
[triggers]
crons = ["0 0 * * 1"]  # Must be valid cron expression

# Check Cloudflare dashboard for trigger status
```

---

## Success Criteria

✅ All tests pass
✅ Cron schedule visible in dashboard
✅ KV namespace created and bound
✅ Admin secret set
✅ Manual reset works
✅ Archives retrievable
✅ Anti-cheat blocks rapid updates
✅ Unauthorized reset attempts blocked

**Status:** Ready for production deployment

---

## Production Deployment

Once preview testing is complete:

1. Create production KV namespace
2. Set production ADMIN_SECRET
3. Update wrangler.toml (production config)
4. Deploy: `npx wrangler deploy --env production`
5. Repeat all verification tests
6. Monitor first weekly reset

**Timeline:**
- **Today**: Deploy to preview
- **Monday**: First preview reset
- **Next Week**: Deploy to production (if preview successful)

---

## Documentation

All documentation located in:
- `/docs/MVP_9_Leaderboard_Admin.md` - Full implementation guide
- `/docs/MVP_9_DEPLOYMENT_CHECKLIST.md` - This file

**Keep updated:**
- API endpoint URLs
- Admin secret location (password manager)
- KV namespace IDs (both preview/production)
