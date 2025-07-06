import { InputComponent } from '../ecs';
import { 
  IAnimationStateMachine, 
  AnimationTransition, 
  PlayerAnimationState 
} from '../types/PlayerAnimationTypes';
import { Logger, LogCategory } from '../core/Logger';

/**
 * Animation State Machine
 * Manages animation state transitions and conditions
 */
export class AnimationStateMachine implements IAnimationStateMachine {
  private currentState: PlayerAnimationState;
  private previousState: PlayerAnimationState;
  private transitions: AnimationTransition[] = [];
  private defaultBlendTime: number = 0.3;
  private stateHistory: PlayerAnimationState[] = [];
  private maxHistorySize: number = 10;

  constructor(initialState: PlayerAnimationState = PlayerAnimationState.IDLE_A) {
    this.currentState = initialState;
    this.previousState = initialState;
    this.stateHistory.push(initialState);
    
    Logger.debug(LogCategory.CORE, `[AnimationStateMachine] Initialized with state: ${initialState}`);
  }

  /**
   * Get current animation state
   */
  getCurrentState(): PlayerAnimationState {
    return this.currentState;
  }

  /**
   * Set current animation state
   */
  setCurrentState(state: PlayerAnimationState): void {
    if (this.currentState !== state) {
      this.previousState = this.currentState;
      this.currentState = state;
      
      // Add to history
      this.stateHistory.push(state);
      if (this.stateHistory.length > this.maxHistorySize) {
        this.stateHistory.shift();
      }
      
      Logger.debug(LogCategory.CORE, `[AnimationStateMachine] State changed: ${this.previousState} -> ${state}`);
    }
  }

  /**
   * Add a transition between animation states
   */
  addTransition(transition: AnimationTransition): void {
    // Remove existing transition with same from/to
    this.removeTransition(transition.from, transition.to);
    
    // Add new transition
    this.transitions.push(transition);
    
    Logger.debug(LogCategory.CORE, 
      `[AnimationStateMachine] Added transition: ${transition.from} -> ${transition.to} (priority: ${transition.priority})`
    );
  }

  /**
   * Remove a transition
   */
  removeTransition(from: PlayerAnimationState, to: PlayerAnimationState): void {
    this.transitions = this.transitions.filter(t => 
      !(t.from === from && t.to === to)
    );
  }

  /**
   * Get all transitions
   */
  getTransitions(): AnimationTransition[] {
    return [...this.transitions];
  }

  /**
   * Evaluate transitions based on input
   */
  evaluateTransitions(input: InputComponent): PlayerAnimationState | null {
    // Sort transitions by priority (highest first)
    const sortedTransitions = [...this.transitions].sort((a, b) => b.priority - a.priority);
    
    for (const transition of sortedTransitions) {
      // Check if transition is from current state
      if (transition.from === this.currentState) {
        // Check if condition is met
        if (transition.condition(input)) {
          Logger.debug(LogCategory.CORE, 
            `[AnimationStateMachine] Transition condition met: ${transition.from} -> ${transition.to}`
          );
          return transition.to;
        }
      }
    }
    
    return null;
  }

  /**
   * Check if can transition to a specific state
   */
  canTransitionTo(state: PlayerAnimationState): boolean {
    return this.transitions.some(t => 
      t.from === this.currentState && t.to === state
    );
  }

  /**
   * Set default blend time
   */
  setDefaultBlendTime(time: number): void {
    this.defaultBlendTime = Math.max(0, time);
  }

  /**
   * Get default blend time
   */
  getDefaultBlendTime(): number {
    return this.defaultBlendTime;
  }

  /**
   * Get previous state
   */
  getPreviousState(): PlayerAnimationState {
    return this.previousState;
  }

  /**
   * Get state history
   */
  getStateHistory(): PlayerAnimationState[] {
    return [...this.stateHistory];
  }

  /**
   * Check if state has changed recently
   */
  hasStateChanged(): boolean {
    return this.currentState !== this.previousState;
  }

  /**
   * Get transition for specific state change
   */
  getTransition(from: PlayerAnimationState, to: PlayerAnimationState): AnimationTransition | undefined {
    return this.transitions.find(t => t.from === from && t.to === to);
  }

  /**
   * Clear all transitions
   */
  clearTransitions(): void {
    this.transitions = [];
    Logger.debug(LogCategory.CORE, '[AnimationStateMachine] Cleared all transitions');
  }

  /**
   * Get transitions from current state
   */
  getTransitionsFromCurrentState(): AnimationTransition[] {
    return this.transitions.filter(t => t.from === this.currentState);
  }

  /**
   * Get available states from current state
   */
  getAvailableStates(): PlayerAnimationState[] {
    return this.transitions
      .filter(t => t.from === this.currentState)
      .map(t => t.to);
  }

  /**
   * Validate transition exists
   */
  isValidTransition(from: PlayerAnimationState, to: PlayerAnimationState): boolean {
    return this.transitions.some(t => t.from === from && t.to === to);
  }

  /**
   * Get transition count
   */
  getTransitionCount(): number {
    return this.transitions.length;
  }

  /**
   * Debug: Print all transitions
   */
  debugPrintTransitions(): void {
    Logger.debug(LogCategory.CORE, `[AnimationStateMachine] Current state: ${this.currentState}`);
    Logger.debug(LogCategory.CORE, `[AnimationStateMachine] Transitions (${this.transitions.length}):`);
    
    this.transitions.forEach((transition, index) => {
      Logger.debug(LogCategory.CORE, 
        `  ${index + 1}. ${transition.from} -> ${transition.to} (priority: ${transition.priority})`
      );
    });
  }
} 