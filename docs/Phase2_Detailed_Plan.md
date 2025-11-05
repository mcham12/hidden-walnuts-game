## Phase 2: UX Implementation - Detailed Plan

### Phase 2 Overview

Phase 2 implements the client-side authentication user experience for Hidden Walnuts MVP 16. This includes building responsive modals, forms, overlays, and integration with the Phase 1 backend APIs. The UX follows the design in Authentication_UX_Design.md and integrates seamlessly with the existing game UI patterns.

**Duration**: 2.5-3.5 weeks (18-25 days)
**Priority**: CRITICAL PATH - Required for MVP 16 launch
**Dependencies**: Phase 1 (Backend) ✅ COMPLETE

**Required Responsive Breakpoints**:
- Desktop (1025px+)
- iPad Portrait (768-1024px portrait)
- iPad Landscape (768-1024px landscape)
- iPhone Portrait (≤430px)
- iPhone Landscape (≤932px width, ≤500px height)
- Tablets (431-767px)

---

## Part 2A: Authentication Modal System & Forms

**Duration**: 4-5 days
**Priority**: 🔴 CRITICAL PATH
**Description**: Build the core authentication modal system with signup, login, and password reset forms. Includes responsive design, validation, and API integration.

### Tasks

**Task 2A.1: Create Base AuthModal Component** (6 hours)
- File: `/client/src/components/AuthModal.tsx`
- Modal overlay with semi-transparent backdrop
- Screen routing: 'signup' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email'
- Close handlers: ESC key, backdrop click, [X] button
- Fade animations (0.3s)
- Z-index 10000, prevent body scroll
- Keyboard navigation (Tab, Shift+Tab, Enter)

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 600px width modal, centered, hover states on buttons
- **iPad Portrait (768-1024px portrait)**: 700px width modal, centered, larger touch targets (50px min)
- **iPad Landscape (768-1024px landscape)**: 800px width modal, centered, maintain touch targets
- **iPhone Portrait (≤430px)**: Full-screen modal (95vw width), bottom-aligned buttons (60px height)
- **iPhone Landscape (≤932px width, ≤500px height)**: 400px compact modal, scrollable content, fixed header
- **Tablets (431-767px)**: 650px width modal, centered, 48px touch targets

**Task 2A.2: Create SignupForm Component** (8 hours)
- File: `/client/src/components/SignupForm.tsx`
- Fields: username, email, password, confirm password
- Real-time validation with ✅/❌ indicators
- Password strength meter (weak/medium/strong)
- Password show/hide toggle (👁️ icon)
- Benefits display above form (6 characters, sync, hall of fame)
- API: POST `/auth/signup`
- Error handling: email exists, username taken, weak password
- Button states: disabled/enabled/loading

**Responsive Breakpoints**:
- **Desktop (1025px+)**: Single column form, 50px field height, 16px font, benefits in 3-column grid
- **iPad Portrait (768-1024px portrait)**: Single column, 55px field height, 18px font, benefits in 2-column grid
- **iPad Landscape (768-1024px landscape)**: Single column, 50px field height, 16px font, benefits in 3-column grid
- **iPhone Portrait (≤430px)**: Single column, 60px field height, 18px font, benefits stacked vertically
- **iPhone Landscape (≤932px width, ≤500px height)**: Scrollable, 50px field height, 14px font, benefits collapsed/hidden
- **Tablets (431-767px)**: Single column, 55px field height, 16px font, benefits in 2-column grid

**Task 2A.3: Create LoginForm Component** (6 hours)
- File: `/client/src/components/LoginForm.tsx`
- Fields: email, password (with show/hide toggle)
- "Forgot Password?" link
- "Don't have an account? [Sign Up]" link
- API: POST `/auth/login`
- Store tokens in localStorage: `auth_access_token`, `auth_refresh_token`, `auth_user`
- Success: Redirect to character selection + welcome toast
- Error handling: invalid credentials, rate limiting (3/5 attempts), network errors

**Responsive Breakpoints**:
- **Desktop (1025px+)**: Single column, 50px field height, 16px font, links inline
- **iPad Portrait (768-1024px portrait)**: Single column, 55px field height, 18px font, links inline
- **iPad Landscape (768-1024px landscape)**: Single column, 50px field height, 16px font, links inline
- **iPhone Portrait (≤430px)**: Single column, 60px field height, 18px font, links stacked
- **iPhone Landscape (≤932px width, ≤500px height)**: Scrollable, 50px field height, 14px font, links inline
- **Tablets (431-767px)**: Single column, 55px field height, 16px font, links inline

