# UX Polish Design Document
*Hidden Walnuts Game - Sky Elements & Tutorial Redesign*

## Overview
This document outlines the design for two major UX improvements:
1. **Sky Elements**: Adding sun and clouds for atmospheric depth
2. **Tutorial System**: Complete redesign of "How to Play" onboarding

Game character: Silly, lighthearted forest animal antics
Platforms: Desktop (keyboard), Mobile browsers (iPad/iPhone, portrait/landscape)

---

## Part 1: Sky Elements System

### Design Goals
- Add visual interest without distracting from gameplay
- Maintain high performance (60 FPS target)
- Fit the game's lighthearted, casual aesthetic
- Industry-standard billboard sprite approach

### Technical Approach

**Billboard Sprites**: 2D textures that always face the camera (three.js THREE.Sprite)
- Simple, performant, industry-standard for casual games
- No complex shaders or 3D models needed
- Automatically handled by three.js rendering pipeline

### Sun Implementation

**Visual Design**:
- Single sun sprite (sun.png) with warm, friendly glow
- Positioned in sky (fixed position, doesn't move)
- Slightly transparent/soft edges for gentle atmosphere
- Color: Warm yellow/orange (#FFD700 to #FFA500 gradient)

**Technical Details**:
```typescript
- Asset: /assets/sprites/sun.png (512x512 PNG with alpha)
- Type: THREE.Sprite with THREE.SpriteMaterial
- Position: Fixed at (x: 50, y: 80, z: -50) - upper right, background
- Scale: 20 units diameter
- Always visible (no day/night cycle)
- Depth test: false (always behind game objects)
- Render order: -1000 (render first, behind everything)
```

### Cloud Implementation

**Visual Design**:
- Simple, cartoony white clouds (cloud.png)
- 1-2 clouds maximum at any time (avoid visual clutter)
- Slowly drift across sky for gentle movement
- Semi-transparent for layering effect

**Technical Details**:
```typescript
- Asset: /assets/sprites/cloud.png (512x512 PNG with alpha)
- Type: THREE.Sprite with THREE.SpriteMaterial
- Count: 1-2 concurrent clouds
- Position: Randomized Y (60-90), Z (-100 to -50)
- Scale: Random (10-18 units width) for variety
- Movement: Drift horizontally at 0.5-1.5 units/sec
- Lifecycle: Spawn at x=-100, despawn at x=100, respawn with random delay (30-60s)
- Depth test: false
- Render order: -900 (behind sun, but still background)
```

**Cloud System Manager**:
```typescript
class SkyManager {
  private sun: THREE.Sprite;
  private clouds: THREE.Sprite[] = [];
  private readonly MAX_CLOUDS = 2;
  private readonly CLOUD_SPEED_MIN = 0.5;
  private readonly CLOUD_SPEED_MAX = 1.5;
  private readonly RESPAWN_DELAY_MIN = 30000; // 30s
  private readonly RESPAWN_DELAY_MAX = 60000; // 60s

  update(delta: number) {
    // Move clouds horizontally
    // Check bounds and respawn
  }
}
```

### Asset Requirements

**sun.png**:
- 512x512 PNG with alpha transparency
- Soft circular gradient: bright center (#FFEB3B), fading to orange edges (#FFA726)
- Outer glow/blur effect
- Lighthearted, friendly style (not realistic)

**cloud.png**:
- 512x512 PNG with alpha transparency
- Cartoony white cloud shape
- Soft edges, semi-transparent
- Multiple variations possible (cloud1.png, cloud2.png) for variety

---

## Part 2: Tutorial System Redesign

### Research Summary

**Industry Best Practices (2025)**:
- Launch directly into action, teach one mechanic in <10 seconds
- **Single screen** showing all core mechanics (avoid multi-screen click-through)
- Progressive disclosure (tooltips for advanced features)
- Platform-specific UX (mobile touch vs desktop keyboard)
- "Play as Guest" - skip unnecessary setup
- Glowing/animated UI to draw attention
- Pause game while reading tutorial

**Key Insight**: Over 30% of tutorial steps are typically unnecessary. Focus only on what's needed to play immediately.

### Design Goals

1. **Immediate value**: New players understand core loop in <30 seconds
2. **Single screen**: All core mechanics visible at once
3. **Platform-specific**: Different UI for desktop (keys) vs mobile (touch)
4. **Non-intrusive**: Optional, can be re-invoked anytime
5. **Pauses game**: No pressure while reading
6. **Playful**: Match game's lighthearted tone

### Core Mechanics to Teach

Must cover these 5 mechanics:
1. **Move**: Desktop (WASD/Arrows), Mobile (drag/joystick)
2. **Get Walnut**: Approach and auto-collect
3. **Throw Walnut**: Hit players/wildebeest, distract birds
4. **Hide Walnut**: Might grow into tree (strategic gameplay)
5. **Eat Walnut**: Heal damage

---

### Tutorial UI Design

#### Desktop Experience

**Trigger**:
- New player detection (localStorage check: `hasSeenTutorial`)
- Glowing "How to Play" button (💡 pulsing animation, top-right corner near settings)
- Auto-show on first join (skippable with "X" or Escape key)

**Layout** (Single overlay screen):
```
┌────────────────────────────────────────────┐
│  How to Play - Hidden Walnuts             ✕│
├────────────────────────────────────────────┤
│                                            │
│  [Icon]  MOVE                              │
│  ⌨️ WASD or Arrow Keys                     │
│                                            │
│  [Icon]  GET WALNUT                        │
│  🚶 Walk near walnut to collect            │
│                                            │
│  [Icon]  THROW WALNUT                      │
│  ⌨️ SPACE - Hit players & wildebeest       │
│  🐦 Distract aerial predators              │
│                                            │
│  [Icon]  HIDE WALNUT                       │
│  ⌨️ H - Bury or hide in bush               │
│  🌳 Might grow into tree!                  │
│                                            │
│  [Icon]  EAT WALNUT                        │
│  ⌨️ E - Heal 20 HP                         │
│                                            │
│  [ GOT IT! ]                               │
└────────────────────────────────────────────┘
```

**Visual Elements**:
- Background: Semi-transparent dark forest green `rgba(20, 60, 30, 0.95)`
- Key icons: Visual representation of keys (rounded rectangles with letter)
- Icons: Emoji + small illustrative icons for each action
- Font: Large (18-20px), clear, high contrast
- "Got It!" button: Large, friendly, bright green
- Close button (✕): Top-right corner

**Keyboard Key Visual**:
```css
.key-icon {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 4px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
```

**Re-invoke**:
- "How to Play" button always visible (top-right, near settings)
- Keyboard shortcut: `F1` key
- Pauses game while overlay is open

#### Mobile Experience

**Trigger**:
- Same localStorage check: `hasSeenTutorial`
- Glowing "?" button (top-right, pulsing animation)
- Auto-show on first join

**Layout** (Single overlay, portrait-optimized):
```
┌──────────────────────────┐
│ How to Play            ✕ │
├──────────────────────────┤
│                          │
│ 🚶 MOVE                  │
│ [Diagram: Finger drag]   │
│ Drag anywhere to move    │
│                          │
│ 🥜 GET WALNUT            │
│ Walk near to collect     │
│                          │
│ 🎯 THROW                 │
│ [Button icon: 🎯]        │
│ Tap button at bottom     │
│ Hit players & beasts!    │
│ Distract birds! 🐦       │
│                          │
│ 🌳 HIDE                  │
│ [Button icon: 🌳]        │
│ Walnut may grow to tree! │
│                          │
│ ❤️ EAT                    │
│ [Button icon: 🍴]        │
│ Heal 20 HP               │
│                          │
│    [ GOT IT! ]           │
└──────────────────────────┘
```

**Visual Elements**:
- Same background styling as desktop
- Touch gesture diagrams (simplified illustrations)
- Button icons match actual game buttons
- Larger text (minimum 16px) for mobile readability
- Buttons clearly illustrated with icons

**Re-invoke**:
- "?" button always visible (top-right)
- Tap to open tutorial
- Pauses game while overlay is open

---

### Landscape Mobile Considerations

When device is in landscape:
- Use two-column layout (mechanics on left, descriptions on right)
- Reduce vertical padding
- Keep all content visible without scrolling

---

### Implementation Changes

#### Remove Old Systems:
1. ✅ Desktop multi-screen tutorial click-through
2. ✅ Desktop key legend UI
3. ✅ Existing mobile controls button/modal (replace with new tutorial)

#### Add New Systems:
1. ✅ Glowing "How to Play" / "?" button (desktop/mobile)
2. ✅ Single-screen tutorial overlay (platform-specific layouts)
3. ✅ Game pause mechanism when tutorial is open
4. ✅ localStorage tracking for `hasSeenTutorial`
5. ✅ Auto-show on first join (with skip option)
6. ✅ Keyboard shortcut (F1) for desktop

---

### Technical Architecture

**New Components**:

```typescript
// TutorialOverlay.ts
class TutorialOverlay {
  private overlay: HTMLDivElement;
  private isDesktop: boolean;

  constructor() {
    this.isDesktop = this.detectPlatform();
    this.createOverlay();
    this.checkFirstVisit();
  }

  private detectPlatform(): boolean {
    // Check if touch device
    return !('ontouchstart' in window);
  }

  show(): void {
    // Pause game
    // Show overlay
    // Track analytics
  }

  hide(): void {
    // Resume game
    // Set localStorage
  }
}
```

**Integration Points**:
- Game.ts: Add tutorialOverlay instance
- Game.ts: Implement pause/resume methods
- index.html: Add tutorial button container
- CSS: Add glow/pulse animations

**Storage**:
```javascript
localStorage.setItem('hw_hasSeenTutorial', 'true');
const hasSeen = localStorage.getItem('hw_hasSeenTutorial') === 'true';
```

---

## Implementation Priority

### Phase 1: Sky Elements (Quick Win)
1. Create sun.png and cloud.png assets
2. Implement SkyManager class
3. Add sun sprite (fixed position)
4. Add cloud system (1-2 drifting clouds)
5. Test performance

### Phase 2: Tutorial System (Core UX)
1. Remove old tutorial and key legend code
2. Create TutorialOverlay component
3. Implement desktop layout with key icons
4. Implement mobile layout with touch diagrams
5. Add game pause/resume functionality
6. Add glowing button UI
7. Test on all platforms (desktop, iPad portrait/landscape, iPhone)

---

## Success Metrics

**Sky Elements**:
- ✅ Maintains 60 FPS on all target devices
- ✅ Adds visual interest without distraction
- ✅ Fits game's aesthetic

**Tutorial**:
- ✅ New players understand core mechanics in <30 seconds
- ✅ Reduced confusion about controls
- ✅ Single screen (no multi-screen fatigue)
- ✅ Platform-appropriate UX
- ✅ Easy to re-invoke when needed

---

## Asset Specifications

### sun.png
- **Size**: 512x512 PNG
- **Style**: Friendly, cartoony, warm glow
- **Colors**: Yellow/orange gradient (#FFEB3B → #FFA726)
- **Transparency**: Soft alpha falloff at edges
- **Reference**: Mario Sunshine sun, Animal Crossing sun

### cloud.png
- **Size**: 512x512 PNG
- **Style**: Simple, cartoony, fluffy
- **Colors**: White with subtle shading
- **Transparency**: Semi-transparent, soft edges
- **Variations**: Consider cloud1.png, cloud2.png for variety
- **Reference**: Mario clouds, Stardew Valley clouds

### Touch Gesture Diagrams (Mobile)
- Simple line drawings showing finger drag
- Use in mobile tutorial overlay
- Style: Minimal, clear, friendly

---

## Notes

- All changes maintain backward compatibility
- Performance is critical (mobile devices)
- Tutorial content should be localization-ready (future)
- Analytics hooks for tutorial engagement (future)
- Consider A/B testing tutorial effectiveness (future)

---

*Document Version: 1.0*
*Last Updated: 2025-10-31*
