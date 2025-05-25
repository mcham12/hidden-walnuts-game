// AI NOTE: This file handles squirrel avatar loading and rendering for MVP 6.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './main';
import type { SquirrelAvatar } from './types';

let avatar: SquirrelAvatar | null = null;
const moveState = { forward: false, backward: false, left: false, right: false };

export async function loadSquirrelAvatar(scene: THREE.Scene): Promise<SquirrelAvatar> {
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync('/assets/models/squirrel.glb');
  } catch (error) {
    console.error('[Log] Failed to load squirrel.glb:', error);
    throw error;
  }
  
  const mesh = gltf.scene;
  mesh.scale.set(0.5, 0.5, 0.5);
  const x = 50, z = 50;
  let terrainHeight;
  try {
    terrainHeight = await getTerrainHeight(x, z);
    if (terrainHeight < 0 || terrainHeight > 5) {
      console.warn(`[Log] Invalid terrain height for avatar at (${x}, ${z}): ${terrainHeight}, using 2`);
      terrainHeight = 2;
    }
  } catch (error) {
    console.error('[Log] Failed to get terrain height for avatar:', error);
    terrainHeight = 2;
  }
  mesh.position.set(x, terrainHeight, z);
  mesh.rotation.y = Math.PI;
  
  try {
    scene.add(mesh);
    console.log('[Log] Squirrel avatar added to scene at:', mesh.position.toArray());
  } catch (error) {
    console.error('[Log] Failed to add squirrel avatar to scene:', error);
    throw error;
  }
  
  avatar = { mesh, gltf };
  
  // Add WASD event listeners
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    switch (key) {
      case 'w': moveState.forward = true; break;
      case 's': moveState.backward = true; break;
      case 'a': moveState.left = true; break;
      case 'd': moveState.right = true; break;
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    switch (key) {
      case 'w': moveState.forward = false; break;
      case 's': moveState.backward = false; break;
      case 'a': moveState.left = false; break;
      case 'd': moveState.right = false; break;
    }
  });

  return avatar;
}

export function updateSquirrelMovement(deltaTime: number) {
  if (!avatar) return;

  const speed = 5; // Units per second
  const mesh = avatar.mesh;
  const direction = new THREE.Vector3();

  if (moveState.forward) direction.z -= 1;
  if (moveState.backward) direction.z += 1;
  if (moveState.left) direction.x -= 1;
  if (moveState.right) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize().multiplyScalar(speed * deltaTime);
    mesh.position.add(direction);
    
    // Clamp position to terrain bounds
    mesh.position.x = Math.max(-100, Math.min(100, mesh.position.x));
    mesh.position.z = Math.max(-100, Math.min(100, mesh.position.z));
    
    // Update y-position to stay grounded
    getTerrainHeight(mesh.position.x, mesh.position.z).then((terrainHeight) => {
      mesh.position.y = terrainHeight;
    }).catch((error) => {
      console.error('[Log] Failed to update squirrel height:', error);
      mesh.position.y = 2; // Fallback
    });
  }
}

export function getSquirrelAvatar(): SquirrelAvatar | null {
  return avatar;
} 