# Authentication Technical Approach - Hidden Walnuts MVP 16

**Document Version**: 1.0
**Created**: 2025-11-04
**Status**: Architecture & Design Phase
**Branch**: mvp-simple-16

---

## Executive Summary

This document outlines the technical architecture for implementing full email/password authentication in Hidden Walnuts MVP 16, while maintaining the existing no-authentication quick-play option. The approach leverages existing Cloudflare infrastructure and NameCheap Private Email for a cost-effective, scalable solution.

**Key Decisions**:
- **Email Service**: NameCheap Private Email via SMTP (already owned, 2GB/hour sending limit)
- **Password Security**: bcrypt hashing (cost factor 12)
- **Session Management**: JWT access tokens (30-day expiration) + refresh tokens (90-day)
- **Character Gating**: 1 character (Squirrel) for no-auth, 6 characters for authenticated free, 4 premium
- **Storage**: Cloudflare Durable Objects (PlayerIdentity) + KV (email uniqueness index)

---

## 1. Email Sending Solution

### 1.1 NameCheap Private Email (SELECTED)

**Why NameCheap?**
- ✅ Already own hiddenwalnuts.com with Private Email configured
- ✅ No additional cost (included in existing plan)
- ✅ Industry-standard SMTP protocol (reliable, well-documented)
- ✅ Sufficient sending limits: 2GB/hour per domain (~20,000 emails/hour)
- ✅ Simple setup: Create mailbox, use SMTP credentials

**SMTP Configuration**:
```typescript
{
  host: 'mail.privateemail.com',
  port: 465,              // SSL
  secure: true,           // Use SSL
  auth: {
    user: 'noreply@hiddenwalnuts.com',
    pass: process.env.SMTP_PASSWORD
  }
}
```

**Alternative Ports**:
- Port 587 with TLS/STARTTLS (also supported)
- Port 465 with SSL (recommended for Cloudflare Workers)

### 1.2 Setup Steps

1. **Create Email Account** (via NameCheap Dashboard):
   - Mailbox: `noreply@hiddenwalnuts.com`
   - Purpose: Sending transactional emails (verification, password reset)
   - Password: Strong password (store in Cloudflare secrets)

2. **Install nodemailer for Cloudflare Workers**:
   ```bash
   cd workers
   npm install nodemailer
   npm install @types/nodemailer --save-dev
   ```

3. **Store SMTP Credentials as Secrets**:
   ```bash
   # Preview environment
   wrangler secret put SMTP_USER --name hidden-walnuts-api-preview
   wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api-preview

   # Production environment
   wrangler secret put SMTP_USER --name hidden-walnuts-api
   wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api
   ```

4. **DNS Verification** (Already Configured):
   - SPF: `v=spf1 include:_spf.privateemail.com ~all`
   - DKIM: Configured via NameCheap
   - DMARC: `v=DMARC1; p=none; rua=mailto:admin@hiddenwalnuts.com`

### 1.3 Email Service Implementation

**File**: `/workers/services/EmailService.ts` (NEW)

