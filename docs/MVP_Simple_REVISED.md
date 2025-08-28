# 🎮 **REVISED**: Simple MVP Plan - Core Walnut Gameplay Focus

**🎯 NEW FOCUS**: Build the **actual Hidden Walnuts game** - focus on walnut hiding/seeking mechanics and competitive multiplayer rather than character variety.

**✅ Current Status**: Animated Colobus character with terrain + physics **COMPLETED** - ready for walnut gameplay!

---

## 🎯 **Game Vision Alignment**

### **Core Game Loop** (from GameVision.md)
1. **Join Game** → Get 3 walnuts to hide
2. **Hide Walnuts** → Press H to bury/bush walnuts  
3. **Seek Walnuts** → Find others' hidden walnuts
4. **Steal & Rehide** → Competitive walnut ownership
5. **Score Points** → Different points for burial types
6. **24-Hour Cycles** → World resets, leaderboard competition

### **Current Progress** ✅
- ✅ **3D Forest Terrain** - Procedural with proper character positioning
- ✅ **Animated Character** - Colobus with idle/run/jump + bounding box positioning  
- ✅ **Movement System** - WASD + camera following + gravity physics
- ✅ **Backend Architecture** - Cloudflare Workers + Durable Objects (needs cleanup)

---

## 🧹 **MVP 1.9: Worker Code Cleanup** 🎯 **IMMEDIATE NEXT**

**Objective**: Simplify over-engineered worker code to align with simplified game approach before implementing walnut mechanics.

### **Current Worker Issues**
- **Over-Engineered**: Enterprise logging, complex anti-cheat, unused routes
- **Complexity Mismatch**: Complex backend vs simplified Game.ts frontend
- **Confusing Codebase**: Unclear which code to use for walnut integration
- **Outdated Architecture**: Built for complex ECS, needs simple approach

### **Cleanup Plan** (2-3 days)

**Day 1: Remove Enterprise Complexity**
```bash
# Delete over-engineered files
rm workers/Logger.ts workers/constants.ts

# Simplify api.ts routing
- Remove unused routes (/server-metrics, /rehide-test, etc.)
- Keep core routes: /ws, /join, /hide, /leaderboard  
- Replace Logger with simple console.log
- Simplify CORS handling
```

**Day 2: Simplify Durable Objects**
```typescript
// ForestManager.ts - Keep core, remove complexity
- Remove anti-cheat tracking
- Remove complex error handling  
- Remove metrics collection
- Keep: WebSocket handling, basic world state

// WalnutRegistry.ts - Basic CRUD only
- Simple walnut storage/retrieval
- Basic ownership tracking
- Remove hot zones, analytics

// SquirrelSession.ts - Minimal player state
- Basic position tracking
- Simple inventory (walnut count)
- Remove complex authentication

// Leaderboard.ts - Simple scoring
- Basic score storage/retrieval  
- Remove time multipliers initially
```

**Day 3: Test & Validate**
```bash
# Test simplified workers
npm run dev:worker

# Validate core functionality
- WebSocket connection works
- Basic Durable Object storage
- Simple API endpoints respond
- Ready for walnut integration
```

### **Success Criteria**
- ✅ Workers start without errors
- ✅ WebSocket connects from client
- ✅ Simple API routes functional (/join, /leaderboard)
- ✅ Durable Objects store/retrieve basic data
- ✅ Code is readable and matches simplified approach

**Estimated Time**: **2-3 days**

---

## 🥜 **MVP 2: Core Walnut Mechanics**

**Objective**: Implement the actual walnut hiding/seeking gameplay that defines the game.

### **Week 1: Walnut Interaction System**

**Walnut Hiding (H Key)**:
```typescript
// In Game.ts
private onHideWalnut() {
  if (this.playerWalnuts > 0) {
    // Play "Eat" animation (digging/burying)
    this.setAction('eat');
    
    // Create walnut at player position
    const walnut = this.createWalnut(this.character.position, 'buried');
    
    // Send to server
    this.sendWalnutHide(walnut);
    
    this.playerWalnuts--;
  }
}
```

