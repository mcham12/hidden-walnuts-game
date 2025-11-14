# Hidden Walnuts Documentation

**Last Updated**: MVP 16 (Authentication & Character System)

Welcome to the Hidden Walnuts project documentation. This directory contains comprehensive documentation for the production-ready 3D multiplayer game built on Cloudflare's edge platform.

## Quick Start

**New to the project?**
1. Start with [README.md](../README.md) for game overview
2. Read [Project Structure](PROJECT_STRUCTURE.md) for architecture
3. Check [Game Vision](GameVision.md) for design philosophy
4. Review [Conventions](conventions.md) for development standards

**Starting development?**
1. Follow [README.md](../README.md) setup instructions
2. Review [Project Structure](PROJECT_STRUCTURE.md) to understand codebase
3. Read [Cloudflare Architecture](CLOUDFLARE_ARCHITECTURE.md) for platform details
4. Check current [MVP 16 Progress](MVP_16_Progress.md) for latest features

---

## Core Documentation

### Architecture & Structure
- **[Project Structure](PROJECT_STRUCTURE.md)** ⭐ - Complete file organization, key files, and system architecture
- **[Cloudflare Architecture](CLOUDFLARE_ARCHITECTURE.md)** - Platform deployment, Durable Objects, KV namespaces, edge network
- **[Game Vision](GameVision.md)** - Design philosophy, gameplay objectives, and feature roadmap

### Game Systems
- **[Character Implementation](Character_Implementation.md)** - Character system, tiers, animations, selection UI
- **[Animation State Machine](ANIMATION_STATE_MACHINE.md)** - Animation system, state transitions, blending
- **[MVP 12 Predator Defense Design](MVP_12_Predator_Defense_Design.md)** - Predator AI, rank-based targeting, combat
- **[UX Polish Design](UX_Polish_Design.md)** - UI/UX improvements, responsive design, mobile optimization

### Authentication & Security
- **[Authentication Tech Approach](Authentication_Tech_Approach.md)** - JWT authentication, email/password flow, session management
- **[Authentication UX Design](Authentication_UX_Design.md)** - Login/signup UI, welcome screens, character gating
- **[Bot Prevention](BOT_PREVENTION_OPTIONS.md)** - Cloudflare Turnstile integration, rate limiting
- **[Turnstile Rate Limiting Setup](TURNSTILE_RATE_LIMITING_SETUP.md)** - Configuration and implementation details

### Admin & Operations
- **[Admin API Reference](ADMIN_API_REFERENCE.md)** - Management endpoints, metrics, player administration
- **[Admin API Security](ADMIN_API_SECURITY.md)** - Authentication, authorization, rate limiting for admin endpoints
- **[Deployment Guide](Deployment_Guide.md)** - CI/CD pipeline, GitHub Actions, Cloudflare deployment

### Business & Monetization
- **[Cloudflare Cost Analysis](CLOUDFLARE_COST_ANALYSIS.md)** - Pricing breakdown, usage estimates, cost optimization
- **[Monetization Design](MONETIZATION_DESIGN.md)** - Premium characters, pricing strategy, revenue model

### Development Guides
- **[Conventions](conventions.md)** - Code standards, naming conventions, best practices
- **[AI Usage Guidelines](README_AI.md)** - Working with AI assistants on this project
- **[VPN Cloudflare Issues](VPN_Cloudflare_Issues.md)** - Known issues and workarounds

---

## MVP Progress Documentation

### Current Phase
- **[MVP 16 Progress](MVP_16_Progress.md)** ✅ **CURRENT** - Authentication & character system
  - Email/password authentication with JWT
  - Character tier system (guest/free/premium)
  - Email verification and password reset flows
  - Turnstile bot protection for returning guests
  - Character selection UI

- **[MVP 16 UX Mockup](MVP_16_UX_Mockup.md)** - Design specifications
- **[MVP 16 Post Deployment Remediation](MVP_16_Post_Deployment_Remediation.md)** - Bug fixes and polish

### Recent Phases
- **[MVP 15 Completion](MVP_15_COMPLETION.md)** ✅ - Scheduled tasks & resets
  - Daily map/forest reset (8am UTC)
  - Weekly leaderboard reset (Sunday 8:05am UTC)
  - Cron triggers via Cloudflare Workers

- **[MVP 14 Progress](MVP_14_PROGRESS.md)** ✅ - Tree growth bonuses
  - Milestone bonuses for trees grown
  - Configurable admin settings

