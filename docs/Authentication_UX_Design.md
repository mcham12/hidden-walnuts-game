# Authentication UX Design - Hidden Walnuts MVP 16

**Document Version**: 1.0
**Created**: 2025-11-04
**Status**: UX Design & Planning Phase
**Branch**: mvp-simple-16

---

## Executive Summary

This document outlines the user experience design for implementing authentication in Hidden Walnuts MVP 16. The design prioritizes **progressive disclosure**, **low friction**, and **clear value proposition** to convert no-auth players into authenticated users, while maintaining the quick-play option that makes the game accessible.

**Core UX Principles**:
1. **Play First, Ask Later** - Don't force signup before trying the game
2. **Show, Don't Tell** - Demonstrate benefits through gameplay (locked characters, leaderboards)
3. **Low Friction** - Email + password only (no social auth complexity)
4. **Clear Value** - "6 Free Characters + Cross-Device Sync" messaging
5. **Multi-Platform** - Responsive design (desktop, iPad portrait/landscape, iPhone portrait/landscape)

---

## 1. UX Philosophy

### 1.1 Progressive Disclosure

**Avoid Overwhelming New Users**:
- Landing page shows "Play Now" (no signup required)
- Let players experience core gameplay first (5-10 minutes)
- Introduce authentication naturally through gameplay friction

**Enticement Through Gameplay**:
- Character selection screen shows 10 locked characters (visual appeal)
- Leaderboard shows "🔒 Verified" badge on authenticated players
- In-game toast notifications: "Sign up to unlock 6 characters!"
- Settings menu: "Upgrade Account" section for no-auth users

### 1.2 Value Proposition Hierarchy

**Primary Benefits** (Most Compelling):
1. **6 Free Characters** - Immediate gameplay variety
2. **Cross-Device Sync** - Play on phone, tablet, desktop seamlessly
3. **Hall of Fame** - Long-term leaderboard competition

**Secondary Benefits** (Supporting):
4. **Progress Tracking** - Lifetime stats, achievements
5. **Verified Badge** - Social proof on leaderboards
6. **Premium Access** - Ability to purchase premium characters (Lynx, Bear, Moose, Badger)

**Messaging Examples**:
- "Sign Up Free to Unlock 6 Characters!" ← Primary
- "Play on Any Device - Your Progress Syncs Automatically" ← Primary
- "Compete on the Hall of Fame Leaderboard" ← Primary
- "Get Your Verified Player Badge" ← Secondary

### 1.3 Conversion Funnel

**Stage 1: Discovery (No-Auth User)**
- User lands on site → Clicks "Play Now"
- Immediate gameplay with Squirrel character
- No barriers, instant gratification

**Stage 2: Enticement (First 5 Minutes)**
- Character selection shows 10 locked characters
- Visual appeal creates desire ("I want to try the Bear!")
- Leaderboard shows verified players with 🔒 badge

**Stage 3: Conversion Prompt (10-15 Minutes)**
- Toast notification: "You're doing great! Sign up to unlock 6 free characters"
- Settings menu: "Upgrade Account" section visible
- Character selection: "Sign Up to Unlock" button on locked characters

**Stage 4: Signup Flow (1-2 Minutes)**
- Lightweight form: Username, Email, Password (3 fields)
- Clear benefits listed: "6 characters + cross-device sync"
- Submit → Email verification sent

**Stage 5: Email Verification (5 Minutes)**
- "Check Your Email!" overlay
- Click verification link → Welcome overlay
- Characters unlocked immediately

**Stage 6: Retention (Ongoing)**
- Welcome overlay: "You've unlocked 6 characters!"
- Character selection pre-filled with last character
- Seamless transition back to gameplay

---

## 2. Player Journey Flows

### 2.1 No-Auth User Journey

```
Landing Page
    ↓
[Play Now] (No signup)
    ↓
Character Selection (Squirrel only, 10 locked)
    ↓
Gameplay (Squirrel character)
    ↓
Leaderboard (See verified players with 🔒)
    ↓
Toast Notification: "Sign up to unlock 6 characters!"
    ↓
Settings → [Upgrade Account] or Character Selection → [Sign Up]
    ↓
Signup Flow
```

