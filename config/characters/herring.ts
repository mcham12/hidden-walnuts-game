import { CharacterConfig } from './index';

const HerringConfig: CharacterConfig = {
  id: 'herring',
  name: 'Herring',
  description: 'A swift and agile fish, perfect for swimming and quick escapes.',
  models: {
    lod0: 'assets/models/Herring_LOD0.glb',
    lod1: 'assets/models/Herring_LOD1.glb',
    lod2: 'assets/models/Herring_LOD2.glb',
    lod3: 'assets/models/Herring_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Herring_Idle_A.glb',
      'assets/models/Animations/Single/Herring_Idle_B.glb',
      'assets/models/Animations/Single/Herring_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Herring_Run.glb',
      'assets/models/Animations/Single/Herring_Walk.glb',
      'assets/models/Animations/Single/Herring_Jump.glb',
      'assets/models/Animations/Single/Herring_Roll.glb',
      'assets/models/Animations/Single/Herring_Swim.glb',
      'assets/models/Animations/Single/Herring_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Herring_Attack.glb',
      'assets/models/Animations/Single/Herring_Bounce.glb',
      'assets/models/Animations/Single/Herring_Clicked.glb',
      'assets/models/Animations/Single/Herring_Death.glb',
      'assets/models/Animations/Single/Herring_Eat.glb',
      'assets/models/Animations/Single/Herring_Fear.glb',
      'assets/models/Animations/Single/Herring_Hit.glb',
      'assets/models/Animations/Single/Herring_Sit.glb',
      'assets/models/Animations/Single/Herring_Splash.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Herring.png',
  },
  metadata: {
    unlockRequirement: 25,
    rarity: 'rare',
    tags: ['swimmer', 'fast'],
  },
};

export default HerringConfig; 