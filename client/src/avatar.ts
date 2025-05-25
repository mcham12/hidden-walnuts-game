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
  mesh.scale.set(0.5, 0.5, 0.5);
  const x = 50, z = 50;
  const terrainHeight = await getTerrainHeight(x, z);
  mesh.position.set(x, z, terrainHeight + 0.2); // Reduced offset
  mesh.rotation.y = Math.PI;
  
  scene.add(mesh);
  avatar = { mesh, gltf };
  
  console.log('[Log] Squirrel avatar loaded and added to scene:', mesh.position.toArray());
  return avatar;
}

export function getSquirrelAvatar(): SquirrelAvatar | null {
  return avatar;
} 