**Pain Points** (Designed Friction):
- ✅ Only 1 character (boring after 10+ minutes)
- ✅ Can't sync across devices (progress loss fear)
- ✅ Not on Hall of Fame leaderboard (competitive players care)
- ✅ No verified badge (social proof)

**Enticement Touchpoints**:
- Character selection: Show 10 locked characters (visual desire)
- Leaderboard: "Top 10 weekly: Authenticated players only"
- Settings: "Guest Account - Upgrade to unlock more"
- Toast notifications every 15 minutes: "Sign up for 6 free characters"

---

### 2.2 Signup Flow

```
User clicks "Sign Up"
    ↓
Signup Modal Opens
    ├─ Username field (pre-filled if existing guest username)
    ├─ Email field
    ├─ Password field (show/hide toggle)
    └─ Confirm Password field
    ↓
Client-side validation (real-time)
    ├─ Username: 3-20 chars, alphanumeric + underscore
    ├─ Email: Valid email format
    ├─ Password: 8+ chars, 1 uppercase, 1 lowercase, 1 number
    └─ Confirm: Matches password
    ↓
[Create Account] button (disabled until valid)
    ↓
Server-side validation
    ├─ Check email uniqueness
    ├─ Check username uniqueness
    ├─ Check password strength
    └─ Generate verification token
    ↓
Success: "Check Your Email!" overlay
    ├─ "We sent a verification link to: user@example.com"
    ├─ [Resend Email] button (rate limited)
    └─ [Play as Guest] button (continue without verification)
    ↓
User clicks email verification link
    ↓
Email Verified Success
    ├─ "Your account is verified!"
    ├─ "You've unlocked 6 characters!"
    └─ Redirect to character selection
```

**Error Handling**:
- Email already exists: "This email is already registered. [Log In Instead]"
- Username taken: "Username already taken. Try: [suggestion]"
- Weak password: "Password must be 8+ chars with uppercase, lowercase, and number"
- Network error: "Connection issue. Please try again."

---

### 2.3 Login Flow

```
User clicks "Log In"
    ↓
Login Modal Opens
    ├─ Email field
    └─ Password field (show/hide toggle)
    ↓
[Forgot Password?] link
    ↓
[Log In] button
    ↓
Server-side validation
    ├─ Check email exists
    ├─ Verify password
    └─ Check rate limiting (5 attempts/hour)
    ↓
Success: Redirect to character selection
    ├─ Pre-filled with lastCharacterId
    ├─ Welcome back toast: "Welcome back, [Username]!"
    └─ Seamless gameplay

Failure: Show error
    ├─ "Invalid email or password"
    ├─ After 3 failures: "2 attempts remaining before lockout"
    └─ After 5 failures: "Too many attempts. Try again in 1 hour."
```