```typescript
import nodemailer from 'nodemailer';

export interface EmailServiceConfig {
  smtpUser: string;
  smtpPassword: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(config: EmailServiceConfig) {
    this.transporter = nodemailer.createTransport({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword
      }
    });
  }

  async sendVerificationEmail(
    email: string,
    username: string,
    token: string
  ): Promise<boolean> {
    const verificationUrl = `https://hiddenwalnuts.com/verify?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: '"Hidden Walnuts" <noreply@hiddenwalnuts.com>',
        to: email,
        subject: 'Verify your Hidden Walnuts account',
        html: `
          <h2>Welcome to Hidden Walnuts, ${username}!</h2>
          <p>Click the link below to verify your email address:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>This link expires in 24 hours.</p>
          <p>If you didn't create this account, you can safely ignore this email.</p>
          <br>
          <p>Happy walnut hunting!</p>
          <p>The Hidden Walnuts Team</p>
        `
      });
      return true;
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(
    email: string,
    username: string,
    token: string
  ): Promise<boolean> {
    const resetUrl = `https://hiddenwalnuts.com/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: '"Hidden Walnuts" <noreply@hiddenwalnuts.com>',
        to: email,
        subject: 'Reset your Hidden Walnuts password',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${username},</p>
          <p>We received a request to reset your password. Click the link below:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>This link expires in 1 hour.</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <br>
          <p>The Hidden Walnuts Team</p>
        `
      });
      return true;
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return false;
    }
  }

  async sendWelcomeEmail(
    email: string,
    username: string
  ): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: '"Hidden Walnuts" <noreply@hiddenwalnuts.com>',
        to: email,
        subject: 'Welcome to Hidden Walnuts!',
        html: `
          <h2>Welcome to Hidden Walnuts, ${username}!</h2>
          <p>Your account is now verified! You now have access to:</p>
          <ul>
            <li><strong>6 characters</strong> (Squirrel, Hare, Goat, Chipmunk, Turkey, Mallard)</li>
            <li><strong>Cross-device sync</strong> - Play on any device</li>
            <li><strong>Hall of Fame leaderboard</strong> - Compete for all-time glory</li>
            <li><strong>Progress tracking</strong> - Your stats are saved forever</li>
          </ul>
          <p><a href="https://hiddenwalnuts.com">Start playing now!</a></p>
          <br>
          <p>Happy walnut hunting!</p>
          <p>The Hidden Walnuts Team</p>
        `
      });
      return true;
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return false;
    }
  }
}
```

### 1.4 Sending Limits & Monitoring

**NameCheap Limits**:
- 2GB/hour per domain (~20,000 emails/hour assuming 100KB per email)
- 50 recipients per email (TO + CC + BCC combined)
- No explicit daily limit (hourly quota resets)

**MVP 16 Expected Usage**:
- Initial: <10 signups/day = ~30 emails/day (verification + password reset + welcome)
- Month 3: ~50 signups/day = ~150 emails/day
- Month 6: ~100 signups/day = ~300 emails/day
- **Verdict**: NameCheap limits more than sufficient

**Monitoring**:
- Log all email send attempts (success/failure) to Cloudflare Durable Object
- Alert if daily failures exceed 10% of attempts
- Track bounce rates (check NameCheap dashboard weekly)

---

## 2. Password Security Strategy

### 2.1 Hashing Algorithm: bcrypt

**Library**: `@tsndr/cloudflare-worker-bcrypt` (Cloudflare Workers compatible)

**Installation**:
```bash
cd workers
npm install @tsndr/cloudflare-worker-bcrypt
```

**Configuration**:
- **Cost Factor**: 12 (industry standard for 2025)
- **Salt**: Auto-generated per password (bcrypt includes salt in hash)
- **Hash Length**: 60 characters

**Example**:
```typescript
import bcrypt from '@tsndr/cloudflare-worker-bcrypt';

// Hash password
const passwordHash = await bcrypt.hash(plainPassword, 12);

// Verify password
const isValid = await bcrypt.compare(plainPassword, passwordHash);
```

### 2.2 Password Requirements

**Client-Side Validation**:
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- Optional: At least 1 special character (!@#$%^&*) - recommended but not required

**Server-Side Validation**:
- Same requirements as client-side (never trust client)
- Check against common password list (e.g., top 10,000 common passwords)
- Reject passwords that match username or email

**Common Password Check**:
```typescript
const COMMON_PASSWORDS = [
  'password', 'password123', '12345678', 'qwerty', 'abc123',
  'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
  'baseball', '111111', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123'
  // ... top 10,000 list (load from file or KV)
];

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.includes(password.toLowerCase());
}
```

### 2.3 Storage Schema

**PlayerIdentity Durable Object** (Enhanced):
```typescript
export interface PlayerIdentityData {
  // Existing fields (MVP 6)
  username: string;
  sessionTokens: string[];
  created: number;
  lastSeen: number;
  lastUsernameChange?: number;
  lastCharacterId?: string;

  // NEW: Authentication fields
  email?: string;                    // Email address (unique)
  passwordHash?: string;             // bcrypt hash (60 chars)
  emailVerified: boolean;            // Email verification status (default: false)
  emailVerificationToken?: string;   // Verification token (UUID v4)
  emailVerificationExpiry?: number;  // Token expiration (timestamp)
  passwordResetToken?: string;       // Password reset token (UUID v4)
  passwordResetExpiry?: number;      // Token expiration (timestamp)
  isAuthenticated: boolean;          // true if has password, false if no-auth
  accountCreated?: number;           // When authenticated account created
  lastPasswordChange?: number;       // Rate limiting for password changes

