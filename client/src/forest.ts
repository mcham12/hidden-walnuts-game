import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrain.js';

const loader = new GLTFLoader();
const TREE_COUNT = 50;
const BUSH_COUNT = 30;

export async function createForest(scene: THREE.Scene) {
  // Simple procedural placement
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const y = getTerrainHeight(x, z);
    const tree = await loadModel('/assets/models/environment/Tree_01.glb');
    tree.position.set(x, y, z);
    tree.scale.set(1, 1, 1);
    scene.add(tree);
  }

  for (let i = 0; i < BUSH_COUNT; i++) {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const y = getTerrainHeight(x, z);
    const bush = await loadModel('/assets/models/environment/Bush_01.glb');
    bush.position.set(x, y, z);
    bush.scale.set(1, 1, 1);
    scene.add(bush);
  }
  console.log('Forest created with heights applied');
}

async function loadModel(path: string): Promise<THREE.Group> {
  try {
    const gltf = await loader.loadAsync(path);
    const model = gltf.scene.clone();
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return model;
  } catch (error) {
    console.error(`Failed to load model ${path}:`, error);
    // Fallback to box
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    return fallback;
  }
}