import { CharacterConfig } from './index';

const InkfishConfig: CharacterConfig = {
  id: 'inkfish',
  name: 'Inkfish',
  description: 'A mysterious and elusive creature, perfect for stealth and deception.',
  models: {
    lod0: 'assets/models/Inkfish_LOD0.glb',
    lod1: 'assets/models/Inkfish_LOD1.glb',
    lod2: 'assets/models/Inkfish_LOD2.glb',
    lod3: 'assets/models/Inkfish_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Inkfish_Idle_A.glb',
      'assets/models/Animations/Single/Inkfish_Idle_B.glb',
      'assets/models/Animations/Single/Inkfish_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Inkfish_Run.glb',
      'assets/models/Animations/Single/Inkfish_Walk.glb',
      'assets/models/Animations/Single/Inkfish_Jump.glb',
      'assets/models/Animations/Single/Inkfish_Roll.glb',
      'assets/models/Animations/Single/Inkfish_Swim.glb',
      'assets/models/Animations/Single/Inkfish_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Inkfish_Attack.glb',
      'assets/models/Animations/Single/Inkfish_Bounce.glb',
      'assets/models/Animations/Single/Inkfish_Clicked.glb',
      'assets/models/Animations/Single/Inkfish_Death.glb',
      'assets/models/Animations/Single/Inkfish_Eat.glb',
      'assets/models/Animations/Single/Inkfish_Fear.glb',
      'assets/models/Animations/Single/Inkfish_Hit.glb',
      'assets/models/Animations/Single/Inkfish_Sit.glb',
      'assets/models/Animations/Single/Inkfish_Splash.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Inkfish.png',
  },
  metadata: {
    unlockRequirement: 50,
    rarity: 'epic',
    tags: ['stealth', 'mysterious'],
  },
};

export default InkfishConfig; 