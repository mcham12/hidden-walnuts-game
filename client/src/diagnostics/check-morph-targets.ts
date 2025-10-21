// Diagnostic script to check character models for morph targets/blendshapes
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

interface MorphTargetInfo {
  meshName: string;
  morphTargetCount: number;
  morphTargetNames: string[];
}

async function checkModelForMorphTargets(modelPath: string): Promise<MorphTargetInfo[]> {
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      modelPath,
      (gltf) => {
        const morphTargetsInfo: MorphTargetInfo[] = [];

        gltf.scene.traverse((child: any) => {
          if (child.isMesh) {
            const mesh = child as THREE.Mesh;

            // Check if mesh has morph targets
            if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
              const morphTargetNames = Object.keys(mesh.morphTargetDictionary);

              morphTargetsInfo.push({
                meshName: child.name || 'Unnamed Mesh',
                morphTargetCount: morphTargetNames.length,
                morphTargetNames: morphTargetNames
              });
            }
          }
        });

        resolve(morphTargetsInfo);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

// Check all character models
const characterModels = [
  { id: 'colobus', path: '/assets/animations/characters/Colobus_Animations.glb' },
  { id: 'gecko', path: '/assets/animations/characters/Gecko_Animations.glb' },
  { id: 'herring', path: '/assets/animations/characters/Herring_Animations.glb' },
  { id: 'inkfish', path: '/assets/animations/characters/Inkfish_Animations.glb' },
  { id: 'muskrat', path: '/assets/animations/characters/Muskrat_Animations.glb' },
  { id: 'pudu', path: '/assets/animations/characters/Pudu_Animations.glb' },
  { id: 'sparrow', path: '/assets/animations/characters/Sparrow_Animations.glb' },
  { id: 'taipan', path: '/assets/animations/characters/Taipan_Animations.glb' },
];

export async function diagnoseCharacterMorphTargets() {
  console.log('🔍 Checking character models for morph targets/blendshapes...\n');

  for (const character of characterModels) {
    try {
      console.log(`Checking ${character.id}...`);
      const morphTargets = await checkModelForMorphTargets(character.path);

      if (morphTargets.length === 0) {
        console.log(`  ❌ No morph targets found in ${character.id}`);
      } else {
        console.log(`  ✅ ${character.id} has morph targets:`);
        morphTargets.forEach(info => {
          console.log(`    - Mesh: "${info.meshName}"`);
          console.log(`      Count: ${info.morphTargetCount}`);
          console.log(`      Names: ${info.morphTargetNames.join(', ')}`);
        });
      }
      console.log('');
    } catch (error) {
      console.error(`  ❌ Error loading ${character.id}:`, error);
      console.log('');
    }
  }

  console.log('🏁 Diagnosis complete!');
}

// Export for console usage
(window as any).diagnoseCharacterMorphTargets = diagnoseCharacterMorphTargets;
