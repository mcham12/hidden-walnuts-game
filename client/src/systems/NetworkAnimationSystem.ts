import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { AnimationState, CompressedAnimationData } from '../types/NetworkAnimationTypes';

export class NetworkAnimationSystem extends System {
  private localAnimationStates = new Map<string, AnimationState>();
  private remoteAnimationStates = new Map<string, AnimationState>();

  constructor(eventBus: EventBus) {
    super(eventBus, ['animation', 'network'], 'NetworkAnimationSystem');
  }

  update(_deltaTime: number): void {
    // Serialize and send local animation states
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<any>('network');
      if (network?.isLocalPlayer) {
        const state = this.serializeLocalAnimation(entity);
        this.localAnimationStates.set(entity.id.value, state);
        // TODO: Send compressed state over network
        // Example: this.eventBus.emit('network.send_animation_state', this.compressAnimationData(state));
      } else {
        // For remote players, update animation from received state
        const remoteState = this.remoteAnimationStates.get(entity.id.value);
        if (remoteState) {
          this.deserializeRemoteAnimation(remoteState, entity);
        }
      }
    }
  }

  serializeLocalAnimation(entity: Entity): AnimationState {
    // Example: get animation controller and extract state
    const animationComponent = entity.getComponent<any>('animation');
    const network = entity.getComponent<any>('network');
    if (!animationComponent || !network) {
      throw new Error('Missing animation or network component');
    }
    const controller = animationComponent.controller;
    return {
      characterType: network.characterType,
      currentAnimation: controller.getCurrentAnimation?.() || '',
      animationTime: controller.getAnimationProgress?.() || 0,
      isPlaying: controller.isPlaying?.() || false,
      blendTime: controller.getBlendTime?.() || 0.3,
      timestamp: performance.now(),
    };
  }

  deserializeRemoteAnimation(data: AnimationState, entity: Entity): void {
    // Example: set animation state on remote entity's controller
    const animationComponent = entity.getComponent<any>('animation');
    if (!animationComponent) return;
    const controller = animationComponent.controller;
    if (controller && controller.playAnimation) {
      controller.playAnimation(data.currentAnimation, { blendTime: data.blendTime });
      // Optionally set animation time if supported
      // controller.setAnimationTime?.(data.animationTime);
    }
  }

  compressAnimationData(state: AnimationState): CompressedAnimationData {
    // Example: simple compression (real implementation should be more efficient)
    return {
      characterType: state.characterType,
      state: this.encodeAnimationState(state.currentAnimation),
      time: Math.round(state.animationTime * 1000),
      flags: (state.isPlaying ? 1 : 0),
    };
  }

  decompressAnimationData(data: CompressedAnimationData): AnimationState {
    return {
      characterType: data.characterType,
      currentAnimation: this.decodeAnimationState(data.state),
      animationTime: data.time / 1000,
      isPlaying: (data.flags & 1) !== 0,
      blendTime: 0.3, // Default or transmit if needed
      timestamp: performance.now(),
    };
  }

  private encodeAnimationState(animation: string): number {
    // Map animation names to numbers (should be consistent across clients)
    // Example: use a hash or lookup table
    switch (animation) {
      case 'idle_a': return 1;
      case 'idle_b': return 2;
      case 'idle_c': return 3;
      case 'walk': return 4;
      case 'run': return 5;
      case 'jump': return 6;
      case 'swim': return 7;
      case 'fly': return 8;
      case 'roll': return 9;
      case 'bounce': return 10;
      case 'spin': return 11;
      case 'eat': return 12;
      case 'clicked': return 13;
      case 'fear': return 14;
      case 'death': return 15;
      case 'sit': return 16;
      default: return 0;
    }
  }

  private decodeAnimationState(state: number): string {
    switch (state) {
      case 1: return 'idle_a';
      case 2: return 'idle_b';
      case 3: return 'idle_c';
      case 4: return 'walk';
      case 5: return 'run';
      case 6: return 'jump';
      case 7: return 'swim';
      case 8: return 'fly';
      case 9: return 'roll';
      case 10: return 'bounce';
      case 11: return 'spin';
      case 12: return 'eat';
      case 13: return 'clicked';
      case 14: return 'fear';
      case 15: return 'death';
      case 16: return 'sit';
      default: return 'idle_a';
    }
  }

  // Public API for network integration
  receiveRemoteAnimationState(entityId: string, data: CompressedAnimationData): void {
    const state = this.decompressAnimationData(data);
    this.remoteAnimationStates.set(entityId, state);
  }
} 