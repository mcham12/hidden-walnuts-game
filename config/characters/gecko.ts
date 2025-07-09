import { CharacterConfig } from './index';

const GeckoConfig: CharacterConfig = {
  id: 'gecko',
  name: 'Gecko',
  description: 'A stealthy and quick lizard, perfect for sneaking and climbing.',
  models: {
    lod0: 'assets/models/Gecko_LOD0.glb',
    lod1: 'assets/models/Gecko_LOD1.glb',
    lod2: 'assets/models/Gecko_LOD2.glb',
    lod3: 'assets/models/Gecko_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Gecko_Idle_A.glb',
      'assets/models/Animations/Single/Gecko_Idle_B.glb',
      'assets/models/Animations/Single/Gecko_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Gecko_Run.glb',
      'assets/models/Animations/Single/Gecko_Walk.glb',
      'assets/models/Animations/Single/Gecko_Jump.glb',
      'assets/models/Animations/Single/Gecko_Roll.glb',
      'assets/models/Animations/Single/Gecko_Swim.glb',
      'assets/models/Animations/Single/Gecko_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Gecko_Attack.glb',
      'assets/models/Animations/Single/Gecko_Bounce.glb',
      'assets/models/Animations/Single/Gecko_Clicked.glb',
      'assets/models/Animations/Single/Gecko_Death.glb',
      'assets/models/Animations/Single/Gecko_Eat.glb',
      'assets/models/Animations/Single/Gecko_Fear.glb',
      'assets/models/Animations/Single/Gecko_Hit.glb',
      'assets/models/Animations/Single/Gecko_Sit.glb',
      'assets/models/Animations/Single/Gecko_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Gecko.png',
  },
  metadata: {
    unlockRequirement: 10,
    rarity: 'common',
    tags: ['stealth', 'climber'],
  },
};

export default GeckoConfig; 