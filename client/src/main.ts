import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createTerrain } from './terrain'

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
// eslint-disable-next-line no-console
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);

// Unified API base URL logic with enhanced error handling
let API_BASE: string;
try {
  if (!import.meta.env.VITE_API_URL) {
    console.error('%c❌ VITE_API_URL is not set!', 'color: red; font-weight: bold;');
    throw new Error("VITE_API_URL must be set!");
  }
  API_BASE = import.meta.env.VITE_API_URL;

  // Validate API_BASE URL format
  new URL(API_BASE);
  
  // Debug: Log the final API base URL
  console.log('%c🌐 Using API base URL:', 'font-weight: bold;', API_BASE);
} catch (error) {
  console.error('%c❌ Error setting up API base URL:', 'color: red; font-weight: bold;', error);
  throw error;
}

// Export API_BASE for use in other modules
export { API_BASE };

// Scene dimensions
const FOREST_SIZE = 100

// Get the app container
const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('No #app element found in the DOM')
}

// Initialize Three.js scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd1e5) // Light blue sky

// Create a camera
const camera = new THREE.PerspectiveCamera(
  75, // Field of view
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
)
camera.position.set(20, 50, 40)
camera.lookAt(0, 0, 0)

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
appContainer.appendChild(renderer.domElement) // Append to #app instead of body

// Create orbit controls
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.maxPolarAngle = Math.PI / 2 - 0.1 // Prevent camera from going below the ground

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

// Terrain setup
let terrain: THREE.Mesh;
createTerrain().then((mesh) => {
  terrain = mesh;
  scene.add(terrain);
  console.log('Terrain added to scene');
  // Fetch and render walnuts after terrain is loaded
  fetchWalnutMap();
});

// Add simple axes for reference during development
const axesHelper = new THREE.AxesHelper(5)
scene.add(axesHelper)

// Define interface for walnut data structure
interface Walnut {
  id: string
  ownerId: string
  origin: 'game' | 'player'
  hiddenIn?: 'buried' | 'bush'  // Make hiddenIn optional as it could be undefined
  location: {
    x: number
    y: number
    z: number
  }
  found: boolean
  timestamp: number
}

// Walnut visualization config - enhanced for Task 5.5
const WALNUT_CONFIG = {
  radius: 0.5,
  segments: 16,
  colors: {
    buried: 0x8B4513,    // Updated to the specified brown color
    bush: 0x228B22,      // Updated to the specified green color
    origin: {
      game: 0xffd700,    // Gold tint for game walnuts
      player: 0xb87333   // Copper tint for player walnuts
    }
  },
  height: {
    buried: 0.2,         // Buried walnuts are lower to the ground
    bush: 0.8            // Bush walnuts are higher (as if in a bush)
  }
}

// Store all walnut meshes for later reference
const walnutMeshes = new Map<string, THREE.Mesh>()

// Array to store walnut data
let walnuts: Walnut[] = []

// Walnut mesh map
let walnutMap: Record<string, THREE.Mesh> = {};

// Helper function to determine the hiding method for a walnut
function getHidingMethod(walnut: Walnut): 'buried' | 'bush' {
  // If hiddenIn is defined, use it
  if (walnut.hiddenIn) {
    return walnut.hiddenIn;
  }
  
  // If undefined (e.g., game-hidden walnuts), assign randomly for now
  // In the future, this will be replaced with spatial logic based on proximity to bushes
  return Math.random() > 0.5 ? 'buried' : 'bush';
}

// Helper function to create material for a walnut based on its properties
function createWalnutMaterial(walnut: Walnut, hidingMethod: 'buried' | 'bush'): THREE.Material {
  // Get the base color based on hiding method
  const baseColor = WALNUT_CONFIG.colors[hidingMethod];
  
  // Create the material with appropriate properties
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: hidingMethod === 'buried' ? 0.9 : 0.7, // Buried walnuts are rougher
    metalness: walnut.origin === 'game' ? 0.5 : 0.2,  // Game walnuts are more shiny
    // Add slight emissive glow to game walnuts to make them more noticeable
    emissive: walnut.origin === 'game' ? new THREE.Color(0x331100) : new THREE.Color(0x000000),
    emissiveIntensity: walnut.origin === 'game' ? 0.2 : 0
  });
}