**Email Not Verified**:
- Allow login but show reminder: "Your email isn't verified. [Resend Email]"
- Still unlock 6 characters (don't penalize for not checking email)
- Remind every 3rd login until verified

---

### 2.4 Forgot Password Flow

```
User clicks "Forgot Password?"
    ↓
Forgot Password Modal
    └─ Email field
    ↓
[Send Reset Link] button
    ↓
Server-side processing
    ├─ Check email exists
    ├─ Generate reset token (1-hour expiration)
    └─ Send password reset email
    ↓
Success: "Check Your Email!" overlay
    ├─ "We sent a password reset link to: user@example.com"
    ├─ "Link expires in 1 hour"
    └─ [Back to Login]
    ↓
User clicks reset link in email
    ↓
Reset Password Page
    ├─ New Password field
    └─ Confirm Password field
    ↓
[Reset Password] button
    ↓
Success: "Password Updated!"
    └─ Redirect to login page
```

---

### 2.5 Email Verification Pending Flow

```
User signs up
    ↓
"Check Your Email!" overlay
    ├─ "We sent a verification link to: user@example.com"
    ├─ "Click the link to unlock 6 characters"
    ├─ [Resend Email] button (3 per hour limit)
    └─ [Play as Guest] button
    ↓
Option A: User clicks [Play as Guest]
    ├─ Continue gameplay with Squirrel
    ├─ Show "Verify Email" reminder in settings
    └─ Toast every 15 minutes: "Verify email to unlock 6 characters"
    ↓
Option B: User clicks verification link (in email)
    ├─ Verify token server-side
    ├─ Update emailVerified: true
    ├─ Unlock 6 characters
    ├─ Send welcome email
    └─ Show "Welcome!" overlay
```

**Welcome Overlay** (After Email Verification):
```
┌─────────────────────────────────────────────┐
│  🎉 Welcome to Hidden Walnuts, [Username]!│
│                                             │
│  Your account is verified! You now have:   │
│  ✅ 6 characters (Squirrel, Hare, Goat,   │
│       Chipmunk, Turkey, Mallard)            │
│  ✅ Cross-device sync                      │
│  ✅ Hall of Fame leaderboard               │
│  ✅ Progress tracking                      │
│                                             │
│  [Start Playing →]                         │
└─────────────────────────────────────────────┘
```

---

## 3. Screen Designs & Wireframes

### 3.1 Landing Screen (First-Time Visitor)

**Desktop (1920x1080)**:
```
┌────────────────────────────────────────────────────────┐
│                  🌰 HIDDEN WALNUTS 🌰                  │
│                                                        │
│          [Large 3D Forest Preview Animation]           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  🎮 Play Now (No Account Needed)                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  🔐 Sign Up Free                                  │ │
│  │  Unlock 6 characters + cross-device sync          │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  Already have an account? [Log In]                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**iPad (1024x768 Portrait)**:
```
┌─────────────────────────────────────┐
│      🌰 HIDDEN WALNUTS 🌰           │
│                                     │
│   [3D Forest Preview]               │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  🎮 Play Now (No Account)    │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  🔐 Sign Up Free              │ │
│  │  6 characters + sync          │ │
│  └───────────────────────────────┘ │
│                                     │
│  Already have an account? [Log In] │
└─────────────────────────────────────┘
```

**iPhone (375x667 Portrait)**:
```
┌──────────────────────────┐
│  🌰 HIDDEN WALNUTS 🌰    │
│                          │
│   [Forest Preview]       │
│                          │
│  ┌────────────────────┐ │
│  │  🎮 Play Now       │ │
│  │  (No Account)      │ │
│  └────────────────────┘ │
│                          │
│  ┌────────────────────┐ │
│  │  🔐 Sign Up Free   │ │
│  │  6 characters      │ │
│  └────────────────────┘ │
│                          │
│  Have account? [Log In] │
└──────────────────────────┘
```

---

### 3.2 Character Selection Screen

**No-Auth User** (Desktop):
```
┌────────────────────────────────────────────────────────────────┐
│  Choose Your Character                          [Guest Account]│
│                                                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                              │
│  │🐿️  │ │🐇🔒│ │🐐🔒│ │🐿️🔒│  ← Locked (free for auth)   │
│  │Squi │ │Hare │ │Goat │ │Chip │                              │
│  │✅   │ │     │ │     │ │     │                              │
│  └─────┘ └─────┘ └─────┘ └─────┘                              │
│                                                                 │

│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  🔐 Sign Up Free to Unlock 6 Characters!                 │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [SELECT SQUIRREL]                            [Sign Up] [Login]│
└────────────────────────────────────────────────────────────────┘
```

**Legend**:
- ✅ = Available (green checkmark)
- 🔒 = Locked (free for authenticated users)


**Authenticated User** (Desktop):
```
┌────────────────────────────────────────────────────────────────┐
│  Choose Your Character                   [Verified: Username]🔒│
│                                                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                              │
│  │🐿️✅│ │🐇✅│ │🐐✅│ │🐿️✅│  ← Available (free)          │
│  │Squi │ │Hare │ │Goat │ │Chip │                              │
│  └─────┘ └─────┘ └─────┘ └─────┘                              │
│                                                                 │

│                                                                 │
│  (All characters are free for authenticated users!)                           │
│                                                                 │
│  [SELECT CHARACTER]                                  [Settings]│
└────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Signup Modal

**Desktop (600px width, centered)**:
```
┌────────────────────────────────────────────────┐
│  Create Your Account                       [X] │
├────────────────────────────────────────────────┤
│                                                │
│  Sign up to unlock:                            │
│  ✅ 6 characters (Squirrel, Hare, Goat & more)│
│  ✅ Cross-device sync (play anywhere)         │
│  ✅ Hall of Fame leaderboard                  │
│                                                │
│  Username                                      │
│  ┌──────────────────────────────────────────┐ │
│  │ [Pre-filled if guest]                    │ │
│  └──────────────────────────────────────────┘ │
│  ✅ Available                                  │
│                                                │
│  Email                                         │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Password                                      │
│  ┌──────────────────────────────────────────┐ │
│  │                                    [👁️] │ │
│  └──────────────────────────────────────────┘ │
│  ⚠️ 8+ chars, 1 uppercase, 1 lowercase, 1 #  │
│                                                │
│  Confirm Password                              │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│  ✅ Passwords match                            │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Create Account]                        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Already have an account? [Log In]             │
│                                                │
└────────────────────────────────────────────────┘
```

**Validation States**:
- ✅ Green checkmark + text (valid)
- ⚠️ Yellow warning + text (requirements)
- ❌ Red X + error message (invalid)

**iPhone Portrait (375px width, full-screen)**:
```
┌──────────────────────────┐
│  Create Account      [X] │
├──────────────────────────┤
│                          │
│  Unlock 6 characters!    │
│  ✅ Cross-device sync    │
│  ✅ Hall of Fame         │
│                          │
│  Username                │
│  ┌────────────────────┐ │
│  │                    │ │
│  └────────────────────┘ │
│                          │
│  Email                   │
│  ┌────────────────────┐ │
│  │                    │ │
│  └────────────────────┘ │
│                          │
│  Password          [👁️] │
│  ┌────────────────────┐ │
│  │                    │ │
│  └────────────────────┘ │
│  8+ chars, 1 upper, 1 # │
│                          │
│  Confirm Password        │
│  ┌────────────────────┐ │
│  │                    │ │
│  └────────────────────┘ │
│                          │
│  ┌────────────────────┐ │
│  │  [Create Account]  │ │
│  └────────────────────┘ │
│                          │
│  Have account? [Log In] │
│                          │
└──────────────────────────┘
```

---

### 3.4 Login Modal

**Desktop (600px width)**:
```
┌────────────────────────────────────────────────┐
│  Welcome Back!                             [X] │
├────────────────────────────────────────────────┤
│                                                │
│  Email                                         │
│  ┌──────────────────────────────────────────┐ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Password                                      │
│  ┌──────────────────────────────────────────┐ │
│  │                                    [👁️] │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  [Forgot Password?]                            │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Log In]                                │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Don't have an account? [Sign Up]              │
│                                                │
└────────────────────────────────────────────────┘
```

**Error State** (Invalid Credentials):
```
┌────────────────────────────────────────────────┐
│  Welcome Back!                             [X] │
├────────────────────────────────────────────────┤
│                                                │
│  Email                                         │
│  ┌──────────────────────────────────────────┐ │
│  │ user@example.com                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Password                                      │
│  ┌──────────────────────────────────────────┐ │
│  │ ••••••••••••                        [👁️] │ │
│  └──────────────────────────────────────────┘ │
│  ❌ Invalid email or password                 │
│  3 attempts remaining before lockout           │
│                                                │
│  [Forgot Password?]                            │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Log In]                                │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Don't have an account? [Sign Up]              │
│                                                │
└────────────────────────────────────────────────┘
```

---

### 3.5 Email Verification Pending Overlay

**Desktop**:
```
┌────────────────────────────────────────────────┐
│  ✉️ Check Your Email!                          │
├────────────────────────────────────────────────┤
│                                                │
│  We sent a verification link to:               │
│  user@example.com                              │
│                                                │
│  Click the link to verify your account and     │
│  unlock 6 characters!                          │
│                                                │
│  Didn't receive it?                            │
│  ┌──────────────────────────────────────────┐ │
│  │  [Resend Email]                          │ │
│  └──────────────────────────────────────────┘ │
│  (Available in 59 seconds)                     │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Play as Guest]                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

---

### 3.6 Settings Menu → Account Tab

**No-Auth User**:
```
┌────────────────────────────────────────────────┐
│  [Sound] [Graphics] [Tips] [Account]  (Tabs)  │
├────────────────────────────────────────────────┤
│  Guest Account                                 │
│                                                │
│  You're playing as a guest.                    │
│  Username: Player_ab3f9d                       │
│                                                │
│  Sign up to unlock:                            │
│  ✅ 6 characters                               │
│  ✅ Cross-device sync                          │
│  ✅ Hall of Fame access                        │
│  ✅ Progress tracking                          │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  🔐 Sign Up Free                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Already have account? [Log In]                │
│                                                │
└────────────────────────────────────────────────┘
```

**Authenticated User**:
```
┌────────────────────────────────────────────────┐
│  [Sound] [Graphics] [Tips] [Account]  (Tabs)  │
├────────────────────────────────────────────────┤
│  Account Settings                              │
│                                                │
│  Username: WalnutHunter42 [Change]             │
│  Email: user@example.com ✅ Verified           │
│  Password: ••••••••• [Change]                  │
│                                                │
│  Account Created: Nov 4, 2025                  │
│  Last Login: 5 minutes ago                     │
│                                                │
│  Characters Unlocked: 6 / 11                   │
│  Premium Characters: 0 / 4                     │
│  (Premium characters coming in MVP 17!)        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Log Out]                               │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  [Delete Account]                              │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 4. Platform-Specific Considerations

