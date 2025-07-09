import { CharacterConfig } from './index';

const ColobusConfig: CharacterConfig = {
  id: 'colobus',
  name: 'Colobus',
  description: 'A nimble and agile squirrel, perfect for quick escapes and acrobatics.',
  models: {
    lod0: 'assets/models/Colobus_LOD0.glb',
    lod1: 'assets/models/Colobus_LOD1.glb',
    lod2: 'assets/models/Colobus_LOD2.glb',
    lod3: 'assets/models/Colobus_LOD3.glb',
  },
  animations: {
    idle: [
      'assets/models/Animations/Single/Colobus_Idle_A.glb',
      'assets/models/Animations/Single/Colobus_Idle_B.glb',
      'assets/models/Animations/Single/Colobus_Idle_C.glb',
    ],
    movement: [
      'assets/models/Animations/Single/Colobus_Run.glb',
      'assets/models/Animations/Single/Colobus_Walk.glb',
      'assets/models/Animations/Single/Colobus_Jump.glb',
      'assets/models/Animations/Single/Colobus_Roll.glb',
      'assets/models/Animations/Single/Colobus_Swim.glb',
      'assets/models/Animations/Single/Colobus_Fly.glb',
    ],
    actions: [
      'assets/models/Animations/Single/Colobus_Attack.glb',
      'assets/models/Animations/Single/Colobus_Bounce.glb',
      'assets/models/Animations/Single/Colobus_Clicked.glb',
      'assets/models/Animations/Single/Colobus_Death.glb',
      'assets/models/Animations/Single/Colobus_Eat.glb',
      'assets/models/Animations/Single/Colobus_Fear.glb',
      'assets/models/Animations/Single/Colobus_Hit.glb',
      'assets/models/Animations/Single/Colobus_Sit.glb',
      'assets/models/Animations/Single/Colobus_Spin.glb',
    ],
  },
  textures: {
    diffuse: 'assets/textures/T_Colobus.png',
  },
  metadata: {
    unlockRequirement: 0,
    rarity: 'common',
    tags: ['starter', 'agile'],
  },
};

export default ColobusConfig; 