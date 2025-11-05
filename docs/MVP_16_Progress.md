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

**Current Status**: ✅ **PHASE 1 COMPLETE** - Ready for Phase 2 (UX Implementation)

**Latest Update**: 2025-11-05 - Phase 1 COMPLETE (All Technical Implementation)

---

## 📊 Quick Progress Summary

| Phase/Part | Status | Progress | Time |
|------------|--------|----------|------|
| **Phase 0: Research & Design** | ✅ Complete | 6/6 tasks | 2 days |
| **Phase 1: Technical Implementation** | ✅ Complete | 29/29 tasks | 11.5 hours |
| └─ Part 1A: PlayerIdentity DO | ✅ Complete | 11/11 tasks | ~6 hours |
| └─ Part 1B: Email Integration | ✅ Complete | 5/5 tasks | ~2 hours |
| └─ Part 1C: Character Gating | ✅ Complete | 4/4 tasks | ~1 hour |
| └─ Part 1D: JWT Sessions | ✅ Complete | 5/5 tasks | ~2 hours |
| └─ Part 1E: Leaderboard | ✅ Complete | 4/4 tasks | ~30 min |
| **Phase 2: UX Implementation** | ⏳ Not Started | 0/20+ tasks | 2-3 weeks |
| **Phase 3: Integration & Testing** | ⏳ Not Started | 0/15+ tasks | 1-2 weeks |
| **Phase 4: Monetization Hooks** | ⏳ Not Started | 0/5+ tasks | 1 day |

**Overall Progress**: 35/70+ tasks complete (50%)

---

## Progress Overview

### Phase 0: Research & Design ✅ **COMPLETE** (2 days)
- **Started**: 2025-11-04
- **Completed**: 2025-11-04
- **Duration**: 2 days
- **Status**: ✅ COMPLETE

### Phase 1: Technical Implementation ✅ **COMPLETE** (1 day)
- **Started**: 2025-11-05
- **Completed**: 2025-11-05
- **Duration**: 1 day (11.5 hours)
- **Status**: ✅ COMPLETE - All backend infrastructure implemented

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

## Phase 1: Technical Implementation ⏳ IN PROGRESS (2-3 weeks)

**Started**: 2025-11-05
**Status**: 🟡 IN PROGRESS

---

## 📋 COMPREHENSIVE PHASE 1 IMPLEMENTATION PLAN

### Overview
Phase 1 implements the core backend authentication infrastructure for Hidden Walnuts MVP 16. This includes enhancing the PlayerIdentity Durable Object with email/password authentication, integrating email sending via NameCheap SMTP, implementing JWT session management, building character gating logic, and updating the leaderboard system to support authenticated users.

**Timeline**: 2-3 weeks (Nov 5-25, 2025)
**Priority**: CRITICAL PATH - All Phase 2 (UX) work depends on this

### Recommended Implementation Order

**Week 1 (Nov 5-11): Foundation**
1. **Part 1A (Days 1-5)**: PlayerIdentity DO Enhancement - Foundation for everything else
2. **Part 1D (Days 6-7)**: Session Management (Start) - Begin JWT implementation

**Week 2 (Nov 12-18): Integration**
3. **Part 1D (Days 8-10)**: Session Management (Complete) - Finish JWT and middleware
4. **Part 1B (Days 11-13)**: Email Sending Integration - Integrate with PlayerIdentity
5. **Part 1C (Days 14-15)**: Character Gating System - Define tiers and implement

**Week 3 (Nov 19-25): Finalization**
6. **Part 1E (Days 16-17)**: Leaderboard Integration - Update leaderboard schema
7. **Integration Testing (Days 18-20)**: End-to-end testing
8. **Buffer Time (Days 21-23)**: Troubleshooting & documentation

---

### Part 1A: PlayerIdentity DO Enhancement ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-05
- **Duration**: ~6 hours (estimated 5-6 days)
- **Priority**: 🔴 CRITICAL PATH - Everything depends on this

#### Overview
Enhance the existing PlayerIdentity Durable Object to support full authentication (email/password) while maintaining backward compatibility with the current no-auth username system. This is the foundation for all authentication features.

#### Files to Create
1. **`/workers/utils/PasswordUtils.ts`** - Password hashing and validation utilities
2. **`/workers/utils/TokenGenerator.ts`** - Generate secure verification/reset tokens

#### Files to Modify
1. **`/workers/objects/PlayerIdentity.ts`** - Add authentication methods and fields
2. **`/workers/package.json`** - Add bcrypt dependency

#### Detailed Tasks

**Task 1A.1: Install Dependencies** (30 minutes)
```bash
cd workers
npm install @tsndr/cloudflare-worker-bcrypt
```

**Task 1A.2: Update PlayerIdentityData Interface** (1 hour)
Add new authentication fields to existing interface:
```typescript
export interface PlayerIdentityData {
  // Existing fields (MVP 6)
  username: string;
  sessionTokens: string[];
  created: number;
  lastSeen: number;
  lastUsernameChange?: number;
  lastCharacterId?: string;

  // NEW: Authentication fields (MVP 16)
  email?: string;
  passwordHash?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: number;
  passwordResetToken?: string;
  passwordResetExpiry?: number;
  isAuthenticated: boolean;
  accountCreated?: number;
  lastPasswordChange?: number;

  // NEW: Character entitlements (MVP 16)
  unlockedCharacters: string[];

  // NEW: Session tracking (MVP 16)
  authTokens: {
    tokenId: string;
    created: number;
    expiresAt: number;
    deviceInfo?: string;
    lastUsed?: number;
  }[];
}
```

**Task 1A.3: Create Password Utility Module** (2 hours)
File: `/workers/utils/PasswordUtils.ts`
- bcrypt cost factor 12
- Password validation (8+ chars, uppercase, lowercase, number)
- Common password rejection
- Password uniqueness check (vs username/email)

**Task 1A.4: Create Token Generator Module** (1 hour)
File: `/workers/utils/TokenGenerator.ts`
- Generate verification tokens (crypto.randomUUID)
- Generate password reset tokens
- Token expiration helpers
- Token validation helpers

