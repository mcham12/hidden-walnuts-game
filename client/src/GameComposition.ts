// Enterprise Game Composition Layer - Orchestrates all game systems
// AI NOTE: This follows SOLID principles and Dependency Inversion

import { container, ServiceTokens } from './core/Container';
import { EventBus } from './core/EventBus';
import { Logger, LogCategory } from './core/Logger';
import { EntityManager, Entity, PositionComponent, RotationComponent } from './ecs';
import { TerrainService } from './services/TerrainService';

import { InputSystem } from './systems/InputSystem';
import { MovementSystem } from './systems/MovementSystem';
import { ClientPredictionSystem } from './systems/ClientPredictionSystem';
import { NetworkSystem } from './systems/NetworkSystem';
import { PlayerManager } from './systems/PlayerManager';
import { MovementConfig } from './core/types';
import { InterpolationSystem } from './systems/InterpolationSystem';
import { RenderSystem } from './systems/RenderSystem';
import { NetworkTickSystem } from './systems/NetworkTickSystem';
import { AreaOfInterestSystem } from './systems/AreaOfInterestSystem';
import { NetworkCompressionSystem } from './systems/NetworkCompressionSystem';
import { InputAnimationSystem } from './systems/InputAnimationSystem';
import { AnimationSystem } from './systems/AnimationSystem';
import { ThreeJSRenderAdapter } from './rendering/IRenderAdapter';
import { NetworkAnimationSystem } from './systems/NetworkAnimationSystem';
import { NPCSystem } from './systems/NPCSystem';
import { CharacterSelectionSystem } from './systems/CharacterSelectionSystem';

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
  checkCharacterSelectionKey(): boolean;
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

  // Check for character selection key press
  checkCharacterSelectionKey(): boolean {
    return this.keys.has('c');
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
  private terrainService: import('./services/TerrainService').TerrainService | null = null;

  constructor(private eventBus: EventBus) {
    // TASK 4: Initialize terrain service for camera collision detection
    this.initializeTerrainService();
  }

  // TASK 4: Initialize terrain service for camera system (optimized)
  private async initializeTerrainService(): Promise<void> {
    try {
      // Use static import for better performance
      const { TerrainService } = await import('./services/TerrainService');
      this.terrainService = new TerrainService();
      Logger.debug(LogCategory.TERRAIN, '✅ Terrain service initialized for camera');
    } catch (error) {
      Logger.warn(LogCategory.TERRAIN, 'Failed to initialize terrain service for camera:', error);
    }
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
    
    // TASK 4 FIX: Terrain-aware initial camera position
    let initialCameraY = 50; // Default high position
    if (this.terrainService) {
      try {
        // Get terrain height at initial position and adjust camera accordingly
        const terrainHeight = this.terrainService.getTerrainHeightSync(0, 50);
        if (terrainHeight !== null) {
          initialCameraY = terrainHeight + 25; // 25 units above terrain
        }
      } catch (error) {
        Logger.warn(LogCategory.TERRAIN, 'Failed to get initial terrain height for camera, using default');
      }
    }
    
    this.camera.position.set(0, initialCameraY, 50);
    this.camera.lookAt(0, 0, 0);

    // TASK 4: Add camera boundary constraints
    this.constrainCameraToWorldBounds();

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

  // TASK 4: Constrain camera to world boundaries
  private constrainCameraToWorldBounds(): void {
    if (!this.camera) return;
    
    const worldSize = 200; // 200x200 terrain
    const boundary = worldSize / 2;
    const heightLimit = 100; // Maximum camera height
    const minHeight = 2; // Minimum camera height
    
    // Constrain X and Z to world bounds with some padding
    const padding = 10;
    this.camera.position.x = Math.max(-boundary + padding, Math.min(boundary - padding, this.camera.position.x));
    this.camera.position.z = Math.max(-boundary + padding, Math.min(boundary - padding, this.camera.position.z));
    
    // Constrain Y to reasonable height limits
    this.camera.position.y = Math.max(minHeight, Math.min(heightLimit, this.camera.position.y));
  }

  // TASK 4: Enhanced camera follow functionality with terrain awareness and collision detection
  updateCameraToFollowPlayer(playerPosition: { x: number; y: number; z: number }, playerRotation: { y: number }): void {
    if (!this.camera) return;
    
    Logger.debug(LogCategory.RENDER, `🎥 SceneManager: Moving camera to follow player at (${playerPosition.x.toFixed(1)}, ${playerPosition.y.toFixed(1)}, ${playerPosition.z.toFixed(1)})`);
    
    // Camera configuration constants - EVEN CLOSER CAMERA FOR BETTER GAMEPLAY
    const baseDistance = 2.5; // Reduced from 4 to 2.5 for even closer camera
    const baseHeight = 2; // Reduced from 3 to 2 for even lower camera angle
    const minHeight = 2; // Minimum camera height above terrain
    const maxHeight = 15; // Maximum camera height for steep terrain
    const lerpSpeed = 0.08; // Slightly slower for smoother movement
    const angle = playerRotation.y;
    
    // Calculate ideal camera position behind player
    const idealCameraX = playerPosition.x - Math.sin(angle) * baseDistance;
    const idealCameraZ = playerPosition.z - Math.cos(angle) * baseDistance;
    let idealCameraY = playerPosition.y + baseHeight;
    
    // TASK 4 FIX: Terrain-aware camera height adjustment
    if (this.terrainService) {
      try {
        // Get terrain height at camera position
        const terrainHeightAtCamera = this.terrainService.getTerrainHeightSync(idealCameraX, idealCameraZ);
        if (terrainHeightAtCamera !== null) {
          // Ensure camera is always above terrain + minimum height
          const minCameraY = terrainHeightAtCamera + minHeight;
          const maxCameraY = terrainHeightAtCamera + maxHeight;
          
          // Adjust camera height based on terrain, but keep it relative to player
          idealCameraY = Math.max(minCameraY, Math.min(maxCameraY, playerPosition.y + baseHeight));
        }
      } catch (error) {
        // Fallback: ensure camera doesn't go below player level
        idealCameraY = Math.max(idealCameraY, playerPosition.y + minHeight);
      }
    }
    
    const idealPosition = { x: idealCameraX, y: idealCameraY, z: idealCameraZ };
    
    // TASK 4 FIX: Camera collision detection to prevent clipping through objects
    const collisionFreePosition = this.checkCameraCollision(
      { x: playerPosition.x, y: playerPosition.y + 1, z: playerPosition.z }, // Look-at point
      idealPosition,
      baseDistance
    );
    
    // TASK 4 FIX: Smooth camera movement with improved lerp
    this.camera.position.lerp(
      { x: collisionFreePosition.x, y: collisionFreePosition.y, z: collisionFreePosition.z } as any,
      lerpSpeed
    );
    
    // TASK 4: Apply boundary constraints after positioning
    this.constrainCameraToWorldBounds();
    
    // TASK 4 FIX: Smooth look-at with slight prediction
    const lookAtTarget = {
      x: playerPosition.x,
      y: playerPosition.y + 1.5, // Look slightly above player center
      z: playerPosition.z
    };
    
    this.camera.lookAt(lookAtTarget.x, lookAtTarget.y, lookAtTarget.z);
  }

  // TASK 4: Camera collision detection to prevent clipping through terrain/objects
  private checkCameraCollision(
    fromPosition: { x: number; y: number; z: number },
    toPosition: { x: number; y: number; z: number },
    maxDistance: number
  ): { x: number; y: number; z: number } {
    if (!this.scene) return toPosition;
    
    try {
      // Use dynamic import for browser compatibility
      // const THREE = require('three');
      // Instead, use the global THREE import (already imported at top)
      const THREE = (window as any).THREE || undefined;
      if (!THREE) {
        throw new Error('THREE.js not available globally');
      }
      
      // Create raycaster from player to ideal camera position
      const direction = {
        x: toPosition.x - fromPosition.x,
        y: toPosition.y - fromPosition.y,
        z: toPosition.z - fromPosition.z
      };
      
      const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
      
      if (distance === 0) return toPosition;
      
      // Normalize direction
      direction.x /= distance;
      direction.y /= distance;
      direction.z /= distance;
      
      // Create Three.js raycaster
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(fromPosition.x, fromPosition.y, fromPosition.z),
        new THREE.Vector3(direction.x, direction.y, direction.z)
      );
      
      // Get all intersectable objects (trees, rocks, etc.)
      const intersectableObjects: any[] = [];
      this.scene.traverse((child: any) => {
        // Only check collision with terrain and forest objects, not players
        if (child.isMesh && 
            (child.userData.type === 'terrain' || 
             child.userData.type === 'forest_object' ||
             child.userData.type === 'tree' ||
             child.userData.type === 'rock')) {
          intersectableObjects.push(child);
        }
      });
      
      // Check for intersections
      const intersections = raycaster.intersectObjects(intersectableObjects, false);
      
      if (intersections.length > 0) {
        // Collision detected - move camera closer to player
        const collisionDistance = intersections[0].distance;
        const safeDistance = Math.max(collisionDistance - 0.5, maxDistance * 0.3); // Keep some buffer
        
        return {
          x: fromPosition.x + direction.x * safeDistance,
          y: fromPosition.y + direction.y * safeDistance,
          z: fromPosition.z + direction.z * safeDistance
        };
      }
      
      return toPosition;
    } catch (error) {
      // Fallback: return original position if raycast fails
      return toPosition;
    }
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
      const cachedModel = this.cache.get('squirrel');
      Logger.debug(LogCategory.CORE, `📦 Using cached squirrel model, scale: x=${cachedModel.scale.x.toFixed(2)}, y=${cachedModel.scale.y.toFixed(2)}, z=${cachedModel.scale.z.toFixed(2)}`);
      return cachedModel.clone();
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
          model.scale.setScalar(0.3); // TASK 3 FIX: Match player scaling for consistency
          model.castShadow = true;
          model.receiveShadow = true;
          
          Logger.debug(LogCategory.CORE, `📦 Caching squirrel model with scale: x=${model.scale.x.toFixed(2)}, y=${model.scale.y.toFixed(2)}, z=${model.scale.z.toFixed(2)}`);
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
      const cached = this.cache.get(path);
      // Check if the cached object has a scene property (GLTF result)
      if (cached && cached.scene) {
        return cached;
      } else {
        // If it's not a valid GLTF object, remove it from cache and reload
        this.cache.delete(path);
      }
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          // Validate the loaded GLTF object
          if (gltf && gltf.scene) {
            this.cache.set(path, gltf);
            resolve(gltf);
          } else {
            const error = new Error(`Invalid GLTF data loaded from ${path}`);
            Logger.error(LogCategory.CORE, `Failed to load model from ${path} - invalid GLTF data`, error);
            reject(error);
          }
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
  private inputAnimationSystem: InputAnimationSystem;
  private animationSystem: AnimationSystem;
  private inputSystem: any; // CHEN'S FIX: Will be properly resolved
  private localPlayer?: Entity;
  private isRunning = false;
  private lastFrameTime = 0;
  private networkAnimationSystem: NetworkAnimationSystem;
  private npcSystem!: NPCSystem;
  private characterSelectionSystem!: CharacterSelectionSystem;

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
    this.renderSystem = container.resolve(ServiceTokens.RENDER_SYSTEM);
    this.inputAnimationSystem = container.resolve(ServiceTokens.INPUT_ANIMATION_SYSTEM);
    this.animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM);

    // Initialize remaining systems (placeholders for now)
    this.interpolationSystem = new InterpolationSystem(this.eventBus);
    
    this.networkTickSystem = new NetworkTickSystem(this.eventBus);
    this.areaOfInterestSystem = new AreaOfInterestSystem(this.eventBus);
    this.networkCompressionSystem = new NetworkCompressionSystem(this.eventBus);
    this.networkAnimationSystem = new NetworkAnimationSystem(this.eventBus);
    this.npcSystem = container.resolve(ServiceTokens.NPC_SYSTEM);
    this.characterSelectionSystem = container.resolve(ServiceTokens.CHARACTER_SELECTION_SYSTEM);

    // Register all systems with EntityManager in correct execution order
    this.entityManager.addSystem(this.inputSystem);
    this.entityManager.addSystem(this.clientPredictionSystem);
    this.entityManager.addSystem(this.movementSystem);
    this.entityManager.addSystem(this.interpolationSystem);
    this.entityManager.addSystem(this.areaOfInterestSystem);
    this.entityManager.addSystem(this.renderSystem);
    this.entityManager.addSystem(this.networkCompressionSystem);
    this.entityManager.addSystem(this.inputAnimationSystem);
    this.entityManager.addSystem(this.animationSystem);
    this.entityManager.addSystem(this.networkTickSystem);
    this.entityManager.addSystem(this.networkSystem);
    this.entityManager.addSystem(this.playerManager);
    this.entityManager.addSystem(this.networkAnimationSystem);
    this.entityManager.addSystem(this.npcSystem);
    this.entityManager.addSystem(this.characterSelectionSystem);

    // Set system execution order for optimal performance
    this.entityManager.setSystemExecutionOrder([
      'InputSystem',
      'ClientPredictionSystem', 
      'MovementSystem',
      'InterpolationSystem',
      'AreaOfInterestSystem',
      'RenderSystem',
      'NetworkCompressionSystem',
      'InputAnimationSystem',
      'AnimationSystem',
      'NetworkTickSystem',
      'NetworkSystem',
      'PlayerManager',
      'NetworkAnimationSystem',
      'NPCSystem',
      'CharacterSelectionSystem'
    ]);

    Logger.info(LogCategory.CORE, '🎮 GameManager initialized with 15 systems');
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, '🎯 Starting game initialization...');

      // 1. Initialize terrain service early (optimized for speed)
      Logger.info(LogCategory.CORE, '🌍 Initializing terrain service...');
      const terrainService = container.resolve(ServiceTokens.TERRAIN_SERVICE) as any;
      await terrainService.initialize();
      Logger.info(LogCategory.CORE, '✅ Terrain service initialized');

      // 2. Initialize scene (optimized for speed)
      Logger.info(LogCategory.CORE, '🎨 Initializing scene...');
      await this.sceneManager.initialize(canvas);
      Logger.info(LogCategory.CORE, '✅ Scene initialized');
      
      Logger.info(LogCategory.CORE, '🌲 Loading terrain...');
      await this.sceneManager.loadTerrain();
      Logger.info(LogCategory.CORE, '✅ Terrain loaded');
      
      Logger.info(LogCategory.CORE, '🌳 Loading forest...');
      await this.sceneManager.loadForest();
      Logger.info(LogCategory.CORE, '✅ Forest loaded');
      
      // 3. Wait for scene readiness
      await this.waitForSceneReady();
      
      // 4. Connect to multiplayer BEFORE creating player to get saved position
      Logger.info(LogCategory.NETWORK, '🌐 Attempting multiplayer connection...');
      let savedPlayerData: { position: any; rotationY: number } | null = null;
      
      try {
        // POSITION PERSISTENCE FIX: Set up event listener BEFORE connecting to network
        // This ensures the listener is ready when the server sends the init message immediately
        const savedPositionPromise = new Promise<{ position: any; rotationY: number } | null>((resolve) => {
          let resolved = false;
          
          // Listen for saved position from server
          this.eventBus.subscribe('apply_saved_position', (data: { position: any; rotationY: number }) => {
            Logger.info(LogCategory.PLAYER, '📍 Received saved position from server:', data.position);
            if (!resolved) {
              resolved = true;
              resolve(data);
            }
          });
          
          // POSITION PERSISTENCE FIX: Reduced timeout to 2 seconds for faster response
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              Logger.warn(LogCategory.PLAYER, '⚠️ Timeout waiting for saved position from server (2s), will use random spawn');
              resolve(null);
            }
          }, 2000); // Reduced from 5000ms to 2000ms for faster response
        });
        
        // POSITION PERSISTENCE FIX: Connect to network AFTER setting up event listener
        await this.networkSystem.connect();
        Logger.info(LogCategory.NETWORK, '✅ Multiplayer connection established');
        
        // POSITION PERSISTENCE FIX: Wait for WebSocket to be ready before waiting for saved position
        // This ensures the event listener is set up before the server sends the init message
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
        
        // Wait for saved position with timeout
        Logger.info(LogCategory.PLAYER, '⏳ Waiting for saved position from server...');
        savedPlayerData = await savedPositionPromise;
        
        if (savedPlayerData) {
          Logger.info(LogCategory.PLAYER, '✅ Saved position received successfully:', savedPlayerData.position);
        } else {
          Logger.warn(LogCategory.PLAYER, '⚠️ No saved position received from server, will use random spawn');
          // POSITION PERSISTENCE FIX: Set savedPlayerData to null explicitly to ensure random spawn
          savedPlayerData = null;
        }
        
      } catch (networkError) {
        Logger.warn(LogCategory.NETWORK, '⚠️ Multiplayer connection failed, continuing in single-player mode', networkError);
      }
      
      // 5. Create local player (will use saved position if available)
      await this.createLocalPlayer(savedPlayerData);
      Logger.info(LogCategory.PLAYER, `🎮 Local player created: ${this.localPlayer?.id.value}`);
      
      // 6. Start input listening
      this.inputManager.startListening();
      Logger.info(LogCategory.INPUT, '🎮 Input listening started - WASD controls active!');
      
      // 7. Initialize character selection system
      Logger.info(LogCategory.CORE, '🎭 Character selection system initialized');
      
      // Listen for character selection changes to update camera
      this.eventBus.subscribe('character:selection_changed', (event: any) => {
        Logger.info(LogCategory.CORE, `🎭 Character changed to: ${event.selectedCharacter}`);
        
        // FIXED: Notify animation system of character change
        this.eventBus.emit('player:character_changed', {
          playerId: this.localPlayer?.id.value,
          characterType: event.selectedCharacter,
          characterConfig: event.characterConfig,
          timestamp: Date.now()
        });
        
        // Update camera to follow the new character
        if (this.localPlayer) {
          this.updateCameraToFollowLocalPlayer();
        }
      });
      
      // FIXED: Listen for game character ready event
      this.eventBus.subscribe('game:character_ready', (event: any) => {
        Logger.info(LogCategory.CORE, `🎭 Game character ready: ${event.characterType}`);
        
        // Notify animation system that character is ready
        this.eventBus.emit('player:animation_ready', {
          playerId: this.localPlayer?.id.value,
          characterType: event.characterType,
          characterConfig: event.characterConfig,
          timestamp: Date.now()
        });
      });
      
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
    console.log('[GameManager] 🚀 start() method called');
    
    if (this.isRunning) {
      console.log('[GameManager] ⚠️ Game already running, skipping start');
      return;
    }
    
    this.isRunning = true;
    console.log('[GameManager] ✅ isRunning set to true, calling gameLoop()');
    
    try {
      this.gameLoop();
      console.log('[GameManager] ✅ Initial gameLoop() call completed');
    } catch (error) {
      console.error('[GameManager] 💥 Error starting game loop:', error);
      this.isRunning = false;
    }
  }

  stop(): void {
    this.isRunning = false;
    this.inputManager.stopListening();
  }

  private async createLocalPlayer(savedPlayerData: { position: any; rotationY: number } | null): Promise<void> {
    try {
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Starting local player creation...`);
      
      // Get PlayerFactory from container
      const playerFactory = container.resolve(ServiceTokens.PLAYER_FACTORY) as any;
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: PlayerFactory resolved successfully`);
      
      // Get persistent squirrel ID or generate new one
      let squirrelId = this.getPersistentSquirrelId();
      if (!squirrelId) {
        squirrelId = crypto.randomUUID();
        this.setPersistentSquirrelId(squirrelId);
      }
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Using player ID: ${squirrelId}`);
      
      // Get selected character type
      const characterSelectionManager = container.resolve(ServiceTokens.CHARACTER_SELECTION_MANAGER) as any;
      const selectedCharacter = characterSelectionManager.getSelectedCharacter();
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Selected character type: ${selectedCharacter}`);
      
      // Create local player entity using appropriate method
      if (savedPlayerData) {
        Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Creating local player with saved position data`);
        this.localPlayer = await playerFactory.createLocalPlayerWithPosition(
          squirrelId, 
          savedPlayerData.position, 
          savedPlayerData.rotationY, 
          selectedCharacter
        );
      } else {
        Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Creating local player with random spawn`);
        this.localPlayer = await playerFactory.createLocalPlayer(squirrelId, selectedCharacter);
      }
      
      if (!this.localPlayer) {
        throw new Error('Failed to create local player entity');
      }
      
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Local player entity created: ${this.localPlayer.id.value}`);
      
      // Add to ECS
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Adding local player entity to ECS...`);
      this.entityManager.addEntity(this.localPlayer);
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Local player entity added to ECS: ${this.localPlayer.id.value}`);

      // One-time snapshot: log player mesh and camera info
      const renderComp = this.localPlayer.getComponent<any>('render');
      if (renderComp && renderComp.mesh) {
        const pos = renderComp.mesh.position;
        const scale = renderComp.mesh.scale;
        Logger.warn(LogCategory.PLAYER, `[SNAPSHOT] 🗺️ Player mesh position: (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
        Logger.warn(LogCategory.PLAYER, `[SNAPSHOT] 📏 Player mesh scale: (${scale.x.toFixed(2)}, ${scale.y.toFixed(2)}, ${scale.z.toFixed(2)})`);
      } else {
        Logger.warn(LogCategory.PLAYER, `[SNAPSHOT] ❌ No mesh found on player render component!`);
      }
      const camera = this.sceneManager.getCamera && this.sceneManager.getCamera();
      if (camera) {
        const cpos = camera.position;
        Logger.warn(LogCategory.PLAYER, `[SNAPSHOT] 🎥 Camera position: (${cpos.x.toFixed(2)}, ${cpos.y.toFixed(2)}, ${cpos.z.toFixed(2)})`);
        if ('target' in camera && camera.target) {
          const t = (camera as any).target;
          Logger.warn(LogCategory.PLAYER, `[SNAPSHOT] 🎯 Camera target: (${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)})`);
        }
      }
      
      // Log components for debugging
      const components = this.localPlayer.getComponents().map(c => c.type);
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Local player entity components: ${components.join(', ')}`);
      
      Logger.warn(LogCategory.PLAYER, `🎯 GameComposition: Local player creation complete!`);
      
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '🚨 Failed to create local player:', error);
      throw error;
    }
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    try {
      // ===========================================
      // 🚨 DEBUG TESTING COMPLETED - GAME LOOP RUNNING
      // ===========================================
      
      // ===========================================
      // 🚨 DEBUG LOGGING REMOVED - ISSUE RESOLVED
      // ===========================================
      // Character scale has been fixed from 0.3 to 1.0
      // Players should now be visible in the game

      const currentTime = performance.now();
      const deltaTime = (currentTime - this.lastFrameTime) / 1000;
      this.lastFrameTime = currentTime;

      this.safeSystemUpdate(deltaTime);
      this.checkCharacterSelectionInput();
      this.safeRender();

      requestAnimationFrame(this.gameLoop);
    } catch (error) {
      console.error('💥 [GameLoop] Critical error:', error);
      this.isRunning = false;
    }
  }

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
    if (!this.localPlayer) {
      return;
    }
    
    const position = this.localPlayer.getComponent<PositionComponent>('position');
    const rotation = this.localPlayer.getComponent<RotationComponent>('rotation');
    
    if (position && rotation) {
      Logger.debug(LogCategory.RENDER, `🎥 Updating camera to follow player at (${position.value.x.toFixed(1)}, ${position.value.y.toFixed(1)}, ${position.value.z.toFixed(1)})`);
      this.sceneManager.updateCameraToFollowPlayer(
        { x: position.value.x, y: position.value.y, z: position.value.z },
        { y: rotation.value.y }
      );
    }
  }

  private checkCharacterSelectionInput(): void {
    // Check if 'C' key is pressed to open character selection
    if (this.inputManager.checkCharacterSelectionKey()) {
      // Initialize gallery if not already done
      if (!this.characterSelectionSystem) {
        Logger.warn(LogCategory.CORE, 'Character selection system not available');
        return;
      }
      
      // Show character gallery
      this.characterSelectionSystem.showCharacterGallery();
      
      // Clear the key to prevent repeated triggers
      // Note: This is a simple approach - in a real implementation you'd want to track key states more carefully
    }
  }

  // Public getters for debug UI access
  public getEventBus(): EventBus { return this.eventBus; }
  public getPlayerManager(): PlayerManager { return this.playerManager; }
  public getNetworkSystem(): NetworkSystem { return this.networkSystem; }
  public getLocalPlayer(): Entity | undefined { return this.localPlayer; }
  public getCharacterSelectionSystem(): CharacterSelectionSystem { return this.characterSelectionSystem; }

  // MULTIPLAYER FIX: Use sessionStorage for unique squirrelId per browser session
  private getPersistentSquirrelId(): string | null {
    try {
      // Use sessionStorage for unique ID per browser session (prevents multiplayer conflicts)
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
      // Store in sessionStorage for unique ID per browser session
      sessionStorage.setItem('squirrelId', squirrelId);
      Logger.debug(LogCategory.PLAYER, `💾 Stored squirrelId in sessionStorage: ${squirrelId}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to store squirrelId in sessionStorage:', error);
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

  container.registerSingleton(ServiceTokens.ASSET_MANAGER, () => new AssetManager());

  container.registerSingleton(ServiceTokens.TERRAIN_SERVICE, () => {
    return new TerrainService();
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

  container.registerSingleton(ServiceTokens.PLAYER_MANAGER, () => {
    return new PlayerManager(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  container.registerSingleton(ServiceTokens.NPC_SYSTEM, () => {
    return new NPCSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      container.resolve(ServiceTokens.TERRAIN_SERVICE)
    );
  });

  container.registerSingleton(ServiceTokens.CHARACTER_SELECTION_SYSTEM, () => {
    return new CharacterSelectionSystem(
      container.resolve(ServiceTokens.CHARACTER_REGISTRY),
      container.resolve(ServiceTokens.CHARACTER_SELECTION_MANAGER),
      container.resolve(ServiceTokens.ANIMATED_MODEL_LOADER),
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS)
    );
  });

  // Register RenderSystem with render adapter
  container.registerSingleton(ServiceTokens.RENDER_SYSTEM, () => {
    const renderAdapter = new ThreeJSRenderAdapter();
    return new RenderSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS),
      renderAdapter
    );
  });

  // Register InputAnimationSystem
  container.registerSingleton(ServiceTokens.INPUT_ANIMATION_SYSTEM, () => {
    return new InputAnimationSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS)
    );
  });

  // Register AnimationSystem
  container.registerSingleton(ServiceTokens.ANIMATION_SYSTEM, () => {
    return new AnimationSystem(
      container.resolve<EventBus>(ServiceTokens.EVENT_BUS)
    );
  });

  // Character Selection System - temporarily disabled to fix browser compatibility
  // Will be re-enabled once proper ES6 module loading is implemented

  Logger.info(LogCategory.CORE, '🏗️ All services configured successfully');
} 