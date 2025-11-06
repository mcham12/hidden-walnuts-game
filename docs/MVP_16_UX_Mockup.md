# MVP 16 UX Flow Mockup - Complete Redesign

**Document Version**: 1.0
**Created**: 2025-11-05
**Status**: Proposed Design - Awaiting Approval

---

## Flow Overview

```
┌─────────────┐
│   SCREEN 1  │  Welcome Screen (NEW - Enticement First)
│   Landing   │  • Show value proposition
└──────┬──────┘  • 3 clear paths
       │
       ├─────────┬─────────┬─────────
       │         │         │
       v         v         v
  ┌────────┐ ┌────────┐ ┌────────┐
  │Quick   │ │Sign Up │ │Log In  │
  │Play    │ │        │ │        │
  └───┬────┘ └───┬────┘ └───┬────┘
      │          │          │
      v          v          v
  ┌────────┐ ┌────────┐ ┌────────┐
  │SCREEN 2│ │SCREEN 2│ │SCREEN 2│
  │Name    │ │Signup  │ │Login   │
  │Entry   │ │Form    │ │Form    │
  └───┬────┘ └───┬────┘ └───┬────┘
      │          │          │
      └──────────┴──────────┘
                 │
                 v
          ┌─────────────┐
          │  SCREEN 3   │  Character Selection
          │  Character  │  • Visual grid
          │  Grid       │  • 3D previews on click
          └──────┬──────┘
                 │
                 v
          ┌─────────────┐
          │  SCREEN 4   │  Ready Screen (NEW)
          │  Enter      │  • Show selected character
          │  Forest Btn │  • Explicit start action
          └──────┬──────┘
                 │
                 v
          ┌─────────────┐
          │  SCREEN 5   │  Loading Screen
          │  Loading    │  • Assets load
          │             │  • Server connection
          └──────┬──────┘
                 │
                 v
          ┌─────────────┐
          │  SCREEN 6   │  Game World
          │  Gameplay   │  • Player spawned
          │             │  • Game active
          └─────────────┘
```

---

## SCREEN 1: Welcome Screen (Landing) - TWO-COLUMN DESIGN

### Visual Layout

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║  🌲🌳 HIDDEN WALNUTS 🌰🌲                                                     ║
║             Welcome to the Forest                                            ║
║                                                                              ║
╟──────────────────────────────────┬───────────────────────────────────────────╢
║        QUICK PLAY                │              SIGN UP FREE                 ║
║       No login needed!           │           Unlock 6 FREE characters!       ║
║                                  │                                           ║
║  👤 Enter your name:             │  🔄 Rotating 3D Character Carousel        ║
║  ┌────────────────────────────┐ │  ┌─────────────────────────────────────┐ ║
║  │___________________________│ │  │ 🦊  🐻  🐰  🐦  🐸  🦡               │ ║
║  └────────────────────────────┘ │  │ Fox Bear Rabbit Bird Frog Badger     │ ║
║                                  │  │                                       │ ║
║  [3D SQUIRREL IDLING]           │  │  [3D MODELS - IDLING & ROTATING]     │ ║
║         🐿️                       │  │  Auto-rotate carousel every 3s        │ ║
║       Bobbing, tail flick        │  │  All 6 characters cycle through      │ ║
║    Idle animation looping        │  │  Current: Bear (showing 3 at once)   │ ║
║                                  │  └─────────────────────────────────────┘ ║
║                                  │                                           ║
║        🟢 QUICK PLAY!            │           🟠 SIGN UP                      ║
║      (Big green button)          │         (Big orange button)               ║
║                                  │                                           ║
║                                  │   🔒 Sign In (subtle link below)          ║
║                                  │                                           ║
╚──────────────────────────────────┴───────────────────────────────────────────╝
║                                                                              ║
║                      Start collecting walnuts now! 🌰🎮                      ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Key Design Elements

**Overall Layout:**
- **Two-column split**: 50/50 width (left = Quick Play, right = Sign Up)
- **Header**: Centered title "HIDDEN WALNUTS" with tree/walnut emojis
- **Footer**: Single call-to-action tagline
- **Vertical divider**: Subtle line separating columns
- **Background**: Forest gradient (darker at edges, lighter in center)

**LEFT COLUMN - Quick Play:**
1. **Header**: "QUICK PLAY" (bold, 24px)
2. **Subtext**: "No login needed!" (italic, 16px)
3. **Name Input**:
   - Label: "👤 Enter your name:"
   - Text field with placeholder "Type your nickname..."
   - Max 20 characters, validation on blur