- **[MVP 13 Progress](MVP_13_PROGRESS.md)** ✅ - Admin APIs
  - Player management endpoints
  - Metrics tracking
  - Configuration APIs

- **[MVP 12 Design](MVP_12_Predator_Defense_Design.md)** ✅ - Predator system
  - Aerial predators (Cardinal, Toucan)
  - Ground predators (Wildebeest)
  - Rank-based targeting

### Earlier Phases
- **[MVP 9 Deployment Checklist](MVP_9_DEPLOYMENT_CHECKLIST.md)** - Deployment procedures
- **[MVP 9 Leaderboard Admin](MVP_9_Leaderboard_Admin.md)** - Leaderboard admin features
- **[MVP 8 Design](MVP_8_DESIGN.md)** - Animated characters & NPCs
- **[MVP 7 Documentation](mvp-7/)** - Multiplayer foundation (archived)
- **[MVP 8 Documentation](mvp-8/)** - Character animations (archived)

---

## File Organization

### Documentation Standards

All new documentation follows this structure:

```
docs/
├── Core Documentation (root level)
│   ├── PROJECT_STRUCTURE.md
│   ├── CLOUDFLARE_ARCHITECTURE.md
│   ├── GameVision.md
│   └── conventions.md
│
├── System Documentation (UPPERCASE.md)
│   ├── ADMIN_API_REFERENCE.md
│   ├── ANIMATION_STATE_MACHINE.md
│   ├── BOT_PREVENTION_OPTIONS.md
│   └── ... (technical specs)
│
├── MVP Progress (MVP_<number>_*.md)
│   ├── MVP_16_Progress.md
│   ├── MVP_15_COMPLETION.md
│   └── MVP_14_PROGRESS.md
│
└── Archived MVPs (mvp-<number>/)
    ├── mvp-7/ (detailed task documentation)
    └── mvp-8/ (detailed task documentation)
```

### Naming Conventions

- **Core docs**: `TitleCase.md` (e.g., `GameVision.md`)
- **System docs**: `UPPERCASE_SNAKE_CASE.md` (e.g., `ADMIN_API_REFERENCE.md`)
- **MVP docs**: `MVP_<number>_Title.md` (e.g., `MVP_16_Progress.md`)
- **Archived**: `mvp-<number>/` (lowercase directories)

---

## Documentation Usage Guide

### For New Developers

