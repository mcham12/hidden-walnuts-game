Deployment Guide for Hidden Walnuts
Overview
Deployment uses Cloudflare Pages (client) and Workers (backend). Git pushes trigger auto-deploys via GitHub Actions:
- **mvp-*** branches → Preview environments (separate workers)
- **main** branch → Production environment

Based on 2025 best practices (auto-builds, git integration via GitHub Actions).

Architecture
**Separate Workers**:
- Production: `hidden-walnuts-api` (main branch)
- Preview: `hidden-walnuts-api-preview` (mvp-* branches)

**Environment Files** (`client/` directory):
- `.env` - Local development
- `.env.development` - Local development (explicit)
- `.env.preview` - Preview deployments (points to preview worker)
- `.env.production` - Production deployments (points to production API)

Setup

Cloudflare Dashboard:

Connect GitHub repo to Pages (for client).
Pages project name: `hidden-walnuts-game`
Build command: Handled by GitHub Actions
Output dir: `client/dist`


wrangler.toml:

Configures Durable Objects, rate limiting, environment vars
Enable logs: [observability.logs] enabled = true
Rate limiting: namespace_id = "1001" (created automatically)


Secrets (MVP 7.1):

Set TURNSTILE_SECRET for both workers:
```bash
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api-preview
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api
```



Local Testing

Client: cd client && npm run dev.
Workers: cd workers && npx wrangler dev --port 8787.
Test single-player: Load scene, verify Colobus animations/movement.

Preview Deployment

Push to "mvp-*" branch (e.g., `mvp-simple-7.1`)
GitHub Actions deploys:
  - Client → `<branch>.hidden-walnuts-game.pages.dev`
  - Worker → `hidden-walnuts-api-preview.mattmcarroll.workers.dev`
Uses `.env.preview` for API URL configuration
Validate:
  - Turnstile verification works (uses testing keys)
  - WebSocket connects to preview worker
  - Game loads and functions normally

Production Deployment

Merge to `main` → GitHub Actions deploys:
  - Client → `game.hiddenwalnuts.com`
  - Worker → `hidden-walnuts-api` (api.hiddenwalnuts.com)
Uses `.env.production` for API URL configuration
Monitor: Use Cloudflare dashboard and `wrangler tail` for logs/metrics.

Best Practices (2025)

CI/CD: Optional GitHub Actions for tests before push.
Rollback: Use branch deploys for quick reverts.
Env Vars: Set in dashboard (e.g., ENVIRONMENT="production").
Monitoring: Enable observability; check for errors post-deploy.
Common Issues: Ensure wrangler.toml migrations are up-to-date for DOs.

Validation

After deploy: Test Colobus in browser; check console for logs.
