// Enterprise Game Composition Layer - Orchestrates all game systems
// AI NOTE: This follows SOLID principles and Dependency Inversion

import { container, ServiceTokens } from './core/Container';
import { EventBus } from './core/EventBus';
import { Logger, LogCategory } from './core/Logger';
import { EntityManager, Entity, PositionComponent, RotationComponent } from './ecs';
import { TerrainService } from './services/TerrainService';
import { PlayerFactory } from './entities/PlayerFactory';
import { InputSystem } from './systems/InputSystem';
import { MovementSystem } from './systems/MovementSystem';
import { ClientPredictionSystem } from './systems/ClientPredictionSystem';
import { NetworkSystem } from './systems/NetworkSystem';
import { PlayerManager } from './systems/PlayerManager';
import { MovementConfig, WorldBounds } from './core/types';
import { InterpolationSystem } from './systems/InterpolationSystem';
import { RenderSystem } from './systems/RenderSystem';
import { NetworkTickSystem } from './systems/NetworkTickSystem';
import { AreaOfInterestSystem } from './systems/AreaOfInterestSystem';
import { NetworkCompressionSystem } from './systems/NetworkCompressionSystem';
import { ThreeJSRenderAdapter } from './rendering/IRenderAdapter';

// Refactored InputManager with dependency injection
export interface IInputManager {
  getInputState(): {
    forward: boolean;
    backward: boolean;
    turnLeft: boolean;
    turnRight: boolean;
  };
  startListening(): void;
  stopListening(): void;
}

export class InputManager implements IInputManager {
  private keys = new Set<string>();

  constructor(private eventBus: EventBus) {
    // EventBus ready for future input events
    this.eventBus.subscribe('input.request_state', () => {
      const state = this.getInputState();
      this.eventBus.emit('input.state_response', state);
    });
  }

  startListening(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  stopListening(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.key.toLowerCase());
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };

  getInputState() {
    return {
      forward: this.keys.has('w'),
      backward: this.keys.has('s'),
      turnLeft: this.keys.has('a'),
      turnRight: this.keys.has('d')
    };
  }
}

// Scene Management - No longer a God Object
export interface ISceneManager {
  initialize(canvas: HTMLCanvasElement): Promise<void>;
  getScene(): import('three').Scene;
  getCamera(): import('three').PerspectiveCamera;
  getRenderer(): import('three').WebGLRenderer;
  loadTerrain(): Promise<void>;
  loadForest(): Promise<void>;
  updateCameraToFollowPlayer(playerPosition: { x: number; y: number; z: number }, playerRotation: { y: number }): void;
}

export class SceneManager implements ISceneManager {
  private scene!: import('three').Scene;
  private camera!: import('three').PerspectiveCamera;
  private renderer!: import('three').WebGLRenderer;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    const THREE = await import('three');
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