**Task 2A.4: Create ForgotPasswordForm Component** (4 hours)
- File: `/client/src/components/ForgotPasswordForm.tsx`
- Field: email
- API: POST `/auth/forgot-password`
- Success: "Check Your Email!" overlay
- Rate limiting: 3 requests per hour per email
- Security: Don't reveal if email exists

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 500px width, single field, 50px height
- **iPad Portrait (768-1024px portrait)**: 600px width, 55px field height
- **iPad Landscape (768-1024px landscape)**: 700px width, 50px field height
- **iPhone Portrait (≤430px)**: Full width (90vw), 60px field height
- **iPhone Landscape (≤932px width, ≤500px height)**: 400px width, scrollable, 50px field height
- **Tablets (431-767px)**: 550px width, 55px field height

**Task 2A.5: Create ResetPasswordForm Component** (4 hours)
- File: `/client/src/components/ResetPasswordForm.tsx`
- Trigger: Route `/reset-password?token=abc123`
- Fields: new password, confirm password
- Password strength meter and requirements
- API: POST `/auth/reset-password`
- Success: "Password Updated!" → Redirect to login after 2 seconds
- Error: "Reset link expired or invalid. [Request New Link]"

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 550px width, 50px field height, password requirements in 2 columns
- **iPad Portrait (768-1024px portrait)**: 650px width, 55px field height, password requirements in 2 columns
- **iPad Landscape (768-1024px landscape)**: 750px width, 50px field height, password requirements in 2 columns
- **iPhone Portrait (≤430px)**: Full width (90vw), 60px field height, password requirements stacked
- **iPhone Landscape (≤932px width, ≤500px height)**: 400px width, scrollable, 50px field height, requirements collapsed
- **Tablets (431-767px)**: 600px width, 55px field height, password requirements in 2 columns

**Task 2A.6: Client-Side Validation Utilities** (3 hours)
- File: `/client/src/utils/validation.ts`
- `validateEmail()` - RFC 5322 regex
- `validatePassword()` - Returns strength + errors
- `validateUsername()` - 3-20 chars, alphanumeric + underscore
- `passwordsMatch()` - Confirm field validation
- Password requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number
- No responsive considerations (pure logic)

**Task 2A.7: Add Modal Styles** (4 hours)
- File: `/client/src/components/AuthModal.css`
- Backdrop: `rgba(0, 0, 0, 0.7)` with blur
- Modal: White, rounded corners (16px), box-shadow
- Form fields: 50px height, 16px font, clear focus states
- Buttons: 60px height, hover/active states
- Validation indicators: Green ✅, Red ❌, Yellow ⚠️

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 16px border radius, 24px padding, 2px focus outline
- **iPad Portrait (768-1024px portrait)**: 16px border radius, 28px padding, 3px focus outline
- **iPad Landscape (768-1024px landscape)**: 16px border radius, 24px padding, 3px focus outline
- **iPhone Portrait (≤430px)**: 12px border radius, 20px padding, 4px focus outline, safe area insets
- **iPhone Landscape (≤932px width, ≤500px height)**: 12px border radius, 16px padding, 3px focus outline, compact spacing
- **Tablets (431-767px)**: 14px border radius, 24px padding, 3px focus outline

**Task 2A.8: API Service Layer** (4 hours)
- File: `/client/src/services/AuthService.ts`
- Methods: `signup()`, `login()`, `forgotPassword()`, `resetPassword()`, `verifyEmail()`, `resendVerification()`, `refreshToken()`, `logout()`, `getCurrentUser()`, `isAuthenticated()`, `clearAuth()`
- Error handling: try-catch, parse backend errors, user-friendly messages
- Token management utilities
- No responsive considerations (pure logic)

### Dependencies
- None (can start immediately after Phase 1)

### Success Criteria
- [ ] AuthModal opens/closes correctly on all platforms
- [ ] SignupForm validates all fields client-side
- [ ] LoginForm authenticates and stores tokens
- [ ] ForgotPasswordForm sends reset email
- [ ] ResetPasswordForm updates password
- [ ] All forms responsive on Desktop, iPad Portrait, iPad Landscape, iPhone Portrait, iPhone Landscape, and Tablets
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] Error messages display correctly
- [ ] Loading states show during API calls
- [ ] Touch targets meet minimum size (44px iOS, 48px Android)

