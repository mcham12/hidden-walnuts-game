// MVP 9: Enhanced Leaderboard with Reset, Archival, and Anti-Cheat
// Industry-standard patterns from PlayFab, Google Play Games, etc.

interface DurableObjectState {
  storage: DurableObjectStorage;
  id: DurableObjectId;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
  list<T>(options?: { prefix?: string }): Promise<Map<string, T>>;
}

interface DurableObjectId {
  toString(): string;
  equals(other: DurableObjectId): boolean;
}

interface ScoreRecord {
  playerId: string;
  score: number;
  walnuts: { hidden: number; found: number };
  updatedAt: number;
  lastScoreIncrease?: number; // For rate limiting

  // MVP 16: Authentication fields
  isAuthenticated?: boolean; // true if has email/password account
  emailVerified?: boolean; // true if email verified
  characterId?: string; // Character used by player
}

interface LeaderboardMetadata {
  lastResetAt: number;
  resetCount: number;
  createdAt: number;
}

interface LeaderboardArchive {
  timestamp: number;
  resetType: 'manual' | 'weekly' | 'monthly';
  playerCount: number;
  topPlayers: Array<{
    playerId: string;
    score: number;
    walnuts: { hidden: number; found: number };
    rank: number;
  }>;
  adminNote?: string;
}

interface Env {
  LEADERBOARD_ARCHIVES?: KVNamespace;
  ADMIN_SECRET?: string;
  LEADERBOARD_RESET_ENABLED?: string;
  LEADERBOARD_ARCHIVE_LIMIT?: string;
}

export default class Leaderboard {
  state: DurableObjectState;
  storage: DurableObjectStorage;
  env: Env;
  scores: Map<string, ScoreRecord> = new Map(); // Weekly scores (reset every Monday)
  alltimeScores: Map<string, ScoreRecord> = new Map(); // All-time scores (never reset)
  metadata: LeaderboardMetadata | null = null;
  initialized = false;

  // ANTI-CHEAT: Rate limiting constants (industry standard)
  private readonly MAX_SCORE_INCREASE_PER_MINUTE = 100; // Max 100 points/min
  private readonly MAX_SCORE_ABSOLUTE = 100000; // Sanity check

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize scores from storage
    if (!this.initialized) {
      await this.loadScores();
      await this.loadAllTimeScores(); // MVP 9: Load all-time scores
      await this.loadMetadata();
      this.initialized = true;
    }

    // Update player score (with anti-cheat validation)
    if (path.endsWith("/report") && request.method === "POST") {
      return this.handleScoreReport(request);
    }