4. **3D Squirrel Preview**:
   - Single squirrel model in idle animation
   - Bobbing motion, tail flicking
   - Nut juggling animation (optional)
   - Rotates slowly (360° in 15 seconds)
5. **Quick Play Button**:
   - Large green button (🟢 QUICK PLAY!)
   - 300px wide, 60px tall
   - Forest green gradient (#28a745 to #1e7e34)
   - Hover: Scales to 1.05x, brighter glow
   - Disabled until name is entered

**RIGHT COLUMN - Sign Up:**
1. **Header**: "SIGN UP FREE" (bold, 24px)
2. **Subtext**: "Unlock 6 FREE characters!" (italic, 16px)
3. **3D Character Carousel**:
   - Shows 3 characters at once (visible)
   - 6 total characters cycle through
   - Auto-rotate every 3 seconds
   - Order: Fox → Bear → Rabbit → Bird → Frog → Badger → (repeat)
   - Each character has idle animation
   - Smooth transition (fade + slide)
   - Emojis above each: 🦊 🐻 🐰 🐦 🐸 🦡
4. **Sign Up Button**:
   - Large orange button (🟠 SIGN UP)
   - 300px wide, 60px tall
   - Orange gradient (#ff8c00 to #ff6b00)
   - Hover: Scales to 1.05x, golden glow
5. **Sign In Link**:
   - Small text link below button
   - "🔒 Sign In" (14px, muted color)
   - Click opens login modal

**Typography:**
- Title: 48px, bold, #2d4a2e (dark forest green)
- Section headers: 24px, bold, #333
- Body text: 16px, regular, #555
- Links: 14px, underline on hover

**Colors:**
- Primary green: #28a745 (Quick Play)
- Primary orange: #ff8c00 (Sign Up)
- Background: Linear gradient from #e8f5e9 (light green) to #c8e6c9
- Text: #2d4a2e (dark forest green)
- Divider: rgba(0,0,0,0.1)

**Animations:**
- Page load: Fade in (0.5s)
- Squirrel: Continuous idle animation
- Carousel: Slide + fade transition (0.8s ease-in-out)
- Buttons: Hover scale + glow (0.2s)
- Name input: Focus highlights with green border

---

## SCREEN 1: RESPONSIVE LAYOUTS

### Desktop (1025px+) - Side-by-Side
```
╔════════════════════════════════════════════════════════════════════╗
║  🌲🌳 HIDDEN WALNUTS 🌰🌲    Welcome to the Forest                 ║
╟──────────────────────────────┬─────────────────────────────────────╢
║   QUICK PLAY                 │   SIGN UP FREE                      ║
║   No login needed!           │   Unlock 6 FREE characters!         ║
║                              │                                     ║
║   👤 Enter name:             │   🔄 Carousel                       ║
║   [_________________]        │   [🦊  🐻  🐰]                      ║
║                              │   3D models rotating                ║
║   [3D SQUIRREL]              │   Auto-cycle every 3s               ║
║   Idle animation             │                                     ║
║                              │                                     ║
║   🟢 QUICK PLAY!             │   🟠 SIGN UP                        ║
║                              │   🔒 Sign In                        ║
╚──────────────────────────────┴─────────────────────────────────────╝
║              Start collecting walnuts now! 🌰🎮                    ║
╚════════════════════════════════════════════════════════════════════╝
```
**Dimensions**: 1920x1080 typical
**Layout**: Two equal columns (50/50)
**3D Models**: Full size, high detail

---

### iPad Landscape (768px - 1024px, landscape)
```
╔══════════════════════════════════════════════════════════════════╗
║  🌲 HIDDEN WALNUTS 🌰    Welcome to the Forest                   ║
╟─────────────────────────────┬────────────────────────────────────╢
║   QUICK PLAY                │   SIGN UP FREE                     ║
║   No login needed!          │   Unlock 6 FREE characters!        ║
║                             │                                    ║
║   👤 Name:                  │   🔄 [🦊 🐻 🐰]                    ║
║   [______________]          │   (Slightly smaller)               ║
║                             │                                    ║
║   [3D SQUIRREL]             │                                    ║
║   (Smaller)                 │                                    ║
║                             │                                    ║
║   🟢 QUICK PLAY             │   🟠 SIGN UP                       ║
║                             │   🔒 Sign In                       ║
╚─────────────────────────────┴────────────────────────────────────╝
║          Start collecting walnuts! 🌰                            ║
╚══════════════════════════════════════════════════════════════════╝
```
**Dimensions**: 1024x768 typical
**Layout**: Two columns (50/50)
**3D Models**: Scaled down 80%
**Buttons**: 250px wide

---

### iPad Portrait (768px - 1024px, portrait) - STACKED
```
╔════════════════════════════════════╗
║  🌲 HIDDEN WALNUTS 🌰              ║
║    Welcome to the Forest           ║
╟────────────────────────────────────╢
║       QUICK PLAY                   ║
║     No login needed!               ║
║                                    ║
║   👤 Enter your name:              ║
║   [___________________]            ║
║                                    ║
║        [3D SQUIRREL]               ║
║      Idle animation                ║
║                                    ║
║      🟢 QUICK PLAY!                ║
╟────────────────────────────────────╢
║      SIGN UP FREE                  ║
║   Unlock 6 FREE characters!        ║
║                                    ║
║     🔄 Character Carousel          ║
║      [🦊  🐻  🐰]                  ║
║      Rotating 3D models            ║
║                                    ║
║       🟠 SIGN UP                   ║
║       🔒 Sign In                   ║
╚════════════════════════════════════╝
║  Start collecting walnuts! 🌰      ║
╚════════════════════════════════════╝
```
**Dimensions**: 768x1024 typical
**Layout**: STACKED (vertical)
**Order**: Quick Play on top, Sign Up below
**3D Models**: Scaled down 70%
**Buttons**: Full width (90% of container)

---

### iPhone Portrait (≤430px) - STACKED + COMPACT
```
┌────────────────────────┐
│  🌲 HIDDEN WALNUTS 🌰  │
│  Welcome to Forest     │
├────────────────────────┤
│   QUICK PLAY           │
│   No login needed      │
│                        │
│ 👤 Your name:          │
│ [________________]     │
│                        │
│  [3D SQUIRREL]         │
│  (Small, animated)     │
│                        │
│  🟢 QUICK PLAY!        │
├────────────────────────┤
│   SIGN UP FREE         │
│   6 FREE characters    │
│                        │
│ 🔄 [🦊 🐻 🐰]          │
│ (Horizontal scroll)    │
│                        │
│  🟠 SIGN UP            │
│  🔒 Sign In            │
└────────────────────────┘
│ Start collecting! 🌰   │
└────────────────────────┘
```
**Dimensions**: 375x812 (iPhone 12/13/14)
**Layout**: STACKED (vertical)
**3D Models**: Scaled down 50%
**Carousel**: Horizontal scroll instead of auto-rotate
**Buttons**: Full width, 50px tall
**Font sizes**: Reduced 20%

---

### iPhone Landscape (≤932px width, ≤500px height) - SIDE-BY-SIDE COMPACT
```
┌─────────────────────────────────────────────────────────┐
│  🌲 HIDDEN WALNUTS 🌰                                   │
├────────────────────────┬────────────────────────────────┤
│  QUICK PLAY            │  SIGN UP FREE                  │
│                        │                                │
│ 👤 [________]          │ 🔄 [🦊🐻]                      │
│                        │                                │
│ [SQUIRREL]             │ (Mini carousel)                │
│ (Tiny)                 │                                │
│                        │                                │
│ 🟢 PLAY                │ 🟠 SIGN UP                     │
│                        │ 🔒 Sign In                     │
└────────────────────────┴────────────────────────────────┘
```
**Dimensions**: 844x390 (iPhone 14 Pro landscape)
**Layout**: Two columns (50/50)
**3D Models**: Minimal size (30%)
**Text**: Extremely compact
**Carousel**: Shows 2 characters instead of 3
**Buttons**: 150px wide, 40px tall

---

### Small Tablets (600px - 767px) - STACKED
```
┌──────────────────────────────┐
│  🌲 HIDDEN WALNUTS 🌰        │
│    Welcome to Forest         │
├──────────────────────────────┤
│     QUICK PLAY               │
│   No login needed            │
│                              │
│ 👤 Name: [___________]       │
│                              │
│    [3D SQUIRREL]             │
│    (Medium size)             │
│                              │
│    🟢 QUICK PLAY!            │
├──────────────────────────────┤
│    SIGN UP FREE              │
│  Unlock 6 FREE characters    │
│                              │
│   🔄 [🦊 🐻 🐰]              │
│   (Medium carousel)          │
│                              │
│    🟠 SIGN UP                │
│    🔒 Sign In                │
└──────────────────────────────┘
│ Start collecting! 🌰         │
└──────────────────────────────┘
```
**Dimensions**: 600-767px wide
**Layout**: STACKED (vertical)
**3D Models**: Scaled down 60%
**Buttons**: 80% width

---

## RESPONSIVE BREAKPOINTS

### CSS Media Queries

```css
/* Desktop - Side by side */
@media (min-width: 1025px) {
  .welcome-container {
    display: flex;
    flex-direction: row;
    max-width: 1400px;
  }
  .column {
    width: 50%;
  }
  .character-3d {
    height: 400px;
  }
  .carousel-item {
    width: 200px;
  }
}

/* iPad Landscape - Side by side, smaller */
@media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) {
  .welcome-container {
    display: flex;
    flex-direction: row;
  }
  .column {
    width: 50%;
  }
  .character-3d {
    height: 300px;
  }
  .carousel-item {
    width: 150px;
  }
  button {
    font-size: 18px;
    padding: 12px 24px;
  }
}

/* iPad Portrait - Stacked */
@media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
  .welcome-container {
    display: flex;
    flex-direction: column;
  }
  .column {
    width: 100%;
    padding: 30px;
  }
  .character-3d {
    height: 300px;
  }
  .carousel-item {
    width: 150px;
  }
  button {
    width: 90%;
    max-width: 400px;
  }
}

/* Small Tablets - Stacked */
@media (min-width: 600px) and (max-width: 767px) {
  .welcome-container {
    display: flex;
    flex-direction: column;
  }
  .column {
    width: 100%;
    padding: 25px;
  }
  .character-3d {
    height: 250px;
  }
  .carousel-item {
    width: 120px;
  }
}

/* iPhone Portrait - Stacked, compact */
@media (max-width: 599px) and (orientation: portrait) {
  .welcome-container {
    display: flex;
    flex-direction: column;
  }
  .column {
    width: 100%;
    padding: 20px 15px;
  }
  .character-3d {
    height: 180px;
  }
  .carousel-item {
    width: 80px;
  }
  h1 {
    font-size: 28px;
  }
  h2 {
    font-size: 18px;
  }
  button {
    width: 100%;
    font-size: 16px;
    padding: 12px;
  }
}

/* iPhone Landscape - Side by side, very compact */
@media (max-width: 932px) and (max-height: 500px) and (orientation: landscape) {
  .welcome-container {
    display: flex;
    flex-direction: row;
  }
  .column {
    width: 50%;
    padding: 10px;
  }
  .character-3d {
    height: 120px;
  }
  .carousel-item {
    width: 60px;
  }
  h1 {
    font-size: 20px;
  }
  h2 {
    font-size: 14px;
  }
  button {
    font-size: 14px;
    padding: 8px 16px;
  }
  .carousel {
    /* Show only 2 characters in landscape */
    max-width: 150px;
  }
}
```

---

## RESPONSIVE BEHAVIOR SUMMARY

| Screen Type | Layout | Squirrel Size | Carousel | Button Width |
|-------------|--------|---------------|----------|--------------|
| Desktop 1025+ | Side-by-side | 400px | 3 visible, auto-rotate | 300px |
| iPad Landscape | Side-by-side | 300px | 3 visible, auto-rotate | 250px |
| iPad Portrait | Stacked | 300px | 3 visible, auto-rotate | 90% width |
| Small Tablet | Stacked | 250px | 3 visible, auto-rotate | 90% width |
| iPhone Portrait | Stacked | 180px | Horizontal scroll | 100% width |
| iPhone Landscape | Side-by-side | 120px | 2 visible, manual scroll | 150px |

---

## SCREEN 2A: Name Entry (Quick Play Path)

### Triggered By: Clicking "Play as Squirrel"

```
╔═══════════════════════════════════════════════════════════════════╗
║                    QUICK PLAY - NAME ENTRY                        ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │                    🐿️ Playing as Squirrel              │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                  What should we call you?                         ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │   [___________________]                                 │   ║
║   │    Enter your nickname                                  │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║              ┌───────────────┐                                    ║
║              │  Continue  →  │                                    ║
║              └───────────────┘                                    ║
║                                                                   ║
║                     ← Back                                        ║
║                                                                   ║
║   ℹ️  Guest players are limited to Squirrel character            ║
║   ℹ️  Progress is not saved across sessions                      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Modal overlay (dims background)
- Shows squirrel icon/preview
- Input field with placeholder
- Clear warnings about limitations
- "Back" button returns to Welcome Screen
- "Continue" validates name (3-20 chars) and proceeds to Character Selection
  - **Special behavior**: Character grid shows ONLY Squirrel (locked state for others)

---

## SCREEN 2B: Signup Form (Create Account Path)

### Triggered By: Clicking "Sign Up Free"

```
╔═══════════════════════════════════════════════════════════════════╗
║                    CREATE YOUR ACCOUNT                            ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │    Unlock 6 Free Characters + Save Your Progress        │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   Username                                                        ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]                                   │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   Email                                                           ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]                                   │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   Password                                                        ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]  👁️                              │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║   Password Strength: [████████░░] Strong                         ║
║                                                                   ║
║   Confirm Password                                                ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]  👁️                              │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   [ ] I agree to Terms of Service and Privacy Policy             ║
║                                                                   ║
║              ┌───────────────────────┐                            ║
║              │   Create Account  →   │                            ║
║              └───────────────────────┘                            ║
║                                                                   ║
║                     ← Back                                        ║
║                                                                   ║
║          Already have an account? Log In                          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Full AuthModal (already built)
- Real-time validation
- Password strength meter
- Show/hide password toggles
- On success → Email verification overlay
- After verification → Character Selection (all 6 free characters available)

