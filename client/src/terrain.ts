import * as THREE from 'three';

// Perlin noise function from Three.js terrain example
function noise(nx: number, ny: number) {
  return Math.sin(2 * nx) * Math.cos(2 * ny) * 5 + Math.sin(nx * ny) * 3;
}

export async function initializeTerrain(): Promise<void> {
  console.log('🌍 Terrain initialized');
}

export function getTerrainHeight(x: number, z: number): number {
  const nx = x * 0.02; // Reduced frequency for smoother terrain
  const nz = z * 0.02;
  let height = noise(nx, nz) * 0.5 + 2; // Reduced amplitude and base height
  height += noise(nx * 2, nz * 2) * 0.3;
  height += noise(nx * 4, nz * 4) * 0.1;
  return Math.max(0.5, height); // Ensure minimum height of 0.5 for character positioning
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
      const yPos = getTerrainHeight(xPos, zPos);
      
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