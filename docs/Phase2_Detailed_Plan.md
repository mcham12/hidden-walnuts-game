## Phase 2: UX Implementation - Detailed Plan

### Phase 2 Overview

Phase 2 implements the client-side authentication user experience for Hidden Walnuts MVP 16. This includes building responsive modals, forms, overlays, and integration with the Phase 1 backend APIs. The UX follows the design in Authentication_UX_Design.md and integrates seamlessly with the existing game UI patterns.

**Duration**: 2.5-3.5 weeks (18-25 days)
**Priority**: CRITICAL PATH - Required for MVP 16 launch
**Dependencies**: Phase 1 (Backend) ✅ COMPLETE

**Platform Support**:
- Desktop (1025px+)
- iPad Portrait (768-1024px, portrait orientation)
- iPad Landscape (768-1024px, landscape orientation)
- iPhone Portrait (≤430px)
- iPhone Landscape (≤932px width, ≤500px height)

---

## Part 2A: Authentication Modal System & Forms

**Duration**: 4-5 days
**Priority**: 🔴 CRITICAL PATH
**Description**: Build the core authentication modal system with signup, login, and password reset forms. Includes responsive design, validation, and API integration.

### Platform Considerations
- **Desktop**: 600px centered modal with hover states
- **iPad**: 700px modal (portrait), 800px (landscape), larger touch targets
- **iPhone Portrait**: Full-screen forms with bottom-aligned buttons
- **iPhone Landscape**: Compact 400px modal, scrollable

### Tasks

**Task 2A.1: Create Base AuthModal Component** (6 hours)
- File: `/client/src/components/AuthModal.tsx`
- Modal overlay with semi-transparent backdrop
- Responsive sizing: Desktop (600px), iPad (700-800px), iPhone (full-screen/400px)
- Screen routing: 'signup' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email'
- Close handlers: ESC key, backdrop click, [X] button
- Fade animations (0.3s)
- Z-index 10000, prevent body scroll
- Keyboard navigation (Tab, Shift+Tab, Enter)

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

**Task 2A.3: Create LoginForm Component** (6 hours)
- File: `/client/src/components/LoginForm.tsx`
- Fields: email, password (with show/hide toggle)
- "Forgot Password?" link
- "Don't have an account? [Sign Up]" link
- API: POST `/auth/login`
- Store tokens in localStorage: `auth_access_token`, `auth_refresh_token`, `auth_user`
- Success: Redirect to character selection + welcome toast
- Error handling: invalid credentials, rate limiting (3/5 attempts), network errors

**Task 2A.4: Create ForgotPasswordForm Component** (4 hours)
- File: `/client/src/components/ForgotPasswordForm.tsx`
- Field: email
- API: POST `/auth/forgot-password`
- Success: "Check Your Email!" overlay
- Rate limiting: 3 requests per hour per email
- Security: Don't reveal if email exists

**Task 2A.5: Create ResetPasswordForm Component** (4 hours)
- File: `/client/src/components/ResetPasswordForm.tsx`
- Trigger: Route `/reset-password?token=abc123`
- Fields: new password, confirm password
- Password strength meter and requirements
- API: POST `/auth/reset-password`
- Success: "Password Updated!" → Redirect to login after 2 seconds
- Error: "Reset link expired or invalid. [Request New Link]"

**Task 2A.6: Client-Side Validation Utilities** (3 hours)
- File: `/client/src/utils/validation.ts`
- `validateEmail()` - RFC 5322 regex
- `validatePassword()` - Returns strength + errors
- `validateUsername()` - 3-20 chars, alphanumeric + underscore
- `passwordsMatch()` - Confirm field validation
- Password requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number

**Task 2A.7: Add Modal Styles** (4 hours)
- File: `/client/src/components/AuthModal.css`
- Backdrop: `rgba(0, 0, 0, 0.7)` with blur
- Modal: White, rounded corners (16px), box-shadow
- Form fields: 50px height, 16px font, clear focus states
- Buttons: 60px height, hover/active states
- Validation indicators: Green ✅, Red ❌, Yellow ⚠️
- Responsive breakpoints for all platforms