---

## SCREEN 2C: Login Form (Existing User Path)

### Triggered By: Clicking "Log In"

```
╔═══════════════════════════════════════════════════════════════════╗
║                    WELCOME BACK!                                  ║
║                                                                   ║
║   Email or Username                                               ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]                                   │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   Password                                                        ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ [___________________]  👁️                              │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║   [ ] Remember me                                                 ║
║                                                                   ║
║              ┌───────────────┐                                    ║
║              │   Log In  →   │                                    ║
║              └───────────────┘                                    ║
║                                                                   ║
║                  Forgot password?                                 ║
║                                                                   ║
║                     ← Back                                        ║
║                                                                   ║
║          Don't have an account? Sign Up Free                      ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Standard login form (already built)
- "Remember me" checkbox
- Forgot password link
- On success → Character Selection (shows last used character)

---

## SCREEN 3A: Character Selection (Quick Play - Squirrel Only)

```
╔═══════════════════════════════════════════════════════════════════╗
║                    SELECT YOUR CHARACTER                          ║
║                   (Playing as Guest)                              ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               ║
║   │   🐿️   │  │   🐇   │  │   🐐   │  │   🦊   │               ║
║   │Squirrel│  │  Hare  │  │  Goat  │  │  Fox   │               ║
║   │        │  │        │  │        │  │        │               ║
║   │  FREE  │  │ 🔒 LOCKED│ 🔒 LOCKED│ 🔒 LOCKED│               ║
║   │[SELECTED]│ │Sign Up │  │Sign Up │  │Sign Up │               ║
║   └────────┘  └────────┘  └────────┘  └────────┘               ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               ║
║   │   🐻   │  │   🐱   │  │   🦌   │  │   🐺   │               ║
║   │  Bear  │  │  Lynx  │  │  Deer  │  │  Wolf  │               ║
║   │        │  │        │  │        │  │        │               ║
║   │ 🔒 LOCKED│ 🔒 LOCKED│ 🔒 LOCKED│ 🔒 LOCKED│               ║
║   │Sign Up │  │Sign Up │  │Sign Up │  │Sign Up │               ║
║   └────────┘  └────────┘  └────────┘  └────────┘               ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐                            ║
║   │   🐗   │  │   🦅   │  │   🐢   │                            ║
║   │  Boar  │  │  Eagle │  │ Turtle │                            ║
║   │        │  │        │  │        │                            ║
║   │💎PREMIUM│ 💎PREMIUM│ 💎PREMIUM│                            ║
║   │ Locked │  │ Locked │  │ Locked │                            ║
║   └────────┘  └────────┘  └────────┘                            ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ 🎁 Sign Up Free to unlock 5 more characters!            │   ║
║   │                                                         │   ║
║   │    [✨ Create Free Account]                             │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Squirrel is pre-selected (green highlight border)
- All other characters show lock overlay
- Clicking locked character shows tooltip: "Sign up free to unlock this character"
- Bottom banner entices signup
- **Automatically proceeds to next screen after 2 seconds** (or instant if user clicks squirrel card again)