    // Camera setup - wider field of view and extended far plane
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      2000  // Extended to see the entire 200x200 terrain
    );
    
    // CHEN'S FIX: Set initial camera position (much higher up to see the entire forest)
    this.camera.position.set(0, 50, 50);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup with sky blue background
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue background
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    // CHEN'S DEBUG: Add a bright red cube at origin as reference point
    const debugGeometry = new THREE.BoxGeometry(5, 5, 5);
    const debugMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const debugCube = new THREE.Mesh(debugGeometry, debugMaterial);
    debugCube.position.set(0, 2.5, 0); // Slightly above ground
    this.scene.add(debugCube);

    this.eventBus.emit('scene.initialized', null);
  }

  async loadTerrain(): Promise<void> {
    // Import the terrain function (keeping backward compatibility)
    const { createTerrain } = await import('./terrain');
    const terrain = await createTerrain();
    this.scene.add(terrain);
    this.eventBus.emit('terrain.loaded');
  }

  async loadForest(): Promise<void> {
    // CHEN'S FIX: Load forest objects (trees and shrubs)
    const { Logger, LogCategory } = await import('./core/Logger');
    try {
      const { createForest } = await import('./forest');
      const forestObjects = await createForest();
      
      // Add all forest objects to the scene
      forestObjects.forEach(obj => this.scene.add(obj));
      
      Logger.info(LogCategory.TERRAIN, `Added ${forestObjects.length} forest objects to scene`);
      this.eventBus.emit('forest.loaded');
    } catch (error) {
      Logger.error(LogCategory.TERRAIN, 'Failed to load forest objects', error);
    }
  }

  getScene(): import('three').Scene { return this.scene; }
  getCamera(): import('three').PerspectiveCamera { return this.camera; }
  getRenderer(): import('three').WebGLRenderer { return this.renderer; }

  // CHEN'S FIX: Add camera follow functionality
  updateCameraToFollowPlayer(playerPosition: { x: number; y: number; z: number }, playerRotation: { y: number }): void {
    if (!this.camera) return;
    
    // Position camera behind and above the player
    const distance = 8;
    const height = 5;
    const angle = playerRotation.y;
    
    const cameraX = playerPosition.x - Math.sin(angle) * distance;
    const cameraZ = playerPosition.z - Math.cos(angle) * distance;
    const cameraY = playerPosition.y + height;
    
    // Smooth camera movement
    this.camera.position.lerp(
      { x: cameraX, y: cameraY, z: cameraZ } as any,
      0.1
    );
    
    // Look at the player
    this.camera.lookAt(playerPosition.x, playerPosition.y + 1, playerPosition.z);
  }
}

// Asset Management - Single Responsibility
export interface IAssetManager {
  loadSquirrelModel(): Promise<import('three').Group>;
  loadModel(path: string): Promise<any>;
}

export class AssetManager implements IAssetManager {
  private cache = new Map<string, any>();

  async loadSquirrelModel(): Promise<import('three').Group> {
    if (this.cache.has('squirrel')) {
      return this.cache.get('squirrel').clone();
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    
    const loader = new GLTFLoader();
    
    // CHEN'S FIX: Use correct asset path for both dev and production
    const assetPath = '/assets/models/squirrel.glb'; // Works in both dev and production
    
    return new Promise((resolve, reject) => {
      loader.load(
        assetPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.3);
          model.castShadow = true;
          model.receiveShadow = true;
          
          this.cache.set('squirrel', model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          Logger.error(LogCategory.CORE, `Failed to load squirrel model from ${assetPath}`, error);
          reject(error);
        }
      );
    });
  }

  // CHEN'S FIX: Add generic model loading method for other assets
  async loadModel(path: string): Promise<any> {
    if (this.cache.has(path)) {
      return this.cache.get(path).clone();
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          this.cache.set(path, gltf);
          resolve(gltf);
        },
        undefined,
        (error) => {
          Logger.error(LogCategory.CORE, `Failed to load model from ${path}`, error);
          reject(error);
        }
      );
    });
  }
}

// Simplified Game Manager - No longer a God Object!
export class GameManager {
  private entityManager: EntityManager;
  private sceneManager: ISceneManager;
  private inputManager: IInputManager;
  private eventBus: EventBus;
  private movementSystem: MovementSystem;
  private interpolationSystem: InterpolationSystem;
  private renderSystem: RenderSystem;
  private networkSystem: NetworkSystem;
  private networkTickSystem: NetworkTickSystem;
  private clientPredictionSystem: ClientPredictionSystem;
  private areaOfInterestSystem: AreaOfInterestSystem;
  private networkCompressionSystem: NetworkCompressionSystem;
  private playerManager: PlayerManager;
  private inputSystem: any; // CHEN'S FIX: Will be properly resolved
  private localPlayer?: Entity;
  private isRunning = false;
  private errorCount = 0;
  private maxErrors = 10;