  // NEW: Character entitlements
  unlockedCharacters: string[];      // Character IDs (e.g., ['squirrel', 'hare', 'goat'])

  // NEW: Session tracking
  authTokens: {                      // JWT auth tokens
    token: string;
    created: number;
    expiresAt: number;
    deviceInfo?: string;             // User agent string
  }[];
}
```

**Email Uniqueness Index** (Cloudflare KV):
- Key: `email:{lowercase_email}` (e.g., `email:user@example.com`)
- Value: `username` (e.g., `"Player123"`)
- Purpose: Fast lookup to prevent duplicate emails

---

## 3. Session Management & JWT Tokens

### 3.1 JWT Token Strategy

**Library**: `jsonwebtoken` (standard Node.js library, works with Cloudflare Workers)

**Installation**:
```bash
cd workers
npm install jsonwebtoken
npm install @types/jsonwebtoken --save-dev
```

**Token Types**:

1. **Access Token** (Short-lived):
   - **Expiration**: 30 days (browser games need longer sessions than banking apps)
   - **Storage**: localStorage (client-side)
   - **Purpose**: Authenticate API requests
   - **Payload**:
     ```typescript
     {
       userId: string;        // Username
       email: string;
       isAuthenticated: boolean;
       emailVerified: boolean;
       iat: number;           // Issued at
       exp: number;           // Expires at
     }
     ```

2. **Refresh Token** (Long-lived):
   - **Expiration**: 90 days
   - **Storage**: HttpOnly cookie (more secure than localStorage)
   - **Purpose**: Obtain new access token when expired
   - **Payload**:
     ```typescript
     {
       userId: string;
       tokenId: string;       // Unique token ID (for revocation)
       iat: number;
       exp: number;
     }
     ```

**JWT Secret**:
```bash
# Generate secure secret (32-byte random string)
openssl rand -base64 32

# Store as Cloudflare secret
wrangler secret put JWT_SECRET --name hidden-walnuts-api-preview
wrangler secret put JWT_SECRET --name hidden-walnuts-api
```

### 3.2 AuthService Implementation

**File**: `/workers/services/AuthService.ts` (NEW)

```typescript
import jwt from 'jsonwebtoken';
import { PlayerIdentityData } from '../objects/PlayerIdentity';

export interface JWTPayload {
  userId: string;
  email: string;
  isAuthenticated: boolean;
  emailVerified: boolean;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  exp: number;
}

export class AuthService {
  constructor(private jwtSecret: string) {}

