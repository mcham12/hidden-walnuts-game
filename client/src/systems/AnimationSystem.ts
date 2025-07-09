import { System } from '../ecs/index';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { AnimationController } from '../core/AnimationController';
import { AnimationEvent, AnimationMetrics } from '../types/AnimationTypes';

/**
 * Animation Component
 * ECS component to track animation state for entities
 */
export interface AnimationComponent {
  controller: AnimationController;
  isActive: boolean;
  lastUpdateTime: number;
  updateInterval: number; // ms between updates (for performance)
  priority: number; // Higher priority = more frequent updates
}

/**
 * Animation System
 * ECS system that manages animation updates for all animated entities
 */
export class AnimationSystem extends System {
  private animationComponents = new Map<string, AnimationComponent>();
  private performanceMetrics: AnimationMetrics = {
    activeAnimations: 0,
    totalMixers: 0,
    memoryUsage: 0,
    updateTime: 0,
    frameRate: 60,
    droppedFrames: 0
  };
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private maxUpdateTime: number = 16; // 16ms = 60fps budget
  private performanceMode: 'high' | 'medium' | 'low' = 'high';

  constructor(eventBus: EventBus) {
    super(eventBus, ['animation'], 'AnimationSystem');
    
    // Subscribe to animation events
    this.eventBus.subscribe('animation:start', this.handleAnimationStart.bind(this));
    this.eventBus.subscribe('animation:finish', this.handleAnimationFinish.bind(this));
    this.eventBus.subscribe('entity:cleanup', this.handleEntityCleanup.bind(this));
    this.eventBus.subscribe('performance:mode_changed', this.handlePerformanceModeChanged.bind(this));
    
    Logger.info(LogCategory.CORE, '[AnimationSystem] Initialized');
  }

  /**
   * Add an animation component to an entity
   */
  addAnimationComponent(
    entityId: string, 
    animationController: AnimationController,
    priority: number = 5
  ): void {
    const component: AnimationComponent = {
      controller: animationController,
      isActive: true,
      lastUpdateTime: 0,
      updateInterval: this.getUpdateInterval(priority),
      priority: priority
    };

    this.animationComponents.set(entityId, component);
    this.performanceMetrics.totalMixers++;
    
    Logger.debug(LogCategory.CORE, `[AnimationSystem] Added animation component for entity: ${entityId}`);
  }

  /**
   * Remove animation component from an entity
   */
  removeAnimationComponent(entityId: string): void {
    const component = this.animationComponents.get(entityId);
    if (component) {
      component.controller.dispose();
      this.animationComponents.delete(entityId);
      this.performanceMetrics.totalMixers--;
      
      Logger.debug(LogCategory.CORE, `[AnimationSystem] Removed animation component for entity: ${entityId}`);
    }
  }

  /**
   * Get animation component for an entity
   */
  getAnimationComponent(entityId: string): AnimationComponent | undefined {
    return this.animationComponents.get(entityId);
  }

  /**
   * Get animation controller for an entity
   */
  getAnimationController(entityId: string): AnimationController | undefined {
    const component = this.animationComponents.get(entityId);
    return component?.controller;
  }

  /**
   * Set animation for an entity
   */
  setEntityAnimation(entityId: string, animationName: string): boolean {
    const component = this.animationComponents.get(entityId);
    if (!component) {
      Logger.warn(LogCategory.CORE, `[AnimationSystem] No animation component found for entity: ${entityId}`);
      return false;
    }

    return component.controller.playAnimation(animationName);
  }

  /**
   * Set performance mode for animation system
   */
  setPerformanceMode(mode: 'high' | 'medium' | 'low'): void {
    this.performanceMode = mode;
    
    // Update all animation components
    this.animationComponents.forEach((component) => {
      component.controller.setPerformanceMode(mode);
      component.updateInterval = this.getUpdateInterval(component.priority);
    });

    Logger.info(LogCategory.CORE, `[AnimationSystem] Performance mode set to: ${mode}`);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): AnimationMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Main update loop
   */
  update(deltaTime: number): void {
    if (this.animationComponents.size === 0) return;

    const updateStart = performance.now();
    const currentTime = performance.now();
    
    // Update frame rate tracking
    this.updateFrameRate();
    
    // Update animation components
    let updatedCount = 0;
    let activeAnimations = 0;
    
    this.animationComponents.forEach((component) => {
      if (!component.isActive) return;
      
      // Check if it's time to update this component
      if (currentTime - component.lastUpdateTime >= component.updateInterval) {
        component.controller.update(deltaTime);
        component.lastUpdateTime = currentTime;
        updatedCount++;
        
        if (component.controller.isPlaying()) {
          activeAnimations++;
        }
      }
    });

    // Update performance metrics
    const updateTime = performance.now() - updateStart;
    this.performanceMetrics.updateTime = updateTime;
    this.performanceMetrics.activeAnimations = activeAnimations;
    
    // Check if we're exceeding our update budget
    if (updateTime > this.maxUpdateTime) {
      this.performanceMetrics.droppedFrames++;
      this.handlePerformanceIssue(updateTime);
    }
    
    // Log performance if needed
    if (this.shouldLogPerformance()) {
      Logger.debug(LogCategory.CORE, 
        `[AnimationSystem] Updated ${updatedCount}/${this.animationComponents.size} components in ${updateTime.toFixed(2)}ms`
      );
    }
  }