### Files to Create
- `/client/src/components/AuthModal.tsx`
- `/client/src/components/SignupForm.tsx`
- `/client/src/components/LoginForm.tsx`
- `/client/src/components/ForgotPasswordForm.tsx`
- `/client/src/components/ResetPasswordForm.tsx`
- `/client/src/utils/validation.ts`
- `/client/src/services/AuthService.ts`
- `/client/src/components/AuthModal.css` (optional)

### Files to Modify
- `/client/index.html` - Add `<div id="auth-modal-root"></div>`
- `/client/src/main.ts` - Import AuthModal, add `/reset-password` route

---

## Part 2B: Email Verification & Welcome Overlays

**Duration**: 2-3 days
**Priority**: 🟡 HIGH
**Description**: Build overlays for email verification pending, email verified welcome, and resend email functionality.

### Tasks

**Task 2B.1: Create EmailVerificationOverlay Component** (4 hours)
- File: `/client/src/components/EmailVerificationOverlay.tsx`
- Display: "✉️ Check Your Email!" with user's email
- Message: "Click the link to verify your account and unlock 6 characters!"
- [Resend Email] button with rate limiting (3 per hour) and countdown timer
- [Play as Guest] button to continue without verification
- API: POST `/auth/resend-verification`

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 600px centered overlay, 24px heading, 16px body text
- **iPad Portrait (768-1024px portrait)**: 700px centered, 28px heading, 18px body text
- **iPad Landscape (768-1024px landscape)**: 800px centered, 24px heading, 16px body text
- **iPhone Portrait (≤430px)**: Full-screen (95vw), 32px heading, 18px body text, bottom-aligned buttons
- **iPhone Landscape (≤932px width, ≤500px height)**: 450px compact, 20px heading, 14px body text, scrollable
- **Tablets (431-767px)**: 650px centered, 26px heading, 17px body text

**Task 2B.2: Create WelcomeOverlay Component** (4 hours)
- File: `/client/src/components/WelcomeOverlay.tsx`
- Trigger: After email verification success
- Display: "🎉 Welcome to Hidden Walnuts, [Username]!"
- List benefits: 6 characters, sync, hall of fame, progress tracking
- [Start Playing →] button → character selection
- One-time display: Store `welcome_shown` in localStorage

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 700px centered overlay, benefits in 2x2 grid, 28px heading
- **iPad Portrait (768-1024px portrait)**: 750px centered, benefits in 2x2 grid, 32px heading
- **iPad Landscape (768-1024px landscape)**: 850px centered, benefits in 4-column row, 28px heading
- **iPhone Portrait (≤430px)**: Full-screen (95vw), benefits stacked vertically, 36px heading
- **iPhone Landscape (≤932px width, ≤500px height)**: 500px compact, benefits in 2-column, 24px heading, scrollable
- **Tablets (431-767px)**: 700px centered, benefits in 2x2 grid, 30px heading

**Task 2B.3: Email Verification Page Route** (3 hours)
- File: `/client/src/pages/VerifyEmail.tsx`
- Route: `/verify-email?token=abc123`
- Extract token, call API: POST `/auth/verify-email`
- Success: Show WelcomeOverlay, redirect after 5 seconds
- Error: "Verification link expired" + [Request New Link] button

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 600px centered card, spinner 64px
- **iPad Portrait (768-1024px portrait)**: 700px centered, spinner 72px
- **iPad Landscape (768-1024px landscape)**: 800px centered, spinner 64px
- **iPhone Portrait (≤430px)**: Full-screen card (95vw), spinner 80px
- **iPhone Landscape (≤932px width, ≤500px height)**: 450px compact card, spinner 56px
- **Tablets (431-767px)**: 650px centered, spinner 68px

**Task 2B.4: Unverified Email Reminder System** (3 hours)
- Trigger: Every 3rd login if email not verified
- Toast: "Verify your email to secure your account" + [Resend Email] link
- Duration: 8 seconds
- Track `login_count_since_reminder` in localStorage

**Responsive Breakpoints**:
- **Desktop (1025px+)**: Top-right toast, 400px width, below minimap
- **iPad Portrait (768-1024px portrait)**: Top-center toast, 500px width
- **iPad Landscape (768-1024px landscape)**: Top-right toast, 450px width
- **iPhone Portrait (≤430px)**: Bottom toast (90vw width), above safe area (env(safe-area-inset-bottom))
- **iPhone Landscape (≤932px width, ≤500px height)**: Top-right compact toast, 350px width
- **Tablets (431-767px)**: Top-center toast, 450px width

