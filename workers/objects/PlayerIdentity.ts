import { DurableObject } from 'cloudflare:workers';
import { PasswordUtils } from '../utils/PasswordUtils';
import { TokenGenerator } from '../utils/TokenGenerator';
import { EmailService } from '../services/EmailService';
import { generateTokenPair, generateTokenId, verifyRefreshToken } from '../services/AuthService';
import type { EnvWithBindings } from './registry';

/**
 * PlayerIdentityData - Stored data for each username
 * MVP 16: Enhanced with full authentication support
 */
export interface PlayerIdentityData {
  // Existing fields (MVP 6)
  username: string;
  sessionTokens: string[]; // Multiple sessions (different browsers/devices)
  created: number;
  lastSeen: number;
  lastUsernameChange?: number;
  lastCharacterId?: string; // Last selected character (for returning users)

  // NEW: Authentication fields (MVP 16)
  email?: string;                     // Email address (unique)
  passwordHash?: string;              // bcrypt hash (60 chars, cost factor 12)
  emailVerified: boolean;             // Email verification status (default: false)
  emailVerificationToken?: string;    // Verification token (UUID v4)
  emailVerificationExpiry?: number;   // Token expiration timestamp (24 hours)
  passwordResetToken?: string;        // Password reset token (UUID v4)
  passwordResetExpiry?: number;       // Token expiration timestamp (1 hour)
  isAuthenticated: boolean;           // true if has email/password, false if no-auth
  accountCreated?: number;            // When authenticated account created
  lastPasswordChange?: number;        // Timestamp of last password change

  // NEW: Character entitlements (MVP 16)
  unlockedCharacters: string[];       // Array of character IDs ['squirrel', 'hare', ...]

  // NEW: Session tracking (MVP 16)
  authTokens: {                       // JWT auth tokens (multiple devices)
    tokenId: string;                  // Unique token ID (for revocation)
    created: number;                  // Creation timestamp
    expiresAt: number;                // Expiration timestamp
    deviceInfo?: string;              // User agent string
    lastUsed?: number;                // Last used timestamp
  }[];

  // MVP 16: Persistent Game Stats
  score: number;          // Current score (persisted)
  titleId: string;        // Rank ID
  titleName: string;      // Rank Name
}

/**
 * PlayerIdentity - Durable Object for username → identity mapping
 *
 * MVP 6: Player Authentication & Identity (Fixed for Private Browsing)
 * MVP 16: Enhanced with full email/password authentication
 *
 * Design:
 * - One DO instance per USERNAME (not sessionToken)
 * - Stores: username, sessionTokens[], created, lastSeen
 * - Multiple sessionTokens per username (different browsers/devices)
 * - Works in private browsing: same username = same identity
 * - Rate limiting: 1 username change per hour
 * - MVP 16: Email/password authentication, JWT tokens, character gating
 */
export class PlayerIdentity extends DurableObject {
  protected env: EnvWithBindings;