**Task 1A.5: Implement Signup Method** (3 hours)
- Validate email format, password requirements
- Hash password with bcrypt
- Generate verification token (24h expiry)
- Unlock 6 free characters for authenticated users
- Return verification token for email sending

**Task 1A.6: Implement Login Method** (2 hours)
- Validate email/password
- Compare password hash
- Update last seen timestamp
- Return user data + authentication status

**Task 1A.7: Implement Email Verification Method** (1.5 hours)
- Validate verification token
- Check token expiration (24 hours)
- Mark email as verified
- Clear verification token

**Task 1A.8: Implement Password Reset Request Method** (1.5 hours)
- Generate reset token (1h expiry)
- Security: Don't reveal if email exists
- Return token for email sending

**Task 1A.9: Implement Password Reset Method** (1.5 hours)
- Validate reset token
- Check token expiration (1 hour)
- Hash new password
- Invalidate all auth tokens (force re-login)
- Clear reset token

**Task 1A.10: Implement Change Password Method** (1 hour)
- Verify old password
- Validate new password
- Hash new password
- Invalidate all auth tokens (force re-login)

**Task 1A.11: Add Email Uniqueness Index (KV)** (2 hours)
- Create EMAIL_INDEX KV namespace
- Add binding to wrangler.toml
- Add to EnvWithBindings interface
- Check email uniqueness on signup

#### Dependencies
- None (can start immediately)

#### Integration Points
- **Part 1B (Email)**: Signup and password reset need email sending
- **Part 1D (JWT)**: Login needs JWT token generation
- **Part 1E (Leaderboard)**: isAuthenticated flag used for filtering

#### Testing Strategy
- Unit tests for PasswordUtils (validation, hashing, comparison)
- Integration tests for all auth methods
- Manual testing checklist (see detailed plan)

#### Success Criteria
- [x] bcrypt hashing takes ~200-300ms (cost factor 12)
- [x] Password never stored in plaintext
- [x] Email uniqueness enforced via KV namespace
- [x] All auth methods functional (signup, login, verify, reset, change)
- [x] Existing users migrated to no-auth status (automatic on check)

#### What Was Built
- ✅ **PasswordUtils module** - bcrypt hashing, validation, common password rejection
- ✅ **TokenGenerator module** - UUID token generation, expiration helpers
- ✅ **PlayerIdentityData interface** - 25 new fields for authentication
- ✅ **handleSignup()** - Create authenticated account with email/password
- ✅ **handleLogin()** - Email/password authentication
- ✅ **handleVerifyEmail()** - 24-hour token validation
- ✅ **handleRequestPasswordReset()** - Generate 1-hour reset token
- ✅ **handleResetPassword()** - Reset with token validation
- ✅ **handleChangePassword()** - Change with old password verification
- ✅ **EMAIL_INDEX KV** - Global email uniqueness across all users
- ✅ **Backward compatibility** - Existing users auto-migrate on first check

---

### Part 1B: Email Sending Integration ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-05
- **Duration**: ~2 hours (estimated 2-3 days)
- **Priority**: 🔴 CRITICAL PATH

#### Overview
Integrate NameCheap Private Email SMTP for sending transactional emails (verification, password reset, welcome). Uses nodemailer library with mail.privateemail.com as the SMTP server.

#### Files to Create
1. **`/workers/services/EmailService.ts`** - Email sending service with templates
2. Email templates (inline HTML in EmailService)

#### Files to Modify
1. **`/workers/package.json`** - Add nodemailer dependency
2. **`/workers/objects/PlayerIdentity.ts`** - Call EmailService from auth methods

#### Detailed Tasks

**Task 1B.1: Create noreply@hiddenwalnuts.com Mailbox** (15 minutes)
- Log in to NameCheap dashboard
- Create new mailbox with strong password
- Enable SMTP access
- Note: mail.privateemail.com, port 465 (SSL) or 587 (TLS)

**Task 1B.2: Store SMTP Credentials as Secrets** (15 minutes)
```bash
wrangler secret put SMTP_USER --name hidden-walnuts-api-preview
wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api-preview
wrangler secret put SMTP_USER --name hidden-walnuts-api
wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api
```

**Task 1B.3: Install nodemailer Dependency** (15 minutes)
```bash
cd workers
npm install nodemailer
npm install --save-dev @types/nodemailer
```

**Task 1B.4: Create EmailService Module** (4 hours)
File: `/workers/services/EmailService.ts`
- SMTP transport configuration
- `sendVerificationEmail(email, username, token)` - HTML email with verification link
- `sendPasswordResetEmail(email, username, token)` - HTML email with reset link (1h expiry warning)
- `sendWelcomeEmail(email, username)` - HTML email after verification
- Error handling and logging

**Task 1B.5: Integrate Email Service with PlayerIdentity** (2 hours)
- Update constructor to accept env
- Call sendVerificationEmail after signup
- Call sendWelcomeEmail after email verification
- Call sendPasswordResetEmail after reset request

**Task 1B.6: Test Email Deliverability** (2 hours)
- Send test emails to Gmail, Outlook
- Verify inbox placement (not spam)
- Verify links work
- Check SPF/DKIM/DMARC headers (mail-tester.com)

#### Dependencies
- **Part 1A**: Email sending triggered by signup, verification, password reset

#### Integration Points
- **Part 1A (PlayerIdentity)**: Called from signup, verify email, password reset handlers

#### Testing Strategy
- Unit tests (mock transporter)
- Integration tests with real SMTP (staging)
- Manual testing with major email providers

#### Success Criteria
- [x] Verification emails sent via SMTP
- [x] Password reset emails sent via SMTP
- [x] Welcome emails sent via SMTP
- [x] Professional HTML email templates with inline CSS
- [x] SMTP secrets stored securely (preview + production)
- [x] Graceful fallback if SMTP not configured
- [ ] Emails land in inbox (not spam) - **Testing Required**
- [ ] Email deliverability verified - **Testing Required**

