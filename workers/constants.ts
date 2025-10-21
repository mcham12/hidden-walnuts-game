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

export const TREE_COUNT = 50; // Number of trees in the forest
export const SHRUB_COUNT = 100; // Number of shrubs in the forest

/**
 * Authoritative Server Architecture - Anti-Cheat Constants
 * MVP 7 Task 6: Speed limits and validation rules
 */
export const ANTI_CHEAT = {
  /** Maximum movement speed in units per second (matches client MovementConfig) */
  MAX_MOVE_SPEED: 5.0,
  
  /** Maximum allowed teleportation distance in units (prevents impossible jumps) */
  MAX_TELEPORT_DISTANCE: 10.0,
  
  /** Maximum acceleration in units per second squared */
  MAX_ACCELERATION: 20.0,
  
  /** Minimum time between position updates in milliseconds (prevents spam) */
  MIN_UPDATE_INTERVAL: 50, // 20Hz max update rate
  
  /** Maximum position update rate in Hz */
  MAX_UPDATE_RATE: 20,
  
  /** Tolerance for speed violations (allows for network jitter) */
  SPEED_TOLERANCE: 1.2, // 20% tolerance
  
  /** Number of violations before player is flagged */
  MAX_VIOLATIONS_BEFORE_FLAG: 3,
  
  /** Time window for tracking violations in milliseconds */
  VIOLATION_WINDOW: 30000, // 30 seconds
  
  /** Maximum Y coordinate (prevents flying) */
  MAX_Y_COORDINATE: 50,
  
  /** Minimum Y coordinate (prevents going underground) */
  MIN_Y_COORDINATE: -5,
  
  /** World bounds for X and Z coordinates */
  WORLD_BOUNDS: {
    MIN_X: -100,
    MAX_X: 100,
    MIN_Z: -100,
    MAX_Z: 100
  }
};

/**
 * Movement validation thresholds
 */
export const MOVEMENT_VALIDATION = {
  /** Maximum distance a player can move in one update */
  MAX_SINGLE_UPDATE_DISTANCE: 2.0,
  
  /** Minimum time between position updates for speed calculation */
  MIN_TIME_FOR_SPEED_CALC: 0.05, // 50ms
  
  /** Maximum allowed speed for short time periods (burst movement) */
  MAX_BURST_SPEED: 8.0,
  
  /** Time window for burst speed validation */
  BURST_SPEED_WINDOW: 0.1 // 100ms
};