**Day 1: Understanding the Game**
1. Read [README.md](../README.md) - What is Hidden Walnuts?
2. Play the game at [game.hiddenwalnuts.com](https://game.hiddenwalnuts.com)
3. Review [Game Vision](GameVision.md) - Design goals

**Day 2: Architecture Overview**
1. Study [Project Structure](PROJECT_STRUCTURE.md) - File organization
2. Read [Cloudflare Architecture](CLOUDFLARE_ARCHITECTURE.md) - Platform details
3. Review [Conventions](conventions.md) - Code standards

**Day 3: Development Setup**
1. Follow [README.md](../README.md) setup instructions
2. Build and run locally
3. Make a small change to understand workflow

### For Current Development

**Adding a new feature:**
1. Check [MVP 16 Progress](MVP_16_Progress.md) for current priorities
2. Review relevant system documentation
3. Follow [Conventions](conventions.md) for code standards
4. Update documentation when feature is complete

**Fixing a bug:**
1. Check [MVP 16 Post Deployment Remediation](MVP_16_Post_Deployment_Remediation.md) for known issues
2. Review system documentation for affected area
3. Submit fix with documentation updates

**Deploying changes:**
1. Follow [Deployment Guide](Deployment_Guide.md)
2. Use GitHub Actions for auto-deploy
3. Monitor production metrics

### For AI Assistants

**When starting a session:**
1. Read [README_AI.md](README_AI.md) for AI-specific guidelines
2. Review [MVP 16 Progress](MVP_16_Progress.md) for current state
3. Check [Project Structure](PROJECT_STRUCTURE.md) for file locations

**When making changes:**
1. Follow [Conventions](conventions.md) strictly
2. Update relevant documentation
3. Create new docs in appropriate location (see File Organization above)

---

## Key Technical Areas

### Client Architecture
- **Entry Point**: `client/src/main.ts` (457 lines)
- **Game Engine**: `client/src/Game.ts` (8,349 lines)
- **Authentication**: `client/src/services/AuthService.ts` (399 lines)
- **Networking**: `client/src/systems/NetworkSystem.ts` (1,200+ lines)
- **Characters**: `client/src/services/CharacterRegistry.ts` (302 lines)

See [Project Structure](PROJECT_STRUCTURE.md) for complete file breakdown.

### Server Architecture
- **Entry Point**: `workers/api.ts` (routing & cron)
- **World State**: `workers/objects/ForestManager.ts` (129 KB)
- **Authentication**: `workers/objects/PlayerIdentity.ts` (33 KB)
- **Rankings**: `workers/objects/Leaderboard.ts` (22 KB)
- **NPC AI**: `workers/objects/NPCManager.ts` (36 KB)
- **Predator AI**: `workers/objects/PredatorManager.ts` (24 KB)

See [Cloudflare Architecture](CLOUDFLARE_ARCHITECTURE.md) for Durable Objects details.

### Game Mechanics
- **Walnut System**: Hide/find mechanics, point values, tree growth
- **Combat System**: Health (100 HP), walnut projectiles (30 damage), knockouts
- **Rank System**: 7 tiers (Rookie → Legend) with AI scaling
- **Predator System**: Aerial (Cardinal, Toucan) and ground (Wildebeest) enemies
- **Leaderboard**: Weekly (resets Sunday), all-time, daily rankings

---

## Current Status (MVP 16)

### Completed Features
- ✅ Full authentication system (email/password, JWT tokens)
- ✅ Character tier system (guest/free/premium)
- ✅ Email verification & password reset
- ✅ Turnstile bot protection
- ✅ 10 playable characters with animations
- ✅ Multiplayer real-time sync
- ✅ NPC AI (up to 2 NPCs)
- ✅ Predator AI (up to 2 predators)
- ✅ Combat system & health tracking
- ✅ Weekly/all-time leaderboards
- ✅ Daily/weekly resets via cron
- ✅ Admin APIs
- ✅ Mobile touch controls
- ✅ Responsive design (desktop/tablet/mobile)

### In Progress
- 📋 Mobile optimization improvements
- 📋 Analytics integration
- 📋 Social features (friend system)
- 📋 Premium character purchasing

### Metrics (Live Production)
- **Active players**: 22+ total registered
- **Uptime**: 99.9%+ (Cloudflare edge)
- **Latency**: <50ms globally
- **Deployment**: GitHub Actions auto-deploy

---

## Documentation Maintenance

### When Adding New Features

1. **Update MVP Progress docs** (`MVP_16_Progress.md`)
2. **Update system docs** (e.g., `ADMIN_API_REFERENCE.md` for new endpoints)
3. **Update [Project Structure](PROJECT_STRUCTURE.md)** if files added/removed
4. **Update this file** (`DOCUMENTATION.md`) with new doc links

### When Creating New Documentation

1. **Choose appropriate name** (follow naming conventions above)
2. **Place in correct location** (core/system/MVP/archived)
3. **Add to this index** (under appropriate section)
4. **Cross-reference** related docs

### Documentation Standards

- **Clear headings** with proper hierarchy
- **Code examples** where relevant
- **File paths** for all references
- **Status indicators** (✅ COMPLETED, 📋 IN PROGRESS, ❌ BLOCKED)
- **Last updated** date at top
- **Cross-references** to related docs

---

## Contributing to Documentation

### Documentation Priorities

1. **Accuracy** - Keep docs in sync with code
2. **Clarity** - Write for humans and AI assistants
3. **Completeness** - Cover all major systems
4. **Maintainability** - Use consistent structure

### Before Committing Changes

1. ✅ Verify all links work
2. ✅ Check file paths are correct
3. ✅ Update "Last Updated" dates
4. ✅ Follow naming conventions
5. ✅ Add to this index if new doc

---

## External Resources

- **Live Game**: [game.hiddenwalnuts.com](https://game.hiddenwalnuts.com)
- **Cloudflare Docs**: [workers.cloudflare.com](https://workers.cloudflare.com)
- **Three.js Docs**: [threejs.org/docs](https://threejs.org/docs)
- **TypeScript Docs**: [typescriptlang.org/docs](https://www.typescriptlang.org/docs)

---

This documentation provides comprehensive coverage of the Hidden Walnuts project at MVP 16. For quick navigation, use the table of contents above or search for specific topics.

**Last Updated**: MVP 16 (2025-11-14)
