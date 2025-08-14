// Simplified forest generation for animated characters
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './terrain';

interface ForestObject {
  id: string;
  type: string;
  x: number;
  y: number;
  z: number;
  scale?: number;
  rotationY?: number;
}

const gltfLoader = new GLTFLoader();

async function loadGLTF(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  });
}

export async function createForest(): Promise<THREE.Object3D[]> {
  console.log('🌲 Creating simple forest...');
  
  const forestObjects: THREE.Object3D[] = [];
  
  try {
    // Try to fetch forest objects from backend
    const response = await fetch('http://localhost:8787/forest-objects');
    
    if (response.ok) {
      const data: ForestObject[] = await response.json();
      console.log(`🌲 Loaded ${data.length} forest objects from server`);
      
      for (const obj of data) {
        try {
          const mesh = await createForestObjectMesh(obj);
          if (mesh) {
            forestObjects.push(mesh);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to create mesh for ${obj.id}:`, error);
        }
      }
    } else {
      console.warn('⚠️ Failed to fetch forest objects, creating simple forest');
      const simpleForest = createSimpleForest();
      forestObjects.push(...simpleForest);
    }
  } catch (error) {
    console.error('❌ Failed to fetch forest objects:', error);
    const simpleForest = createSimpleForest();
    forestObjects.push(...simpleForest);
  }
  
  console.log(`🌲 Created forest with ${forestObjects.length} objects`);
  return forestObjects;
}

async function createForestObjectMesh(obj: ForestObject): Promise<THREE.Object3D | null> {
  try {
    // Map object types to model paths
    const modelPaths: { [key: string]: string } = {
      'Tree_01': '/assets/models/environment/Tree_01.glb',
      'Tree_02': '/assets/models/environment/Tree_02.glb',
      'Tree_03': '/assets/models/environment/Tree_03.glb',
      'Tree_04': '/assets/models/environment/Tree_04.glb',
      'Tree_05': '/assets/models/environment/Tree_05.glb',
      'Bush_01': '/assets/models/environment/Bush_01.glb',
      'Bush_02': '/assets/models/environment/Bush_02.glb',
      'Bush_03': '/assets/models/environment/Bush_03.glb',
      'Rock_01': '/assets/models/environment/Rock_01.glb',
      'Rock_02': '/assets/models/environment/Rock_02.glb',
      'Rock_03': '/assets/models/environment/Rock_03.glb'
    };

    const modelPath = modelPaths[obj.type];
    if (!modelPath) {
      console.warn(`⚠️ No model path for object type: ${obj.type}`);
      return null;
    }

    const gltf = await loadGLTF(modelPath);
    const mesh = gltf.scene.clone();

    // Position the object
    mesh.position.set(obj.x, obj.y, obj.z);
    
    // Apply terrain height if available
    try {
      const terrainHeight = getTerrainHeight(obj.x, obj.z);
      if (typeof terrainHeight === 'number' && !isNaN(terrainHeight)) {
        mesh.position.y = terrainHeight;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to get terrain height for ${obj.id}, using original Y:`, error);
    }

    // Apply scale and rotation
    if (obj.scale) {
      mesh.scale.setScalar(obj.scale);
    }
    if (obj.rotationY) {
      mesh.rotation.y = obj.rotationY;
    }

    // Enable shadows
    mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return mesh;
  } catch (error) {
    console.error(`❌ Failed to load ${obj.type} model:`, error);
    return null;
  }
}

function createSimpleForest(): THREE.Object3D[] {
  console.log('🌲 Creating simple procedural forest...');
  
  const objects: THREE.Object3D[] = [];
  
  // Create some simple trees and bushes procedurally
  for (let i = 0; i < 50; i++) {
    // Random positions within a 100x100 area
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    
    try {
      const terrainHeight = getTerrainHeight(x, z);
      const y = typeof terrainHeight === 'number' ? terrainHeight : 0;
      
      // Create simple tree geometry as fallback
      const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 3, 8);
      const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      
      const leavesGeometry = new THREE.SphereGeometry(2, 8, 6);
      const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.position.y = 2;
      
      const tree = new THREE.Group();
      tree.add(trunk);
      tree.add(leaves);
      tree.position.set(x, y, z);
      
      // Enable shadows
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      
      objects.push(tree);
    } catch (error) {
      console.warn(`⚠️ Failed to create simple tree at (${x}, ${z}):`, error);
    }
  }
  
  return objects;
}