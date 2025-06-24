import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getTerrainHeight } from './main'

const DEBUG = (import.meta.env?.MODE || 'development') !== 'production'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface ForestObject {
  id: string;
  type: 'tree' | 'shrub' | 'bush';
  x?: number;
  y?: number;
  z?: number;
  scale: number;
  position?: { x: number; y: number; z: number };
}

let treeModel: THREE.Object3D | null = null;
let shrubModel: THREE.Object3D | null = null;
let modelsLoaded = false;
let fallbackModels = false;

// Load models with proper error handling and consistent structure
async function loadModels() {
  if (modelsLoaded) return;
  
  const loader = new GLTFLoader();
  
  // Load tree model with fallback
  const treePath = '/assets/models/Tree_01.glb';
  try {
    if (DEBUG) console.log(`[Log] Loading GLTF model: ${treePath}`);
    const gltf = await loader.loadAsync(treePath);
    treeModel = gltf.scene;
    // Clean up unwanted meshes
    treeModel.traverse((child: THREE.Object3D) => {
      if (child.name.toLowerCase().includes('box') || child.name.toLowerCase().includes('bounding')) {
        child.visible = false; // Hide bounding boxes
      }
    });
    if (DEBUG) console.log(`[Log] Loaded and cleaned ${treePath}`);
  } catch (error) {
    console.error(`[Error] Failed to load ${treePath}:`, error);
    // Create fallback model
    treeModel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0x228B22 })
    );
    fallbackModels = true;
    console.log('[Log] Using fallback cylinder geometry for trees');
  }

  // Load shrub model with fallback
  const shrubPath = '/assets/models/Bush_01.glb';
  try {
    if (DEBUG) console.log(`[Log] Loading GLTF model: ${shrubPath}`);
    const gltf = await loader.loadAsync(shrubPath);
    shrubModel = gltf.scene;
    // Clean up unwanted meshes
    shrubModel.traverse((child: THREE.Object3D) => {
      if (child.name.toLowerCase().includes('box') || child.name.toLowerCase().includes('bounding')) {
        child.visible = false; // Hide bounding boxes
      }
    });
    if (DEBUG) console.log(`[Log] Loaded and cleaned ${shrubPath}`);
  } catch (error) {
    console.error(`[Error] Failed to load ${shrubPath}:`, error);
    // Create fallback model
    shrubModel = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x006400 })
    );
    fallbackModels = true;
    console.log('[Log] Using fallback sphere geometry for shrubs');
  }
  
  modelsLoaded = true;
  if (fallbackModels) {
    console.warn('[Warning] Using fallback models - check that .glb files exist in /assets/models/');
  }
}

