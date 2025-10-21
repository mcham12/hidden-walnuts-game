# 🔧 Cloudflare Platform Architecture

**Hidden Walnuts** is built exclusively on **Cloudflare's platform** using Pages for frontend hosting and Workers for backend services. This document defines the architecture that **must be followed** in all development and deployment decisions.

---

## 🏗️ **Platform Overview**

### **Cloudflare Pages + Workers Architecture**
```
┌─────────────────────────────┐    ┌─────────────────────────────┐
│      CLOUDFLARE PAGES       │    │     CLOUDFLARE WORKERS      │
│    (Frontend Hosting)       │◄──►│    (Backend + API)          │
├─────────────────────────────┤    ├─────────────────────────────┤
│ • Static site hosting       │    │ • WebSocket server          │
│ • Three.js game client      │    │ • Durable Objects storage   │  
│ • Asset serving (GLTF/PNG)  │    │ • Real-time multiplayer     │
│ • Auto-deploy on git push   │    │ • Game state management     │
│ • Global CDN distribution   │    │ • Player session handling   │
└─────────────────────────────┘    └─────────────────────────────┘
     game.hiddenwalnuts.com           api.hiddenwalnuts.com
```

### **Why Cloudflare Platform**
- **Serverless**: No server management, auto-scaling
- **Global**: Edge deployment for low latency worldwide
- **Integrated**: Pages + Workers work seamlessly together
- **Cost Effective**: Free tier supports development, pay-per-use scaling
- **WebSocket Support**: Real-time multiplayer without additional infrastructure

---

## 🌐 **Domain & Deployment Structure**

### **Production Domains**
- **Frontend**: `game.hiddenwalnuts.com` → Cloudflare Pages
- **Backend API**: `api.hiddenwalnuts.com` → Cloudflare Workers  
- **WebSocket**: `wss://api.hiddenwalnuts.com/ws` → Same Workers endpoint

### **Development Domains**
- **Frontend Preview**: `<branch>.hidden-walnuts-game.pages.dev` → Pages preview (e.g., `mvp-simple-7-1.hidden-walnuts-game.pages.dev`)
- **Backend Preview**: `hidden-walnuts-api-preview.mattmcarroll.workers.dev` → Workers preview
- **Local Dev**: `localhost:5173` (Pages) + `localhost:8787` (Workers)

**Note**: Preview and production use **separate Workers instances** (not environment configs):
- **Production**: `hidden-walnuts-api` (deployed from `main` branch)
- **Preview**: `hidden-walnuts-api-preview` (deployed from `mvp-*` branches)

### **Branch Deployment Strategy**
- **`main` branch** → Production deployment
- **`mvp-*` branches** → Preview deployments  
- **Feature branches** → Development testing

---

## 📁 **Project Structure for Cloudflare**

### **Repository Layout**
```
hidden-walnuts-game/
├── client/                 # Cloudflare Pages source
│   ├── src/               # Three.js game code
│   ├── public/            # Static assets (GLTF, textures)
│   ├── dist/              # Build output (auto-deployed)
│   └── package.json       # Frontend dependencies
├── workers/               # Cloudflare Workers source  
│   ├── api.ts            # Worker entry point
│   ├── objects/          # Durable Objects classes
│   ├── dist/             # Worker build output
│   └── package.json      # Backend dependencies
├── wrangler.toml         # Workers configuration
└── package.json          # Root package (scripts only)
```

### **Build & Deploy Commands**
```bash
# Frontend (Pages)
cd client && npm run build     # → client/dist/
                              # Auto-deployed to Pages on git push

# Backend (Workers)  
cd workers && npm run deploy   # → Deploys to Workers
# OR
npx wrangler deploy           # Direct deployment
```

---

## 🔗 **Communication Architecture**

### **Client-Server Communication**
```typescript
// Frontend connects to Workers WebSocket
const ws = new WebSocket('wss://api.hiddenwalnuts.com/ws');

// Workers handles WebSocket upgrade
export default {
  async fetch(request, env) {
    if (request.headers.get('upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }
    return handleHTTP(request, env);
  }
}
```

### **Data Flow**
1. **Client (Pages)** renders Three.js game
2. **WebSocket connection** to Workers API
3. **Durable Objects** store persistent game state
4. **Real-time sync** between multiple clients

---

## 🗄️ **Durable Objects Architecture**

