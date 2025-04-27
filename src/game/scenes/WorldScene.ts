import { Scene } from '../../engine/core/Scene';
import { Logger } from '../../engine/core/Logger';
import { Engine } from '../../engine/core/Engine';
import * as THREE from 'three';
import { WorldGenerator } from '../../engine/world/WorldGenerator';
import { worldConfig } from '../../config/world.config';
import { AssetManager } from '../../engine/assets/AssetManager';
import { PlayerEntity } from '../entities/PlayerEntity';
import { PlayerController } from '../controllers/PlayerController';

export class WorldScene extends Scene {
    private generator: WorldGenerator | null;
    private boundOnResize: () => void;
    private players: Map<string, PlayerEntity> = new Map();
    private localPlayer: PlayerEntity | null = null;
    private playerController: PlayerController | null = null;

    constructor() {
        super();
        this.generator = null;
        this.boundOnResize = this.onResize.bind(this);
    }

    protected async onInitialize(): Promise<void> {
        if (!this.engine) {
            Logger.error('Engine not initialized');
            return;
        }

        // --- TEST MODE: Add a huge, bright red ground and axes helper if VITE_USE_TEST_SCENE is true ---
        if (import.meta.env.VITE_USE_TEST_SCENE === 'true') {
            const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 1, 1);
            const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
            const ground = new THREE.Mesh(groundGeometry, groundMaterial);
            ground.rotation.x = -Math.PI / 2;
            ground.position.y = 0;
            this.add(ground);
            Logger.info('Test mode: Added huge bright red ground mesh.');

            // Add ground to physics system as static object
            const physicsSystem = this.engine.getPhysicsSystem();
            physicsSystem.addObject(ground, {
                isStatic: true,
                shape: 'box',
                dimensions: { x: 2000, y: 0.1, z: 2000 }
            });

            // Move camera up and back for guaranteed visibility
            this.camera.position.set(0, 100, 100);
            this.camera.lookAt(0, 0, 0);

            // Add axes helper
            const axesHelper = new THREE.AxesHelper(50);
            this.add(axesHelper);
            Logger.info('Test mode: Added AxesHelper.');
        }
        // --- END TEST MODE ---

        // Set a visible background color
        this.background = new THREE.Color(0x87ceeb); // Sky blue

        // Initialize physics system
        const physicsSystem = this.engine.getPhysicsSystem();
        this.userData.physicsSystem = physicsSystem;

        // Move camera up and back for guaranteed visibility
        this.camera.position.set(0, 50, 100);
        this.camera.lookAt(0, 0, 0);

        // Add axes helper for orientation
        const axesHelper = new THREE.AxesHelper(50);
        this.add(axesHelper);

        // Add a bright ambient light for visibility
        const brightAmbient = new THREE.AmbientLight(0xffffff, 1.5);
        this.add(brightAmbient);

        // Load local player model and set up player entity/controller
        const assetManager = AssetManager.getInstance();
        const groundY = 0.5; // Start at ground level
        const playerModel = await assetManager.loadModel('squirrel.glb');
        playerModel.position.set(0, groundY, 0); // Start at ground level
        playerModel.scale.set(0.05, 0.05, 0.05); // Scale down to 5% of original size
        this.add(playerModel);
        const localPlayer = new PlayerEntity('local', playerModel);
        this.players.set(localPlayer.id, localPlayer);
        this.localPlayer = localPlayer;

        // Initialize player controller with physics
        this.playerController = new PlayerController(
            localPlayer,
            this.camera,
            this.engine.getRenderer().getDomElement(),
            physicsSystem
        );

        // Initialize world generator
        this.generator = new WorldGenerator(this, worldConfig, assetManager);
        await this.generator.generate();

        // After world generation, log all meshes in the scene to identify the real terrain mesh
        this.children.forEach(obj => {
            if (obj instanceof THREE.Mesh) {
                console.log('[Debug] Mesh:', obj.name, obj.position, obj.rotation, obj.geometry.type, obj.material?.type);
            }
        });
        // Log player position and intersecting mesh
        if (playerModel) {
            console.log('[Debug] Player position:', playerModel.position);
            // Check for intersection with any mesh
            this.children.forEach(obj => {
                if (obj instanceof THREE.Mesh && obj !== playerModel) {
                    const box1 = new THREE.Box3().setFromObject(playerModel);
                    const box2 = new THREE.Box3().setFromObject(obj);
                    if (box1.intersectsBox(box2)) {
                        console.log('[Debug] Player intersects mesh:', obj.name, obj.position, obj.geometry.type);
                    }
                }
            });
        }

        // After world generation, try to find the terrain mesh and set its color
        const terrain = this.children.find(obj => obj.name && obj.name.toLowerCase().includes('terrain')) as THREE.Mesh;
        if (terrain && terrain.material) {
            const setGreen = (mat: THREE.Material) => {
                if (
                    mat instanceof THREE.MeshStandardMaterial ||
                    mat instanceof THREE.MeshLambertMaterial ||
                    mat instanceof THREE.MeshPhongMaterial ||
                    mat instanceof THREE.MeshBasicMaterial
                ) {
                    mat.color.set(0x228B22); // Forest green
                }
            };
            if (Array.isArray(terrain.material)) {
                terrain.material.forEach(setGreen);
            } else {
                setGreen(terrain.material);
            }
        }

        // Handle window resize
        window.addEventListener('resize', this.boundOnResize);
        
        // Lighting from config
        const ambient = new THREE.AmbientLight(
            worldConfig.lighting.ambient.color,
            worldConfig.lighting.ambient.intensity
        );
        this.add(ambient);
        const dir = new THREE.DirectionalLight(
            worldConfig.lighting.directional.color,
            worldConfig.lighting.directional.intensity
        );
        dir.position.set(...worldConfig.lighting.directional.position);
        dir.castShadow = true;
        this.add(dir);

        Logger.info('WorldScene initialized');
    }

    protected onUpdate(deltaTime: number): void {
        if (!this.engine) return;
        
        if (this.playerController) {
            this.playerController.update(deltaTime);
        }
        
        // Update physics
        this.engine.getPhysicsSystem().update(deltaTime);
    }

    private onResize(): void {
        if (this.camera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
    }

    protected onCleanup(): void {
        window.removeEventListener('resize', this.boundOnResize);
        if (this.generator) {
            this.generator.dispose();
            this.generator = null;
        }
    }
} 