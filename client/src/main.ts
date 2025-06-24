import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createTerrain } from './terrain'
import { createForest } from './forest'
import { loadSquirrelAvatar, updateSquirrelMovement, updateSquirrelCamera, getSquirrelAvatar } from './avatar'
import { MultiplayerManager, type MultiplayerConfig } from './multiplayer'

// AI NOTE: Export DEBUG for use in other modules
export const DEBUG = false;

// ===== DEBUG LOGS =====
console.log('%c🔍 Environment Variables', 'font-size: 16px; font-weight: bold; color: #4CAF50;');
console.log({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
  BASE_URL: import.meta.env.BASE_URL
});

// Debug: Log VITE_API_URL at runtime
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);

// Unified API base URL logic with enhanced error handling
let API_BASE: string;
try {
  if (!import.meta.env.VITE_API_URL) {
    console.error('%c❌ VITE_API_URL is not set!', 'color: red; font-weight: bold;');
    throw new Error("VITE_API_URL must be set!");
  }
  API_BASE = import.meta.env.VITE_API_URL;
  new URL(API_BASE);
  console.log('%c🌐 Using API base URL:', 'font-weight: bold;', API_BASE);
} catch (error) {
  console.error('%c❌ Error setting up API base URL:', 'color: red; font-weight: bold;', error);
  throw error;
}

export { API_BASE };

// Scene dimensions
const FOREST_SIZE = 100

// AI NOTE: Memoize terrain seed/height, limit seed logs, initialize seed early
let terrainSeed = Math.random() * 1000; // Initialize with random seed
let hasLoggedSeed = false;
const heightCache: Map<string, number> = new Map();

async function initializeTerrainSeed(): Promise<number> {
  const cachedSeed = sessionStorage.getItem('terrainSeed');
  if (cachedSeed) {
    terrainSeed = parseFloat(cachedSeed);
    if (!hasLoggedSeed) {
      // Using cached terrain seed
      hasLoggedSeed = true;
    }
    return terrainSeed;
  }
  try {
    const response = await fetch(`${API_BASE}/terrain-seed`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    terrainSeed = data.seed;
    sessionStorage.setItem('terrainSeed', terrainSeed.toString());
    if (!hasLoggedSeed) {
      // Fetched terrain seed from server
      hasLoggedSeed = true;
    }
    return terrainSeed;
  } catch (error) {
    console.error('Failed to fetch terrain seed:', error);
    terrainSeed = Math.random() * 1000;
    sessionStorage.setItem('terrainSeed', terrainSeed.toString());
    if (!hasLoggedSeed) {
      // Using fallback terrain seed
      hasLoggedSeed = true;
    }
    return terrainSeed;
  }
}

async function getTerrainHeight(x: number, z: number): Promise<number> {
  const key = `${x.toFixed(2)},${z.toFixed(2)}`;
  if (heightCache.has(key)) return heightCache.get(key)!;
  
  const size = 200;
  const height = 5;
  const seed = await initializeTerrainSeed();
  
  const xNorm = (x + size / 2) / size;
  const zNorm = (z + size / 2) / size;
  const noiseValue = Math.sin(xNorm * 10 + seed) * Math.cos(zNorm * 10 + seed);
  let terrainHeight = (noiseValue + 1) * (height / 2);
  
  if (terrainHeight < 0 || terrainHeight > 5) {
    console.warn(`Invalid terrain height at (${x}, ${z}): ${terrainHeight}, using 0`);
    terrainHeight = 0;
  }
  
  heightCache.set(key, terrainHeight);
  // Removed verbose terrain height logging
  return terrainHeight;
}

// Get the app container
const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('No #app element found in the DOM')
}

// Initialize Three.js scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd1e5)

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.position.set(30, 60, 50)
camera.lookAt(0, 0, 0)
// Camera initialized

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
appContainer.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 10
controls.maxDistance = 100
controls.minPolarAngle = 0.1
controls.maxPolarAngle = Math.PI / 2 - 0.1
// OrbitControls configured

// Add lights
const ambientLight = new THREE.AmbientLight(0x404040, 1)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(50, 100, 50)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 2048
directionalLight.shadow.mapSize.height = 2048
directionalLight.shadow.camera.near = 1
directionalLight.shadow.camera.far = 500
directionalLight.shadow.camera.left = -FOREST_SIZE
directionalLight.shadow.camera.right = FOREST_SIZE
directionalLight.shadow.camera.top = FOREST_SIZE
directionalLight.shadow.camera.bottom = -FOREST_SIZE
scene.add(directionalLight)

