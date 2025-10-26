import * as THREE from 'three';

// Perlin noise function from Three.js terrain example
function noise(nx: number, ny: number) {
  return Math.sin(2 * nx) * Math.cos(2 * ny) * 5 + Math.sin(nx * ny) * 3;
}

// Store terrain mesh reference for raycasting (legacy, used for initialization)
let terrainMesh: THREE.Mesh | null = null;
const raycaster = new THREE.Raycaster();

// ========================================
// INDUSTRY-STANDARD HEIGHTFIELD CACHE
// ========================================
// Pre-computed terrain heights for fast collision detection
// Uses bilinear interpolation for sub-grid accuracy
interface HeightfieldCache {
  data: Float32Array;      // Flattened 2D array of heights
  resolution: number;      // Grid spacing (units per cell)
  width: number;           // Number of cells in X direction
  height: number;          // Number of cells in Z direction
  minX: number;            // World-space bounds
  maxX: number;
  minZ: number;
  maxZ: number;
  invResolution: number;   // Cached 1/resolution for fast lookup
}

let heightfieldCache: HeightfieldCache | null = null;

export function setTerrainMesh(mesh: THREE.Mesh): void {
  terrainMesh = mesh;
}

/**
 * Build heightfield cache for fast terrain collision
 * Industry-standard approach: pre-compute heights at fine resolution
 *
 * @param resolution - Grid spacing in world units (smaller = more accurate, more memory)
 */
function buildHeightfieldCache(resolution: number = 0.5): void {
  const worldSize = 400; // Match terrain size
  const halfSize = worldSize / 2;

  // Calculate grid dimensions
  const width = Math.ceil(worldSize / resolution) + 1;
  const height = Math.ceil(worldSize / resolution) + 1;

  console.log(`🗺️ Building heightfield cache: ${width}x${height} cells (resolution=${resolution} units)`);

  // Allocate cache
  const data = new Float32Array(width * height);

  // Pre-compute heights using mathematical function (ground truth)
  let minHeight = Infinity;
  let maxHeight = -Infinity;

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      // Convert grid coordinates to world coordinates
      const worldX = -halfSize + x * resolution;
      const worldZ = -halfSize + z * resolution;

      // Sample height from mathematical function (NOT from mesh)
      const h = getTerrainHeightMath(worldX, worldZ);

      // Store in flattened array
      const index = z * width + x;
      data[index] = h;

      // Track min/max for debugging
      minHeight = Math.min(minHeight, h);
      maxHeight = Math.max(maxHeight, h);
    }
  }

  // Create cache object
  heightfieldCache = {
    data,
    resolution,
    width,
    height,
    minX: -halfSize,
    maxX: halfSize,
    minZ: -halfSize,
    maxZ: halfSize,
    invResolution: 1.0 / resolution  // Cache for fast division
  };

  console.log(`✅ Heightfield cache built: ${(data.length * 4 / 1024).toFixed(2)}KB, heights [${minHeight.toFixed(2)}, ${maxHeight.toFixed(2)}]`);
}

export async function initializeTerrain(): Promise<void> {
  // Build heightfield cache with 0.5 unit resolution
  // (8x more accurate than mesh vertices which are 4 units apart)
  buildHeightfieldCache(0.5);
  console.log('🌍 Terrain initialized with heightfield cache');
}

// Mathematical height function (used for initial mesh generation)
function getTerrainHeightMath(x: number, z: number): number {
  const nx = x * 0.02; // Reduced frequency for smoother terrain
  const nz = z * 0.02;
  let height = noise(nx, nz) * 0.5 + 2; // Reduced amplitude and base height
  height += noise(nx * 2, nz * 2) * 0.3;
  height += noise(nx * 4, nz * 4) * 0.1;
  return Math.max(0.5, height); // Ensure minimum height of 0.5 for character positioning
}

// DEBUG: Enable comparison logging (set to true to compare cache vs raycast)
const DEBUG_COMPARE_METHODS = false;

/**
 * Get terrain height at world position using heightfield cache
 * INDUSTRY STANDARD: Bilinear interpolation for sub-grid accuracy
 *
 * This is 100-1000x faster than raycasting and more accurate than
 * raycasting against low-resolution mesh.
 *
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Terrain height at (x, z)
 */