  /**
   * Handle entity cleanup
   */
  private handleEntityCleanup(data: { entityId: string }): void {
    this.removeAnimationComponent(data.entityId);
  }

  /**
   * Handle animation start events
   */
  private handleAnimationStart(event: AnimationEvent): void {
    Logger.debug(LogCategory.CORE, `[AnimationSystem] Animation started: ${event.animationName} for ${event.characterId}`);
  }

  /**
   * Handle animation finish events
   */
  private handleAnimationFinish(event: AnimationEvent): void {
    Logger.debug(LogCategory.CORE, `[AnimationSystem] Animation finished: ${event.animationName} for ${event.characterId}`);
  }

  /**
   * Handle performance mode changes
   */
  private handlePerformanceModeChanged(data: { mode: 'high' | 'medium' | 'low' }): void {
    this.setPerformanceMode(data.mode);
  }

  /**
   * Get update interval based on priority and performance mode
   */
  private getUpdateInterval(priority: number): number {
    const baseBudget = this.getBaseBudget();
    
    // Higher priority = more frequent updates
    // Priority 1 (low) = 100ms, Priority 10 (high) = 16ms
    const interval = Math.max(baseBudget / priority, 16);
    
    return interval;
  }

  /**
   * Get base update budget based on performance mode
   */
  private getBaseBudget(): number {
    switch (this.performanceMode) {
      case 'high':
        return 160; // 16ms * 10 priority levels
      case 'medium':
        return 330; // 33ms * 10 priority levels  
      case 'low':
        return 500; // 50ms * 10 priority levels
      default:
        return 160;
    }
  }

  /**
   * Update frame rate tracking
   */
  private updateFrameRate(): void {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastFrameTime >= 1000) {
      this.performanceMetrics.frameRate = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }

  /**
   * Handle performance issues
   */
  private handlePerformanceIssue(updateTime: number): void {
    Logger.warn(LogCategory.CORE, 
      `[AnimationSystem] Performance issue: Update took ${updateTime.toFixed(2)}ms (budget: ${this.maxUpdateTime}ms)`
    );
    
    // Automatically reduce performance mode if consistently over budget
    if (this.performanceMetrics.droppedFrames > 10) {
      if (this.performanceMode === 'high') {
        this.setPerformanceMode('medium');
      } else if (this.performanceMode === 'medium') {
        this.setPerformanceMode('low');
      }
      
      // Reset dropped frames counter
      this.performanceMetrics.droppedFrames = 0;
    }
  }

  /**
   * Check if we should log performance metrics
   */
  private shouldLogPerformance(): boolean {
    // Log every 300 frames (approximately once per 5 seconds at 60fps) to reduce spam
    return this.frameCount % 300 === 0;
  }

  /**
   * Get animation statistics for debugging
   */
  getAnimationStats(): {
    totalComponents: number;
    activeAnimations: number;
    performanceMode: string;
    averageUpdateTime: number;
    frameRate: number;
  } {
    return {
      totalComponents: this.animationComponents.size,
      activeAnimations: this.performanceMetrics.activeAnimations,
      performanceMode: this.performanceMode,
      averageUpdateTime: this.performanceMetrics.updateTime,
      frameRate: this.performanceMetrics.frameRate
    };
  }

  /**
   * Debug method to list all animation components
   */
  debugListAnimationComponents(): void {
    Logger.info(LogCategory.CORE, `[AnimationSystem] Animation Components (${this.animationComponents.size}):`);
    
    this.animationComponents.forEach((component, entityId) => {
      const controller = component.controller;
      const stats = {
        entityId: entityId,
        isActive: component.isActive,
        currentAnimation: controller.getCurrentAnimation(),
        isPlaying: controller.isPlaying(),
        updateInterval: component.updateInterval,
        priority: component.priority
      };
      
      Logger.info(LogCategory.CORE, `  - ${entityId}:`, stats);
    });
  }

  /**
   * Pause all animations
   */
  pauseAllAnimations(): void {
    this.animationComponents.forEach((component) => {
      component.controller.pauseAnimation();
    });
    
    Logger.info(LogCategory.CORE, '[AnimationSystem] All animations paused');
  }

  /**
   * Resume all animations
   */
  resumeAllAnimations(): void {
    this.animationComponents.forEach((component) => {
      component.controller.resumeAnimation();
    });
    
    Logger.info(LogCategory.CORE, '[AnimationSystem] All animations resumed');
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.animationComponents.forEach((component) => {
      component.controller.dispose();
    });
    
    this.animationComponents.clear();
    this.performanceMetrics.totalMixers = 0;
    this.performanceMetrics.activeAnimations = 0;
    
    Logger.info(LogCategory.CORE, '[AnimationSystem] Disposed');
  }
} 