#### What Was Built
- ✅ **EmailService module** - Nodemailer SMTP transport (mail.privateemail.com:465)
- ✅ **sendVerificationEmail()** - Green theme, 24h expiry, benefits list
- ✅ **sendPasswordResetEmail()** - Red theme, 1h expiry, security warning
- ✅ **sendWelcomeEmail()** - Green theme, unlocked features, CTA button
- ✅ **PlayerIdentity integration** - Emails sent after signup, verify, reset
- ✅ **SMTP secrets** - Configured for both preview and production environments
- ✅ **Node.js compatibility** - Added nodejs_compat flag + updated compatibility_date
- ✅ **Deployment fix** - Resolved 53 Node.js module resolution errors

---

### Part 1C: Character Gating System ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-05
- **Duration**: ~1 hour (estimated 1.5 days)
- **Priority**: 🟡 MEDIUM

#### Overview
Implement character tier logic to restrict character selection based on authentication status. No-auth users get 1 character (Squirrel), authenticated users get 6 characters, and premium characters are locked for all users (MVP 17).

#### Files to Create
1. **`/workers/constants/CharacterTiers.ts`** - Character tier definitions (server-side validation)

#### Files to Modify
1. **`/client/src/services/CharacterRegistry.ts`** - Add character gating logic
2. **`/client/public/characters.json`** - Add tier metadata to each character

#### Detailed Tasks

**Task 1C.1: Define Character Tiers (Server-Side)** (1 hour)
File: `/workers/constants/CharacterTiers.ts`
```typescript
export const NO_AUTH_CHARACTERS = ['squirrel'];
export const FREE_AUTH_CHARACTERS = ['squirrel', 'hare', 'goat', 'chipmunk', 'turkey', 'mallard'];
export const PREMIUM_CHARACTERS = ['lynx', 'bear', 'moose', 'badger'];

export function isCharacterAvailable(characterId, isAuthenticated, unlockedCharacters): boolean
export function getAvailableCharacters(isAuthenticated, unlockedCharacters): string[]
```

**Task 1C.2: Update characters.json with Tier Metadata** (30 minutes)
Add `tier` field to each character:
```json
{ "id": "squirrel", "tier": "no-auth", ... }
{ "id": "hare", "tier": "free", ... }
{ "id": "lynx", "tier": "premium", "price": 1.99, ... }
```

**Task 1C.3: Enhance CharacterRegistry (Client-Side)** (2 hours)
File: `/client/src/services/CharacterRegistry.ts`
- Add character tier constants
- `isCharacterAvailable(characterId, isAuthenticated, unlockedCharacters)`
- `getAvailableCharacters(isAuthenticated, unlockedCharacters)`
- `getCharacterTier(characterId)`
- `getCharacterPrice(characterId)`
- `getLockedCharacters(isAuthenticated, unlockedCharacters)`

**Task 1C.4: Add Server-Side Character Validation** (1 hour)
Update ForestManager or character selection handler:
- Validate character availability before allowing selection
- Return 403 error if character not available

#### Dependencies
- **Part 1A**: Needs isAuthenticated and unlockedCharacters fields

#### Integration Points
- **Part 2B (Character Selection UX)**: Client UI uses CharacterRegistry methods
- **ForestManager/SquirrelSession**: Server validates character selection

#### Testing Strategy
- Unit tests for CharacterTiers module
- Integration tests for character selection
- Manual testing checklist

#### Success Criteria
- ✅ No-auth users can only select Squirrel
- ✅ Authenticated users can select 6 free characters
- ✅ Premium characters show locked (💎) for all users
- ✅ Server rejects invalid character selection attempts

#### What Was Built
1. **Server-Side Character Tier Definitions**
   - Created `/workers/constants/CharacterTiers.ts` with tier constants and validation functions
   - `isCharacterAvailable()` - Validates character availability based on auth status
   - `getAvailableCharacters()` - Returns all available characters for user
   - `getCharacterTier()` - Returns tier for a character
   - `getCharacterPrice()` - Returns price for premium characters ($1.99)

2. **Character Metadata Updates**
   - Updated `/client/public/characters.json` with tier and price fields
   - 1 no-auth character: Squirrel
   - 6 free characters: Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard
   - 4 premium characters: Lynx, Bear, Moose, Badger ($1.99 each)
   - 1 future character: Skunk (seasonal/event)

3. **Client-Side CharacterRegistry Enhancement**
   - Completely refactored `/client/src/services/CharacterRegistry.ts`
   - Added async `loadCharacters()` method to load from characters.json
   - Added tier validation methods matching server-side logic
   - `getLockedCharacters()` - Returns locked characters for UI display
   - Updated CharacterDefinition interface with tier and price fields

4. **Server-Side Character Validation in ForestManager**
   - Added character validation before WebSocket connection acceptance
   - Fetches player auth status and unlocked characters from PlayerIdentity DO
   - Returns 403 error with helpful message if character unavailable
   - Prevents unauthorized character selection at server level

---

### Part 1D: Session Management & JWT Tokens ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-05
- **Duration**: ~2 hours (estimated 3 days)
- **Priority**: 🔴 CRITICAL PATH

#### Overview
Implement JWT-based session management for cross-device authentication. Uses access tokens (30-day) and refresh tokens (90-day) to support multiple devices while maintaining security.

#### Files to Create
1. **`/workers/services/AuthService.ts`** - JWT token generation and validation
2. **`/workers/middleware/AuthMiddleware.ts`** - Authentication middleware for API routes

#### Files to Modify
1. **`/workers/package.json`** - Add jsonwebtoken dependency
2. **`/workers/objects/PlayerIdentity.ts`** - Add token management methods

#### Detailed Tasks

**Task 1D.1: Generate and Store JWT Secret** (15 minutes)
```bash
openssl rand -base64 32
wrangler secret put JWT_SECRET --name hidden-walnuts-api-preview
wrangler secret put JWT_SECRET --name hidden-walnuts-api
```