    // Get top players (weekly by default, or all-time if specified)
    if (path.endsWith("/top")) {
      const limit = parseInt(url.searchParams.get("limit") || "10");
      const type = url.searchParams.get("type") || "weekly"; // MVP 9: Support ?type=alltime or daily

      // MVP 16: Implement authentication-based filtering
      let topPlayers;
      let totalPlayers;

      if (type === "alltime") {
        // Hall of Fame: Authenticated players ONLY
        topPlayers = this.getTopPlayers(limit, this.alltimeScores, { requireAuth: true });
        totalPlayers = Array.from(this.alltimeScores.values()).filter(r => r.isAuthenticated).length;
      } else if (type === "weekly") {
        // Weekly leaderboard: Top 10 restricted to authenticated players
        topPlayers = this.getTopPlayers(limit, this.scores, { authOnlyForTopN: 10 });
        totalPlayers = this.scores.size;
      } else {
        // Daily leaderboard: All players (no filtering)
        topPlayers = this.getTopPlayers(limit, this.scores);
        totalPlayers = this.scores.size;
      }

      return new Response(JSON.stringify({
        leaderboard: topPlayers,
        count: topPlayers.length,
        totalPlayers,
        type, // Include type in response
        lastResetAt: this.metadata?.lastResetAt,
        resetCount: this.metadata?.resetCount
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get player's current rank and score
    if (path.endsWith("/player") && request.method === "GET") {
      const playerId = url.searchParams.get("playerId");

      if (!playerId) {
        return new Response(JSON.stringify({
          error: "Missing playerId"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const playerRecord = this.scores.get(playerId);
      const rank = this.getPlayerRank(playerId);

      // MVP 16: Include authentication info in player rank response
      return new Response(JSON.stringify({
        playerId,
        score: playerRecord?.score || 0,
        walnuts: playerRecord?.walnuts || { hidden: 0, found: 0 },
        rank: rank,
        totalPlayers: this.scores.size,
        // Authentication fields
        isAuthenticated: playerRecord?.isAuthenticated || false,
        emailVerified: playerRecord?.emailVerified || false,
        characterId: playerRecord?.characterId || 'squirrel'
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // MVP 9: Manual reset with admin authentication
    if (path.endsWith("/reset") && request.method === "POST") {
      return this.handleManualReset(request);
    }

    // MVP 9: Get reset history/archives
    if (path.endsWith("/archives") && request.method === "GET") {
      return this.handleGetArchives(request);
    }

    // MVP 9: Clean up corrupted entries
    if (path.endsWith("/cleanup") && request.method === "POST") {
      return this.handleCleanup(request);
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * MVP 9: Handle score report with anti-cheat validation
   * INDUSTRY STANDARD: Server-authoritative scoring with rate limiting
   */
  private async handleScoreReport(request: Request): Promise<Response> {
    try {
      const record = await request.json() as ScoreRecord;

      // Validate record structure
      if (!record.playerId || typeof record.score !== 'number') {
        console.error(`❌ Invalid score record:`, record);
        return new Response(JSON.stringify({
          error: "Invalid score record"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // ANTI-CHEAT: Validate score is reasonable
      if (record.score < 0 || record.score > this.MAX_SCORE_ABSOLUTE) {
        console.warn(`⚠️ Suspicious score detected: ${record.playerId} = ${record.score} (outside bounds)`);
        return new Response(JSON.stringify({
          error: "Invalid score value"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const existingRecord = this.scores.get(record.playerId);
      const now = Date.now();

      // ANTI-CHEAT: Rate limiting - check score increase rate
      if (existingRecord) {
        const scoreIncrease = record.score - existingRecord.score;
        const timeSinceLastUpdate = (now - existingRecord.updatedAt) / 1000 / 60; // minutes

        if (scoreIncrease > 0 && timeSinceLastUpdate > 0) {
          const scoreIncreasePerMinute = scoreIncrease / timeSinceLastUpdate;

          if (scoreIncreasePerMinute > this.MAX_SCORE_INCREASE_PER_MINUTE) {
            console.warn(`⚠️ Suspicious score increase rate: ${record.playerId} gained ${scoreIncrease} points in ${timeSinceLastUpdate.toFixed(2)} minutes (${scoreIncreasePerMinute.toFixed(2)} pts/min)`);
            return new Response(JSON.stringify({
              error: "Score increase rate too high"
            }), {
              status: 429,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
      }

      record.updatedAt = now;
      record.lastScoreIncrease = now;

      // MVP 16: Set defaults for authentication fields (backward compatibility)
      if (record.isAuthenticated === undefined) record.isAuthenticated = false;
      if (record.emailVerified === undefined) record.emailVerified = false;
      if (!record.characterId) record.characterId = 'squirrel'; // Default character

      // MVP 9: Update both weekly and all-time leaderboards
      // Weekly leaderboard (resets every Monday)
      this.scores.set(record.playerId, record);
      await this.storage.put(record.playerId, record);

      // All-time leaderboard (never resets)
      const existingAllTimeRecord = this.alltimeScores.get(record.playerId);
      if (!existingAllTimeRecord || record.score > existingAllTimeRecord.score) {
        // New high score or no existing record - update everything
        this.alltimeScores.set(record.playerId, record);
        await this.storage.put(`alltime_${record.playerId}`, record);
      } else {
        // Existing high score is better, but we MUST update metadata (auth, verified, character)
        // otherwise verified users might be hidden if their high score was set before verification
        existingAllTimeRecord.isAuthenticated = record.isAuthenticated;
        existingAllTimeRecord.emailVerified = record.emailVerified;
        existingAllTimeRecord.characterId = record.characterId;
        existingAllTimeRecord.updatedAt = now; // Update timestamp to show activity

        // We don't change the score, but we save the updated metadata
        this.alltimeScores.set(record.playerId, existingAllTimeRecord);
        await this.storage.put(`alltime_${record.playerId}`, existingAllTimeRecord);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Score updated"
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error(`❌ Leaderboard error:`, error);
      return new Response(JSON.stringify({
        error: "Failed to update score"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  /**
   * MVP 9: Manual reset with authentication and archival
   * INDUSTRY STANDARD: Archive before reset (PlayFab pattern)
   */
  private async handleManualReset(request: Request): Promise<Response> {
    try {
      // SECURITY: Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");

      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        console.warn(`⚠️ Unauthorized reset attempt`);
        return new Response(JSON.stringify({
          error: "Unauthorized - invalid admin secret"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      const body = await request.json().catch(() => ({})) as { note?: string };
      const adminNote = body.note;

      // Archive current leaderboard before reset
      const archiveKey = await this.archiveCurrentLeaderboard('manual', adminNote);

      // MVP 9: Reset weekly leaderboard only (preserve all-time and metadata)
      this.scores.clear();

      // Delete only weekly scores (not alltime_ prefixed or _metadata)
      const keysToDelete: string[] = [];
      const allKeys = await this.storage.list();
      for (const key of allKeys.keys()) {
        if (!key.startsWith('alltime_') && !key.startsWith('_')) {
          keysToDelete.push(key);
        }
      }
      await Promise.all(keysToDelete.map(key => this.storage.delete(key)));

      // Update metadata
      const newMetadata: LeaderboardMetadata = {
        lastResetAt: Date.now(),
        resetCount: (this.metadata?.resetCount || 0) + 1,
        createdAt: this.metadata?.createdAt || Date.now()
      };
      this.metadata = newMetadata;
      await this.storage.put('_metadata', newMetadata);

      console.log(`✅ Leaderboard manually reset (archived as: ${archiveKey})`);

      return new Response(JSON.stringify({
        success: true,
        message: "Leaderboard reset and archived",
        archiveKey,
        resetCount: newMetadata.resetCount
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error(`❌ Reset error:`, error);
      return new Response(JSON.stringify({
        error: "Failed to reset leaderboard"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  /**
   * MVP 9: Archive current leaderboard to KV storage
   * INDUSTRY STANDARD: Keep historical data for analysis and rewards
   */
  private async archiveCurrentLeaderboard(resetType: 'manual' | 'weekly' | 'monthly', adminNote?: string): Promise<string> {
    if (!this.env.LEADERBOARD_ARCHIVES) {
      console.warn(`⚠️ KV namespace not configured, skipping archive`);
      return 'no-archive';
    }

    const timestamp = Date.now();
    const isoDate = new Date(timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    const archiveKey = `${resetType}-${isoDate}-${timestamp}`;

    const archive: LeaderboardArchive = {
      timestamp,
      resetType,
      playerCount: this.scores.size,
      topPlayers: this.getTopPlayers(100), // Archive top 100
      adminNote
    };

    // Save to KV (automatically expires after retention period)
    await this.env.LEADERBOARD_ARCHIVES.put(archiveKey, JSON.stringify(archive), {
      expirationTtl: 86400 * 90 // Keep for 90 days
    });

    console.log(`📦 Archived leaderboard: ${archiveKey} (${archive.playerCount} players)`);

    // Clean up old archives (keep last N)
    await this.cleanupOldArchives();

    return archiveKey;
  }

  /**
   * MVP 9: Get archived leaderboards
   */
  private async handleGetArchives(request: Request): Promise<Response> {
    if (!this.env.LEADERBOARD_ARCHIVES) {
      return new Response(JSON.stringify({
        error: "Archives not configured"
      }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit") || "10");

      // List all archives
      const list = await this.env.LEADERBOARD_ARCHIVES.list({ limit });

      const archives = await Promise.all(
        list.keys.map(async (key) => {
          const data = await this.env.LEADERBOARD_ARCHIVES!.get(key.name, 'json') as LeaderboardArchive;
          return {
            key: key.name,
            ...data
          };
        })
      );

      return new Response(JSON.stringify({
        archives: archives.sort((a, b) => b.timestamp - a.timestamp),
        count: archives.length
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error(`❌ Failed to get archives:`, error);
      return new Response(JSON.stringify({
        error: "Failed to retrieve archives"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  /**
   * MVP 9: Clean up corrupted or stale entries
   * INDUSTRY STANDARD: Remove invalid/test data
   */
  private async handleCleanup(request: Request): Promise<Response> {
    try {
      // SECURITY: Require admin authentication
      const adminSecret = request.headers.get("X-Admin-Secret") || new URL(request.url).searchParams.get("admin_secret");

      if (!adminSecret || adminSecret !== this.env.ADMIN_SECRET) {
        return new Response(JSON.stringify({
          error: "Unauthorized"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      let removed = 0;
      const toRemove: string[] = [];

      // Find corrupted entries
      for (const [playerId, record] of this.scores) {
        // Remove entries with invalid data
        if (!record.score || !record.walnuts || record.score < 0) {
          toRemove.push(playerId);
          continue;
        }

        // Remove very old inactive entries (>90 days)
        const daysSinceUpdate = (Date.now() - record.updatedAt) / 1000 / 60 / 60 / 24;
        if (daysSinceUpdate > 90 && record.score === 0) {
          toRemove.push(playerId);
        }
      }

      // Remove identified entries
      for (const playerId of toRemove) {
        this.scores.delete(playerId);
        await this.storage.delete(playerId);
        removed++;
      }

      console.log(`🧹 Cleanup complete: removed ${removed} corrupted/stale entries`);

      return new Response(JSON.stringify({
        success: true,
        removed,
        remaining: this.scores.size
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error(`❌ Cleanup error:`, error);
      return new Response(JSON.stringify({
        error: "Failed to cleanup"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  /**
   * MVP 9: Clean up old archives (keep last N)
   */
  private async cleanupOldArchives(): Promise<void> {
    if (!this.env.LEADERBOARD_ARCHIVES) return;

    const limit = parseInt(this.env.LEADERBOARD_ARCHIVE_LIMIT || "12");
    const list = await this.env.LEADERBOARD_ARCHIVES.list();

    if (list.keys.length > limit) {
      // Sort by name (which includes timestamp)
      const sortedKeys = list.keys.sort((a, b) => a.name.localeCompare(b.name));

      // Remove oldest
      const toDelete = sortedKeys.slice(0, sortedKeys.length - limit);
      for (const key of toDelete) {
        await this.env.LEADERBOARD_ARCHIVES.delete(key.name);
        console.log(`🗑️ Deleted old archive: ${key.name}`);
      }
    }
  }

  /**
   * MVP 9: Scheduled reset handler (called by cron)
   * INDUSTRY STANDARD: Monday 00:00 UTC
   */
  async scheduledReset(): Promise<void> {
    if (this.env.LEADERBOARD_RESET_ENABLED !== "true") {
      console.log(`ℹ️ Scheduled reset disabled (LEADERBOARD_RESET_ENABLED=false)`);
      return;
    }

    console.log(`🔄 Starting scheduled weekly leaderboard reset...`);

    try {
      // Archive current leaderboard
      const archiveKey = await this.archiveCurrentLeaderboard('weekly');

      // MVP 9: Reset weekly leaderboard only (preserve all-time and metadata)
      this.scores.clear();

      // Delete only weekly scores (not alltime_ prefixed or _metadata)
      const keysToDelete: string[] = [];
      const allKeys = await this.storage.list();
      for (const key of allKeys.keys()) {
        if (!key.startsWith('alltime_') && !key.startsWith('_')) {
          keysToDelete.push(key);
        }
      }
      await Promise.all(keysToDelete.map(key => this.storage.delete(key)));

      // Update metadata
      const newMetadata: LeaderboardMetadata = {
        lastResetAt: Date.now(),
        resetCount: (this.metadata?.resetCount || 0) + 1,
        createdAt: this.metadata?.createdAt || Date.now()
      };
      this.metadata = newMetadata;
      await this.storage.put('_metadata', newMetadata);

      console.log(`✅ Scheduled reset complete (archived as: ${archiveKey})`);
    } catch (error) {
      console.error(`❌ Scheduled reset failed:`, error);
    }
  }

  // Get top players by score (MVP 9: Support both weekly and all-time)
  /**
   * MVP 16: Enhanced getTopPlayers with authentication filtering
   * @param limit - Number of players to return
   * @param scoresMap - Map of player scores
   * @param options - Filtering options
   *   - requireAuth: Only include authenticated players
   *   - authOnlyForTopN: First N positions restricted to authenticated players
   */
  private getTopPlayers(
    limit: number = 10,
    scoresMap: Map<string, ScoreRecord> = this.scores,
    options?: { requireAuth?: boolean; authOnlyForTopN?: number }
  ): Array<{
    playerId: string;
    score: number;
    walnuts: { hidden: number; found: number };
    rank: number;
    isAuthenticated?: boolean;
    emailVerified?: boolean;
    characterId?: string;
  }> {
    let players = Array.from(scoresMap.values());

    // Apply authentication filter if required
    if (options?.requireAuth) {
      players = players.filter(p => p.isAuthenticated);
    }

    // Sort by score
    players.sort((a, b) => b.score - a.score);

    // Apply top N authenticated filter if specified
    if (options?.authOnlyForTopN) {
      const topN = options.authOnlyForTopN;
      const authenticatedPlayers = players.filter(p => p.isAuthenticated);
      const unauthenticatedPlayers = players.filter(p => !p.isAuthenticated);

      // First N positions: authenticated only
      const topNAuth = authenticatedPlayers.slice(0, topN);
      // Remaining positions: fill with unauthenticated players
      const remainingAuth = authenticatedPlayers.slice(topN);
      const remaining = [...remainingAuth, ...unauthenticatedPlayers];

      players = [...topNAuth, ...remaining];
    }

    // Take limit and add rank
    const sortedPlayers = players.slice(0, limit).map((record, index) => ({
      playerId: record.playerId,
      score: record.score,
      walnuts: record.walnuts,
      rank: index + 1,
      isAuthenticated: record.isAuthenticated,
      emailVerified: record.emailVerified,
      characterId: record.characterId
    }));

    return sortedPlayers;
  }

  // Get a player's current rank
  private getPlayerRank(playerId: string): number {
    const playerRecord = this.scores.get(playerId);
    if (!playerRecord) {
      return -1; // Player not found
    }

    const sortedScores = Array.from(this.scores.values())
      .sort((a, b) => b.score - a.score);

    const rank = sortedScores.findIndex(record => record.playerId === playerId);
    return rank >= 0 ? rank + 1 : -1;
  }

  // Load weekly scores from storage
  private async loadScores(): Promise<void> {
    try {
      const scoresMap = await this.storage.list<ScoreRecord>({ prefix: '' });
      // Filter out metadata and alltime scores
      for (const [key, value] of scoresMap) {
        if (!key.startsWith('_') && !key.startsWith('alltime_')) {
          this.scores.set(key, value);
        }
      }
    } catch (error) {
      console.error('Error loading weekly scores from storage:', error);
    }
  }

  // MVP 9: Load all-time scores from storage
  private async loadAllTimeScores(): Promise<void> {
    try {
      const alltimeScoresMap = await this.storage.list<ScoreRecord>({ prefix: 'alltime_' });
      for (const [key, value] of alltimeScoresMap) {
        // Remove the 'alltime_' prefix when storing in map
        const playerId = key.replace('alltime_', '');
        this.alltimeScores.set(playerId, value);
      }
    } catch (error) {
      console.error('Error loading all-time scores from storage:', error);
    }
  }

  // Load metadata from storage
  private async loadMetadata(): Promise<void> {
    try {
      this.metadata = await this.storage.get<LeaderboardMetadata>('_metadata');
      if (!this.metadata) {
        // Initialize metadata if not exists
        this.metadata = {
          createdAt: Date.now(),
          lastResetAt: 0,
          resetCount: 0
        };
        await this.storage.put('_metadata', this.metadata);
      }
    } catch (error) {
      console.error('Error loading metadata from storage:', error);
    }
  }
}
