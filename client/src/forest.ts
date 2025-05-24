// AI NOTE: This file defines a function to create a forest with trees and shrubs for MVP-5.
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
    forestObjects.push(...(await response.json()));
    console.log(`Fetched ${forestObjects.length} forest objects`);
  } catch (error) {
    console.error('Failed to fetch forest objects:', error);
    return [];
  }

  const meshes: THREE.Object3D[] = [];
  
  // Load models
  const treeModel = await loader.loadAsync('/assets/models/Tree_01.glb');
  const shrubModel = await loader.loadAsync('/assets/models/Bush_01.glb');

  for (const obj of forestObjects) {
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
  }

  console.log(`Created ${meshes.length} forest meshes`);
  return meshes;
} 