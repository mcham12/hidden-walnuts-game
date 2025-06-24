import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// GLTFLoader now used in avatar.ts and multiplayer.ts
import { createTerrain, initializeTerrainSeed } from './terrain'
import { createForest } from './forest'
import { 
  loadSquirrelAvatar, 
  updateSquirrelMovement, 
  updateSquirrelCamera, 
  getSquirrelAvatar,
  getCurrentInput,
  getPredictedState,
  reconcileWithServer,
  setPlayerPosition
} from './avatar'
import { MultiplayerSystem } from './multiplayer'
import { NetworkManager } from './network'
import { FOREST_SIZE } from './constants'

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

// Industry Standard: Global systems initialization
let networkManager: NetworkManager;
let multiplayerSystem: MultiplayerSystem;
let localPlayerId: string;

// Game initialization with token
async function initializeGame(): Promise<{ squirrelId: string, token: string }> {
  console.log('[Log] Starting game initialization...');
  const squirrelId = crypto.randomUUID();
  localPlayerId = squirrelId;
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

// Industry Standard: WebSocket setup with proper network management
async function connectWebSocket(squirrelId: string, token: string) {
  const wsProtocol = API_BASE.startsWith("https") ? "wss" : "ws";
  const wsHost = API_BASE.replace(/^https?:\/\//, "");
  const wsUrl = `${wsProtocol}://${wsHost}/ws?squirrelId=${squirrelId}&token=${token}`;
  
  console.log(`[Network] 🔌 Attempting WebSocket connection to: ${wsUrl}`);
  console.log(`[Network] 📋 Connection details:`);
  console.log(`[Network]   - API_BASE: ${API_BASE}`);
  console.log(`[Network]   - Protocol: ${wsProtocol}`);
  console.log(`[Network]   - Host: ${wsHost}`);
  console.log(`[Network]   - SquirrelId: ${squirrelId}`);
  console.log(`[Network]   - Token: ${token}`);
  
  try {
    console.log(`[Network] ⏳ Calling networkManager.connect()...`);
    await networkManager.connect(wsUrl);
    
    console.log(`[Network] ✅ NetworkManager connection successful`);
    setupNetworkHandlers();
    console.log("✅ Network connection established and handlers setup");
    
  } catch (error) {
    console.error("❌ Failed to connect to server:", error);
    console.error("❌ Error details:", error);
    console.error("❌ Connection parameters:", { wsUrl, squirrelId, token });
    
    // Don't throw - continue game in offline mode for debugging
    console.warn("⚠️ Continuing in offline mode for debugging");
    
    // Set up a fallback to add avatar to scene manually
    console.log("[Fallback] ⏰ Setting up 1-second fallback timer...");
    setTimeout(() => {
      console.log("[Fallback] 🚀 Executing fallback - Adding avatar to scene manually");
      const avatar = getSquirrelAvatar();
      console.log("[Fallback] 📊 Avatar status:", { 
        mesh: !!avatar.mesh, 
        isLoaded: avatar.isLoaded,
        meshType: avatar.mesh?.type || 'none'
      });
      
      if (avatar.mesh && avatar.isLoaded) {
        scene.add(avatar.mesh);
        const spawnPos = new THREE.Vector3(50, 2, 50);
        setPlayerPosition(spawnPos);
        setupThirdPersonCamera(avatar.mesh);
        console.log('[Fallback] ✅ Avatar added manually');
        
        // FIX: Start input transmission even in fallback mode
        console.log('[Fallback] 🎮 Starting input transmission...');
        startInputTransmission();
        console.log('[Fallback] ✅ Input transmission started');
      } else {
        console.error('[Fallback] ❌ Avatar not ready for fallback setup');
      }
    }, 1000);
  }
}

// Industry Standard: Setup network message handlers
function setupNetworkHandlers() {
  // Handle player updates with proper reconciliation
  networkManager.on('player_update', (data) => {
    if (data.squirrelId === localPlayerId) {
      // Industry Standard: Server reconciliation for local player
      const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      reconcileWithServer(position, data.position.rotationY || 0, data.timestamp || performance.now());
    } else {
      // Industry Standard: Update other players through multiplayer system
      const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
      multiplayerSystem.updatePlayer(data.squirrelId, position, data.position.rotationY || 0);
    }
  });

  // Handle player joins
  networkManager.on('player_join', async (data) => {
    console.log(`[Log] 👋 Player joined: ${data.squirrelId}`);
    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    await multiplayerSystem.addPlayer(data.squirrelId, position, data.position.rotationY || 0);
  });

  // Handle player leaves
  networkManager.on('player_leave', (data) => {
    console.log(`[Log] 👋 Player left: ${data.squirrelId}`);
    multiplayerSystem.removePlayer(data.squirrelId);
  });

  // Handle initialization
  networkManager.on('init', async (data) => {
    console.log(`[Log] 📨 Received init message with ${data.mapState.length} walnuts`);
    
    // Clear existing walnuts
    Object.values(walnutMap).forEach(mesh => scene.remove(mesh));
    walnutMap = {};
    walnutMeshes.forEach(mesh => scene.remove(mesh));
    walnutMeshes.clear();
    
    // Add new walnuts
    for (const walnut of data.mapState) {
      if (!walnut.found) {
        const mesh = createWalnutMesh(walnut);
        scene.add(mesh);
        walnutMap[walnut.id] = mesh;
        walnutMeshes.set(walnut.id, mesh);
      }
    }
    console.log(`[Log] ✅ Init complete: added ${walnutMeshes.size} walnuts to scene`);
    
    // Simple: Add avatar to scene now that server is ready
    const avatar = getSquirrelAvatar();
    if (avatar.mesh && avatar.isLoaded) {
      // Make sure avatar is visible and properly configured
      avatar.mesh.visible = true;
      avatar.mesh.castShadow = true;
      avatar.mesh.receiveShadow = true;
      
      // Add to scene (only once)
      scene.add(avatar.mesh);
      console.log('[Log] ✅ Avatar added to scene');
      
      // Set spawn position 
      const spawnPos = new THREE.Vector3(50, 2, 50);
      setPlayerPosition(spawnPos);
      
      // Setup camera
      setupThirdPersonCamera(avatar.mesh);
      
      console.log('[Log] ✅ Avatar ready at:', spawnPos);
    } else {
      console.error('[Error] ❌ Avatar not ready for server init');
    }
    
    // Signal client is ready
    setTimeout(() => {
      networkManager.send('client_ready', {}, { priority: 0 });
      console.log(`[Log] 📤 Sent client_ready signal`);
      
      // FIX: Start input transmission after client is ready
      startInputTransmission();
      console.log(`[Log] ✅ Input transmission started`);
    }, 500);
  });

  // Handle existing players
  networkManager.on('existing_players', async (data) => {
    console.log(`[Log] 👥 Received ${data.players.length} existing players`);
    for (const player of data.players) {
      const position = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      await multiplayerSystem.addPlayer(player.squirrelId, position, player.rotationY || 0);
      console.log(`[Debug] Added existing player ${player.squirrelId} at (${position.x}, ${position.z})`);
    }
  });

  // Handle map resets
  networkManager.on('map_reset', (data) => {
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
  });

  // Handle walnut rehiding
  networkManager.on('walnut-rehidden', (data) => {
    const { walnutId, location } = data;
    console.log(`Received rehidden message for ${walnutId} at location:`, location);
    fetchWalnutMap();
  });
}

// Scene dimensions
// const FOREST_SIZE = 100 // Now imported from constants

// AI NOTE: Memoize terrain seed/height, limit seed logs, initialize seed early
let terrainSeed = Math.random() * 1000; // Initialize with random seed
let hasLoggedSeed = false;
const heightCache: Map<string, number> = new Map();

async function initializeTerrainSeedLocal(): Promise<number> {
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
  const seed = await initializeTerrainSeedLocal();
  
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
renderer.shadowMap.type = THREE.PCFSoftShadowMap
appContainer.appendChild(renderer.domElement)

// Initialize systems after scene is created
networkManager = new NetworkManager();
multiplayerSystem = new MultiplayerSystem(scene);
console.log('[Log] 🔧 Network and multiplayer systems initialized');

// Setup network connection state monitoring
networkManager.onConnectionState((state) => {
  console.log('[Network] Connection state:', state);
  if (state.isConnected) {
    startInputTransmission();
  } else {
    stopInputTransmission();
  }
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.1
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
const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(50, 50, 50)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.width = 2048
directionalLight.shadow.mapSize.height = 2048
directionalLight.shadow.camera.near = 0.5
directionalLight.shadow.camera.far = 500
scene.add(directionalLight)

// Terrain and forest setup
let forestMeshes: THREE.Object3D[] = [];

// Proper game initialization sequence
async function startGame() {
  try {
    console.log('[Log] 🎮 Starting game...');
    
    // Initialize game and connect
    const { squirrelId, token } = await initializeGame();
    await connectWebSocket(squirrelId, token);
    
    // Initialize environment
    await initEnvironment();
    
    console.log('[Log] ✅ Game started successfully!');
  } catch (error) {
    console.error('[Error] Failed to start game:', error);
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
    // console.log(`[Log] Walnut ${walnut.id} at (${walnut.location.x}, ${yPosition}, ${walnut.location.z})`);
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
  try {
    console.log('[Log] 🌲 Initializing environment...');
    
    // Initialize terrain system for collision detection
    const seed = await initializeTerrainSeedLocal();
    initializeTerrainSeed(seed);
    
    // Create and add terrain to scene
    const terrain = await createTerrain()
    scene.add(terrain)
    console.log('[Log] Terrain added to scene')
    
    // Create and add forest objects to scene
    forestMeshes = await createForest()
    forestMeshes.forEach((mesh) => scene.add(mesh))
    console.log(`[Log] Forest added to scene with ${forestMeshes.length} objects`)
    
    // Load walnuts using the proper system
    const walnutData = await fetchWalnutMap();
    console.log(`[Log] Loaded ${walnutData.length} walnuts`);
    
    // Load avatar and add to scene immediately (bypass WebSocket dependency)
    await loadSquirrelAvatar();
    console.log('[Log] Squirrel avatar loaded');
    
    // FIX: Add avatar to scene and start movement system immediately
    const avatar = getSquirrelAvatar();
    if (avatar.mesh && avatar.isLoaded) {
      scene.add(avatar.mesh);
      const spawnPos = new THREE.Vector3(50, 2, 50);
      setPlayerPosition(spawnPos);
      setupThirdPersonCamera(avatar.mesh);
      console.log('[Log] ✅ Avatar added to scene at spawn position');
      
      // Start input transmission for movement
      startInputTransmission();
      console.log('[Log] ✅ Input transmission started');
    } else {
      console.error('[Error] ❌ Avatar not ready after loading');
    }
    
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

// AI NOTE: Track deltaTime calculation for proper squirrel movement
let lastAnimationTime = 0;

// Industry Standard: Input transmission with proper timing
let inputTransmissionInterval: number | null = null;
const INPUT_RATE = 60; // 60 Hz input rate

function startInputTransmission() {
  if (inputTransmissionInterval) return;
  
  inputTransmissionInterval = window.setInterval(() => {
    const avatar = getSquirrelAvatar();
    if (!avatar.mesh) return;
    
    const currentInput = getCurrentInput();
    const predictedState = getPredictedState();
    
    // Always process input for local movement (independent of network)
    // This ensures WASD works even when offline
    
    // Only send to network if connected
    if (networkManager.getConnectionState().isConnected) {
      networkManager.send('player_update', {
        position: {
          x: predictedState.position.x,
          y: predictedState.position.y,
          z: predictedState.position.z,
          rotationY: predictedState.rotation
        },
        input: currentInput,
        sequence: predictedState.inputSequence,
        timestamp: performance.now()
      }, { priority: 1 });
    }
    
  }, 1000 / INPUT_RATE);
}

function stopInputTransmission() {
  if (inputTransmissionInterval) {
    clearInterval(inputTransmissionInterval);
    inputTransmissionInterval = null;
  }
}

// Animation loop with industry standard timing
async function animate(currentTime: number = 0) {
  requestAnimationFrame(animate);
  
  let deltaTime = (currentTime - lastAnimationTime) / 1000;
  lastAnimationTime = currentTime;
  
  // Fix timing issues
  if (deltaTime > 0.1) deltaTime = 0.016;
  if (deltaTime <= 0) deltaTime = 0.016;
  
  // Update avatar system with client-side prediction
  const avatar = getSquirrelAvatar();
  if (avatar.mesh) {
    updateSquirrelMovement(deltaTime);
    await updateSquirrelCamera(camera);
    
    // Update multiplayer system with actual local player position
    const localPos = avatar.mesh.position.clone();
    multiplayerSystem.updateLocalPlayerPosition(localPos);
    multiplayerSystem.update();
  }
  
  // Standard Three.js updates
  controls.update();
  renderer.render(scene, camera);
}

animate();

// Performance monitoring with multiplayer debugging
setInterval(() => {
  const networkStats = networkManager.getStats();
  const multiplayerStats = multiplayerSystem.getStats();
  const avatar = getSquirrelAvatar();
  
  // Reduced frequency logging - only show on changes
  if (Math.random() < 0.1) { // Only log 10% of the time
    console.log('[Performance] Network:', networkStats);
    console.log('[Performance] Multiplayer:', multiplayerStats);
    
    if (avatar.mesh) {
      const pos = avatar.mesh.position;
      const predictedState = getPredictedState();
      console.log(`[Debug] Local player at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) | Avatar visible: ${avatar.mesh.visible} | Scene children: ${scene.children.length}`);
      console.log(`[Debug] Avatar state - Position: (${predictedState.position.x.toFixed(1)}, ${predictedState.position.z.toFixed(1)}) | Input: W:${getCurrentInput().forward} A:${getCurrentInput().left} S:${getCurrentInput().backward} D:${getCurrentInput().right}`);
      
      // List visible players
      const visiblePlayers = multiplayerSystem.getVisiblePlayers();
      if (visiblePlayers.length > 0) {
        console.log(`[Debug] Visible players: ${visiblePlayers.map(p => 
          `${p.id} at (${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)})`
        ).join(', ')}`);
      } else {
        console.log('[Debug] No other players visible');
      }
    } else {
      console.log('[Debug] ⚠️ Avatar mesh not available');
    }
  }
}, 30000); // Every 30 seconds

// Legacy multiplayer system removed - using new industry-standard system

// Heartbeat functions removed - handled by NetworkManager

// Legacy multiplayer functions removed - using new industry-standard MultiplayerSystem

// Window resize handler

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
  networkManager,
  multiplayerSystem,
  getTerrainHeight,
  forestMeshes,
      initializeTerrainSeedLocal,
  initializeGame,
  connectWebSocket
};

// Industry Standard: Third-person camera setup
function setupThirdPersonCamera(playerMesh: THREE.Object3D) {
  // Industry Standard: Position camera behind and above player
  const offset = new THREE.Vector3(0, 8, 12); // Behind and above
  camera.position.copy(playerMesh.position).add(offset);
  camera.lookAt(playerMesh.position);
  
  // Industry Standard: Disable orbit controls for third-person view
  controls.enabled = false;
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.enablePan = false;
  
  console.log('[Camera] ✅ Third-person camera configured');
}

// Input is handled by the avatar system
