import { CharacterConfig } from './index';

const TaipanConfig: CharacterConfig = {
  id: 'taipan',
  name: 'Taipan',
  description: 'A swift and deadly snake, perfect for stealth and precision.',
  models: {
    lod0: 'assets/models/Taipan_LOD0.glb',
    lod1: 'assets/models/Taipan_LOD1.glb',
    lod2: 'assets/models/Taipan_LOD2.glb',
    lod3: 'assets/models/Taipan_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Taipan_Idle_A.glb',
      'assets/models/Animations/Single/Taipan_Idle_B.glb',
      'assets/models/Animations/Single/Taipan_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Taipan_Run.glb',
      'assets/models/Animations/Single/Taipan_Walk.glb',
      'assets/models/Animations/Single/Taipan_Jump.glb',
      'assets/models/Animations/Single/Taipan_Roll.glb',
      'assets/models/Animations/Single/Taipan_Swim.glb',
      'assets/models/Animations/Single/Taipan_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Taipan_Attack.glb',
      'assets/models/Animations/Single/Taipan_Bounce.glb',
      'assets/models/Animations/Single/Taipan_Clicked.glb',
      'assets/models/Animations/Single/Taipan_Death.glb',
      'assets/models/Animations/Single/Taipan_Eat.glb',
      'assets/models/Animations/Single/Taipan_Fear.glb',
      'assets/models/Animations/Single/Taipan_Hit.glb',
      'assets/models/Animations/Single/Taipan_Sit.glb',
      'assets/models/Animations/Single/Taipan_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Taipan.png',
  },
  metadata: {
    unlockRequirement: 200,
    rarity: 'legendary',
    tags: ['stealth', 'deadly'],
  },
};

export default TaipanConfig; 