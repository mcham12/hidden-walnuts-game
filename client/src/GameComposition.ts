// client/src/GameComposition.ts

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
import { MovementConfig } from './core/types';
import { InterpolationSystem } from './systems/InterpolationSystem';
import { RenderSystem } from './systems/RenderSystem';
import { NetworkTickSystem } from './systems/NetworkTickSystem';
import { AreaOfInterestSystem } from './systems/AreaOfInterestSystem';
import { NetworkCompressionSystem } from './systems/NetworkCompressionSystem';
import { ThreeJSRenderAdapter } from './rendering/IRenderAdapter';
import { CharacterRegistry } from './core/CharacterRegistry'; // New for MVP 8b
import { SimpleMultiplayerManager } from './multiplayer/SimpleMultiplayerManager';
import { NetworkIntegration } from './multiplayer/NetworkIntegration';

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
  private terrainService: import('./services/TerrainService').TerrainService | null = null;
  constructor(private eventBus: EventBus) {
    this.initializeTerrainService();
  }
  private async initializeTerrainService(): Promise<void> {
    try {
      const { TerrainService } = await import('./services/TerrainService');
      this.terrainService = new TerrainService();
      Logger.debug(LogCategory.TERRAIN, '✅ Terrain service initialized for camera');
    } catch (error) {
      Logger.warn(LogCategory.TERRAIN, 'Failed to initialize terrain service for camera:', error);
    }
  }
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // BEST PRACTICE: Robust initialization with error handling
    if (!canvas) {
      throw new Error('Canvas element is required for scene initialization');
    }
    
    const THREE = await import('three');
    
    try {
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);
      Logger.debug(LogCategory.CORE, '✅ Scene created successfully');
    } catch (error) {
      Logger.error(LogCategory.CORE, '❌ Failed to create Three.js scene:', error);
      throw new Error(`Scene initialization failed: ${error}`);
    }
    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      2000  
    );
    
    // Position camera to better see the spawn area (local player spawns between -5 and 5 on X/Z)
    this.camera.position.set(0, 15, 15); // DEBUGGING: Higher camera position to see more area
    this.camera.lookAt(0, 2, 0); // Look slightly above ground level
    this.constrainCameraToWorldBounds();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(0x87CEEB); 
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    const debugGeometry = new THREE.BoxGeometry(5, 5, 5);
    const debugMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const debugCube = new THREE.Mesh(debugGeometry, debugMaterial);
    debugCube.position.set(0, 2.5, 0); 
    this.scene.add(debugCube);
    this.eventBus.emit('scene.initialized', null);
  }
  async loadTerrain(): Promise<void> {
    const { createTerrain } = await import('./terrain');
    const terrain = await createTerrain();
    this.scene.add(terrain);
    this.eventBus.emit('terrain.loaded');
  }
  async loadForest(): Promise<void> {
    const { Logger, LogCategory } = await import('./core/Logger');
    try {
      const { createForest } = await import('./forest');
      const forestObjects = await createForest();
      
      forestObjects.forEach(obj => this.scene.add(obj));
      
      Logger.info(LogCategory.TERRAIN, `Added ${forestObjects.length} forest objects to scene`);
      this.eventBus.emit('forest.loaded');
    } catch (error) {
      Logger.error(LogCategory.TERRAIN, 'Failed to load forest objects', error);
    }
  }
  getScene(): import('three').Scene { 
    // BEST PRACTICE: Robust scene management with validation
    if (!this.scene) {
      throw new Error('Scene not initialized - call initialize() first');
    }
    return this.scene; 
  }
  getCamera(): import('three').PerspectiveCamera { 
    if (!this.camera) {
      throw new Error('Camera not initialized - call initialize() first');
    }
    return this.camera; 
  }
  getRenderer(): import('three').WebGLRenderer { 
    if (!this.renderer) {
      throw new Error('Renderer not initialized - call initialize() first');
    }
    return this.renderer; 
  }
  private constrainCameraToWorldBounds(): void {
    if (!this.camera) return;
    
    const worldSize = 200; 
    const boundary = worldSize / 2;
    const heightLimit = 100; 
    const minHeight = 2; 
    
    const padding = 10;
    this.camera.position.x = Math.max(-boundary + padding, Math.min(boundary - padding, this.camera.position.x));
    this.camera.position.z = Math.max(-boundary + padding, Math.min(boundary - padding, this.camera.position.z));
    
    this.camera.position.y = Math.max(minHeight, Math.min(heightLimit, this.camera.position.y));
  }
  updateCameraToFollowPlayer(playerPosition: { x: number; y: number; z: number }, playerRotation: { y: number }): void {
    if (!this.camera) return;
    
    const baseDistance = 2.5; 
    const baseHeight = 2; 
    const minHeight = 2; 
    const maxHeight = 15; 
    const lerpSpeed = 0.08; 
    const angle = playerRotation.y;
    
    const idealCameraX = playerPosition.x - Math.sin(angle) * baseDistance;
    const idealCameraZ = playerPosition.z - Math.cos(angle) * baseDistance;
    let idealCameraY = playerPosition.y + baseHeight;
    
    if (this.terrainService) {
      try {
        const terrainHeightAtCamera = this.terrainService.getTerrainHeightSync(idealCameraX, idealCameraZ);
        if (terrainHeightAtCamera !== null) {
          const minCameraY = terrainHeightAtCamera + minHeight;
          const maxCameraY = terrainHeightAtCamera + maxHeight;
          
          idealCameraY = Math.max(minCameraY, Math.min(maxCameraY, playerPosition.y + baseHeight));
        }
      } catch (error) {
        idealCameraY = Math.max(idealCameraY, playerPosition.y + minHeight);
      }
    }
    
    const idealPosition = { x: idealCameraX, y: idealCameraY, z: idealCameraZ };
    
    const collisionFreePosition = this.checkCameraCollision(
      { x: playerPosition.x, y: playerPosition.y + 1, z: playerPosition.z }, 
      idealPosition,
      baseDistance
    );
    
    this.camera.position.lerp(
      { x: collisionFreePosition.x, y: collisionFreePosition.y, z: collisionFreePosition.z } as any,
      lerpSpeed
    );
    
    this.constrainCameraToWorldBounds();
    
    const lookAtTarget = {
      x: playerPosition.x,
      y: playerPosition.y + 1.5, 
      z: playerPosition.z
    };
    
    this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
  }
  private checkCameraCollision(
    fromPosition: { x: number; y: number; z: number },
    toPosition: { x: number; y: number; z: number },
    maxDistance: number
  ): { x: number; y: number; z: number } {
    if (!this.scene) return toPosition;
    
    try {
      const THREE = require('three');
      
      const direction = {
        x: toPosition.x - fromPosition.x,
        y: toPosition.y - fromPosition.y,
        z: toPosition.z - fromPosition.z
      };
      
      const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
      
      if (distance === 0) return toPosition;
      
      direction.x /= distance;
      direction.y /= distance;
      direction.z /= distance;
      
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(fromPosition.x, fromPosition.y, fromPosition.z),
        new THREE.Vector3(direction.x, direction.y, direction.z)
      );
      
      const intersectableObjects: any[] = [];
      this.scene.traverse((child: any) => {
        if (child.isMesh && 
            (child.userData.type === 'terrain' || 
             child.userData.type === 'forest_object' ||
             child.userData.type === 'tree' ||
             child.userData.type === 'rock')) {
          intersectableObjects.push(child);
        }
      });
      
      const intersections = raycaster.intersectObjects(intersectableObjects, false);
      
      if (intersections.length > 0) {
        const collisionDistance = intersections[0].distance;
        const safeDistance = Math.max(collisionDistance - 0.5, maxDistance * 0.3); 
        
        return {
          x: fromPosition.x + direction.x * safeDistance,
          y: fromPosition.y + direction.y * safeDistance,
          z: fromPosition.z + direction.z * safeDistance
        };
      }
      
      return toPosition;
    } catch (error) {
      return toPosition;
    }
  }
}