**Task 2A.8: API Service Layer** (4 hours)
- File: `/client/src/services/AuthService.ts`
- Methods: `signup()`, `login()`, `forgotPassword()`, `resetPassword()`, `verifyEmail()`, `resendVerification()`, `refreshToken()`, `logout()`, `getCurrentUser()`, `isAuthenticated()`, `clearAuth()`
- Error handling: try-catch, parse backend errors, user-friendly messages
- Token management utilities

### Dependencies
- None (can start immediately after Phase 1)

### Success Criteria
- [ ] AuthModal opens/closes correctly on all platforms
- [ ] SignupForm validates all fields client-side
- [ ] LoginForm authenticates and stores tokens
- [ ] ForgotPasswordForm sends reset email
- [ ] ResetPasswordForm updates password
- [ ] All forms responsive on desktop, iPad, iPhone (portrait & landscape)
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] Error messages display correctly
- [ ] Loading states show during API calls

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

### Platform Considerations
- All platforms: Centered overlay, responsive text sizing
- iPhone: Larger fonts, more padding

### Tasks

**Task 2B.1: Create EmailVerificationOverlay Component** (4 hours)
- File: `/client/src/components/EmailVerificationOverlay.tsx`
- Display: "✉️ Check Your Email!" with user's email
- Message: "Click the link to verify your account and unlock 6 characters!"
- [Resend Email] button with rate limiting (3 per hour) and countdown timer
- [Play as Guest] button to continue without verification
- API: POST `/auth/resend-verification`

**Task 2B.2: Create WelcomeOverlay Component** (4 hours)
- File: `/client/src/components/WelcomeOverlay.tsx`
- Trigger: After email verification success
- Display: "🎉 Welcome to Hidden Walnuts, [Username]!"
- List benefits: 6 characters, sync, hall of fame, progress tracking
- [Start Playing →] button → character selection
- One-time display: Store `welcome_shown` in localStorage

**Task 2B.3: Email Verification Page Route** (3 hours)
- File: `/client/src/pages/VerifyEmail.tsx`
- Route: `/verify-email?token=abc123`
- Extract token, call API: POST `/auth/verify-email`
- Success: Show WelcomeOverlay, redirect after 5 seconds
- Error: "Verification link expired" + [Request New Link] button

**Task 2B.4: Unverified Email Reminder System** (3 hours)
- Trigger: Every 3rd login if email not verified
- Toast: "Verify your email to secure your account" + [Resend Email] link
- Duration: 8 seconds
- Track `login_count_since_reminder` in localStorage

**Task 2B.5: Resend Verification Email Handler** (2 hours)
- API: POST `/auth/resend-verification`
- Rate limiting: 3 per hour
- Countdown timer: Disable button for 60 seconds
- Success toast: "Email sent!"
- Error toast: "Too many requests. Try again later."

### Dependencies
- **Part 2A**: AuthModal and SignupForm must be complete

### Success Criteria
- [ ] EmailVerificationOverlay shows after signup
- [ ] Resend email button works with rate limiting
- [ ] WelcomeOverlay shows after email verification
- [ ] Email verification page route works
- [ ] Unverified email reminder shows every 3rd login
- [ ] One-time welcome flag prevents duplicate displays

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

### Platform Considerations
- **Desktop**: 4x3 grid (11 characters + 1 empty)
- **iPad Portrait**: 3x4 grid
- **iPad Landscape**: 4x3 grid
- **iPhone Portrait**: 2x6 grid, vertical scroll
- **iPhone Landscape**: Horizontal scroll, 2x6 grid

### Tasks

**Task 2C.1: Update Character Selection UI** (6 hours)
- Replace dropdown with visual grid of character cards
- Card design: Emoji/3D preview, name, status icon (✅/🔒/💎)
- Visual states:
  - **Available**: Full color, ✅ checkmark, clickable, hover scale 1.05
  - **Locked Free**: 80% opacity, 🔒 icon, tooltip "Sign Up to Unlock"
  - **Locked Premium**: Full color, gold border, 💎 icon + "$1.99"
- Grid layout with CSS Grid: 4 cols (desktop), 3 (iPad portrait), 2 (iPhone)

