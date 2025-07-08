import { System, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { PlayerAnimationController } from '../controllers/PlayerAnimationController';
import { PlayerAnimationMetrics } from '../types/PlayerAnimationTypes';

/**
 * Input Animation Component
 * ECS component to track player animation controllers
 */
export interface InputAnimationComponent {
  controller: PlayerAnimationController;
  isActive: boolean;
  lastUpdateTime: number;
  updateInterval: number;
  priority: number;
}

/**
 * Input Animation System
 * ECS system that manages input-driven animation updates for player entities
 */
export class InputAnimationSystem extends System {
  private playerAnimationControllers = new Map<string, PlayerAnimationController>();
  private inputAnimationComponents = new Map<string, InputAnimationComponent>();
  private performanceMetrics: PlayerAnimationMetrics = {
    totalControllers: 0,
    activeAnimations: 0,
    stateTransitions: 0,
    averageUpdateTime: 0,
    frameRate: 60,
    memoryUsage: 0
  };
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private maxUpdateTime: number = 16; // 16ms = 60fps budget

  constructor(eventBus: EventBus) {
    super(eventBus, ['input', 'input_animation'], 'InputAnimationSystem');
    
    // Subscribe to events
    this.eventBus.subscribe('player.animation_changed', this.handleAnimationChanged.bind(this));
    this.eventBus.subscribe('entity:cleanup', this.handleEntityCleanup.bind(this));
    this.eventBus.subscribe('player.animation_controller_added', this.handleControllerAdded.bind(this));
    this.eventBus.subscribe('player.animation_controller_removed', this.handleControllerRemoved.bind(this));
    
    Logger.info(LogCategory.CORE, '[InputAnimationSystem] Initialized');
  }

  /**
   * Add a player animation controller
   */
  addPlayerAnimationController(
    entityId: string, 
    controller: PlayerAnimationController,
    priority: number = 5
  ): void {
    this.playerAnimationControllers.set(entityId, controller);
    
    const component: InputAnimationComponent = {
      controller,
      isActive: true,
      lastUpdateTime: 0,
      updateInterval: this.getUpdateInterval(priority),
      priority
    };

    this.inputAnimationComponents.set(entityId, component);
    this.performanceMetrics.totalControllers++;
    
    Logger.debug(LogCategory.CORE, `[InputAnimationSystem] Added controller for entity: ${entityId}`);
  }

  /**
   * Remove a player animation controller
   */
  removePlayerAnimationController(entityId: string): void {
    const component = this.inputAnimationComponents.get(entityId);
    if (component) {
      component.controller.dispose();
      this.inputAnimationComponents.delete(entityId);
      this.playerAnimationControllers.delete(entityId);
      this.performanceMetrics.totalControllers--;
      
      Logger.debug(LogCategory.CORE, `[InputAnimationSystem] Removed controller for entity: ${entityId}`);
    }
  }

  /**
   * Get player animation controller for an entity
   */
  getPlayerAnimationController(entityId: string): PlayerAnimationController | undefined {
    return this.playerAnimationControllers.get(entityId);
  }

  /**
   * Get input animation component for an entity
   */
  getInputAnimationComponent(entityId: string): InputAnimationComponent | undefined {
    return this.inputAnimationComponents.get(entityId);
  }

  /**
   * Set animation state for an entity
   */
  setEntityAnimationState(entityId: string, state: import('../types/PlayerAnimationTypes').PlayerAnimationState): boolean {
    const controller = this.playerAnimationControllers.get(entityId);
    if (!controller) {
      Logger.warn(LogCategory.CORE, `[InputAnimationSystem] No controller found for entity: ${entityId}`);
      return false;
    }

    return controller.playAnimation(state);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PlayerAnimationMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Main update loop
   */
  update(deltaTime: number): void {
    if (this.inputAnimationComponents.size === 0) return;

    const updateStart = performance.now();
    const currentTime = performance.now();
    
    // Update frame rate tracking
    this.updateFrameRate();
    
    // Update player animations
    let updatedCount = 0;
    let activeAnimations = 0;
    let stateTransitions = 0;
    
    this.inputAnimationComponents.forEach((component, entityId) => {
      if (!component.isActive) return;
      
      // Check if it's time to update this component
      if (currentTime - component.lastUpdateTime >= component.updateInterval) {
        const entity = this.entities.get(entityId);
        if (entity) {
          const input = entity.getComponent<InputComponent>('input');
          if (input) {
            // Update player animation controller
            component.controller.update(deltaTime, input);
            component.lastUpdateTime = currentTime;
            updatedCount++;
            
            if (component.controller.isPlaying()) {
              activeAnimations++;
            }
            
            // Track state transitions
            if (component.controller.getCurrentState() !== component.controller.getPreviousState()) {
              stateTransitions++;
            }
          }
        }
      }
    });

    // Update performance metrics
    const updateTime = performance.now() - updateStart;
    this.performanceMetrics.activeAnimations = activeAnimations;
    this.performanceMetrics.stateTransitions += stateTransitions;
    this.performanceMetrics.averageUpdateTime = 
      (this.performanceMetrics.averageUpdateTime + updateTime) / 2;
    
    // Check if we're exceeding our update budget
    if (updateTime > this.maxUpdateTime) {
      this.handlePerformanceIssue(updateTime);
    }
    
    // Log performance if needed
    if (this.shouldLogPerformance()) {
      Logger.debug(LogCategory.CORE, 
        `[InputAnimationSystem] Updated ${updatedCount}/${this.inputAnimationComponents.size} controllers in ${updateTime.toFixed(2)}ms`
      );
    }
  }

  /**
   * Handle animation state changes
   */
  private handleAnimationChanged(event: import('../types/PlayerAnimationTypes').PlayerAnimationEvent): void {
    this.performanceMetrics.stateTransitions++;
    
    Logger.debug(LogCategory.CORE, 
      `[InputAnimationSystem] Animation changed: ${event.fromState} -> ${event.toState} for player: ${event.playerId}`
    );
  }

  /**
   * Handle entity cleanup
   */
  private handleEntityCleanup(data: { entityId: string }): void {
    this.removePlayerAnimationController(data.entityId);
  }

  /**
   * Handle controller added event
   */
  private handleControllerAdded(data: { entityId: string; controller: PlayerAnimationController }): void {
    this.addPlayerAnimationController(data.entityId, data.controller);
  }

  /**
   * Handle controller removed event
   */
  private handleControllerRemoved(data: { entityId: string }): void {
    this.removePlayerAnimationController(data.entityId);
  }

  /**
   * Get update interval based on priority
   */
  private getUpdateInterval(priority: number): number {
    const baseInterval = 16; // 60fps base
    const priorityMultiplier = Math.max(0.1, 1 - (priority - 5) * 0.1);
    return baseInterval * priorityMultiplier;
  }

  /**
   * Update frame rate tracking
   */
  private updateFrameRate(): void {
    const currentTime = performance.now();
    this.frameCount++;
    
    if (currentTime - this.lastFrameTime >= 1000) { // Every second
      this.performanceMetrics.frameRate = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }
  }

  /**
   * Handle performance issues
   */
  private handlePerformanceIssue(updateTime: number): void {
    Logger.warn(LogCategory.CORE, 
      `[InputAnimationSystem] Performance issue: Update took ${updateTime.toFixed(2)}ms (budget: ${this.maxUpdateTime}ms)`
    );
    
    // Reduce update frequency for lower priority components
    this.inputAnimationComponents.forEach((component) => {
      if (component.priority < 5) {
        component.updateInterval = Math.min(component.updateInterval * 1.5, 100);
      }
    });
  }

  /**
   * Check if should log performance
   */
  private shouldLogPerformance(): boolean {
    return this.performanceMetrics.activeAnimations > 5 || 
           this.performanceMetrics.averageUpdateTime > 10;
  }

  /**
   * Get animation statistics
   */
  getAnimationStats(): {
    totalControllers: number;
    activeAnimations: number;
    stateTransitions: number;
    performanceMode: string;
    averageUpdateTime: number;
    frameRate: number;
  } {
    return {
      totalControllers: this.performanceMetrics.totalControllers,
      activeAnimations: this.performanceMetrics.activeAnimations,
      stateTransitions: this.performanceMetrics.stateTransitions,
      performanceMode: 'high',
      averageUpdateTime: this.performanceMetrics.averageUpdateTime,
      frameRate: this.performanceMetrics.frameRate
    };
  }

  /**
   * Debug: List all animation components
   */
  debugListAnimationComponents(): void {
    Logger.debug(LogCategory.CORE, `[InputAnimationSystem] Animation Components (${this.inputAnimationComponents.size}):`);
    
    this.inputAnimationComponents.forEach((component, entityId) => {
      const controller = component.controller;
      Logger.debug(LogCategory.CORE, 
        `  ${entityId}: ${controller.getCurrentState()} (${controller.isPlaying() ? 'playing' : 'stopped'})`
      );
    });
  }

  /**
   * Pause all animations
   */
  pauseAllAnimations(): void {
    this.playerAnimationControllers.forEach(controller => {
      controller.pauseAnimation();
    });
    
    Logger.info(LogCategory.CORE, '[InputAnimationSystem] Paused all animations');
  }

  /**
   * Resume all animations
   */
  resumeAllAnimations(): void {
    this.playerAnimationControllers.forEach(controller => {
      controller.resumeAnimation();
    });
    
    Logger.info(LogCategory.CORE, '[InputAnimationSystem] Resumed all animations');
  }

  /**
   * Get all player animation controllers
   */
  getAllControllers(): Map<string, PlayerAnimationController> {
    return new Map(this.playerAnimationControllers);
  }

  /**
   * Get controller count
   */
  getControllerCount(): number {
    return this.playerAnimationControllers.size;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.playerAnimationControllers.forEach(controller => {
      controller.dispose();
    });
    
    this.playerAnimationControllers.clear();
    this.inputAnimationComponents.clear();
    
    Logger.info(LogCategory.CORE, '[InputAnimationSystem] Disposed all controllers');
  }
} 