// Terrain and forest setup
let terrain: THREE.Mesh;
let forestMeshes: THREE.Object3D[] = [];
createTerrain().then((mesh) => {
  terrain = mesh;
  scene.add(terrain);
  console.log('🏞️ Terrain loaded');
  fetchWalnutMap();
  createForest().then((meshes) => {
          forestMeshes = meshes;
      meshes.forEach((mesh) => scene.add(mesh));
      console.log('🌲 Forest loaded');
  });
  // Load squirrel avatar and initialize multiplayer
  loadSquirrelAvatar(scene).then(async () => {
    console.log('🐿️ Squirrel avatar loaded');
    
    // Initialize multiplayer system
    const squirrelAvatar = getSquirrelAvatar();
    if (squirrelAvatar) {
      try {
        multiplayerManager = new MultiplayerManager(multiplayerConfig, scene, squirrelAvatar.mesh);
        const authData = await multiplayerManager.initialize();
        console.log(`🎯 [Multiplayer] Connected as ${authData.squirrelId.substring(0, 8)}`);
        
        // Debug: Check scene integrity before positioning
        console.log(`🔍 Scene children: ${scene.children.length}, Camera pos: ${camera.position.x}, ${camera.position.y}, ${camera.position.z}`);
        
        // Position player at spawn location from server (with bounds checking)
        const pos = authData.position;
        if (pos.x >= -100 && pos.x <= 100 && pos.z >= -100 && pos.z <= 100 && pos.y >= 0 && pos.y <= 50) {
          squirrelAvatar.mesh.position.set(pos.x, pos.y, pos.z);
          squirrelAvatar.mesh.rotation.y = authData.rotationY;
          
          // Ensure camera is positioned correctly relative to player
          camera.position.set(pos.x + 30, pos.y + 60, pos.z + 50);
          camera.lookAt(pos.x, pos.y, pos.z);
        } else {
          console.warn('⚠️ Invalid spawn position from server, using default');
          squirrelAvatar.mesh.position.set(50, 2, 50);
          camera.position.set(80, 62, 100);
          camera.lookAt(50, 2, 50);
        }
        
        console.log(`📍 [Multiplayer] Spawned at:`, authData.position);
      } catch (error) {
        console.error('❌ [Multiplayer] Initialization failed:', error);
        // Ensure game still works without multiplayer
        console.log('🎮 Game running in single-player mode');
        multiplayerManager = null;
      }
    }
  });
});

const axesHelper = new THREE.AxesHelper(5)
scene.add(axesHelper)

// Initialize multiplayer system
let multiplayerManager: MultiplayerManager | null = null;

// UI functions
function updateMultiplayerUI(): void {
  const statusDiv = document.getElementById('multiplayer-status');
  const connectionDiv = document.getElementById('connection-status');
  const playerCountDiv = document.getElementById('player-count');
  
  if (!statusDiv || !connectionDiv || !playerCountDiv || !multiplayerManager) return;
  
  const state = multiplayerManager.getConnectionState();
  const playerCount = multiplayerManager.getPlayerCount();
  const authData = multiplayerManager.getAuthData();
  
  // Update connection status
  statusDiv.className = `status-${state}`;
  
  switch (state) {
    case 'connected':
      connectionDiv.textContent = `Connected${authData ? ` (${authData.squirrelId.substring(0, 8)})` : ''}`;
      break;
    case 'connecting':
      connectionDiv.textContent = 'Connecting...';
      break;
    case 'disconnected':
      connectionDiv.textContent = 'Disconnected';
      break;
    default:
      connectionDiv.textContent = state;
  }
  
  // Update player count
  playerCountDiv.textContent = `Players: ${playerCount}`;
}

// Multiplayer configuration
const multiplayerConfig: MultiplayerConfig = {
  apiBaseUrl: API_BASE,
  reconnectAttempts: 5,
  reconnectDelay: 2000,
  heartbeatInterval: 30000,
  interpolationSpeed: 5.0,
  updateThreshold: 0.1,
  playerUpdateRate: 20 // 20 updates per second
};