  constructor() {
    // Get dependencies from container
    this.eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    this.entityManager = container.resolve<EntityManager>(ServiceTokens.ENTITY_MANAGER);
    this.sceneManager = container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER);
    this.inputManager = container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER);

    // Initialize all systems
    this.inputSystem = container.resolve(ServiceTokens.INPUT_SYSTEM);
    this.clientPredictionSystem = container.resolve(ServiceTokens.CLIENT_PREDICTION_SYSTEM);
    this.movementSystem = container.resolve(ServiceTokens.MOVEMENT_SYSTEM);
    this.networkSystem = container.resolve(ServiceTokens.NETWORK_SYSTEM);
    this.playerManager = container.resolve(ServiceTokens.PLAYER_MANAGER);

    // Initialize remaining systems (placeholders for now)
    this.interpolationSystem = new InterpolationSystem(this.eventBus);
    
    // RenderSystem needs a render adapter
    const renderAdapter = new ThreeJSRenderAdapter();
    this.renderSystem = new RenderSystem(this.eventBus, renderAdapter);
    
    this.networkTickSystem = new NetworkTickSystem(this.eventBus);
    this.areaOfInterestSystem = new AreaOfInterestSystem(this.eventBus);
    this.networkCompressionSystem = new NetworkCompressionSystem(this.eventBus);

    // Register all systems with EntityManager in correct execution order
    this.entityManager.addSystem(this.inputSystem);
    this.entityManager.addSystem(this.clientPredictionSystem);
    this.entityManager.addSystem(this.movementSystem);
    this.entityManager.addSystem(this.interpolationSystem);
    this.entityManager.addSystem(this.areaOfInterestSystem);
    this.entityManager.addSystem(this.renderSystem);
    this.entityManager.addSystem(this.networkCompressionSystem);
    this.entityManager.addSystem(this.networkTickSystem);
    this.entityManager.addSystem(this.networkSystem);
    this.entityManager.addSystem(this.playerManager);

    Logger.info(LogCategory.CORE, '🎮 GameManager initialized with 10 systems');
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, '🎯 Starting game initialization...');

      // 1. Initialize terrain service early
      const terrainService = container.resolve(ServiceTokens.TERRAIN_SERVICE) as any;
      await terrainService.initialize();

      // 2. Initialize scene
      await this.sceneManager.initialize(canvas);
      await this.sceneManager.loadTerrain();
      await this.sceneManager.loadForest();
      
      // 3. Wait for scene readiness
      await this.waitForSceneReady();
      
      // 4. Create local player
      await this.createLocalPlayer();
      Logger.info(LogCategory.PLAYER, `🎮 Local player created: ${this.localPlayer?.id.value}`);
      
      // 5. Start input listening
      this.inputManager.startListening();
      Logger.info(LogCategory.INPUT, '🎮 Input listening started - WASD controls active!');
      
      // 6. Connect to multiplayer after scene is ready
      Logger.info(LogCategory.NETWORK, '🌐 Attempting multiplayer connection...');
      try {
        await this.networkSystem.connect();
        Logger.info(LogCategory.NETWORK, '✅ Multiplayer connection established');
      } catch (networkError) {
        Logger.warn(LogCategory.NETWORK, '⚠️ Multiplayer connection failed, continuing in single-player mode', networkError);
      }

      // Emit initialization complete
      this.eventBus.emit('game.initialized');
      Logger.info(LogCategory.CORE, '🚀 Game initialization complete!');
      
    } catch (error) {
      Logger.error(LogCategory.CORE, '💥 Game initialization failed:', error);
      throw error;
    }
  }

  private async waitForSceneReady(): Promise<void> {
    return new Promise((resolve) => {
      const checkScene = () => {
        const scene = this.sceneManager.getScene();
        const renderer = this.sceneManager.getRenderer();
        
        if (scene && renderer && renderer.domElement) {
          Logger.debug(LogCategory.RENDER, '✅ Scene fully ready for entities');
          resolve();
        } else {
          Logger.warn(LogCategory.RENDER, '⏳ Waiting for scene readiness...');
          setTimeout(checkScene, 10);
        }
      };
      checkScene();
    });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.inputManager.stopListening();
  }

  private async createLocalPlayer(): Promise<void> {
    const playerFactory = container.resolve(ServiceTokens.PLAYER_FACTORY) as any;
    
    // Generate a unique player ID
    const playerId = `player-${crypto.randomUUID()}`;
    this.localPlayer = await playerFactory.createLocalPlayer(playerId);
    
    if (this.localPlayer) {
      Logger.info(LogCategory.PLAYER, '🐿️ Local player created with ID:', this.localPlayer.id.value);
      this.entityManager.addEntity(this.localPlayer);
    }
  }

  // CHEN'S FIX: Error boundaries and crash recovery like Unity
  private lastErrorTime = 0;
  private static readonly ERROR_RECOVERY_DELAY = 1000; // 1 second
  
  // CHEN'S FIX: Variable timestep with frame drop protection
  private lastFrameTime = 0;
  private static readonly MAX_DELTA_TIME = 1/30; // Cap at 30fps for consistency
  private static readonly TARGET_DELTA_TIME = 1/60; // 60fps target

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    try {
      // CHEN'S FIX: Variable timestep with frame drop protection
      const now = performance.now();
      let deltaTime = this.lastFrameTime === 0 ? GameManager.TARGET_DELTA_TIME : (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      
      // Cap deltaTime to prevent spiral of death on frame drops
      deltaTime = Math.min(deltaTime, GameManager.MAX_DELTA_TIME);
      
      // CHEN'S FIX: Protected ECS system updates
      this.safeSystemUpdate(deltaTime);
      
      // CHEN'S FIX: Protected rendering
      this.safeRender();
      
      // Reset error count if we've been stable
      const currentTime = performance.now();
      if (currentTime - this.lastErrorTime > GameManager.ERROR_RECOVERY_DELAY) {
        this.errorCount = 0;
      }
      
    } catch (error) {
      this.handleGameLoopError(error);
    }

    // Continue game loop even after errors (with throttling)
    requestAnimationFrame(this.gameLoop);
  };

  private safeSystemUpdate(deltaTime: number): void {
    try {
      this.entityManager.update(deltaTime);
    } catch (error) {
      Logger.error(LogCategory.ECS, '🚨 [GameLoop] ECS System update failed:', error);
      
      // Try to identify which system failed
      if (error instanceof Error && error.stack) {
        const systemMatch = error.stack.match(/(\w+System)\.update/);
        if (systemMatch) {
          Logger.error(LogCategory.ECS, '🎯 [GameLoop] Failed system:', systemMatch[1]);
        }
      }
      
      throw error; // Re-throw to trigger recovery
    }
  }

  private safeRender(): void {
    try {
      const renderer = this.sceneManager.getRenderer();
      const scene = this.sceneManager.getScene();
      const camera = this.sceneManager.getCamera();
      
      if (!renderer || !scene || !camera) {
        Logger.warn(LogCategory.RENDER, '⚠️ [GameLoop] Render components not ready, skipping frame');
        return;
      }
      
      // CHEN'S FIX: Update camera to follow local player
      this.updateCameraToFollowLocalPlayer();
      
      renderer.render(scene, camera);
    } catch (error) {
      Logger.error(LogCategory.RENDER, '🚨 [GameLoop] Render failed:', error);
      throw error;
    }
  }

  private updateCameraToFollowLocalPlayer(): void {
    if (!this.localPlayer) return;
    
    const position = this.localPlayer.getComponent<PositionComponent>('position');
    const rotation = this.localPlayer.getComponent<RotationComponent>('rotation');
    
    if (position && rotation) {
      this.sceneManager.updateCameraToFollowPlayer(
        { x: position.value.x, y: position.value.y, z: position.value.z },
        { y: rotation.value.y }
      );
    }
  }

  private handleGameLoopError(error: any): void {
    const now = performance.now();
    this.errorCount++;
    this.lastErrorTime = now;
    
         Logger.error(LogCategory.ECS, `Game loop error #${this.errorCount}`, error);
    
    // Circuit breaker pattern - stop if too many errors
    if (this.errorCount >= this.maxErrors) {
      Logger.error(LogCategory.CORE, '💥 [GameLoop] Too many errors, initiating emergency stop!');
      this.emergencyStop();
      return;
    }
    
    // Attempt graceful recovery
    this.attemptRecovery();
  }

  private attemptRecovery(): void {
    Logger.debug(LogCategory.CORE, '🔧 [GameLoop] Attempting system recovery...');
    
    try {
      // Try to reinitialize critical systems
      const renderer = this.sceneManager.getRenderer();
      if (renderer) {
        renderer.setSize(renderer.domElement.width, renderer.domElement.height);
      }
      
      Logger.info(LogCategory.CORE, '✅ [GameLoop] Recovery successful');
    } catch (recoveryError) {
      Logger.error(LogCategory.CORE, '💥 [GameLoop] Recovery failed:', recoveryError);
    }
  }

  private emergencyStop(): void {
    this.isRunning = false;
    this.inputManager.stopListening();
    
    // Stop network timer to prevent further errors
    if (this.networkTickSystem && typeof this.networkTickSystem.stopNetworkTimer === 'function') {
      this.networkTickSystem.stopNetworkTimer();
    }
    
    // Show error UI
    this.showErrorUI();
  }

  private showErrorUI(): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #ff4444; color: white; padding: 20px; border-radius: 10px;
      font-family: monospace; font-size: 14px; text-align: center; z-index: 9999;
    `;
    errorDiv.innerHTML = `
      <h3>🚨 Game Error</h3>
      <p>The game encountered critical errors and has stopped.</p>
      <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px;">
        Restart Game
      </button>
    `;
    document.body.appendChild(errorDiv);
  }

  // Public getters for debug UI access
  public getEventBus(): EventBus { return this.eventBus; }
  public getPlayerManager(): PlayerManager { return this.playerManager; }
  public getNetworkSystem(): NetworkSystem { return this.networkSystem; }
  public getLocalPlayer(): Entity | undefined { return this.localPlayer; }
}

// Configuration and setup
export function configureServices(): void {
  // Register all services with proper dependency injection
  container.registerSingleton(ServiceTokens.EVENT_BUS, () => new EventBus());
  
  container.registerSingleton(ServiceTokens.ENTITY_MANAGER, () => 
    new EntityManager(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.SCENE_MANAGER, () => 
    new SceneManager(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.INPUT_MANAGER, () => 
    new InputManager(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.ASSET_MANAGER, () => new AssetManager());

  container.registerSingleton(ServiceTokens.TERRAIN_SERVICE, () => {
    return new TerrainService();
  });

  container.registerSingleton(ServiceTokens.PLAYER_FACTORY, () => {
    return new PlayerFactory(
      container.resolve(ServiceTokens.SCENE_MANAGER),
      container.resolve(ServiceTokens.ASSET_MANAGER),
      container.resolve(ServiceTokens.ENTITY_MANAGER),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  // Register systems with proper dependencies
  container.registerSingleton(ServiceTokens.INPUT_SYSTEM, () => {
    return new InputSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER)
    );
  });

  container.registerSingleton(ServiceTokens.MOVEMENT_SYSTEM, () => {
    return new MovementSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      MovementConfig.default(),
      WorldBounds.default(),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  container.registerSingleton(ServiceTokens.CLIENT_PREDICTION_SYSTEM, () => {
    return new ClientPredictionSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve<InputManager>(ServiceTokens.INPUT_MANAGER),
      MovementConfig.default(),
      WorldBounds.default(),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  container.registerSingleton(ServiceTokens.NETWORK_SYSTEM, () => {
    return new NetworkSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS));
  });

  container.registerSingleton(ServiceTokens.PLAYER_MANAGER, () => {
    return new PlayerManager(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  Logger.info(LogCategory.CORE, '🏗️ All services configured successfully');
} 