### **Current Durable Objects**
```typescript
// In workers/objects/
export class ForestManager {
  // Manages world state, terrain, daily resets
}

export class WalnutRegistry {
  // Tracks all hidden walnuts, ownership, scoring
}

export class PlayerSession {
  // Individual player state, inventory, progress  
}

export class Leaderboard {
  // Real-time scoring, 24-hour cycles
}
```

### **Durable Objects Usage**
- **ForestManager**: Single instance per world (24-hour cycles)
- **WalnutRegistry**: Single instance, tracks all walnuts
- **PlayerSession**: One per player, persistent across sessions
- **Leaderboard**: Single instance, real-time scoring

### **State Persistence**
- **Durable Objects** provide SQL-like persistence
- **No external databases** needed
- **Automatic backup** and consistency
- **Global distribution** with Cloudflare's edge network

---

## 🚀 **Development Workflow**

### **Local Development**
```bash
# Terminal 1: Start Workers backend
cd workers
npx wrangler dev --port 8787

# Terminal 2: Start Pages frontend  
cd client
npm run dev                    # Vite dev server on :5173
```

### **Environment Variables**

**Client Environment Files** (`client/` directory):
```bash
# .env - Local development (default)
VITE_API_URL=http://localhost:8787

# .env.development - Local development (explicit)
VITE_API_URL=http://localhost:8787

# .env.preview - Preview deployments (mvp-* branches)
VITE_API_URL=https://hidden-walnuts-api-preview.mattmcarroll.workers.dev

# .env.production - Production deployments (main branch)
VITE_API_URL=https://api.hiddenwalnuts.com
```

**Worker Environment Variables** (set via `wrangler secret put`):
```bash
# TURNSTILE_SECRET - Cloudflare Turnstile secret key (MVP 7.1)
# Set separately for each worker:
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api-preview
wrangler secret put TURNSTILE_SECRET --name hidden-walnuts-api
```

**Note**: Environment files are selected automatically by Vite based on build mode:
- `npm run dev` uses `.env` / `.env.development`
- `npm run build` (in GitHub Actions for preview) uses `.env.preview`
- `npm run build:preview` uses `.env.preview`
- `npm run build:production` uses `.env.production`

### **Deployment Pipeline**
1. **Push to git** → Triggers auto-deployment
2. **Pages builds** client code automatically  
3. **Workers deploys** via wrangler or auto-deploy
4. **Preview URLs** for testing before production

---

## 🔧 **Configuration Files**

### **wrangler.toml** (Workers Configuration)
```toml
name = "hidden-walnuts-api"
compatibility_date = "2023-10-30"
main = "dist/index.js"

[durable_objects]
bindings = [
  { name = "FOREST_MANAGER", class_name = "ForestManager" },
  { name = "WALNUT_REGISTRY", class_name = "WalnutRegistry" },
  { name = "PLAYER_SESSION", class_name = "PlayerSession" },
  { name = "LEADERBOARD", class_name = "Leaderboard" }
]

[[migrations]]
tag = "v1"
new_classes = ["ForestManager", "WalnutRegistry", "PlayerSession", "Leaderboard"]
```

### **Pages Configuration** (Build Settings)
- **Build Command**: `npm run build`
- **Build Output**: `dist`
- **Node Version**: 18+
- **Environment**: `VITE_API_URL`, `VITE_WS_URL`

---

## 🎯 **Development Constraints & Guidelines**

### **Must Follow**
- ✅ **Workers Only** for backend - no external servers/databases
- ✅ **Pages Only** for frontend hosting - no separate CDN
- ✅ **Durable Objects** for persistence - no external storage
- ✅ **WebSocket** via Workers - no separate WebSocket service
- ✅ **Edge deployment** - design for global distribution

### **Cannot Use**  
- ❌ **External databases** (PostgreSQL, MongoDB, etc.)
- ❌ **Separate hosting** (Vercel, Netlify for frontend)
- ❌ **External WebSocket** services (Pusher, Socket.io servers)
- ❌ **Server-based** solutions (Express.js, Node.js servers)

### **Architecture Principles**
- **Serverless-first**: Embrace Workers' event-driven model
- **Edge-optimized**: Design for global, low-latency access  
- **Cloudflare-native**: Use platform features (KV, R2, etc.) when needed
- **Cost-conscious**: Leverage free tiers, minimize resource usage

---

## 📊 **Scaling & Performance**

### **Cloudflare Platform Benefits**
- **Auto-scaling**: Handle traffic spikes without configuration
- **Global edge**: Serve users from nearest datacenter
- **DDoS protection**: Built-in security and mitigation
- **SSL/TLS**: Automatic certificate management

