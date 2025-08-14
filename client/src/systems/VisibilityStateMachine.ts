// Visibility State Machine - Manages player visibility states with smooth transitions
// Implements standard multiplayer pattern: State Machine for Entity Visibility

import { Entity } from '../ecs';
import { RenderComponent } from '../ecs';
import { Logger, LogCategory } from '../core/Logger';
import { EventBus } from '../core/EventBus';

export enum VisibilityState {
  INVISIBLE = 'invisible',     // Not visible, not rendered
  ENTERING = 'entering',       // Fading in
  VISIBLE = 'visible',         // Fully visible
  LEAVING = 'leaving',         // Fading out
  CULLED = 'culled'           // Outside interest area, not rendered
}

interface VisibilityTransition {
  from: VisibilityState;
  to: VisibilityState;
  duration: number;  // in milliseconds
  startTime: number;
  entity: Entity;
  onComplete?: () => void;
}

interface VisibilityStateData {
  state: VisibilityState;
  opacity: number;
  lastTransition: number;
  transitionDuration: number;
}

/**
 * VisibilityStateMachine manages smooth transitions between visibility states
 * for multiplayer entities, preventing jarring pop-in/pop-out effects.
 * 
 * Standard Multiplayer Pattern: State Machine for Entity Visibility
 * - Smooth fade in/out transitions
 * - Distance-based visibility culling
 * - Performance optimization through state management
 * - Visual feedback for network state changes
 */
export class VisibilityStateMachine {
  private entityStates = new Map<string, VisibilityStateData>();
  private activeTransitions = new Map<string, VisibilityTransition>();
  private eventBus: EventBus;

  // Transition durations in milliseconds
  private static readonly FADE_IN_DURATION = 300;   // 300ms fade in
  private static readonly FADE_OUT_DURATION = 200;  // 200ms fade out
  private static readonly INSTANT_DURATION = 0;     // Instant transitions