---

## SCREEN 3B: Character Selection (Authenticated - 6 Free Characters)

```
╔═══════════════════════════════════════════════════════════════════╗
║                    SELECT YOUR CHARACTER                          ║
║                   Welcome, [USERNAME]!                            ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               ║
║   │   🐿️   │  │   🐇   │  │   🐐   │  │   🦊   │               ║
║   │Squirrel│  │  Hare  │  │  Goat  │  │  Fox   │               ║
║   │        │  │        │  │        │  │        │               ║
║   │  FREE  │  │  FREE  │  │  FREE  │  │  FREE  │               ║
║   │[SELECTED]│ │        │  │        │  │        │               ║
║   └────────┘  └────────┘  └────────┘  └────────┘               ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐               ║
║   │   🐻   │  │   🐱   │  │   🦌   │  │   🐺   │               ║
║   │  Bear  │  │  Lynx  │  │  Deer  │  │  Wolf  │               ║
║   │        │  │        │  │        │  │        │               ║
║   │  FREE  │  │  FREE  │  │ PREMIUM│  │ PREMIUM│               ║
║   │        │  │        │  │💎$2.99 │  │💎$2.99 │               ║
║   └────────┘  └────────┘  └────────┘  └────────┘               ║
║                                                                   ║
║   ┌────────┐  ┌────────┐  ┌────────┐                            ║
║   │   🐗   │  │   🦅   │  │   🐢   │                            ║
║   │  Boar  │  │  Eagle │  │ Turtle │                            ║
║   │        │  │        │  │        │                            ║
║   │ PREMIUM│  │ PREMIUM│  │ PREMIUM│                            ║
║   │💎$2.99 │  │💎$2.99 │  │💎$2.99 │                            ║
║   └────────┘  └────────┘  └────────┘                            ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │   [Selected: Squirrel]                                  │   ║
║   │                                                         │   ║
║   │   Click any character to see 3D preview                 │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- All 6 free characters are clickable
- Premium characters show price and "Buy Now" on click
- Clicking any card opens **CharacterPreviewModal** with 3D model
- Selection updates immediately (green border on selected card)
- No "Apply" or "Confirm" button - selection happens instantly

---

## SCREEN 3C: Character Preview Modal (3D Preview)

### Triggered By: Clicking any character card

```
╔═══════════════════════════════════════════════════════════════════╗
║                    ✕                                              ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │                                                         │   ║
║   │                    [3D MODEL]                           │   ║
║   │                                                         │   ║
║   │                  🐻 Bear (FREE)                         │   ║
║   │                                                         │   ║
║   │            Playing idle animation                       │   ║
║   │            Rotating 360° slowly                         │   ║
║   │                                                         │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                       Bear                                        ║
║            Powerful forest guardian                               ║
║                                                                   ║
║   Stats:                                                          ║
║   Speed: ★★☆☆☆                                                  ║
║   Health: ★★★★★                                                 ║
║   Stealth: ★☆☆☆☆                                                ║
║                                                                   ║
║              ┌─────────────────────┐                              ║
║              │  SELECT THIS CHARACTER │                           ║
║              └─────────────────────┘                              ║
║                                                                   ║
║                     Cancel                                        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Full-screen modal overlay
- Three.js scene with actual GLTF character model
- Idle animation plays
- Auto-rotate camera
- Character stats/description
- "Select This Character" button
- Clicking outside modal or "Cancel" returns to grid
- **This component already exists and works correctly!**

