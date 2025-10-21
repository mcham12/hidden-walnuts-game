# Turnstile & Rate Limiting Setup

**MVP 7.1** - Bot Protection & Cost Mitigation

**Time Required**: 15 minutes

---

## Part 1: Create Production Turnstile Widget

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile**
2. Click **"Add Widget"**
3. Configure:
   - **Widget name**: `Hidden Walnuts - Production`
   - **Hostnames**: `game.hiddenwalnuts.com`
   - **Widget Mode**: `Managed`
4. Click **"Create"**
5. Copy **Site Key** and **Secret Key** → Save as `PROD_SITE_KEY` and `PROD_SECRET`

**Note**: We'll use testing keys for preview/localhost (Part 2)

---

## Part 2: Configure Client

**File**: `client/src/LoadingScreen.ts` (line 115)

Replace the placeholder with environment-based key selection:

```typescript
// Determine site key based on hostname
const hostname = window.location.hostname;
let TURNSTILE_SITE_KEY: string;

if (hostname === 'game.hiddenwalnuts.com') {
  // Production: Real site key
  TURNSTILE_SITE_KEY = 'YOUR_PROD_SITE_KEY_HERE'; // From Part 1
} else {
  // Preview/localhost: Testing key (always passes)
  TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Cloudflare testing key
}
```

**Testing key info**: `1x00000000000000000000AA` is a Cloudflare-provided dummy key that works on any domain (localhost, preview URLs, etc.) and always passes verification.

**Commit this change** - site keys are public and safe in git.

---

## Part 3: Add Secrets to Workers

### Using Wrangler CLI

```bash
cd /path/to/hidden-walnuts-game

# Preview worker (hidden-walnuts-api-preview)
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api-preview
# Paste when prompted: 1x0000000000000000000000000000000AA

# Production worker (hidden-walnuts-api)
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api
# Paste PROD_SECRET when prompted (from Part 1)
```

**Testing secret**: `1x0000000000000000000000000000000AA` is the Cloudflare dummy secret that pairs with the testing site key.

### Verify Secrets

```bash
wrangler secret list --name hidden-walnuts-api-preview
wrangler secret list --name hidden-walnuts-api
```

---

## Part 4: Configure Rate Limiting

Rate limiting is already configured in `wrangler.toml` with `namespace_id = "1001"`. This is a unique integer identifier for your rate limiting configuration.

**No CLI command needed** - the namespace is created automatically when you deploy.

If you see wrangler.toml warnings about "unsafe" bindings, that's expected - rate limiting uses experimental features.

---

## Part 5: Deploy & Test

### Build

```bash
npm run build
```

### Deploy to Preview

Your GitHub Actions will auto-deploy when you push. Or manually:

```bash
cd workers
wrangler deploy --name hidden-walnuts-api --env preview
```

### Test Preview

1. Open browser to your preview URL: `<branch>.hidden-walnuts.pages.dev`
2. Watch loading screen: "Verifying you are human..." → "Verification successful!"
3. Check browser console for errors
4. Game should connect and play normally

### Monitor Preview

```bash
wrangler tail --name hidden-walnuts-api-preview
```

Watch for:
- ✅ `Turnstile validation successful`
- ✅ `Connection rate limit OK`
- ❌ Any `403` or `429` errors

### Deploy to Production

After 24-48 hours of successful preview testing:

```bash
git checkout main
git merge your-branch
git push  # Auto-deploys to production
```

Test immediately at `game.hiddenwalnuts.com`.

---

## Rate Limits (Current Configuration)

**Connection (per IP)**:
- 5 connections per 5 minutes

**Actions (per player)**:
- Position updates: 20/second
- Walnut hiding: 10/minute
- Walnut finding: 20/minute
- Chat/emotes: 5/10 seconds

**To adjust**: Edit `workers/objects/ForestManager.ts` lines 210-214

---

## Troubleshooting

### Turnstile Fails

1. Check hostname in widget settings matches your domain
2. Verify secret key is set: `wrangler secret list --name hidden-walnuts-api-preview`
3. Check browser console for error messages
4. Try switching widget mode: Dashboard → Turnstile → Widget → Settings → Mode → Non-interactive

### Rate Limiting Not Working

1. Check for wrangler.toml errors during build
2. Redeploy: `cd workers && wrangler deploy --name hidden-walnuts-api --env preview`
3. Check binding exists: Dashboard → Workers → hidden-walnuts-api-preview → Settings → Variables
4. Check logs: `wrangler tail --name hidden-walnuts-api-preview` for rate limit messages

### Players Getting Blocked

Increase rate limits in `ForestManager.ts` (lines 210-214), then redeploy.

---

## Rollback

If issues occur in production:

```bash
# Quick disable (comment out validation)
# Edit workers/objects/ForestManager.ts line 360-364
# Comment out:
# if (!isValidTurnstile) {
#   return new Response('Turnstile verification failed', { status: 403 });
# }

# Then commit and push to main (GitHub Actions will deploy)
git add workers/objects/ForestManager.ts
git commit -m "Temporarily disable Turnstile validation"
git push
```

Or revert git commit:

```bash
git log --oneline  # Find commit before MVP 7.1
git revert <commit-hash>
git push
```

---

## Security Checklist

**Before Production**:
- [ ] Production widget uses `game.hiddenwalnuts.com` hostname only
- [ ] Preview/localhost use testing keys (`1x00000000000000000000AA`)
- [ ] Production secret set in Workers (real secret from Part 1)
- [ ] Preview secret set to testing secret (`1x0000000000000000000000000000000AA`)
- [ ] Site keys committed to git, secrets stored in Workers only
- [ ] Tested in preview for 24-48 hours
- [ ] No 403/429 errors for legitimate users

**Never**:
- ❌ Commit secret keys to git
- ❌ Use production secret in preview/localhost
- ❌ Skip preview testing
- ❌ Add `localhost` to production widget hostnames

**Note**: Testing keys are safe to use in preview because they're public Cloudflare dummy keys. They provide the same user experience as real keys but don't provide actual bot protection.

---

## Resources

- **Turnstile Docs**: https://developers.cloudflare.com/turnstile/
- **Rate Limiting**: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- **Bot Prevention Analysis**: `/docs/BOT_PREVENTION_OPTIONS.md`

---

**Last Updated**: 2025-10-18