### 4.1 Desktop Browser (Chrome, Safari, Firefox)

**Optimal Experience**:
- Modal overlays (600px width, centered)
- Hover states on buttons (visual feedback)
- Keyboard navigation (Tab, Enter, Esc)
- Auto-focus on first input field

**Screen Resolution Support**:
- 1920x1080 (most common)
- 1440x900 (MacBook)
- 1366x768 (smaller laptops)

**Modal Behavior**:
- Click outside modal → Close modal (not recommended for auth)
- Press Esc → Close modal
- Click [X] button → Close modal

---

### 4.2 iPad (Portrait & Landscape)

**Portrait (768x1024)**:
- Modal overlays (700px width, optimized for touch)
- Larger buttons (60px minimum height)
- Larger input fields (50px height)
- Spacing between elements (16px minimum)

**Landscape (1024x768)**:
- Horizontal layout for signup form (2-column)
- Character selection: 4x3 grid
- Modal width: 800px

**Touch Optimization**:
- 60px minimum button height
- 16px minimum spacing between interactive elements
- No hover states (touch doesn't have hover)
- Clear active states (blue outline on tap)

**Keyboard Behavior**:
- Auto-capitalize disabled on email input
- Autocorrect disabled on username/email
- Show password toggle button (easier than long-press)

---

### 4.3 iPhone (Portrait & Landscape)

**Portrait (375x667 - iPhone SE / 390x844 - iPhone 14)**:
- Full-screen auth forms (not modal)
- Vertical scrolling for long forms
- Bottom-aligned primary buttons
- Safe area padding (top 44px, bottom 34px for iPhone X+)

**Landscape (667x375 / 844x390)**:
- Compact modal (400px width, scrollable)
- Character selection: Horizontal scrolling (2x6 grid)
- Smaller font sizes (14px body, 18px headings)

**Mobile-Specific UX**:
- Show password toggle (easier than long-press)
- Email keyboard type (`<input type="email">`)
- No autocomplete/autocorrect on username
- Clear button [X] on input fields
- Bottom sheet for enticement messages

**Safe Areas** (iPhone X+):
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

---

## 5. Enticement Strategy

### 5.1 Character Selection Enticement

**Visual Hierarchy**:
1. **Available Characters** (Full color, clickable)
   - Green ✅ checkmark
   - Bright colors, clear details
   - "SELECT" button

2. **Locked Free Characters** (Grayed out, with 🔒 icon)
   - Slightly desaturated (80% opacity)
   - Blue 🔒 icon overlay
   - "Sign Up to Unlock" on hover/tap
   - Shows character preview on click



**Click Behavior**:
- Available character → Select and start game
- Locked free character → Show "Sign Up to Unlock 6 Characters" modal


**Messaging**:
- No-auth user: "Sign Up Free to Unlock 6 Characters!" (bottom CTA)


---

### 5.2 Leaderboard Enticement

**Daily Leaderboard**:
```
┌────────────────────────────────────────────────┐
│  Daily Leaderboard                             │
├────────────────────────────────────────────────┤
│  #1  🔒 WalnutKing         523 pts            │
│  #2  🔒 SquirrelMaster     498 pts            │
│  #3  🔒 ForestNinja        476 pts            │
│  #4  Guest_a3f9d2          412 pts  ← You     │
│  #5  🔒 TreeClimber        387 pts            │
│  ...                                           │
│                                                │
│  🔒 = Verified Players                         │
│  Sign up to get your verified badge!           │
└────────────────────────────────────────────────┘
```

**Weekly Leaderboard** (Top 10 Restriction):
```
┌────────────────────────────────────────────────┐
│  Weekly Leaderboard                            │
├────────────────────────────────────────────────┤
│  Top 10 - Verified Players Only                │
│                                                │
│  #1  🔒 WalnutKing        1,523 pts           │
│  #2  🔒 SquirrelMaster    1,498 pts           │
│  ...                                           │
│  #10 🔒 BadgerBoss          887 pts           │
│                                                │
│  ───────────────────────────────────────────  │
│                                                │
│  #15 Guest_a3f9d2           756 pts  ← You    │
│  #16 🔒 ChipmunkChamp       743 pts           │
│  ...                                           │
│                                                │
│  💡 Sign up to compete for top 10!            │
└────────────────────────────────────────────────┘
```

**Hall of Fame** (Authenticated Only):
```
┌────────────────────────────────────────────────┐
│  Hall of Fame (All-Time)                       │
├────────────────────────────────────────────────┤
│  Verified Players Only                         │
│                                                │
│  #1  🔒 LegendaryNut       5,823 pts          │
│  #2  🔒 WalnutEmperor      5,102 pts          │
│  ...                                           │
│                                                │
│  ───────────────────────────────────────────  │
│                                                │
│  You're not on this leaderboard yet.           │
│  Sign up to compete for all-time glory!        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  🔐 Sign Up Free                         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

---

### 5.3 Toast Notifications

**Frequency**: Every 15 minutes (max 4 per hour)

**Messages** (Rotate):
1. "Sign up to unlock 6 free characters!"
2. "Your progress isn't saved. Sign up to sync across devices!"
3. "Join the Hall of Fame leaderboard - sign up free!"
4. "Get your verified player badge - sign up now!"

**Toast Design**:
```
┌────────────────────────────────────────────────┐
│  💡 Sign up to unlock 6 free characters!      │
│  [Sign Up] [Dismiss]                           │
└────────────────────────────────────────────────┘
```

**Positioning**:
- Desktop: Top-right corner (300px width)
- iPad: Top-center (400px width)
- iPhone Portrait: Bottom (full width, above safe area)
- iPhone Landscape: Top-right (250px width, compact)

**Animation**:
- Fade in from right (0.3s ease-out)
- Stay visible for 8 seconds
- Fade out to right (0.3s ease-in)
- Dismissible by clicking [X] or [Dismiss]

---

### 5.4 Settings Menu Enticement

**Guest Account Section** (No-Auth Users):
```
┌────────────────────────────────────────────────┐
│  Settings → Account Tab                        │
├────────────────────────────────────────────────┤
│                                                │
│  You're playing as a guest.                    │
│  Username: Player_a3f9d2                       │
│                                                │
│  Upgrade to unlock:                            │
│  ✅ 6 characters (Squirrel, Hare, Goat & more)│
│  ✅ Cross-device sync (play anywhere)         │
│  ✅ Hall of Fame leaderboard                  │
│  ✅ Progress tracking (lifetime stats)        │
│  ✅ Verified player badge (🔒)                │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  🔐 Sign Up Free (2 minutes)             │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Already have account? [Log In]                │
│                                                │
└────────────────────────────────────────────────┘
```

**Badge Count** (Visual Incentive):
- "6 characters unlocked" (progress bar: 1/11 → 6/11)
- "Verified badge earned" (visual achievement)
- "Hall of Fame access" (exclusive content)

---

## 6. Accessibility Considerations

### 6.1 Keyboard Navigation

**Tab Order**:
1. Username field
2. Email field
3. Password field
4. Confirm Password field
5. [Create Account] button
6. [Log In] link
7. [Close] button [X]

**Keyboard Shortcuts**:
- Enter → Submit form (if valid)
- Esc → Close modal
- Tab → Next field
- Shift+Tab → Previous field

---

### 6.2 Screen Reader Support

**ARIA Labels**:
```html
<input
  type="email"
  aria-label="Email address"
  aria-required="true"
  aria-invalid="false"
  aria-describedby="email-error"
/>
<span id="email-error" role="alert">
  <!-- Error message here -->
</span>
```

**Announcements**:
- Form validation errors → Screen reader announces error
- Success messages → Screen reader announces success
- Loading states → "Loading..." announcement

---

### 6.3 High Contrast Mode

**Text Contrast Ratios** (WCAG AAA):
- Body text: 7:1 minimum (14px font)
- Headings: 4.5:1 minimum (18px+ font)
- Interactive elements: 3:1 minimum

**Focus Indicators**:
- 2px solid blue outline on focus
- Visible in high contrast mode
- Keyboard focus clearly visible

---

### 6.4 Font Size Scaling

**Support**:
- 100% (default): 16px body, 24px headings
- 125%: 20px body, 30px headings (mobile accessibility setting)
- 150%: 24px body, 36px headings (low vision)

**Responsive Text**:
```css
body {
  font-size: 16px;
  font-size: clamp(14px, 1rem, 20px);
}
```

---

## 7. Error Handling & Edge Cases

### 7.1 Network Errors

**Scenario**: API request fails (timeout, 500 error)

**User Experience**:
```
┌────────────────────────────────────────────────┐
│  ❌ Connection Error                           │
├────────────────────────────────────────────────┤
│                                                │
│  We couldn't connect to the server.            │
│  Please check your internet connection and     │
│  try again.                                    │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Retry]                                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  [Close]                                       │
│                                                │
└────────────────────────────────────────────────┘
```

**Behavior**:
- Don't close modal on error (preserve form data)
- Show retry button (don't force user to re-enter)
- Log error to Cloudflare Workers (for debugging)

---

### 7.2 Rate Limiting

**Scenario**: User exceeds login attempts (5 per hour)

**User Experience**:
```
┌────────────────────────────────────────────────┐
│  ⏱️  Too Many Attempts                         │
├────────────────────────────────────────────────┤
│                                                │
│  You've exceeded the login attempt limit.      │
│  Please try again in 58 minutes.               │
│                                                │
│  Forgot your password? [Reset Password]        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Close]                                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

