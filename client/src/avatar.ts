// AI NOTE: This file handles squirrel avatar loading and rendering for MVP 6.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './main';
import type { SquirrelAvatar } from './types';

let avatar: SquirrelAvatar | null = null;

export async function loadSquirrelAvatar(scene: THREE.Scene): Promise<SquirrelAvatar> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/assets/models/squirrel.glb');
  
  const mesh = gltf.scene;
  mesh.scale.set(0.5, 0.5, 0.5); // Adjust scale for visibility
  mesh.position.set(0, 0, getTerrainHeight(0, 0)); // Ground on terrain
  mesh.rotation.y = Math.PI; // Face forward
  
  scene.add(mesh);
  avatar = { mesh, gltf };
  
  console.log('[Log] Squirrel avatar loaded and added to scene:', mesh.position);
  return avatar;
}

export function getSquirrelAvatar(): SquirrelAvatar | null {
  return avatar;
} 