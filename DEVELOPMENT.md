# Development Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- Cloudflare account (for deployment)

### Initial Setup
```bash
# Install all dependencies
npm run install:all

# Copy environment configuration
cp env.example .env.local
# Edit .env.local with your Cloudflare credentials
```

### Development Workflow

#### Start Development Servers
```bash
# Terminal 1: Start worker server
npm run dev:worker

# Terminal 2: Start client server  
npm run dev:client
```

#### Build for Production
```bash
# Build both client and worker
npm run build

# Deploy worker only
npm run deploy
```

## Project Structure

```
hidden-walnuts-game/
├── client/                 # Three.js frontend
│   ├── src/               # Game source code
│   ├── public/            # Static assets
│   └── package.json       # Client dependencies
├── workers/               # Cloudflare Workers backend
│   ├── api.ts            # Main API handler
│   ├── objects/          # Durable Objects
│   └── package.json      # Worker dependencies
├── public/               # Shared 3D assets
├── docs/                 # Documentation
└── package.json          # Root scripts
```

## Environment Variables

### Required for Development
- `VITE_API_URL`: API endpoint (http://localhost:8787 for local dev)
- `NODE_ENV`: Environment (development/preview/production)

### Required for Deployment
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID

## Build Commands

### Root Level
- `npm run install:all`: Install all dependencies
- `npm run build`: Build both client and worker
- `npm run dev:worker`: Start worker development server
- `npm run dev:client`: Start client development server

### Client Only
- `cd client && npm run dev`: Start client dev server
- `cd client && npm run build`: Build for production
- `cd client && npm run build:preview`: Build for preview

### Worker Only
- `cd workers && npm run build`: Build worker
- `cd workers && npx wrangler dev --port 8787`: Start worker dev server

## Testing

### Local Testing
1. Start both development servers
2. Open multiple browser tabs to test multiplayer
3. Check browser console for errors
4. Monitor worker logs in terminal

### Build Validation
```bash
# Validate client build
cd client && npm run build:preview

# Validate worker build
cd workers && npm run build
```

## Deployment

### Automatic (GitHub Actions)
- Push to `main` branch: Deploys to production
- Push to `mvp-*` branches: Deploys to preview

### Manual
```bash
# Deploy worker
cd workers && npx wrangler deploy

# Deploy client (if using Cloudflare Pages)
# Build first, then upload dist/ folder
```

## Troubleshooting

### Common Issues
1. **Port conflicts**: Ensure port 8787 is available for worker
2. **Build errors**: Run `npm run install:all` to ensure all deps are installed
3. **Asset loading**: Check that 3D models are in the correct location
4. **Environment variables**: Ensure `.env.local` is properly configured

### Debug Mode
- Client: Check browser console and network tab
- Worker: Check terminal logs and Cloudflare dashboard
- Assets: Verify file paths and CORS settings 