import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createTerrain } from './terrain'
import { createForest } from './forest'
import { loadSquirrelAvatar, updateSquirrelMovement, updateSquirrelCamera, getSquirrelAvatar } from './avatar'
import { FOREST_SIZE, HEARTBEAT_INTERVAL, MAX_RECONNECT_ATTEMPTS } from './constants'

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
    console.log('[Log] Received token from /join:', data.id);
    if (!data.id || data.id === "Must join first") {
      throw new Error("Invalid token received from /join");
    }
    localStorage.setItem('squirrelId', squirrelId);
    localStorage.setItem('token', data.id);
    return { squirrelId, token: data.id };
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
  // FIX: Better connection state management (Phase 2)
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log("[Log] WebSocket already connected, skipping reconnection");
    return;
  }

  // Use /ws endpoint instead of /join for WebSocket
  const wsUrl = `${wsProtocol}://${wsHost}/ws?squirrelId=${squirrelId}&token=${token}`;
  
  try {
    socket = new WebSocket(wsUrl);
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = getReconnectDelay(reconnectAttempts);
      console.log(`[Log] Retrying connection in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => connectWebSocket(squirrelId, token), delay);
    }
    return;
  }

  socket.addEventListener("open", () => {
    console.log("✅ WebSocket connection established");
    reconnectAttempts = 0; // Reset on successful connection
    startHeartbeat();
    
    // No longer using frequent intervals - will call sendPlayerUpdate() in render loop
    console.log("[Log] WebSocket ready for optimized player updates");
  });

  socket.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
    stopHeartbeat();
    
    // FIX: Enhanced error handling with specific error types
    if (socket?.readyState === WebSocket.CONNECTING) {
      console.error("[Error] Failed to connect to WebSocket server");
    } else if (socket?.readyState === WebSocket.OPEN) {
      console.error("[Error] WebSocket connection lost during operation");
    }
  });

  socket.addEventListener("close", (event) => {
    console.warn("WebSocket closed:", event.code, event.reason);
    stopHeartbeat();
    
    // FIX: Better close code handling
    if (event.code === 4001) {
      console.error("[Error] Authentication failed - invalid token");
      // Don't auto-reconnect on auth failure
      return;
    } else if (event.code === 4003) {
      console.error("[Error] Server at capacity - will retry later");
    } else if (event.code === 4004) {
      console.warn("[Warning] Connection timeout - reconnecting");
    }
    
    // Attempt to reconnect after a delay with exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = getReconnectDelay(reconnectAttempts);
      console.log(`[Log] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(() => connectWebSocket(squirrelId, token), delay);
    } else {
      console.error("[Error] Max reconnection attempts reached. Please refresh the page.");
    }
  });

  socket.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received message:", data);
      
      if (data.type === "pong") {
        console.debug("💓 Heartbeat acknowledged");
        return;
      }
      
      // Enhanced multiplayer updates with better logging
      if (data.type === 'player_update' && data.squirrelId !== localStorage.getItem('squirrelId')) {
        console.log(`[Log] 📨 Received player update from ${data.squirrelId}:`, data.position);
        updateOtherPlayer(data.squirrelId, data.position);
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
        console.log(`[Log] 📨 Received init message with ${data.mapState.length} walnuts`);
        // Clear existing walnuts
        Object.values(walnutMap).forEach(mesh => scene.remove(mesh));
        walnutMap = {};
        walnutMeshes.forEach(mesh => scene.remove(mesh));
        walnutMeshes.clear();
        
        // Add new walnuts using consistent method
        for (const walnut of data.mapState) {
          if (!walnut.found) {
            const mesh = createWalnutMesh(walnut);
            scene.add(mesh);
            walnutMap[walnut.id] = mesh;
            walnutMeshes.set(walnut.id, mesh);
          }
        }
        console.log(`[Log] ✅ Init complete: added ${walnutMeshes.size} walnuts to scene`);
      }
      
      // FIX: Handle existing players when joining
      if (data.type === "existing_players") {
        console.log(`[Log] 👥 Received ${data.players.length} existing players`);
        for (const player of data.players) {
          updateOtherPlayer(player.squirrelId, player.position);
        }
      }
      
      if (data.type === "walnut-rehidden") {
        const { walnutId, location } = data;
        console.log(`Received rehidden message for ${walnutId} at location:`, location);
        fetchWalnutMap();
      }
      if (data.type === "player_join") {
        console.log(`[Log] 👋 Player joined: ${data.squirrelId}`);
        updateOtherPlayer(data.squirrelId, data.position);
      }
      if (data.type === "player_leave") {
        console.log(`[Log] 👋 Player left: ${data.squirrelId}`);
        removeOtherPlayer(data.squirrelId);
      }
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });
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
camera.position.set(0, 50, 100)
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
let terrain: THREE.Object3D;
let forestMeshes: THREE.Object3D[] = [];

