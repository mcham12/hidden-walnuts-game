// Composition Root - Where A++ architecture comes together

import { container, ServiceTokens } from './core/Container';
import { EventBus } from './core/EventBus';
import { EntityManager, Entity } from './ecs';
import { MovementSystem } from './systems/MovementSystem';
import { InterpolationSystem } from './systems/InterpolationSystem';
import { RenderSystem } from './systems/RenderSystem';
import { NetworkSystem } from './systems/NetworkSystem';
import { PlayerManager } from './systems/PlayerManager';
import { NetworkTickSystem } from './systems/NetworkTickSystem';
import { ClientPredictionSystem } from './systems/ClientPredictionSystem';
import { AreaOfInterestSystem } from './systems/AreaOfInterestSystem';
import { NetworkCompressionSystem } from './systems/NetworkCompressionSystem';
import { MovementConfig, WorldBounds } from './core/types';
import { Logger, LogCategory } from './core/Logger';
import { ThreeJSRenderAdapter } from './rendering/IRenderAdapter';
import { InputSystem } from './systems/InputSystem';
import { TerrainService } from './services/TerrainService';
import { PlayerFactory } from './entities/PlayerFactory';

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

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
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

    this.eventBus.emit('scene.initialized', null);
  }

  async loadTerrain(): Promise<void> {
    // Import the terrain function (keeping backward compatibility)
    const { createTerrain } = await import('./terrain');
    const terrain = await createTerrain();
    this.scene.add(terrain);
    this.eventBus.emit('terrain.loaded');
  }

  getScene(): import('three').Scene { return this.scene; }
  getCamera(): import('three').PerspectiveCamera { return this.camera; }
  getRenderer(): import('three').WebGLRenderer { return this.renderer; }
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
    const assetPath = import.meta.env.PROD 
      ? '/assets/models/squirrel.glb'      // Production path
      : '/public/assets/models/squirrel.glb'; // Development path
    
    return new Promise((resolve, reject) => {
      loader.load(
        assetPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.5);
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
    // All dependencies injected, not created
    this.eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    this.entityManager = container.resolve<EntityManager>(ServiceTokens.ENTITY_MANAGER);
    this.sceneManager = container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER);
    this.inputManager = container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER);
    this.movementSystem = container.resolve<MovementSystem>(ServiceTokens.MOVEMENT_SYSTEM);
    this.interpolationSystem = container.resolve<InterpolationSystem>(ServiceTokens.INTERPOLATION_SYSTEM);
    this.renderSystem = container.resolve<RenderSystem>(ServiceTokens.RENDER_SYSTEM);
    this.networkSystem = container.resolve<NetworkSystem>(ServiceTokens.NETWORK_SYSTEM);
    this.networkTickSystem = container.resolve<NetworkTickSystem>(ServiceTokens.NETWORK_TICK_SYSTEM);
    this.clientPredictionSystem = container.resolve<ClientPredictionSystem>(ServiceTokens.CLIENT_PREDICTION_SYSTEM);
    this.areaOfInterestSystem = container.resolve<AreaOfInterestSystem>(ServiceTokens.AREA_OF_INTEREST_SYSTEM);
    this.networkCompressionSystem = container.resolve<NetworkCompressionSystem>(ServiceTokens.NETWORK_COMPRESSION_SYSTEM);
    this.playerManager = container.resolve<PlayerManager>(ServiceTokens.PLAYER_MANAGER);
    
    // CHEN'S FIX: Properly resolve InputSystem to prevent undefined reference
    this.inputSystem = container.resolve(ServiceTokens.INPUT_SYSTEM);
    
    // CHEN'S FIX: Validate all critical systems are resolved
    if (!this.inputSystem) {
      throw new Error('CRITICAL: InputSystem failed to resolve from container');
    }
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, 'Game started with A++ architecture!');
      
      await this.sceneManager.initialize(canvas);
      
      // Wait for scene to be fully ready
      await this.waitForSceneReady();
      
      await this.sceneManager.loadTerrain();
      
      // ZERO'S FIX: Initialize terrain service for proper player spawning
      const terrainService = container.resolve(ServiceTokens.TERRAIN_SERVICE) as any;
      await terrainService.initialize();
      
      this.inputManager.startListening();
      
      // Setup ECS systems IN GUARANTEED ORDER
      this.entityManager.addSystem(this.inputSystem);
      this.entityManager.addSystem(this.clientPredictionSystem); // Immediate local input
      this.entityManager.addSystem(this.movementSystem); // Remote players only now
      this.entityManager.addSystem(this.interpolationSystem);
      this.entityManager.addSystem(this.areaOfInterestSystem); // Spatial optimization
      this.entityManager.addSystem(this.renderSystem);
      this.entityManager.addSystem(this.networkCompressionSystem); // Message batching
      this.entityManager.addSystem(this.networkTickSystem); // Controlled network updates
      this.entityManager.addSystem(this.networkSystem);
      this.entityManager.addSystem(this.playerManager);

      // Set explicit execution order - OPTIMIZED FOR MULTIPLAYER GAMES
      this.entityManager.setSystemExecutionOrder([
        'InputSystem',              // Capture input
        'ClientPredictionSystem',   // Immediate local movement
        'MovementSystem',           // Remote player movement only
        'InterpolationSystem',      // Smooth remote players
        'AreaOfInterestSystem',     // Spatial optimization (distance-based culling)
        'RenderSystem',             // Visual updates
        'NetworkCompressionSystem', // Message batching and compression
        'NetworkTickSystem',        // Rate-limited network updates
        'NetworkSystem',            // Network message handling
        'PlayerManager'             // Player lifecycle
      ]);

      // Ensure all systems are registered before creating entities
      await this.createLocalPlayer();

      // CHEN'S FIX: Setup WebSocket event handling BEFORE attempting connection
      this.eventBus.subscribe('network.websocket_ready', (websocket: WebSocket) => {
        this.networkTickSystem.setWebSocket(websocket);
        this.networkCompressionSystem.setWebSocket(websocket);
        
        // CHEN'S FIX: Start independent network timer - Source Engine style!
        this.networkTickSystem.startNetworkTimer();
        
        Logger.debug(LogCategory.NETWORK, 'WebSocket properly wired to systems via event');
      });

      // CHEN'S FIX: Complete scene setup BEFORE network connection
      await this.setupScene();
      Logger.info(LogCategory.CORE, 'Scene initialized');

      // CHEN'S FIX: Connect to multiplayer LAST, after everything is ready
      try {
        await this.networkSystem.connect();
        Logger.info(LogCategory.NETWORK, 'Multiplayer connection established');
      } catch (error) {
        Logger.warn(LogCategory.NETWORK, 'Multiplayer connection failed, continuing in offline mode', error);
        // Continue without multiplayer - graceful degradation
      }

      this.eventBus.emit('game.initialized');
      Logger.info(LogCategory.CORE, 'Game systems initialized');
      
      this.start();
      
    } catch (error) {
      Logger.error(LogCategory.CORE, 'System Error', error);
      throw error; // Re-throw to trigger error screen
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
    
    this.localPlayer = await playerFactory.createLocalPlayer();
    
    if (this.localPlayer) {
      Logger.info(LogCategory.PLAYER, '🐿️ Local player created with ID:', this.localPlayer.id.value);
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
      
      renderer.render(scene, camera);
    } catch (error) {
      Logger.error(LogCategory.RENDER, '🚨 [GameLoop] Render failed:', error);
      throw error;
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

  private async setupScene(): Promise<void> {
    // Wait for readiness
    await this.waitForSceneReady();
    
    if (this.localPlayer) {
      Logger.debug(LogCategory.RENDER, 'Scene fully ready for entities');
    } else {
      Logger.warn(LogCategory.RENDER, 'Waiting for scene readiness...');
    }
  }
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

  container.registerSingleton(ServiceTokens.ASSET_MANAGER, () => 
    new AssetManager()
  );

  container.registerSingleton(ServiceTokens.MOVEMENT_SYSTEM, () => 
    new MovementSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      MovementConfig.default(),
      WorldBounds.default()
    )
  );

  container.registerSingleton(ServiceTokens.INTERPOLATION_SYSTEM, () => 
    new InterpolationSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.RENDER_ADAPTER, () => 
    new ThreeJSRenderAdapter()
  );

  container.registerSingleton(ServiceTokens.RENDER_SYSTEM, () => 
    new RenderSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve(ServiceTokens.RENDER_ADAPTER)
    )
  );

  container.registerSingleton(ServiceTokens.INPUT_SYSTEM, () => 
    new InputSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER)
    )
  );

  container.registerSingleton(ServiceTokens.NETWORK_SYSTEM, () => 
    new NetworkSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.TERRAIN_SERVICE, () => 
    new TerrainService(
      import.meta.env.VITE_API_URL || 'http://localhost:8787'
    )
  );

  container.registerSingleton(ServiceTokens.NETWORK_TICK_SYSTEM, () => 
    new NetworkTickSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.CLIENT_PREDICTION_SYSTEM, () => 
    new ClientPredictionSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      MovementConfig.default(),
      WorldBounds.default()
    )
  );

  container.registerSingleton(ServiceTokens.AREA_OF_INTEREST_SYSTEM, () => 
    new AreaOfInterestSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.NETWORK_COMPRESSION_SYSTEM, () => 
    new NetworkCompressionSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.PLAYER_MANAGER, () => 
    new PlayerManager(container.resolve<EventBus>(ServiceTokens.EVENT_BUS))
  );

  container.registerSingleton(ServiceTokens.PLAYER_FACTORY, () => 
    new PlayerFactory(
      container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER),
      container.resolve<IAssetManager>(ServiceTokens.ASSET_MANAGER),
      container.resolve(ServiceTokens.ENTITY_MANAGER),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    )
  );
} 