**Task 2C.2: Add Authentication Status Check** (3 hours)
- Fetch user: `AuthService.getCurrentUser()`
- Get available characters: `CharacterRegistry.getAvailableCharacters()`
- Get locked characters: `CharacterRegistry.getLockedCharacters()`
- Render grid based on availability

**Task 2C.3: Add Bottom CTA Banner** (2 hours)
- No-auth: "🔐 Sign Up Free to Unlock 6 Characters! [Sign Up] [Log In]"
- Authenticated: "Premium characters coming in MVP 17! Stay tuned 🐻"
- Styling: Gold background (`rgba(255, 215, 0, 0.1)`), border, buttons

**Task 2C.4: Add Character Preview on Hover/Tap** (4 hours)
- Show 3D preview in modal overlay when locked character clicked
- Display character description
- [Sign Up to Unlock] button for locked free characters
- [Coming Soon!] button for premium characters

**Task 2C.5: Persist Last Selected Character** (2 hours)
- Store in localStorage: `last_character_id`
- Pre-select on load if available
- Sync with backend: Store in `user.lastCharacterId`

### Dependencies
- **Part 2A**: AuthModal for signup modal
- **Phase 1C**: CharacterRegistry enhancements

### Success Criteria
- [ ] Character selection shows visual grid
- [ ] Available characters displayed with ✅
- [ ] Locked free characters displayed with 🔒
- [ ] Premium characters displayed with 💎
- [ ] Clicking locked character opens signup modal
- [ ] Bottom CTA shows correct message
- [ ] Character preview works
- [ ] Last character persisted
- [ ] Responsive on all platforms

### Files to Create
- `/client/src/components/CharacterCard.tsx`
- `/client/src/components/CharacterGrid.tsx`

### Files to Modify
- `/client/src/main.ts` - Replace dropdown with grid
- `/client/index.html` - Update character selection HTML
- `/client/src/services/CharacterRegistry.ts` - Use existing methods

---

## Part 2D: Settings Menu Account Tab

**Duration**: 2 days
**Priority**: 🟡 MEDIUM
**Description**: Add "Account" tab to settings menu showing auth status, account info, and upgrade CTA for guest users.

### Platform Considerations
- All platforms: Reuse existing settings panel design

### Tasks

**Task 2D.1: Add Account Tab to SettingsManager** (4 hours)
- Add 4th tab: "👤 Account"
- Tab order: Sound | Graphics | Tips | Account

**Task 2D.2: Create No-Auth Account View** (3 hours)
- Display: "Guest Account", username (Player_xxxxx)
- List benefits: 6 characters, sync, hall of fame, progress, verified badge
- [🔐 Sign Up Free] button → Open signup modal
- "Already have account? [Log In]" link → Open login modal

**Task 2D.3: Create Authenticated Account View** (4 hours)
- Display: Username, email with verification status (✅/⚠️), password (•••)
- Account created date, last login time
- Characters unlocked: 6 / 11, Premium: 0 / 4
- [Log Out] button (active)
- [Change] buttons (disabled, "Coming soon!" tooltip)
- [Delete Account] link (disabled, "Contact support" tooltip)

**Task 2D.4: Implement Logout Functionality** (2 hours)
- `AuthService.logout()` - Call backend, clear localStorage, reload page
- Button handler in Settings

### Dependencies
- **Part 2A**: AuthModal must be complete

### Success Criteria
- [ ] Account tab visible in settings
- [ ] Guest users see upgrade CTA
- [ ] Authenticated users see account info
- [ ] Sign Up / Log In buttons open AuthModal
- [ ] Log Out button works
- [ ] Email verification status shown
- [ ] Responsive on all platforms

### Files to Modify
- `/client/src/SettingsManager.ts` - Add Account tab
- `/client/index.html` - Add Account tab HTML
- `/client/src/services/AuthService.ts` - Add logout method

---

## Part 2E: Leaderboard Verified Badge Integration

**Duration**: 1-2 days
**Priority**: 🟡 MEDIUM
**Description**: Update leaderboard UI to show verified badge (🔒) for authenticated players and implement top 10 restriction display.

### Platform Considerations
- All platforms: Existing leaderboard design, add badge inline

