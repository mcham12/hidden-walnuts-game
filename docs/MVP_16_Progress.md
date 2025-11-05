# MVP 16 Implementation Progress - Full Authentication & UX Changes

**Document Version**: 1.0
**Created**: 2025-11-04
**Status**: Phase 0 Complete, Ready for Phase 1
**Branch**: mvp-simple-16
**Estimated Timeline**: 4-6 weeks
**Target Completion**: December 15-31, 2025

---

## Executive Summary

MVP 16 implements full email/password authentication while maintaining the no-auth quick-play option. This provides the foundation for monetization (MVP 17+) by enabling user accounts, character gating, and cross-device sync.

**Key Achievements (Phase 0)**:
- ✅ Technical architecture designed (NameCheap SMTP, bcrypt, JWT)
- ✅ Character allocation finalized (1 no-auth, 6 free auth, 4 premium)
- ✅ UX flows designed (signup, login, verification, enticement)
- ✅ Documentation complete (3 documents: Tech, UX, Progress)

**Current Status**: 🟢 **READY TO BEGIN PHASE 1 (Technical Implementation)**

---

## Progress Overview

### Phase 0: Research & Design ✅ **COMPLETE** (2 days)
- **Started**: 2025-11-04
- **Completed**: 2025-11-04
- **Duration**: 2 days
- **Status**: ✅ COMPLETE

### Phase 1: Technical Implementation ⏳ **NOT STARTED** (2-3 weeks)
- **Estimated Start**: 2025-11-05
- **Estimated Completion**: 2025-11-25
- **Duration**: 2-3 weeks
- **Status**: ⏳ PENDING

### Phase 2: UX Implementation ⏳ **NOT STARTED** (2-3 weeks)
- **Estimated Start**: 2025-11-20 (parallel with Phase 1)
- **Estimated Completion**: 2025-12-10
- **Duration**: 2-3 weeks
- **Status**: ⏳ PENDING

### Phase 3: Integration & Testing ⏳ **NOT STARTED** (1-2 weeks)
- **Estimated Start**: 2025-12-05
- **Estimated Completion**: 2025-12-20
- **Duration**: 1-2 weeks
- **Status**: ⏳ PENDING

### Phase 4: Monetization Hooks ⏳ **NOT STARTED** (1 day)
- **Estimated Start**: 2025-12-18
- **Estimated Completion**: 2025-12-20
- **Duration**: 1 day
- **Status**: ⏳ PENDING

---

## Phase 0: Research & Design ✅ COMPLETE

### Task 0.1: Email Sending Technical Research ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Findings**:
  - NameCheap Private Email can be used for transactional emails via SMTP
  - SMTP config: mail.privateemail.com, port 465 (SSL) or 587 (TLS)
  - Sending limit: 2GB/hour per domain (~20,000 emails/hour)
  - No additional cost (already own hiddenwalnuts.com + Private Email)
- **Decision**: Use NameCheap SMTP (no need for Resend/SendGrid)

### Task 0.2: Password Security Strategy ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Decisions**:
  - Hashing: bcrypt (cost factor 12)
  - Requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number
  - Storage: PlayerIdentity Durable Object (passwordHash field)
  - Session: JWT access tokens (30-day expiration) + refresh tokens (90-day)

### Task 0.3: Character Allocation Strategy ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Actual Characters** (from characters.json):
  - **No-Auth (1)**: Squirrel
  - **Authenticated Free (6)**: Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard
  - **Premium (4)**: Lynx, Bear, Moose, Badger
  - **Future Premium (1)**: Skunk (seasonal/event)

### Task 0.4: Leaderboard Strategy ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Decisions**:
  - **Daily**: All players, auth get "🔒 Verified" badge
  - **Weekly**: All players, but top 10 restricted to authenticated
  - **Hall of Fame**: Authenticated players ONLY

### Task 0.5: UX Design ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Deliverables**:
  - Player journey flows (no-auth, signup, login, forgot password, email verification)
  - Screen wireframes (desktop, iPad, iPhone portrait/landscape)
  - Enticement strategy (character selection, leaderboards, toasts, settings)
  - Platform-specific considerations

### Task 0.6: Documentation Creation ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-04
- **Files Created**:
  - ✅ `Authentication_Tech_Approach.md` (45 pages, comprehensive)
  - ✅ `Authentication_UX_Design.md` (35 pages, detailed wireframes)
  - ✅ `MVP_16_Progress.md` (this document)