interface Walnut {
  id: string
  ownerId: string
  origin: 'game' | 'player'
  hiddenIn?: 'buried' | 'bush'
  location: { x: number; y: number; z: number }
  found: boolean
  timestamp: number
}

const WALNUT_CONFIG = {
  radius: 0.5,
  segments: 16,
  colors: {
    buried: 0x8B4513,
    bush: 0x228B22,
    origin: { game: 0xffd700, player: 0xb87333 }
  },
  height: { buried: 0.2, bush: 0.8 }
}

const walnutMeshes = new Map<string, THREE.Mesh>()
let walnuts: Walnut[] = []
let walnutMap: Record<string, THREE.Mesh> = {};

function getHidingMethod(walnut: Walnut): 'buried' | 'bush' {
  return walnut.hiddenIn || (Math.random() > 0.5 ? 'buried' : 'bush');
}

function createWalnutMaterial(walnut: Walnut, hidingMethod: 'buried' | 'bush'): THREE.Material {
  const baseColor = WALNUT_CONFIG.colors[hidingMethod];
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: hidingMethod === 'buried' ? 0.9 : 0.7,
    metalness: walnut.origin === 'game' ? 0.5 : 0.2,
    emissive: walnut.origin === 'game' ? new THREE.Color(0x331100) : new THREE.Color(0x000000),
    emissiveIntensity: walnut.origin === 'game' ? 0.2 : 0
  });
}

function createWalnutMesh(walnut: Walnut): THREE.Mesh {
  const hidingMethod = getHidingMethod(walnut);
  const geometry = new THREE.SphereGeometry(
    WALNUT_CONFIG.radius,
    WALNUT_CONFIG.segments,
    WALNUT_CONFIG.segments
  );
  const material = createWalnutMaterial(walnut, hidingMethod);
  const mesh = new THREE.Mesh(geometry, material);
  getTerrainHeight(walnut.location.x, walnut.location.z).then((terrainHeight) => {
    if (terrainHeight <= 0) {
      terrainHeight = 5;
      console.warn(`Invalid terrain height at (${walnut.location.x}, ${walnut.location.z}), using fallback y=5`);
    }
    const yPosition = terrainHeight + WALNUT_CONFIG.height[hidingMethod];
    mesh.position.set(walnut.location.x, yPosition, walnut.location.z);
    // Removed verbose walnut positioning logs
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    walnutId: walnut.id,
    hiddenIn: hidingMethod,
    origin: walnut.origin,
    ownerId: walnut.ownerId
  };
  return mesh;
}

function renderWalnuts(walnutData: Walnut[]): void {
  walnutMeshes.forEach(mesh => scene.remove(mesh));
  walnutMeshes.clear();
  walnutData.forEach(walnut => {
    if (!walnut.found) {
      const mesh = createWalnutMesh(walnut);
      scene.add(mesh);
      walnutMeshes.set(walnut.id, mesh);
    }
  });
}

async function fetchWalnutMap() {
  try {
    const response = await fetch(`${API_BASE}/map-state`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    walnuts = await response.json();
    if (Object.keys(walnutMap).length === 0) renderWalnuts(walnuts);
    return walnuts;
  } catch (error) {
    console.error('Failed to fetch walnut map data:', error);
    return [];
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let isRotating = false;
let lastMouseX = 0;

window.addEventListener('mousedown', (event) => {
  if (event.button === 2) {
    isRotating = true;
    lastMouseX = event.clientX;
    controls.enabled = false;
    // Mouse rotation started
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 2) {
    isRotating = false;
    controls.enabled = true;
    // Mouse rotation stopped
  }
});

window.addEventListener('mousemove', (event) => {
  if (isRotating) {
    const deltaX = event.clientX - lastMouseX;
    const rotationSpeed = 0.005;
    camera.rotation.y -= deltaX * rotationSpeed;
    lastMouseX = event.clientX;
          // Camera rotation updated
  }
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    controls.enabled = false;
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
    controls.enabled = true;
  }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Array.from(walnutMeshes.values()));
    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const walnutId = clickedMesh.userData.walnutId;
      console.log(`Clicked walnut: ${walnutId}`, clickedMesh.userData);
    }
  }
});