**Walnut Finding (Click Detection)**:
```typescript
// Raycasting for walnut interaction
private onMouseClick(event: MouseEvent) {
  const walnut = this.getWalnutAtPosition(mousePos);
  if (walnut && this.isNearPlayer(walnut.position)) {
    // Play "Bounce" animation (excited finding)
    this.setAction('bounce');
    
    // Collect walnut
    this.collectWalnut(walnut);
    this.score += walnut.points;
  }
}
```

**Walnut Types & Scoring**:
- **Buried Walnuts**: 3 points (harder to find)
- **Bush Walnuts**: 1 point (easier to spot)
- **Game Walnuts**: Bonus multiplier
- **Visual Indicators**: Subtle terrain disturbances for buried walnuts

**Estimated Time**: **5-7 days**

### **Week 2: Basic Walnut Persistence**

**Server Integration**:
```typescript
// WebSocket walnut messages
interface WalnutMessage {
  type: 'HIDE_WALNUT' | 'FIND_WALNUT';
  walnutId: string;
  position: Vector3;
  walnutType: 'buried' | 'bush';
  playerId: string;
}
```

**Walnut State Management**:
- **WalnutRegistry Durable Object** (already exists) integration
- **Persistent Walnuts** remain after players leave
- **Walnut Ownership** tracking for scoring
- **Basic Anti-Cheat** server-side position validation

**Estimated Time**: **3-5 days**

---

## 👥 **MVP 3: Competitive Multiplayer** 

**Objective**: Make it actually competitive with multiple players hiding/seeking.

### **Week 3: Multi-Player Walnut Competition**

**Real-time Player Sync**:
- **Multiple Players** see each others' characters moving
- **Walnut Stealing** - find and collect others' hidden walnuts
- **Animation Sync** - see other players' hide/seek animations
- **Proximity Rules** - can't hide/find walnuts too close to others

**Leaderboard System**:
```typescript
// Real-time scoring
interface GameScore {
  playerId: string;
  characterType: 'colobus'; // expand later
  score: number;
  wallnutsHidden: number;
  wallnutsFound: number;
  timeMultiplier: number; // 1.1x to 2x based on time played
}
```

**Competitive Mechanics**:
- **Walnut Rehiding** - steal found walnuts and hide them again
- **Score Multipliers** - time played bonus (1.1x to 2x)
- **Fresh Player Boost** - catch-up mechanic for late joiners
- **Real-time Leaderboard** updates

**Estimated Time**: **5-7 days**

---

## 🌍 **MVP 4: Persistent 24-Hour World**

**Objective**: Create the persistent world that resets every 24 hours.

### **Week 4: World Persistence & Daily Cycles**

**24-Hour World Cycles**:
- **Daily Reset** - forest regenerates, walnuts respawn
- **Persistent Progress** - player stats carry over
- **100 Game Walnuts** placed randomly each cycle
- **3 Walnuts per Player** when joining

**Session Management**:
- **Join Anytime** - players can enter mid-cycle  
- **Persistent Walnuts** - remain hidden when players leave
- **World State Sync** - new players see current walnut state
- **Cycle Countdown** - UI showing time until reset

**Backend Integration** (using existing Durable Objects):
- **ForestManager** - world state and daily reset logic
- **PlayerSession** - track player progress across sessions  
- **WalnutRegistry** - persistent walnut locations
- **Leaderboard** - 24-hour scoring cycles

**Estimated Time**: **5-7 days**

---

## 🐺 **MVP 5: Predators & Game Polish**

**Objective**: Add unique predator mechanics and final polish.

### **Week 5-6: Predators & Power-ups**

**Predator AI**:
```typescript
// Simple hawk/wolf behavior
class Predator {
  private targetPlayer: Player | null;
  private huntCooldown: number;
  
  update() {
    if (this.detectNearbyPlayers()) {
      this.chasePlayer();
      this.triggerPlayerFear(); // "Fear" animation
    }
  }
}
```

