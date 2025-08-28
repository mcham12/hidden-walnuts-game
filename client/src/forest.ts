import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrain.js';

const loader = new GLTFLoader();
const TREE_COUNT = 50;
const BUSH_COUNT = 30;

// Cache for loaded models
let treeModel: THREE.Group | null = null;
let bushModel: THREE.Group | null = null;

export async function createForest(scene: THREE.Scene) {
  try {
    // Load models once
    console.log('Loading forest models...');
    treeModel = await loadModel('/assets/models/environment/Tree_01.glb');
    bushModel = await loadModel('/assets/models/environment/Bush_01.glb');
    console.log('Forest models loaded successfully');

    // Create trees using cloned model
    for (let i = 0; i < TREE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const y = getTerrainHeight(x, z);
      const tree = treeModel.clone();
      tree.position.set(x, y, z);
      tree.scale.set(1, 1, 1);
      scene.add(tree);
    }

    // Create bushes using cloned model  
    for (let i = 0; i < BUSH_COUNT; i++) {
      const x = (Math.random() - 0.5) * 180;
      const z = (Math.random() - 0.5) * 180;
      const y = getTerrainHeight(x, z);
      const bush = bushModel.clone();
      bush.position.set(x, y, z);
      bush.scale.set(1, 1, 1);
      scene.add(bush);
    }
    
    console.log('Forest created with heights applied');
  } catch (error) {
    console.error('Failed to create forest:', error);
    // Create simple fallback forest
    createFallbackForest(scene);
  }
}

// Simple fallback forest with basic shapes
function createFallbackForest(scene: THREE.Scene) {
  console.log('Creating fallback forest...');
  
  // Create simple tree shapes
  for (let i = 0; i < TREE_COUNT; i++) {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const y = getTerrainHeight(x, z);
    
    const tree = new THREE.Group();
    
    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 2),
      new THREE.MeshStandardMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 1;
    tree.add(trunk);
    
    // Crown
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.5),
      new THREE.MeshStandardMaterial({ color: 0x228B22 })
    );
    crown.position.y = 2.5;
    tree.add(crown);
    
    tree.position.set(x, y, z);
    scene.add(tree);
  }
  
  // Create simple bush shapes
  for (let i = 0; i < BUSH_COUNT; i++) {
    const x = (Math.random() - 0.5) * 180;
    const z = (Math.random() - 0.5) * 180;
    const y = getTerrainHeight(x, z);
    
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x32CD32 })
    );
    bush.position.set(x, y + 0.4, z);
    scene.add(bush);
  }
  
  console.log('Fallback forest created');
}

async function loadModel(path: string): Promise<THREE.Group> {
  try {
    console.log(`Loading model: ${path}`);
    
    // Try to load the model with proper error handling
    const gltf = await loader.loadAsync(path);
    const model = gltf.scene.clone();
    
    // Set up shadows for all meshes
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    console.log(`Successfully loaded model: ${path}`);
    return model;
  } catch (error) {
    console.error(`Failed to load model ${path}:`, error);
    
    // Create a more detailed fallback based on the model type
    if (path.includes('Tree')) {
      return createFallbackTree();
    } else if (path.includes('Bush')) {
      return createFallbackBush();
    } else {
      // Generic fallback
      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      return fallback;
    }
  }
}

// Create fallback tree shape
function createFallbackTree(): THREE.Group {
  const tree = new THREE.Group();
  
  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 2),
    new THREE.MeshStandardMaterial({ color: 0x8B4513 })
  );
  trunk.position.y = 1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);
  
  // Crown
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x228B22 })
  );
  crown.position.y = 2.5;
  crown.castShadow = true;
  crown.receiveShadow = true;
  tree.add(crown);
  
  return tree;
}

// Create fallback bush shape  
function createFallbackBush(): THREE.Group {
  const bush = new THREE.Group();
  
  const bushMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x32CD32 })
  );
  bushMesh.position.y = 0.4;
  bushMesh.castShadow = true;
  bushMesh.receiveShadow = true;
  bush.add(bushMesh);
  
  return bush;
}