export function getTerrainHeight(x: number, z: number): number {
  // Fallback if cache not initialized
  if (!heightfieldCache) {
    return getTerrainHeightMath(x, z);
  }

  const cache = heightfieldCache;

  // Clamp to terrain bounds
  const clampedX = Math.max(cache.minX, Math.min(cache.maxX, x));
  const clampedZ = Math.max(cache.minZ, Math.min(cache.maxZ, z));

  // Convert world coords to grid coords (floating point)
  const gridX = (clampedX - cache.minX) * cache.invResolution;
  const gridZ = (clampedZ - cache.minZ) * cache.invResolution;

  // Get integer grid cell (bottom-left corner)
  const x0 = Math.floor(gridX);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(x0 + 1, cache.width - 1);
  const z1 = Math.min(z0 + 1, cache.height - 1);

  // Get fractional position within cell [0, 1]
  const fx = gridX - x0;
  const fz = gridZ - z0;

  // Sample four corner heights
  const h00 = cache.data[z0 * cache.width + x0];  // Bottom-left
  const h10 = cache.data[z0 * cache.width + x1];  // Bottom-right
  const h01 = cache.data[z1 * cache.width + x0];  // Top-left
  const h11 = cache.data[z1 * cache.width + x1];  // Top-right

  // Bilinear interpolation (industry-standard terrain sampling)
  // Interpolate along X axis for both Z rows
  const h0 = h00 * (1 - fx) + h10 * fx;  // Bottom edge
  const h1 = h01 * (1 - fx) + h11 * fx;  // Top edge

  // Interpolate along Z axis
  const height = h0 * (1 - fz) + h1 * fz;

  // DEBUG: Compare heightfield cache vs legacy raycast
  if (DEBUG_COMPARE_METHODS && Math.random() < 0.01) { // Sample 1% of calls
    const raycastHeight = getTerrainHeightLegacyRaycast(x, z);
    const mathHeight = getTerrainHeightMath(x, z);
    const diff = Math.abs(height - raycastHeight);
    if (diff > 0.01) {
      console.log(`🔍 Terrain height comparison at (${x.toFixed(1)}, ${z.toFixed(1)}):
        Cache (bilinear):  ${height.toFixed(3)}
        Raycast (mesh):    ${raycastHeight.toFixed(3)}
        Math (ground truth): ${mathHeight.toFixed(3)}
        Cache-Raycast diff: ${diff.toFixed(3)} units`);
    }
  }

  return height;
}

/**
 * LEGACY: Get terrain height by raycasting against mesh
 * DEPRECATED: Only kept for debugging/comparison
 * DO NOT USE IN PRODUCTION - Use getTerrainHeight() instead
 */
export function getTerrainHeightLegacyRaycast(x: number, z: number): number {
  if (!terrainMesh) {
    return getTerrainHeightMath(x, z);
  }

  const rayOrigin = new THREE.Vector3(x, 1000, z);
  const rayDirection = new THREE.Vector3(0, -1, 0);
  raycaster.set(rayOrigin, rayDirection);

  const intersects = raycaster.intersectObject(terrainMesh);

  if (intersects.length > 0) {
    return intersects[0].point.y;
  }

  return getTerrainHeightMath(x, z);
}

export async function createTerrain(): Promise<THREE.Mesh> {
  await initializeTerrain();
  
  // Create terrain using manual geometry approach
  const size = 400;
  const segments = 100;
  const geometry = new THREE.BufferGeometry();
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Generate vertices with height
  const colors: number[] = [];
  for (let z = 0; z <= segments; z++) {
    for (let x = 0; x <= segments; x++) {
      const xPos = (x / segments - 0.5) * size;
      const zPos = (z / segments - 0.5) * size;
      const yPos = getTerrainHeightMath(xPos, zPos);
      
      vertices.push(xPos, yPos, zPos);
      
      // Height-based color gradient: darker green for valleys, lighter for peaks
      const heightRatio = Math.max(0, Math.min(1, (yPos - 1) / 3)); // Normalize height between 1-4
      const color = new THREE.Color();
      color.setHSL(0.3, 0.6, 0.2 + heightRatio * 0.4); // Green with brightness based on height
      colors.push(color.r, color.g, color.b);
    }
  }
  
  console.log('Terrain bounds - X:', -size/2, 'to', size/2);
  console.log('Terrain bounds - Z:', -size/2, 'to', size/2);
  console.log('Sample heights:', vertices.slice(0, 9));
  
  // Generate indices for triangles
  for (let z = 0; z < segments; z++) {
    for (let x = 0; x < segments; x++) {
      const a = z * (segments + 1) + x;
      const b = a + 1;
      const c = (z + 1) * (segments + 1) + x;
      const d = c + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial({ 
    vertexColors: true,
    side: THREE.DoubleSide,
    wireframe: false
  });
  
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  
  console.log('Terrain created with manual geometry:', terrain);
  console.log('Vertices count:', vertices.length / 3);
  console.log('Indices count:', indices.length);
  
  return terrain;
}