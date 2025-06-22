import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createTerrain } from './terrain'
import { createForest } from './forest'
import { loadSquirrelAvatar, updateSquirrelMovement, updateSquirrelCamera } from './avatar'
import { MOVEMENT_SPEED, GRAVITY, JUMP_FORCE, FOREST_SIZE, HEARTBEAT_INTERVAL, MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY } from './constants'

// Player state and movement
interface PlayerState {
  position: THREE.Vector3;
  rotationY: number;
  velocity: THREE.Vector3;
  isMoving: boolean;
}

const playerState: PlayerState = {
  position: new THREE.Vector3(0, 0, 0),
  rotationY: 0,
  velocity: new THREE.Vector3(0, 0, 0),
  isMoving: false
};

let isJumping = false;

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false
};

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

// Game initialization with token
async function initializeGame(): Promise<{ squirrelId: string, token: string }> {
  console.log('[Log] Starting game initialization...');
  const squirrelId = crypto.randomUUID();
  console.log('[Log] Generated squirrelId:', squirrelId);
  try {
    const response = await fetch(`${API_BASE}/join?squirrelId=${squirrelId}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    console.log('[Log] Received token from /join:', data.token);
    if (!data.token || data.token === "Must join first") {
      throw new Error("Invalid token received from /join");
    }
    localStorage.setItem('squirrelId', squirrelId);
    localStorage.setItem('token', data.token);
    return { squirrelId, token: data.token };
  } catch (error) {
    console.error('[Error] Game initialization failed:', error);
    throw error;
  }
}

// WebSocket setup with reconnection
let socket: WebSocket | null = null;
let reconnectAttempts = 0;

const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
const wsHost = API_BASE.replace(/^https?:\/\//, "");

async function connectWebSocket(squirrelId: string, token: string) {
  const wsUrl = `${wsProtocol}://${wsHost}/join?squirrelId=${squirrelId}&token=${token}`;
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("✅ WebSocket connection established");
    reconnectAttempts = 0;
    startHeartbeat();
    startPositionSync();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "pong") {
      console.debug("💓 Heartbeat acknowledged");
      return;
    }
    if (data.type === "map_reset") {
      const mapState = data.data.mapState;
      console.log(`Received map_reset with ${mapState.length} walnuts`);
      Object.values(walnutMap).forEach(mesh => scene.remove(mesh));
      walnutMap = {};
      walnutMeshes.forEach(mesh => scene.remove(mesh));
      walnutMeshes.clear();
      forestMeshes.forEach(mesh => scene.remove(mesh));
      forestMeshes = [];
      for (const walnut of mapState) {
        if (!walnut.found) {
          const mesh = createWalnutMesh(walnut);
          scene.add(mesh);
          walnutMap[walnut.id] = mesh;
          walnutMeshes.set(walnut.id, mesh);
        }
      }
      createForest().then((meshes) => {
        forestMeshes = meshes;
        meshes.forEach((mesh) => scene.add(mesh));
        console.log('Forest re-added to scene after map_reset');
      });
    }
    if (data.type === "init") {
      console.log(`Received mapState with ${data.mapState.length} walnuts`);
      Object.values(walnutMap).forEach(mesh => scene.remove(mesh));
      walnutMap = {};
      for (const walnut of data.mapState) {
        if (!walnut.found) {
          const mesh = createWalnutMesh(walnut);
          scene.add(mesh);
          walnutMap[walnut.id] = mesh;
        }
      }
    }
    if (data.type === "walnut-rehidden") {
      const { walnutId, location } = data;
      console.log(`Received rehidden message for ${walnutId} at location:`, location);
      fetchWalnutMap();
    }
    if (data.type === "player_update") {
      updateOtherPlayer(data.squirrelId, data.position);
    }
    if (data.type === "player_join") {
      console.log(`Player joined: ${data.squirrelId}`);
      updateOtherPlayer(data.squirrelId, data.position);
    }
    if (data.type === "player_leave") {
      console.log(`Player left: ${data.squirrelId}`);
      removeOtherPlayer(data.squirrelId);
    }
  };

  socket.onerror = (event) => {
    console.error("WebSocket error:", event);
    stopHeartbeat();
    stopPositionSync();
  };

  socket.onclose = () => {
    console.warn("WebSocket closed");
    stopHeartbeat();
    stopPositionSync();
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(() => connectWebSocket(squirrelId, token), RECONNECT_DELAY * reconnectAttempts);
    }
  };
}

