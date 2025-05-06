import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { showRehiddenNotification } from './ui'
import { connectToWebSocket, getLocalSquirrelId, setDebugMessages, walnutMap } from './ws'

// Expose WebSocket functions globally for development testing
(window as any).connectToWebSocket = connectToWebSocket;
(window as any).getLocalSquirrelId = getLocalSquirrelId;

// Scene dimensions
const FOREST_SIZE = 100

// Get the app container
const appContainer = document.getElementById('app')
if (!appContainer) {
  throw new Error('No #app element found in the DOM')
}

// Global variables
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let ws: WebSocket | null = null;
let showDebugMessages = false;

// UI elements for notifications
const notificationContainer = document.createElement('div');
notificationContainer.style.position = 'fixed';
notificationContainer.style.top = '20px';
notificationContainer.style.right = '20px';
notificationContainer.style.zIndex = '1000';
appContainer.appendChild(notificationContainer);

// Debug UI toggle
const debugToggle = document.createElement('button');
debugToggle.textContent = 'Toggle Debug Messages';
debugToggle.style.position = 'fixed';
debugToggle.style.bottom = '20px';
debugToggle.style.right = '20px';
debugToggle.style.zIndex = '1000';
appContainer.appendChild(debugToggle);

// Initialize the scene and all components
function init() {
  // Initialize Three.js scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfd1e5); // Light blue sky

  // Create a camera
  camera = new THREE.PerspectiveCamera(
    75, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    0.1, // Near clipping plane
    1000 // Far clipping plane
  );
  camera.position.set(20, 30, 40);
  camera.lookAt(0, 0, 0);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  appContainer.appendChild(renderer.domElement);

  // Create orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera from going below the ground

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -FOREST_SIZE;
  directionalLight.shadow.camera.right = FOREST_SIZE;
  directionalLight.shadow.camera.top = FOREST_SIZE;
  directionalLight.shadow.camera.bottom = -FOREST_SIZE;
  scene.add(directionalLight);

  // Create a plane for the forest floor
  const floorGeometry = new THREE.PlaneGeometry(FOREST_SIZE * 2, FOREST_SIZE * 2);
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a8335, // Green
    roughness: 0.8, 
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
  floor.receiveShadow = true;
  scene.add(floor);

  // Add simple axes for reference during development
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Spawn test walnut after scene setup
  spawnTestWalnut(scene);

  // Initialize WebSocket connection
  ws = connectToWebSocket(crypto.randomUUID());

  // Set up debug toggle
  debugToggle.onclick = () => {
    showDebugMessages = !showDebugMessages;
    debugToggle.textContent = showDebugMessages ? 'Hide Debug Messages' : 'Show Debug Messages';
    setDebugMessages(showDebugMessages);
  };

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Start animation loop
  animate();
}

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
  mesh.position.set(
    walnut.location.x,
    WALNUT_CONFIG.height[hidingMethod], // Use height based on hiding method
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
  const buriedCount = Array.from(walnutMeshes.values())
    .filter(mesh => mesh.userData.hiddenIn === 'buried').length;
  const bushCount = Array.from(walnutMeshes.values())
    .filter(mesh => mesh.userData.hiddenIn === 'bush').length;
    
  console.log(`Rendered ${walnutMeshes.size} walnuts: ${buriedCount} buried, ${bushCount} in bushes`);
}

// Fetch walnut map data from the backend
async function fetchWalnutMap() {
  try {
    const response = await fetch('/map-state');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    walnuts = await response.json();
    console.log('Walnut map data loaded:', walnuts);
    
    // Render the walnuts once data is loaded
    renderWalnuts(walnuts);
    
    return walnuts;
  } catch (error) {
    console.error('Failed to fetch walnut map data:', error);
    
    // For development/testing: create some demo walnuts if fetch fails
    createDemoWalnuts();
    
    return [];
  }
}

// Create some demo walnuts for testing when offline
function createDemoWalnuts() {
  const demoWalnuts: Walnut[] = [];
  
  // Create 20 random walnuts
  for (let i = 0; i < 20; i++) {
    const isGameWalnut = Math.random() > 0.5;
    
    // For demo purposes, leave some walnuts with undefined hiddenIn
    let hiddenIn: 'buried' | 'bush' | undefined;
    const randomValue = Math.random();
    
    if (randomValue < 0.4) {
      hiddenIn = 'buried';
    } else if (randomValue < 0.8) {
      hiddenIn = 'bush';
    } else {
      // Leave hiddenIn undefined for 20% of walnuts to test our handling
      hiddenIn = undefined;
    }
    
    demoWalnuts.push({
      id: `demo-${i}`,
      ownerId: isGameWalnut ? 'system' : 'demo-player',
      origin: isGameWalnut ? 'game' : 'player',
      hiddenIn: hiddenIn,
      location: {
        x: (Math.random() - 0.5) * FOREST_SIZE,
        y: 0,
        z: (Math.random() - 0.5) * FOREST_SIZE
      },
      found: false,
      timestamp: Date.now()
    });
  }
  
  walnuts = demoWalnuts;
  renderWalnuts(demoWalnuts);
  console.log('Created demo walnuts:', demoWalnuts);
}

// Load walnut data when the app starts
fetchWalnutMap();

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

// Show notification message
function showNotification(message: string, duration: number = 3000) {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '5px';
  notification.style.marginBottom = '10px';
  notification.style.transition = 'opacity 0.3s';
  
  notificationContainer.appendChild(notification);
  
  // Fade out and remove after duration
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Update walnut position in the scene
function updateWalnutPosition(id: string, position: { x: number; y: number; z: number }) {
  const walnut = walnutMeshes.get(id);
  if (!walnut) {
    console.warn("[updateWalnutPosition] No walnut found with id:", id);
    return;
  }
  
  // Animate the position change
  const startPosition = walnut.position.clone();
  const endPosition = new THREE.Vector3(position.x, position.y, position.z);
  
  // Create animation
  const duration = 1000; // 1 second
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Ease in-out function
    const easeProgress = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    walnut.position.lerpVectors(startPosition, endPosition, easeProgress);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      console.log(`[updateWalnutPosition] Moved walnut ${id} to`, position);
    }
  }
  
  animate();
}

// Spawn a test walnut in the scene
export function spawnTestWalnut(scene: THREE.Scene) {
  const testWalnut = new THREE.Mesh(
    new THREE.SphereGeometry(0.2),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
  testWalnut.position.set(0, 0, 0);
  scene.add(testWalnut);

  walnutMap.set("test-walnut", testWalnut);

  console.log("[spawnTestWalnut] Test walnut added to scene and walnutMap");
}

// Initialize the application
init();

// Export key objects for use in other functions
export {
  scene,
  camera,
  renderer,
  controls,
  walnuts,
  walnutMeshes,
  getHidingMethod, 
  createWalnutMaterial,
  updateWalnutPosition,
  ws as socket
};
