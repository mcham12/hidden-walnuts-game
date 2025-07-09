import { CharacterConfig, AIBehaviorType } from '../../types/CharacterTypes';

/**
 * Herring Character Configuration
 * Fish-like aquatic animal with swimming and schooling behaviors
 */
export const herringConfig: CharacterConfig = {
  id: 'herring',
  name: 'Herring',
  modelPath: 'assets/models/Herring_LOD0.glb',
  scale: 1.0,
  lodPaths: {
    lod0: 'assets/models/Herring_LOD0.glb',
    lod1: 'assets/models/Herring_LOD1.glb',
    lod2: 'assets/models/Herring_LOD2.glb',
    lod3: 'assets/models/Herring_LOD3.glb'
  },
  animations: {
    // Core animations
    idle_a: 'assets/models/Animations/Single/Herring_Idle_A.glb',
    idle_b: 'assets/models/Animations/Single/Herring_Idle_B.glb',
    idle_c: 'assets/models/Animations/Single/Herring_Idle_C.glb',
    walk: 'assets/models/Animations/Single/Herring_Walk.glb',
    run: 'assets/models/Animations/Single/Herring_Run.glb',
    jump: 'assets/models/Animations/Single/Herring_Jump.glb',
    
    // Movement animations
    swim: 'assets/models/Animations/Single/Herring_Swim.glb',
    fly: 'assets/models/Animations/Single/Herring_Fly.glb',
    roll: 'assets/models/Animations/Single/Herring_Roll.glb',
    bounce: 'assets/models/Animations/Single/Herring_Bounce.glb',
    spin: 'assets/models/Animations/Single/Herring_Spin.glb',
    
    // Action animations
    eat: 'assets/models/Animations/Single/Herring_Eat.glb',
    clicked: 'assets/models/Animations/Single/Herring_Clicked.glb',
    fear: 'assets/models/Animations/Single/Herring_Fear.glb',
    death: 'assets/models/Animations/Single/Herring_Death.glb',
    sit: 'assets/models/Animations/Single/Herring_Sit.glb',
    
    // Special animations
    attack: 'assets/models/Animations/Single/Herring_Attack.glb',
    hit: 'assets/models/Animations/Single/Herring_Hit.glb',
    splash: 'assets/models/Animations/Single/Herring_Splash.glb'
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
    movementSpeed: 1.0,      // Steady swimming movements
    jumpHeight: 0.8,         // Limited jumping (fish out of water)
    canSwim: true,
    canFly: false,
    aiBehaviors: [
      AIBehaviorType.SOCIALIZE,
      AIBehaviorType.FORAGE,
      AIBehaviorType.FLEE,
      AIBehaviorType.PATROL,
      AIBehaviorType.REST
    ]
  },
  network: {
    syncAnimations: true,
    compressionLevel: 0.7
  }
}; 