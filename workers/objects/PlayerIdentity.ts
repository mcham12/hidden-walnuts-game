import { DurableObject } from 'cloudflare:workers';

/**
 * PlayerIdentityData - Stored data for each session
 */
export interface PlayerIdentityData {
  username: string;
  created: number;
  lastSeen: number;
  lastUsernameChange?: number;
}

/**
 * PlayerIdentity - Durable Object for session → username mapping
 *
 * MVP 6: Player Authentication & Identity
 *
 * Design:
 * - One DO instance per sessionToken
 * - Stores: username, created, lastSeen, lastUsernameChange
 * - Rate limiting: 1 username change per hour
 * - Simple key-value storage (no uniqueness enforcement)
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
          return await this.handleCheck();

        case 'set':
          return await this.handleSet(request);

        case 'update':
          return await this.handleUpdate(request);

        default:
          return new Response('Invalid action', { status: 400 });
      }
    } catch (error) {
      console.error('PlayerIdentity error:', error);
      return new Response('Internal error', { status: 500 });
    }
  }

  /**
   * Check if username exists for this session
   */
  private async handleCheck(): Promise<Response> {
    const data = await this.ctx.storage.get<PlayerIdentityData>('player');

    if (data) {
      // Update last seen timestamp
      data.lastSeen = Date.now();
      await this.ctx.storage.put('player', data);

      return Response.json({ username: data.username });
    }

    return Response.json({ username: null });
  }

  /**
   * Set username for new session
   */
  private async handleSet(request: Request): Promise<Response> {
    const body = await request.json() as { username: string };
    const username = body.username?.trim().substring(0, 20);

    if (!username) {
      return Response.json({ error: 'Username required' }, { status: 400 });
    }

    // Check if already exists (shouldn't happen, but handle gracefully)
    const existing = await this.ctx.storage.get<PlayerIdentityData>('player');
    if (existing) {
      console.warn('Attempted to set username for existing session - updating instead');
      return this.handleUpdate(request);
    }

    const data: PlayerIdentityData = {
      username,
      created: Date.now(),
      lastSeen: Date.now()
    };

    await this.ctx.storage.put('player', data);

    console.log('✅ New player identity created:', username);
    return Response.json({ success: true, username });
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
}
