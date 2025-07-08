import * as THREE from 'three';
import { InputComponent } from '../ecs';
import { CharacterConfig } from '../types/CharacterTypes';
import { AnimationController } from '../core/AnimationController';
import { 
  IPlayerAnimationController, 
  PlayerAnimationState, 
  PlayerAnimationEvent 
} from '../types/PlayerAnimationTypes';
import { AnimationStateMachine } from './AnimationStateMachine';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

/**
 * Player Animation Controller
 * Manages player-specific animation states and transitions
 */
export class PlayerAnimationController implements IPlayerAnimationController {
  private animationController: AnimationController;
  private characterConfig: CharacterConfig;
  private stateMachine: AnimationStateMachine;
  private currentState: PlayerAnimationState;
  private previousState: PlayerAnimationState;
  private inputState: InputComponent | null = null;
  private _isPaused: boolean = false;
  private blendTime: number = 0.3;
  private timeScale: number = 1.0;
  private idleVariationTimer: number = 0;
  private idleVariationInterval: number = 5.0; // 5 seconds
  private playerId: string;
  private eventBus: EventBus;

  constructor(
    characterConfig: CharacterConfig, 
    model: THREE.Object3D,
    playerId: string,
    eventBus: EventBus
  ) {
    this.characterConfig = characterConfig;
    this.playerId = playerId;
    this.eventBus = eventBus;
    
    // Create animation controller
    this.animationController = new AnimationController(model, characterConfig, playerId);
    
    // Create state machine
    this.stateMachine = new AnimationStateMachine(PlayerAnimationState.IDLE_A);
    this.currentState = PlayerAnimationState.IDLE_A;
    this.previousState = PlayerAnimationState.IDLE_A;
    
    // Setup transitions
    this.setupDefaultTransitions();
    
    Logger.info(LogCategory.CORE, `[PlayerAnimationController] Initialized for player: ${playerId} (${characterConfig.name})`);
  }

  /**
   * Update animation controller
   */
  update(deltaTime: number, input: InputComponent): void {
    if (this._isPaused) return;

    this.inputState = input;
    
    // Update idle variation timer
    this.updateIdleVariations(deltaTime);
    
    // Determine new animation state
    const newState = this.determineAnimationState(input);
    
    // Transition to new state if needed
    if (newState && newState !== this.currentState) {
      this.transitionToAnimation(newState);
    }
    
    // Update animation controller
    this.animationController.update(deltaTime);
  }

  /**
   * Play specific animation state with error handling
   */
  playAnimation(state: PlayerAnimationState): boolean {
    try {
      const animationName = this.getAnimationNameForState(state);
      if (!animationName) {
        Logger.warn(LogCategory.CORE, `[PlayerAnimationController] No animation found for state: ${state}`);
        return false;
      }

      const success = this.animationController.playAnimation(animationName, {
        blendTime: this.blendTime,
        timeScale: this.timeScale
      });

      if (success) {
        this.previousState = this.currentState;
        this.currentState = state;
        this.stateMachine.transitionTo(state);
        
        // Fire event
        this.fireAnimationEvent(this.previousState, state);
        
        Logger.debug(LogCategory.CORE, `[PlayerAnimationController] Successfully played animation: ${animationName} for state: ${state}`);
      } else {
        Logger.warn(LogCategory.CORE, `[PlayerAnimationController] Failed to play animation: ${animationName} for state: ${state}`);
      }

      return success;
    } catch (error) {
      Logger.error(LogCategory.CORE, `[PlayerAnimationController] Error playing animation for state ${state}:`, error);
      return false;
    }
  }

  /**
   * Stop current animation
   */
  stopAnimation(): void {
    this.animationController.stopAnimation();
    this.currentState = PlayerAnimationState.IDLE_A;
    this.stateMachine.transitionTo(PlayerAnimationState.IDLE_A);
  }

  /**
   * Pause current animation
   */
  pauseAnimation(): void {
    this.animationController.pauseAnimation();
    this._isPaused = true;
  }

  /**
   * Resume current animation
   */
  resumeAnimation(): void {
    this.animationController.resumeAnimation();
    this._isPaused = false;
  }

  /**
   * Get current animation state
   */
  getCurrentState(): PlayerAnimationState {
    return this.currentState;
  }