**Task 2B.5: Resend Verification Email Handler** (2 hours)
- API: POST `/auth/resend-verification`
- Rate limiting: 3 per hour
- Countdown timer: Disable button for 60 seconds
- Success toast: "Email sent!"
- Error toast: "Too many requests. Try again later."
- No additional responsive considerations (uses toast system from 2B.4)

### Dependencies
- **Part 2A**: AuthModal and SignupForm must be complete

### Success Criteria
- [ ] EmailVerificationOverlay shows after signup on all platforms
- [ ] Resend email button works with rate limiting
- [ ] WelcomeOverlay shows after email verification on all platforms
- [ ] Email verification page route works on all platforms
- [ ] Unverified email reminder shows every 3rd login
- [ ] One-time welcome flag prevents duplicate displays
- [ ] Responsive on Desktop, iPad Portrait/Landscape, iPhone Portrait/Landscape, Tablets
- [ ] Safe area insets respected on iPhone

### Files to Create
- `/client/src/components/EmailVerificationOverlay.tsx`
- `/client/src/components/WelcomeOverlay.tsx`
- `/client/src/pages/VerifyEmail.tsx`

### Files to Modify
- `/client/src/main.ts` - Add email verification route, reminder logic

---

## Part 2C: Character Selection Enhancement

**Duration**: 3-4 days
**Priority**: 🔴 CRITICAL PATH
**Description**: Redesign character selection screen to show locked/unlocked characters, tier badges, and authentication CTAs.

### Tasks

**Task 2C.1: Update Character Selection UI** (6 hours)
- Replace dropdown with visual grid of character cards
- Card design: Emoji/3D preview, name, status icon (✅/🔒/💎)
- Visual states:
  - **Available**: Full color, ✅ checkmark, clickable, hover scale 1.05
  - **Locked Free**: 80% opacity, 🔒 icon, tooltip "Sign Up to Unlock"
  - **Locked Premium**: Full color, gold border, 💎 icon + "$1.99"

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 4x3 grid layout (11 characters + 1 empty), 120px card size, 12px gap, hover scale 1.05
- **iPad Portrait (768-1024px portrait)**: 3x4 grid layout, 140px card size, 16px gap, tap scale 0.95
- **iPad Landscape (768-1024px landscape)**: 4x3 grid layout, 130px card size, 14px gap, tap scale 0.95
- **iPhone Portrait (≤430px)**: 2x6 grid layout, vertical scroll, 100px card size, 10px gap, full tap target
- **iPhone Landscape (≤932px width, ≤500px height)**: 2 rows, 6 columns, horizontal scroll, 90px card size, 8px gap, compact spacing
- **Tablets (431-767px)**: 3 columns, variable rows, 110px card size, 12px gap

**Task 2C.2: Add Authentication Status Check** (3 hours)
- Fetch user: `AuthService.getCurrentUser()`
- Get available characters: `CharacterRegistry.getAvailableCharacters()`
- Get locked characters: `CharacterRegistry.getLockedCharacters()`
- Render grid based on availability
- No responsive considerations (pure logic)

**Task 2C.3: Add Bottom CTA Banner** (2 hours)
- No-auth: "🔐 Sign Up Free to Unlock 6 Characters! [Sign Up] [Log In]"
- Authenticated: "Premium characters coming in MVP 17! Stay tuned 🐻"
- Styling: Gold background (`rgba(255, 215, 0, 0.1)`), border, buttons

**Responsive Breakpoints**:
- **Desktop (1025px+)**: Full width banner, 60px height, buttons inline, 16px font
- **iPad Portrait (768-1024px portrait)**: Full width banner, 70px height, buttons inline, 18px font
- **iPad Landscape (768-1024px landscape)**: Full width banner, 60px height, buttons inline, 16px font
- **iPhone Portrait (≤430px)**: Full width banner, 80px height, buttons stacked, 16px font, sticky bottom
- **iPhone Landscape (≤932px width, ≤500px height)**: Full width banner, 50px height, buttons inline (compact), 14px font
- **Tablets (431-767px)**: Full width banner, 65px height, buttons inline, 16px font

**Task 2C.4: Add Character Preview on Hover/Tap** (4 hours)
- Show 3D preview in modal overlay when locked character clicked
- Display character description
- [Sign Up to Unlock] button for locked free characters
- [Coming Soon!] button for premium characters

