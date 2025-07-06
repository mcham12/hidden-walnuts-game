import * as THREE from 'three';
import { CharacterConfig } from './CharacterTypes';

/**
 * Animated Model Interface
 * Represents a fully loaded animated character model
 */
export interface AnimatedModel {
  model: THREE.Object3D;                          // Three.js model object
  mixer: THREE.AnimationMixer;                    // Animation mixer for this model
  animations: Map<string, THREE.AnimationClip>;  // Animation clips by name
  blendshapes: Map<string, THREE.MorphTarget>;   // Blendshapes/morph targets by name
  characterType: string;                         // Character type ID
  config: CharacterConfig;                       // Character configuration
  lodLevel: number;                              // Current LOD level (0-3)
  isLoaded: boolean;                             // Loading state
  isValid: boolean;                              // Validation state
}

/**
 * Animation Action State
 * Represents the current state of a specific animation action
 */
export interface AnimationActionState {
  action: THREE.AnimationAction;   // Three.js animation action
  name: string;                    // Animation name
  weight: number;                  // Blend weight (0-1)
  isActive: boolean;               // Whether action is playing
  loop: boolean;                   // Whether animation loops
  timeScale: number;               // Playback speed multiplier
  fadeDuration: number;            // Fade in/out duration
  priority: number;                // Animation priority (higher = more important)
}

/**
 * Blendshape State
 * Represents the current state of facial expressions/blendshapes
 */
export interface BlendshapeState {
  name: string;                    // Blendshape name
  weight: number;                  // Current weight (0-1)
  targetWeight: number;            // Target weight for animations
  animationDuration: number;       // Duration for weight changes
  isAnimating: boolean;            // Whether currently animating
}

/**
 * Animation Category Types
 */
export enum AnimationCategory {
  IDLE = 'idle',
  MOVEMENT = 'movement',
  ACTION = 'action',
  TRICK = 'trick',
  COMBAT = 'combat',
  SPECIAL = 'special'
}

/**
 * Animation Priority Levels
 */
export enum AnimationPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 15
}

/**
 * Animation Transition Settings
 */
export interface AnimationTransition {
  fromAnimation: string;           // Source animation
  toAnimation: string;             // Target animation
  blendDuration: number;           // Transition duration in seconds
  blendMode: 'normal' | 'additive' | 'multiply'; // Blend mode
  curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'; // Transition curve
}

/**
 * Animation Event
 * Fired when animations change state
 */
export interface AnimationEvent {
  characterId: string;             // Character instance ID
  animationName: string;           // Animation that changed
  eventType: 'start' | 'loop' | 'finish' | 'interrupt'; // Event type
  timestamp: number;               // When event occurred
  metadata?: any;                  // Optional event data
}

/**
 * Animation Performance Metrics
 */
export interface AnimationMetrics {
  activeAnimations: number;        // Currently playing animations
  totalMixers: number;             // Total animation mixers
  memoryUsage: number;             // Memory used by animations (bytes)
  updateTime: number;              // Time spent updating animations (ms)
  frameRate: number;               // Current animation frame rate
  droppedFrames: number;           // Frames dropped due to performance
}

/**
 * Animation Configuration
 * Settings for animation system behavior
 */
export interface AnimationConfig {
  defaultBlendTime: number;        // Default transition time (seconds)
  maxActiveAnimations: number;     // Maximum simultaneous animations
  enableBlendshapes: boolean;      // Whether to enable facial expressions
  performanceMode: 'high' | 'medium' | 'low'; // Performance optimization level
  cacheAnimations: boolean;        // Whether to cache animation data
  logAnimationEvents: boolean;     // Whether to log animation events
}

/**
 * LOD Animation Settings
 * Different animation quality levels based on distance
 */