  generateAccessToken(userData: PlayerIdentityData): string {
    const payload: JWTPayload = {
      userId: userData.username,
      email: userData.email || '',
      isAuthenticated: userData.isAuthenticated,
      emailVerified: userData.emailVerified,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  generateRefreshToken(userData: PlayerIdentityData): string {
    const tokenId = crypto.randomUUID();
    const payload: RefreshTokenPayload = {
      userId: userData.username,
      tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  verifyAccessToken(token: string): { valid: boolean; payload?: JWTPayload } {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return { valid: true, payload };
    } catch (error) {
      return { valid: false };
    }
  }

  verifyRefreshToken(token: string): { valid: boolean; payload?: RefreshTokenPayload } {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as RefreshTokenPayload;
      return { valid: true, payload };
    } catch (error) {
      return { valid: false };
    }
  }

  async refreshAccessToken(
    refreshToken: string,
    getPlayerData: (username: string) => Promise<PlayerIdentityData | null>
  ): Promise<{ accessToken: string } | null> {
    const { valid, payload } = this.verifyRefreshToken(refreshToken);
    if (!valid || !payload) return null;

    // Fetch latest user data
    const userData = await getPlayerData(payload.userId);
    if (!userData) return null;

    // Generate new access token
    const accessToken = this.generateAccessToken(userData);
    return { accessToken };
  }
}
```

### 3.3 Cross-Device Sync Architecture

**How It Works**:
1. User logs in on **Device A** → Receives access token + refresh token
2. User logs in on **Device B** → Receives different access token + refresh token
3. Both devices can make authenticated API requests simultaneously
4. PlayerIdentity DO tracks multiple `authTokens[]` (one per device)

**Logout Behavior**:
- **Logout from current device**: Invalidate current device's tokens only
- **Logout from all devices**: Clear all `authTokens[]` array

**Token Rotation** (Security Best Practice):
- When access token expires, use refresh token to get new access token
- Optionally: Generate new refresh token each time (token rotation)
- Old refresh token becomes invalid after use

**Session Expiration Handling**:
- Client checks access token expiration before each API call
- If expired, attempt refresh using refresh token
- If refresh fails, redirect to login screen
- Don't crash game mid-session - gracefully handle re-auth

---

## 4. Character Gating System

### 4.1 Character Allocation (Corrected)

Based on actual `characters.json` file (11 characters total):

**No-Auth Players** (1 character):
- **Squirrel** 🐿️ - "Agile forest dweller, most expressive animations"

**Authenticated Free Players** (6 characters):
1. **Squirrel** 🐿️ (starter, included in no-auth)
2. **Hare** 🐇 - "Swift speedster"
3. **Goat** 🐐 - "Sure-footed climber"
4. **Chipmunk** 🐿️ - "Energetic hoarder" (thematic fit: chipmunks hoard!)
5. **Turkey** 🦃 - "Proud woodland bird"
6. **Mallard** 🦆 - "Graceful waterfowl"

**Unlockable Characters** (4 characters):
1. **Lynx** 🐈 - "Stealthy wildcat" (predator, exotic)
2. **Bear** 🐻 - "Powerful forest guardian" (large, impressive)
3. **Moose** 🫎 - "Majestic forest giant" (largest character)
4. **Badger** 🦡 - "Tenacious burrower" (unique)

**Future Consideration**:
- **Skunk** 🦨 - Could be seasonal (Halloween) or event reward

### 4.2 CharacterRegistry Enhancement

**File**: `/client/src/services/CharacterRegistry.ts` (MODIFY)

Add character tier logic:

```typescript
export class CharacterRegistry {
  // Character tier definitions
  static NO_AUTH_CHARACTERS = ['squirrel'];

  static FREE_AUTH_CHARACTERS = [
    'squirrel',
    'hare',
    'goat',
    'chipmunk',
    'turkey',
    'mallard'
  ];

  static PREMIUM_CHARACTERS = [
    'lynx',
    'bear',
    'moose',
    'badger'
  ];

  // Check if character is available to user
  static isCharacterAvailable(
    characterId: string,
    isAuthenticated: boolean,
    unlockedCharacters: string[]
  ): boolean {
    // No-auth users: only squirrel
    if (!isAuthenticated) {
      return this.NO_AUTH_CHARACTERS.includes(characterId);
    }

    // Authenticated users: free characters + unlocked premium
    return (
      this.FREE_AUTH_CHARACTERS.includes(characterId) ||
      unlockedCharacters.includes(characterId)
    );
  }

  // Get available characters for user
  static getAvailableCharacters(
    isAuthenticated: boolean,
    unlockedCharacters: string[]
  ): CharacterDefinition[] {
    return this.characters.filter(char =>
      this.isCharacterAvailable(char.id, isAuthenticated, unlockedCharacters)
    );
  }

  // Get character tier (for UI display)
  static getCharacterTier(characterId: string): 'no-auth' | 'free' | 'premium' {
    if (this.NO_AUTH_CHARACTERS.includes(characterId)) return 'no-auth';
    if (this.FREE_AUTH_CHARACTERS.includes(characterId)) return 'free';
    return 'premium';
  }

  // Get premium character price
  static getCharacterPrice(characterId: string): number | null {
    // MVP 17 TODO: Implement dynamic pricing
    if (!this.PREMIUM_CHARACTERS.includes(characterId)) return null;
    return 0; // Free
  }
}
```

### 4.3 Character Unlock Flow

**Initial Account Creation**:
```typescript
// When user signs up
const initialCharacters = CharacterRegistry.FREE_AUTH_CHARACTERS;
playerData.unlockedCharacters = [...initialCharacters];
```

**Character Purchase** (MVP 17):
```typescript
// When user purchases premium character
async function unlockCharacter(
  username: string,
  characterId: string,
  paymentToken: string
): Promise<boolean> {
  // 1. Verify payment via Stripe
  // 2. Add characterId to unlockedCharacters[]
  // 3. Save to PlayerIdentity DO
  // 4. Return success
}
```

---

## 5. Leaderboard Integration

### 5.1 Leaderboard Strategy (Corrected)

**Daily Leaderboard**:
- ✅ No-auth players allowed
- ✅ Authenticated players allowed
- **Display**: Authenticated players show "🔒 Verified" badge
- **Rationale**: Short-term competition, low stakes

**Weekly Leaderboard**:
- ✅ No-auth players allowed
- ✅ Authenticated players allowed
- **Restriction**: Top 10 restricted to authenticated players only
- **Display**: Authenticated players show "🔒 Verified" badge
- **Rationale**: Creates enticement for no-auth users to sign up

**Hall of Fame (All-Time)**:
- ❌ No-auth players NOT allowed
- ✅ Authenticated players ONLY
- **Rationale**: Long-term leaderboard requires commitment/verification

### 5.2 Leaderboard Entry Schema

**File**: `/workers/objects/Leaderboard.ts` (MODIFY)

```typescript
interface LeaderboardEntry {
  username: string;
  score: number;
  timestamp: number;

  // NEW: Authentication status
  isAuthenticated: boolean;
  emailVerified: boolean;

  // NEW: Display info
  characterId: string;
}

// Filter logic for Hall of Fame
function getHallOfFameEntries(): LeaderboardEntry[] {
  return allEntries.filter(entry => entry.isAuthenticated);
}

// Filter logic for Weekly Top 10
function getWeeklyTop10(): LeaderboardEntry[] {
  const top10 = getWeeklyEntries()
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Only show authenticated players in top 10
  return top10.filter(entry => entry.isAuthenticated);
}
```

### 5.3 Client-Side Display

**Leaderboard UI**:
```typescript
function renderLeaderboardEntry(entry: LeaderboardEntry): string {
  const verifiedBadge = entry.isAuthenticated ? '🔒' : '';
  const usernameDisplay = entry.isAuthenticated
    ? entry.username
    : `Guest_${entry.username.slice(0, 6)}`;

  return `
    <div class="leaderboard-entry">
      <span class="rank">#${entry.rank}</span>
      <span class="username">
        ${verifiedBadge} ${usernameDisplay}
      </span>
      <span class="score">${entry.score} pts</span>
    </div>
  `;
}
```

---

## 6. Cloudflare Infrastructure

### 6.1 Durable Objects

**PlayerIdentity DO**:
- **Purpose**: Store user authentication data, character entitlements, session tokens
- **Storage**: SQL-backed Durable Object (persistent)
- **Key**: Username (unique identifier)
- **Cost**: Free tier includes 1M DO requests/month, 400K GB-seconds/month

**New Methods to Add**:
```typescript
// Signup
async signup(email: string, username: string, password: string): Promise<Result>

// Login
async login(email: string, password: string): Promise<{ accessToken, refreshToken }>

// Email verification
async verifyEmail(token: string): Promise<boolean>

// Password reset
async requestPasswordReset(email: string): Promise<boolean>
async resetPassword(token: string, newPassword: string): Promise<boolean>

// Session management
async invalidateToken(tokenId: string): Promise<void>
async invalidateAllTokens(): Promise<void>
```

### 6.2 KV Namespaces

**Email Uniqueness Index**:
- **Namespace**: `EMAIL_INDEX` (new)
- **Key Format**: `email:{email}` (e.g., `email:user@example.com`)
- **Value**: Username
- **Purpose**: Fast lookup to prevent duplicate emails
- **TTL**: No expiration (permanent)

**Create KV Namespace**:
```bash
npx wrangler kv:namespace create "EMAIL_INDEX"
npx wrangler kv:namespace create "EMAIL_INDEX" --preview
```

**Add to wrangler.toml**:
```toml
[[kv_namespaces]]
binding = "EMAIL_INDEX"
id = "YOUR_KV_NAMESPACE_ID"  # From create command
preview_id = "YOUR_PREVIEW_KV_ID"
```

### 6.3 Secrets Management

**Secrets to Create**:
```bash
# SMTP credentials
wrangler secret put SMTP_USER --name hidden-walnuts-api-preview
wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api-preview

# JWT secret (generate with: openssl rand -base64 32)
wrangler secret put JWT_SECRET --name hidden-walnuts-api-preview

# Repeat for production
wrangler secret put SMTP_USER --name hidden-walnuts-api
wrangler secret put SMTP_PASSWORD --name hidden-walnuts-api
wrangler secret put JWT_SECRET --name hidden-walnuts-api
```

**Access in Worker**:
```typescript
export interface Env {
  // Existing bindings
  SQUIRREL: DurableObjectNamespace;
  FOREST: DurableObjectNamespace;
  LEADERBOARD: DurableObjectNamespace;
  PLAYER_IDENTITY: DurableObjectNamespace;

  // NEW: Email & Auth
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  JWT_SECRET: string;
  EMAIL_INDEX: KVNamespace;
}
```

---

## 7. Security Considerations

### 7.1 Password Security Checklist

- ✅ bcrypt hashing (cost factor 12)
- ✅ Client-side + server-side validation
- ✅ Common password check
- ✅ Password ≠ username or email
- ✅ Minimum 8 characters
- ✅ Character diversity (uppercase, lowercase, number)

### 7.2 Rate Limiting

**Authentication Endpoints**:
- **Login**: 5 attempts per hour per email
- **Signup**: 1 signup per email per day
- **Password Reset**: 3 reset emails per hour per email
- **Email Verification Resend**: 3 resends per hour per email

**Implementation** (using existing RATE_LIMITER binding):
```typescript
// Check rate limit before processing
const rateLimitKey = `auth:login:${email}`;
const rateLimit = await env.RATE_LIMITER.limit({ key: rateLimitKey });

if (!rateLimit.success) {
  return new Response('Too many login attempts. Try again later.', { status: 429 });
}
```

### 7.3 Token Security

**JWT Signing**:
- Strong secret (32-byte random string)
- HS256 algorithm (HMAC with SHA-256)
- Verify signature on every request
- Reject tampered tokens

**Token Expiration**:
- Access token: 30 days (reasonable for browser game)
- Refresh token: 90 days (allows long-term cross-device sync)
- Email verification token: 24 hours
- Password reset token: 1 hour

**Token Revocation**:
- Logout: Remove token from `authTokens[]` array
- Password change: Invalidate all existing tokens
- Track token usage (last used timestamp)

### 7.4 Email Verification

**Why Required?**:
- Prevent spam accounts
- Enable password recovery
- Verify email ownership
- Prevent email typos during signup

**Flow**:
1. User signs up → Account created but `emailVerified: false`
2. Verification email sent with unique token (UUID v4)
3. User clicks link → Token validated → `emailVerified: true`
4. Welcome email sent after verification

**Benefits After Verification**:
- Unlock 6 characters (already available, but reinforces value)
- Access to Hall of Fame leaderboard
- Password recovery enabled
- Reduce spam/bot accounts

---

## 8. Migration Strategy for Existing Users

### 8.1 Current User Base

**Existing Users** (MVP 6 - Username system only):
- Have username (no password)
- Have session tokens
- Have character selection (unrestricted currently)
- Have leaderboard entries

**Migration Goal**:
- All existing users become "no-auth" users
- Prompt to "upgrade" by adding email/password
- Preserve username, score, progress

### 8.2 Migration Steps

**Phase 1: Data Migration** (Backend):
```typescript
// Add default values to existing PlayerIdentity records
async function migrateExistingUsers() {
  // For each existing PlayerIdentity DO:
  playerData.isAuthenticated = false;           // No email/password yet
  playerData.emailVerified = false;
  playerData.unlockedCharacters = ['squirrel']; // No-auth default
}
```

**Phase 2: UI Migration** (Frontend):
- Show "Upgrade to Full Account" banner for no-auth users
- Character selection screen shows 10 locked characters
- Leaderboard shows "Upgrade to appear on Hall of Fame" message

**Phase 3: Incentive** (Optional):
- One-time bonus for upgrading: "Add email/password and get 100 bonus points!"
- Limited-time offer: "Upgrade by Nov 30 and unlock 6 characters for free!"

### 8.3 Backward Compatibility

**No-Auth Login Flow** (Preserved):
```typescript
// User enters username only (no password)
// Backend checks: If username exists and !isAuthenticated
// → Allow login as no-auth user
// → Character restricted to Squirrel
```

**Upgrade Flow**:
```typescript
// No-auth user clicks "Add Email & Password"
// → Show email/password form
// → Validate & create password
// → Send verification email
// → Unlock 6 characters after verification
```

---

## 9. Cost Analysis

### 9.1 NameCheap Private Email

**Current Cost**: Included in existing NameCheap plan
- No additional cost for SMTP sending
- 2GB/hour sending limit
- **Monthly Cost**: $0 (already owned)

### 9.2 Cloudflare Workers

**Estimated Costs** (1,000 authenticated users):
- **DO Requests**: 1M free/month (sufficient for MVP 16)
- **KV Reads**: 10M free/month (email uniqueness checks)
- **KV Writes**: 1M free/month (email index writes)
- **Worker Invocations**: 100K free/day (sufficient)
- **Monthly Cost**: $0 (within free tier)

### 9.3 Total MVP 16 Cost

**Infrastructure**: $0/month (within free tiers)
- NameCheap Private Email: $0 (already owned)
- Cloudflare Workers: $0 (free tier)
- Cloudflare Durable Objects: $0 (free tier)
- Cloudflare KV: $0 (free tier)

**Cost Scaling** (10,000 users):
- Cloudflare Workers: ~$5-10/month (exceeds free tier)
- Still very cost-effective compared to dedicated services

---

## 10. Testing Strategy

### 10.1 Email Testing

**Development**:
- Use Mailtrap or similar for testing (catches emails, doesn't send)
- Or: Create test@hiddenwalnuts.com mailbox for receiving test emails

**Staging/Preview**:
- Use real NameCheap SMTP
- Send to test email addresses only
- Verify deliverability (inbox vs spam folder)

**Production**:
- Monitor bounce rates via NameCheap dashboard
- Test with Gmail, Outlook, Yahoo, ProtonMail
- Check SPF/DKIM/DMARC headers

### 10.2 Security Testing

**Password Hashing**:
- Verify bcrypt cost factor (should take ~200-300ms to hash)
- Ensure password not stored in plaintext (inspect DO storage)
- Test password comparison (correct vs incorrect)

**Rate Limiting**:
- Attempt 6 logins in 1 hour → Should be rate limited
- Attempt 2 signups with same email in 1 day → Should fail

**JWT Validation**:
- Tamper with token signature → Should reject
- Use expired token → Should reject
- Use revoked token → Should reject

### 10.3 Cross-Device Sync Testing

**Test Scenarios**:
1. Login on Desktop → Select character → Login on Mobile → Verify same character
2. Logout on Desktop → Verify still logged in on Mobile
3. Change password on Desktop → Verify forced logout on Mobile
4. Unlock premium character on Mobile → Verify available on Desktop

---

## 11. Next Steps

### Immediate Actions

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

5. **Begin Implementation** (Phase 1 - Technical)
   - Create EmailService.ts
   - Create AuthService.ts
   - Enhance PlayerIdentity.ts with authentication methods
   - Add character gating logic to CharacterRegistry.ts

---

## 12. References

**NameCheap Documentation**:
- SMTP Configuration: https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/
- Sending Limits: https://www.namecheap.com/support/knowledgebase/article.aspx/10719/2179/

**Security Best Practices**:
- OWASP Authentication Cheat Sheet
- NIST Password Guidelines (SP 800-63B)
- JWT Best Practices (RFC 8725)

**Cloudflare Documentation**:
- Durable Objects: https://developers.cloudflare.com/durable-objects/
- KV: https://developers.cloudflare.com/kv/
- Workers: https://developers.cloudflare.com/workers/

---

**Document Status**: ✅ READY FOR IMPLEMENTATION
**Next Document**: Authentication_UX_Design.md (UX flows and wireframes)
**Last Updated**: 2025-11-04