export interface IAssetManager {
  loadSquirrelModel(): Promise<import('three').Group>;
  loadModel(path: string): Promise<any>;
}

export class AssetManager implements IAssetManager {
  private cache = new Map<string, any>();
  async loadSquirrelModel(): Promise<import('three').Group> {
    if (this.cache.has('squirrel')) {
      const cachedModel = this.cache.get('squirrel');
      Logger.debug(LogCategory.CORE, `📦 Using cached squirrel model, scale: x=${cachedModel.scale.x.toFixed(2)}, y=${cachedModel.scale.y.toFixed(2)}, z=${cachedModel.scale.z.toFixed(2)}`);
      
      // CRITICAL FIX: Deep clone with unique materials to prevent shared material bug
      const clonedModel = cachedModel.clone();
      clonedModel.traverse((child: any) => {
        if (child.isMesh && child.material) {
          // Clone materials to ensure each player has unique material instances
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat: any) => mat.clone());
          } else {
            child.material = child.material.clone();
          }
        }
      });
      
      Logger.debug(LogCategory.CORE, `🔧 Deep cloned squirrel model with unique materials`);
      return clonedModel;
    }
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    
    const loader = new GLTFLoader();
    
    const assetPath = '/assets/models/environment/squirrel.glb'; 
    
    return new Promise((resolve, reject) => {
      loader.load(
        assetPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.3); 
          model.castShadow = true;
          model.receiveShadow = true;
          
          Logger.debug(LogCategory.CORE, `📦 Caching squirrel model with scale: x=${model.scale.x.toFixed(2)}, y=${model.scale.y.toFixed(2)}, z=${model.scale.z.toFixed(2)}`);
          this.cache.set('squirrel', model);
          
          // CRITICAL FIX: Deep clone the initial model too
          const clonedModel = model.clone();
          clonedModel.traverse((child: any) => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material = child.material.map((mat: any) => mat.clone());
              } else {
                child.material = child.material.clone();
              }
            }
          });
          
          resolve(clonedModel);
        },
        undefined,
        (error) => {
          Logger.error(LogCategory.CORE, `Failed to load squirrel model from ${assetPath}`, error);
          reject(error);
        }
      );
    });
  }
  async loadModel(path: string): Promise<any> {
    if (this.cache.has(path)) {
      const cachedGltf = this.cache.get(path);
      
      // STANDARD PATTERN: Deep clone with material isolation for multiplayer
      const clonedScene = cachedGltf.scene.clone();
      clonedScene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mat: any) => mat.clone());
          } else {
            child.material = child.material.clone();
          }
        }
      });
      
      return {
        scene: clonedScene,
        animations: cachedGltf.animations,
        cameras: cachedGltf.cameras,
        asset: cachedGltf.asset
      };
    }
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          Logger.info(LogCategory.CORE, `📦 Caching new model: ${path}`);
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
  private inputSystem: any;
  private networkIntegration: NetworkIntegration | null = null; 
  private localPlayer?: Entity;
  private isRunning = false;
  private errorCount = 0;
  private maxErrors = 10;
  constructor() {
    this.eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    this.entityManager = container.resolve<EntityManager>(ServiceTokens.ENTITY_MANAGER);
    this.sceneManager = container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER);
    this.inputManager = container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER);
    this.inputSystem = container.resolve(ServiceTokens.INPUT_SYSTEM);
    this.clientPredictionSystem = container.resolve(ServiceTokens.CLIENT_PREDICTION_SYSTEM);
    this.movementSystem = container.resolve(ServiceTokens.MOVEMENT_SYSTEM);
    this.networkSystem = container.resolve(ServiceTokens.NETWORK_SYSTEM);
    // DEFERRED: playerManager will be resolved after scene initialization
    this.interpolationSystem = new InterpolationSystem(this.eventBus);
    
    const renderAdapter = new ThreeJSRenderAdapter();
    this.renderSystem = new RenderSystem(this.eventBus, renderAdapter);
    
    this.networkTickSystem = new NetworkTickSystem(this.eventBus);
    this.areaOfInterestSystem = new AreaOfInterestSystem(this.eventBus);
    this.networkCompressionSystem = new NetworkCompressionSystem(this.eventBus);
    this.entityManager.addSystem(this.inputSystem);
    this.entityManager.addSystem(this.clientPredictionSystem);
    this.entityManager.addSystem(this.movementSystem);
    this.entityManager.addSystem(this.networkSystem);
    // DEFERRED: playerManager will be added to systems after scene initialization
    this.entityManager.addSystem(this.interpolationSystem);
    this.entityManager.addSystem(this.areaOfInterestSystem);
    this.entityManager.addSystem(this.renderSystem);
    this.entityManager.addSystem(this.networkCompressionSystem);
    this.entityManager.addSystem(this.networkTickSystem);
    
    Logger.info(LogCategory.CORE, '🎮 GameManager initialized - system execution order will be set after scene initialization');
  }
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, '🎯 Starting game initialization...');
      Logger.info(LogCategory.CORE, '🌍 Initializing terrain service...');
      const terrainService = container.resolve(ServiceTokens.TERRAIN_SERVICE) as any;
      await terrainService.initialize();
      Logger.info(LogCategory.CORE, '✅ Terrain service initialized');
      
      Logger.info(LogCategory.CORE, '🎨 Initializing scene...');
      await this.sceneManager.initialize(canvas);
      Logger.info(LogCategory.CORE, '✅ Scene initialized');
      
      // BEST PRACTICE: Configure scene-dependent services AFTER scene is initialized
      Logger.info(LogCategory.CORE, '🏗️ Configuring scene-dependent services...');
      configureSceneDependentServices();
      
      // Simple multiplayer system is now integrated via NetworkIntegration
      
      // Set simple system execution order (removed old PlayerManager)
      this.entityManager.setSystemExecutionOrder([
        'InputSystem',              // 1. Capture input immediately
        'ClientPredictionSystem',   // 2. Apply local prediction  
        'MovementSystem',           // 3. Process local movement
        'NetworkSystem',            // 4. Handle network messages
        'InterpolationSystem',      // 5. Smooth remote player movement
        'AreaOfInterestSystem',     // 6. Spatial culling
        'RenderSystem',             // 7. Render all entities
        'NetworkCompressionSystem', // 8. Compress outbound messages
        'NetworkTickSystem'         // 9. Send network updates
      ]);
      
      Logger.info(LogCategory.CORE, '✅ Scene-dependent services configured and added to systems with proper execution order');
      
      Logger.info(LogCategory.CORE, '🌲 Loading terrain...');
      await this.sceneManager.loadTerrain();
      Logger.info(LogCategory.CORE, '✅ Terrain loaded');
      
      Logger.info(LogCategory.CORE, '🌳 Loading forest...');
      await this.sceneManager.loadForest();
      Logger.info(LogCategory.CORE, '✅ Forest loaded');
      
      // SIMPLE TEST: Create a red remote player immediately  
      Logger.info(LogCategory.NETWORK, '🔴 Creating test remote player...');
      try {
        const { createTestRemotePlayer } = await import('./test-remote-player');
        createTestRemotePlayer(this.sceneManager.getScene());
        Logger.info(LogCategory.NETWORK, '✅ Test remote player created');
      } catch (error) {
        Logger.error(LogCategory.NETWORK, '❌ Failed to create test remote player:', error);
      }
      
      Logger.info(LogCategory.NETWORK, '🌐 Attempting multiplayer connection...');
      let savedPlayerData: { position: any; rotationY: number } | null = null;
      
      try {
        const savedPositionPromise = new Promise<{ position: any; rotationY: number } | null>((resolve) => {
          let resolved = false;
          
          this.eventBus.subscribe('apply_saved_position', (data: { position: any; rotationY: number }) => {
            Logger.info(LogCategory.PLAYER, '📍 Received saved position from server:', data.position);
            if (!resolved) {
              resolved = true;
              resolve(data);
            }
          });
          
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              Logger.warn(LogCategory.PLAYER, '⚠️ Timeout waiting for saved position from server (2s), will use random spawn');
              resolve(null);
            }
          }, 2000); 
        });
        
        Logger.info(LogCategory.NETWORK, '🔌 Attempting to connect to server...');
        try {
          await this.networkSystem.connect();
          Logger.info(LogCategory.NETWORK, '✅ Multiplayer connection established');
        } catch (error) {
          Logger.error(LogCategory.NETWORK, '❌ Failed to connect to server:', error);
          // Continue anyway for local testing
        }
        
        await new Promise<void>((resolve) => {
          const checkWebSocketReady = () => {
            if (this.networkSystem.isConnected()) {
              Logger.info(LogCategory.NETWORK, '✅ WebSocket is ready, waiting for saved position...');
              resolve();
            } else {
              Logger.debug(LogCategory.NETWORK, '⏳ Waiting for WebSocket to be ready...');
              setTimeout(checkWebSocketReady, 50);
            }
          };
          checkWebSocketReady();
        });
        
        Logger.info(LogCategory.PLAYER, '⏳ Waiting for saved position from server...');
        savedPlayerData = await savedPositionPromise;
        
        if (savedPlayerData) {
          Logger.info(LogCategory.PLAYER, '✅ Saved position received successfully:', savedPlayerData.position);
        } else {
          Logger.warn(LogCategory.PLAYER, '⚠️ No saved position received from server, will use random spawn');
          savedPlayerData = null;
        }
        
      } catch (networkError) {
        Logger.warn(LogCategory.NETWORK, '⚠️ Multiplayer connection failed, continuing in single-player mode', networkError);
      }
      
      await this.createLocalPlayer(savedPlayerData);
      Logger.info(LogCategory.PLAYER, `🎮 Local player created: ${this.localPlayer?.id.value}`);
      
      this.inputManager.startListening();
      Logger.info(LogCategory.INPUT, '🎮 Input listening started - WASD controls active!');
      
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
      
      // Add timeout to prevent infinite hanging
      setTimeout(() => {
        Logger.warn(LogCategory.RENDER, '⚠️ Scene readiness timeout, proceeding anyway');
        resolve();
      }, 5000); // 5 second timeout
      
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
  private async createLocalPlayer(savedPlayerData: { position: any; rotationY: number } | null): Promise<void> {
    let playerId = this.getPersistentSquirrelId();
    if (!playerId) {
      playerId = crypto.randomUUID();
      this.setPersistentSquirrelId(playerId);
      Logger.warn(LogCategory.PLAYER, `⚠️ No squirrelId found in storage, generated fallback: ${playerId}`);
    } else {
      Logger.info(LogCategory.PLAYER, `🔄 Using persistent squirrelId for local player: ${playerId}`);
    }

    try {
      const multiplayerManager = container.resolve(ServiceTokens.SIMPLE_MULTIPLAYER_MANAGER) as any;
      const player = await multiplayerManager.createPlayer(playerId, true); // true = isLocal
      
      if (savedPlayerData) {
        const position = new (await import('three')).Vector3(
          savedPlayerData.position.x,
          savedPlayerData.position.y,
          savedPlayerData.position.z
        );
        player.update(position, savedPlayerData.rotationY);
      }
      
      Logger.info(LogCategory.PLAYER, `🐿️ Local player created: ${player.id}`);
      
      // Store the local player ECS entity reference
      this.localPlayer = player.entity;
      
      // Set up Area of Interest system
      this.areaOfInterestSystem.setLocalPlayer(playerId, {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      });
      
      // Set up network integration for remote players
      this.networkIntegration = new NetworkIntegration(multiplayerManager, this.eventBus);
      
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to create local player:', error);
      throw error;
    }
  }
  private lastErrorTime = 0;
  private static readonly ERROR_RECOVERY_DELAY = 1000; 
  
  private lastFrameTime = 0;
  private static readonly MAX_DELTA_TIME = 1/30; 
  private static readonly TARGET_DELTA_TIME = 1/60; 
  private gameLoop = (): void => {
    if (!this.isRunning) return;
    try {
      const now = performance.now();
      let deltaTime = this.lastFrameTime === 0 ? GameManager.TARGET_DELTA_TIME : (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;
      
      deltaTime = Math.min(deltaTime, GameManager.MAX_DELTA_TIME);
      
      this.safeSystemUpdate(deltaTime);
      
      this.safeRender();
      
      const currentTime = performance.now();
      if (currentTime - this.lastErrorTime > GameManager.ERROR_RECOVERY_DELAY) {
        this.errorCount = 0;
      }
      
    } catch (error) {
      this.handleGameLoopError(error);
    }
    requestAnimationFrame(this.gameLoop);
  };
  private safeSystemUpdate(deltaTime: number): void {
    try {
      this.entityManager.update(deltaTime);
      
      // Test log to verify systems are being called
      Logger.debugExpensive(LogCategory.CORE, () => `🔄 Game loop update - deltaTime: ${deltaTime.toFixed(3)}s`);
      
      this.updateCameraToFollowLocalPlayer();
    } catch (error) {
      this.handleGameLoopError(error);
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
      
      this.updateCameraToFollowLocalPlayer();
      
      renderer.render(scene, camera);
    } catch (error) {
      Logger.error(LogCategory.RENDER, '🚨 [GameLoop] Render failed:', error);
      throw error;
    }
  }
  private updateCameraToFollowLocalPlayer(): void {
    Logger.debug(LogCategory.RENDER, `📷 updateCameraToFollowLocalPlayer called, localPlayer exists: ${!!this.localPlayer}`);
    
    if (!this.localPlayer) {
      Logger.warn(LogCategory.RENDER, '⚠️ No local player available for camera follow');
      return;
    }
    
    const position = this.localPlayer.getComponent<PositionComponent>('position');
    const rotation = this.localPlayer.getComponent<RotationComponent>('rotation');
    
    Logger.debug(LogCategory.RENDER, `📷 Local player components - position: ${!!position}, rotation: ${!!rotation}`);
    
    if (position && rotation) {
      Logger.debug(LogCategory.RENDER, `📷 Camera following local player at (${position.value.x.toFixed(1)}, ${position.value.y.toFixed(1)}, ${position.value.z.toFixed(1)})`);
      
      // Get camera position for debugging
      const camera = this.sceneManager.getCamera();
      if (camera) {
        Logger.debug(LogCategory.RENDER, `📷 Camera position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
        Logger.debug(LogCategory.RENDER, `📷 Camera target: (${position.value.x.toFixed(1)}, ${position.value.y.toFixed(1)}, ${position.value.z.toFixed(1)})`);
      }
      
      this.sceneManager.updateCameraToFollowPlayer(
        { x: position.value.x, y: position.value.y, z: position.value.z },
        { y: rotation.value.y }
      );
    } else {
      Logger.warn(LogCategory.RENDER, '⚠️ Local player missing position or rotation component');
      Logger.warn(LogCategory.RENDER, `⚠️ Local player components: ${this.localPlayer.getComponents().map(c => c.type).join(', ')}`);
    }
  }
  private handleGameLoopError(error: any): void {
    const now = performance.now();
    this.errorCount++;
    this.lastErrorTime = now;
    
         Logger.error(LogCategory.ECS, `Game loop error #${this.errorCount}`, error);
    
    if (this.errorCount >= this.maxErrors) {
      Logger.error(LogCategory.CORE, '💥 [GameLoop] Too many errors, initiating emergency stop!');
      this.emergencyStop();
      return;
    }
    
    this.attemptRecovery();
  }
  private attemptRecovery(): void {
    Logger.debug(LogCategory.CORE, '🔧 [GameLoop] Attempting system recovery...');
    
    try {
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
    
    if (this.networkTickSystem && typeof this.networkTickSystem.stopNetworkTimer === 'function') {
      this.networkTickSystem.stopNetworkTimer();
    }
    
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
  public getEventBus(): EventBus { return this.eventBus; }
  public getNetworkSystem(): NetworkSystem { return this.networkSystem; }
  public getLocalPlayer(): Entity | undefined { return this.localPlayer; }
  private getPersistentSquirrelId(): string | null {
    try {
      const sessionId = sessionStorage.getItem('squirrelId');
      if (sessionId) {
        Logger.debug(LogCategory.PLAYER, `📦 Retrieved squirrelId from sessionStorage: ${sessionId}`);
        return sessionId;
      }
      
      return null;
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, '⚠️ Failed to retrieve persistent squirrelId:', error);
      return null;
    }
  }
  private setPersistentSquirrelId(squirrelId: string): void {
    try {
      sessionStorage.setItem('squirrelId', squirrelId);
      Logger.debug(LogCategory.PLAYER, `💾 Stored squirrelId in sessionStorage: ${squirrelId}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to store squirrelId in sessionStorage:', error);
    }
  }
}

export function configureServices(): void {
  // BEST PRACTICE: Phase 1 - Core services (no scene dependencies)
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
  container.registerSingleton(ServiceTokens.CHARACTER_REGISTRY, () => new CharacterRegistry());
  
  // BEST PRACTICE: Phase 2 - Systems that don't require scene
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
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });
  container.registerSingleton(ServiceTokens.CLIENT_PREDICTION_SYSTEM, () => {
    return new ClientPredictionSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve<InputManager>(ServiceTokens.INPUT_MANAGER),
      MovementConfig.default(),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });
  container.registerSingleton(ServiceTokens.NETWORK_SYSTEM, () => {
    return new NetworkSystem(container.resolve<EventBus>(ServiceTokens.EVENT_BUS));
  });
  
  Logger.info(LogCategory.CORE, '🏗️ Phase 1 & 2 services configured successfully');
}

// BEST PRACTICE: Phase 3 - Scene-dependent services (called after scene initialization)
export function configureSceneDependentServices(): void {
  // Register simple multiplayer manager
  container.registerSingleton(ServiceTokens.SIMPLE_MULTIPLAYER_MANAGER, () => {
    return new SimpleMultiplayerManager(
      container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER).getScene(),
      container.resolve(ServiceTokens.ENTITY_MANAGER)
    );
  });
  
  container.registerSingleton(ServiceTokens.PLAYER_FACTORY, () => {
    return new PlayerFactory(
      container.resolve(ServiceTokens.SCENE_MANAGER),
      container.resolve(ServiceTokens.ASSET_MANAGER),
      container.resolve(ServiceTokens.ENTITY_MANAGER),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });
  
  
  Logger.info(LogCategory.CORE, '🏗️ Phase 3 scene-dependent services configured successfully');
}