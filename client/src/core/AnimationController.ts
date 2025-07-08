import * as THREE from 'three';
import { Logger, LogCategory } from './Logger';
import { CharacterConfig } from '../types/CharacterTypes';
import { 
  IAnimationController, 
  AnimationEvent, 
  AnimationMetrics, 
  AnimationPlayOptions, 
  AnimationPriority, 
  AnimationActionState, 
  BlendshapeState 
} from '../types/AnimationTypes';

/**
 * AnimationController
 * Manages animation state, blendshapes, and transitions for a character
 */
export class AnimationController implements IAnimationController {
  private mixer: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationClip>;
  private actions: Map<string, AnimationActionState>;
  private blendshapes: Map<string, BlendshapeState>;
  private currentAnimation: string | null = null;
  private blendTime: number = 0.3;
  private timeScale: number = 1.0;
  private characterId: string;
  private eventListeners: Map<string, ((event: AnimationEvent) => void)[]> = new Map();
  private _isPaused: boolean = false;
  private isInitialized: boolean = false;
  private model: THREE.Object3D;
  
  // Performance tracking
  private metrics: AnimationMetrics = {
    activeAnimations: 0,
    totalMixers: 1,
    memoryUsage: 0,
    updateTime: 0,
    frameRate: 60,
    droppedFrames: 0
  };
  
  // Timing for performance metrics
  private frameCount: number = 0;
  private lastFrameTime: number = 0;

  constructor(
    model: THREE.Object3D, 
    characterConfig: CharacterConfig,
    characterId: string
  ) {
    this.model = model;
    this.characterId = characterId;
    this.animations = new Map();
    this.actions = new Map();
    this.blendshapes = new Map();
    
    // Create animation mixer
    this.mixer = new THREE.AnimationMixer(model);
    
    // Initialize animation system
    this.initializeAnimations();
    this.initializeBlendshapes();
    
    Logger.info(LogCategory.CORE, `[AnimationController] Initialized for character: ${characterId} (${characterConfig.name})`);
  }

