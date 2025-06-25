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

export function updateSquirrelMovement(deltaTime: number) {
  if (!avatar) return;

  const moveSpeed = 5; // Units per second
  const turnSpeed = Math.PI; // Radians per second
  const mesh = avatar.mesh;
  
  // Store position before any processing to detect external changes
  const prevPos = {
    x: mesh.position.x,
    y: mesh.position.y, 
    z: mesh.position.z
  };
  
  // Debug: Log input state and position periodically
  const now = Date.now();
  if (!lastDebugLog || now - lastDebugLog > 2000) {
    console.log(`🎮 Input: W:${moveState.forward}, A:${moveState.turnLeft}, S:${moveState.backward}, D:${moveState.turnRight}`);
    console.log(`📍 Position: x:${mesh.position.x.toFixed(1)}, y:${mesh.position.y.toFixed(1)}, z:${mesh.position.z.toFixed(1)}`);
    lastDebugLog = now;
  }
  
  // Check if position was externally corrupted since last frame
  if (isNaN(mesh.position.x) || isNaN(mesh.position.y) || isNaN(mesh.position.z)) {
    console.error('🚨 [Avatar] Position corrupted externally! Previous:', prevPos);
    console.error('🚨 [Avatar] Current position:', mesh.position.x, mesh.position.y, mesh.position.z);
    mesh.position.set(50, 2, 50);
    return;
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

  // Handle movement (W/S) - use rotation-based direction (more reliable than getWorldDirection)
  if (moveState.forward || moveState.backward) {
    // Calculate direction from rotation (avoids Three.js matrix corruption issues)
    const direction = new THREE.Vector3(
      Math.sin(mesh.rotation.y),
      0,
      Math.cos(mesh.rotation.y)
    );
    
    // Ensure direction is normalized (should be by construction, but safety first)
    direction.normalize();
    
    const moveDistance = moveSpeed * deltaTime;

    if (moveState.forward) {
      mesh.position.addScaledVector(direction, moveDistance); // Forward (W)
    }
    if (moveState.backward) {
      mesh.position.addScaledVector(direction, -moveDistance); // Backward (S)
    }
  }

  // Check if position actually changed
  const positionChanged = prevPosition.distanceTo(mesh.position) > 0.001;
  if (positionChanged && (moveState.forward || moveState.backward || moveState.turnLeft || moveState.turnRight)) {
    console.log(`✅ Movement applied! Delta: ${prevPosition.distanceTo(mesh.position).toFixed(3)}`);
  }

  // Clamp position to terrain bounds
  mesh.position.x = Math.max(-100, Math.min(100, mesh.position.x));
  mesh.position.z = Math.max(-100, Math.min(100, mesh.position.z));

  // Protect against NaN positions (causes blue screen crash)
  if (isNaN(mesh.position.x) || isNaN(mesh.position.y) || isNaN(mesh.position.z)) {
    console.error('🚨 [Avatar] Position became NaN! Resetting to safe position');
    mesh.position.set(50, 2, 50);
    return;
  }

  // Update y-position to stay grounded (with NaN protection)
  if (!isNaN(mesh.position.x) && !isNaN(mesh.position.z)) {
    getTerrainHeight(mesh.position.x, mesh.position.z).then((terrainHeight) => {
      if (isNaN(terrainHeight) || terrainHeight < 0 || terrainHeight > 10) {
        console.warn('⚠️ [Avatar] Invalid terrain height:', terrainHeight, 'using fallback');
        terrainHeight = 2;
      }
      mesh.position.y = terrainHeight;
    }).catch((error) => {
      console.error('[Log] Failed to update squirrel height:', error);
      mesh.position.y = 2; // Fallback
    });
  } else {
    console.error('🚨 [Avatar] Cannot update terrain height - position x/z is NaN');
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