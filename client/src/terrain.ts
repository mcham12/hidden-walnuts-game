// AI NOTE: This file defines a function to create a terrain mesh with hills for MVP-5.
// The terrain replaces the flat plane in main.ts and uses a seed from the backend for consistency.
// The terrain is a 200x200 unit plane with heights up to 20 units, using a sin/cos-based noise function.

import * as THREE from 'three';
import { API_BASE } from './main';

// Industry Standard: Terrain collision system  
let terrainSeed: number | null = null;

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
    terrainSeed = seed; // Cache for collision detection
    console.log(`Fetched terrain seed: ${seed}`);
  } catch (error) {
    console.error('Failed to fetch terrain seed:', error);
    seed = Math.random() * 1000; // Fallback seed
    terrainSeed = seed;
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

  console.log('[Terrain] ✅ Terrain setup complete: 200x200, height 0–5 units');
  return terrain;
}

// Industry Standard: High-performance terrain height calculation
export function getTerrainHeightSync(x: number, z: number): number {
  // Industry Standard: Input validation
  if (typeof x !== 'number' || typeof z !== 'number' || !isFinite(x) || !isFinite(z)) {
    console.warn(`[Terrain] Invalid coordinates: (${x}, ${z}), using fallback`);
    return 2.0;
  }

  if (!terrainSeed) {
    console.warn('[Terrain] ⚠️ Terrain seed not available, using fallback height');
    return 2.0; // Fallback height
  }

  const size = 200;
  const height = 5;
  
  try {
    // Same calculation as in createTerrain
    const xNorm = (x + size / 2) / size;
    const zNorm = (z + size / 2) / size;
    const noiseValue = Math.sin(xNorm * 10 + terrainSeed) * Math.cos(zNorm * 10 + terrainSeed);
    const terrainHeight = (noiseValue + 1) * (height / 2);
    
    // Industry Standard: Validate output
    const clampedHeight = Math.max(0, Math.min(height, terrainHeight));
    
    if (!isFinite(clampedHeight)) {
      console.warn(`[Terrain] Invalid height calculation for (${x}, ${z}), using fallback`);
      return 2.0;
    }
    
    return clampedHeight;
  } catch (error) {
    console.error(`[Terrain] Height calculation error for (${x}, ${z}):`, error);
    return 2.0;
  }
}

// Industry Standard: Initialize terrain system
export function initializeTerrainSeed(seed: number): void {
  terrainSeed = seed;
  console.log(`[Terrain] ✅ Terrain seed initialized: ${seed}`);
}

// Industry Standard: Get cached terrain seed
export function getTerrainSeed(): number | null {
  return terrainSeed;
} 