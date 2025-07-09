import { CharacterConfig } from './index';

const MuskratConfig: CharacterConfig = {
  id: 'muskrat',
  name: 'Muskrat',
  description: 'A sturdy and determined rodent, perfect for digging and building.',
  models: {
    lod0: 'assets/models/Muskrat_LOD0.glb',
    lod1: 'assets/models/Muskrat_LOD1.glb',
    lod2: 'assets/models/Muskrat_LOD2.glb',
    lod3: 'assets/models/Muskrat_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Muskrat_Idle_A.glb',
      'assets/models/Animations/Single/Muskrat_Idle_B.glb',
      'assets/models/Animations/Single/Muskrat_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Muskrat_Run.glb',
      'assets/models/Animations/Single/Muskrat_Walk.glb',
      'assets/models/Animations/Single/Muskrat_Jump.glb',
      'assets/models/Animations/Single/Muskrat_Roll.glb',
      'assets/models/Animations/Single/Muskrat_Swim.glb',
      'assets/models/Animations/Single/Muskrat_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Muskrat_Attack.glb',
      'assets/models/Animations/Single/Muskrat_Bounce.glb',
      'assets/models/Animations/Single/Muskrat_Clicked.glb',
      'assets/models/Animations/Single/Muskrat_Death.glb',
      'assets/models/Animations/Single/Muskrat_Eat.glb',
      'assets/models/Animations/Single/Muskrat_Fear.glb',
      'assets/models/Animations/Single/Muskrat_Hit.glb',
      'assets/models/Animations/Single/Muskrat_Sit.glb',
      'assets/models/Animations/Single/Muskrat_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Muskrat.png',
  },
  metadata: {
    unlockRequirement: 75,
    rarity: 'rare',
    tags: ['digger', 'builder'],
  },
};

export default MuskratConfig; 