// Proper game initialization sequence
async function startGame() {
  try {
    console.log('[Log] 🎮 Starting game initialization...');
    
    // Initialize game and connect WebSocket
    const { squirrelId, token } = await initializeGame();
    await connectWebSocket(squirrelId, token);
    
    // Initialize environment (forest and walnuts)
    await initEnvironment();
    
    console.log('[Log] ✅ Game initialization complete!');
  } catch (error) {
    console.error('[Error] Game initialization failed:', error);
  }
}

// Start the game
startGame();

const axesHelper = new THREE.AxesHelper(100)
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

let walnutMeshes = new Map<string, THREE.Mesh>();
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
  const geometry = new THREE.SphereGeometry(0.3, 16, 16); // FIX: Smaller walnuts for better proportions
  const material = new THREE.MeshStandardMaterial({
    color: hidingMethod === 'buried' ? 0x8B4513 : 0x228B22,
    roughness: 0.7,
    metalness: 0.2
  });
  const mesh = new THREE.Mesh(geometry, material);
  getTerrainHeight(walnut.location.x, walnut.location.z).then((terrainHeight) => {
    const yPosition = terrainHeight + (hidingMethod === 'buried' ? 0.15 : 0.4); // Adjusted for smaller size
    mesh.position.set(walnut.location.x, yPosition, walnut.location.z);
    console.log(`[Log] Walnut ${walnut.id} at (${walnut.location.x}, ${yPosition}, ${walnut.location.z})`);
  }).catch(() => {
    mesh.position.set(walnut.location.x, 5, walnut.location.z); // Fallback
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { walnutId: walnut.id };
  return mesh;
}

function renderWalnuts(walnutData: Walnut[]): void {
  console.log(`[Log] Rendering ${walnutData.length} walnuts`);
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

// Enhanced walnut map fetching with better logging
async function fetchWalnutMap() {
  try {
    const response = await fetch(`${API_BASE}/map-state`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('[Log] Fetched walnut data:', data);
    if (!Array.isArray(data)) throw new Error('Expected array');
    renderWalnuts(data);
    return data;
  } catch (error) {
    console.error('[Error] Fetching walnut map:', error);
    return [];
  }
}

// Initialize environment with proper forest and walnut loading
async function initEnvironment() {
  console.log('[Log] Initializing game environment...');
  
  try {
    // Initialize terrain first
    const terrain = await createTerrain();
    scene.add(terrain);
    console.log('[Log] Terrain added to scene');
    
    // Load forest using the proper GLTF system
    const loadedForestMeshes = await createForest();
    loadedForestMeshes.forEach(mesh => scene.add(mesh));
    forestMeshes = loadedForestMeshes;
    console.log(`[Log] Added ${forestMeshes.length} forest objects to scene`);
    
    // Load walnuts using the proper system
    const walnutData = await fetchWalnutMap();
    console.log(`[Log] Loaded ${walnutData.length} walnuts`);
    
    // Load squirrel avatar
    await loadSquirrelAvatar(scene);
    console.log('[Log] Squirrel avatar loaded');
    
    // Log final scene composition
    console.log(`[Log] Environment initialization complete. Scene has ${scene.children.length} objects`);
    
  } catch (error) {
    console.error('[Error] Environment initialization failed:', error);
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

  // Use proper avatar system
  updateSquirrelMovement(deltaTime);
  updateSquirrelCamera(camera);
  
  // Send optimized player updates using avatar position
  sendPlayerUpdate();

  // Allow controls to work when not in conflict
  controls.update();

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

// Multiplayer other players tracking
const otherPlayers = new Map<string, THREE.Object3D>();

// Get current player position from avatar system with better error handling
function getPlayerPosition() {
  const avatar = getSquirrelAvatar();
  if (avatar?.mesh) {
    return {
      x: avatar.mesh.position.x,
      y: avatar.mesh.position.y,
      z: avatar.mesh.position.z,
      rotationY: avatar.mesh.rotation.y
    };
  }
  // FIX: Better fallback that still allows multiplayer sync during avatar loading
  console.warn('[Warning] Avatar not loaded yet, using default position for multiplayer sync');
  return { x: 0, y: 2, z: 0, rotationY: 0 }; // Use y=2 so player is visible above terrain
}

// Update other players' positions with enhanced visibility
async function updateOtherPlayer(squirrelId: string, position: { x: number; y: number; z: number; rotationY: number }) {
  const localSquirrelId = localStorage.getItem('squirrelId');
  if (squirrelId === localSquirrelId) return;

  let playerMesh = otherPlayers.get(squirrelId);
  if (!playerMesh) {
    // FIX: Load proper squirrel avatar for other players instead of box
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync('/assets/models/squirrel.glb');
      playerMesh = gltf.scene;
      playerMesh.scale.set(0.5, 0.5, 0.5); // Same scale as main player
      
      // Make it slightly different color to distinguish from main player
      playerMesh.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.material) {
          const material = child.material.clone();
          if (Array.isArray(material)) {
            material.forEach(mat => {
              if ('color' in mat) mat.color.setHex(0x888888); // Darker gray
            });
          } else if ('color' in material) {
            material.color.setHex(0x888888); // Darker gray
          }
          child.material = material;
        }
      });
      
      playerMesh.castShadow = true;
      playerMesh.receiveShadow = true;
      scene.add(playerMesh);
      otherPlayers.set(squirrelId, playerMesh);
      console.log(`[Log] ✅ Added squirrel avatar for player ${squirrelId}`);
    } catch (error) {
      console.warn(`[Warning] Failed to load squirrel for ${squirrelId}, using fallback:`, error);
      // Fallback to colored box but make it look more like a player
      const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
      const material = new THREE.MeshStandardMaterial({ 
        color: 0xffaa00, // Orange color
        roughness: 0.7,
        metalness: 0.1
      });
      playerMesh = new THREE.Mesh(geometry, material);
      playerMesh.castShadow = true;
      playerMesh.receiveShadow = true;
      scene.add(playerMesh);
      otherPlayers.set(squirrelId, playerMesh);
      console.log(`[Log] ⚠️ Added fallback avatar for player ${squirrelId}`);
    }
  }

  if (playerMesh) {
    const terrainHeight = await getTerrainHeight(position.x, position.z).catch(() => 0);
    playerMesh.position.set(position.x, terrainHeight + 0.1, position.z);
    playerMesh.rotation.y = position.rotationY;
    console.log(`[Log] 📍 Updated player ${squirrelId} to (${position.x}, ${terrainHeight + 0.1}, ${position.z})`);
  }
}

// Remove other player's avatar
function removeOtherPlayer(squirrelId: string) {
  const playerMesh = otherPlayers.get(squirrelId);
  if (playerMesh) {
    scene.remove(playerMesh);
    otherPlayers.delete(squirrelId);
    console.log(`[Log] 🔴 Removed multiplayer avatar for ${squirrelId}`);
  }
}

// Scene monitoring for debugging
function monitorScene() {
  const sceneStats = {
    totalChildren: scene.children.length,
    meshCount: scene.children.filter(child => child.type === 'Mesh').length,
    otherPlayerCount: otherPlayers.size,
    walnutCount: walnutMeshes.size,
    forestObjectCount: forestMeshes.length
  };
  
  console.log('[Log] 📊 Scene composition:', sceneStats);
  
  // Check for missing environment elements
  if (sceneStats.forestObjectCount === 0) {
    console.warn('[Warning] 🌲 No forest objects detected in scene');
  }
  if (sceneStats.walnutCount === 0) {
    console.warn('[Warning] 🥜 No walnuts detected in scene');
  }
}

// Monitor scene every 30 seconds for debugging
setInterval(monitorScene, 30000);

// Debug function to manually fetch environment (accessible from console)
(window as any).debugFetchEnvironment = async () => {
  console.log('[Debug] 🔍 Manually fetching environment data...');
  await initEnvironment();
};

// Debug function to log current scene state
(window as any).debugSceneState = () => {
  console.log('[Debug] 🎬 Current scene state:');
  monitorScene();
  console.log('[Debug] Scene children:', scene.children.map(child => ({ 
    type: child.type, 
    name: child.name || 'unnamed',
    position: child.position,
    visible: child.visible
  })));
};

// Throttle player updates
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 100; // 100ms

// FIX: Improved player update throttling with better error handling
function sendPlayerUpdate() {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    if (DEBUG) console.log('[Debug] Skipping player update - WebSocket not ready');
    return;
  }
  
  try {
    const position = getPlayerPosition();
    const message = JSON.stringify({ type: 'player_update', position });
    socket.send(message);
    lastUpdateTime = now;
    if (DEBUG) console.log(`[Debug] 📤 Sent player update:`, position);
  } catch (error) {
    console.error('[Error] Failed to send player update:', error);
  }
}

// Connection configuration with exponential backoff
const BASE_RECONNECT_DELAY = 1000; // Start with 1 second

// FIX: Exponential backoff for reconnection (Phase 2)
function getReconnectDelay(attempt: number): number {
  return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), 30000); // Max 30 seconds
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
  connectWebSocket
};