export interface LODAnimationSettings {
  lod0: {                          // High detail (close)
    enableAllAnimations: boolean;
    enableBlendshapes: boolean;
    updateRate: number;            // Updates per second
  };
  lod1: {                          // Medium detail
    enableAllAnimations: boolean;
    enableBlendshapes: boolean;
    updateRate: number;
  };
  lod2: {                          // Low detail
    enableCoreAnimations: boolean;
    enableBlendshapes: boolean;
    updateRate: number;
  };
  lod3: {                          // Minimal detail (far)
    enableCoreAnimations: boolean;
    enableBlendshapes: boolean;
    updateRate: number;
  };
}

/**
 * Animation Validation Result
 */
export interface AnimationValidationResult {
  isValid: boolean;                // Overall validation result
  hasRequiredAnimations: boolean;  // Has all required animations
  hasValidBones: boolean;          // Has valid bone structure
  hasValidMixer: boolean;          // Has valid animation mixer
  missingAnimations: string[];     // List of missing required animations
  warnings: string[];              // Non-critical warnings
  errors: string[];                // Critical errors
}

/**
 * Animation Cache Entry
 */
export interface AnimationCacheEntry {
  path: string;                    // Model file path
  characterType: string;           // Character type
  lodLevel: number;                // LOD level
  animatedModel: AnimatedModel;    // Cached animated model
  lastAccessed: number;            // Last access timestamp
  accessCount: number;             // Number of times accessed
  memorySize: number;              // Memory size in bytes
}

/**
 * Animation Loading Options
 */
export interface AnimationLoadingOptions {
  characterType: string;           // Character type to load
  lodLevel?: number;               // LOD level (default: 0)
  enableCaching?: boolean;         // Enable animation caching
  validateModel?: boolean;         // Validate model after loading
  preloadAnimations?: boolean;     // Preload all animations
  enableBlendshapes?: boolean;     // Enable blendshape extraction
  customScale?: number;            // Override character scale
}

/**
 * Animation Update Data
 * Used for network synchronization
 */
export interface AnimationUpdateData {
  characterId: string;             // Character instance ID
  animationName: string;           // Current animation
  progress: number;                // Animation progress (0-1)
  loop: boolean;                   // Whether animation loops
  timeScale: number;               // Playback speed
  blendshapes?: { [key: string]: number }; // Blendshape weights
  timestamp: number;               // Update timestamp
}

/**
 * Animation Controller Interface
 * Main interface for controlling character animations
 */
export interface IAnimationController {
  // Core animation control
  playAnimation(name: string, options?: AnimationPlayOptions): boolean;
  stopAnimation(): void;
  pauseAnimation(): void;
  resumeAnimation(): void;
  update(deltaTime: number): void;
  
  // Animation state
  getCurrentAnimation(): string | null;
  isPlaying(): boolean;
  isPaused(): boolean;
  getAnimationProgress(): number;
  
  // Blendshape control
  setBlendshape(name: string, weight: number): void;
  getBlendshape(name: string): number;
  animateBlendshape(name: string, targetWeight: number, duration: number): void;
  resetBlendshapes(): void;
  
  // Configuration
  setBlendTime(time: number): void;
  getBlendTime(): number;
  setTimeScale(scale: number): void;
  getTimeScale(): number;
  
  // Events
  addEventListener(eventType: string, callback: (event: AnimationEvent) => void): void;
  removeEventListener(eventType: string, callback: (event: AnimationEvent) => void): void;
  
  // Performance
  getMetrics(): AnimationMetrics;
  setPerformanceMode(mode: 'high' | 'medium' | 'low'): void;
}

/**
 * Animation Play Options
 */
export interface AnimationPlayOptions {
  blendTime?: number;              // Override default blend time
  loop?: boolean;                  // Override default loop setting
  timeScale?: number;              // Override default time scale
  priority?: AnimationPriority;    // Animation priority
  interrupting?: boolean;          // Whether to interrupt current animation
  fadeIn?: number;                 // Fade in duration
  fadeOut?: number;                // Fade out duration
} 