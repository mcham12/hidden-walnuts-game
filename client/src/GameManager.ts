import * as THREE from 'three';
import { createTerrain } from './terrain';
import { createForest } from './forest';
import { loadSquirrelAvatar } from './avatar';
import { MultiplayerManager, type MultiplayerConfig } from './multiplayer';
import type { SquirrelAvatar } from './types';

export enum GameState {
  LOADING = 'loading',
  READY = 'ready',
  PLAYING = 'playing',
  ERROR = 'error'
}

export class GameManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private avatar: SquirrelAvatar | null = null;
  private multiplayerManager: MultiplayerManager | null = null;
  private state: GameState = GameState.LOADING;
  private config: MultiplayerConfig;

  constructor(config: MultiplayerConfig) {
    this.config = config;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
  }

  async initialize(): Promise<void> {
    try {
      this.showLoadingScreen();
      
      await this.setupRenderer();
      await this.setupLighting();
      await this.loadTerrain();
      await this.loadForest();
      await this.spawnPlayer();
      await this.initializeMultiplayer();
      
      this.state = GameState.READY;
      this.hideLoadingScreen();
      this.startGameLoop();
      
    } catch (error) {
      this.state = GameState.ERROR;
      this.handleInitializationError(error);
    }
  }

  private async setupRenderer(): Promise<void> {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);
  }

  private async setupLighting(): Promise<void> {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 500;
    const FOREST_SIZE = 100;
    directionalLight.shadow.camera.left = -FOREST_SIZE;
    directionalLight.shadow.camera.right = FOREST_SIZE;
    directionalLight.shadow.camera.top = FOREST_SIZE;
    directionalLight.shadow.camera.bottom = -FOREST_SIZE;
    this.scene.add(directionalLight);
  }

  private async loadTerrain(): Promise<void> {
    console.log('🏞️ Loading terrain...');
    const terrain = await createTerrain();
    this.scene.add(terrain);
    console.log('✅ Terrain loaded');
  }

  private async loadForest(): Promise<void> {
    console.log('🌲 Loading forest...');
    const forestMeshes = await createForest();
    forestMeshes.forEach(mesh => this.scene.add(mesh));
    console.log('✅ Forest loaded');
  }

  private async spawnPlayer(): Promise<void> {
    console.log('🐿️ Spawning player...');
    this.avatar = await loadSquirrelAvatar(this.scene);
    
    // Position camera relative to player
    this.camera.position.set(80, 62, 100);
    this.camera.lookAt(50, 2, 50);
    
    console.log('✅ Player spawned');
  }

  private async initializeMultiplayer(): Promise<void> {
    console.log('🌐 Initializing multiplayer...');
    
    if (!this.avatar) {
      throw new Error('Avatar must be loaded before multiplayer initialization');
    }

    this.multiplayerManager = new MultiplayerManager(
      this.config, 
      this.scene, 
      this.avatar.mesh
    );
    
    const authData = await this.multiplayerManager.initialize();
    
    // Update player position from server spawn data
    const pos = authData.position;
    if (this.isValidSpawnPosition(pos)) {
      this.avatar.mesh.position.set(pos.x, pos.y, pos.z);
      this.avatar.mesh.rotation.y = authData.rotationY;
      
      // Update camera to follow spawned position
      this.camera.position.set(pos.x + 30, pos.y + 60, pos.z + 50);
      this.camera.lookAt(pos.x, pos.y, pos.z);
    }
    
    console.log(`✅ Multiplayer connected as ${authData.squirrelId.substring(0, 8)}`);
  }

  private isValidSpawnPosition(pos: { x: number; y: number; z: number }): boolean {
    return pos.x >= -100 && pos.x <= 100 && 
           pos.z >= -100 && pos.z <= 100 && 
           pos.y >= 0 && pos.y <= 50;
  }

  private startGameLoop(): void {
    this.state = GameState.PLAYING;
    let lastTime = performance.now();

    const animate = () => {
      requestAnimationFrame(animate);

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      this.update(deltaTime);
      this.render();
    };

    animate();
  }

  private update(deltaTime: number): void {
    // Update multiplayer system
    if (this.multiplayerManager) {
      this.multiplayerManager.update(deltaTime);
    }

    // Update camera to follow player
    if (this.avatar) {
      this.updateCamera();
    }
  }

  private updateCamera(): void {
    if (!this.avatar) return;

    const mesh = this.avatar.mesh;
    const offsetDistance = 5;
    const offsetHeight = 3;
    
    const direction = new THREE.Vector3(
      Math.sin(mesh.rotation.y),
      0,
      Math.cos(mesh.rotation.y)
    );
    
    const cameraPosition = mesh.position.clone()
      .addScaledVector(direction, -offsetDistance)
      .setY(mesh.position.y + offsetHeight);
    
    this.camera.position.lerp(cameraPosition, 0.1);
    this.camera.lookAt(mesh.position);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private showLoadingScreen(): void {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-screen';
    loadingDiv.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #2c5530; color: white; display: flex;
      align-items: center; justify-content: center;
      font-family: Arial, sans-serif; font-size: 24px; z-index: 1000;
    `;
    loadingDiv.innerHTML = '🐿️ Loading Hidden Walnuts...';
    document.body.appendChild(loadingDiv);
  }

  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.remove();
    }
  }

  private handleInitializationError(error: any): void {
    console.error('❌ Game initialization failed:', error);
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #ff4444; color: white; padding: 20px; border-radius: 8px;
      font-family: Arial, sans-serif; text-align: center; z-index: 1001;
    `;
    errorDiv.innerHTML = `
      <h3>Game Failed to Load</h3>
      <p>${error.message || 'Unknown error'}</p>
      <button onclick="location.reload()">Retry</button>
    `;
    document.body.appendChild(errorDiv);
  }

  // Public getters for external access
  get gameState(): GameState { return this.state; }
  get gameScene(): THREE.Scene { return this.scene; }
  get gameCamera(): THREE.PerspectiveCamera { return this.camera; }
  get gameAvatar(): SquirrelAvatar | null { return this.avatar; }
} 