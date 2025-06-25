// AI NOTE: This file handles squirrel avatar loading and rendering for MVP 6.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getTerrainHeight } from './main';
import type { SquirrelAvatar } from './types';

let avatar: SquirrelAvatar | null = null;
const moveState = { forward: false, backward: false, turnLeft: false, turnRight: false };
let lastDebugLog = 0;

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
    // Squirrel avatar added to scene
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
      case 'a': moveState.turnLeft = true; break;
      case 'd': moveState.turnRight = true; break;
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    switch (key) {
      case 'w': moveState.forward = false; break;
      case 's': moveState.backward = false; break;
      case 'a': moveState.turnLeft = false; break;
      case 'd': moveState.turnRight = false; break;
    }
  });

  return avatar;
}

export function updateSquirrelMovement(deltaTime: number) {
  if (!avatar) return;

  const moveSpeed = 5; // Units per second
  const turnSpeed = Math.PI; // Radians per second
  const mesh = avatar.mesh;
  
  // Debug: Log input state and position periodically
  const now = Date.now();
  if (!lastDebugLog || now - lastDebugLog > 2000) {
    console.log(`🎮 Input: W:${moveState.forward}, A:${moveState.turnLeft}, S:${moveState.backward}, D:${moveState.turnRight}`);
    console.log(`📍 Position: x:${mesh.position.x.toFixed(1)}, y:${mesh.position.y.toFixed(1)}, z:${mesh.position.z.toFixed(1)}`);
    lastDebugLog = now;
  }

  // Store previous position for movement detection
  const prevPosition = mesh.position.clone();

  // Handle rotation (A/D)
  if (moveState.turnLeft) {
    mesh.rotation.y += turnSpeed * deltaTime;
  }
  if (moveState.turnRight) {
    mesh.rotation.y -= turnSpeed * deltaTime;
  }

  // Handle movement (W/S)
  const direction = new THREE.Vector3();
  mesh.getWorldDirection(direction); // Get facing direction
  direction.y = 0;
  direction.normalize();

  if (moveState.forward) {
    mesh.position.addScaledVector(direction, moveSpeed * deltaTime); // Forward (W)
  }
  if (moveState.backward) {
    mesh.position.addScaledVector(direction, -moveSpeed * deltaTime); // Backward (S)
  }

  // Check if position actually changed
  const positionChanged = prevPosition.distanceTo(mesh.position) > 0.001;
  if (positionChanged && (moveState.forward || moveState.backward || moveState.turnLeft || moveState.turnRight)) {
    console.log(`✅ Movement applied! Delta: ${prevPosition.distanceTo(mesh.position).toFixed(3)}`);
  }

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

export function updateSquirrelCamera(camera: THREE.PerspectiveCamera) {
  if (!avatar) return;

  const mesh = avatar.mesh;
  const offsetDistance = 5; // Units behind
  const offsetHeight = 3; // Units above
  const direction = new THREE.Vector3();
  
  // Get squirrel's facing direction
  mesh.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();
  
  // Position camera behind and above
  const cameraPosition = mesh.position.clone()
    .addScaledVector(direction, -offsetDistance) // Behind
    .setY(mesh.position.y + offsetHeight); // Above
  
  camera.position.lerp(cameraPosition, 0.1); // Smooth transition
  camera.lookAt(mesh.position); // Look at squirrel
}

export function getSquirrelAvatar(): SquirrelAvatar | null {
  return avatar;
} 