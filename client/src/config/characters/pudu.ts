import { CharacterConfig, AIBehaviorType } from '../../types/CharacterTypes';

/**
 * Pudu Character Configuration
 * Small deer-like mammal with graceful movements and alert behaviors
 */
export const puduConfig: CharacterConfig = {
  id: 'pudu',
  name: 'Pudu',
  modelPath: 'assets/models/Pudu_LOD0.glb',
  scale: 1.0,
  lodPaths: {
    lod0: 'assets/models/Pudu_LOD0.glb',
    lod1: 'assets/models/Pudu_LOD1.glb',
    lod2: 'assets/models/Pudu_LOD2.glb',
    lod3: 'assets/models/Pudu_LOD3.glb'
  },
  animations: {
    // Core animations
    idle_a: 'assets/models/Animations/Single/Pudu_Idle_A.glb',
    idle_b: 'assets/models/Animations/Single/Pudu_Idle_B.glb',
    idle_c: 'assets/models/Animations/Single/Pudu_Idle_C.glb',
    walk: 'assets/models/Animations/Single/Pudu_Walk.glb',
    run: 'assets/models/Animations/Single/Pudu_Run.glb',
    jump: 'assets/models/Animations/Single/Pudu_Jump.glb',
    
    // Movement animations
    swim: 'assets/models/Animations/Single/Pudu_Swim.glb',
    fly: 'assets/models/Animations/Single/Pudu_Fly.glb',
    roll: 'assets/models/Animations/Single/Pudu_Roll.glb',
    bounce: 'assets/models/Animations/Single/Pudu_Bounce.glb',
    spin: 'assets/models/Animations/Single/Pudu_Spin.glb',
    
    // Action animations
    eat: 'assets/models/Animations/Single/Pudu_Eat.glb',
    clicked: 'assets/models/Animations/Single/Pudu_Clicked.glb',
    fear: 'assets/models/Animations/Single/Pudu_Fear.glb',
    death: 'assets/models/Animations/Single/Pudu_Death.glb',
    sit: 'assets/models/Animations/Single/Pudu_Sit.glb',
    
    // Special animations
    attack: 'assets/models/Animations/Single/Pudu_Attack.glb',
    hit: 'assets/models/Animations/Single/Pudu_Hit.glb'
  },
  blendshapes: {
    // Eye expressions
    eyes_blink: 'eyes_blink',
    eyes_happy: 'eyes_happy',
    eyes_sad: 'eyes_sad',
    eyes_annoyed: 'eyes_annoyed',
    eyes_squint: 'eyes_squint',
    eyes_shrink: 'eyes_shrink',
    eyes_dead: 'eyes_dead',
    eyes_lookOut: 'eyes_lookOut',
    eyes_lookIn: 'eyes_lookIn',
    eyes_lookUp: 'eyes_lookUp',
    eyes_lookDown: 'eyes_lookDown',
    eyes_excited_1: 'eyes_excited_1',
    eyes_excited_2: 'eyes_excited_2',
    eyes_rabid: 'eyes_rabid',
    eyes_spin_1: 'eyes_spin_1',
    eyes_spin_2: 'eyes_spin_2',
    eyes_spin_3: 'eyes_spin_3',
    eyes_cry_1: 'eyes_cry_1',
    eyes_cry_2: 'eyes_cry_2',
    eyes_trauma: 'eyes_trauma',
    
    // Tear and sweat effects
    teardrop_1_L: 'teardrop_1_L',
    teardrop_2_L: 'teardrop_2_L',
    teardrop_1_R: 'teardrop_1_R',
    teardrop_2_R: 'teardrop_2_R',
    sweat_1_L: 'sweat_1_L',
    sweat_2_L: 'sweat_2_L',
    sweat_1_R: 'sweat_1_R',
    sweat_2_R: 'sweat_2_R'
  },
  behaviors: {
    isPlayer: true,
    isNPC: true,
    movementSpeed: 1.15,     // Graceful, swift movements
    jumpHeight: 1.4,         // Excellent jumping ability
    canSwim: true,
    canFly: false,
    aiBehaviors: [
      AIBehaviorType.FLEE,
      AIBehaviorType.FORAGE,
      AIBehaviorType.PATROL,
      AIBehaviorType.CURIOUS,
      AIBehaviorType.SOCIALIZE
    ]
  },
  network: {
    syncAnimations: true,
    compressionLevel: 0.7
  }
}; 