import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Scene dimensions
const FOREST_SIZE = 100;

// Initialize Three.js scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfd1e5); // Light blue sky

// Create a camera
const camera = new THREE.PerspectiveCamera(
  75, // Field of view
  window.innerWidth / window.innerHeight, // Aspect ratio
  0.1, // Near clipping plane
  1000 // Far clipping plane
);
camera.position.set(20, 30, 40);
camera.lookAt(0, 0, 0);

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Create orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
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

// Define interface for walnut data structure
interface Walnut {
  id: string;
  ownerId: string;
  origin: 'game' | 'player';
  hiddenIn: 'buried' | 'bush';
  location: {
    x: number;
    y: number;
    z: number;
  };
  found: boolean;
  timestamp: number;
}

// Array to store walnut data
let walnuts: Walnut[] = [];

// Fetch walnut map data from the backend
async function fetchWalnutMap() {
  try {
    const response = await fetch('/map-state');
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    walnuts = await response.json();
    console.log('Walnut map data loaded:', walnuts);
    
    return walnuts;
  } catch (error) {
    console.error('Failed to fetch walnut map data:', error);
    return [];
  }
}

// Load walnut data when the app starts
fetchWalnutMap();

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
  
  // Render scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();

// Export key objects for use in other functions
export { scene, camera, renderer, FOREST_SIZE, fetchWalnutMap, walnuts };