  /**
   * Get previous animation state
   */
  getPreviousState(): PlayerAnimationState {
    return this.previousState;
  }

  /**
   * Check if animation is playing
   */
  isPlaying(): boolean {
    return this.animationController.isPlaying() && !this._isPaused;
  }

  /**
   * Check if animation is paused
   */
  isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Set blend time
   */
  setBlendTime(time: number): void {
    this.blendTime = Math.max(0, time);
    this.stateMachine.setBlendTime(time);
  }

  /**
   * Get blend time
   */
  getBlendTime(): number {
    return this.blendTime;
  }

  /**
   * Set time scale
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
    this.animationController.setTimeScale(scale);
  }

  /**
   * Get time scale
   */
  getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * Get character configuration
   */
  getCharacterConfig(): CharacterConfig {
    return this.characterConfig;
  }

  /**
   * Get animation controller
   */
  getAnimationController(): AnimationController {
    return this.animationController;
  }

  /**
   * FIXED: Handle character change event
   */
  onCharacterChanged(): void {
    Logger.debug(LogCategory.CORE, `[PlayerAnimationController] Character changed for player: ${this.playerId}`);
    
    // Reset animation state for new character
    this.currentState = PlayerAnimationState.IDLE_A;
    this.previousState = PlayerAnimationState.IDLE_A;
    this.idleVariationTimer = 0;
    
    // Reinitialize animation controller for new character
    this.animationController.reinitializeAnimations();
    
    // Fire character change event
    this.eventBus.emit('player:character_changed', {
      playerId: this.playerId,
      characterType: this.characterConfig.id,
      timestamp: performance.now()
    });
  }

  /**
   * FIXED: Handle animation ready event
   */
  onAnimationReady(): void {
    Logger.debug(LogCategory.CORE, `[PlayerAnimationController] Animation ready for player: ${this.playerId}`);
    
    // Start with idle animation
    this.playAnimation(PlayerAnimationState.IDLE_A);
    
    // Fire animation ready event
    this.eventBus.emit('player:animation_ready', {
      playerId: this.playerId,
      characterType: this.characterConfig.id,
      timestamp: performance.now()
    });
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.animationController.dispose();
    Logger.info(LogCategory.CORE, `[PlayerAnimationController] Disposed controller for player: ${this.playerId}`);
  }

  /**
   * Determine animation state based on input
   */
  private determineAnimationState(input: InputComponent): PlayerAnimationState {
    // Check for movement input
    if (input.forward || input.backward || input.turnLeft || input.turnRight) {
      return this.handleMovementAnimations(input);
    }
    
    // Check for action input (placeholder for future action system)
    // if (input.action) {
    //   return PlayerAnimationState.CLICKED;
    // }
    
    // Default to idle
    return this.handleIdleAnimations();
  }

  /**
   * Handle movement-based animations
   */
  private handleMovementAnimations(input: InputComponent): PlayerAnimationState {
    // Determine movement type
    const isMoving = input.forward || input.backward;
    const isTurning = input.turnLeft || input.turnRight;
    
    if (isMoving) {
      // Check for special movement types based on character config
      if (this.characterConfig.behaviors.canSwim && this.isInWater()) {
        return PlayerAnimationState.SWIM;
      }
      
      if (this.characterConfig.behaviors.canFly && this.isInAir()) {
        return PlayerAnimationState.FLY;
      }
      
      // Default movement
      return input.forward ? PlayerAnimationState.WALK : PlayerAnimationState.WALK;
    }
    
    if (isTurning) {
      return PlayerAnimationState.IDLE_A; // Keep idle while turning
    }
    
    return PlayerAnimationState.IDLE_A;
  }

  /**
   * Handle idle animations with variations
   */
  private handleIdleAnimations(): PlayerAnimationState {
    // Cycle through idle variations
    const idleStates = [
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.IDLE_B,
      PlayerAnimationState.IDLE_C
    ];
    
    const currentIndex = idleStates.indexOf(this.currentState);
    const nextIndex = (currentIndex + 1) % idleStates.length;
    
    return idleStates[nextIndex];
  }

