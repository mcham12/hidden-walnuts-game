// AI NOTE: This file defines a function to create a terrain mesh with hills for MVP-5.
// The terrain replaces the flat plane in main.ts and uses a seed from the backend for consistency.
// The terrain is a 200x200 unit plane with heights up to 20 units, using a sin/cos-based noise function.

import * as THREE from 'three';
// import { API_BASE } from './main';
import { Logger, LogCategory } from './core/Logger';

// Global terrain data
let terrainSeed: number | null = null;

export async function initializeTerrain(apiBase: string): Promise<void> {
  try {
    const response = await fetch(`${apiBase}/terrain-seed`);
    if (response.ok) {
      const data = await response.json();
      terrainSeed = data.seed;
      Logger.debug(LogCategory.TERRAIN, `Fetched terrain seed: ${terrainSeed}`);
    }
  } catch (error) {
    Logger.error(LogCategory.TERRAIN, 'Failed to fetch terrain seed', error);
    // Use a default seed for offline mode
    terrainSeed = 12345;
  }
}

export function getTerrainHeight(x: number, z: number): number {
  if (terrainSeed === null) {
    return 0.5; // Return minimum ground level if not initialized
  }
  
  // Improved height calculation based on position and seed
  // This should match the server-side calculation but with better variation
  const noise1 = Math.sin((x + terrainSeed) * 0.1) * Math.cos((z + terrainSeed) * 0.1);
  const noise2 = Math.sin((x + terrainSeed) * 0.05) * Math.cos((z + terrainSeed) * 0.05) * 2;
  const noise3 = Math.sin((x + terrainSeed) * 0.02) * Math.cos((z + terrainSeed) * 0.02) * 1.5;
  
  // Ensure minimum height of 0.5 and maximum of 5 units
  const height = Math.max(0.5, Math.min(5, 1.5 + noise1 + noise2 + noise3));
  return height;
}

export function isTerrainInitialized(): boolean {
  return terrainSeed !== null;
}

export async function createTerrain(): Promise<THREE.Mesh> {
  const size = 200; // Matches TERRAIN_SIZE from constants.ts
  const segments = 200;

  // Create plane geometry
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);

  // Generate heightmap using improved noise function
  const vertices = geometry.attributes.position.array;
  let i = 0;
  for (let z = 0; z <= segments; z++) {
    for (let x = 0; x <= segments; x++) {
      const xNorm = (x / segments - 0.5) * size; // Convert to world coordinates
      const zNorm = (z / segments - 0.5) * size; // Convert to world coordinates
      
      // Use the same height calculation as getTerrainHeight
      const noise1 = Math.sin((xNorm + (terrainSeed || 0)) * 0.1) * Math.cos((zNorm + (terrainSeed || 0)) * 0.1);
      const noise2 = Math.sin((xNorm + (terrainSeed || 0)) * 0.05) * Math.cos((zNorm + (terrainSeed || 0)) * 0.05) * 2;
      const noise3 = Math.sin((xNorm + (terrainSeed || 0)) * 0.02) * Math.cos((zNorm + (terrainSeed || 0)) * 0.02) * 1.5;
      
      const terrainHeight = Math.max(0.5, Math.min(5, 1.5 + noise1 + noise2 + noise3));
      vertices[i + 2] = terrainHeight; // Set Y coordinate
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

  // Terrain setup complete
  return terrain;
} 