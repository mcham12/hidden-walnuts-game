# Hidden Walnuts Game

A multiplayer game where players hide and find walnuts in a virtual space. Built with Cloudflare Workers and Durable Objects.

## Features

- Real-time multiplayer gameplay
- Persistent game state using Durable Objects
- RESTful API for game interactions
- CORS support for web clients

## API Endpoints

### Game Cycle Management

- `GET /api/cycle?cycleId={id}` - Get game cycle details
- `POST /api/cycle` - Start or end a game cycle
  - Body: `{ "action": "start" | "end" }`

### Walnut Operations

- `POST /api/walnut` - Hide a new walnut
  - Body: `{ "playerId": string, "position": string }`
- `PUT /api/walnut` - Find/collect a walnut
  - Body: `{ "walnutId": string, "playerId": string }`

### Game State

- `GET /api/state` - Get current game state

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

## Deployment

### Prerequisites

1. [Cloudflare Workers](https://workers.cloudflare.com/) account
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. Cloudflare authentication configured

### Steps

1. Login to Cloudflare:
   ```bash
   wrangler login
   ```

2. Create a D1 database:
   ```bash
   wrangler d1 create hidden_walnuts_db
   ```

3. Update `wrangler.toml` with your database ID

4. Deploy:
   ```bash
   npm run deploy
   ```

## License

MIT 