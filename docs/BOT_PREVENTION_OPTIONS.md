# Bot Prevention Options for Hidden Walnuts Game

**Date**: 2025-10-17
**Context**: Multiplayer WebSocket game using Cloudflare Workers + Durable Objects

---

## Executive Summary

**Recommended Approach**: Hybrid strategy combining **Cloudflare Turnstile** (front-end verification) with **Workers Rate Limiting** (backend protection) and **custom bot detection** (behavioral analysis).

**Why**: WebSocket endpoints cannot use Cloudflare's challenge pages without breaking the connection, so we need a layered defense that verifies humans before they connect.

---

## Available Cloudflare Options

### 1. Cloudflare Turnstile (Recommended ✅)

**What it is**: Free, privacy-friendly CAPTCHA alternative that verifies users are human without puzzles or image selection.

**Pricing**: Free for up to 1 million requests/month

**Pros**:
- Works transparently (invisible to most users)
- WCAG 2.1 AA compliant (accessible)
- GDPR compliant (no personal data harvesting)
- Better UX than traditional CAPTCHAs
- Integrates easily with existing HTML

**Cons**:
- Requires JavaScript enabled
- Client-side verification (can be bypassed if not validated server-side)
- Won't work on native mobile apps (web-only)

**How it works**:
1. Runs non-interactive JavaScript challenges in browser
2. Tests for browser quirks, human behavior, proof-of-work
3. Issues a token if user passes
4. Server validates token with Cloudflare API

**Implementation for this game**:
- Add Turnstile widget to loading screen or character select
- Require valid Turnstile token before allowing WebSocket connection
- Validate token server-side in Workers before accepting /ws upgrade

---

### 2. Workers Rate Limiting (Recommended ✅)

**What it is**: Native rate limiting in Cloudflare Workers (GA as of Sept 2025)

**Pricing**: Included with Workers, no extra cost

**Pros**:
- Extremely fast (local to each Cloudflare location)
- No latency impact (counters cached on same machine)
- Flexible (per IP, per session, per action)
- Perfect for WebSocket protection

**Cons**:
- Per-location limits (Sydney's limit doesn't affect London)
- Requires coding in Worker

**Use cases for this game**:
- Limit WebSocket connection attempts (max 3/minute per IP)
- Limit player_update message frequency (max 15/sec per session)
- Limit walnut_hidden actions (max 10/minute per player)
- Limit username changes (already have 5min cooldown, add IP limit)

**Implementation**:
```typescript
// In ForestManager.ts
const limiter = env.RATE_LIMITER; // Workers binding
const { success } = await limiter.limit({ key: clientIP });
if (!success) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

---

### 3. Bot Management (Enterprise Feature ⚠️)

**What it is**: Advanced bot detection with ML-based scoring (1-99, lower = more bot-like)

**Pricing**: Enterprise plan only ($$$)

**Pros**:
- Very accurate bot detection
- Machine learning models
- Bot score available in Workers via `request.cf.botManagement.score`

**Cons**:
- Expensive (Enterprise plan required)
- Overkill for a small multiplayer game

**Recommendation**: Skip unless game becomes extremely popular with serious bot abuse

---

### 4. Challenge Pages / Super Bot Fight Mode (❌ Not Recommended)

**What it is**: Cloudflare's traditional CAPTCHA/JS challenge pages

**Why NOT to use**:
- ⚠️ **BREAKS WEBSOCKET CONNECTIONS** - Causes `websocket: bad handshake` errors
- Challenge pages cannot run on WebSocket upgrade requests
- Would need to skip /ws endpoint entirely, defeating the purpose

**Critical Issue from Research**:
> "JavaScript Detection field should not be used on websocket endpoints... tunnels might fail with a websocket: bad handshake error"

**Recommendation**: Do NOT enable for this game architecture

---

## Recommended Implementation Strategy

### Phase 1: Turnstile Integration (2-3 hours)

**Goal**: Verify users are human before they can connect to game

**Steps**:
1. Sign up for Turnstile in Cloudflare dashboard
2. Get sitekey and secret key
3. Add Turnstile widget to loading screen (before character select)
4. User must complete Turnstile to get token
5. Pass token in WebSocket connection URL: `/ws?turnstileToken=xxx`
6. Validate token server-side in ForestManager before accepting connection

**Code Changes**:
- `client/index.html`: Add Turnstile script
- `client/src/LoadingScreen.ts`: Embed Turnstile widget
- `client/src/main.ts`: Pass token in WebSocket URL
- `workers/objects/ForestManager.ts`: Validate token on connection

**Validation Endpoint**:
```typescript
// Validate Turnstile token server-side
const formData = new FormData();
formData.append('secret', env.TURNSTILE_SECRET);
formData.append('response', turnstileToken);
formData.append('remoteip', clientIP);

const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: formData
});

const outcome = await response.json();
if (!outcome.success) {
  return new Response('Turnstile verification failed', { status: 403 });
}
```

---

### Phase 2: Workers Rate Limiting (1-2 hours)

**Goal**: Prevent abuse even if bots bypass Turnstile

**Rate Limits to Implement**:

1. **WebSocket Connection Rate** (per IP)
   - Limit: 5 connections per 5 minutes
   - Prevents connection spam

2. **Position Update Rate** (per session)
   - Limit: 15 messages per second (already sending at 10 Hz)
   - Prevents message flooding

3. **Walnut Actions Rate** (per session)
   - Hide: 10 per minute
   - Find: 20 per minute
   - Prevents automated walnut farming

4. **Chat/Emote Rate** (per session)
   - Limit: 5 messages per 10 seconds
   - Prevents chat spam

**Implementation**:
```typescript
// Add to wrangler.toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "unique_namespace_id"

