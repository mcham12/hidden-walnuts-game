import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getTerrainHeight } from './main'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface ForestObject {
  id: string;
  type: 'tree' | 'shrub' | 'bush';
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  position?: { x: number; y: number; z: number };
}

let treeModel: THREE.Object3D | null = null;
let shrubModel: THREE.Object3D | null = null;
let modelsLoaded = false;
let fallbackModels = false;

async function loadModels() {
  if (modelsLoaded) return;
  
  const loader = new GLTFLoader();
  
  try {
    const gltf = await loader.loadAsync('/assets/models/Tree_01.glb');
    treeModel = gltf.scene;
    treeModel.traverse((child: THREE.Object3D) => {
      if (child.name.toLowerCase().includes('box') || child.name.toLowerCase().includes('bounding')) {
        child.visible = false;
      }
    });
  } catch (error) {
    console.warn('[Warning] Tree GLTF failed, using fallback:', error);
    treeModel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0x228B22 })
    );
    fallbackModels = true;
  }

  try {
    const gltf = await loader.loadAsync('/assets/models/Bush_01.glb');
    shrubModel = gltf.scene;
    shrubModel.traverse((child: THREE.Object3D) => {
      if (child.name.toLowerCase().includes('box') || child.name.toLowerCase().includes('bounding')) {
        child.visible = false;
      }
    });
  } catch (error) {
    console.warn('[Warning] Shrub GLTF failed, using fallback:', error);
    shrubModel = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x006400 })
    );
    fallbackModels = true;
  }
  
  modelsLoaded = true;
  console.log('[Log] Models loaded:', fallbackModels ? 'using fallbacks' : 'using GLTF');
}

export async function createForest(): Promise<THREE.Object3D[]> {
  await loadModels();
  
  const forestObjects: ForestObject[] = [];

  try {
    const response = await fetch(`${API_BASE}/forest-objects`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Invalid data');
    forestObjects.push(...data);
    console.log(`[Log] Fetched ${forestObjects.length} forest objects`);
  } catch (error) {
    console.error('[Error] Failed to fetch forest objects:', error);
    const testObjects = [
      { id: 'test-tree-1', type: 'tree' as const, x: 10, y: 0, z: 10, scale: 1 },
      { id: 'test-shrub-1', type: 'shrub' as const, x: 5, y: 0, z: -5, scale: 1 }
    ];
    forestObjects.push(...testObjects);
    console.log(`[Log] Using ${testObjects.length} test objects`);
  }

  const meshes: THREE.Object3D[] = [];
  
  for (const obj of forestObjects) {
    try {
      const mesh = await createForestObjectMesh(obj);
      if (mesh) meshes.push(mesh);
    } catch (error) {
      console.error(`[Error] Failed to create ${obj.id}:`, error);
    }
  }

  console.log(`[Log] Created ${meshes.length} forest meshes`);
  return meshes;
}

async function createForestObjectMesh(obj: ForestObject): Promise<THREE.Object3D | null> {
  if (!modelsLoaded) return null;
  
  const isTree = obj.type === 'tree';
  const sourceModel = isTree ? treeModel : shrubModel;
  
  if (!sourceModel) {
    console.error(`[Error] No ${obj.type} model for ${obj.id}`);
    return null;
  }
  
  const model = sourceModel.clone();
  
  const x = obj.x !== undefined ? obj.x : obj.position?.x;
  const z = obj.z !== undefined ? obj.z : obj.position?.z;
  
  if (typeof x !== 'number' || typeof z !== 'number') {
    console.error(`[Error] Invalid coords for ${obj.id}:`, { x, z });
    return null;
  }
  
  let terrainHeight = 0;
  try {
    terrainHeight = await getTerrainHeight(x, z);
    if (terrainHeight < 0 || terrainHeight > 10) terrainHeight = 0;
  } catch (error) {
    terrainHeight = 0;
  }
  
  model.position.set(x, terrainHeight, z);
  model.scale.setScalar(obj.scale || 1);
  
  model.traverse((child: THREE.Object3D) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  model.userData = { id: obj.id, type: obj.type };
  console.log(`[Log] Created ${obj.type} ${obj.id} at (${x}, ${terrainHeight}, ${z})`);
  return model;
}

export function createForestMesh(obj: ForestObject, scene: THREE.Scene): THREE.Object3D | null {
  createForestObjectMesh(obj).then(mesh => {
    if (mesh) scene.add(mesh);
  });
  return null;
}

export function renderForestObjects(forestData: ForestObject[], scene: THREE.Scene): THREE.Object3D[] {
  forestData.forEach(obj => createForestMesh(obj, scene));
  return [];
}