let lastTime = performance.now();
async function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  updateSquirrelMovement(deltaTime);
  updateSquirrelCamera(camera);

  // Update multiplayer system
  if (multiplayerManager) {
    multiplayerManager.update(deltaTime);
    
    // Update UI periodically (every 30 frames ≈ 0.5 seconds at 60fps)
    if (Math.floor(currentTime / 500) !== Math.floor(lastTime / 500)) {
      updateMultiplayerUI();
    }
  }

  // Safety check: Detect scene corruption
  if (scene.children.length < 3) { // Should have terrain, lights, etc.
    console.error('🚨 Scene corruption detected! Children count:', scene.children.length);
  }

  controls.enabled = false; // Disable OrbitControls during movement

  walnutMeshes.forEach(mesh => { mesh.rotation.y += 0.002; });
  renderer.render(scene, camera);
}

animate();

// WebSocket heartbeat setup
let heartbeatInterval: number | null = null;
const HEARTBEAT_INTERVAL = 20000; // 20 seconds

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = window.setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// WebSocket connection
const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
const wsHost = API_BASE.replace(/^https?:\/\//, '');
const squirrelId = crypto.randomUUID();
const wsUrl = `${wsProtocol}://${wsHost}/join?squirrelId=${squirrelId}`;
const socket = new WebSocket(wsUrl);

socket.addEventListener("open", () => {
  console.log("✅ WebSocket connection established");
  startHeartbeat();
});

socket.addEventListener("message", (event) => {
  console.log("Raw WS message received:", event.data);
  const data = JSON.parse(event.data);

  if (data.type === "pong") {
    console.debug("💓 Heartbeat acknowledged");
    return;
  }

  if (data.type === "map_reset") {
    const mapState = data.data.mapState;
    console.log(`Received map_reset with ${mapState.length} walnuts`);
    // Clear both walnutMap and walnutMeshes
    Object.values(walnutMap).forEach(mesh => {
      scene.remove(mesh);
    });
    walnutMap = {};
    walnutMeshes.forEach(mesh => {
      scene.remove(mesh);
    });
    walnutMeshes.clear();
    // Clear forest meshes
    forestMeshes.forEach(mesh => {
      scene.remove(mesh);
    });
    forestMeshes = [];
    // Re-render walnuts and forest
    for (const walnut of mapState) {
      if (!walnut.found) {
        const mesh = createWalnutMesh(walnut);
        scene.add(mesh);
        walnutMap[walnut.id] = mesh;
        walnutMeshes.set(walnut.id, mesh);
        console.log(`Added walnut ${walnut.id} to scene after map_reset`);
      }
    }
    createForest().then((meshes) => {
      forestMeshes = meshes;
      meshes.forEach((mesh) => scene.add(mesh));
      console.log('Forest re-added to scene after map_reset');
    });
    return;
  }

  if (data.type === "init") {
    console.log(`Received mapState with ${data.mapState.length} walnuts`);
    Object.values(walnutMap).forEach(mesh => {
      scene.remove(mesh);
    });
    walnutMap = {};
    for (const walnut of data.mapState) {
      if (!walnut.found) {
        const mesh = createWalnutMesh(walnut);
        scene.add(mesh);
        walnutMap[walnut.id] = mesh;
        console.log(`Added walnut ${walnut.id} to scene`);
      }
    }
  }

  if (data.type === "walnut-rehidden") {
    const { walnutId, location } = data;
    console.log(`Received rehidden message for ${walnutId} at location:`, location);
    Object.values(walnutMap).forEach(mesh => {
      scene.remove(mesh);
    });
    walnutMap = {};
    fetchWalnutMap().then(updatedWalnuts => {
      for (const walnut of updatedWalnuts) {
        if (!walnut.found) {
          const mesh = createWalnutMesh(walnut);
          scene.add(mesh);
          walnutMap[walnut.id] = mesh;
          console.log(`Synced walnut ${walnut.id} at position (${walnut.location.x}, ${walnut.location.y}, ${walnut.location.z})`);
        }
      }
    });
  }
});

socket.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
  stopHeartbeat();
});

socket.addEventListener("close", (event) => {
  console.warn("WebSocket closed:", event);
  stopHeartbeat();
});

// Update exports
export {
  scene,
  camera,
  renderer,
  FOREST_SIZE,
  fetchWalnutMap,
  walnuts,
  renderWalnuts,
  getHidingMethod,
  createWalnutMaterial,
  socket,
  terrain,
  getTerrainHeight,
  forestMeshes,
  initializeTerrainSeed
};

// Hidden Walnuts Game - Main Entry Point
console.log('[Build] Frontend build triggered');
