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
- **Frontend**: `<branch>.hidden-walnuts.pages.dev` → Pages preview
- **Backend API**: `<worker>.workers.dev` → Workers preview
- **Local Dev**: `localhost:5173` (Pages) + `localhost:8787` (Workers)

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
```bash
# Development (.env)
VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787/ws

# Production (auto-injected by Cloudflare)
VITE_API_URL=https://api.hiddenwalnuts.com  
VITE_WS_URL=wss://api.hiddenwalnuts.com/ws
```

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