### Tasks

**Task 2E.1: Add Verified Badge to Leaderboard Entries** (3 hours)
- Update rendering: Add 🔒 badge before username if `isAuthenticated`
- Format: `${entry.isAuthenticated ? '🔒 ' : ''}${entry.username}`

**Task 2E.2: Update Leaderboard API Call** (2 hours)
- Fetch from `/leaderboard/top?type=weekly`
- Response includes: `isAuthenticated`, `emailVerified`, `characterId`

**Task 2E.3: Add "Top 10 - Verified Players Only" Label** (2 hours)
- Weekly leaderboard header: "🏆 Weekly Leaderboard"
- Subtitle: "Top 10 - Verified Players Only" (11px, gold color)
- Show only for weekly, hide for daily/Hall of Fame

**Task 2E.4: Show Player Rank Below Top 10** (2 hours)
- If no-auth player ranked below top 10, show separator + player's row
- Highlight with `current-player` class
- Add CTA: "💡 Sign up to compete for top 10!"

### Dependencies
- **Phase 1E**: Leaderboard backend returns auth fields

### Success Criteria
- [ ] Verified badge (🔒) shows for authenticated players
- [ ] Weekly leaderboard shows "Top 10" label
- [ ] Player rank shown below top 10 if applicable
- [ ] Sign-up CTA shows for no-auth players
- [ ] Daily leaderboard shows all players
- [ ] Hall of Fame shows only authenticated

### Files to Modify
- `/client/src/main.ts` - Update leaderboard rendering
- `/client/index.html` - Add weekly label

---

## Part 2F: Enticement System (Toasts & Reminders)

**Duration**: 2 days
**Priority**: 🟡 MEDIUM
**Description**: Implement toast notifications and reminders to encourage no-auth users to sign up.

### Platform Considerations
- **Desktop**: Top-right, below minimap
- **iPad**: Top-center
- **iPhone Portrait**: Bottom, above safe area
- **iPhone Landscape**: Top-right, compact

### Tasks

**Task 2F.1: Create Enticement Toast Messages** (3 hours)
- 4 messages rotating every 15 minutes:
  1. "Sign up to unlock 6 free characters!"
  2. "Your progress isn't saved. Sign up to sync!"
  3. "Join the Hall of Fame - sign up free!"
  4. "Get verified badge - sign up now!"
- Custom toast with [Sign Up] and [✕] buttons
- Auto-dismiss after 8 seconds

**Task 2F.2: Add Enticement on Character Selection** (2 hours)
- Trigger: User clicks locked character
- Toast: "Sign up free to unlock this character!" + [Sign Up] button

**Task 2F.3: Add Enticement on Leaderboard View** (2 hours)
- Trigger: No-auth user opens weekly leaderboard, ranked below top 10
- Toast: "Sign up to compete for top 10!" + [Sign Up] button
- Frequency: Once per session

**Task 2F.4: Implement Toast Frequency Limiting** (2 hours)
- Limits: Max 4 per hour, min 15 minutes between toasts
- Track in localStorage: `last_enticement_toast_time`, `enticement_toast_times[]`

### Dependencies
- **Part 2A**: AuthModal must be complete

### Success Criteria
- [ ] Enticement toasts show every 15 min for no-auth
- [ ] Message rotation works
- [ ] Frequency limited (max 4/hour)
- [ ] Character click shows enticement
- [ ] Leaderboard view shows enticement
- [ ] [Sign Up] button opens AuthModal
- [ ] Toasts stop after signup

### Files to Modify
- `/client/src/main.ts` - Add enticement logic
- `/client/src/ToastManager.ts` - Add custom toast (optional)

---

## Part 2G: Session Persistence & Token Refresh

**Duration**: 2 days
**Priority**: 🟡 HIGH
**Description**: Implement token refresh logic to maintain authentication across sessions and handle token expiration.

### Tasks

**Task 2G.1: Implement Token Refresh Logic** (4 hours)
- `AuthService.refreshAccessToken()` - POST `/auth/refresh`
- Auto-refresh every 25 days (5 days before 30-day expiration)
- `startTokenRefreshTimer()` - setInterval for automatic refresh

