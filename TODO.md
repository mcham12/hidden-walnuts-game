# Hidden Walnuts TODO

This file tracks pending tasks for *Hidden Walnuts* development to ensure they are addressed in future iterations.

## Pending Tasks
1. **Correct `deploy-worker.yml` Preview URL**:
   - Update `VITE_API_URL` in `.github/workflows/deploy-worker.yml` to use `https://hidden-walnuts-api.mattmcarroll.workers.dev` for preview (remove `<your-account>` placeholder).
   - Priority: Medium (affects preview deployments).
   - Reference: `deployment_setup.md`.

2. **Create Automated Testing Script**:
   - Develop a script to simulate inputs (e.g., WASD movement, WebSocket events) for testing MVP 7 and beyond in Cloudflare preview.
   - Priority: High (streamlines testing for multiplayer features).
   - Potential Tools: Playwright or Puppeteer for browser automation.
   - Reference: `README_AI.md`, `conventions.md`.

3. ** Add a client/src/constants.ts file and refactor code to use it

4. **Rig `squirrel.glb` for Animations**:
   - Add animations (e.g., running, digging) to `client/public/assets/models/squirrel.glb` using tools like Blender.
   - Priority: Medium (enhances visual polish for future MVPs).
   - Reference: `README_AI.md`.

## Tracking
- Review this file during development to prioritize tasks.
- Create GitHub Issues in `mcham12/hidden-walnuts-game` for each task with labels (e.g., `enhancement`, `bug`).
- Update this file as tasks are completed or new ones arise.