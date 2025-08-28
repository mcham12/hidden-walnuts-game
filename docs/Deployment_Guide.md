Deployment Guide for Hidden Walnuts
Overview
Deployment uses Cloudflare Pages (client) and Workers (backend). Git pushes trigger auto-deploys: "mvp*" branches to preview, main to production. Based on 2025 best practices (auto-builds, git integration via dashboard).
Setup

Cloudflare Dashboard:

Connect GitHub repo to Pages (for client) and Workers (for backend).
Set build command: npm run build (client Vite).
Output dir: client/dist.


wrangler.toml:

Configures DOs, env vars (e.g., ENVIRONMENT="development").
Enable logs: [observability.logs] enabled = true.



Local Testing

Client: cd client && npm run dev.
Workers: cd workers && npx wrangler dev --port 8787.
Test single-player: Load scene, verify Colobus animations/movement.

Preview Deployment

Push to "mvp*<feature>" branch (e.g., <code>mvp-colobus</code>).</feature>
Auto-deploys to preview URL (e.g., <project>.pages.dev).</project>
Validate: Character scene loads without errors.

Production Deployment

Merge to main → auto-deploys to production (<project>.pages.dev, api.<project>.workers.dev).</project></project>
Monitor: Use Cloudflare dashboard for logs/metrics.

Best Practices (2025)

CI/CD: Optional GitHub Actions for tests before push.
Rollback: Use branch deploys for quick reverts.
Env Vars: Set in dashboard (e.g., ENVIRONMENT="production").
Monitoring: Enable observability; check for errors post-deploy.
Common Issues: Ensure wrangler.toml migrations are up-to-date for DOs.

Validation

After deploy: Test Colobus in browser; check console for logs.