**Task 2G.2: Handle Token Expiration Mid-Game** (3 hours)
- On API 401 error: Show "Session Expired" banner
- Banner: "⚠️ Session Expired - [Log In] to save progress"
- [✕] button to dismiss

**Task 2G.3: Restore Session on Page Load** (2 hours)
- `restoreSession()` - Check localStorage for valid tokens
- Verify token validity, refresh if needed
- Clear auth if invalid

**Task 2G.4: Add "Remember Me" Functionality (Optional)** (2 hours)
- Checkbox in login form
- If unchecked: Use `sessionStorage` instead of `localStorage`
- Default: Checked (persist across browser close)

### Dependencies
- **Phase 1D**: Token refresh endpoint implemented

### Success Criteria
- [ ] Tokens auto-refreshed every 25 days
- [ ] Session restored on page load
- [ ] Session expired banner shows on token expiry
- [ ] User prompted to log in after expiration
- [ ] Seamless cross-device experience

### Files to Modify
- `/client/src/services/AuthService.ts` - Add refresh logic
- `/client/src/main.ts` - Session restoration, timer

---

## Part 2H: Integration & Polish

**Duration**: 2-3 days
**Priority**: 🟡 HIGH
**Description**: Final integration, cross-platform testing, and polish.

### Tasks

**Task 2H.1: Add Loading States to All Forms** (3 hours)
- Disable inputs during submission
- Show spinner: "Creating Account...", "Logging In...", "Sending Email..."
- Prevent double-submission

**Task 2H.2: Add Error Toast for Network Issues** (2 hours)
- Catch network failures: `Failed to fetch`
- User-friendly message: "Connection issue. Check internet and try again."

**Task 2H.3: Cross-Platform Testing** (8 hours)
- Test on: Desktop Chrome/Safari, iPad Safari (portrait/landscape), iPhone Safari (portrait/landscape), Private Browsing
- All flows: Signup, login, logout, password reset

**Task 2H.4: Accessibility Improvements** (3 hours)
- ARIA labels on form fields
- Correct Tab order
- Focus indicators (2px blue outline)
- Test with VoiceOver/TalkBack

**Task 2H.5: Performance Optimization** (2 hours)
- Lazy load AuthModal
- Debounce email availability check (500ms)
- Virtual scrolling for character grid (future-proofing)

### Dependencies
- All previous parts complete

### Success Criteria
- [ ] All forms show loading states
- [ ] Network errors handled gracefully
- [ ] Cross-platform testing complete
- [ ] Keyboard navigation works
- [ ] No performance issues

---

## Phase 2 Summary

### Timeline
- **Part 2A**: 4-5 days (Auth Modal & Forms)
- **Part 2B**: 2-3 days (Email Verification & Welcome)
- **Part 2C**: 3-4 days (Character Selection)
- **Part 2D**: 2 days (Settings Account Tab)
- **Part 2E**: 1-2 days (Leaderboard Verified Badge)
- **Part 2F**: 2 days (Enticement System)
- **Part 2G**: 2 days (Session Persistence)
- **Part 2H**: 2-3 days (Integration & Polish)

**Total**: 18-25 days (2.5-3.5 weeks)

### Overall Success Criteria
- [ ] Signup flow: Username → Email → Password → Verification → Welcome
- [ ] Login flow: Email → Password → Character Selection
- [ ] Password reset flow: Request → Email → Reset → Login
- [ ] Character selection shows locked/unlocked correctly
- [ ] Settings Account tab shows guest vs auth views
- [ ] Leaderboard shows verified badges
- [ ] Enticement toasts encourage signup
- [ ] Session persists across page reloads
- [ ] All flows work on desktop, iPad, iPhone (portrait & landscape)
- [ ] Keyboard navigation works
- [ ] Loading states and error messages display correctly

### Risk Mitigation
1. **Responsive Design**: Test early on real devices
2. **Token Management**: Thorough refresh logic testing
3. **Form Validation**: Use proven regex, test edge cases
4. **Cross-Browser**: Test Safari (iOS), Chrome, Firefox
5. **Performance**: Lazy load, optimize animations

### Next Phase
Phase 3: Integration & Testing (end-to-end testing)
