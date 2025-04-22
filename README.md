# Hidden Walnuts Game

A 3D multiplayer game where players hide and seek walnuts in a daily refreshing forest environment.

## Features

- 3D forest environment with dynamic day/night cycle
- Multiplayer walnut hiding and seeking
- Daily forest refresh cycle
- Player scoring system
- Real-time updates

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open http://localhost:3001 in your browser

## Controls

- WASD: Move around the forest
- Click "Hide Walnut" button to hide a walnut at your current position
- First 30 seconds are for scouting only

## Tech Stack

- Three.js for 3D rendering
- TypeScript for type-safe code
- Vite for development and building
- Cloudflare Workers for backend (coming soon)

## Project Structure

```
hidden-walnuts-game/
├── src/
│   ├── game/           # Game logic components
│   ├── styles/         # CSS styles
│   └── main.ts         # Entry point
├── worker/             # Cloudflare Worker code
└── public/             # Static assets
```

## License

MIT 