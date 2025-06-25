// Composition Root - Where A++ architecture comes together

import { container, ServiceTokens } from './core/Container';
import { EventBus } from './core/EventBus';
import { EntityManager } from './ecs';
import { MovementSystem } from './systems/MovementSystem';
import { InterpolationSystem } from './systems/InterpolationSystem';
import { MovementConfig, WorldBounds } from './core/types';

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
}

export class AssetManager implements IAssetManager {
  private cache = new Map<string, any>();

  async loadSquirrelModel(): Promise<import('three').Group> {
    if (this.cache.has('squirrel')) {
      return this.cache.get('squirrel').clone();
    }

    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    
    const loader = new GLTFLoader();
    
    return new Promise((resolve, reject) => {
      loader.load(
        'assets/models/squirrel.glb',
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(0.5);
          model.castShadow = true;
          model.receiveShadow = true;
          
          this.cache.set('squirrel', model);
          resolve(model.clone());
        },
        undefined,
        reject
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
  private isRunning = false;

  constructor() {
    // All dependencies injected, not created
    this.eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    this.entityManager = container.resolve<EntityManager>(ServiceTokens.ENTITY_MANAGER);
    this.sceneManager = container.resolve<ISceneManager>(ServiceTokens.SCENE_MANAGER);
    this.inputManager = container.resolve<IInputManager>(ServiceTokens.INPUT_MANAGER);
    this.movementSystem = container.resolve<MovementSystem>(ServiceTokens.MOVEMENT_SYSTEM);
    this.interpolationSystem = container.resolve<InterpolationSystem>(ServiceTokens.INTERPOLATION_SYSTEM);
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    await this.sceneManager.initialize(canvas);
    await this.sceneManager.loadTerrain();
    
    this.inputManager.startListening();
    
    // Setup ECS systems
    this.entityManager.addSystem(this.movementSystem);
    this.entityManager.addSystem(this.interpolationSystem);

    this.eventBus.emit('game.initialized');
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

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const deltaTime = 1 / 60; // Fixed timestep for consistency
    
    // Update all ECS systems
    this.entityManager.update(deltaTime);
    
    // Render
    this.sceneManager.getRenderer().render(
      this.sceneManager.getScene(),
      this.sceneManager.getCamera()
    );

    requestAnimationFrame(this.gameLoop);
  };
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
} 