---

## SCREEN 4: Ready Screen with "Enter Forest" Button (NEW)

### Appears After: Character selection is confirmed

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │                                                         │   ║
║   │                                                         │   ║
║   │                    [3D SQUIRREL]                        │   ║
║   │                                                         │   ║
║   │                  Playing as Squirrel                    │   ║
║   │                                                         │   ║
║   │            Idle animation looping                       │   ║
║   │                                                         │   ║
║   │                                                         │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                                                                   ║
║                    Ready, [USERNAME]?                             ║
║                                                                   ║
║                                                                   ║
║              ┌──────────────────────────────┐                     ║
║              │                              │                     ║
║              │    🌲  ENTER THE FOREST      │                     ║
║              │                              │                     ║
║              └──────────────────────────────┘                     ║
║                                                                   ║
║                                                                   ║
║                   ← Change Character                              ║
║                                                                   ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Key Design Elements:

**3D Character Display:**
- Full 3D model of selected character
- Idle animation playing
- Slow rotation
- Takes up top 60% of screen

**"Enter the Forest" Button:**
- Large, prominent button (320px wide, 80px tall)
- Forest green gradient background
- Gold border (3px solid #FFD700)
- Tree emoji icon 🌲
- Drop shadow and glow effect
- Hover: Scale up 5%, increase glow
- Click: Button shrinks slightly, proceeds to loading

**"Change Character" Link:**
- Small, subtle link at bottom
- Returns to character selection screen
- Preserves current selection as default

### Behavior:
- Button appears with bounce animation (0.5s)
- Clicking "Enter Forest" proceeds to loading screen
- This is the **explicit start event** - no auto-spawning
- Character preview makes player feel invested
- Creates moment to prepare mentally

---

## SCREEN 5: Loading Screen (Existing)

```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                    🌰 Hidden Walnuts 🌰                          ║
║                                                                   ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐   ║
║   │ ████████████████████████████░░░░░░░░░░░░░░░░            │   ║
║   └─────────────────────────────────────────────────────────┘   ║
║                        Loading: 73%                               ║
║                                                                   ║
║                   Connecting to forest...                         ║
║                                                                   ║
║   🌲 Tip: Look for shaking bushes - they might contain           ║
║         hidden walnuts!                                           ║
║                                                                   ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Behavior:
- Shows progress bar
- Rotates through loading tips
- Turnstile challenge (bot protection)
- Loads game assets
- Connects to WebSocket server
- When 100% → Fades to game

---

## SCREEN 6: Game World (Existing)

```
╔═══════════════════════════════════════════════════════════════════╗
║  ⚙️ [ESC]                                    🌰 Walnuts: 5      ║
║                                                                   ║
║                                                                   ║
║              [3D GAME WORLD - FOREST]                             ║
║                                                                   ║
║                    🐿️ Player                                     ║
║                                                                   ║
║              🌲     🌲     🌲     🌲                              ║
║                                                                   ║
║         🐇                           🌰                           ║
║                                                                   ║
║                  🌲           🌲                                  ║
║                                                                   ║
║                         🐻                                        ║
║                                                                   ║
║  💚💚💚💚💚 Health: 100                                          ║
║                                                                   ║
║  [WASD] Move  [SPACE] Jump  [E] Collect                          ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Changes from Current:
- **Settings Button Behavior**:
  - During gameplay: Settings opens but auth options are DISABLED/GRAYED
  - Tooltip: "Return to lobby to change account settings"
  - Audio, controls, tips still accessible

---

## COMPARISON: OLD FLOW vs NEW FLOW

### OLD FLOW (Current - Broken)
```
1. Welcome → Enter Name (no context)
2. Character Selection (dropdown, no preview)
3. [IMMEDIATE SPAWN INTO GAME] ← No explicit start
4. Settings menu has auth (vulnerable to attacks)
```

**Problems:**
- ❌ Asks for commitment before showing value
- ❌ No character preview (emoji only)
- ❌ No explicit start moment
- ❌ Auth during gameplay = vulnerability
- ❌ JWT_SECRET missing = broken signup

---

### NEW FLOW (Proposed)
```
1. Welcome → Show Value (3D characters)
2. Choose Path (Quick Play / Sign Up / Log In)
3. Character Selection (visual grid, 3D on click)
4. Ready Screen → "ENTER FOREST" button ← Explicit start
5. Loading
6. Game spawns (safe)
7. Settings auth disabled during gameplay
```

**Improvements:**
- ✅ Shows value FIRST (enticement)
- ✅ 3D character previews throughout
- ✅ Explicit start event (control)
- ✅ Auth happens BEFORE gameplay (safe)
- ✅ JWT_SECRET fixed

---

## MOBILE CONSIDERATIONS

### Screen 1: Welcome (Mobile)
```
┌─────────────────────┐
│                     │
│   [3D CHARACTERS]   │  ← Horizontal scrollable
│   🐿️   🐻   🐱     │
│                     │
│  Hidden Walnuts     │
│                     │
│ ┌─────────────────┐ │
│ │  🐿️ Quick Play │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │  ✨ Sign Up     │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │  🔑 Log In      │ │
│ └─────────────────┘ │
│                     │
└─────────────────────┘
```

### Screen 3: Character Grid (Mobile)
```
┌─────────────────────┐
│ SELECT CHARACTER    │
│                     │
│ ┌───┐ ┌───┐        │  ← 2-column grid
│ │🐿️ │ │🐇 │        │    Vertical scroll
│ └───┘ └───┘        │
│ ┌───┐ ┌───┐        │
│ │🐐 │ │🦊 │        │
│ └───┘ └───┘        │
│ ┌───┐ ┌───┐        │
│ │🐻 │ │🐱 │        │
│ └───┘ └───┘        │
│                     │
│ [Scroll down...]    │
│                     │
└─────────────────────┘
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Critical Fixes
- [x] JWT_SECRET configuration (.dev.vars created)
- [ ] Set production JWT_SECRET via wrangler
- [ ] Test signup/login works

### Phase 2: Welcome Screen Redesign
- [ ] Create new WelcomeScreen.ts component
- [ ] Add Three.js scene with 3 character models
- [ ] Implement 3 button paths
- [ ] Add loading states for 3D models
- [ ] Mobile responsive layout
- [ ] Fade in/out animations

### Phase 3: Name Entry Flow
- [ ] Create name entry modal (for Quick Play path)
- [ ] Validation (3-20 chars, no special chars)
- [ ] Show limitations clearly
- [ ] "Back" button returns to Welcome

### Phase 4: Character Selection Updates
- [ ] Update CharacterGrid for "locked" state display
- [ ] Auto-proceed for Quick Play (Squirrel only)
- [ ] Add bottom CTA banner for Quick Play users
- [ ] Test CharacterPreviewModal (already works)
- [ ] Update mobile grid layout

### Phase 5: Ready Screen (NEW)
- [ ] Create ReadyScreen component
- [ ] 3D character preview with idle animation
- [ ] "Enter the Forest" button with animations
- [ ] "Change Character" link
- [ ] Button hover/click effects

### Phase 6: Main.ts Flow Integration
- [ ] Refactor main() function flow
- [ ] Handle 3 paths (Quick Play, Sign Up, Log In)
- [ ] Session restoration check
- [ ] Integrate Ready Screen
- [ ] Remove auto-spawn logic

### Phase 7: Settings Protection
- [ ] Add gameplay state tracking
- [ ] Disable auth buttons during gameplay
- [ ] Add tooltips explaining why disabled
- [ ] Test Settings during game

### Phase 8: Testing
- [ ] Test Quick Play flow (guest)
- [ ] Test Sign Up flow (new user)
- [ ] Test Log In flow (returning user)
- [ ] Test character selection for each path
- [ ] Test "Enter Forest" button
- [ ] Test mobile experience
- [ ] Cross-browser testing

---

## ESTIMATED TIMELINE

### Day 1-2: Foundation (16 hours)
- Welcome Screen redesign with 3D previews
- Three button paths implementation
- Name entry modal for Quick Play

### Day 3: Character Selection (8 hours)
- Update locked states
- Auto-proceed logic
- CTA banners

### Day 4: Ready Screen & Integration (8 hours)
- Create Ready Screen component
- Integrate into main.ts flow
- Settings protection

### Day 5: Testing & Polish (8 hours)
- End-to-end testing
- Mobile optimization
- Bug fixes

**Total: 40 hours (5 days @ 8 hours/day)**

---

## NEXT STEPS

1. **Approve mockup design** - Any changes to visual layout?
2. **Set production JWT_SECRET** - Run: `npx wrangler secret put JWT_SECRET`
3. **Begin implementation** - Start with Welcome Screen redesign
4. **Iterative testing** - Deploy each phase to Cloudflare Preview

---

## OPEN QUESTIONS

1. **Lobby System**: Do you want a persistent lobby (like Fortnite) where players can hang out, or just the "Ready Screen" with "Enter Forest" button?
   - Option A: Simple ready screen (faster to implement)
   - Option B: Full lobby with chat, emotes, party system (larger scope)

2. **Character Preview Performance**: Should we lazy-load 3D models on Welcome Screen, or load all 3 immediately?
   - Option A: Load all 3 (better UX, slower initial load)
   - Option B: Load Squirrel first, others delayed (faster initial, staggered appearance)

3. **Quick Play Auto-proceed**: Should Quick Play users stay on character grid for 2 seconds before auto-proceeding, or proceed immediately?
   - Option A: 2-second delay (gives time to see locked characters)
   - Option B: Immediate (fastest path to game)

4. **Settings Auth Access**: Should we completely hide auth buttons during gameplay, or just disable them with tooltip?
   - Option A: Hide completely (cleaner)
   - Option B: Disabled with tooltip (educational)
