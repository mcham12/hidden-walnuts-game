import { DurableObject } from 'cloudflare:workers';

/**
 * PlayerIdentityData - Stored data for each username
 */
export interface PlayerIdentityData {
  username: string;
  sessionTokens: string[]; // Multiple sessions (different browsers/devices)
  created: number;
  lastSeen: number;
  lastUsernameChange?: number;
  lastCharacterId?: string; // Last selected character (for returning users)
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
          return new Response('Invalid action', { status: 400 });
      }
    } catch (error) {
      console.error('PlayerIdentity error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Check if username exists and link sessionToken
   * This is called when player connects - if username exists, they get their data back
   */
  private async handleCheck(request: Request): Promise<Response> {
    const body = await request.json() as { sessionToken: string };
    const sessionToken = body.sessionToken;

    console.log(`🔍 SERVER: handleCheck - sessionToken: ${sessionToken?.substring(0, 8)}...`);

    if (!sessionToken) {
      return Response.json({ error: 'sessionToken required' }, { status: 400 });
    }

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');
    console.log(`🔍 SERVER: Storage data:`, data ? { username: data.username, lastCharacterId: data.lastCharacterId, sessionTokens: data.sessionTokens.length } : 'null');

    if (data) {
      // Username exists! Link this sessionToken if not already linked
      if (!data.sessionTokens.includes(sessionToken)) {
        data.sessionTokens.push(sessionToken);
        console.log(`🔗 Linked new sessionToken to username: ${data.username}`);
      }

      // Update last seen timestamp
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      const response = {
        exists: true,
        username: data.username,
        created: data.created,
        lastCharacterId: data.lastCharacterId || null // FIXED: Explicitly return null if undefined
      };
      console.log(`✅ SERVER: Returning:`, response);
      return Response.json(response);
    }

    console.log(`❌ SERVER: Player not found, returning exists=false`);
    return Response.json({ exists: false });
  }

  /**
   * Set username for new player (creates the identity)
   */
  private async handleSet(request: Request): Promise<Response> {
    const body = await request.json() as { username: string; sessionToken: string };
    const username = body.username?.trim().substring(0, 20);
    const sessionToken = body.sessionToken;

    console.log(`💾 SERVER: handleSet - username: "${username}", sessionToken: ${sessionToken?.substring(0, 8)}...`);

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    if (!sessionToken) {
      return Response.json({ error: 'sessionToken required' }, { status: 400 });
    }

    // Check if already exists (username already claimed)
    const existing = await this.ctx.storage.get<PlayerIdentityData>('player');
    console.log(`💾 SERVER: Existing data:`, existing ? { username: existing.username, lastCharacterId: existing.lastCharacterId } : 'null');

    if (existing) {
      // Username already exists, link this sessionToken to it
      if (!existing.sessionTokens.includes(sessionToken)) {
        existing.sessionTokens.push(sessionToken);
      }
      existing.lastSeen = Date.now();
      await this.ctx.storage.put('player', existing);

      console.log(`🔗 SERVER: Username "${username}" already exists, linked new sessionToken`);
      return Response.json({
        success: true,
        username: existing.username,
        alreadyExists: true
      });
    }

    // Create new identity
    const data: PlayerIdentityData = {
      username,
      sessionTokens: [sessionToken],
      created: Date.now(),
      lastSeen: Date.now()
    };

    await this.ctx.storage.put('player', data);

    console.log('✅ SERVER: New player identity created:', username);
    console.log('✅ SERVER: Data saved:', { username: data.username, lastCharacterId: data.lastCharacterId });
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

    console.log(`✅ Username changed: ${oldUsername} → ${newUsername}`);
    return Response.json({ success: true, username: newUsername });
  }

  /**
   * Update character selection for this username
   */
  private async handleUpdateCharacter(request: Request): Promise<Response> {
    const body = await request.json() as { characterId: string };
    const characterId = body.characterId?.trim();

    console.log(`🎮 SERVER: handleUpdateCharacter - characterId: ${characterId}`);

    if (!characterId) {
      return Response.json({ error: 'characterId required' }, { status: 400 });
    }

    const data = await this.ctx.storage.get<PlayerIdentityData>('player');
    console.log(`🎮 SERVER: Current data:`, data ? { username: data.username, lastCharacterId: data.lastCharacterId } : 'null');

    if (!data) {
      console.log(`❌ SERVER: Identity not found!`);
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    // Update character
    data.lastCharacterId = characterId;
    data.lastSeen = Date.now();
    await this.ctx.storage.put('player', data);

    console.log(`✅ SERVER: Character updated for ${data.username}: ${characterId}`);
    console.log(`✅ SERVER: Data saved:`, { username: data.username, lastCharacterId: data.lastCharacterId });
    return Response.json({ success: true, characterId });
  }
}