---

## Phase 1: Technical Implementation ⏳ NOT STARTED (2-3 weeks)

### Part 1A: PlayerIdentity Durable Object Enhancement ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 3-4 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Add authentication fields to PlayerIdentityData interface
  - [ ] email?: string
  - [ ] passwordHash?: string
  - [ ] emailVerified: boolean (default: false)
  - [ ] emailVerificationToken?: string
  - [ ] emailVerificationExpiry?: number
  - [ ] passwordResetToken?: string
  - [ ] passwordResetExpiry?: number
  - [ ] isAuthenticated: boolean
  - [ ] unlockedCharacters: string[]
  - [ ] authTokens: { token, created, expiresAt, deviceInfo }[]

- [ ] Install bcrypt library
  ```bash
  cd workers
  npm install @tsndr/cloudflare-worker-bcrypt
  ```

- [ ] Implement new methods
  - [ ] `signup(email, username, password)` - Create authenticated account
  - [ ] `login(email, password)` - Email/password login
  - [ ] `verifyEmail(token)` - Email verification
  - [ ] `requestPasswordReset(email)` - Request password reset
  - [ ] `resetPassword(token, newPassword)` - Complete password reset
  - [ ] `changePassword(oldPassword, newPassword)` - Change password
  - [ ] `invalidateToken(tokenId)` - Logout single device
  - [ ] `invalidateAllTokens()` - Logout all devices

- [ ] Add email uniqueness index (KV)
  - [ ] Create EMAIL_INDEX KV namespace
  - [ ] Add binding to wrangler.toml
  - [ ] Implement email → username lookup

- [ ] Migration for existing users
  - [ ] Add default values: isAuthenticated: false, unlockedCharacters: ['squirrel']

**Success Criteria**:
- [ ] bcrypt hashing takes ~200-300ms (cost factor 12)
- [ ] Password never stored in plaintext
- [ ] Email uniqueness enforced
- [ ] Existing users migrated to no-auth status

---

### Part 1B: Email Sending Integration ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Create noreply@hiddenwalnuts.com mailbox (via NameCheap dashboard)
- [ ] Store mailbox password securely (password manager)

- [ ] Install nodemailer
  ```bash
  cd workers
  npm install nodemailer @types/nodemailer
  ```

- [ ] Store SMTP credentials as secrets
  ```bash
  wrangler secret put SMTP_USER --name hidden-walnuts-api-preview
  wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api-preview
  wrangler secret put SMTP_USER --name hidden-walnuts-api
  wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api
  ```

- [ ] Create `/workers/services/EmailService.ts`
  - [ ] SMTP transport configuration (mail.privateemail.com, port 465)
  - [ ] `sendVerificationEmail(email, username, token)`
  - [ ] `sendPasswordResetEmail(email, username, token)`
  - [ ] `sendWelcomeEmail(email, username)`
  - [ ] Error handling and logging

- [ ] Test email deliverability
  - [ ] Send test verification email to Gmail
  - [ ] Send test verification email to Outlook
  - [ ] Verify emails land in inbox (not spam)
  - [ ] Check SPF/DKIM/DMARC headers

**Success Criteria**:
- [ ] Verification emails received within 30 seconds
- [ ] Password reset emails received within 30 seconds
- [ ] Welcome emails received within 30 seconds
- [ ] Emails land in inbox (not spam) for Gmail, Outlook
- [ ] Email links clickable and functional

---

### Part 1C: Character Gating System ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2 days
- **Priority**: 🟡 MEDIUM

**Tasks**:
- [ ] Enhance CharacterRegistry.ts
  - [ ] Add `NO_AUTH_CHARACTERS = ['squirrel']`
  - [ ] Add `FREE_AUTH_CHARACTERS = ['squirrel', 'hare', 'goat', 'chipmunk', 'turkey', 'mallard']`
  - [ ] Add `PREMIUM_CHARACTERS = ['lynx', 'bear', 'moose', 'badger']`
  - [ ] Implement `isCharacterAvailable(characterId, isAuthenticated, unlockedCharacters)`
  - [ ] Implement `getAvailableCharacters(isAuthenticated, unlockedCharacters)`
  - [ ] Implement `getCharacterTier(characterId)` → 'no-auth' | 'free' | 'premium'
  - [ ] Implement `getCharacterPrice(characterId)` → number | null

