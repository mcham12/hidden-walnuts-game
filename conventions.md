# Hidden Walnuts – AI Dev Conventions

This project is developed using AI-assisted workflow (vibe coding).
To reduce refactor errors and enforce modular structure, use the following conventions:

## Durable Objects
- Each Durable Object has its own file in `workers/objects/`.
- All Durable Objects must be accessed via `registry.ts`.
- Bindings in `wrangler.toml` must match the object name and be documented in `registry.ts`.

## File Structure
- No fetch logic outside `api.ts`.
- DOs expose internal logic via `stub.fetch()`.

## Naming
- All DO types: `ForestManager`, `SquirrelSession`, etc. One noun per class.
- Object key naming should be deterministic (e.g., `squirrel-${id}`).

## Comments for AI
Use `// AI NOTE:` to explain:
- Purpose of object
- Key data structure fields
- Any assumptions AI must maintain across files

## Reusable Patterns
Use helper functions for:
- DO ID generation
- Routing
- Leaderboard point scaling
- Time-based cycle resets