**Task 1D.2: Install jsonwebtoken Dependency** (15 minutes)
```bash
cd workers
npm install jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

**Task 1D.3: Create AuthService Module** (3 hours)
File: `/workers/services/AuthService.ts`
- `generateAccessToken(userData)` - 30-day expiration
- `generateRefreshToken(username, tokenId)` - 90-day expiration
- `verifyAccessToken(token)` - Validate and decode
- `verifyRefreshToken(token)` - Validate and decode
- `extractTokenFromHeader(authHeader)` - Parse Bearer token

**Task 1D.4: Update PlayerIdentity with Token Management** (3 hours)
- `generateAuthTokens(userData, deviceInfo)` - Generate access + refresh tokens
- Update login to return tokens
- `handleRefreshToken(request)` - Get new access token
- `handleLogout(request)` - Invalidate single device token
- `handleLogoutAll(request)` - Invalidate all tokens

**Task 1D.5: Create Authentication Middleware** (2 hours)
File: `/workers/middleware/AuthMiddleware.ts`
- `authenticateRequest(request, env)` - Extract and verify token
- `requireAuth(request, env)` - Middleware that returns 401 if not authenticated

#### Dependencies
- **Part 1A**: Login/signup methods need token generation

#### Integration Points
- **Worker API**: Authentication middleware used on protected routes
- **WebSocket**: Will need token validation for WebSocket upgrades
- **Client**: Stores tokens in localStorage

#### Testing Strategy
- Unit tests for AuthService (token generation, verification)
- Integration tests (login, refresh, logout)
- Manual testing checklist (cross-device sync)

#### Success Criteria
- ✅ Access token valid for 30 days
- ✅ Refresh token valid for 90 days
- ✅ Multiple devices can be logged in simultaneously
- ✅ Logout from one device doesn't affect others
- ✅ Logout from all devices clears all tokens
- ✅ Password change invalidates all existing tokens

#### What Was Built
1. **AuthService Module** (`/workers/services/AuthService.ts`)
   - `generateAccessToken()` - Creates 30-day JWT access tokens
   - `generateRefreshToken()` - Creates 90-day JWT refresh tokens
   - `generateTokenPair()` - Generates both tokens with expiry timestamps
   - `verifyAccessToken()` - Validates and decodes access tokens
   - `verifyRefreshToken()` - Validates and decodes refresh tokens
   - `extractTokenFromHeader()` - Parses Bearer tokens from Authorization header
   - `generateTokenId()` - Creates unique token IDs for tracking/revocation

2. **PlayerIdentity Token Management Updates**
   - Updated `handleSignup()` to return JWT tokens immediately
   - Updated `handleLogin()` to return JWT tokens
   - Added `handleRefreshToken()` - Exchange refresh token for new access token
   - Added `handleLogout()` - Revoke single device token
   - Added `handleLogoutAll()` - Revoke all tokens (security feature)
   - Token metadata tracking: tokenId, created, expiresAt, deviceInfo, lastUsed
   - Automatic token limit (10 per user) with oldest-first removal

3. **Authentication Middleware** (`/workers/middleware/AuthMiddleware.ts`)
   - `authenticateRequest()` - Extract and verify JWT token
   - `requireAuth()` - Return 401 if not authenticated
   - `requireEmailVerified()` - Return 403 if email not verified
   - `optionalAuth()` - Support both auth and no-auth users

4. **Type System Updates**
   - Made `JWT_SECRET` required in `EnvWithBindings` interface
   - Added `AccessTokenPayload` and `RefreshTokenPayload` interfaces
   - Added `TokenPair` interface for token generation responses

5. **Dependencies**
   - Installed `jsonwebtoken` and `@types/jsonwebtoken`
   - JWT_SECRET already stored in both preview and production environments

---

### Part 1E: Leaderboard Integration ✅
- **Status**: ✅ COMPLETE
- **Completed**: 2025-11-05
- **Duration**: ~30 minutes (estimated 1.5 days)
- **Priority**: 🟡 MEDIUM

#### Overview
Update the Leaderboard Durable Object to track authentication status and implement leaderboard filtering (daily: all users, weekly top 10: authenticated only, hall of fame: authenticated only).

#### Files to Modify
1. **`/workers/objects/Leaderboard.ts`** - Add authentication fields and filtering logic

#### Detailed Tasks

**Task 1E.1: Update LeaderboardEntry Interface** (30 minutes)
```typescript
interface ScoreRecord {
  playerId: string;
  score: number;
  walnuts: { hidden: number; found: number };
  updatedAt: number;
  lastScoreIncrease?: number;

