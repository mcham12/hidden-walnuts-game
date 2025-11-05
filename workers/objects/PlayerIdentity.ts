import { DurableObject } from 'cloudflare:workers';

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
 *
 * Design:
 * - One DO instance per USERNAME (not sessionToken)
 * - Stores: username, sessionTokens[], created, lastSeen
 * - Multiple sessionTokens per username (different browsers/devices)
 * - Works in private browsing: same username = same identity
 * - Rate limiting: 1 username change per hour (not implemented yet)
 */
export class PlayerIdentity extends DurableObject {
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
}
