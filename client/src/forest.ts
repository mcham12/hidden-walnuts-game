import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrain.js';
import { CollisionSystem } from './CollisionSystem.js';

const loader = new GLTFLoader();
const TREE_COUNT = 50;
const BUSH_COUNT = 30;

// Cache for loaded models
let treeModel: THREE.Group | null = null;
let bushModel: THREE.Group | null = null;

// Export bush positions for walnut hiding
export const bushPositions: THREE.Vector3[] = [];

// Export function to create forest from server data
export async function createForestFromServer(
  scene: THREE.Scene,
  forestObjects: Array<{ type: 'tree' | 'shrub'; x: number; y: number; z: number; scale: number }>,
  collisionSystem?: CollisionSystem
) {
  try {
    // Load models once
    console.log('Loading forest models from server data...');
    treeModel = await loadModel('/assets/models/environment/Tree_01.glb');
    bushModel = await loadModel('/assets/models/environment/Bush_01.glb');
    console.log('Forest models loaded successfully');

    // Clear bush positions (in case of reload)
    bushPositions.length = 0;

    // Create forest objects from server data
    let treeCount = 0;
    for (const obj of forestObjects) {
      const y = getTerrainHeight(obj.x, obj.z);

      if (obj.type === 'tree') {
        const tree = treeModel.clone();
        tree.position.set(obj.x, y, obj.z);
        tree.scale.set(obj.scale, obj.scale, obj.scale);
        scene.add(tree);

        // MVP 5.5: Add collision for tree
        if (collisionSystem) {
          // Trunk radius roughly 0.3 units at base scale, height roughly 5 units
          const collisionRadius = 0.3 * obj.scale;
          const collisionHeight = 5 * obj.scale;
          collisionSystem.addTreeCollider(
            `forest_tree_${treeCount}`,
            new THREE.Vector3(obj.x, y, obj.z),
            collisionRadius,
            collisionHeight
          );
        }
        treeCount++;
      } else if (obj.type === 'shrub') {
        const bush = bushModel.clone();
        bush.position.set(obj.x, y, obj.z);
        bush.scale.set(obj.scale, obj.scale, obj.scale);
        scene.add(bush);

        // Store bush position for walnut hiding
        bushPositions.push(new THREE.Vector3(obj.x, y, obj.z));

        // Note: Bushes are passable, no collision needed
      }
    }

    console.log(`🔒 Added collision for ${treeCount} forest trees`);

    console.log(`✅ Forest created from server: ${forestObjects.filter(o => o.type === 'tree').length} trees, ${bushPositions.length} bushes`);
  } catch (error) {
    console.error('Failed to create forest from server:', error);
    // Create simple fallback forest
    createFallbackForest(scene);
  }
}

// Legacy function for backwards compatibility - generates random forest (DO NOT USE)
export async function createForest(scene: THREE.Scene) {
  console.warn('⚠️ createForest() is deprecated - use createForestFromServer() with server data instead');
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

      // Store bush position for walnut hiding
      bushPositions.push(new THREE.Vector3(x, y, z));
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

    // Store bush position for walnut hiding
    bushPositions.push(new THREE.Vector3(x, y, z));
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