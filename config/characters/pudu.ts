import { CharacterConfig } from './index';

const PuduConfig: CharacterConfig = {
  id: 'pudu',
  name: 'Pudu',
  description: 'A small and graceful deer, perfect for gentle exploration and observation.',
  models: {
    lod0: 'assets/models/Pudu_LOD0.glb',
    lod1: 'assets/models/Pudu_LOD1.glb',
    lod2: 'assets/models/Pudu_LOD2.glb',
    lod3: 'assets/models/Pudu_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Pudu_Idle_A.glb',
      'assets/models/Animations/Single/Pudu_Idle_B.glb',
      'assets/models/Animations/Single/Pudu_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Pudu_Run.glb',
      'assets/models/Animations/Single/Pudu_Walk.glb',
      'assets/models/Animations/Single/Pudu_Jump.glb',
      'assets/models/Animations/Single/Pudu_Roll.glb',
      'assets/models/Animations/Single/Pudu_Swim.glb',
      'assets/models/Animations/Single/Pudu_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Pudu_Attack.glb',
      'assets/models/Animations/Single/Pudu_Bounce.glb',
      'assets/models/Animations/Single/Pudu_Clicked.glb',
      'assets/models/Animations/Single/Pudu_Death.glb',
      'assets/models/Animations/Single/Pudu_Eat.glb',
      'assets/models/Animations/Single/Pudu_Fear.glb',
      'assets/models/Animations/Single/Pudu_Hit.glb',
      'assets/models/Animations/Single/Pudu_Sit.glb',
      'assets/models/Animations/Single/Pudu_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Pudu.png',
  },
  metadata: {
    unlockRequirement: 100,
    rarity: 'epic',
    tags: ['graceful', 'observer'],
  },
};

export default PuduConfig; 