// Scene dimensions
// const FOREST_SIZE = 100 // Now imported from constants

// AI NOTE: Memoize terrain seed/height, limit seed logs, initialize seed early
let terrainSeed = Math.random() * 1000; // Initialize with random seed
let hasLoggedSeed = false;
const heightCache: Map<string, number> = new Map();

async function initializeTerrainSeed(): Promise<number> {
  const cachedSeed = sessionStorage.getItem('terrainSeed');
  if (cachedSeed) {
    terrainSeed = parseFloat(cachedSeed);
    if (!hasLoggedSeed) {
      console.log(`[Log] Using cached terrain seed: ${terrainSeed}`);
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
      console.log(`[Log] Fetched terrain seed: ${terrainSeed}`);
      hasLoggedSeed = true;
    }
    return terrainSeed;
  } catch (error) {
    console.error('Failed to fetch terrain seed:', error);
    terrainSeed = Math.random() * 1000;
    sessionStorage.setItem('terrainSeed', terrainSeed.toString());
    if (!hasLoggedSeed) {
      console.log(`[Log] Using fallback terrain seed: ${terrainSeed}`);
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
  const seed = await initializeTerrainSeed(); // Fetch or generate seed
  
  const xNorm = (x + size / 2) / size;
  const zNorm = (z + size / 2) / size;
  const noiseValue = Math.sin(xNorm * 10 + seed) * Math.cos(zNorm * 10 + seed);
  let terrainHeight = (noiseValue + 1) * (height / 2);
  
  if (terrainHeight < 0 || terrainHeight > 5) {
    console.warn(`Invalid terrain height at (${x}, ${z}): ${terrainHeight}, using 0`);
    terrainHeight = 0;
  }
  
  heightCache.set(key, terrainHeight);
  if (DEBUG) console.log(`[Log] Terrain height at (${x}, ${z}): ${terrainHeight}`);
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
console.log('Camera initialized at:', camera.position)

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
console.log('OrbitControls configured:', {
  minDistance: controls.minDistance,
  maxDistance: controls.maxDistance,
  minPolarAngle: controls.minPolarAngle,
  maxPolarAngle: controls.maxPolarAngle
})

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

// Call initializeGame after scene setup
createTerrain().then((mesh) => {
  terrain = mesh;
  scene.add(mesh);
  console.log("Terrain added to scene");
  fetchWalnutMap();
  createForest().then((meshes) => {
    forestMeshes = meshes;
    meshes.forEach((mesh) => scene.add(mesh));
    console.log("Forest added to scene");
    // Start game
    initializeGame().then(({ squirrelId, token }) => {
      connectWebSocket(squirrelId, token);
    }).catch(() => {
      console.error("Failed to initialize game, retrying in 2 seconds...");
      setTimeout(() => initializeGame().then(({ squirrelId, token }) => connectWebSocket(squirrelId, token)), 2000);
    });
  });
  // Load squirrel avatar and log height
  loadSquirrelAvatar(scene).then(async () => {
    console.log('Squirrel avatar loaded');
    const avatarHeight = await getTerrainHeight(50, 50);
    console.log(`[Log] Squirrel avatar terrain height at (50, 50): ${avatarHeight}`);
  });
});

const axesHelper = new THREE.AxesHelper(5)
scene.add(axesHelper)

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
    console.log(`[Log] Walnut ${walnut.id} positioned at (${walnut.location.x}, ${yPosition}, ${walnut.location.z}), terrain height: ${terrainHeight}`);
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
    if (DEBUG) console.log('[Log] Mouse rotation started');
  }
});

window.addEventListener('mouseup', (event) => {
  if (event.button === 2) {
    isRotating = false;
    controls.enabled = true;
    if (DEBUG) console.log('[Log] Mouse rotation stopped');
  }
});

