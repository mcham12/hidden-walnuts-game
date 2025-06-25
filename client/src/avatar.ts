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
  mesh.rotation.y = 0; // Face forward (positive Z direction)
  
  try {
    scene.add(mesh);
    // Squirrel avatar added to scene
  } catch (error) {
    console.error('[Log] Failed to add squirrel avatar to scene:', error);
    throw error;
  }
  
  avatar = { mesh, gltf };
  
  // Add WASD event listeners with debugging
  console.log('🎮 [Avatar] Setting up WASD event listeners...');
  
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    console.log('⌨️ [Input] Keydown:', key);
    switch (key) {
      case 'w': 
        moveState.forward = true; 
        console.log('🏃 [Input] Moving forward');
        break;
      case 's': 
        moveState.backward = true; 
        console.log('🔙 [Input] Moving backward');
        break;
      case 'a': 
        moveState.turnLeft = true; 
        console.log('↩️ [Input] Turning left');
        break;
      case 'd': 
        moveState.turnRight = true; 
        console.log('↪️ [Input] Turning right');
        break;
    }
  });

  document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    console.log('⌨️ [Input] Keyup:', key);
    switch (key) {
      case 'w': moveState.forward = false; break;
      case 's': moveState.backward = false; break;
      case 'a': moveState.turnLeft = false; break;
      case 'd': moveState.turnRight = false; break;
    }
  });

  // Test if focus is on the page
  console.log('🎯 [Input] Document focus test - activeElement:', document.activeElement?.tagName);

  return avatar;
}

export function updateSquirrelMovement(deltaTime: number, moveStateOverride?: any) {
  if (!avatar) return;

  const moveSpeed = 5;
  const turnSpeed = Math.PI;
  const mesh = avatar.mesh;
  
  // Use override state if provided, otherwise use internal state
  const currentMoveState = moveStateOverride || moveState;
  
  // Debug logging
  const now = Date.now();
  if (!lastDebugLog || now - lastDebugLog > 2000) {
    console.log(`🎮 Input: W:${currentMoveState.forward}, A:${currentMoveState.turnLeft}, S:${currentMoveState.backward}, D:${currentMoveState.turnRight}`);
    console.log(`📍 Position: x:${mesh.position.x.toFixed(1)}, y:${mesh.position.y.toFixed(1)}, z:${mesh.position.z.toFixed(1)}`);
    lastDebugLog = now;
  }

  // Standard game movement pattern: rotation first
  if (currentMoveState.turnLeft) {
    mesh.rotation.y += turnSpeed * deltaTime;
  }
  if (currentMoveState.turnRight) {
    mesh.rotation.y -= turnSpeed * deltaTime;
  }

  // Standard game movement pattern: XZ movement only (never touch Y during movement)
  if (currentMoveState.forward || currentMoveState.backward) {
    const moveDistance = moveSpeed * deltaTime;
    const direction = {
      x: Math.sin(mesh.rotation.y),
      z: Math.cos(mesh.rotation.y)
    };

    if (currentMoveState.forward) {
      mesh.position.x += direction.x * moveDistance;
      mesh.position.z += direction.z * moveDistance;
    }
    if (currentMoveState.backward) {
      mesh.position.x -= direction.x * moveDistance;
      mesh.position.z -= direction.z * moveDistance;
    }
  }

  // Clamp to bounds
  mesh.position.x = Math.max(-100, Math.min(100, mesh.position.x));
  mesh.position.z = Math.max(-100, Math.min(100, mesh.position.z));

  // Safety check for NaN (if this happens, something else is corrupting position)
  if (isNaN(mesh.position.x) || isNaN(mesh.position.y) || isNaN(mesh.position.z)) {
    console.error('🚨 [Avatar] Position became NaN! Resetting to safe position');
    mesh.position.set(50, 2, 50);
  }
}

export function updateSquirrelCamera(camera: THREE.PerspectiveCamera) {
  if (!avatar) return;

  const mesh = avatar.mesh;
  const offsetDistance = 5; // Units behind
  const offsetHeight = 3; // Units above
  
  // Calculate direction from rotation (more reliable than getWorldDirection)
  const direction = new THREE.Vector3(
    Math.sin(mesh.rotation.y),
    0,
    Math.cos(mesh.rotation.y)
  );
  
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