### **Performance Optimization**
- **Asset optimization**: Pages handles minification, compression
- **Caching**: Cloudflare CDN caches static assets globally
- **Workers efficiency**: Sub-10ms response times at edge
- **Durable Objects**: In-memory state with persistent storage

---

## 🛡️ **MVP 7.1: Bot Protection & Rate Limiting**

### **Cloudflare Turnstile Integration**
**Purpose**: Prevent bot abuse and automated attacks without degrading user experience

**Architecture**:
```
User connects → Turnstile verification → Token sent to Worker → Server validates → WebSocket connection
```

**Site Keys** (public, safe to commit):
- **Production**: `0x4AAAAAAB7S9YhTOdtQjCTu` (domain: `game.hiddenwalnuts.com`)
- **Preview/Localhost**: `1x00000000000000000000AA` (Cloudflare testing key)

**Secret Keys** (stored in Workers secrets):
- Set separately per worker using `wrangler secret put TURNSTILE_SECRET --name <worker-name>`
- Production secret: From Cloudflare Turnstile dashboard
- Preview secret: `1x0000000000000000000000000000000AA` (testing secret)

**Client Implementation** (`client/src/LoadingScreen.ts:115-125`):
- Determines site key based on hostname
- Renders Turnstile widget during loading screen
- Passes verification token to game initialization

**Server Validation** (`workers/objects/ForestManager.ts:247-263`):
- Validates token with Cloudflare Turnstile API
- Rejects connections with invalid tokens (403 Forbidden)
- Required for all WebSocket connections

### **Rate Limiting Configuration**
**Purpose**: Prevent abuse and control Worker costs

**Namespace Configuration** (`wrangler.toml:22-28`):
```toml
[[unsafe.bindings]]
name = "RATE_LIMITER"
type = "ratelimit"
namespace_id = "1001"  # Unique integer ID
simple = { limit = 100, period = 60 }  # 100 requests per 60 seconds
```

**Rate Limits** (`workers/objects/ForestManager.ts:210-214`):
- **Connection**: 5 connections per IP per 5 minutes
- **Position updates**: 20 per second per player
- **Walnut hiding**: 10 per minute per player
- **Walnut finding**: 20 per minute per player
- **Chat/emotes**: 5 per 10 seconds per player

**Implementation**:
- Uses Cloudflare Workers Rate Limiting API (experimental)
- Namespace created automatically on deployment
- No CLI commands required (namespace_id is just an integer)

**See Also**: `/docs/TURNSTILE_RATE_LIMITING_SETUP.md` for complete setup instructions

---

## 🔒 **Security & Compliance**

### **Cloudflare Security Features**
- **WAF protection**: Web Application Firewall
- **Rate limiting**: Prevent abuse and DDoS
- **SSL/TLS encryption**: End-to-end security
- **Access control**: IP/geographic restrictions if needed

### **Game-Specific Security**
- **Anti-cheat**: Server-side validation in Workers
- **Session management**: Secure player authentication  
- **Data validation**: Input sanitization in Durable Objects
- **Audit logging**: Track player actions for moderation

---

## 🎮 **Game-Specific Implementation Notes**

### **Real-time Multiplayer**
- **WebSocket connections** handled by Workers
- **Player position sync** via Durable Objects
- **Walnut state management** in WalnutRegistry
- **Leaderboard updates** in real-time

### **Asset Management**
- **GLTF models** served via Pages CDN
- **Texture assets** cached globally  
- **Animation files** loaded on-demand
- **Progressive loading** for performance

### **24-Hour World Cycles**
- **Cron triggers** in Workers for world resets
- **Persistent state** in Durable Objects
- **Player progress** maintained across cycles
- **Automated leaderboard** resets

---

## 🚨 **Critical Reminders for Development**

### **For Future Conversations**
When developing or discussing architecture:

1. **Always use Cloudflare Workers** for backend logic
2. **Always use Cloudflare Pages** for frontend hosting
3. **Always use Durable Objects** for data persistence
4. **Never suggest external services** that duplicate Cloudflare functionality
5. **Design for serverless/edge-first** architecture patterns

### **Architecture Decisions Must Consider**
- **Workers request limits** (CPU time, memory)
- **Durable Objects** consistency and performance
- **Pages build** constraints and optimization
- **Global edge** deployment implications

**This architecture is non-negotiable and must be followed in all development decisions.**