- [ ] Update character selection logic in main.ts
  - [ ] Filter characters based on user authentication status
  - [ ] Show locked characters with visual indicators (🔒 or 💎)
  - [ ] Disable selection of locked characters

**Success Criteria**:
- [ ] No-auth users can only select Squirrel
- [ ] Authenticated users can select 6 free characters
- [ ] Premium characters show locked (💎) for all users
- [ ] Character tier correctly identified for all 11 characters

---

### Part 1D: Session Management & Cross-Device Sync ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Install jsonwebtoken
  ```bash
  cd workers
  npm install jsonwebtoken @types/jsonwebtoken
  ```

- [ ] Generate JWT secret
  ```bash
  openssl rand -base64 32
  wrangler secret put JWT_SECRET --name hidden-walnuts-api-preview
  wrangler secret put JWT_SECRET --name hidden-walnuts-api
  ```

- [ ] Create `/workers/services/AuthService.ts`
  - [ ] `generateAccessToken(userData)` - 30-day expiration
  - [ ] `generateRefreshToken(userData)` - 90-day expiration
  - [ ] `verifyAccessToken(token)` - Validate and decode
  - [ ] `verifyRefreshToken(token)` - Validate and decode
  - [ ] `refreshAccessToken(refreshToken, getPlayerData)` - Get new access token

- [ ] Implement token storage in PlayerIdentity DO
  - [ ] Store authTokens[] array (track multiple devices)
  - [ ] Add deviceInfo (user agent) to each token
  - [ ] Implement token revocation (remove from array)

- [ ] Add authentication middleware to API endpoints
  - [ ] Extract Bearer token from Authorization header
  - [ ] Verify token signature and expiration
  - [ ] Attach user data to request context

**Success Criteria**:
- [ ] Access token valid for 30 days
- [ ] Refresh token valid for 90 days
- [ ] Multiple devices can be logged in simultaneously
- [ ] Logout from one device doesn't affect others
- [ ] Logout from all devices clears all tokens
- [ ] Password change invalidates all existing tokens

---

### Part 1E: Leaderboard Integration ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1-2 days
- **Priority**: 🟡 MEDIUM

**Tasks**:
- [ ] Enhance LeaderboardEntry interface in Leaderboard.ts
  - [ ] Add `isAuthenticated: boolean`
  - [ ] Add `emailVerified: boolean`
  - [ ] Add `characterId: string`

- [ ] Implement leaderboard filtering logic
  - [ ] `getDailyLeaderboard()` - All players
  - [ ] `getWeeklyLeaderboard()` - All players, but filter top 10
  - [ ] `getWeeklyTop10()` - Only authenticated players in top 10
  - [ ] `getHallOfFame()` - Only authenticated players

- [ ] Update leaderboard submission
  - [ ] Include isAuthenticated flag when submitting score
  - [ ] Include emailVerified flag
  - [ ] Include characterId

**Success Criteria**:
- [ ] Daily leaderboard shows all players
- [ ] Weekly leaderboard top 10 restricted to authenticated players
- [ ] Hall of Fame only shows authenticated players
- [ ] Verified badge (🔒) correctly displayed in client

---

## Phase 2: UX Implementation ⏳ NOT STARTED (2-3 weeks)

### Part 2A: Login/Signup Modal System ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 3-4 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Create `/client/src/components/AuthModal.tsx`
  - [ ] Modal overlay component (backdrop, positioning)
  - [ ] Responsive sizing (desktop: 600px, iPad: 700px, iPhone: full-screen)
  - [ ] Close handlers (Esc key, backdrop click, [X] button)
  - [ ] Screen routing (landing → signup → login → forgot password)

- [ ] Create `/client/src/components/SignupForm.tsx`
  - [ ] Form fields: username, email, password, confirm password
  - [ ] Real-time validation (onChange)
  - [ ] Password show/hide toggle
  - [ ] Submit handler (API call to /auth/signup)
  - [ ] Error handling (display server errors)
  - [ ] Success handler (show email verification overlay)

- [ ] Create `/client/src/components/LoginForm.tsx`
  - [ ] Form fields: email, password
  - [ ] "Forgot Password?" link
  - [ ] Submit handler (API call to /auth/login)
  - [ ] Rate limiting feedback (attempts remaining)
  - [ ] Success handler (redirect to character selection)