**Progressive Warning**:
- After 3 failures: "2 attempts remaining before lockout"
- After 4 failures: "1 attempt remaining before lockout"
- After 5 failures: Show lockout message with countdown

---

### 7.3 Email Already Exists

**Scenario**: User tries to sign up with already-registered email

**User Experience**:
```
┌────────────────────────────────────────────────┐
│  Email Already Registered                      │
├────────────────────────────────────────────────┤
│                                                │
│  This email is already associated with an      │
│  account.                                      │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [Log In Instead]                        │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Forgot your password? [Reset Password]        │
│                                                │
│  [Try Different Email]                         │
│                                                │
└────────────────────────────────────────────────┘
```

**Security Note**: Don't reveal if email exists during signup (prevents email enumeration attack). Instead, send email to existing address: "You already have an account. [Log In]"

---

### 7.4 Session Expiration Mid-Game

**Scenario**: User's access token expires while playing

**User Experience**:
- Don't interrupt gameplay immediately
- Show unobtrusive banner at top: "Your session expired. [Log In] to save progress."
- Allow continued gameplay with Squirrel character (graceful degradation)
- Redirect to login after 5 minutes if not re-authenticated

```
┌────────────────────────────────────────────────┐
│  ⚠️ Session Expired - [Log In] to save progress│
└────────────────────────────────────────────────┘
```

