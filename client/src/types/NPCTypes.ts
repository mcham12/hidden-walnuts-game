import { Vector3 } from '../core/types';
import { CharacterConfig } from './CharacterTypes';

/**
 * NPC Behavior Interface
 * Defines a single NPC behavior pattern
 */
export interface NPCBehavior {
  type: 'patrol' | 'forage' | 'socialize' | 'flee' | 'idle' | 'hunt' | 'rest' | 'territorial' | 'curious';
  priority: number; // Higher priority behaviors take precedence
  duration: number; // How long this behavior should last (in seconds)
  conditions: (npc: NPC, world: WorldState) => boolean; // When this behavior should activate
  execute: (npc: NPC, deltaTime: number) => void; // Behavior execution logic
  onStart?: (npc: NPC) => void; // Called when behavior starts
  onEnd?: (npc: NPC) => void; // Called when behavior ends
}

/**
 * NPC Entity Interface
 * Represents an NPC character in the game world
 */
export interface NPC {
  id: string;
  characterType: string;
  config: CharacterConfig;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  health: number;
  energy: number;
  mood: number; // -100 to 100, affects behavior selection
  lastBehaviorChange: number;
  currentBehavior: NPCBehavior | null;
  behaviorTimer: number;
  targetPosition: Vector3 | null;
  path: Vector3[];
  socialGroup: string | null;
  personality: NPCPersonality;
  memory: NPCMemory;
  isVisible: boolean;
  lastUpdate: number;
}

/**
 * NPC Personality
 * Defines individual NPC characteristics
 */
export interface NPCPersonality {
  sociability: number; // 0-100, how much they like socializing
  curiosity: number; // 0-100, how much they explore
  aggression: number; // 0-100, how aggressive they are
  fearfulness: number; // 0-100, how easily they get scared
  territoriality: number; // 0-100, how territorial they are
  energyLevel: number; // 0-100, how active they are
}

/**
 * NPC Memory
 * Stores information about past interactions and experiences
 */
export interface NPCMemory {
  knownPlayers: Map<string, PlayerMemory>;
  knownNPCs: Map<string, NPCMemory>;
  favoriteLocations: Vector3[];
  dangerousAreas: Vector3[];
  lastSeenPlayers: Map<string, number>; // playerId -> timestamp
  lastSeenNPCs: Map<string, number>; // npcId -> timestamp
  positiveExperiences: number;
  negativeExperiences: number;
}

/**
 * Player Memory (for NPCs)
 * What NPCs remember about players
 */
export interface PlayerMemory {
  playerId: string;
  lastInteraction: number;
  interactionCount: number;
  isFriendly: boolean;
  isThreatening: boolean;
  lastKnownPosition: Vector3;
}

/**
 * World State
 * Current state of the game world for NPC decision making
 */
export interface WorldState {
  players: Map<string, PlayerState>;
  npcs: Map<string, NPC>;
  timeOfDay: number; // 0-24 hours
  weather: 'clear' | 'rainy' | 'stormy';
  temperature: number;
  visibility: number; // 0-100
  dangerLevel: number; // 0-100
}

/**
 * Player State (for NPC awareness)
 */
export interface PlayerState {
  playerId: string;
  position: Vector3;
  rotation: Vector3;
  characterType: string;
  isLocalPlayer: boolean;
  lastUpdate: number;
}

/**
 * Pathfinding Grid
 * For efficient pathfinding calculations
 */
export interface PathfindingGrid {
  width: number;
  height: number;
  cellSize: number;
  walkable: boolean[][];
  heightMap: number[][];
}

/**
 * NPC Spawn Point
 * Location where NPCs can spawn
 */
export interface NPCSpawnPoint {
  position: Vector3;
  characterTypes: string[]; // Which character types can spawn here
  spawnRadius: number;
  maxNPCs: number;
  spawnRate: number; // NPCs per minute
  lastSpawn: number;
}

/**
 * NPC Social Interaction
 * Represents an interaction between NPCs
 */
export interface NPCSocialInteraction {
  npc1Id: string;
  npc2Id: string;
  type: 'greeting' | 'play' | 'fight' | 'mating' | 'territorial';
  duration: number;
  startTime: number;
  intensity: number; // 0-100
}

/**
 * NPC Behavior Metrics
 * Performance tracking for NPC behaviors
 */
export interface NPCBehaviorMetrics {
  totalNPCs: number;
  activeBehaviors: Map<string, number>; // behavior type -> count
  averageBehaviorDuration: number;
  behaviorTransitions: number;
  pathfindingRequests: number;
  socialInteractions: number;
  performanceImpact: number; // 0-100, higher = more performance impact
}

/**
 * NPC System Configuration
 */
export interface NPCSystemConfig {
  maxNPCs: number;
  spawnRate: number; // NPCs per minute
  behaviorUpdateRate: number; // Hz
  pathfindingUpdateRate: number; // Hz
  socialInteractionRange: number;
  playerDetectionRange: number;
  performanceMode: 'high' | 'medium' | 'low';
  enableSocialInteractions: boolean;
  enablePathfinding: boolean;
  enableCharacterSpecificBehaviors: boolean;
}

/**
 * NPC Animation State
 * Tracks NPC animation state for smooth transitions
 */
export interface NPCAnimationState {
  currentAnimation: string;
  targetAnimation: string;
  transitionProgress: number;
  blendWeight: number;
  speed: number;
  loop: boolean;
}

/**
 * NPC Movement State
 * Tracks NPC movement for smooth locomotion
 */
export interface NPCMovementState {
  isMoving: boolean;
  targetPosition: Vector3 | null;
  path: Vector3[];
  pathIndex: number;
  movementSpeed: number;
  rotationSpeed: number;
  isStuck: boolean;
  stuckTimer: number;
} 