  /**
   * Update idle variation timer
   */
  private updateIdleVariations(deltaTime: number): void {
    if (this.isIdleState(this.currentState)) {
      this.idleVariationTimer += deltaTime;
      
      if (this.idleVariationTimer >= this.idleVariationInterval) {
        this.idleVariationTimer = 0;
        // State will be changed in next update
      }
    } else {
      this.idleVariationTimer = 0;
    }
  }

  /**
   * Check if state is an idle state
   */
  private isIdleState(state: PlayerAnimationState): boolean {
    return state === PlayerAnimationState.IDLE_A || 
           state === PlayerAnimationState.IDLE_B || 
           state === PlayerAnimationState.IDLE_C;
  }

  /**
   * Transition to new animation state
   */
  private transitionToAnimation(state: PlayerAnimationState): void {
    const success = this.playAnimation(state);
    
    if (success) {
      Logger.debug(LogCategory.CORE, 
        `[PlayerAnimationController] Transitioned to: ${state} for player: ${this.playerId}`
      );
    }
  }

  /**
   * Get animation name for state
   * FIXED: Use correct animation names that match the actual GLB files
   */
  private getAnimationNameForState(state: PlayerAnimationState): string | null {
    // FIXED: Map to actual animation names from GLB files
    const animationNameMap: { [key in PlayerAnimationState]: string } = {
      [PlayerAnimationState.IDLE_A]: 'Idle_A',
      [PlayerAnimationState.IDLE_B]: 'Idle_B', 
      [PlayerAnimationState.IDLE_C]: 'Idle_C',
      [PlayerAnimationState.WALK]: 'Walk',
      [PlayerAnimationState.RUN]: 'Run',
      [PlayerAnimationState.JUMP]: 'Jump',
      [PlayerAnimationState.SWIM]: 'Swim',
      [PlayerAnimationState.FLY]: 'Fly',
      [PlayerAnimationState.ROLL]: 'Roll',
      [PlayerAnimationState.BOUNCE]: 'Bounce',
      [PlayerAnimationState.SPIN]: 'Spin',
      [PlayerAnimationState.EAT]: 'Eat',
      [PlayerAnimationState.CLICKED]: 'Clicked',
      [PlayerAnimationState.FEAR]: 'Fear',
      [PlayerAnimationState.DEATH]: 'Death',
      [PlayerAnimationState.SIT]: 'Sit'
    };

    return animationNameMap[state] || null;
  }

  /**
   * Setup default transitions
   */
  private setupDefaultTransitions(): void {
    // transitions are now pre-defined in the AnimationStateMachine
  }

  /**
   * Fire animation event
   */
  private fireAnimationEvent(fromState: PlayerAnimationState, toState: PlayerAnimationState): void {
    const event: PlayerAnimationEvent = {
      playerId: this.playerId,
      characterType: this.characterConfig.id,
      fromState,
      toState,
      timestamp: performance.now(),
      input: this.inputState || undefined
    };

    this.eventBus.emit('player.animation_changed', event);
  }

  /**
   * Check if player is in water (placeholder)
   */
  private isInWater(): boolean {
    // TODO: Implement water detection based on terrain/position
    return false;
  }

  /**
   * Check if player is in air (placeholder)
   */
  private isInAir(): boolean {
    // TODO: Implement air detection based on position
    return false;
  }

  /**
   * Get state machine for external access
   */
  getStateMachine(): AnimationStateMachine {
    return this.stateMachine;
  }

  /**
   * Get current input state
   */
  getCurrentInput(): InputComponent | null {
    return this.inputState;
  }

  /**
   * Debug: Print current state info
   */
  debugPrintState(): void {
    Logger.debug(LogCategory.CORE, `[PlayerAnimationController] Player: ${this.playerId}`);
    Logger.debug(LogCategory.CORE, `  Current State: ${this.currentState}`);
    Logger.debug(LogCategory.CORE, `  Previous State: ${this.previousState}`);
    Logger.debug(LogCategory.CORE, `  Is Playing: ${this.isPlaying()}`);
    Logger.debug(LogCategory.CORE, `  Is Paused: ${this.isPaused()}`);
    if (this.inputState) {
      Logger.debug(LogCategory.CORE, `  Input: ${JSON.stringify(this.inputState)}`);
    }
  }
} 