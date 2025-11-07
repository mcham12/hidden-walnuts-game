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

        // MVP 16: Token management
        case 'refreshToken':
          return await this.handleRefreshToken(request);

        case 'logout':
          return await this.handleLogout(request);

        case 'logoutAll':
          return await this.handleLogoutAll(request);

        default:
          console.error(`❌ Invalid action: ${action}`);
          return new Response(JSON.stringify({ error: 'Invalid action', action }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
      }
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
        lastCharacterId: data.lastCharacterId || null // FIXED: Explicitly return null if undefined
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
      authTokens: []
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
      };

      const { email, username, password } = body;

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

      // Check if user already exists
      const existing = await this.ctx.storage.get<PlayerIdentityData>('player');
      if (existing && existing.email) {
        return Response.json({
          error: 'This username already has an account'
        }, { status: 409 });
      }

      // MVP 16: Check email uniqueness across all users (global KV index)
      const normalizedEmail = email.toLowerCase().trim();
      const emailKey = `email:${normalizedEmail}`;

      const existingUsername = await this.env.EMAIL_INDEX.get(emailKey);
      if (existingUsername && existingUsername !== username) {
        return Response.json({
          error: 'Email already registered'
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
        authTokens: []
      };

      // Add authentication fields
      data.email = email.toLowerCase().trim(); // Normalize email
      data.passwordHash = passwordHash;
      data.emailVerificationToken = verificationToken;
      data.emailVerificationExpiry = verificationExpiry;
      data.isAuthenticated = true;
      data.accountCreated = Date.now();
      data.lastSeen = Date.now();

      // Unlock free characters (6 total for authenticated users)
      data.unlockedCharacters = [
        'squirrel',
        'hare',
        'goat',
        'chipmunk',
        'turkey',
        'mallard'
      ];

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

      // MVP 16: Register email in global KV index
      await this.env.EMAIL_INDEX.put(emailKey, username);

      // Send verification email
      if (this.env.SMTP_USER && this.env.SMTP_PASSWORD) {
        const emailService = new EmailService({
          smtpUser: this.env.SMTP_USER,
          smtpPassword: this.env.SMTP_PASSWORD
        });

        const emailResult = await emailService.sendVerificationEmail(
          data.email!,
          data.username,
          verificationToken
        );

        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error);
          // Don't fail signup if email fails - user can resend later
        }
      }

      return Response.json({
        success: true,
        username: data.username,
        email: data.email,
        verificationToken, // Return token for debugging (remove in production)
        unlockedCharacters: data.unlockedCharacters,
        // JWT tokens
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiry: tokens.accessTokenExpiry,
        refreshTokenExpiry: tokens.refreshTokenExpiry
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
        refreshTokenExpiry: tokens.refreshTokenExpiry
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
        email: data.email
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

        await emailService.sendPasswordResetEmail(
          data.email,
          data.username,
          resetToken
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
}
