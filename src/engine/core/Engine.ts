import * as THREE from 'three';
import { Scene } from './Scene';
import { Renderer } from '../rendering/Renderer';
import { InputManager } from '../input/InputManager';
import { PhysicsSystem } from '../physics/PhysicsSystem';
import { AssetManager } from '../assets/AssetManager';
import { EventSystem } from './EventSystem';
import Stats from 'three/examples/jsm/libs/stats.module';
import { Logger } from './Logger';

export interface EngineConfig {
    containerId?: string;
    width?: number;
    height?: number;
    debug?: boolean;
}

export class Engine {
    private scenes: Map<string, Scene>;
    private currentScene: Scene | null;
    private assetManager: AssetManager;
    private inputManager: InputManager;
    private physicsSystem: PhysicsSystem;
    private renderer: Renderer;
    private eventSystem: EventSystem;
    private clock: THREE.Clock;
    private stats?: Stats;
    private isRunning: boolean;
    private lastTime: number;
    private readonly fixedTimeStep: number = 1.0 / 60.0;

    constructor(private config: EngineConfig = {}) {
        this.scenes = new Map();
        this.currentScene = null;
        this.clock = new THREE.Clock();
        this.isRunning = false;
        this.lastTime = 0;
        
        // Initialize core systems
        Logger.info('Initializing core engine systems...');
        this.eventSystem = new EventSystem();
        this.assetManager = AssetManager.getInstance();
        this.inputManager = new InputManager(this.eventSystem);
        this.renderer = new Renderer(config);
        this.physicsSystem = new PhysicsSystem();

        if (config.debug) {
            this.initializeDebugTools();
        }
    }

    private initializeDebugTools(): void {
        this.stats = new Stats();
        document.body.appendChild(this.stats.dom);
    }

    async initialize(): Promise<void> {
        try {
            Logger.info('Starting engine initialization...');
            // Initialize all systems
            await this.assetManager.initialize();
            Logger.info('AssetManager initialized successfully');
            
            this.inputManager.initialize();
            Logger.info('InputManager initialized successfully');
            
            this.renderer.initialize();
            Logger.info('Renderer initialized successfully');
            
            this.physicsSystem.initialize();
            Logger.info('PhysicsSystem initialized successfully');

            // Start the game loop
            this.isRunning = true;
            Logger.info('Engine initialization complete, starting game loop');
            this.gameLoop();
        } catch (error) {
            Logger.error('Failed to initialize engine:', error);
            throw error;
        }
    }

    addScene(name: string, scene: Scene): void {
        this.scenes.set(name, scene);
    }

    async loadScene(name: string): Promise<void> {
        const scene = this.scenes.get(name);
        if (!scene) {
            throw new Error(`Scene ${name} not found`);
        }

        // Cleanup current scene if it exists
        if (this.currentScene) {
            this.currentScene.cleanup();
        }

        // Load and initialize new scene
        this.currentScene = scene;
        await this.currentScene.initialize(this);
    }

    private gameLoop = (): void => {
        if (!this.isRunning) return;

        requestAnimationFrame(this.gameLoop);

        const time = this.clock.getElapsedTime();
        const deltaTime = time - this.lastTime;
        this.lastTime = time;

        // Update input
        this.inputManager.update();

        // Fixed timestep updates for physics
        this.physicsSystem.update(this.fixedTimeStep);

        // Update current scene
        if (this.currentScene) {
            this.currentScene.update(deltaTime);
        }

        // Render
        if (this.currentScene) {
            this.renderer.render(this.currentScene);
        }

        // Update debug tools
        if (this.stats) {
            this.stats.update();
        }
    }

    stop(): void {
        this.isRunning = false;
    }

    resume(): void {
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = this.clock.getElapsedTime();
            this.gameLoop();
        }
    }

    cleanup(): void {
        this.stop();
        if (this.currentScene) {
            this.currentScene.cleanup();
        }
        this.renderer.cleanup();
        this.inputManager.cleanup();
        this.assetManager.cleanup();
        if (this.stats) {
            document.body.removeChild(this.stats.dom);
        }
    }

    // Getters for accessing core systems
    getEventSystem(): EventSystem { return this.eventSystem; }
    getAssetManager(): AssetManager { return this.assetManager; }
    getInputManager(): InputManager { return this.inputManager; }
    getRenderer(): Renderer { return this.renderer; }
    getPhysicsSystem(): PhysicsSystem { return this.physicsSystem; }
} 