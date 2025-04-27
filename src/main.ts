import * as THREE from 'three';
import { WebGLRenderer } from 'three';
import { ForestScene } from './game/scenes/ForestScene';
import { SquirrelIdManager } from './game/player/SquirrelIdManager';
import { PlayerController } from './game/player/PlayerController';
import { PlayerState } from './game/player/PlayerState';
import { WalnutEntity, WalnutType } from './game/entities/WalnutEntity';
import { AssetManager } from './engine/assets/AssetManager';
import { Vector3 } from 'three';

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
let playerController: PlayerController | undefined = undefined;

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

const playerState = new PlayerState();
const assetManager = new AssetManager();
let walnuts: WalnutEntity[] = [];

// UI for hiding
let hidePrompt: HTMLDivElement | null = null;
function showHidePrompt() {
  if (!hidePrompt) {
    hidePrompt = document.createElement('div');
    hidePrompt.style.position = 'fixed';
    hidePrompt.style.bottom = '32px';
    hidePrompt.style.left = '50%';
    hidePrompt.style.transform = 'translateX(-50%)';
    hidePrompt.style.background = 'rgba(255,255,255,0.9)';
    hidePrompt.style.padding = '10px 24px';
    hidePrompt.style.borderRadius = '8px';
    hidePrompt.style.fontFamily = 'sans-serif';
    hidePrompt.style.fontSize = '20px';
    hidePrompt.style.zIndex = '1000';
    document.body.appendChild(hidePrompt);
  }
  hidePrompt.textContent = 'Press H to hide a walnut';
  hidePrompt.style.display = 'block';
}
function hideHidePrompt() {
  if (hidePrompt) hidePrompt.style.display = 'none';
}

// UI for walnuts left
let walnutCountOverlay: HTMLDivElement | null = null;
function updateWalnutCountUI() {
  if (!walnutCountOverlay) {
    walnutCountOverlay = document.createElement('div');
    walnutCountOverlay.style.position = 'fixed';
    walnutCountOverlay.style.top = '56px';
    walnutCountOverlay.style.left = '16px';
    walnutCountOverlay.style.background = 'rgba(255,255,255,0.85)';
    walnutCountOverlay.style.padding = '8px 16px';
    walnutCountOverlay.style.borderRadius = '8px';
    walnutCountOverlay.style.fontFamily = 'sans-serif';
    walnutCountOverlay.style.fontSize = '18px';
    walnutCountOverlay.style.zIndex = '1000';
    document.body.appendChild(walnutCountOverlay);
  }
  walnutCountOverlay.textContent = `Walnuts left to hide: ${playerState.walnutsToHide}`;
}

// Handle hiding mechanic
window.addEventListener('keydown', async (e) => {
  if (e.key.toLowerCase() === 'h' && playerState.hasWalnutsToHide() && forestScene.isReady) {
    // Prompt for bury or bush
    const type = await promptWalnutType();
    if (!type) return;
    // Place walnut at squirrel position
    const squirrel = forestScene.getSquirrel();
    if (squirrel) {
      const walnut = new WalnutEntity(squirrelId, type, new Vector3().copy(squirrel.position), assetManager);
      walnuts.push(walnut);
      forestScene.scene.add(walnut);
      playerState.decrementWalnutsToHide();
      updateWalnutCountUI();
      if (!playerState.hasWalnutsToHide()) hideHidePrompt();
    }
  }
});

function promptWalnutType(): Promise<WalnutType | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0,0,0,0.3)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '2000';
    const box = document.createElement('div');
    box.style.background = 'white';
    box.style.padding = '32px 48px';
    box.style.borderRadius = '12px';
    box.style.fontFamily = 'sans-serif';
    box.style.fontSize = '22px';
    box.textContent = 'Choose how to hide your walnut:';
    const buryBtn = document.createElement('button');
    buryBtn.textContent = 'Bury';
    buryBtn.style.margin = '16px';
    const bushBtn = document.createElement('button');
    bushBtn.textContent = 'Bush';
    bushBtn.style.margin = '16px';
    box.appendChild(document.createElement('br'));
    box.appendChild(buryBtn);
    box.appendChild(bushBtn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    buryBtn.onclick = () => { document.body.removeChild(overlay); resolve('bury'); };
    bushBtn.onclick = () => { document.body.removeChild(overlay); resolve('bush'); };
    overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } };
  });
}

// Show UI on load
updateWalnutCountUI();
if (playerState.hasWalnutsToHide()) showHidePrompt();

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  if (forestScene.isReady) {
    if (!playerController) {
      const squirrel = forestScene.getSquirrel();
      if (squirrel) {
        playerController = new PlayerController(squirrel);
      }
    }
    if (playerController) {
      playerController.update();
      // Camera follow (third-person)
      const squirrel = forestScene.getSquirrel();
      if (squirrel) {
        const camOffset = { x: 0, y: 8, z: 16 };
        forestScene.camera.position.set(
          squirrel.position.x + camOffset.x,
          squirrel.position.y + camOffset.y,
          squirrel.position.z + camOffset.z
        );
        forestScene.camera.lookAt(squirrel.position);
      }
    }
    forestScene.render();
  }
}
animate(); 