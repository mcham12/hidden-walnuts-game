// Game-wide constants for Hidden Walnuts

/**
 * Duration of a single forest cycle in seconds (24 hours)
 */
export const CYCLE_DURATION_SECONDS = 86400; // 24 hours in seconds

/**
 * Interval at which participation multiplier increases (5 minutes)
 */
export const PARTICIPATION_INTERVAL_SECONDS = 300;

/**
 * Maximum participation multiplier a player can achieve (2.0x)
 */
export const PARTICIPATION_MAX_MULTIPLIER = 2.0;

/**
 * How often Nut Rush events occur (every 4 hours)
 */
export const NUT_RUSH_INTERVAL_HOURS = 4;

/**
 * Duration of each Nut Rush event (10 minutes)
 */
export const NUT_RUSH_DURATION_MINUTES = 10;

/**
 * Point values for different game actions and walnut types
 */
export const POINTS = {
  /** Points for finding a game-hidden walnut that was buried (3 points) */
  GAME_BURIED: 3,
  
  /** Points for finding a game-hidden walnut in a bush (1 point) */
  GAME_BUSH: 1,
  
  /** Points for finding a player-hidden walnut that was buried (2 points) */
  PLAYER_BURIED: 2,
  
  /** Points for finding a player-hidden walnut in a bush (1 point) */
  PLAYER_BUSH: 1,
  
  /** Bonus points for each walnut hidden by player that remains unfound at cycle end (1 point) */
  BONUS_UNFOUND: 1,
  
  /** Bonus points for being the first player to find 10 walnuts in a cycle (3 points) */
  FIRST_FINDER: 3
};

/**
 * Default power-ups given to players when they join
 */
export const DEFAULT_POWERUPS = ["ScentSniff", "FastDig", "DecoyNut"];

export const TERRAIN_SIZE = 200; // Terrain width and depth in units
export const TERRAIN_HEIGHT = 20; // Maximum terrain height in units
