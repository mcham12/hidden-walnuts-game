import { 
  IAnimationStateMachine, 
  PlayerAnimationState 
} from '../types/PlayerAnimationTypes';
import { Logger, LogCategory } from '../core/Logger';

/**
 * Animation State Machine
 * FIXED: Proper animation state management with transitions and blend trees
 */
export class AnimationStateMachine implements IAnimationStateMachine {
  private currentState: PlayerAnimationState;
  private previousState: PlayerAnimationState;
  private transitions: Map<PlayerAnimationState, PlayerAnimationState[]>;
  private blendTime: number = 0.3;
  private transitionProgress: number = 0;
  private isTransitioning: boolean = false;
  // private transitionStartTime: number = 0; // Unused for now
  
  // FIXED: Add blend tree support
  private blendTree: Map<string, number> = new Map();
  private animationLayers: Map<string, number> = new Map();

  constructor(initialState: PlayerAnimationState) {
    this.currentState = initialState;
    this.previousState = initialState;
    this.transitions = new Map();
    
    this.initializeTransitions();
    // Logger.info(LogCategory.CORE, `[AnimationStateMachine] Initialized with state: ${initialState}`);
  }

  /**
   * FIXED: Initialize valid state transitions
   */
  private initializeTransitions(): void {
    // Define valid transitions between animation states
    this.transitions.set(PlayerAnimationState.IDLE_A, [
      PlayerAnimationState.WALK,
      PlayerAnimationState.RUN,
      PlayerAnimationState.JUMP,
      PlayerAnimationState.IDLE_B,
      PlayerAnimationState.IDLE_C
    ]);
    
    this.transitions.set(PlayerAnimationState.IDLE_B, [
      PlayerAnimationState.WALK,
      PlayerAnimationState.RUN,
      PlayerAnimationState.JUMP,
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.IDLE_C
    ]);
    
    this.transitions.set(PlayerAnimationState.IDLE_C, [
      PlayerAnimationState.WALK,
      PlayerAnimationState.RUN,
      PlayerAnimationState.JUMP,
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.IDLE_B
    ]);
    
    this.transitions.set(PlayerAnimationState.WALK, [
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.RUN,
      PlayerAnimationState.JUMP
    ]);
    
    this.transitions.set(PlayerAnimationState.RUN, [
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.WALK,
      PlayerAnimationState.JUMP
    ]);
    
    this.transitions.set(PlayerAnimationState.JUMP, [
      PlayerAnimationState.IDLE_A,
      PlayerAnimationState.WALK,
      PlayerAnimationState.RUN
    ]);
  }

  /**
   * FIXED: Transition to new animation state with validation
   */
  transitionTo(newState: PlayerAnimationState): boolean {
    if (newState === this.currentState) {
      return true; // Already in target state
    }

    if (!this.canTransitionTo(newState)) {
      Logger.warn(LogCategory.CORE, `[AnimationStateMachine] Invalid transition from ${this.currentState} to ${newState}`);
      return false;
    }

    // Start transition
    this.previousState = this.currentState;
    this.currentState = newState;
    this.isTransitioning = true;
    this.transitionProgress = 0;
    // this.transitionStartTime = performance.now(); // Unused for now

          // Logger.debug(LogCategory.CORE, `[AnimationStateMachine] Transitioning from ${this.previousState} to ${newState}`);
    return true;
  }

  /**
   * FIXED: Check if transition is valid
   */
  canTransitionTo(state: PlayerAnimationState): boolean {
    const validTransitions = this.transitions.get(this.currentState);
    return validTransitions ? validTransitions.includes(state) : false;
  }

  /**
   * FIXED: Update state machine
   */
  update(deltaTime: number): void {
    if (this.isTransitioning) {
      this.transitionProgress += deltaTime / (this.blendTime * 1000);
      
      if (this.transitionProgress >= 1.0) {
        this.isTransitioning = false;
        this.transitionProgress = 1.0;
        // Logger.debug(LogCategory.CORE, `[AnimationStateMachine] Transition complete to ${this.currentState}`);
      }
    }
  }

  /**
   * FIXED: Get current state
   */
  getCurrentState(): PlayerAnimationState {
    return this.currentState;
  }

  /**
   * FIXED: Get previous state
   */
  getPreviousState(): PlayerAnimationState {
    return this.previousState;
  }

  /**
   * FIXED: Check if currently transitioning
   */
  isInTransition(): boolean {
    return this.isTransitioning;
  }

  /**
   * FIXED: Get transition progress (0-1)
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }

  /**
   * FIXED: Set blend time for transitions
   */
  setBlendTime(time: number): void {
    this.blendTime = time;
  }

  /**
   * FIXED: Get blend time
   */
  getBlendTime(): number {
    return this.blendTime;
  }

  /**
   * FIXED: Add animation layer (for additive animations)
   */
  addAnimationLayer(layerName: string, weight: number): void {
    this.animationLayers.set(layerName, weight);
  }

  /**
   * FIXED: Remove animation layer
   */
  removeAnimationLayer(layerName: string): void {
    this.animationLayers.delete(layerName);
  }

  /**
   * FIXED: Get animation layer weight
   */
  getAnimationLayerWeight(layerName: string): number {
    return this.animationLayers.get(layerName) || 0;
  }

  /**
   * FIXED: Add blend tree node
   */
  addBlendTreeNode(nodeName: string, weight: number): void {
    this.blendTree.set(nodeName, weight);
  }

  /**
   * FIXED: Get blend tree weights
   */
  getBlendTreeWeights(): Map<string, number> {
    return new Map(this.blendTree);
  }

  /**
   * FIXED: Get valid transitions for current state
   */
  getValidTransitions(): PlayerAnimationState[] {
    return this.transitions.get(this.currentState) || [];
  }

  /**
   * FIXED: Get state machine statistics
   */
  getStats(): any {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      isTransitioning: this.isTransitioning,
      transitionProgress: this.transitionProgress,
      blendTime: this.blendTime,
      validTransitions: this.getValidTransitions(),
      animationLayers: Array.from(this.animationLayers.entries()),
      blendTree: Array.from(this.blendTree.entries())
    };
  }
} 