  /**
   * Initialize animations from the model
   */
  private initializeAnimations(): void {
    if (!this.model || !this.model.animations) {
      Logger.warn(LogCategory.CORE, `[AnimationController] No animations found for character: ${this.characterId}`);
      return;
    }

    // Extract animations from model
    this.model.animations.forEach((clip: THREE.AnimationClip) => {
      this.animations.set(clip.name, clip);
      
      // Create animation action
      const action = this.mixer.clipAction(clip);
      const actionState: AnimationActionState = {
        action: action,
        name: clip.name,
        weight: 0,
        isActive: false,
        loop: this.isLoopingAnimation(clip.name),
        timeScale: 1.0,
        fadeDuration: this.blendTime,
        priority: this.getAnimationPriority(clip.name)
      };
      
      // Set loop mode
      action.setLoop(actionState.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = !actionState.loop;
      
      this.actions.set(clip.name, actionState);
    });

    this.isInitialized = true;
    Logger.info(LogCategory.CORE, `[AnimationController] Loaded ${this.animations.size} animations for ${this.characterId}`);
  }

  /**
   * Re-initialize animations when new animations are added to the model
   * This is called after animations are loaded from separate files
   */
  public reinitializeAnimations(): void {
    Logger.info(LogCategory.CORE, `[AnimationController] Re-initializing animations for character: ${this.characterId}`);
    
    // Clear existing animations and actions
    this.animations.clear();
    this.actions.clear();
    
    // Re-initialize with any new animations
    this.initializeAnimations();
    
    // Start with idle animation if available
    const idleAction = this.actions.get('idle_a') || this.actions.get('Idle_A') || this.actions.get('idle');
    if (idleAction && !this.currentAnimation) {
      this.playAnimation(idleAction.name);
    }
  }

  /**
   * Initialize blendshapes from the model
   */
  private initializeBlendshapes(): void {
    // Find mesh with morphTargetInfluences
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetInfluences) {
        if (child.morphTargetDictionary) {
          // Create blendshape states
          for (const [name] of Object.entries(child.morphTargetDictionary)) {
            const blendshapeState: BlendshapeState = {
              name: name,
              weight: 0,
              targetWeight: 0,
              animationDuration: 0,
              isAnimating: false
            };
            this.blendshapes.set(name, blendshapeState);
          }
        }
      }
    });

    Logger.info(LogCategory.CORE, `[AnimationController] Loaded ${this.blendshapes.size} blendshapes for ${this.characterId}`);
  }

  /**
   * Play an animation with optional settings
   */
  playAnimation(name: string, options?: AnimationPlayOptions): boolean {
    if (!this.isInitialized) {
      Logger.warn(LogCategory.CORE, `[AnimationController] Cannot play animation - controller not initialized`);
      return false;
    }

    const actionState = this.actions.get(name);
    if (!actionState) {
      Logger.warn(LogCategory.CORE, `[AnimationController] Animation '${name}' not found for character ${this.characterId}`);
      return false;
    }

    // Apply options
    const blendTime = options?.blendTime ?? this.blendTime;
    const timeScale = options?.timeScale ?? this.timeScale;
    const priority = options?.priority ?? AnimationPriority.NORMAL;
    const interrupting = options?.interrupting ?? true;

    // Stop current animation if interrupting
    if (interrupting && this.currentAnimation && this.currentAnimation !== name) {
      this.stopCurrentAnimation(blendTime);
    }

    // Configure and start animation
    const action = actionState.action;
    action.reset();
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1.0);
    
    if (options?.loop !== undefined) {
      action.setLoop(options.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      actionState.loop = options.loop;
    }

    // Fade in animation
    if (options?.fadeIn !== undefined) {
      action.fadeIn(options.fadeIn);
    } else {
      action.fadeIn(blendTime);
    }

    action.play();
    
    // Update state
    actionState.isActive = true;
    actionState.weight = 1.0;
    actionState.timeScale = timeScale;
    actionState.priority = priority;
    this.currentAnimation = name;
    this.metrics.activeAnimations++;

    // Fire event
    this.fireAnimationEvent('start', name);

    Logger.debug(LogCategory.CORE, `[AnimationController] Playing animation '${name}' for character ${this.characterId}`);
    return true;
  }

  /**
   * Stop current animation
   */
  stopAnimation(): void {
    if (this.currentAnimation) {
      this.stopCurrentAnimation(this.blendTime);
    }
  }

  /**
   * Pause current animation
   */
  pauseAnimation(): void {
    if (this.currentAnimation) {
      const actionState = this.actions.get(this.currentAnimation);
      if (actionState) {
        actionState.action.paused = true;
        this._isPaused = true;
      }
    }
  }

  /**
   * Resume current animation
   */
  resumeAnimation(): void {
    if (this.currentAnimation) {
      const actionState = this.actions.get(this.currentAnimation);
      if (actionState) {
        actionState.action.paused = false;
        this._isPaused = false;
      }
    }
  }

  /**
   * Update animation system
   */
  update(deltaTime: number): void {
    if (!this.isInitialized || this._isPaused) return;

    const updateStart = performance.now();
    
    // Update animation mixer
    this.mixer.update(deltaTime);
    
    // Update blendshapes
    this.updateBlendshapes(deltaTime);
    
    // Update performance metrics
    this.updateMetrics(performance.now() - updateStart);
    
    // Check for finished animations
    this.checkAnimationCompletion();
  }

  /**
   * Get current animation name
   */
  getCurrentAnimation(): string | null {
    return this.currentAnimation;
  }

  /**
   * Check if any animation is playing
   */
  isPlaying(): boolean {
    return this.currentAnimation !== null && !this._isPaused;
  }

  /**
   * Check if animation is paused
   */
  isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Get animation progress (0-1)
   */
  getAnimationProgress(): number {
    if (!this.currentAnimation) return 0;
    
    const actionState = this.actions.get(this.currentAnimation);
    if (!actionState) return 0;
    
    const action = actionState.action;
    const clip = this.animations.get(this.currentAnimation);
    if (!clip) return 0;
    
    return action.time / clip.duration;
  }

  /**
   * Set blendshape weight
   */
  setBlendshape(name: string, weight: number): void {
    const blendshapeState = this.blendshapes.get(name);
    if (!blendshapeState) {
      Logger.warn(LogCategory.CORE, `[AnimationController] Blendshape '${name}' not found for character ${this.characterId}`);
      return;
    }

    // Clamp weight to valid range
    weight = Math.max(0, Math.min(1, weight));
    
    // Update state
    blendshapeState.weight = weight;
    blendshapeState.targetWeight = weight;
    blendshapeState.isAnimating = false;
    
    // Apply to mesh
    this.applyBlendshapeToMesh(name, weight);
  }

  /**
   * Get blendshape weight
   */
  getBlendshape(name: string): number {
    const blendshapeState = this.blendshapes.get(name);
    return blendshapeState ? blendshapeState.weight : 0;
  }

  /**
   * Animate blendshape to target weight
   */
  animateBlendshape(name: string, targetWeight: number, duration: number): void {
    const blendshapeState = this.blendshapes.get(name);
    if (!blendshapeState) {
      Logger.warn(LogCategory.CORE, `[AnimationController] Blendshape '${name}' not found for character ${this.characterId}`);
      return;
    }

    // Clamp target weight
    targetWeight = Math.max(0, Math.min(1, targetWeight));
    
    // Setup animation
    blendshapeState.targetWeight = targetWeight;
    blendshapeState.animationDuration = duration;
    blendshapeState.isAnimating = true;
  }

  /**
   * Reset all blendshapes to neutral
   */
  resetBlendshapes(): void {
    this.blendshapes.forEach((_, name) => {
      this.setBlendshape(name, 0);
    });
  }

  /**
   * Set default blend time
   */
  setBlendTime(time: number): void {
    this.blendTime = Math.max(0, time);
  }

  /**
   * Get default blend time
   */
  getBlendTime(): number {
    return this.blendTime;
  }

  /**
   * Set time scale for animations
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
    
    // Apply to current animation
    if (this.currentAnimation) {
      const actionState = this.actions.get(this.currentAnimation);
      if (actionState) {
        actionState.action.setEffectiveTimeScale(this.timeScale);
        actionState.timeScale = this.timeScale;
      }
    }
  }

  /**
   * Get time scale
   */
  getTimeScale(): number {
    return this.timeScale;
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: (event: AnimationEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: (event: AnimationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): AnimationMetrics {
    return { ...this.metrics };
  }

  /**
   * Set performance mode
   */
  setPerformanceMode(mode: 'high' | 'medium' | 'low'): void {
    switch (mode) {
      case 'high':
        this.blendTime = 0.3;
        break;
      case 'medium':
        this.blendTime = 0.2;
        break;
      case 'low':
        this.blendTime = 0.1;
        break;
    }
  }

  /**
   * Convenience methods for animation categories
   */
  playIdleAnimation(variation: 'a' | 'b' | 'c' = 'a'): void {
    const animationName = `idle_${variation}`;
    this.playAnimation(animationName);
  }

  playMovementAnimation(type: 'walk' | 'run' | 'jump' | 'swim' | 'fly'): void {
    this.playAnimation(type);
  }

  playActionAnimation(type: 'eat' | 'clicked' | 'fear' | 'death' | 'sit'): void {
    this.playAnimation(type);
  }

  playTrickAnimation(type: 'roll' | 'bounce' | 'spin'): void {
    this.playAnimation(type);
  }

  /**
   * Private helper methods
   */
  private stopCurrentAnimation(blendTime: number): void {
    if (!this.currentAnimation) return;
    
    const actionState = this.actions.get(this.currentAnimation);
    if (actionState) {
      actionState.action.fadeOut(blendTime);
      actionState.isActive = false;
      actionState.weight = 0;
      this.metrics.activeAnimations--;
      
      // Fire event
      this.fireAnimationEvent('interrupt', this.currentAnimation);
    }
    
    this.currentAnimation = null;
  }

  private isLoopingAnimation(animationName: string): boolean {
    // Define which animations should loop
    const loopingAnimations = ['idle_a', 'idle_b', 'idle_c', 'walk', 'run', 'swim', 'fly'];
    return loopingAnimations.some(name => animationName.toLowerCase().includes(name));
  }

  private getAnimationPriority(animationName: string): AnimationPriority {
    const name = animationName.toLowerCase();
    
    if (name.includes('death')) return AnimationPriority.CRITICAL;
    if (name.includes('fear') || name.includes('hit')) return AnimationPriority.HIGH;
    if (name.includes('idle')) return AnimationPriority.LOW;
    
    return AnimationPriority.NORMAL;
  }

  private updateBlendshapes(deltaTime: number): void {
    this.blendshapes.forEach((state, name) => {
      if (state.isAnimating) {
        const progress = deltaTime / state.animationDuration;
        const newWeight = THREE.MathUtils.lerp(state.weight, state.targetWeight, progress);
        
        state.weight = newWeight;
        this.applyBlendshapeToMesh(name, newWeight);
        
        // Check if animation is complete
        if (Math.abs(newWeight - state.targetWeight) < 0.01) {
          state.weight = state.targetWeight;
          state.isAnimating = false;
          this.applyBlendshapeToMesh(name, state.targetWeight);
        }
      }
    });
  }

  private applyBlendshapeToMesh(name: string, weight: number): void {
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetInfluences && child.morphTargetDictionary) {
        const index = child.morphTargetDictionary[name];
        if (index !== undefined) {
          child.morphTargetInfluences[index] = weight;
        }
      }
    });
  }

  private updateMetrics(updateTime: number): void {
    this.metrics.updateTime = updateTime;
    this.frameCount++;
    
    // Update frame rate every second
    const now = performance.now();
    if (now - this.lastFrameTime >= 1000) {
      this.metrics.frameRate = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }
  }

  private checkAnimationCompletion(): void {
    if (!this.currentAnimation) return;
    
    const actionState = this.actions.get(this.currentAnimation);
    if (actionState && !actionState.loop) {
      const action = actionState.action;
      const clip = this.animations.get(this.currentAnimation);
      
      if (clip && action.time >= clip.duration - 0.01) {
        // Animation finished
        this.fireAnimationEvent('finish', this.currentAnimation);
        
        // Reset to idle
        this.playIdleAnimation('a');
      }
    }
  }

  private fireAnimationEvent(eventType: 'start' | 'loop' | 'finish' | 'interrupt', animationName: string): void {
    const event: AnimationEvent = {
      characterId: this.characterId,
      animationName: animationName,
      eventType: eventType,
      timestamp: performance.now()
    };
    
    // Fire to local listeners
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
    
    // Fire to global event bus - would need EventBus instance passed to constructor
    // EventBus.emit('animation:' + eventType, event);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.mixer.stopAllAction();
    this.animations.clear();
    this.actions.clear();
    this.blendshapes.clear();
    this.eventListeners.clear();
    this.currentAnimation = null;
    this.isInitialized = false;
    
    Logger.info(LogCategory.CORE, `[AnimationController] Disposed controller for character: ${this.characterId}`);
  }
} 