import * as THREE from 'three';

/**
 * Character Configuration Interface
 * Defines all properties needed for any animal character type
 */
export interface CharacterConfig {
  id: string;                    // Unique identifier (e.g., 'colobus', 'gecko')
  name: string;                  // Display name (e.g., 'Colobus', 'Gecko')
  modelPath: string;             // Asset path (e.g., '/assets/models/Colobus_LOD0.glb')
  scale: number;                 // Model scale per animal type
  lodPaths: {
    lod0: string;                // High detail model
    lod1: string;                // Medium detail model
    lod2: string;                // Low detail model
    lod3: string;                // Minimal detail model
  };
  animations: {
    // Core animations
    idle_a: string;              // Idle animation variation A
    idle_b: string;              // Idle animation variation B
    idle_c: string;              // Idle animation variation C
    walk: string;                // Walking animation
    run: string;                 // Running animation
    jump: string;                // Jumping animation
    
    // Movement animations
    swim: string;                // Swimming animation
    fly: string;                 // Flying animation
    roll: string;                // Rolling animation
    bounce: string;              // Bouncing animation
    spin: string;                // Spinning animation
    
    // Action animations
    eat: string;                 // Eating animation
    clicked: string;             // Clicked/reaction animation
    fear: string;                // Fear/scared animation
    death: string;               // Death animation
    sit: string;                 // Sitting animation
    
    // Special animations (not all animals have these)
    attack?: string;             // Attack animation
    hit?: string;                // Hit/damage animation
    splash?: string;             // Splash animation (for water animals)
  };
  blendshapes: {
    // Eye expressions
    eyes_blink: string;
    eyes_happy: string;
    eyes_sad: string;
    eyes_annoyed: string;
    eyes_squint: string;
    eyes_shrink: string;
    eyes_dead: string;
    eyes_lookOut: string;
    eyes_lookIn: string;
    eyes_lookUp: string;
    eyes_lookDown: string;
    eyes_excited_1: string;
    eyes_excited_2: string;
    eyes_rabid: string;
    eyes_spin_1: string;
    eyes_spin_2: string;
    eyes_spin_3: string;
    eyes_cry_1: string;
    eyes_cry_2: string;
    eyes_trauma: string;
    
    // Tear and sweat effects
    teardrop_1_L: string;
    teardrop_2_L: string;
    teardrop_1_R: string;
    teardrop_2_R: string;
    sweat_1_L: string;
    sweat_2_L: string;
    sweat_1_R: string;
    sweat_2_R: string;
  };
  behaviors: {
    isPlayer: boolean;           // Can be used as player character
    isNPC: boolean;              // Can be used as NPC
    movementSpeed: number;       // Movement speed multiplier
    jumpHeight: number;          // Jump height multiplier
    canSwim: boolean;            // Whether this animal can swim
    canFly: boolean;             // Whether this animal can fly
    aiBehaviors: string[];       // Available AI behaviors
  };
  network: {
    syncAnimations: boolean;     // Whether to sync animations over network
    compressionLevel: number;    // Animation data compression (0-1)
  };
}

/**
 * Character Animation State
 * Represents the current animation state of a character
 */
export interface CharacterAnimationState {
  currentAnimation: string;      // Current animation name
  previousAnimation: string;     // Previous animation name
  transitionTime: number;        // Time for animation transition
  loop: boolean;                 // Whether animation should loop
  speed: number;                 // Animation playback speed
  blendWeight: number;           // Blend weight for smooth transitions
}

/**
 * Character Instance
 * Represents a specific character instance in the game
 */
export interface CharacterInstance {
  id: string;                    // Unique instance ID
  characterType: string;         // Character type ID (matches CharacterConfig.id)
  config: CharacterConfig;       // Character configuration
  model: THREE.Object3D;         // Three.js model object
  mixer?: THREE.AnimationMixer;  // Animation mixer for this character
  actions: Map<string, THREE.AnimationAction>; // Animation actions
  currentLOD: number;            // Current level of detail (0-3)
  animationState: CharacterAnimationState; // Current animation state
  isVisible: boolean;            // Whether character is visible
  lastUpdate: number;            // Last update timestamp
}

/**
 * Character Selection Event
 * Emitted when a player selects a character
 */
export interface CharacterSelectionEvent {
  playerId: string;
  characterType: string;
  characterConfig: CharacterConfig;
}

/**
 * Character Animation Event
 * Emitted when a character's animation changes
 */
export interface CharacterAnimationEvent {
  characterId: string;
  animationName: string;
  loop: boolean;
  speed: number;
  timestamp: number;
}

/**
 * Character AI Behavior Types
 */
export enum AIBehaviorType {
  PATROL = 'patrol',
  FORAGE = 'forage',
  SOCIALIZE = 'socialize',
  FLEE = 'flee',
  HUNT = 'hunt',
  REST = 'rest',
  TERRITORIAL = 'territorial',
  CURIOUS = 'curious'
}

/**
 * Character Type Categories
 */
export enum CharacterCategory {
  MAMMAL = 'mammal',
  BIRD = 'bird',
  REPTILE = 'reptile',
  FISH = 'fish',
  AMPHIBIAN = 'amphibian'
}

/**
 * Level of Detail (LOD) Distances
 */
export interface LODConfig {
  lod0Distance: number;  // High detail distance
  lod1Distance: number;  // Medium detail distance  
  lod2Distance: number;  // Low detail distance
  lod3Distance: number;  // Minimal detail distance
} 