---

## 8. Conversion Metrics & Success Indicators

### 8.1 Key Metrics to Track

**Conversion Funnel**:
1. **Awareness**: No-auth users who play ≥5 minutes
2. **Interest**: Users who click "Sign Up" or locked character
3. **Consideration**: Users who start signup form
4. **Conversion**: Users who complete signup
5. **Verification**: Users who verify email
6. **Retention**: Authenticated users who return within 7 days

**Target Conversion Rates**:
- Awareness → Interest: 30% (30% click "Sign Up")
- Interest → Consideration: 80% (80% start form)
- Consideration → Conversion: 60% (60% complete form)
- Conversion → Verification: 70% (70% verify email)
- Overall: 30% × 80% × 60% × 70% = **10% no-auth → verified auth**

### 8.2 A/B Testing Opportunities

**Messaging Tests**:
- "Sign Up" vs "Unlock 6 Characters" vs "Play More"
- "Free" vs "No Cost" vs "Always Free"
- "6 characters" vs "6 animals" vs "More characters"

**CTA Placement**:
- Character selection bottom vs top
- Toast frequency: 10 min vs 15 min vs 20 min
- Settings menu vs character selection for primary CTA

**Form Design**:
- 4 fields (username, email, password, confirm) vs 3 fields (combine username=email)
- Show password requirements upfront vs on error
- Single-column vs two-column layout (iPad landscape)

