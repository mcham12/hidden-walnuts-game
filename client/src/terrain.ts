// AI NOTE: This file defines a function to create a terrain mesh with hills for MVP-5.
// The terrain replaces the flat plane in main.ts and uses a seed from the backend for consistency.
// The terrain is a 200x200 unit plane with heights up to 20 units, using a sin/cos-based noise function.

import * as THREE from 'three';
import { API_BASE } from './main';

export async function createTerrain(): Promise<THREE.Mesh> {
  const size = 200; // Matches TERRAIN_SIZE from constants.ts
  const height = 5; // Reduced from 20 to 5 for flatter terrain
  const segments = 200;

  // Fetch terrain seed from backend
  let seed: number;
  try {
    const response = await fetch(`${API_BASE}/terrain-seed`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    seed = data.seed;
    console.log(`Fetched terrain seed: ${seed}`);
  } catch (error) {
    console.error('Failed to fetch terrain seed:', error);
    seed = Math.random() * 1000; // Fallback seed
  }

  // Create plane geometry
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  // Generate heightmap using sin/cos-based noise
  const vertices = geometry.attributes.position.array;
  let i = 0;
  for (let z = 0; z <= segments; z++) {
    for (let x = 0; x <= segments; x++) {
      const xNorm = x / segments;
      const zNorm = z / segments;
      const noiseValue = Math.sin(xNorm * 10 + seed) * Math.cos(zNorm * 10 + seed);
      vertices[i + 2] = (noiseValue + 1) * (height / 2); // Scale to 0–5 units
      i += 3;
    }
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();

  // Create grass material (similar to current floor)
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a8335, // Green
    roughness: 0.8,
    metalness: 0.2
  });

  // Create mesh
  const terrain = new THREE.Mesh(geometry, material);
  terrain.rotation.x = -Math.PI / 2; // Lay flat
  terrain.receiveShadow = true;

  console.log('[Log] Terrain setup complete: 200x200, height 0–5 units');
  return terrain;
} 