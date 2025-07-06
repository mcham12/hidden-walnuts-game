import { InputComponent } from '../ecs';
import { CharacterConfig } from './CharacterTypes';
import { AnimationController } from '../core/AnimationController';

/**
 * Player Animation State
 * Represents the current animation state of a player character
 */
export enum PlayerAnimationState {
  // Core movement states
  IDLE_A = 'idle_a',
  IDLE_B = 'idle_b', 
  IDLE_C = 'idle_c',
  WALK = 'walk',
  RUN = 'run',
  JUMP = 'jump',
  
  // Advanced movement states
  SWIM = 'swim',
  FLY = 'fly',
  ROLL = 'roll',
  BOUNCE = 'bounce',
  SPIN = 'spin',
  
  // Action states
  EAT = 'eat',
  CLICKED = 'clicked',
  FEAR = 'fear',
  DEATH = 'death',
  SIT = 'sit'
}

/**
 * Animation Transition
 * Defines a transition between animation states
 */
export interface AnimationTransition {
  from: PlayerAnimationState;
  to: PlayerAnimationState;
  condition: (input: InputComponent) => boolean;
  blendTime: number;
  priority: number;
}

/**
 * Player Animation Controller
 * Manages player-specific animation states and transitions
 */
export interface IPlayerAnimationController {
  // Core animation control
  update(deltaTime: number, input: InputComponent): void;
  playAnimation(state: PlayerAnimationState): boolean;
  stopAnimation(): void;
  pauseAnimation(): void;
  resumeAnimation(): void;
  
  // State management
  getCurrentState(): PlayerAnimationState;
  getPreviousState(): PlayerAnimationState;
  isPlaying(): boolean;
  isPaused(): boolean;
  
  // Configuration
  setBlendTime(time: number): void;
  getBlendTime(): number;
  setTimeScale(scale: number): void;
  getTimeScale(): number;
  
  // Character-specific
  getCharacterConfig(): CharacterConfig;
  getAnimationController(): AnimationController;
  
  // Cleanup
  dispose(): void;
}

/**
 * Animation State Machine
 * Manages animation state transitions and conditions
 */
export interface IAnimationStateMachine {
  // State management
  getCurrentState(): PlayerAnimationState;
  setCurrentState(state: PlayerAnimationState): void;
  
  // Transitions
  addTransition(transition: AnimationTransition): void;
  removeTransition(from: PlayerAnimationState, to: PlayerAnimationState): void;
  getTransitions(): AnimationTransition[];
  
  // Evaluation
  evaluateTransitions(input: InputComponent): PlayerAnimationState | null;
  canTransitionTo(state: PlayerAnimationState): boolean;
  
  // Configuration
  setDefaultBlendTime(time: number): void;
  getDefaultBlendTime(): number;
}

/**
 * Player Animation Event
 * Fired when player animation state changes
 */
export interface PlayerAnimationEvent {
  playerId: string;
  characterType: string;
  fromState: PlayerAnimationState;
  toState: PlayerAnimationState;
  timestamp: number;
  input?: InputComponent;
}

/**
 * Player Animation Metrics
 * Performance metrics for player animation system
 */
export interface PlayerAnimationMetrics {
  totalControllers: number;
  activeAnimations: number;
  stateTransitions: number;
  averageUpdateTime: number;
  frameRate: number;
  memoryUsage: number;
}

/**
 * Player Animation Configuration
 * Settings for player animation system behavior
 */
export interface PlayerAnimationConfig {
  defaultBlendTime: number;
  idleVariationInterval: number;
  movementThreshold: number;
  enableBlendshapes: boolean;
  performanceMode: 'high' | 'medium' | 'low';
  logStateChanges: boolean;
}

/**
 * Input Animation Mapping
 * Maps input states to animation states
 */
export interface InputAnimationMapping {
  // Movement inputs
  forward: PlayerAnimationState;
  backward: PlayerAnimationState;
  turnLeft: PlayerAnimationState;
  turnRight: PlayerAnimationState;
  
  // Combined inputs
  forwardLeft: PlayerAnimationState;
  forwardRight: PlayerAnimationState;
  backwardLeft: PlayerAnimationState;
  backwardRight: PlayerAnimationState;
  
  // Action inputs
  action: PlayerAnimationState;
  special: PlayerAnimationState;
  
  // Idle variations
  idleVariations: PlayerAnimationState[];
}

/**
 * Character Animation Mapping
 * Maps character types to their animation configurations
 */
export interface CharacterAnimationMapping {
  characterType: string;
  config: CharacterConfig;
  inputMapping: InputAnimationMapping;
  defaultState: PlayerAnimationState;
  fallbackAnimations: Map<PlayerAnimationState, string>;
} 