---

## 9. Implementation Checklist

### 9.1 Frontend Components to Create

- [ ] `AuthModal.tsx` - Login/signup modal container
- [ ] `SignupForm.tsx` - Signup form with validation
- [ ] `LoginForm.tsx` - Login form with validation
- [ ] `ForgotPasswordForm.tsx` - Password reset form
- [ ] `EmailVerificationOverlay.tsx` - "Check your email" overlay
- [ ] `WelcomeOverlay.tsx` - Post-verification welcome
- [ ] `CharacterSelectionEnhanced.tsx` - Character selection with locks
- [ ] `SettingsAccountTab.tsx` - Account settings in settings menu
- [ ] `LeaderboardEnhanced.tsx` - Leaderboard with verified badges
- [ ] `ToastNotification.tsx` - Enticement toast messages

### 9.2 CSS/Styling

- [ ] Modal overlay styles (desktop, iPad, iPhone)
- [ ] Form input styles (focus, error, success states)
- [ ] Button styles (primary, secondary, disabled)
- [ ] Character card styles (available, locked, premium)
- [ ] Toast notification styles (positioning, animation)
- [ ] Responsive breakpoints (768px, 1024px, 1440px)
- [ ] Safe area padding (iPhone X+)
- [ ] Accessibility styles (focus indicators, high contrast)