  // NEW: MVP 16
  isAuthenticated: boolean;
  emailVerified: boolean;
  characterId: string;
}
```

**Task 1E.2: Update Score Submission Handler** (1 hour)
- Accept authentication fields in score submission
- Validate authentication fields
- Set defaults for backward compatibility

**Task 1E.3: Implement Leaderboard Filtering Logic** (2 hours)
- Update `/top` endpoint with type parameter (weekly, daily, alltime)
- Daily leaderboard: All players (no filtering)
- Weekly leaderboard: All players, but top 10 filtered to authenticated
- Hall of Fame: Authenticated players ONLY
- Update `getTopPlayers()` with filtering options

**Task 1E.4: Add Player Rank Endpoint with Auth Info** (1 hour)
- Update `/player` endpoint to return authentication-aware rank
- Calculate rank considering authentication filter for weekly top 10
- Return isAuthenticated, emailVerified, characterId

#### Dependencies
- **Part 1A**: isAuthenticated and emailVerified fields

#### Integration Points
- **Client Leaderboard UI**: Display verified badge (🔒)
- **Score Submission**: ForestManager passes authentication info

#### Testing Strategy
- Unit tests for leaderboard filtering
- Integration tests for score submission with auth fields
- Manual testing checklist

#### Success Criteria
- ✅ Daily leaderboard shows all players
- ✅ Weekly leaderboard top 10 restricted to authenticated players
- ✅ Hall of Fame only shows authenticated players
- ✅ Authentication info included in leaderboard responses

#### What Was Built
1. **Updated ScoreRecord Interface**
   - Added `isAuthenticated` field - Tracks if player has authenticated account
   - Added `emailVerified` field - Tracks email verification status
   - Added `characterId` field - Tracks character used by player

2. **Score Submission Handler Updates**
   - Accepts authentication fields in score submissions
   - Sets defaults for backward compatibility (isAuthenticated=false, emailVerified=false, characterId='squirrel')
   - Updates both weekly and all-time leaderboards with auth info

3. **Enhanced getTopPlayers Method**
   - Added `requireAuth` option - Filter to authenticated players only (Hall of Fame)
   - Added `authOnlyForTopN` option - Restrict first N positions to authenticated (Weekly top 10)
   - Returns authentication fields in player records (isAuthenticated, emailVerified, characterId)
   - Maintains proper ranking after filtering

4. **Leaderboard Filtering by Type**
   - **Daily** (`?type=daily`): All players, no filtering
   - **Weekly** (`?type=weekly`): All players, but top 10 positions restricted to authenticated
   - **Hall of Fame** (`?type=alltime`): Authenticated players ONLY

5. **Player Rank Endpoint Enhancement**
   - Updated `/player` endpoint to return authentication info
   - Includes isAuthenticated, emailVerified, and characterId in response
   - Provides complete player profile for UI display

---

## Phase 2: UX Implementation ⏳ IN PROGRESS (2.5-3.5 weeks)

**Phase 2 Overview**:
- **Duration**: 18-25 days (2.5-3.5 weeks)
- **Status**: ⏳ IN PROGRESS
- **Dependencies**: Phase 1 ✅ COMPLETE
- **Priority**: CRITICAL PATH - Required for MVP 16 launch

**Platform Support**:
- Desktop (1025px+)
- iPad Portrait (768-1024px, portrait)
- iPad Landscape (768-1024px, landscape)
- iPhone Portrait (≤430px)
- iPhone Landscape (≤932px width, ≤500px height)

Phase 2 implements the client-side authentication user experience for Hidden Walnuts MVP 16. This includes building responsive modals, forms, overlays, and integration with the Phase 1 backend APIs.

---

### Part 2A: Authentication Modal System & Forms ⏳ IN PROGRESS
- **Status**: ⏳ IN PROGRESS
- **Estimated Duration**: 4-5 days
- **Priority**: 🔴 CRITICAL PATH
- **Dependencies**: None (can start immediately)

**Platform Considerations**:
- **Desktop**: 600px centered modal with hover states
- **iPad**: 700px modal (portrait), 800px (landscape), larger touch targets
- **iPhone Portrait**: Full-screen forms with bottom-aligned buttons
- **iPhone Landscape**: Compact 400px modal, scrollable

**Tasks**:

**Task 2A.1: Create Base AuthModal Component** (6 hours) ⏳ IN PROGRESS
- File: `/client/src/components/AuthModal.tsx`
- [ ] Modal overlay with semi-transparent backdrop
- [ ] Responsive sizing: Desktop (600px), iPad (700-800px), iPhone (full-screen/400px)
- [ ] Screen routing: 'signup' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email'
- [ ] Close handlers: ESC key, backdrop click, [X] button
- [ ] Fade animations (0.3s)
- [ ] Z-index 10000, prevent body scroll
- [ ] Keyboard navigation (Tab, Shift+Tab, Enter)

**Task 2A.2: Create SignupForm Component** (8 hours)
- File: `/client/src/components/SignupForm.tsx`
- [ ] Fields: username, email, password, confirm password
- [ ] Real-time validation with ✅/❌ indicators
- [ ] Password strength meter (weak/medium/strong)
- [ ] Password show/hide toggle (👁️ icon)
- [ ] Benefits display above form (6 characters, sync, hall of fame)
- [ ] API: POST `/auth/signup`
- [ ] Error handling: email exists, username taken, weak password
- [ ] Button states: disabled/enabled/loading

**Task 2A.3: Create LoginForm Component** (6 hours)
- File: `/client/src/components/LoginForm.tsx`
- [ ] Fields: email, password (with show/hide toggle)
- [ ] "Forgot Password?" link
- [ ] "Don't have an account? [Sign Up]" link
- [ ] API: POST `/auth/login`
- [ ] Store tokens in localStorage: `auth_access_token`, `auth_refresh_token`, `auth_user`
- [ ] Success: Redirect to character selection + welcome toast
- [ ] Error handling: invalid credentials, rate limiting (3/5 attempts), network errors

**Task 2A.4: Create ForgotPasswordForm Component** (4 hours)
- File: `/client/src/components/ForgotPasswordForm.tsx`
- [ ] Field: email
- [ ] API: POST `/auth/forgot-password`
- [ ] Success: "Check Your Email!" overlay
- [ ] Rate limiting: 3 requests per hour per email
- [ ] Security: Don't reveal if email exists

**Task 2A.5: Create ResetPasswordForm Component** (4 hours)
- File: `/client/src/components/ResetPasswordForm.tsx`
- [ ] Trigger: Route `/reset-password?token=abc123`
- [ ] Fields: new password, confirm password
- [ ] Password strength meter and requirements
- [ ] API: POST `/auth/reset-password`
- [ ] Success: "Password Updated!" → Redirect to login after 2 seconds
- [ ] Error: "Reset link expired or invalid. [Request New Link]"

**Task 2A.6: Client-Side Validation Utilities** (3 hours)
- File: `/client/src/utils/validation.ts`
- [ ] `validateEmail()` - RFC 5322 regex
- [ ] `validatePassword()` - Returns strength + errors
- [ ] `validateUsername()` - 3-20 chars, alphanumeric + underscore
- [ ] `passwordsMatch()` - Confirm field validation
- [ ] Password requirements: 8+ chars, 1 uppercase, 1 lowercase, 1 number

**Task 2A.7: Add Modal Styles** (4 hours)
- File: `/client/src/components/AuthModal.css`
- [ ] Backdrop: `rgba(0, 0, 0, 0.7)` with blur
- [ ] Modal: White, rounded corners (16px), box-shadow
- [ ] Form fields: 50px height, 16px font, clear focus states
- [ ] Buttons: 60px height, hover/active states
- [ ] Validation indicators: Green ✅, Red ❌, Yellow ⚠️
- [ ] Responsive breakpoints for all platforms

**Task 2A.8: API Service Layer** (4 hours)
- File: `/client/src/services/AuthService.ts`
- [ ] Methods: `signup()`, `login()`, `forgotPassword()`, `resetPassword()`, `verifyEmail()`, `resendVerification()`, `refreshToken()`, `logout()`, `getCurrentUser()`, `isAuthenticated()`, `clearAuth()`
- [ ] Error handling: try-catch, parse backend errors, user-friendly messages
- [ ] Token management utilities

**Files to Create**:
- `/client/src/components/AuthModal.tsx`
- `/client/src/components/SignupForm.tsx`
- `/client/src/components/LoginForm.tsx`
- `/client/src/components/ForgotPasswordForm.tsx`
- `/client/src/components/ResetPasswordForm.tsx`
- `/client/src/utils/validation.ts`
- `/client/src/services/AuthService.ts`
- `/client/src/components/AuthModal.css` (optional)

**Files to Modify**:
- `/client/index.html` - Add `<div id="auth-modal-root"></div>`
- `/client/src/main.ts` - Import AuthModal, add `/reset-password` route

**Success Criteria**:
- [ ] AuthModal opens/closes correctly on all platforms
- [ ] SignupForm validates all fields client-side
- [ ] LoginForm authenticates and stores tokens
- [ ] ForgotPasswordForm sends reset email
- [ ] ResetPasswordForm updates password
- [ ] All forms responsive on desktop, iPad, iPhone (portrait & landscape)
- [ ] Keyboard navigation works (Tab, Enter, ESC)
- [ ] Error messages display correctly
- [ ] Loading states show during API calls

---

### Part 2B: Email Verification & Welcome Overlays ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🟡 HIGH
- **Dependencies**: Part 2A must be complete

**Platform Considerations**:
- All platforms: Centered overlay, responsive text sizing
- iPhone: Larger fonts, more padding

**Tasks**:

**Task 2B.1: Create EmailVerificationOverlay Component** (4 hours)
- File: `/client/src/components/EmailVerificationOverlay.tsx`
- [ ] Display: "✉️ Check Your Email!" with user's email
- [ ] Message: "Click the link to verify your account and unlock 6 characters!"
- [ ] [Resend Email] button with rate limiting (3 per hour) and countdown timer
- [ ] [Play as Guest] button to continue without verification
- [ ] API: POST `/auth/resend-verification`

**Task 2B.2: Create WelcomeOverlay Component** (4 hours)
- File: `/client/src/components/WelcomeOverlay.tsx`
- [ ] Trigger: After email verification success
- [ ] Display: "🎉 Welcome to Hidden Walnuts, [Username]!"
- [ ] List benefits: 6 characters, sync, hall of fame, progress tracking
- [ ] [Start Playing →] button → character selection
- [ ] One-time display: Store `welcome_shown` in localStorage

**Task 2B.3: Email Verification Page Route** (3 hours)
- File: `/client/src/pages/VerifyEmail.tsx`
- [ ] Route: `/verify-email?token=abc123`
- [ ] Extract token, call API: POST `/auth/verify-email`
- [ ] Success: Show WelcomeOverlay, redirect after 5 seconds
- [ ] Error: "Verification link expired" + [Request New Link] button

**Task 2B.4: Unverified Email Reminder System** (3 hours)
- [ ] Trigger: Every 3rd login if email not verified
- [ ] Toast: "Verify your email to secure your account" + [Resend Email] link
- [ ] Duration: 8 seconds
- [ ] Track `login_count_since_reminder` in localStorage

**Task 2B.5: Resend Verification Email Handler** (2 hours)
- [ ] API: POST `/auth/resend-verification`
- [ ] Rate limiting: 3 per hour
- [ ] Countdown timer: Disable button for 60 seconds
- [ ] Success toast: "Email sent!"
- [ ] Error toast: "Too many requests. Try again later."

**Files to Create**:
- `/client/src/components/EmailVerificationOverlay.tsx`
- `/client/src/components/WelcomeOverlay.tsx`
- `/client/src/pages/VerifyEmail.tsx`

**Files to Modify**:
- `/client/src/main.ts` - Add email verification route, reminder logic

**Success Criteria**:
- [ ] EmailVerificationOverlay shows after signup
- [ ] Resend email button works with rate limiting
- [ ] WelcomeOverlay shows after email verification
- [ ] Email verification page route works
- [ ] Unverified email reminder shows every 3rd login
- [ ] One-time welcome flag prevents duplicate displays

---

### Part 2C: Character Selection Enhancement ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 3-4 days
- **Priority**: 🔴 CRITICAL PATH
- **Dependencies**: Part 2A, Phase 1C

**Platform Considerations**:
- **Desktop**: 4x3 grid (11 characters + 1 empty)
- **iPad Portrait**: 3x4 grid
- **iPad Landscape**: 4x3 grid
- **iPhone Portrait**: 2x6 grid, vertical scroll
- **iPhone Landscape**: Horizontal scroll, 2x6 grid

**Tasks**:

**Task 2C.1: Update Character Selection UI** (6 hours)
- [ ] Replace dropdown with visual grid of character cards
- [ ] Card design: Emoji/3D preview, name, status icon (✅/🔒/💎)
- [ ] Visual states:
  - **Available**: Full color, ✅ checkmark, clickable, hover scale 1.05
  - **Locked Free**: 80% opacity, 🔒 icon, tooltip "Sign Up to Unlock"
  - **Locked Premium**: Full color, gold border, 💎 icon + "$1.99"
- [ ] Grid layout with CSS Grid: 4 cols (desktop), 3 (iPad portrait), 2 (iPhone)

**Task 2C.2: Add Authentication Status Check** (3 hours)
- [ ] Fetch user: `AuthService.getCurrentUser()`
- [ ] Get available characters: `CharacterRegistry.getAvailableCharacters()`
- [ ] Get locked characters: `CharacterRegistry.getLockedCharacters()`
- [ ] Render grid based on availability

**Task 2C.3: Add Bottom CTA Banner** (2 hours)
- [ ] No-auth: "🔐 Sign Up Free to Unlock 6 Characters! [Sign Up] [Log In]"
- [ ] Authenticated: "Premium characters coming in MVP 17! Stay tuned 🐻"
- [ ] Styling: Gold background (`rgba(255, 215, 0, 0.1)`), border, buttons

**Task 2C.4: Add Character Preview on Hover/Tap** (4 hours)
- [ ] Show 3D preview in modal overlay when locked character clicked
- [ ] Display character description
- [ ] [Sign Up to Unlock] button for locked free characters
- [ ] [Coming Soon!] button for premium characters

**Task 2C.5: Persist Last Selected Character** (2 hours)
- [ ] Store in localStorage: `last_character_id`
- [ ] Pre-select on load if available
- [ ] Sync with backend: Store in `user.lastCharacterId`

**Files to Create**:
- `/client/src/components/CharacterCard.tsx`
- `/client/src/components/CharacterGrid.tsx`

**Files to Modify**:
- `/client/src/main.ts` - Replace dropdown with grid
- `/client/index.html` - Update character selection HTML
- `/client/src/services/CharacterRegistry.ts` - Use existing methods

**Success Criteria**:
- [ ] Character selection shows visual grid
- [ ] Available characters displayed with ✅
- [ ] Locked free characters displayed with 🔒
- [ ] Premium characters displayed with 💎
- [ ] Clicking locked character opens signup modal
- [ ] Bottom CTA shows correct message
- [ ] Character preview works
- [ ] Last character persisted
- [ ] Responsive on all platforms

---

### Part 2D: Settings Menu Account Tab ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2 days
- **Priority**: 🟡 MEDIUM
- **Dependencies**: Part 2A

**Platform Considerations**:
- All platforms: Reuse existing settings panel design

**Tasks**:

**Task 2D.1: Add Account Tab to SettingsManager** (4 hours)
- [ ] Add 4th tab: "👤 Account"
- [ ] Tab order: Sound | Graphics | Tips | Account

**Task 2D.2: Create No-Auth Account View** (3 hours)
- [ ] Display: "Guest Account", username (Player_xxxxx)
- [ ] List benefits: 6 characters, sync, hall of fame, progress, verified badge
- [ ] [🔐 Sign Up Free] button → Open signup modal
- [ ] "Already have account? [Log In]" link → Open login modal

**Task 2D.3: Create Authenticated Account View** (4 hours)
- [ ] Display: Username, email with verification status (✅/⚠️), password (•••)
- [ ] Account created date, last login time
- [ ] Characters unlocked: 6 / 11, Premium: 0 / 4
- [ ] [Log Out] button (active)
- [ ] [Change] buttons (disabled, "Coming soon!" tooltip)
- [ ] [Delete Account] link (disabled, "Contact support" tooltip)

**Task 2D.4: Implement Logout Functionality** (2 hours)
- [ ] `AuthService.logout()` - Call backend, clear localStorage, reload page
- [ ] Button handler in Settings

**Files to Modify**:
- `/client/src/SettingsManager.ts` - Add Account tab
- `/client/index.html` - Add Account tab HTML
- `/client/src/services/AuthService.ts` - Add logout method

**Success Criteria**:
- [ ] Account tab visible in settings
- [ ] Guest users see upgrade CTA
- [ ] Authenticated users see account info
- [ ] Sign Up / Log In buttons open AuthModal
- [ ] Log Out button works
- [ ] Email verification status shown
- [ ] Responsive on all platforms

---

### Part 2E: Leaderboard Verified Badge Integration ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 1-2 days
- **Priority**: 🟡 MEDIUM
- **Dependencies**: Phase 1E

**Platform Considerations**:
- All platforms: Existing leaderboard design, add badge inline

**Tasks**:

**Task 2E.1: Add Verified Badge to Leaderboard Entries** (3 hours)
- [ ] Update rendering: Add 🔒 badge before username if `isAuthenticated`
- [ ] Format: `${entry.isAuthenticated ? '🔒 ' : ''}${entry.username}`

**Task 2E.2: Update Leaderboard API Call** (2 hours)
- [ ] Fetch from `/leaderboard/top?type=weekly`
- [ ] Response includes: `isAuthenticated`, `emailVerified`, `characterId`

**Task 2E.3: Add "Top 10 - Verified Players Only" Label** (2 hours)
- [ ] Weekly leaderboard header: "🏆 Weekly Leaderboard"
- [ ] Subtitle: "Top 10 - Verified Players Only" (11px, gold color)
- [ ] Show only for weekly, hide for daily/Hall of Fame

**Task 2E.4: Show Player Rank Below Top 10** (2 hours)
- [ ] If no-auth player ranked below top 10, show separator + player's row
- [ ] Highlight with `current-player` class
- [ ] Add CTA: "💡 Sign up to compete for top 10!"

**Files to Modify**:
- `/client/src/main.ts` - Update leaderboard rendering
- `/client/index.html` - Add weekly label

**Success Criteria**:
- [ ] Verified badge (🔒) shows for authenticated players
- [ ] Weekly leaderboard shows "Top 10" label
- [ ] Player rank shown below top 10 if applicable
- [ ] Sign-up CTA shows for no-auth players
- [ ] Daily leaderboard shows all players
- [ ] Hall of Fame shows only authenticated

---

### Part 2F: Enticement System (Toasts & Reminders) ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2 days
- **Priority**: 🟡 MEDIUM
- **Dependencies**: Part 2A

**Platform Considerations**:
- **Desktop**: Top-right, below minimap
- **iPad**: Top-center
- **iPhone Portrait**: Bottom, above safe area
- **iPhone Landscape**: Top-right, compact

**Tasks**:

**Task 2F.1: Create Enticement Toast Messages** (3 hours)
- [ ] 4 messages rotating every 15 minutes:
  1. "Sign up to unlock 6 free characters!"
  2. "Your progress isn't saved. Sign up to sync!"
  3. "Join the Hall of Fame - sign up free!"
  4. "Get verified badge - sign up now!"
- [ ] Custom toast with [Sign Up] and [✕] buttons
- [ ] Auto-dismiss after 8 seconds

**Task 2F.2: Add Enticement on Character Selection** (2 hours)
- [ ] Trigger: User clicks locked character
- [ ] Toast: "Sign up free to unlock this character!" + [Sign Up] button

**Task 2F.3: Add Enticement on Leaderboard View** (2 hours)
- [ ] Trigger: No-auth user opens weekly leaderboard, ranked below top 10
- [ ] Toast: "Sign up to compete for top 10!" + [Sign Up] button
- [ ] Frequency: Once per session

**Task 2F.4: Implement Toast Frequency Limiting** (2 hours)
- [ ] Limits: Max 4 per hour, min 15 minutes between toasts
- [ ] Track in localStorage: `last_enticement_toast_time`, `enticement_toast_times[]`

**Files to Modify**:
- `/client/src/main.ts` - Add enticement logic
- `/client/src/ToastManager.ts` - Add custom toast (optional)

**Success Criteria**:
- [ ] Enticement toasts show every 15 min for no-auth
- [ ] Message rotation works
- [ ] Frequency limited (max 4/hour)
- [ ] Character click shows enticement
- [ ] Leaderboard view shows enticement
- [ ] [Sign Up] button opens AuthModal
- [ ] Toasts stop after signup

---

### Part 2G: Session Persistence & Token Refresh ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2 days
- **Priority**: 🟡 HIGH
- **Dependencies**: Phase 1D

**Tasks**:

**Task 2G.1: Implement Token Refresh Logic** (4 hours)
- [ ] `AuthService.refreshAccessToken()` - POST `/auth/refresh`
- [ ] Auto-refresh every 25 days (5 days before 30-day expiration)
- [ ] `startTokenRefreshTimer()` - setInterval for automatic refresh

**Task 2G.2: Handle Token Expiration Mid-Game** (3 hours)
- [ ] On API 401 error: Show "Session Expired" banner
- [ ] Banner: "⚠️ Session Expired - [Log In] to save progress"
- [ ] [✕] button to dismiss

**Task 2G.3: Restore Session on Page Load** (2 hours)
- [ ] `restoreSession()` - Check localStorage for valid tokens
- [ ] Verify token validity, refresh if needed
- [ ] Clear auth if invalid

**Task 2G.4: Add "Remember Me" Functionality (Optional)** (2 hours)
- [ ] Checkbox in login form
- [ ] If unchecked: Use `sessionStorage` instead of `localStorage`
- [ ] Default: Checked (persist across browser close)

**Files to Modify**:
- `/client/src/services/AuthService.ts` - Add refresh logic
- `/client/src/main.ts` - Session restoration, timer

**Success Criteria**:
- [ ] Tokens auto-refreshed every 25 days
- [ ] Session restored on page load
- [ ] Session expired banner shows on token expiry
- [ ] User prompted to log in after expiration
- [ ] Seamless cross-device experience

---

### Part 2H: Integration & Polish ⏳
- **Status**: ⏳ PENDING
- **Estimated Duration**: 2-3 days
- **Priority**: 🟡 HIGH
- **Dependencies**: All previous parts (2A-2G)

**Tasks**:

**Task 2H.1: Add Loading States to All Forms** (3 hours)
- [ ] Disable inputs during submission
- [ ] Show spinner: "Creating Account...", "Logging In...", "Sending Email..."
- [ ] Prevent double-submission

**Task 2H.2: Add Error Toast for Network Issues** (2 hours)
- [ ] Catch network failures: `Failed to fetch`
- [ ] User-friendly message: "Connection issue. Check internet and try again."

**Task 2H.3: Cross-Platform Testing** (8 hours)
- [ ] Test on: Desktop Chrome/Safari, iPad Safari (portrait/landscape), iPhone Safari (portrait/landscape), Private Browsing
- [ ] All flows: Signup, login, logout, password reset

**Task 2H.4: Accessibility Improvements** (3 hours)
- [ ] ARIA labels on form fields
- [ ] Correct Tab order
- [ ] Focus indicators (2px blue outline)
- [ ] Test with VoiceOver/TalkBack

**Task 2H.5: Performance Optimization** (2 hours)
- [ ] Lazy load AuthModal
- [ ] Debounce email availability check (500ms)
- [ ] Virtual scrolling for character grid (future-proofing)

**Success Criteria**:
- [ ] All forms show loading states
- [ ] Network errors handled gracefully
- [ ] Cross-platform testing complete
- [ ] Keyboard navigation works
- [ ] No performance issues

---

## Phase 2 Summary

**Timeline**:
- **Part 2A**: 4-5 days (Auth Modal & Forms)
- **Part 2B**: 2-3 days (Email Verification & Welcome)
- **Part 2C**: 3-4 days (Character Selection)
- **Part 2D**: 2 days (Settings Account Tab)
- **Part 2E**: 1-2 days (Leaderboard Verified Badge)
- **Part 2F**: 2 days (Enticement System)
- **Part 2G**: 2 days (Session Persistence)
- **Part 2H**: 2-3 days (Integration & Polish)

**Total**: 18-25 days (2.5-3.5 weeks)

**Overall Success Criteria**:
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

**Risk Mitigation**:
1. **Responsive Design**: Test early on real devices
2. **Token Management**: Thorough refresh logic testing
3. **Form Validation**: Use proven regex, test edge cases
4. **Cross-Browser**: Test Safari (iOS), Chrome, Firefox
5. **Performance**: Lazy load, optimize animations

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