export async function createForest(): Promise<THREE.Object3D[]> {
  // Load models first
  await loadModels();
  
  const forestObjects: ForestObject[] = [];

  // Fetch forest object positions from backend
  try {
    const response = await fetch(`${API_BASE}/forest-objects`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}, Response: ${await response.text()}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid forest objects data: not an array');
    forestObjects.push(...data);
    console.log(`[Log] Fetched ${forestObjects.length} forest objects from API`);
  } catch (error) {
    console.error('[Error] Failed to fetch forest objects from API:', error);
    // Create some test objects for debugging
    const testObjects = [
      { id: 'test-tree-1', type: 'tree' as const, x: 10, y: 0, z: 10, scale: 1 },
      { id: 'test-tree-2', type: 'tree' as const, x: -10, y: 0, z: 10, scale: 1 },
      { id: 'test-tree-3', type: 'tree' as const, x: 10, y: 0, z: -10, scale: 1 },
      { id: 'test-shrub-1', type: 'shrub' as const, x: 5, y: 0, z: -5, scale: 1 },
      { id: 'test-shrub-2', type: 'shrub' as const, x: -5, y: 0, z: -5, scale: 1 },
      { id: 'test-shrub-3', type: 'shrub' as const, x: 0, y: 0, z: 8, scale: 1 }
    ];
    forestObjects.push(...testObjects);
    console.log(`[Log] Using ${testObjects.length} test forest objects`);
  }

  const meshes: THREE.Object3D[] = [];
  
  for (const obj of forestObjects) {
    // Handle both direct x/z and nested position properties
    const x = obj.x !== undefined ? obj.x : obj.position?.x;
    const z = obj.z !== undefined ? obj.z : obj.position?.z;
    
    if (typeof x !== 'number' || typeof z !== 'number' || isNaN(x) || isNaN(z)) {
      console.error(`[Error] Skipping invalid forest object ${obj.id}:`, obj);
      continue;
    }
    
    try {
      // FIX: Proper cloning without assuming .scene property
      const sourceModel = obj.type === 'tree' ? treeModel : shrubModel;
      if (!sourceModel) {
        console.error(`[Error] No ${obj.type} model loaded for ${obj.id}`);
        continue;
      }
      
      const model = sourceModel.clone();
      let terrainHeight = 0;
      
      // Try to get terrain height, but don't fail if it's not available
      try {
        terrainHeight = await getTerrainHeight(x, z);
        if (terrainHeight < 0 || terrainHeight > 5) {
          console.warn(`[Warning] Invalid terrain height for ${obj.type} ${obj.id} at (${x}, ${z}): ${terrainHeight}, using 0`);
          terrainHeight = 0;
        }
      } catch (error) {
        if (DEBUG) console.warn(`[Warning] Failed to get terrain height for ${obj.type} ${obj.id}:`, error);
        terrainHeight = 0;
      }
      
      model.position.set(x, terrainHeight, z);
      model.scale.set(obj.scale || 1, obj.scale || 1, obj.scale || 1);
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      model.userData = { id: obj.id, type: obj.type };
      meshes.push(model);
      // console.log(`[Log] Created ${obj.type} ${obj.id} at (${x}, ${terrainHeight}, ${z}) ${fallbackModels ? '(fallback)' : '(GLTF)'}`);
    } catch (error) {
      console.error(`[Error] Failed to create mesh for ${obj.id}:`, error);
    }
  }

  console.log(`[Log] Created ${meshes.length} forest meshes (${fallbackModels ? 'using fallback models' : 'using GLTF models'})`);
  return meshes;
}

// Create individual forest mesh
export function createForestMesh(obj: ForestObject, scene: THREE.Scene): THREE.Object3D | null {
  if (!modelsLoaded) {
    console.warn('[Warning] Models not loaded yet, skipping forest object creation');
    return null;
  }
  
  // FIX: Proper model access without assuming .scene property
  const sourceModel = obj.type === 'tree' ? treeModel : shrubModel;
  if (!sourceModel) {
    console.error(`[Error] No ${obj.type} model loaded for ${obj.id}`);
    return null;
  }
  
  const model = sourceModel.clone();
  
  // Handle both direct x/z and nested position properties
  const x = obj.x !== undefined ? obj.x : obj.position?.x;
  const z = obj.z !== undefined ? obj.z : obj.position?.z;
  
  if (typeof x !== 'number' || typeof z !== 'number' || isNaN(x) || isNaN(z)) {
    console.error(`[Error] Invalid coordinates for forest object ${obj.id}:`, obj);
    return null;
  }
  
  model.position.set(x, obj.y || 0, z);
  model.scale.set(obj.scale || 1, obj.scale || 1, obj.scale || 1);
  
  // Ensure the model has proper shadows
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  model.userData = { id: obj.id, type: obj.type };
  scene.add(model);
  console.log(`[Log] Added ${obj.type} ${obj.id} at (${x}, ${obj.y || 0}, ${z})`);
  return model;
}

// Export function to render forest objects from external data
export function renderForestObjects(forestData: ForestObject[], scene: THREE.Scene): THREE.Object3D[] {
  if (!modelsLoaded) {
    console.warn('[Warning] Models not loaded yet, cannot render forest objects');
    return [];
  }
  
  const meshes: THREE.Object3D[] = [];
  forestData.forEach(obj => {
    const mesh = createForestMesh(obj, scene);
    if (mesh) meshes.push(mesh);
  });
  
  return meshes;
}
