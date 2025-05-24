// AI NOTE: Modified for MVP-5 to fix tree/shrub visibility by adding debug logs and handling invalid /forest-objects responses.
// Loads GLTF models and places them at positions fetched from /forest-objects, adjusted to terrain height.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { API_BASE, getTerrainHeight } from './main';

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
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid forest objects data: not an array');
    forestObjects.push(...data);
    console.log(`Fetched ${forestObjects.length} forest objects`, forestObjects);
  } catch (error) {
    console.error('Failed to fetch forest objects:', error);
    return [];
  }

  const meshes: THREE.Object3D[] = [];
  
  // Load models
  let treeModel, shrubModel;
  try {
    treeModel = await loader.loadAsync('/assets/models/Tree_01.glb');
    console.log('Loaded Tree_01.glb');
    shrubModel = await loader.loadAsync('/assets/models/Bush_01.glb');
    console.log('Loaded Bush_01.glb');
  } catch (error) {
    console.error('Failed to load GLTF models:', error);
    return [];
  }

  for (const obj of forestObjects) {
    try {
      const model = obj.type === 'tree' ? treeModel.scene.clone() : shrubModel.scene.clone();
      const terrainHeight = getTerrainHeight(obj.x, obj.z);
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
      console.log(`Created mesh for ${obj.type} ${obj.id} at (${obj.x}, ${terrainHeight}, ${obj.z})`);
    } catch (error) {
      console.error(`Failed to create mesh for ${obj.id}:`, error);
    }
  }

  console.log(`Created ${meshes.length} forest meshes`);
  return meshes;
} 