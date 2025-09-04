// Animation State Manager - Manages character animation states based on movement

export enum AnimationState {
  IDLE = 'idle',
  WALKING = 'walk', 
  RUNNING = 'run',
  JUMPING = 'jump'
}

export interface MovementData {
  velocity: { x: number; z: number };
  isGrounded: boolean;
  isRunning: boolean;
}

export interface AnimationTransition {
  from: AnimationState;
  to: AnimationState;
  duration: number; // Blend duration in seconds
}

export class AnimationStateManager {
  private currentState: AnimationState = AnimationState.IDLE;
  private previousState: AnimationState = AnimationState.IDLE;
  private stateChangeTime: number = 0;
  private movementThreshold = 0.1; // Minimum velocity to consider "moving"
  private runThreshold = 8; // Speed threshold for running vs walking

  // State transition rules
  private transitionDurations: Map<string, number> = new Map([
    ['idle->walk', 0.2],
    ['idle->run', 0.3],
    ['walk->idle', 0.3],
    ['walk->run', 0.2],
    ['run->idle', 0.4],
    ['run->walk', 0.2],
    ['any->jump', 0.1],
    ['jump->any', 0.3]
  ]);

  // Update animation state based on movement data
  updateState(movementData: MovementData): AnimationState {
    const currentTime = performance.now();
    const newState = this.determineAnimationState(movementData);

    // Check if state changed
    if (newState !== this.currentState) {
      this.previousState = this.currentState;
      this.currentState = newState;
      this.stateChangeTime = currentTime;
      
      console.log(`Animation state changed: ${this.previousState} → ${this.currentState}`);
    }

    return this.currentState;
  }

  // Determine what animation state should be based on movement
  private determineAnimationState(movementData: MovementData): AnimationState {
    // Jump takes priority
    if (!movementData.isGrounded) {
      return AnimationState.JUMPING;
    }

    // Calculate movement speed
    const speed = Math.sqrt(
      movementData.velocity.x * movementData.velocity.x +
      movementData.velocity.z * movementData.velocity.z
    );

    // Determine movement state
    if (speed < this.movementThreshold) {
      return AnimationState.IDLE;
    } else if (speed >= this.runThreshold || movementData.isRunning) {
      return AnimationState.RUNNING;
    } else {
      return AnimationState.WALKING;
    }
  }

  // Get current animation state
  getCurrentState(): AnimationState {
    return this.currentState;
  }

  // Get previous animation state
  getPreviousState(): AnimationState {
    return this.previousState;
  }

  // Get time since last state change
  getTimeSinceStateChange(): number {
    return performance.now() - this.stateChangeTime;
  }

  // Get blend duration for current transition
  getCurrentBlendDuration(): number {
    const transitionKey = `${this.previousState}->${this.currentState}`;
    return this.transitionDurations.get(transitionKey) || 
           this.transitionDurations.get('any->any') || 
           0.25; // Default blend duration
  }

  // Check if currently in transition
  isInTransition(): boolean {
    const timeSinceChange = this.getTimeSinceStateChange();
    const blendDuration = this.getCurrentBlendDuration();
    return timeSinceChange < (blendDuration * 1000); // Convert to milliseconds
  }

  // Get blend factor for smooth transitions (0 = fully previous state, 1 = fully current state)
  getBlendFactor(): number {
    if (!this.isInTransition()) {
      return 1.0;
    }

    const timeSinceChange = this.getTimeSinceStateChange();
    const blendDuration = this.getCurrentBlendDuration() * 1000;
    
    return Math.min(1.0, timeSinceChange / blendDuration);
  }

  // Create movement data from velocity and state info
  static createMovementData(
    velocity: { x: number; z: number },
    isGrounded: boolean = true,
    isRunning: boolean = false
  ): MovementData {
    return {
      velocity,
      isGrounded,
      isRunning
    };
  }

  // Get animation name for Three.js from state
  getAnimationName(state?: AnimationState): string {
    const targetState = state || this.currentState;
    
    switch (targetState) {
      case AnimationState.IDLE:
        return 'idle';
      case AnimationState.WALKING:
        return 'walk';
      case AnimationState.RUNNING:
        return 'run';
      case AnimationState.JUMPING:
        return 'jump';
      default:
        return 'idle';
    }
  }

  // Reset to idle state
  reset(): void {
    this.previousState = this.currentState;
    this.currentState = AnimationState.IDLE;
    this.stateChangeTime = performance.now();
  }

  // Force a specific state (useful for special animations)
  forceState(state: AnimationState): void {
    this.previousState = this.currentState;
    this.currentState = state;
    this.stateChangeTime = performance.now();
  }

  // Check if a specific state is active
  isState(state: AnimationState): boolean {
    return this.currentState === state;
  }

  // Check if transitioning from one specific state to another
  isTransitioning(from: AnimationState, to: AnimationState): boolean {
    return this.isInTransition() && 
           this.previousState === from && 
           this.currentState === to;
  }

  // Set custom transition duration
  setTransitionDuration(from: AnimationState, to: AnimationState, duration: number): void {
    const key = `${from}->${to}`;
    this.transitionDurations.set(key, duration);
  }

  // Set movement thresholds
  setMovementThresholds(walkThreshold: number, runThreshold: number): void {
    this.movementThreshold = walkThreshold;
    this.runThreshold = runThreshold;
  }

  // Get debug info for UI/logging
  getDebugInfo(): {
    currentState: string;
    previousState: string;
    isInTransition: boolean;
    blendFactor: number;
    timeSinceChange: number;
  } {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      isInTransition: this.isInTransition(),
      blendFactor: this.getBlendFactor(),
      timeSinceChange: this.getTimeSinceStateChange()
    };
  }
}