// Use in ForestManager.ts
private async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
  const result = await this.env.RATE_LIMITER.limit({
    key,
    limit,
    period: window
  });
  return result.success;
}
```

---

### Phase 3: Custom Bot Detection (2-3 hours)

**Goal**: Detect and ban sophisticated bots that pass Turnstile

**Behavioral Patterns to Detect**:

1. **Superhuman Speed**
   - Already have MAX_SPEED = 20 units/sec validation
   - Add persistent tracking: ban if violated 3+ times

2. **Perfect Geometry**
   - Bots move in straight lines, perfect circles
   - Humans have slight randomness in movement
   - Track movement entropy over time

3. **Inhuman Timing**
   - Bots have consistent timing (exactly 100ms intervals)
   - Humans vary slightly (98ms, 103ms, 101ms)
   - Track timestamp variance

4. **No Idle Time**
   - Bots constantly move, never idle
   - Humans have pauses, afk moments
   - Track idle time percentage

5. **Automated Patterns**
   - Finding walnuts too quickly (farm bots)
   - Perfect throw accuracy (aimbot)
   - Repetitive movement paths

**Implementation**:
```typescript
// Add to PlayerConnection interface
behaviorScore: number; // 0-100, higher = more suspicious
violations: string[]; // Track what triggered suspicion
lastViolationTime: number;

// Scoring system
if (behaviorScore > 80) {
  // Disconnect and temp ban (1 hour)
  this.storage.put(`banned:${clientIP}`, Date.now() + 3600000);
}
```

---

### Phase 4: Monitoring & Analytics (1 hour)

**Goal**: Track bot activity and false positives

**Metrics to Track**:
- Turnstile failure rate
- Rate limit trigger frequency
- Behavior score distribution
- Banned IP count
- False positive reports (legitimate users banned)

**Implementation**:
- Use Cloudflare Analytics
- Add custom logging to Workers
- Create admin dashboard endpoint

---

## Cost Analysis

| Feature | Cost | Value |
|---------|------|-------|
| Turnstile | Free (up to 1M/month) | ⭐⭐⭐⭐⭐ High |
| Workers Rate Limiting | Included | ⭐⭐⭐⭐⭐ High |
| Custom Bot Detection | Development time only | ⭐⭐⭐⭐ Medium-High |
| Bot Management | Enterprise ($$$) | ⭐⭐ Low (overkill) |

**Recommendation**: Implement Phases 1-3 only. Skip Bot Management unless severe abuse occurs.

---

## Security Considerations

### Defense in Depth
- Turnstile stops simple bots (95%)
- Rate limiting stops spam bots (4%)
- Custom detection catches sophisticated bots (0.9%)
- Manual review/bans for remaining (0.1%)

### False Positive Mitigation
- Start with lenient limits
- Monitor analytics for 1-2 weeks
- Gradually tighten based on abuse patterns
- Allow appeals (username system makes this possible)

### Privacy Compliance
- Turnstile is GDPR compliant
- Rate limiting uses IP (anonymous, temporary)
- Behavior scores are session-only (no long-term tracking)
- No PII collected for bot detection

---

## Implementation Priority

**MVP Bot Protection** (4-6 hours):
1. ✅ Turnstile on loading screen (Phase 1)
2. ✅ Connection rate limiting (Phase 2, partial)
3. ✅ Basic behavior tracking (Phase 3, minimal)

**Full Bot Protection** (8-12 hours):
1. All Phase 1 features
2. All Phase 2 rate limits
3. All Phase 3 behavioral detection
4. Phase 4 monitoring

**When to Implement**:
- **Now**: If you're seeing bot abuse or anticipate public launch
- **Later**: If game is small/private and no abuse yet
- **After MVP 8**: If combat system creates incentive for cheating (auto-aim, speed hacks)

---

## Alternative: Simple IP Allowlist (Development Only)

If game is still in development and not public:

**Option**: Allowlist known player IPs in Workers
```typescript
const ALLOWED_IPS = ['YOUR_IP', 'FRIEND_IP'];
if (!ALLOWED_IPS.includes(clientIP)) {
  return new Response('Access denied', { status: 403 });
}
```

**Pros**: Zero effort, 100% bot protection
**Cons**: Not scalable, breaks for dynamic IPs, dev-only

---

## Next Steps

**Recommended Action**:
1. Test game publicly first (measure actual bot abuse)
2. If bots appear, implement Phase 1 (Turnstile) immediately
3. Monitor for 1 week
4. Add Phase 2 (rate limiting) if needed
5. Add Phase 3 (custom detection) only if sophisticated bots appear

**Do NOT**:
- Enable Cloudflare Challenge Pages (breaks WebSocket)
- Buy Enterprise plan for Bot Management (overkill)
- Over-optimize for abuse that hasn't happened yet

---

## References

- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/)
- [Workers Rate Limiting Docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Bot Management Docs](https://developers.cloudflare.com/bots/)
- [WebSocket Bot Protection Best Practices](https://developers.cloudflare.com/waf/custom-rules/use-cases/challenge-bad-bots/)
