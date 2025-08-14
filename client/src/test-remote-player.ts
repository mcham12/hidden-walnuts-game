// Simple test to create a red remote player capsule
import * as THREE from 'three';

export function createTestRemotePlayer(scene: THREE.Scene): THREE.Mesh {
  const geometry = new THREE.CapsuleGeometry(0.3, 1.2);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red
  const mesh = new THREE.Mesh(geometry, material);
  
  mesh.position.set(5, 1, 5); // Place it 5 units away from origin
  mesh.scale.set(0.3, 0.3, 0.3);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  scene.add(mesh);
  console.log('🔴 Test remote player added to scene at (5,1,5)');
  
  return mesh;
}