window.addEventListener('mousemove', (event) => {
  if (isRotating) {
    const deltaX = event.clientX - lastMouseX;
    const rotationSpeed = 0.005;
    camera.rotation.y -= deltaX * rotationSpeed;
    lastMouseX = event.clientX;
    if (DEBUG) console.log('[Log] Camera rotation updated:', camera.rotation.y);
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

  controls.enabled = false; // Disable OrbitControls during movement

  walnutMeshes.forEach(mesh => { mesh.rotation.y += 0.002; });
  renderer.render(scene, camera);
}

animate();

// WebSocket heartbeat setup
let heartbeatInterval: number | null = null;

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  heartbeatInterval = window.setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
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
  initializeTerrainSeed,
  initializeGame,
  connectWebSocket,
  updateLocalPlayer
};

// Set up position sync interval
let positionSyncInterval: number | null = null;

function startPositionSync() {
  if (positionSyncInterval) return;
  positionSyncInterval = window.setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const position = getPlayerPosition();
      socket.send(JSON.stringify({
        type: 'player_update',
        position,
        token: localStorage.getItem('token'),
        squirrelId: localStorage.getItem('squirrelId')
      }));
    }
  }, 50);
}

function stopPositionSync() {
  if (positionSyncInterval) {
    clearInterval(positionSyncInterval);
    positionSyncInterval = null;
  }
}

// Update local player position
function updateLocalPlayer(deltaTime: number) {
  const moveDirection = new THREE.Vector3(0, 0, 0);
  if (keys.w) moveDirection.z -= 1;
  if (keys.s) moveDirection.z += 1;
  if (keys.a) moveDirection.x -= 1;
  if (keys.d) moveDirection.x += 1;
  moveDirection.normalize();

  if (moveDirection.length() > 0) {
    playerState.rotationY = Math.atan2(moveDirection.x, moveDirection.z);
  }

  playerState.velocity.set(
    moveDirection.x * MOVEMENT_SPEED,
    playerState.velocity.y,
    moveDirection.z * MOVEMENT_SPEED
  );

  if (playerState.position.y > 0 || isJumping) {
    playerState.velocity.y += GRAVITY * deltaTime;
  }

  if (keys.space && !isJumping && playerState.position.y <= 0) {
    playerState.velocity.y = JUMP_FORCE;
    isJumping = true;
  }

  playerState.position.addScaledVector(playerState.velocity, deltaTime);

  if (playerState.position.y < 0) {
    playerState.position.y = 0;
    playerState.velocity.y = 0;
    isJumping = false;
  }

  if (playerMesh) {
    playerMesh.position.copy(playerState.position);
    playerMesh.rotation.y = playerState.rotationY;
  }
}

// Get current player position
function getPlayerPosition() {
  return {
    x: playerState.position.x,
    y: playerState.position.y,
    z: playerState.position.z,
    rotationY: playerState.rotationY
  };
}

// Player mesh and other players
let playerMesh: THREE.Mesh | null = null;
const otherPlayers = new Map<string, THREE.Mesh>();

// Update other players' positions
function updateOtherPlayer(squirrelId: string, position: { x: number; y: number; z: number; rotationY: number }) {
  const localSquirrelId = localStorage.getItem('squirrelId');
  if (squirrelId === localSquirrelId) return; // Skip local player

  let playerMesh = otherPlayers.get(squirrelId);
  if (!playerMesh) {
    // Create new player mesh if it doesn't exist
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    playerMesh = new THREE.Mesh(geometry, material);
    playerMesh.castShadow = true;
    scene.add(playerMesh);
    otherPlayers.set(squirrelId, playerMesh);
  }

  // Update position and rotation
  playerMesh.position.set(position.x, position.y, position.z);
  playerMesh.rotation.y = position.rotationY;
}

// Remove other player's avatar
function removeOtherPlayer(squirrelId: string) {
  const playerMesh = otherPlayers.get(squirrelId);
  if (playerMesh) {
    scene.remove(playerMesh);
    otherPlayers.delete(squirrelId);
    console.log(`Removed player ${squirrelId}`);
  }
}

// Initialize local player mesh
function initializePlayer() {
  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  playerMesh = new THREE.Mesh(geometry, material);
  playerMesh.castShadow = true;
  scene.add(playerMesh);
  
  // Set initial position
  playerMesh.position.copy(playerState.position);
  playerMesh.rotation.y = playerState.rotationY;
}

// Call initializePlayer after scene setup
initializePlayer();