- [ ] Create `/client/src/components/ForgotPasswordForm.tsx`
  - [ ] Form field: email
  - [ ] Submit handler (API call to /auth/forgot-password)
  - [ ] Success message ("Check your email!")
  - [ ] Back to login link

- [ ] Create `/client/src/components/EmailVerificationOverlay.tsx`
  - [ ] Display user's email address
  - [ ] Resend email button (rate limited: 3 per hour)
  - [ ] "Play as Guest" button
  - [ ] Countdown timer for resend button

- [ ] Create `/client/src/components/WelcomeOverlay.tsx`
  - [ ] "Welcome, [Username]!" message
  - [ ] List of unlocked benefits (6 characters, sync, hall of fame)
  - [ ] "Start Playing" button (redirect to character selection)

- [ ] Add HTML structure to `/client/index.html`
  - [ ] Modal container div (#auth-modal-root)
  - [ ] Portal for modals (React.createPortal)

**Success Criteria**:
- [ ] Modals responsive on desktop, iPad, iPhone (portrait/landscape)
- [ ] Form validation works client-side (real-time)
- [ ] API integration functional (signup, login, forgot password)
- [ ] Error messages display correctly
- [ ] Success flows work (email verification, welcome overlay)

---

### Part 2B: Character Selection Screen Redesign ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Enhance character selection screen
  - [ ] Fetch user authentication status (isAuthenticated, unlockedCharacters)
  - [ ] Display all 11 characters in grid
  - [ ] Visual states:
    - [ ] Available: Full color, green ✅ checkmark, clickable
    - [ ] Locked (free): Grayscale, blue 🔒 icon, "Sign Up to Unlock" tooltip
    - [ ] Locked (premium): Full color, gold border, 💎 icon, "$1.99" label

- [ ] Click handlers
  - [ ] Available character → Select and start game
  - [ ] Locked free character → Show signup modal
  - [ ] Locked premium character → Show "Coming Soon!" tooltip

- [ ] Bottom CTA
  - [ ] No-auth: "Sign Up Free to Unlock 6 Characters!" button
  - [ ] Authenticated: "Premium characters coming in MVP 17!" info text

- [ ] Character preview on hover/tap
  - [ ] Show character 3D model preview
  - [ ] Show character description

**Success Criteria**:
- [ ] Character selection shows correct locked/unlocked state
- [ ] Visual hierarchy clear (available → locked free → premium)
- [ ] Click handlers work (signup modal, character selection)
- [ ] Responsive on desktop, iPad, iPhone

---

### Part 2C: Welcome/Onboarding for Authenticated Users ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1-2 days
- **Priority**: 🟡 MEDIUM

**Tasks**:
- [ ] Welcome overlay (shown after first login/signup + email verification)
  - [ ] "Welcome, [Username]!" heading
  - [ ] List of unlocked benefits (6 characters, sync, hall of fame, progress tracking)
  - [ ] "Start Playing" button
  - [ ] Store "welcome_shown" flag in localStorage

- [ ] Returning user toast
  - [ ] "Welcome back, [Username]!" toast notification
  - [ ] Show for 3 seconds, then fade out
  - [ ] Only show on login (not on page reload)

- [ ] Email verification reminder
  - [ ] If email not verified, show reminder every 3rd login
  - [ ] "Verify your email to secure your account" toast
  - [ ] "Resend Email" link in toast

**Success Criteria**:
- [ ] Welcome overlay shown once per user (first time)
- [ ] Welcome back toast shown on login
- [ ] Email verification reminder shows for unverified users

---

### Part 2D: Settings Menu Integration ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1 day
- **Priority**: 🟡 MEDIUM

**Tasks**:
- [ ] Add "Account" tab to SettingsManager
  - [ ] Tab navigation (Sound | Graphics | Tips | Account)

- [ ] No-auth user view
  - [ ] "Guest Account" heading
  - [ ] Display username (Player_xxxxx)
  - [ ] List of benefits (6 characters, sync, hall of fame, progress tracking)
  - [ ] "Sign Up Free" button
  - [ ] "Already have account? Log In" link

- [ ] Authenticated user view
  - [ ] "Account Settings" heading
  - [ ] Display username with [Change] button
  - [ ] Display email with verification status (✅ Verified or ⚠️ Unverified)
  - [ ] Display password (••••••••) with [Change] button
  - [ ] Account created date
  - [ ] Last login time
  - [ ] Characters unlocked count (6 / 11)
  - [ ] "Log Out" button
  - [ ] "Delete Account" link (future feature)

**Success Criteria**:
- [ ] Account tab shows correct content based on auth status
- [ ] Sign Up button opens signup modal
- [ ] Log Out button logs out user
- [ ] Responsive on desktop, iPad, iPhone

---

## Phase 3: Integration & Testing ⏳ NOT STARTED (1-2 weeks)

### Part 3A: Integration with Existing Systems ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 3-4 days
- **Priority**: 🔴 CRITICAL PATH

**Tasks**:
- [ ] Update SquirrelSession.ts
  - [ ] Check authentication status on player connect
  - [ ] Restrict character selection to available characters
  - [ ] Store isAuthenticated flag in player state

- [ ] Add authentication middleware for WebSocket
  - [ ] Extract JWT token from WebSocket upgrade request
  - [ ] Verify token before allowing connection
  - [ ] Attach user data to WebSocket connection

- [ ] Update ForestManager
  - [ ] Track authenticated vs no-auth player count (metrics)
  - [ ] Log authentication status in player events

- [ ] Add analytics events
  - [ ] `auth_modal_opened`
  - [ ] `auth_signup_started`
  - [ ] `auth_signup_completed`
  - [ ] `auth_email_verified`
  - [ ] `auth_login_success`
  - [ ] `auth_login_failed`
  - [ ] `character_locked_clicked`

- [ ] Migration for existing users
  - [ ] Prompt existing users to "upgrade" account (add email/password)
  - [ ] One-time bonus: "Sign up and get 100 bonus points!"
  - [ ] Preserve existing username, score, progress

**Success Criteria**:
- [ ] Authentication status correctly tracked across all systems
- [ ] Character selection restricted based on auth status
- [ ] Analytics events fire correctly
- [ ] Existing users migrated to no-auth status

---

### Part 3B: Cross-Device Sync Testing ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🔴 CRITICAL PATH

**Test Scenarios**:
- [ ] **Scenario 1: Login on Device A, then Device B**
  - [ ] Login on Desktop Chrome (Mac)
  - [ ] Select Hare character
  - [ ] Login on iPhone Safari
  - [ ] Verify Hare character pre-selected
  - [ ] Verify score synced

- [ ] **Scenario 2: Logout from Device A**
  - [ ] Login on Desktop and Mobile
  - [ ] Logout from Desktop
  - [ ] Verify Desktop session ended
  - [ ] Verify Mobile still logged in

- [ ] **Scenario 3: Logout from all devices**
  - [ ] Login on Desktop, iPad, and iPhone
  - [ ] Click "Log Out from All Devices" on Desktop
  - [ ] Verify all devices logged out
  - [ ] Verify forced re-login on all devices

- [ ] **Scenario 4: Password change**
  - [ ] Login on Desktop and Mobile
  - [ ] Change password on Desktop
  - [ ] Verify Mobile forced to re-login
  - [ ] Verify new password works

**Platforms to Test**:
- [ ] Desktop Chrome (Mac)
- [ ] Desktop Safari (Mac)
- [ ] iPad Safari (portrait)
- [ ] iPad Safari (landscape)
- [ ] iPhone Safari (portrait)
- [ ] iPhone Safari (landscape)
- [ ] Private browsing mode (all platforms)

**Success Criteria**:
- [ ] Character selection syncs across devices
- [ ] Score syncs across devices
- [ ] Progress syncs across devices
- [ ] Logout from one device doesn't affect others
- [ ] Password change invalidates all sessions

---

### Part 3C: Character Gating Testing ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1-2 days
- **Priority**: 🟡 MEDIUM

**Test Scenarios**:
- [ ] **No-Auth User**
  - [ ] Visit site, click "Play Now"
  - [ ] Verify only Squirrel available
  - [ ] Verify 10 characters show as locked
  - [ ] Click locked character → Verify "Sign Up" modal opens
  - [ ] Verify character selection bottom CTA: "Sign Up to Unlock 6 Characters!"

- [ ] **Authenticated User (Free)**
  - [ ] Sign up with email/password
  - [ ] Verify email
  - [ ] Verify 6 characters available (Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard)
  - [ ] Verify 5 characters locked (Lynx, Bear, Moose, Badger, Skunk)
  - [ ] Click premium character → Verify "Coming Soon!" tooltip

- [ ] **Character Selection Edge Cases**
  - [ ] Logout while in-game → Verify forced to Squirrel
  - [ ] Session expires mid-game → Verify banner: "Session expired, log in to save progress"
  - [ ] Character selection during signup → Verify 6 characters auto-unlocked after verification

**Success Criteria**:
- [ ] No-auth users restricted to Squirrel
- [ ] Authenticated users have 6 free characters
- [ ] Premium characters locked for all users
- [ ] Logout/session expiration handled gracefully

---

### Part 3D: Email Flow Testing ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1-2 days
- **Priority**: 🔴 CRITICAL PATH

**Test Scenarios**:
- [ ] **Signup Email Verification**
  - [ ] Sign up with email/password
  - [ ] Verify email sent to correct address within 30 seconds
  - [ ] Click verification link → Verify account verified
  - [ ] Check link expiration (24 hours) → Verify link invalid after expiration
  - [ ] Test "Resend Email" button → Verify rate limiting (3 per hour)

- [ ] **Password Reset**
  - [ ] Click "Forgot Password?"
  - [ ] Enter email
  - [ ] Verify reset email sent within 30 seconds
  - [ ] Click reset link → Verify reset page loads
  - [ ] Enter new password → Verify password updated
  - [ ] Check link expiration (1 hour) → Verify link invalid after expiration
  - [ ] Verify old password no longer works

- [ ] **Welcome Email**
  - [ ] Sign up and verify email
  - [ ] Check inbox → Verify welcome email received
  - [ ] Verify welcome email not sent if already verified

**Email Deliverability Testing**:
- [ ] Gmail inbox placement (not spam)
- [ ] Outlook inbox placement
- [ ] Yahoo inbox placement
- [ ] ProtonMail inbox placement
- [ ] Verify SPF/DKIM/DMARC headers present

**Success Criteria**:
- [ ] All emails received within 30 seconds
- [ ] Verification links work correctly
- [ ] Password reset links work correctly
- [ ] Links expire correctly (24h verification, 1h reset)
- [ ] Emails land in inbox (not spam) for major providers

---

### Part 3E: Security Testing ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🔴 CRITICAL PATH

**Test Scenarios**:
- [ ] **Password Security**
  - [ ] Verify bcrypt hashing (~200-300ms per hash)
  - [ ] Verify password not stored in plaintext (inspect DO storage)
  - [ ] Test password comparison (correct vs incorrect)
  - [ ] Test common password rejection ("password123" rejected)
  - [ ] Test password requirements (8+ chars, uppercase, lowercase, number)

- [ ] **Rate Limiting**
  - [ ] Attempt 6 logins in 1 hour → Verify 6th attempt rejected
  - [ ] Verify lockout message shows remaining time
  - [ ] Attempt 2 signups with same email in 1 day → Verify 2nd rejected
  - [ ] Attempt 4 password reset emails in 1 hour → Verify 4th rejected

- [ ] **Session Security**
  - [ ] Tamper with JWT token signature → Verify rejected
  - [ ] Use expired access token → Verify rejected
  - [ ] Use revoked token (after logout) → Verify rejected
  - [ ] Verify token signature validation on every request

- [ ] **Input Validation**
  - [ ] Test SQL injection in email field → Verify sanitized
  - [ ] Test XSS attack in username field → Verify sanitized
  - [ ] Test email injection in email field → Verify rejected
  - [ ] Test invalid email formats → Verify rejected

**Success Criteria**:
- [ ] Passwords securely hashed (bcrypt cost 12)
- [ ] Rate limiting prevents brute force attacks
- [ ] JWT tokens properly validated
- [ ] Input sanitization prevents XSS/SQL injection

---

## Phase 4: Monetization Hooks ⏳ NOT STARTED (1 day)

### Placeholder Comments for Future IAP ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 4 hours
- **Priority**: 🟢 LOW

**Tasks**:
- [ ] Add comments to CharacterRegistry.ts
  - [ ] `// MVP 17 TODO: Add Stripe payment integration for premium characters`
  - [ ] `// MVP 17 TODO: Add character unlock API endpoint`
  - [ ] `// MVP 17 TODO: Track purchased characters in PlayerIdentity DO`

- [ ] Add comments to main.ts
  - [ ] `// MVP 17 TODO: Add "Buy Character" button for premium characters`
  - [ ] `// MVP 17 TODO: Integrate Stripe checkout modal`
  - [ ] `// MVP 17 TODO: Add purchase confirmation overlay`

- [ ] Add comments to PlayerIdentity.ts
  - [ ] `// MVP 17 TODO: Add purchasedCharacters[] field`
  - [ ] `// MVP 17 TODO: Add purchase history tracking`
  - [ ] `// MVP 17 TODO: Add refund handling`

**Success Criteria**:
- [ ] Placeholder comments added to all relevant files
- [ ] Comments reference MVP 17 (not MVP 16)

---

### Analytics Tracking Setup ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 4 hours
- **Priority**: 🟡 MEDIUM

**Tasks**:
- [ ] Create `/client/src/services/AnalyticsService.ts`
  - [ ] `trackEvent(eventName, properties)` - Send event to API
  - [ ] `trackAuthModalOpened()` - Auth modal opened
  - [ ] `trackSignupStarted()` - Signup form started
  - [ ] `trackSignupCompleted()` - Signup completed
  - [ ] `trackEmailVerified()` - Email verified
  - [ ] `trackLoginSuccess()` - Login successful
  - [ ] `trackLoginFailed()` - Login failed
  - [ ] `trackLockedCharacterClicked(characterId)` - Locked character clicked
  - [ ] `trackPremiumCharacterViewed(characterId)` - Premium character viewed (MVP 17)

- [ ] Add analytics API endpoint
  - [ ] `POST /api/analytics` - Receive analytics events
  - [ ] Store events in KV (for analysis)
  - [ ] Rate limiting (100 events/minute per user)

- [ ] Integrate Cloudflare Web Analytics
  - [ ] Add Web Analytics script to index.html
  - [ ] Track page views
  - [ ] Track custom events (auth funnel)

**Success Criteria**:
- [ ] Analytics events fire on key actions
- [ ] Events stored in KV for analysis
- [ ] Cloudflare Web Analytics integrated

---

## Success Criteria (MVP 16 Overall)

### Must-Have Features ✅
- [ ] Email verification working (users receive emails, links work)
- [ ] Password reset working (reset flow functional, secure)
- [ ] Cross-device sync working (login on multiple devices, data syncs)
- [ ] Character gating working (no-auth: 1, auth: 6, premium: locked)
- [ ] Leaderboard differentiation working (verified badge, top 10 restriction)

### Performance Metrics 📊
- [ ] Authentication conversion ≥5% (no-auth → authenticated)
- [ ] Email verification rate ≥70% (signups → verified)
- [ ] Cross-device sync success rate ≥95%
- [ ] Email deliverability ≥90% (inbox placement)
- [ ] Password reset success rate ≥80%

### Technical Requirements 🔧
- [ ] bcrypt hashing: ~200-300ms per password
- [ ] JWT token generation: <50ms
- [ ] Email sending: <5 seconds (SMTP)
- [ ] Database writes: <100ms (Durable Objects)
- [ ] API response time: <500ms (p95)

### User Experience 🎨
- [ ] Signup flow: <2 minutes (username → email → password → submit)
- [ ] Login flow: <30 seconds (email → password → submit)
- [ ] Email verification: <5 minutes (receive email → click link)
- [ ] Password reset: <3 minutes (request → email → reset)
- [ ] Character selection: <10 seconds (load available characters)

---

## Risk Mitigation

### Risk 1: Email Deliverability Issues 🟡 MEDIUM
**Description**: Emails (verification, password reset) may land in spam folder

**Mitigation**:
- Use NameCheap Private Email (already configured SPF/DKIM/DMARC)
- Test with Gmail, Outlook, Yahoo, ProtonMail
- Monitor bounce rates via NameCheap dashboard
- Add "Add to Safe Senders" instructions in emails

**Status**: ⏳ Monitoring required after implementation

---

### Risk 2: Low Authentication Conversion Rate 🔴 HIGH
**Description**: Users may not sign up (<5% conversion)

**Mitigation**:
- Strong enticement: Show 10 locked characters clearly
- Value proposition: "6 Free Characters + Cross-Device Sync"
- Low friction: Email + password only (no social auth)
- Reminder toasts: "Sign up to unlock 6 characters!" every 15 minutes
- A/B test messaging: "Sign Up" vs "Unlock 6 Characters" vs "Play More"
- Analytics tracking to identify drop-off points

**Status**: ⏳ Monitor conversion rate, iterate if <5%

---

### Risk 3: Session Management Complexity 🟡 MEDIUM
**Description**: Cross-device sync may have edge cases (token conflicts, race conditions)

**Mitigation**:
- Thorough testing on multiple devices simultaneously
- Token rotation strategy (prevent conflicts)
- Server-side session invalidation (logout from all devices)
- Clear error messages: "Session expired, please log in again"
- Fallback: If token invalid, prompt re-login (don't crash)

**Status**: ⏳ Test extensively in Phase 3B

---

### Risk 4: Password Reset Security Vulnerabilities 🔴 HIGH
**Description**: Password reset flow may be exploitable (token prediction, timing attacks)

**Mitigation**:
- Use cryptographically secure random tokens (crypto.randomUUID())
- Short expiration: 1 hour for reset links
- One-time use tokens (invalidate after password reset)
- Rate limiting: 3 password reset emails per hour per email
- Log all password reset attempts for monitoring
- Email notification: "Your password was changed" (alert user)

**Status**: ⏳ Security testing required in Phase 3E

---

### Risk 5: NameCheap SMTP Reliability 🟡 MEDIUM
**Description**: NameCheap SMTP may have downtime or slow delivery

**Mitigation**:
- Monitor email sending success rate (log all attempts)
- Implement retry logic (3 attempts with exponential backoff)
- Fallback plan: Have Resend account ready as backup
- Alert if email failure rate >10%

**Status**: ⏳ Monitor after launch

---

## Timeline & Milestones

### Week 1-2 (Nov 5-18): Phase 1 - Technical Implementation
- **Milestone 1**: PlayerIdentity DO enhanced with auth fields ✅
- **Milestone 2**: Email sending working (NameCheap SMTP) ✅
- **Milestone 3**: Character gating implemented ✅
- **Milestone 4**: JWT session management working ✅

### Week 3-4 (Nov 19-Dec 2): Phase 2 - UX Implementation
- **Milestone 5**: Login/signup modals functional ✅
- **Milestone 6**: Character selection redesigned ✅
- **Milestone 7**: Settings menu Account tab complete ✅
- **Milestone 8**: Toast notifications implemented ✅

### Week 5 (Dec 3-9): Phase 3 - Integration & Testing
- **Milestone 9**: Cross-device sync tested ✅
- **Milestone 10**: Email flows tested ✅
- **Milestone 11**: Security testing complete ✅

### Week 6 (Dec 10-16): Final Testing & Launch Prep
- **Milestone 12**: Regression testing ✅
- **Milestone 13**: Analytics integrated ✅
- **Milestone 14**: Documentation updated ✅
- **Milestone 15**: MVP 16 COMPLETE ✅

**Target Launch Date**: December 20, 2025

---

## Next Immediate Actions

### For Developer 👨‍💻
1. **Create noreply@hiddenwalnuts.com mailbox** (5 minutes)
   - Via NameCheap dashboard
   - Strong password (store in password manager)

2. **Install Dependencies** (10 minutes)
   ```bash
   cd workers
   npm install nodemailer @types/nodemailer
   npm install @tsndr/cloudflare-worker-bcrypt
   npm install jsonwebtoken @types/jsonwebtoken
   ```

3. **Store Secrets** (5 minutes)
   ```bash
   wrangler secret put SMTP_USER --name hidden-walnuts-api-preview
   wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api-preview
   wrangler secret put JWT_SECRET --name hidden-walnuts-api-preview
   ```

4. **Create KV Namespace** (5 minutes)
   ```bash
   npx wrangler kv:namespace create "EMAIL_INDEX"
   npx wrangler kv:namespace create "EMAIL_INDEX" --preview
   ```

5. **Begin Phase 1A: PlayerIdentity DO Enhancement**
   - Add authentication fields to interface
   - Install bcrypt library
   - Implement signup/login methods

---

## References

**Documentation**:
- [Authentication_Tech_Approach.md](./Authentication_Tech_Approach.md) - Technical architecture
- [Authentication_UX_Design.md](./Authentication_UX_Design.md) - UX flows and wireframes
- [MONETIZATION_DESIGN.md](./MONETIZATION_DESIGN.md) - Monetization strategy

**External Resources**:
- NameCheap Private Email SMTP: https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- bcrypt Best Practices: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- JWT Best Practices: https://datatracker.ietf.org/doc/html/rfc8725

---

**Document Status**: ✅ READY FOR PHASE 1 IMPLEMENTATION
**Last Updated**: 2025-11-04
**Next Update**: Weekly (every Monday during implementation)
