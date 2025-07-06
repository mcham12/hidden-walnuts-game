export interface AnimationState {
  characterType: string;
  currentAnimation: string;
  animationTime: number;
  isPlaying: boolean;
  blendTime: number;
  timestamp: number;
}

export interface CompressedAnimationData {
  characterType: string;
  state: number; // Encoded animation state
  time: number;  // Normalized animation time
  flags: number; // Bit flags for additional data
} 