  // Distance thresholds
  private static readonly INTEREST_RADIUS = 50;     // Same as AreaOfInterestSystem
  private static readonly CULLING_RADIUS = 100;     // Complete culling distance

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    Logger.info(LogCategory.SPATIAL, '🎭 VisibilityStateMachine initialized');
  }

  /**
   * Initialize visibility state for an entity
   */
  initializeEntity(entity: Entity, initialState: VisibilityState = VisibilityState.INVISIBLE): void {
    const entityId = entity.id.value;
    
    if (this.entityStates.has(entityId)) {
      Logger.warn(LogCategory.SPATIAL, `⚠️ Entity ${entityId} already has visibility state`);
      return;
    }

    const opacity = this.getStateOpacity(initialState);
    
    this.entityStates.set(entityId, {
      state: initialState,
      opacity,
      lastTransition: performance.now(),
      transitionDuration: 0
    });

    // Set initial render state
    this.applyVisibilityToEntity(entity, initialState, opacity);

    Logger.debug(LogCategory.SPATIAL, `🎭 Initialized entity ${entityId} with state: ${initialState}`);
  }

  /**
   * Transition an entity to a new visibility state
   */
  transitionTo(entity: Entity, newState: VisibilityState, instant: boolean = false): boolean {
    const entityId = entity.id.value;
    const currentStateData = this.entityStates.get(entityId);

    if (!currentStateData) {
      Logger.error(LogCategory.SPATIAL, `❌ Cannot transition entity ${entityId} - not initialized`);
      return false;
    }

    const currentState = currentStateData.state;

    // Check if transition is valid
    if (!this.canTransition(currentState, newState)) {
      Logger.warn(LogCategory.SPATIAL, `⚠️ Invalid transition from ${currentState} to ${newState} for entity ${entityId}`);
      return false;
    }

    // Skip if already in target state
    if (currentState === newState) {
      Logger.debug(LogCategory.SPATIAL, `🎭 Entity ${entityId} already in state ${newState}`);
      return true;
    }

    const duration = instant ? VisibilityStateMachine.INSTANT_DURATION : this.getTransitionDuration(currentState, newState);
    const now = performance.now();

    // Cancel any existing transition
    if (this.activeTransitions.has(entityId)) {
      this.activeTransitions.delete(entityId);
    }

    // Create new transition
    const transition: VisibilityTransition = {
      from: currentState,
      to: newState,
      duration,
      startTime: now,
      entity
    };

    this.activeTransitions.set(entityId, transition);

    // Update state data
    currentStateData.state = newState;
    currentStateData.lastTransition = now;
    currentStateData.transitionDuration = duration;

    Logger.debug(LogCategory.SPATIAL, `🎭 Started transition for entity ${entityId}: ${currentState} → ${newState} (${duration}ms)`);

    // If instant, complete immediately
    if (instant) {
      this.completeTransition(entityId, transition);
    }

    return true;
  }

  /**
   * Update all active transitions
   */
  update(deltaTime: number): void {
    const now = performance.now();
    const completedTransitions: string[] = [];

    for (const [entityId, transition] of this.activeTransitions.entries()) {
      const elapsed = now - transition.startTime;
      const progress = transition.duration > 0 ? Math.min(elapsed / transition.duration, 1.0) : 1.0;

      // Calculate current opacity based on transition progress
      const fromOpacity = this.getStateOpacity(transition.from);
      const toOpacity = this.getStateOpacity(transition.to);
      const currentOpacity = this.lerp(fromOpacity, toOpacity, this.easeInOut(progress));

      // Update entity state
      const stateData = this.entityStates.get(entityId);
      if (stateData) {
        stateData.opacity = currentOpacity;
      }

      // Apply to entity
      this.applyVisibilityToEntity(transition.entity, transition.to, currentOpacity);

      // Check if transition is complete
      if (progress >= 1.0) {
        completedTransitions.push(entityId);
        this.completeTransition(entityId, transition);
      }
    }

    // Clean up completed transitions
    for (const entityId of completedTransitions) {
      this.activeTransitions.delete(entityId);
    }
  }

  /**
   * Update visibility based on distance from local player
   */
  updateVisibilityForDistance(entity: Entity, distance: number): void {
    const currentState = this.getEntityState(entity.id.value);
    let targetState: VisibilityState;

    if (distance <= VisibilityStateMachine.INTEREST_RADIUS) {
      // Within interest radius - should be visible
      targetState = VisibilityState.VISIBLE;
    } else if (distance <= VisibilityStateMachine.CULLING_RADIUS) {
      // Outside interest but within culling - fade out
      targetState = VisibilityState.LEAVING;
    } else {
      // Outside culling radius - completely hidden
      targetState = VisibilityState.CULLED;
    }

    // Only transition if state needs to change
    if (currentState !== targetState) {
      this.transitionTo(entity, targetState);
    }
  }

  /**
   * Handle player joining (fade in)
   */
  onPlayerJoined(entity: Entity): void {
    this.initializeEntity(entity, VisibilityState.INVISIBLE);
    this.transitionTo(entity, VisibilityState.ENTERING);
    
    // After fade in completes, set to visible
    setTimeout(() => {
      this.transitionTo(entity, VisibilityState.VISIBLE);
    }, VisibilityStateMachine.FADE_IN_DURATION);
  }

  /**
   * Handle player leaving (fade out)
   */
  onPlayerLeaving(entity: Entity): void {
    this.transitionTo(entity, VisibilityState.LEAVING);
    
    // After fade out completes, set to invisible
    setTimeout(() => {
      this.transitionTo(entity, VisibilityState.INVISIBLE);
    }, VisibilityStateMachine.FADE_OUT_DURATION);
  }

  /**
   * Get current visibility state for an entity
   */
  getEntityState(entityId: string): VisibilityState {
    const stateData = this.entityStates.get(entityId);
    return stateData?.state || VisibilityState.INVISIBLE;
  }

  /**
   * Get current opacity for an entity
   */
  getEntityOpacity(entityId: string): number {
    const stateData = this.entityStates.get(entityId);
    return stateData?.opacity || 0;
  }

  /**
   * Remove entity from state machine (cleanup)
   */
  removeEntity(entityId: string): void {
    this.entityStates.delete(entityId);
    this.activeTransitions.delete(entityId);
    Logger.debug(LogCategory.SPATIAL, `🎭 Removed entity ${entityId} from visibility state machine`);
  }

  /**
   * Check if a state transition is valid
   */
  private canTransition(from: VisibilityState, to: VisibilityState): boolean {
    // Define valid transition rules
    const validTransitions: Record<VisibilityState, VisibilityState[]> = {
      [VisibilityState.INVISIBLE]: [VisibilityState.ENTERING, VisibilityState.VISIBLE, VisibilityState.CULLED],
      [VisibilityState.ENTERING]: [VisibilityState.VISIBLE, VisibilityState.LEAVING, VisibilityState.INVISIBLE],
      [VisibilityState.VISIBLE]: [VisibilityState.LEAVING, VisibilityState.INVISIBLE, VisibilityState.CULLED],
      [VisibilityState.LEAVING]: [VisibilityState.INVISIBLE, VisibilityState.CULLED, VisibilityState.ENTERING],
      [VisibilityState.CULLED]: [VisibilityState.ENTERING, VisibilityState.VISIBLE, VisibilityState.INVISIBLE]
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Get transition duration based on state change
   */
  private getTransitionDuration(from: VisibilityState, to: VisibilityState): number {
    // Entering states use fade in duration
    if (to === VisibilityState.ENTERING || to === VisibilityState.VISIBLE) {
      return VisibilityStateMachine.FADE_IN_DURATION;
    }
    
    // Leaving states use fade out duration
    if (to === VisibilityState.LEAVING || to === VisibilityState.INVISIBLE || to === VisibilityState.CULLED) {
      return VisibilityStateMachine.FADE_OUT_DURATION;
    }

    return VisibilityStateMachine.INSTANT_DURATION;
  }

  /**
   * Get the target opacity for a visibility state
   */
  private getStateOpacity(state: VisibilityState): number {
    switch (state) {
      case VisibilityState.INVISIBLE:
      case VisibilityState.CULLED:
        return 0;
      case VisibilityState.ENTERING:
        return 0; // Will animate to 1
      case VisibilityState.VISIBLE:
        return 1;
      case VisibilityState.LEAVING:
        return 1; // Will animate to 0
      default:
        return 0;
    }
  }

  /**
   * Apply visibility state to the actual entity
   */
  private applyVisibilityToEntity(entity: Entity, state: VisibilityState, opacity: number): void {
    const renderComponent = entity.getComponent<RenderComponent>('render');
    if (!renderComponent || !renderComponent.mesh) {
      return;
    }

    // Set mesh visibility
    const shouldBeVisible = state !== VisibilityState.INVISIBLE && state !== VisibilityState.CULLED && opacity > 0;
    renderComponent.mesh.visible = shouldBeVisible;
    renderComponent.visible = shouldBeVisible;

    // Apply opacity to materials
    if (opacity < 1 && opacity > 0) {
      this.setMeshOpacity(renderComponent.mesh, opacity);
    } else if (opacity >= 1) {
      this.setMeshOpacity(renderComponent.mesh, 1);
    }

    // Emit render event for additional effects
    this.eventBus.emit('render.fade', {
      entityId: entity.id.value,
      opacity
    });
  }

  /**
   * Set opacity on mesh materials
   */
  private setMeshOpacity(mesh: any, opacity: number): void {
    mesh.traverse((child: any) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat: any) => {
            mat.opacity = opacity;
            mat.transparent = opacity < 1;
          });
        } else {
          child.material.opacity = opacity;
          child.material.transparent = opacity < 1;
        }
      }
    });
  }

  /**
   * Complete a transition
   */
  private completeTransition(entityId: string, transition: VisibilityTransition): void {
    const stateData = this.entityStates.get(entityId);
    if (stateData) {
      stateData.opacity = this.getStateOpacity(transition.to);
    }

    // Apply final state
    this.applyVisibilityToEntity(transition.entity, transition.to, this.getStateOpacity(transition.to));

    Logger.debug(LogCategory.SPATIAL, `🎭 Completed transition for entity ${entityId}: ${transition.from} → ${transition.to}`);

    // Call completion callback if provided
    if (transition.onComplete) {
      transition.onComplete();
    }
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Ease in-out curve for smooth transitions
   */
  private easeInOut(t: number): number {
    return t * t * (3 - 2 * t);
  }

  /**
   * Get statistics about visibility states
   */
  getVisibilityStats(): {
    total: number;
    invisible: number;
    entering: number;
    visible: number;
    leaving: number;
    culled: number;
    activeTransitions: number;
  } {
    const stats = {
      total: this.entityStates.size,
      invisible: 0,
      entering: 0,
      visible: 0,
      leaving: 0,
      culled: 0,
      activeTransitions: this.activeTransitions.size
    };

    for (const stateData of this.entityStates.values()) {
      switch (stateData.state) {
        case VisibilityState.INVISIBLE:
          stats.invisible++;
          break;
        case VisibilityState.ENTERING:
          stats.entering++;
          break;
        case VisibilityState.VISIBLE:
          stats.visible++;
          break;
        case VisibilityState.LEAVING:
          stats.leaving++;
          break;
        case VisibilityState.CULLED:
          stats.culled++;
          break;
      }
    }

    return stats;
  }

  /**
   * Debug current visibility states
   */
  debugVisibilityStates(): void {
    Logger.info(LogCategory.SPATIAL, '🎭 === VISIBILITY STATES DEBUG ===');
    for (const [entityId, stateData] of this.entityStates.entries()) {
      Logger.info(LogCategory.SPATIAL, `  ${entityId}: ${stateData.state} (opacity: ${stateData.opacity.toFixed(2)})`);
    }
    Logger.info(LogCategory.SPATIAL, `  Active transitions: ${this.activeTransitions.size}`);
    Logger.info(LogCategory.SPATIAL, '🎭 === END VISIBILITY DEBUG ===');
  }
}