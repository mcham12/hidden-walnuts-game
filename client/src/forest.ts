// AI NOTE: Modified for MVP-5 to fix tree/shrub visibility by enhancing debug logs for GLTF and test asset loading.
// Loads GLTF models and places them at positions fetched from /forest-objects, adjusted to terrain height.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { API_BASE, getTerrainHeight, DEBUG } from './main';

interface ForestObject {
  id: string;
  type: 'tree' | 'shrub';
  x: number;
  y: number;
  z: number;
  scale: number;
}

export async function createForest(): Promise<THREE.Object3D[]> {
  const loader = new GLTFLoader();
  const forestObjects: ForestObject[] = [];

  // Fetch forest object positions from backend
  try {
    const response = await fetch(`${API_BASE}/forest-objects`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}, Response: ${await response.text()}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid forest objects data: not an array');
    forestObjects.push(...data);
    console.log(`[Log] Fetched ${forestObjects.length} forest objects`);
  } catch (error) {
    console.error('Failed to fetch forest objects:', error);
    return [];
  }

  const meshes: THREE.Object3D[] = [];
  
  // Test asset serving with a simple text file
  if (DEBUG) {
    try {
      const testPath = '/assets/models/test.txt';
      const testUrl = `${window.location.origin}${testPath}`;
      console.log(`[Log] Testing asset serving: ${testUrl}`);
      const response = await fetch(testUrl);
      const responseText = await response.text();
      console.log(`[Log] Test asset fetch status: ${response.status}, Response: ${responseText}`);
    } catch (error) {
      console.error('Failed to fetch test asset:', error);
    }
  }

  // Load models
  let treeModel, shrubModel;
  const treePath = '/assets/models/Tree_01.glb';
  const shrubPath = '/assets/models/Bush_01.glb';
  const treeUrl = `${window.location.origin}${treePath}`;
  const shrubUrl = `${window.location.origin}${shrubPath}`;
  try {
    if (DEBUG) console.log(`[Log] Loading GLTF model: ${treeUrl} (path: ${treePath})`);
    treeModel = await loader.loadAsync(treePath);
    if (DEBUG) console.log(`[Log] Loaded ${treePath} successfully`);
  } catch (error) {
    console.error(`Failed to load ${treeUrl}:`, error);
    if (DEBUG) {
      try {
        const response = await fetch(treeUrl);
        const responseText = await response.text();
        console.log(`[Log] Tree GLTF fetch status: ${response.status}, Response: ${responseText.slice(0, 200)}`);
      } catch (fetchError) {
        console.error(`Failed to fetch ${treeUrl} for debugging:`, fetchError);
      }
    }
    return [];
  }
  try {
    if (DEBUG) console.log(`[Log] Loading GLTF model: ${shrubUrl} (path: ${shrubPath})`);
    shrubModel = await loader.loadAsync(shrubPath);
    if (DEBUG) console.log(`[Log] Loaded ${shrubPath} successfully`);
  } catch (error) {
    console.error(`Failed to load ${shrubUrl}:`, error);
    if (DEBUG) {
      try {
        const response = await fetch(shrubUrl);
        const responseText = await response.text();
        console.log(`[Log] Shrub GLTF fetch status: ${response.status}, Response: ${responseText.slice(0, 200)}`);
      } catch (fetchError) {
        console.error(`Failed to fetch ${shrubUrl} for debugging:`, fetchError);
      }
    }
    return [];
  }

  for (const obj of forestObjects) {
    if (typeof obj.x !== 'number' || typeof obj.z !== 'number' || isNaN(obj.x) || isNaN(obj.z)) {
      console.error(`[Log] Skipping invalid forest object ${obj.id}:`, obj);
      continue;
    }
    try {
      const model = obj.type === 'tree' ? treeModel.scene.clone() : shrubModel.scene.clone();
      let terrainHeight;
      try {
        terrainHeight = await getTerrainHeight(obj.x, obj.z);
        if (terrainHeight < 0 || terrainHeight > 5) {
          console.warn(`Invalid terrain height for ${obj.type} ${obj.id} at (${obj.x}, ${obj.z}): ${terrainHeight}, using 0`);
          terrainHeight = 0;
        }
      } catch (error) {
        console.error(`[Log] Failed to get terrain height for ${obj.type} ${obj.id}:`, error);
        terrainHeight = 0;
      }
      model.position.set(obj.x, terrainHeight, obj.z);
      model.scale.set(obj.scale, obj.scale, obj.scale);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.userData = { id: obj.id, type: obj.type };
      meshes.push(model);
      if (DEBUG) {
        console.log(`[Log] Created mesh for ${obj.type} ${obj.id} at (${obj.x}, ${terrainHeight}, ${obj.z})`);
      }
    } catch (error) {
      console.error(`[Log] Failed to create mesh for ${obj.id}:`, error);
    }
  }

  console.log(`[Log] Created ${meshes.length} forest meshes`);
  return meshes;
} 