// AI NOTE: This file handles squirrel avatar loading and rendering for MVP 6.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './main';
import type { SquirrelAvatar } from './types';

let avatar: SquirrelAvatar | null = null;

// FIX: Proper key state tracking following best practices
const keys = {
  KeyW: false,
  KeyS: false,
  KeyA: false,
  KeyD: false
};

// FIX: Add event listeners only once when module loads
let eventListenersAdded = false;

function addKeyListeners() {
  if (eventListenersAdded) return;
  
  // FIX: Use keydown/keyup for immediate response (best practice)
  document.addEventListener('keydown', (event) => {
    if (event.code in keys) {
      keys[event.code as keyof typeof keys] = true;
      event.preventDefault(); // Prevent browser shortcuts
    }
  });

  document.addEventListener('keyup', (event) => {
    if (event.code in keys) {
      keys[event.code as keyof typeof keys] = false;
      event.preventDefault();
    }
  });
  
  eventListenersAdded = true;
  console.log('[Log] WASD controls initialized');
}

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
  
  // Initialize key listeners
  addKeyListeners();
  
  return avatar;
}

export function updateSquirrelMovement(deltaTime: number) {
  if (!avatar) return;

  // FIX: Improved movement parameters for better feel
  const moveSpeed = 10; // Units per second (increased for better responsiveness)
  const turnSpeed = Math.PI * 1.5; // Radians per second (faster turning)
  const mesh = avatar.mesh;

  // FIX: Handle rotation using A/D keys (tank-style controls - best practice for 3D)
  if (keys.KeyA) {
    mesh.rotation.y += turnSpeed * deltaTime;
  }
  if (keys.KeyD) {
    mesh.rotation.y -= turnSpeed * deltaTime;
  }

  // FIX: Handle forward/backward movement using W/S keys
  // Get the direction the squirrel is facing
  const direction = new THREE.Vector3(0, 0, 1);
  direction.applyQuaternion(mesh.quaternion);
  direction.y = 0; // Keep movement horizontal
  direction.normalize();

  // Apply movement based on keys pressed
  if (keys.KeyW) {
    mesh.position.addScaledVector(direction, moveSpeed * deltaTime);
  }
  if (keys.KeyS) {
    mesh.position.addScaledVector(direction, -moveSpeed * deltaTime);
  }

  // FIX: Clamp position to terrain bounds with buffer
  const terrainSize = 100;
  mesh.position.x = Math.max(-terrainSize + 5, Math.min(terrainSize - 5, mesh.position.x));
  mesh.position.z = Math.max(-terrainSize + 5, Math.min(terrainSize - 5, mesh.position.z));

  // FIX: Update y-position to stay grounded (async but non-blocking)
  getTerrainHeight(mesh.position.x, mesh.position.z).then((terrainHeight) => {
    if (terrainHeight >= 0 && terrainHeight <= 10) {
      mesh.position.y = terrainHeight + 0.1; // Slight offset to avoid z-fighting
    }
  }).catch(() => {
    // Fallback - don't change Y position if terrain height fails
  });
}

export function updateSquirrelCamera(camera: THREE.PerspectiveCamera) {
  if (!avatar) return;

  const mesh = avatar.mesh;
  const offsetDistance = 8; // Units behind (increased for better view)
  const offsetHeight = 4; // Units above
  
  // FIX: Get direction the squirrel is facing using quaternion (more reliable)
  const direction = new THREE.Vector3(0, 0, 1);
  direction.applyQuaternion(mesh.quaternion);
  direction.y = 0;
  direction.normalize();
  
  // Position camera behind and above the squirrel
  const cameraPosition = mesh.position.clone()
    .addScaledVector(direction, -offsetDistance) // Behind
    .setY(mesh.position.y + offsetHeight); // Above
  
  // FIX: Smooth camera movement with better interpolation
  camera.position.lerp(cameraPosition, 0.05); // Slower, smoother camera
  
  // FIX: Look ahead of the squirrel for better gameplay
  const lookTarget = mesh.position.clone().addScaledVector(direction, 2);
  camera.lookAt(lookTarget);
}

export function getSquirrelAvatar(): SquirrelAvatar | null {
  return avatar;
} 