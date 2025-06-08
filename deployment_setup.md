# Hidden Walnuts Deployment Setup

This document details the Cloudflare and GitHub configurations for *Hidden Walnuts*, including Pages, Workers, Durable Objects, and deployment workflows. It centralizes setup information for development and AI-assisted coding.

## Cloudflare Pages
- **Project Name**: `hidden-walnuts-game`.
- **Domains**:
  - `hidden-walnuts-game.pages.dev`
  - `game.hiddenwalnuts.com`
- **Build Configuration**:
  - Command: `npm run build:preview` (Vite build, `tsc && vite build --mode preview`).
  - Output Directory: `client/dist`.
  - Root Directory: `client`.
- **Environment Variables**:
  - `VITE_API_URL`:
    - Preview: `https://hidden-walnuts-api.mattmcarroll.workers.dev` (set in `client/.env.preview`).
    - Production: `https://api.hiddenwalnuts.com` (set in `client/.env.production`).
- **Deployment**:
  - Automatic builds via GitHub integration on every push to `mcham12/hidden-walnuts-game`.
  - Build logs used for debugging.

## Cloudflare Worker
- **Name**: `hidden-walnuts-api`.
- **Route**: `api.hiddenwalnuts.com/*`.
- **Preview URL**: `hidden-walnuts-api.mattmcarroll.workers.dev`.
- **Configuration**: Defined in `workers/wrangler.toml`.
- **Durable Objects**:
  - `FOREST` (class: `ForestManager`): Manages map cycle and game-hidden walnuts.
  - `SQUIRREL` (class: `SquirrelSession`): Tracks player state (score, power-ups, walnuts).
  - `WALNUTS` (class: `WalnutRegistry`): Manages walnut states and ownership.
  - `LEADERBOARD` (class: `Leaderboard`): Handles real-time scores and bonuses.
- **Environment Variables**:
  - `CYCLE_DURATION_SECONDS`: `86400` (24 hours, set in `wrangler.toml` for preview and production).
- **Deployment**:
  - Built and deployed via GitHub Actions (`deploy-worker.yml`).
  - Production: Deploys to `main` branch.
  - Preview: Deploys to `mvp-*` branches.

## GitHub Actions
- **Workflow File**: `.github/workflows/deploy-worker.yml`.
- **Triggers**:
  - Push to `main` or `mvp-*` branches.
  - Changes in `workers/**` or `deploy-worker.yml`.
  - Manual trigger via `workflow_dispatch`.
- **Process**:
  - Builds Worker in `workers` directory (`npm run build`).
  - Deploys to:
    - Production: `npx wrangler deploy --name hidden-walnuts-api --env production` (on `main`).
    - Preview: `npx wrangler deploy --name hidden-walnuts-api --env preview` (on `mvp-*`).
- **Environment Variables**:
  - `CLOUDFLARE_API_TOKEN`: Stored in GitHub Secrets for authentication.
  - `VITE_API_URL`: Dynamically set (pending fix to use `https://hidden-walnuts-api.mattmcarroll.workers.dev` for preview, see `TODO.md`).

## Testing Workflow
- **Primary Method**: Manual testing on Cloudflare preview deployments.
- **URLs**:
  - Frontend: `hidden-walnuts-game.pages.dev`.
  - Backend: `hidden-walnuts-api.mattmcarroll.workers.dev`.
- **Process**:
  - Access deployment URLs via Cloudflare dashboard.
  - Validate features (e.g., WebSocket events, player movements).
- **Debugging**: Monitor build logs in Cloudflare Pages and Worker dashboards.
- **Future Plans**: Develop automated testing script (see `TODO.md`).