  constructor(ctx: DurableObjectState, env: EnvWithBindings) {
    super(ctx, env);
    this.env = env;
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    try {
      switch (action) {
        case 'check':
          return await this.handleCheck(request);

        case 'set':
          return await this.handleSet(request);

        case 'update':
          return await this.handleUpdate(request);

        case 'updateCharacter':
          return await this.handleUpdateCharacter(request);

        case 'updateStats':
          return await this.handleUpdateStats(request);

        case 'getStats':
          return await this.handleGetStats(request);

        // MVP 16: Authentication methods
        case 'signup':
          return await this.handleSignup(request);

        case 'login':
          return await this.handleLogin(request);

        case 'verifyEmail':
          return await this.handleVerifyEmail(request);

        case 'requestPasswordReset':
          return await this.handleRequestPasswordReset(request);

        case 'resetPassword':
          return await this.handleResetPassword(request);

        case 'changePassword':
          return await this.handleChangePassword(request);

        case 'resend-verification':
          return await this.handleResendVerification(request);

        // MVP 16: Token management
        case 'refreshToken':
          return await this.handleRefreshToken(request);

        case 'logout':
          return await this.handleLogout(request);

        case 'logoutAll':
          return await this.handleLogoutAll(request);

        // Admin: Clear all storage for this identity (for testing)
        // case 'adminClear': // This case is now handled by an if block below
        //   return await this.handleAdminClear(request);

        default:
          // If action is not handled by switch, check admin actions
          break; // Exit switch to check admin actions
      }

      // Admin clear action
      if (action === 'adminClear') {
        const adminSecret = request.headers.get('X-Admin-Secret');
        // Note: In a real app, we'd validate the secret here too, but we trust the ForestManager
        // which has already validated it.

        // Get current data to return what we're clearing
        const data = await this.ctx.storage.get(['username', 'email']);

        // Clear all storage
        await this.ctx.storage.deleteAll();

        return new Response(JSON.stringify({
          success: true,
          message: 'Identity cleared',
          ...data
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // Admin verify action
      if (action === 'adminVerify') {
        const adminSecret = request.headers.get('X-Admin-Secret');

        // Get current data
        const data = await this.ctx.storage.get(['username', 'email', 'emailVerified']) as Map<string, any>;

        if (!data.get('username')) {
          return new Response(JSON.stringify({
            success: false,
            error: 'User not found',
            message: 'No user data in this identity'
          }), {
            status: 404,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Update verification status
        await this.ctx.storage.put('emailVerified', true);
        await this.ctx.storage.delete('emailVerificationToken'); // Clear token

        return new Response(JSON.stringify({
          success: true,
          message: 'User manually verified',
          username: data.get('username'),
          email: data.get('email'),
          previousStatus: data.get('emailVerified')
        }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // If action was not handled by switch or admin actions
      console.error(`❌ Invalid action: ${action}`);
      return new Response(JSON.stringify({ error: 'Invalid action', action }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('PlayerIdentity error:', error);
      return new Response(JSON.stringify({ error: 'Internal error', message: error instanceof Error ? error.message : 'Unknown error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Check if username exists and link sessionToken
   * This is called when player connects - if username exists, they get their data back
   */
  private async handleCheck(request: Request): Promise<Response> {
    const body = await request.json() as { sessionToken: string };
    const sessionToken = body.sessionToken;

    if (!sessionToken) {
      return Response.json({ error: 'sessionToken required' }, { status: 400 });
    }

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (data) {
      // MVP 16: Migrate existing users - add default values if missing
      if (data.emailVerified === undefined) data.emailVerified = false;
      if (data.isAuthenticated === undefined) data.isAuthenticated = false;
      if (!data.unlockedCharacters) data.unlockedCharacters = ['squirrel'];
      if (!data.authTokens) data.authTokens = [];

      // Username exists! Link this sessionToken if not already linked
      if (!data.sessionTokens.includes(sessionToken)) {
        data.sessionTokens.push(sessionToken);
      }

      // Update last seen timestamp
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({
        exists: true,
        username: data.username,
        created: data.created,
        lastCharacterId: data.lastCharacterId || null, // FIXED: Explicitly return null if undefined
        // MVP 16: Return auth status and unlocked characters for WebSocket validation
        isAuthenticated: data.isAuthenticated || false,
        unlockedCharacters: data.unlockedCharacters || ['squirrel'],
        // MVP 16: Return persistent stats
        score: data.score || 0,
        titleId: data.titleId || 'rookie',
        titleName: data.titleName || 'Rookie'
      });
    }

    return Response.json({ exists: false });
  }

  /**
   * Set username for new player (creates the identity)
   */
  private async handleSet(request: Request): Promise<Response> {
    const body = await request.json() as { username: string; sessionToken: string };
    const username = body.username?.trim().substring(0, 20);
    const sessionToken = body.sessionToken;

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    if (!sessionToken) {
      return Response.json({ error: 'sessionToken required' }, { status: 400 });
    }

    // Check if already exists (username already claimed)
    const existing = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (existing) {
      // Username already exists, link this sessionToken to it
      if (!existing.sessionTokens.includes(sessionToken)) {
        existing.sessionTokens.push(sessionToken);
      }
      existing.lastSeen = Date.now();
      await this.ctx.storage.put('player', existing);

      return Response.json({
        success: true,
        username: existing.username,
        alreadyExists: true
      });
    }

    // Create new identity (MVP 16: Add default values for authentication)
    const data: PlayerIdentityData = {
      username,
      sessionTokens: [sessionToken],
      created: Date.now(),
      lastSeen: Date.now(),
      // MVP 16: Default values for no-auth users
      emailVerified: false,
      isAuthenticated: false,
      unlockedCharacters: ['squirrel'], // No-auth users get only Squirrel
      authTokens: [],
      score: 0,
      titleId: 'rookie',
      titleName: 'Rookie'
    };

    await this.ctx.storage.put('player', data);

    return Response.json({ success: true, username, alreadyExists: false });
  }

  /**
   * Update username for existing session (rate limited)
   */
  private async handleUpdate(request: Request): Promise<Response> {
    const body = await request.json() as { username: string };
    const newUsername = body.username?.trim().substring(0, 20);

    if (!newUsername) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (!data) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Rate limit: 1 change per hour (3600000 ms)
    const hourAgo = Date.now() - 60 * 60 * 1000;
    if (data.lastUsernameChange && data.lastUsernameChange > hourAgo) {
      const msLeft = data.lastUsernameChange + 60 * 60 * 1000 - Date.now();
      const minutesLeft = Math.ceil(msLeft / 60000);
      return Response.json({
        error: `Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before changing username again`
      }, { status: 429 });
    }

    const oldUsername = data.username;
    data.username = newUsername;
    data.lastSeen = Date.now();
    data.lastUsernameChange = Date.now();

    await this.ctx.storage.put('player', data);

    return Response.json({ success: true, username: newUsername });
  }

  /**
   * Update character selection for this username
   */
  private async handleUpdateCharacter(request: Request): Promise<Response> {
    const body = await request.json() as { characterId: string };
    const characterId = body.characterId?.trim();

    if (!characterId) {
      return Response.json({ error: 'characterId required' }, { status: 400 });
    }

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (!data) {
      console.error(`❌ Identity not found when updating character`);
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Update character
    data.lastCharacterId = characterId;
    data.lastSeen = Date.now();
    await this.ctx.storage.put('player', data);

    return Response.json({ success: true, characterId });
  }

  /**
   * Update game stats (score, rank)
   */
  private async handleUpdateStats(request: Request): Promise<Response> {
    const body = await request.json() as { score: number; titleId: string; titleName: string };
    const { score, titleId, titleName } = body;

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (!data) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Update stats
    if (score !== undefined) data.score = score;
    if (titleId) data.titleId = titleId;
    if (titleName) data.titleName = titleName;

    data.lastSeen = Date.now();
    await this.ctx.storage.put('player', data);

    return Response.json({ success: true });
  }

  /**
   * Get game stats (internal use)
   */
  private async handleGetStats(request: Request): Promise<Response> {
    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (!data) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    return Response.json({
      score: data.score || 0,
      titleId: data.titleId || 'rookie',
      titleName: data.titleName || 'Rookie'
    });
  }

  /**
   * Handle signup request (create authenticated account)
   * POST with body: { email, username, password }
   * MVP 16: Full authentication support
   */
  private async handleSignup(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        email: string;
        username: string;
        password: string;
        origin?: string;
      };

      const { email, username, password, origin: bodyOrigin } = body;

      // Validate inputs
      if (!email || !username || !password) {
        return Response.json({
          error: 'Missing required fields: email, username, password'
        }, { status: 400 });
      }

      // Validate email format (basic regex)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return Response.json({
          error: 'Invalid email format'
        }, { status: 400 });
      }

      // Validate password requirements
      const passwordValidation = PasswordUtils.validatePassword(password);
      if (!passwordValidation.valid) {
        return Response.json({
          error: passwordValidation.error
        }, { status: 400 });
      }

      // Validate password uniqueness (doesn't match username/email)
      const uniquenessValidation = PasswordUtils.validatePasswordUniqueness(
        password,
        username,
        email
      );
      if (!uniquenessValidation.valid) {
        return Response.json({
          error: uniquenessValidation.error
        }, { status: 400 });
      }

      // Check if user already exists in THIS Durable Object instance
      const existing = await this.ctx.storage.get<PlayerIdentityData>('player');
      // Only block signup if existing account is already authenticated
      // Quick Play accounts (no email or not authenticated) can be upgraded
      if (existing && existing.email && existing.isAuthenticated) {
        console.log(`❌ Blocking signup: Local DO storage already has authenticated user ${existing.email}`);
        return Response.json({
          error: 'Email already registered',
          message: 'This email address already has an account. Please log in instead.'
        }, { status: 409 });
      }

      // MVP 16: Check email uniqueness across all users (global KV index)
      const normalizedEmail = email.toLowerCase().trim();
      const emailKey = `email:${normalizedEmail}`;

      const existingUsernameForEmail = await this.env.EMAIL_INDEX.get(emailKey);
      if (existingUsernameForEmail && existingUsernameForEmail !== username) {
        console.log(`❌ Blocking signup: KV EMAIL_INDEX conflict. ${emailKey} -> ${existingUsernameForEmail}`);
        return Response.json({
          error: 'Email already registered',
          message: 'This email address is already registered with a different username. Please log in instead.'
        }, { status: 409 });
      }

      // MVP 16: Check username uniqueness across all users (global KV index)
      const normalizedUsername = username.toLowerCase().trim();
      const usernameKey = `username:${normalizedUsername}`;

      const existingEmailForUsername = await this.env.USERNAME_INDEX.get(usernameKey);
      if (existingEmailForUsername && existingEmailForUsername !== normalizedEmail) {
        console.log(`❌ Blocking signup: KV USERNAME_INDEX conflict. ${usernameKey} -> ${existingEmailForUsername}`);
        return Response.json({
          error: 'Username already taken',
          message: 'This username is already taken. Please choose a different username.'
        }, { status: 409 });
      }

      // Hash password (this takes ~200-300ms)
      const passwordHash = await PasswordUtils.hashPassword(password);

      // Generate email verification token
      const verificationToken = TokenGenerator.generateVerificationToken();
      const verificationExpiry = TokenGenerator.generateExpiry(24); // 24 hours

      // Create or update player data
      const data: PlayerIdentityData = existing || {
        username,
        sessionTokens: [],
        created: Date.now(),
        lastSeen: Date.now(),
        emailVerified: false,
        isAuthenticated: false,
        unlockedCharacters: ['squirrel'],
        authTokens: [],
        score: 0,
        titleId: 'rookie',
        titleName: 'Rookie'
      };

      // Add authentication fields
      data.email = email.toLowerCase().trim(); // Normalize email
      data.passwordHash = passwordHash;
      data.emailVerificationToken = verificationToken;
      data.emailVerificationExpiry = verificationExpiry;
      data.isAuthenticated = true;
      data.accountCreated = Date.now();
      data.lastSeen = Date.now();

      // Unlock free characters (Immediate access to 4 characters)
      // Goat is reserved as a "Verified Bonus"
      data.unlockedCharacters = [
        'squirrel',
        'hare',
        'chipmunk',
        'turkey',
        'mallard'
      ];

      // If upgrading from Quick Play with a valid character, keep it.
      // Otherwise, default to 'squirrel' for new authenticated users.
      if (data.lastCharacterId && data.unlockedCharacters.includes(data.lastCharacterId)) {
        // Keep existing character if it's now unlocked
      } else {
        // Default to squirrel for new users or if previous character not in unlocked list
        data.lastCharacterId = 'squirrel';
      }

      // MVP 16: Generate JWT tokens for immediate session
      const tokenId = generateTokenId();
      const deviceInfo = request.headers.get('User-Agent') || 'Unknown';

      // Debug: Check if JWT_SECRET is available
      if (!this.env.JWT_SECRET) {
        console.error('JWT_SECRET is undefined in PlayerIdentity environment');
        return Response.json({
          error: 'Server configuration error',
          message: 'JWT_SECRET not configured'
        }, { status: 500 });
      }

      const tokens = generateTokenPair(
        {
          username: data.username,
          email: data.email,
          isAuthenticated: data.isAuthenticated,
          emailVerified: data.emailVerified,
          unlockedCharacters: data.unlockedCharacters
        },
        tokenId,
        this.env.JWT_SECRET
      );

      // Store token metadata
      data.authTokens.push({
        tokenId,
        created: Date.now(),
        expiresAt: tokens.refreshTokenExpiry,
        deviceInfo,
        lastUsed: Date.now()
      });

      await this.ctx.storage.put('player', data);

      try {
        // MVP 16: Register email and username in global KV indices
        console.log(`📝 Writing to KV: ${emailKey} → ${username}`);
        await this.env.EMAIL_INDEX.put(emailKey, username);
        console.log(`📝 Writing to KV: ${usernameKey} → ${normalizedEmail}`);
        await this.env.USERNAME_INDEX.put(usernameKey, normalizedEmail);
        console.log(`✅ KV indices updated successfully`);
      } catch (kvError) {
        console.error('❌ KV Index update failed, rolling back DO creation:', kvError);
        // Rollback: Delete the player data we just created to prevent "Zombie DO"
        await this.ctx.storage.delete('player');
        throw new Error('Failed to register user index. Please try again.');
      }

      // Send verification email
      let emailError: string | undefined;
      if (this.env.SMTP_USER && this.env.SMTP_PASSWORD) {
        const emailService = new EmailService({
          smtpUser: this.env.SMTP_USER,
          smtpPassword: this.env.SMTP_PASSWORD
        });

        // Determine client origin for verification link
        // 1. Use origin from body (explicitly passed by client)
        // 2. Use Origin header (if valid CORS request)
        // 3. Fallback to production URL
        let origin = 'https://hiddenwalnuts.com';

        if (bodyOrigin) {
          origin = bodyOrigin;
        } else {
          const originHeader = request.headers.get('Origin');
          if (originHeader && originHeader !== 'null') {
            origin = originHeader;
          }
        }

        // Prevent using worker URL as origin
        if (origin.includes('workers.dev')) {
          // If we somehow got the worker URL, force fallback unless it's the preview environment we want
          // But generally we want the client URL. 
          // If the user IS testing on a worker preview URL, we might want to allow it if it was passed in body.
          // But request.url origin is DEFINITELY wrong as it points to the API.
          // Let's trust bodyOrigin if provided, otherwise fallback.
          if (!bodyOrigin) {
            origin = 'https://hiddenwalnuts.com';
          }
        }

        const emailResult = await emailService.sendVerificationEmail(
          data.email!,
          data.username,
          verificationToken,
          origin
        );

        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error);
          emailError = emailResult.error;
        }
      } else {
        emailError = 'Missing SMTP configuration';
      }

      return Response.json({
        success: true,
        username: data.username,
        email: data.email,
        emailVerified: data.emailVerified,
        verificationToken, // Return token for debugging (remove in production)
        unlockedCharacters: data.unlockedCharacters,
        lastCharacterId: data.lastCharacterId,
        // JWT tokens
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: tokens.accessTokenExpiry,
        refreshTokenExpiry: tokens.refreshTokenExpiry,
        // Persistent stats
        score: data.score || 0,
        titleId: data.titleId || 'rookie',
        titleName: data.titleName || 'Rookie',
        // Debug info
        emailError
      });

    } catch (error) {
      console.error('Signup error:', error);
      return Response.json({
        error: 'Failed to create account',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Handle login request (email/password authentication)
   * POST with body: { email, password }
   * MVP 16: Full authentication support
   */
  private async handleLogin(request: Request): Promise<Response> {
    try {
      const body = await request.json() as {
        email: string;
        password: string;
      };

      const { email, password } = body;

      if (!email || !password) {
        return Response.json({
          error: 'Missing email or password'
        }, { status: 400 });
      }

      // Get player data
      const data = await this.ctx.storage.get<PlayerIdentityData>('player');

      if (!data || !data.email || !data.passwordHash) {
        return Response.json({
          error: 'Invalid email or password'
        }, { status: 401 });
      }

      // Verify email matches
      if (data.email.toLowerCase() !== email.toLowerCase().trim()) {
        return Response.json({
          error: 'Invalid email or password'
        }, { status: 401 });
      }

      // Verify password (this takes ~200-300ms)
      const isValid = await PasswordUtils.comparePassword(password, data.passwordHash);

      if (!isValid) {
        return Response.json({
          error: 'Invalid email or password'
        }, { status: 401 });
      }

      // MVP 16: Generate JWT tokens for session management
      const tokenId = generateTokenId();
      const deviceInfo = request.headers.get('User-Agent') || 'Unknown';

      const tokens = generateTokenPair(
        {
          username: data.username,
          email: data.email,
          isAuthenticated: data.isAuthenticated,
          emailVerified: data.emailVerified,
          unlockedCharacters: data.unlockedCharacters
        },
        tokenId,
        this.env.JWT_SECRET
      );

      // Store token metadata for tracking/revocation
      if (!data.authTokens) {
        data.authTokens = [];
      }

      data.authTokens.push({
        tokenId,
        created: Date.now(),
        expiresAt: tokens.refreshTokenExpiry,
        deviceInfo,
        lastUsed: Date.now()
      });

      // Limit to 10 active tokens per user (remove oldest if exceeded)
      if (data.authTokens.length > 10) {
        data.authTokens.sort((a, b) => b.created - a.created);
        data.authTokens = data.authTokens.slice(0, 10);
      }

      // Update last seen
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({
        success: true,
        username: data.username,
        email: data.email,
        emailVerified: data.emailVerified,
        unlockedCharacters: data.unlockedCharacters,
        lastCharacterId: data.lastCharacterId,
        // JWT tokens
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: tokens.accessTokenExpiry,
        refreshTokenExpiry: tokens.refreshTokenExpiry,
        // Persistent stats
        score: data.score || 0,
        titleId: data.titleId || 'rookie',
        titleName: data.titleName || 'Rookie'
      });

    } catch (error) {
      console.error('Login error:', error);
      return Response.json({
        error: 'Failed to log in',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
  }

  /**
   * Handle email verification
   * POST with body: { token }
   */
  private async handleVerifyEmail(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { token: string };
      const { token } = body;

      if (!token) {
        return Response.json({ error: 'Missing verification token' }, { status: 400 });
      }

      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      if (data.emailVerified) {
        return Response.json({ success: true, message: 'Email already verified' });
      }

      if (data.emailVerificationToken !== token) {
        return Response.json({ error: 'Invalid verification token' }, { status: 400 });
      }

      if (TokenGenerator.isExpired(data.emailVerificationExpiry)) {
        return Response.json({ error: 'Verification token has expired. Please request a new one.' }, { status: 400 });
      }

      data.emailVerified = true;
      data.emailVerificationToken = undefined;
      data.emailVerificationExpiry = undefined;

      // Unlock "Verified Bonus" character (Goat)
      const bonusCharacters = ['goat'];

      // Add bonus characters to unlocked list
      for (const charId of bonusCharacters) {
        if (!data.unlockedCharacters.includes(charId)) {
          data.unlockedCharacters.push(charId);
        }
      }

      // Generate new JWT tokens with emailVerified: true
      const tokenId = generateTokenId();
      const deviceInfo = request.headers.get('User-Agent') || 'Unknown';

      // Ensure authTokens array exists
      if (!data.authTokens) {
        data.authTokens = [];
      }

      const tokens = generateTokenPair(
        {
          username: data.username,
          email: data.email,
          isAuthenticated: data.isAuthenticated,
          emailVerified: true, // Explicitly true
          unlockedCharacters: data.unlockedCharacters
        },
        tokenId,
        this.env.JWT_SECRET
      );

      // Store token metadata
      data.authTokens.push({
        tokenId,
        created: Date.now(),
        expiresAt: tokens.refreshTokenExpiry,
        deviceInfo,
        lastUsed: Date.now()
      });

      // Limit to 10 active tokens
      if (data.authTokens.length > 10) {
        data.authTokens.sort((a, b) => b.created - a.created);
        data.authTokens = data.authTokens.slice(0, 10);
      }

      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      // Send welcome email
      if (this.env.SMTP_USER && this.env.SMTP_PASSWORD) {
        const emailService = new EmailService({
          smtpUser: this.env.SMTP_USER,
          smtpPassword: this.env.SMTP_PASSWORD
        });

        await emailService.sendWelcomeEmail(data.email!, data.username);
        // Don't wait for result - it's non-critical
      }

      return Response.json({
        success: true,
        message: 'Email verified successfully',
        username: data.username,
        email: data.email,
        // Return new tokens for auto-login
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: tokens.accessTokenExpiry,
        refreshTokenExpiry: tokens.refreshTokenExpiry
      });
    } catch (error) {
      console.error('Email verification error:', error);
      return Response.json({ error: 'Failed to verify email' }, { status: 500 });
    }
  }

  /**
   * Handle password reset request
   * POST with body: { email }
   */
  private async handleRequestPasswordReset(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { email: string };
      const { email } = body;

      if (!email) {
        return Response.json({ error: 'Missing email' }, { status: 400 });
      }

      const data = await this.ctx.storage.get<PlayerIdentityData>('player');

      // Security: Don't reveal if email exists or not
      if (!data || !data.email || data.email.toLowerCase() !== email.toLowerCase().trim()) {
        return Response.json({
          success: true,
          message: 'If an account exists with that email, a password reset link has been sent.'
        });
      }

      const resetToken = TokenGenerator.generatePasswordResetToken();
      const resetExpiry = TokenGenerator.generateExpiry(1); // 1 hour

      data.passwordResetToken = resetToken;
      data.passwordResetExpiry = resetExpiry;
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      // Send password reset email
      if (this.env.SMTP_USER && this.env.SMTP_PASSWORD) {
        const emailService = new EmailService({
          smtpUser: this.env.SMTP_USER,
          smtpPassword: this.env.SMTP_PASSWORD
        });

        const origin = new URL(request.url).origin;
        await emailService.sendPasswordResetEmail(
          data.email!,
          data.username,
          resetToken,
          origin
        );
      }

      return Response.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      return Response.json({ error: 'Failed to request password reset' }, { status: 500 });
    }
  }

  /**
   * Handle password reset
   * POST with body: { token, newPassword }
   */
  private async handleResetPassword(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { token: string; newPassword: string };
      const { token, newPassword } = body;

      if (!token || !newPassword) {
        return Response.json({ error: 'Missing token or newPassword' }, { status: 400 });
      }

      const passwordValidation = PasswordUtils.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return Response.json({ error: passwordValidation.error }, { status: 400 });
      }

      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      if (data.passwordResetToken !== token) {
        return Response.json({ error: 'Invalid or expired reset token' }, { status: 400 });
      }

      if (TokenGenerator.isExpired(data.passwordResetExpiry)) {
        return Response.json({ error: 'Reset token has expired. Please request a new one.' }, { status: 400 });
      }

      const uniquenessValidation = PasswordUtils.validatePasswordUniqueness(
        newPassword,
        data.username,
        data.email
      );
      if (!uniquenessValidation.valid) {
        return Response.json({ error: uniquenessValidation.error }, { status: 400 });
      }

      const newPasswordHash = await PasswordUtils.hashPassword(newPassword);

      data.passwordHash = newPasswordHash;
      data.passwordResetToken = undefined;
      data.passwordResetExpiry = undefined;
      data.lastPasswordChange = Date.now();
      data.lastSeen = Date.now();
      data.authTokens = []; // Invalidate all existing tokens
      await this.ctx.storage.put('player', data);

      return Response.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      return Response.json({ error: 'Failed to reset password' }, { status: 500 });
    }
  }

  /**
   * Handle password change
   * POST with body: { oldPassword, newPassword }
   */
  private async handleChangePassword(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { oldPassword: string; newPassword: string };
      const { oldPassword, newPassword } = body;

      if (!oldPassword || !newPassword) {
        return Response.json({ error: 'Missing oldPassword or newPassword' }, { status: 400 });
      }

      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data || !data.passwordHash) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      const isValid = await PasswordUtils.comparePassword(oldPassword, data.passwordHash);
      if (!isValid) {
        return Response.json({ error: 'Invalid old password' }, { status: 401 });
      }

      const passwordValidation = PasswordUtils.validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return Response.json({ error: passwordValidation.error }, { status: 400 });
      }

      const uniquenessValidation = PasswordUtils.validatePasswordUniqueness(
        newPassword,
        data.username,
        data.email
      );
      if (!uniquenessValidation.valid) {
        return Response.json({ error: uniquenessValidation.error }, { status: 400 });
      }

      const newPasswordHash = await PasswordUtils.hashPassword(newPassword);

      data.passwordHash = newPasswordHash;
      data.lastPasswordChange = Date.now();
      data.lastSeen = Date.now();
      data.authTokens = []; // Invalidate all existing tokens
      await this.ctx.storage.put('player', data);

      return Response.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      return Response.json({ error: 'Failed to change password' }, { status: 500 });
    }
  }

  /**
   * Handle token refresh
   * POST with body: { refreshToken }
   * Returns new access token
   */
  private async handleRefreshToken(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { refreshToken: string };
      const { refreshToken } = body;

      if (!refreshToken) {
        return Response.json({ error: 'Missing refresh token' }, { status: 400 });
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken, this.env.JWT_SECRET);
      if (!decoded) {
        return Response.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
      }

      // Get player data
      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      // Check if token is still valid (not revoked)
      const tokenRecord = data.authTokens?.find(t => t.tokenId === decoded.tokenId);
      if (!tokenRecord) {
        return Response.json({ error: 'Token has been revoked' }, { status: 401 });
      }

      // Check if token is expired
      if (tokenRecord.expiresAt < Date.now()) {
        // Remove expired token
        data.authTokens = data.authTokens.filter(t => t.tokenId !== decoded.tokenId);
        await this.ctx.storage.put('player', data);
        return Response.json({ error: 'Refresh token expired' }, { status: 401 });
      }

      // Generate new token pair
      const newTokenId = generateTokenId();
      const deviceInfo = request.headers.get('User-Agent') || 'Unknown';

      const tokens = generateTokenPair(
        {
          username: data.username,
          email: data.email,
          isAuthenticated: data.isAuthenticated,
          emailVerified: data.emailVerified,
          unlockedCharacters: data.unlockedCharacters
        },
        newTokenId,
        this.env.JWT_SECRET
      );

      // Replace old token with new one
      data.authTokens = data.authTokens.filter(t => t.tokenId !== decoded.tokenId);
      data.authTokens.push({
        tokenId: newTokenId,
        created: Date.now(),
        expiresAt: tokens.refreshTokenExpiry,
        deviceInfo,
        lastUsed: Date.now()
      });

      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({
        success: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: tokens.accessTokenExpiry,
        refreshTokenExpiry: tokens.refreshTokenExpiry
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      return Response.json({ error: 'Failed to refresh token' }, { status: 500 });
    }
  }

  /**
   * Handle logout (single device)
   * POST with body: { refreshToken } or Authorization header
   * Revokes specific token
   */
  private async handleLogout(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { refreshToken?: string };
      const refreshToken = body.refreshToken;

      if (!refreshToken) {
        return Response.json({ error: 'Missing refresh token' }, { status: 400 });
      }

      // Verify token to get tokenId
      const decoded = verifyRefreshToken(refreshToken, this.env.JWT_SECRET);
      if (!decoded) {
        return Response.json({ error: 'Invalid refresh token' }, { status: 401 });
      }

      // Get player data
      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      // Remove this specific token
      const initialLength = data.authTokens?.length || 0;
      data.authTokens = data.authTokens?.filter(t => t.tokenId !== decoded.tokenId) || [];

      if (data.authTokens.length === initialLength) {
        return Response.json({ error: 'Token not found' }, { status: 404 });
      }

      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({
        success: true,
        message: 'Logged out from this device'
      });

    } catch (error) {
      console.error('Logout error:', error);
      return Response.json({ error: 'Failed to logout' }, { status: 500 });
    }
  }

  /**
   * Handle logout all devices
   * POST with body: { refreshToken } or Authorization header
   * Revokes all tokens for user
   */
  private async handleLogoutAll(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { refreshToken?: string };
      const refreshToken = body.refreshToken;

      if (!refreshToken) {
        return Response.json({ error: 'Missing refresh token' }, { status: 400 });
      }

      // Verify token to authenticate user
      const decoded = verifyRefreshToken(refreshToken, this.env.JWT_SECRET);
      if (!decoded) {
        return Response.json({ error: 'Invalid refresh token' }, { status: 401 });
      }

      // Get player data
      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (!data) {
        return Response.json({ error: 'Account not found' }, { status: 404 });
      }

      // Remove all tokens
      data.authTokens = [];
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({
        success: true,
        message: 'Logged out from all devices'
      });

    } catch (error) {
      console.error('Logout all error:', error);
      return Response.json({ error: 'Failed to logout' }, { status: 500 });
    }
  }

  /**
   * Admin endpoint: Clear all storage for this PlayerIdentity
   * Requires admin secret authentication
   * Used for testing to completely reset user data
   */
  private async handleAdminClear(request: Request): Promise<Response> {
    try {
      // Validate admin secret
      const adminSecret = request.headers.get("X-Admin-Secret") ||
        new URL(request.url).searchParams.get("admin_secret");

      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return Response.json({
          error: "Unauthorized",
          message: "Invalid or missing admin secret"
        }, { status: 401 });
      }

      // Get current data to return email for confirmation
      const data = await this.ctx.storage.get<PlayerIdentityData>('player');
      const email = data?.email || null;
      const username = data?.username || null;

      // Delete ALL storage for this PlayerIdentity DO
      await this.ctx.storage.deleteAll();

      return Response.json({
        success: true,
        username,
        email,
        message: `PlayerIdentity storage cleared for ${username || 'unknown user'}`
      });

    } catch (error) {
      console.error('Admin clear error:', error);
      return Response.json({ error: 'Failed to clear storage' }, { status: 500 });
    }
  }

  /**
   * Handle resend verification email request
   * POST with body: { email }
   */
  private async handleResendVerification(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { email: string; origin?: string };
      const { email, origin: bodyOrigin } = body;

      if (!email) {
        return Response.json({ error: 'Missing email' }, { status: 400 });
      }

      const data = await this.ctx.storage.get<PlayerIdentityData>('player');

      // Security: Don't reveal if email exists or not
      if (!data || !data.email || data.email.toLowerCase() !== email.toLowerCase().trim()) {
        return Response.json({
          success: true,
          message: 'If an account exists with that email, a verification link has been sent.'
        });
      }

      if (data.emailVerified) {
        return Response.json({
          success: true,
          message: 'Email is already verified.'
        });
      }

      // Generate new token
      const verificationToken = TokenGenerator.generateVerificationToken();
      const verificationExpiry = TokenGenerator.generateExpiry(24); // 24 hours

      data.emailVerificationToken = verificationToken;
      data.emailVerificationExpiry = verificationExpiry;

      await this.ctx.storage.put('player', data);

      // Send email
      if (this.env.SMTP_USER && this.env.SMTP_PASSWORD) {
        const emailService = new EmailService({
          smtpUser: this.env.SMTP_USER,
          smtpPassword: this.env.SMTP_PASSWORD
        });

        // Determine client origin for verification link
        let origin = 'https://hiddenwalnuts.com';

        if (bodyOrigin) {
          origin = bodyOrigin;
        } else {
          const originHeader = request.headers.get('Origin');
          if (originHeader && originHeader !== 'null') {
            origin = originHeader;
          }
        }

        const emailResult = await emailService.sendVerificationEmail(
          data.email,
          data.username,
          verificationToken,
          origin
        );

        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error);
          return Response.json({
            success: false,
            error: 'Email delivery failed',
            message: emailResult.error || 'Unknown email error'
          }, { status: 500 });
        }
      }

      return Response.json({
        success: true,
        message: 'Verification email sent.'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      return Response.json({ error: 'Failed to resend verification email' }, { status: 500 });
    }
  }
}