**Defense Mechanics**:
- **Chatter Defense** - rapid key presses to scare predators
- **Projectile Defense** - throw objects at predators  
- **Group Defense** - predators avoid multiple players

**Power-ups**:
- **Scent Sniff** - reveal nearby buried walnuts
- **Fast Dig** - hide/find walnuts quicker
- **Decoy Nut** - fake walnut that gives no points

**Game Polish**:
- **Hot Zones** - visual indicators of recent activity
- **Mini-Events** - "Nut Rush" every 4 hours
- **UI Polish** - score display, walnut counter, timer
- **Sound Effects** - digging, finding, predator sounds

**Estimated Time**: **7-10 days**

---

## 📊 **Revised Timeline - Game-First Approach**

| MVP | Focus | Time | Core Features |
|-----|-------|------|--------------|
| **✅ MVP 1.5** | **Animated Character** | **DONE** | Working Colobus with terrain + physics |
| **🎯 MVP 1.9** | **Worker Code Cleanup** | **2-3 days** | Simplify backend, remove complexity |
| **MVP 2** | **Walnut Mechanics** | **1-2 weeks** | Hide/seek walnuts, scoring system |
| **MVP 3** | **Competitive Multiplayer** | **1 week** | Multi-player, stealing, leaderboard |
| **MVP 4** | **Persistent World** | **1 week** | 24-hour cycles, world persistence |
| **MVP 5** | **Predators & Polish** | **1-2 weeks** | AI predators, power-ups, polish |

**Total**: **4.5-6.5 weeks** to complete **Hidden Walnuts** core gameplay

---

## 🚀 **Implementation Strategy**

### **Phase 1: Backend Cleanup (THIS WEEK)**
**Priority**: Clean foundation before walnut implementation
1. **Remove Enterprise Code** - Logger, constants, unused routes
2. **Simplify Durable Objects** - Basic CRUD operations only
3. **Test WebSocket Connection** - Ensure client-worker communication
4. **Validate Core APIs** - /join, /hide, /leaderboard endpoints

### **Phase 2: Core Gameplay (NEXT 2 WEEKS)**
**Priority**: Get walnut hiding/seeking working with animations
1. **H Key** walnut hiding with "eat" animation
2. **Mouse Click** walnut finding with "bounce" animation  
3. **Basic Scoring** system with point values
4. **Server Integration** for walnut persistence (using cleaned workers)

### **Phase 3: Competition (WEEK 3)**
**Priority**: Make it multiplayer competitive
1. **Multiple Players** seeing each other
2. **Walnut Stealing** mechanics
3. **Real-time Leaderboard** 
4. **Score Multipliers** based on time played

### **Phase 4: Persistence (WEEK 4)**
**Priority**: 24-hour persistent world
1. **Daily Reset** cycles
2. **Persistent Walnuts** across sessions
3. **World State Sync** for new players

### **Phase 5: Unique Features (WEEKS 5-6)**
**Priority**: Predators and power-ups that make the game special
1. **Predator AI** with defense mechanics
2. **Power-up System**
3. **Final Polish** and balancing

---

## 🎨 **Character Variety: Future Enhancement**

### **Season 2 Features** (After Core Game Complete)
- **8 Character Types** with unique abilities
- **Character Unlocks** based on walnut achievements
- **NPC Population** for forest atmosphere
- **Advanced Animations** using full animation library

### **Why Later?**
- **Core Gameplay First** - walnut mechanics define the game
- **One Character Perfect** - better than 8 characters with broken gameplay
- **Asset Value** - amazing character assets deserve a working game to showcase them
- **Player Retention** - gameplay keeps players, variety brings them back

---

## 🎯 **Key Success Metrics**

### **MVP 2 Success**: Players can hide and find walnuts with proper animations
### **MVP 3 Success**: Multiple players competing for walnut scores  
### **MVP 4 Success**: 24-hour persistent world with daily resets
### **MVP 5 Success**: Complete Hidden Walnuts experience with predators

**Ready to start MVP 2 - Core Walnut Mechanics?** 🥜