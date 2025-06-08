# Hidden Walnuts

*Hidden Walnuts* is a 3D multiplayer game where players hide and seek walnuts in a persistent forest environment. The game features a dynamic forest with terrain, trees, shrubs, and player avatars, with real-time synchronization, scoring, and planned features like power-ups, predators, and social interactions.

## Project Status
- **Current MVP**: MVP 7 (Multiplayer Foundation, in progress).
- **Deployment**: Hosted on Cloudflare (Workers for backend, Pages for frontend).
- See `MVP_Plan_Hidden_Walnuts.md` for the detailed development roadmap.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mcham12/hidden-walnuts-game.git
   cd hidden-walnuts-game
   ```
2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../workers && npm install
   ```
3. Set environment variables in `client/.env` (update for preview or production):
   ```env
   VITE_API_URL=https://api.hiddenwalnuts.com  # For production
   # Use https://hidden-walnuts-api.mattmcarroll.workers.dev for preview
   ```
4. Run locally (optional, primary testing on Cloudflare preview):
   ```bash
   npm run dev  # In client directory
   ```

## Deployment
- **Frontend**: Deployed to Cloudflare Pages (`hidden-walnuts-game`) via GitHub integration.
- **Backend**: Deployed to Cloudflare Workers (`hidden-walnuts-api`) via GitHub Actions (`deploy-worker.yml`).
- **Assets**: Served from `client/public/assets/models/` (e.g., `Tree_01.glb`, `squirrel.glb`).
- **Routes**: `client/public/_routes.json` excludes `.glb` and `.txt` from SPA fallback.
- See `deployment_setup.md` for detailed Cloudflare and GitHub configurations.

### Deployment Details
- **Cloudflare Pages**:
  - Domains: `hidden-walnuts-game.pages.dev`, `game.hiddenwalnuts.com`.
  - Build command: `npm run build:preview` (Vite build, output to `client/dist`).
  - Root directory: `client`.
  - Environment variable: `VITE_API_URL` (set in `client/.env.preview` or `client/.env.production`).
- **Cloudflare Worker**:
  - Route: `api.hiddenwalnuts.com/*`.
  - Preview URL: `hidden-walnuts-api.mattmcarroll.workers.dev`.
  - Durable Objects: `FOREST` (`ForestManager`), `SQUIRREL` (`SquirrelSession`), `WALNUTS` (`WalnutRegistry`), `LEADERBOARD` (`Leaderboard`).
  - Configuration: Defined in `workers/wrangler.toml`.
- **GitHub Actions**:
  - Workflow: `deploy-worker.yml` builds and deploys Worker on `main` (production) and `mvp-*` (preview) branches.
  - Pages: Automatic builds via GitHub integration.

## Testing
- **Primary Method**: Manual testing on Cloudflare preview (`hidden-walnuts-game.pages.dev`, `hidden-walnuts-api.mattmcarroll.workers.dev`) via deployment URLs.
- **Process**: Access preview URLs via Cloudflare dashboard, validate features (e.g., avatar movement, WebSocket events).
- **Future Plans**: Develop automated testing script for simulating inputs (e.g., player movements, walnut hiding).
- **Debugging**: Monitor build logs in Cloudflare Pages and Worker dashboards.

## Contributing
See `conventions.md` for coding standards and contribution guidelines. Document AI contributions in `README_AI.md`.