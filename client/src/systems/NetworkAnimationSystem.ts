import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { AnimationState, CompressedAnimationData } from '../types/NetworkAnimationTypes';

/**
 * Network Animation System
 * FIXED: Complete animation synchronization with compression and lag compensation
 */
export class NetworkAnimationSystem extends System {
  private localAnimationStates = new Map<string, AnimationState>();
  private remoteAnimationStates = new Map<string, AnimationState>();
  private animationHistory = new Map<string, AnimationState[]>();
  private maxHistorySize = 10;
  private compressionThreshold = 0.1; // 100ms threshold for compression
  
  // FIXED: Add lag compensation
  private lagCompensation = new Map<string, number>();
  private averageLatency = 0;
  private latencySamples: number[] = [];
  private maxLatencySamples = 20;

  constructor(eventBus: EventBus) {
    super(eventBus, ['animation', 'network'], 'NetworkAnimationSystem');
    
    // FIXED: Subscribe to animation events
    this.eventBus.subscribe('animation:state_changed', this.handleLocalAnimationChange.bind(this));
    this.eventBus.subscribe('network:animation_state_received', this.handleRemoteAnimationState.bind(this));
    
    Logger.info(LogCategory.CORE, '[NetworkAnimationSystem] Initialized');
  }

  update(_deltaTime: number): void {
    // FIXED: Serialize and send local animation states
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<any>('network');
      if (network?.isLocalPlayer) {
        const state = this.serializeLocalAnimation(entity);
        if (state) {
          this.localAnimationStates.set(entity.id.value, state);
          
          // FIXED: Send compressed animation state over network
          const compressedData = this.compressAnimationData(state);
          this.eventBus.emit('network:send_animation_state', compressedData);
        }
      } else {
        // FIXED: For remote players, update animation from received state with lag compensation
        const remoteState = this.remoteAnimationStates.get(entity.id.value);
        if (remoteState) {
          this.deserializeRemoteAnimation(remoteState, entity);
        }
      }
    }
  }

  /**
   * FIXED: Serialize local animation state
   */
  private serializeLocalAnimation(entity: Entity): AnimationState | null {
    const animationComponent = entity.getComponent<any>('animation');
    const network = entity.getComponent<any>('network');
    
    if (!animationComponent || !network) {
      return null;
    }

    const controller = animationComponent.controller;
    if (!controller) {
      return null;
    }

    const state: AnimationState = {
      characterType: network.characterType || 'colobus',
      currentAnimation: controller.getCurrentAnimation?.() || 'idle_a',
      animationTime: controller.getAnimationProgress?.() || 0,
      isPlaying: controller.isPlaying?.() || false,
      blendTime: controller.getBlendTime?.() || 0.3,
      timestamp: performance.now()
    };

    // FIXED: Store in history for lag compensation
    this.storeAnimationHistory(entity.id.value, state);

    return state;
  }

  /**
   * FIXED: Deserialize remote animation state with lag compensation
   */
  private deserializeRemoteAnimation(data: AnimationState, entity: Entity): void {
    const animationComponent = entity.getComponent<any>('animation');
    if (!animationComponent?.controller) {
      return;
    }

    const controller = animationComponent.controller;
    const latency = this.getLatencyForEntity(entity.id.value);
    
    // FIXED: Apply lag compensation
    const compensatedTime = this.compensateForLatency(data.animationTime, latency);
    
    // FIXED: Smooth transition to new animation state
    if (controller.getCurrentAnimation?.() !== data.currentAnimation) {
      controller.playAnimation(data.currentAnimation, {
        blendTime: data.blendTime,
        timeScale: 1.0
      });
    }

    // FIXED: Set animation time with compensation
    if (controller.setAnimationTime) {
      controller.setAnimationTime(compensatedTime);
    }

    Logger.debug(LogCategory.NETWORK, `[NetworkAnimationSystem] Applied remote animation: ${data.currentAnimation} (latency: ${latency}ms)`);
  }

  /**
   * FIXED: Compress animation data for network transmission
   */
  private compressAnimationData(state: AnimationState): CompressedAnimationData {
    // FIXED: Encode animation state as integer
    const animationStateMap: { [key: string]: number } = {
      'idle_a': 0, 'idle_b': 1, 'idle_c': 2,
      'walk': 3, 'run': 4, 'jump': 5,
      'swim': 6, 'fly': 7, 'roll': 8,
      'bounce': 9, 'spin': 10, 'eat': 11,
      'clicked': 12, 'fear': 13, 'death': 14, 'sit': 15
    };

    const stateValue = animationStateMap[state.currentAnimation] || 0;
    const timeValue = Math.floor(state.animationTime * 1000); // Convert to milliseconds
    const flags = (state.isPlaying ? 1 : 0) | (state.blendTime > 0.3 ? 2 : 0);

    return {
      characterType: state.characterType,
      state: stateValue,
      time: timeValue,
      flags: flags
    };
  }

  /**
   * FIXED: Decompress animation data from network
   */
  private decompressAnimationData(data: CompressedAnimationData): AnimationState {
    const animationStateMap: { [key: number]: string } = {
      0: 'idle_a', 1: 'idle_b', 2: 'idle_c',
      3: 'walk', 4: 'run', 5: 'jump',
      6: 'swim', 7: 'fly', 8: 'roll',
      9: 'bounce', 10: 'spin', 11: 'eat',
      12: 'clicked', 13: 'fear', 14: 'death', 15: 'sit'
    };

    return {
      characterType: data.characterType,
      currentAnimation: animationStateMap[data.state] || 'idle_a',
      animationTime: data.time / 1000, // Convert from milliseconds
      isPlaying: (data.flags & 1) !== 0,
      blendTime: (data.flags & 2) !== 0 ? 0.5 : 0.3,
      timestamp: performance.now()
    };
  }

  /**
   * FIXED: Handle local animation changes
   */
  private handleLocalAnimationChange(event: any): void {
    const entity = this.entities.get(event.entityId);
    if (entity) {
      const state = this.serializeLocalAnimation(entity);
      if (state) {
        this.localAnimationStates.set(entity.id.value, state);
      }
    }
  }

  /**
   * FIXED: Handle remote animation state updates
   */
  private handleRemoteAnimationState(event: any): void {
    const { entityId, data } = event;
    const entity = this.entities.get(entityId);
    
    if (entity) {
      const decompressedData = this.decompressAnimationData(data);
      this.remoteAnimationStates.set(entityId, decompressedData);
      
      // FIXED: Apply with lag compensation
      this.deserializeRemoteAnimation(decompressedData, entity);
    }
  }

  /**
   * FIXED: Store animation history for lag compensation
   */
  private storeAnimationHistory(entityId: string, state: AnimationState): void {
    if (!this.animationHistory.has(entityId)) {
      this.animationHistory.set(entityId, []);
    }

    const history = this.animationHistory.get(entityId)!;
    history.push(state);

    // Keep history size limited
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * FIXED: Compensate for network latency
   */
  private compensateForLatency(animationTime: number, latency: number): number {
    const compensationFactor = latency / 1000; // Convert to seconds
    return animationTime + compensationFactor;
  }

  /**
   * FIXED: Get latency for specific entity
   */
  private getLatencyForEntity(entityId: string): number {
    return this.lagCompensation.get(entityId) || this.averageLatency;
  }

  /**
   * FIXED: Update latency measurements
   */
  updateLatency(entityId: string, latency: number): void {
    this.lagCompensation.set(entityId, latency);
    
    // Update average latency
    this.latencySamples.push(latency);
    if (this.latencySamples.length > this.maxLatencySamples) {
      this.latencySamples.shift();
    }
    
    this.averageLatency = this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
  }

  /**
   * FIXED: Get system statistics
   */
  getStats(): any {
    return {
      localAnimations: this.localAnimationStates.size,
      remoteAnimations: this.remoteAnimationStates.size,
      averageLatency: this.averageLatency,
      compressionThreshold: this.compressionThreshold,
      historySize: this.animationHistory.size
    };
  }
} 