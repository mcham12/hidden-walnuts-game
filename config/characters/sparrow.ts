import { CharacterConfig } from './index';

const SparrowConfig: CharacterConfig = {
  id: 'sparrow',
  name: 'Sparrow',
  description: 'A nimble and social bird, perfect for flying and group activities.',
  models: {
    lod0: 'assets/models/Sparrow_LOD0.glb',
    lod1: 'assets/models/Sparrow_LOD1.glb',
    lod2: 'assets/models/Sparrow_LOD2.glb',
    lod3: 'assets/models/Sparrow_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Sparrow_Idle_A.glb',
      'assets/models/Animations/Single/Sparrow_Idle_B.glb',
      'assets/models/Animations/Single/Sparrow_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Sparrow_Run.glb',
      'assets/models/Animations/Single/Sparrow_Walk.glb',
      'assets/models/Animations/Single/Sparrow_Jump.glb',
      'assets/models/Animations/Single/Sparrow_Roll.glb',
      'assets/models/Animations/Single/Sparrow_Swim.glb',
      'assets/models/Animations/Single/Sparrow_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Sparrow_Attack.glb',
      'assets/models/Animations/Single/Sparrow_Bounce.glb',
      'assets/models/Animations/Single/Sparrow_Clicked.glb',
      'assets/models/Animations/Single/Sparrow_Death.glb',
      'assets/models/Animations/Single/Sparrow_Eat.glb',
      'assets/models/Animations/Single/Sparrow_Fear.glb',
      'assets/models/Animations/Single/Sparrow_Hit.glb',
      'assets/models/Animations/Single/Sparrow_Sit.glb',
      'assets/models/Animations/Single/Sparrow_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Sparrow.png',
  },
  metadata: {
    unlockRequirement: 150,
    rarity: 'rare',
    tags: ['flyer', 'social'],
  },
};

export default SparrowConfig; 