**Responsive Breakpoints**:
- **Desktop (1025px+)**: 500px centered modal, hover trigger, large preview (300px)
- **iPad Portrait (768-1024px portrait)**: 600px centered modal, tap trigger, large preview (350px)
- **iPad Landscape (768-1024px landscape)**: 700px centered modal, tap trigger, large preview (300px)
- **iPhone Portrait (≤430px)**: Full-screen modal (95vw), tap trigger, preview 250px, bottom button
- **iPhone Landscape (≤932px width, ≤500px height)**: 450px compact modal, tap trigger, preview 200px, scrollable
- **Tablets (431-767px)**: 550px centered modal, tap trigger, preview 280px

**Task 2C.5: Persist Last Selected Character** (2 hours)
- Store in localStorage: `last_character_id`
- Pre-select on load if available
- Sync with backend: Store in `user.lastCharacterId`
- No responsive considerations (pure logic)

### Dependencies
- **Part 2A**: AuthModal for signup modal
- **Phase 1C**: CharacterRegistry enhancements

### Success Criteria
- [ ] Character selection shows visual grid on all platforms
- [ ] Available characters displayed with ✅
- [ ] Locked free characters displayed with 🔒
- [ ] Premium characters displayed with 💎
- [ ] Clicking locked character opens signup modal
- [ ] Bottom CTA shows correct message
- [ ] Character preview works on all platforms
- [ ] Last character persisted
- [ ] Responsive on Desktop (4x3), iPad Portrait (3x4), iPad Landscape (4x3), iPhone Portrait (2x6 vertical), iPhone Landscape (2 rows horizontal), Tablets (3 columns)
- [ ] Smooth scrolling on mobile
- [ ] Touch targets ≥44px on iOS

### Files to Create
- `/client/src/components/CharacterCard.tsx`
- `/client/src/components/CharacterGrid.tsx`

### Files to Modify
- `/client/src/main.ts` - Replace dropdown with grid
- `/client/index.html` - Update character selection HTML
- `/client/src/services/CharacterRegistry.ts` - Use existing methods

---

## Phase 2 Summary

### Timeline
- **Part 2A**: 4-5 days (Auth Modal & Forms)
- **Part 2B**: 2-3 days (Email Verification & Welcome)
- **Part 2C**: 3-4 days (Character Selection)

**Total**: 9-12 days (1.5-2 weeks) for critical path components

### Overall Success Criteria
- [ ] Signup flow: Username → Email → Password → Verification → Welcome
- [ ] Login flow: Email → Password → Character Selection
- [ ] Password reset flow: Request → Email → Reset → Login
- [ ] Character selection shows locked/unlocked correctly
- [ ] Session persists across page reloads
- [ ] **ALL flows work on all responsive breakpoints**:
  - Desktop (1025px+)
  - iPad Portrait (768-1024px portrait)
  - iPad Landscape (768-1024px landscape)
  - iPhone Portrait (≤430px)
  - iPhone Landscape (≤932px width, ≤500px height)
  - Tablets (431-767px)
- [ ] Orientation changes handled smoothly (iPad and iPhone)
- [ ] Safe area insets respected on iPhone
- [ ] Touch targets meet minimum sizes (44px iOS, 48px Android)
- [ ] Keyboard navigation works on desktop
- [ ] Loading states and error messages display correctly on all platforms
- [ ] No layout shifts during orientation changes

### Responsive Design Validation Checklist
- [ ] All modals responsive across 6 breakpoints
- [ ] All forms adapt to orientation changes
- [ ] All grids reflow correctly (4x3 → 3x4 → 2x6, etc.)
- [ ] All touch targets ≥44px on mobile
- [ ] All text readable on smallest screens
- [ ] All buttons accessible on all platforms
- [ ] Safe areas handled on iPhone (top, bottom, notch)
- [ ] Landscape mode fully functional on all devices
- [ ] Horizontal scrolling works on iPhone Landscape

### Risk Mitigation
1. **Responsive Design**: Test early and often on real devices across all 6 breakpoints
2. **Orientation Changes**: Implement CSS transitions for smooth layout shifts
3. **Token Management**: Thorough refresh logic testing
4. **Form Validation**: Use proven regex, test edge cases
5. **Cross-Browser**: Test Safari (iOS), Chrome, Firefox on all platforms
6. **Performance**: Lazy load, optimize animations, test on older devices
7. **Safe Areas**: Test on iPhone with notch and home indicator
8. **Touch Interactions**: Test on real touch devices, not just emulators
