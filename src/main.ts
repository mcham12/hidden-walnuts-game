import * as THREE from 'three';
import { WebGLRenderer } from 'three';
import { ForestScene } from './game/scenes/ForestScene';
import { SquirrelIdManager } from './game/player/SquirrelIdManager';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

// Create the forest scene
const forestScene = new ForestScene(renderer);

// Squirrel ID management
const squirrelIdManager = new SquirrelIdManager();
const squirrelId = squirrelIdManager.getId();

// Display Squirrel ID in a simple UI overlay
displaySquirrelId(squirrelId);

function displaySquirrelId(id: string) {
  let overlay = document.getElementById('squirrel-id-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'squirrel-id-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '16px';
    overlay.style.left = '16px';
    overlay.style.background = 'rgba(255,255,255,0.85)';
    overlay.style.padding = '8px 16px';
    overlay.style.borderRadius = '8px';
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.fontSize = '18px';
    overlay.style.zIndex = '1000';
    document.body.appendChild(overlay);
  }
  overlay.textContent = `Squirrel ID: ${id}`;
}

function animate() {
  requestAnimationFrame(animate);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  forestScene.render();
}
animate(); 