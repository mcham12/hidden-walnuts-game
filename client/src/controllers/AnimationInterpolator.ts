import { AnimationState } from '../types/NetworkAnimationTypes';

export class AnimationInterpolator {
  private previousState: AnimationState | null = null;
  private targetState: AnimationState | null = null;
  private interpolationTime: number = 0;
  private duration: number = 0.1; // 100ms default interpolation

  setTargetState(state: AnimationState): void {
    this.previousState = this.targetState;
    this.targetState = state;
    this.interpolationTime = 0;
  }

  update(deltaTime: number): AnimationState | null {
    if (!this.previousState || !this.targetState) return this.targetState;
    this.interpolationTime += deltaTime;
    const t = Math.min(this.interpolationTime / this.duration, 1);
    return {
      characterType: this.targetState.characterType,
      currentAnimation: this.targetState.currentAnimation,
      animationTime: this.interpolateAnimationTime(
        this.previousState.animationTime,
        this.targetState.animationTime,
        t
      ),
      isPlaying: this.targetState.isPlaying,
      blendTime: this.interpolateBlendTime(
        this.previousState.blendTime,
        this.targetState.blendTime,
        t
      ),
      timestamp: this.lerp(
        this.previousState.timestamp,
        this.targetState.timestamp,
        t
      ),
    };
  }

  private interpolateAnimationTime(prev: number, target: number, t: number): number {
    // Handle wrap-around for looping animations if needed
    return this.lerp(prev, target, t);
  }

  private interpolateBlendTime(prev: number, target: number, t: number): number {
    return this.lerp(prev, target, t);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
} 