### 9.3 Client-Side Validation

- [ ] Email format validation (RFC 5322 regex)
- [ ] Password strength validation (8+ chars, uppercase, lowercase, number)
- [ ] Username validation (3-20 chars, alphanumeric + underscore)
- [ ] Confirm password match validation
- [ ] Real-time validation (onChange events)
- [ ] Form submission validation (onSubmit)

### 9.4 API Integration

- [ ] `/auth/signup` - Create account
- [ ] `/auth/login` - Email/password login
- [ ] `/auth/verify-email` - Verify email token
- [ ] `/auth/forgot-password` - Request password reset
- [ ] `/auth/reset-password` - Reset password with token
- [ ] `/auth/refresh` - Refresh access token
- [ ] `/auth/logout` - Invalidate tokens
- [ ] `/characters/available` - Get available characters for user

---

## 10. Next Steps

### Phase 1: Documentation Complete ✅
- Authentication_Tech_Approach.md ✅
- Authentication_UX_Design.md ✅ (This document)
- MVP_16_Progress.md (Next)

### Phase 2: Begin Implementation
1. Create frontend components (AuthModal, SignupForm, LoginForm)
2. Integrate with backend APIs (signup, login, verify)
3. Update character selection screen (show locks)
4. Add enticement elements (toasts, settings banner)
5. Test cross-platform (desktop, iPad, iPhone)

---

**Document Status**: ✅ READY FOR IMPLEMENTATION
**Next Document**: MVP_16_Progress.md (Implementation tracking)
**Last Updated**: 2025-11-04