// Helper function to get terrain height at x, z coordinates
function getTerrainHeight(x: number, z: number): number {
  if (!terrain || !terrain.geometry) return 0;
  const geometry = terrain.geometry as THREE.PlaneGeometry;
  const vertices = geometry.attributes.position.array;
  const size = 200; // TERRAIN_SIZE
  const segments = 200;

  // Normalize x, z to terrain coordinates (-size/2 to size/2)
  const xNorm = (x + size / 2) / size * segments;
  const zNorm = (z + size / 2) / size * segments;
  const x0 = Math.floor(xNorm);
  const z0 = Math.floor(zNorm);
  const x1 = Math.min(x0 + 1, segments);
  const z1 = Math.min(z0 + 1, segments);

  // Ensure indices are within bounds
  if (x0 < 0 || x0 >= segments || z0 < 0 || z0 >= segments) return 0;

  // Get vertex indices
  const index00 = (z0 * (segments + 1) + x0) * 3;
  const index01 = (z0 * (segments + 1) + x1) * 3;
  const index10 = (z1 * (segments + 1) + x0) * 3;
  const index11 = (z1 * (segments + 1) + x1) * 3;

  // Get heights at four corners
  const h00 = vertices[index00 + 2] || 0;
  const h01 = vertices[index01 + 2] || 0;
  const h10 = vertices[index10 + 2] || 0;
  const h11 = vertices[index11 + 2] || 0;

  // Bilinear interpolation
  const tx = xNorm - x0;
  const tz = zNorm - z0;
  const h0 = h00 + (h01 - h00) * tx;
  const h1 = h10 + (h11 - h10) * tx;
  return h0 + (h1 - h0) * tz;
}

// Create a 3D sphere to represent a walnut
function createWalnutMesh(walnut: Walnut): THREE.Mesh {
  // Determine hiding method (handles undefined case)
  const hidingMethod = getHidingMethod(walnut);
  
  // Create geometry - small sphere for walnut
  const geometry = new THREE.SphereGeometry(
    WALNUT_CONFIG.radius, 
    WALNUT_CONFIG.segments, 
    WALNUT_CONFIG.segments
  );
  
  // Get material using the helper function
  const material = createWalnutMaterial(walnut, hidingMethod);
  
  // Create mesh and position it
  const mesh = new THREE.Mesh(geometry, material);
  let terrainHeight = getTerrainHeight(walnut.location.x, walnut.location.z);
  if (terrainHeight <= 0) {
    terrainHeight = 5; // Fallback to ensure visibility
    console.warn(`Invalid terrain height at (${walnut.location.x}, ${walnut.location.z}), using fallback y=5`);
  }
  const yPosition = terrainHeight + WALNUT_CONFIG.height[hidingMethod];
  console.log(`Walnut ${walnut.id}: terrainHeight=${terrainHeight}, yPosition=${yPosition}`);
  mesh.position.set(
    walnut.location.x,
    yPosition, // Terrain height + offset
    walnut.location.z
  );
  
  // Enable shadows
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // Add custom properties for later reference
  mesh.userData = {
    walnutId: walnut.id,
    hiddenIn: hidingMethod,
    origin: walnut.origin,
    ownerId: walnut.ownerId
  };
  
  return mesh;
}

// Render all walnuts in the scene
function renderWalnuts(walnutData: Walnut[]): void {
  // Clear any existing walnut meshes
  walnutMeshes.forEach(mesh => {
    scene.remove(mesh);
  });
  walnutMeshes.clear();
  
  // Create and add new meshes
  walnutData.forEach(walnut => {
    if (!walnut.found) { // Only render unfound walnuts
      const mesh = createWalnutMesh(walnut);
      scene.add(mesh);
      walnutMeshes.set(walnut.id, mesh);
    }
  });
  
  // Count and log walnuts by type for debugging
  // const buriedCount = Array.from(walnutMeshes.values())
  //   .filter(mesh => mesh.userData.hiddenIn === 'buried').length;
  // const bushCount = Array.from(walnutMeshes.values())
  //   .filter(mesh => mesh.userData.hiddenIn === 'bush').length;
    
  // console.log(`Rendered ${walnutMeshes.size} walnuts: ${buriedCount} buried, ${bushCount} in bushes`);
}

// Fetch walnut map data from the backend
async function fetchWalnutMap() {
  try {
    const response = await fetch(`${API_BASE}/map-state`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    walnuts = await response.json();
    // Only render walnuts if we haven't received them via WebSocket yet
    if (Object.keys(walnutMap).length === 0) {
      renderWalnuts(walnuts);
    }
    return walnuts;
  } catch (error) {
    console.error('Failed to fetch walnut map data:', error);
    return [];
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls
  controls.update();
  
  // Add subtle walnut rotation
  walnutMeshes.forEach(mesh => {
    mesh.rotation.y += 0.002; // Very slow rotation for visual interest
  });
  
  // Render scene
  renderer.render(scene, camera);
}

// Start animation loop
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
    for (const walnut of mapState) {
      if (!walnut.found) {
        const mesh = createWalnutMesh(walnut);
        scene.add(mesh);
        walnutMap[walnut.id] = mesh;
        walnutMeshes.set(walnut.id, mesh);
        console.log(`Added walnut ${walnut.id} to scene after map_reset`);
      }
    }
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
  getTerrainHeight // Add for future use
};
