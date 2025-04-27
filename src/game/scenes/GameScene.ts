import * as THREE from 'three';
import { Scene } from '../../engine/core/Scene';
import { AssetManager } from '../../engine/assets/AssetManager';
import { LODSystem } from '../../engine/rendering/LODSystem';
import { FrustumCullingSystem } from '../../engine/rendering/FrustumCullingSystem';
import { EventSystem } from '../../engine/core/EventSystem';
import { TreeEntity } from '../entities/TreeEntity';
import { Logger } from '../../engine/core/Logger';

export class GameScene extends Scene {
    private assetManager: AssetManager;
    private lodSystem: LODSystem;
    private frustumCulling: FrustumCullingSystem;
    private ground: THREE.Mesh | null = null;

    constructor() {
        super();
        this.assetManager = AssetManager.getInstance();
        this.lodSystem = new LODSystem(this.camera, this.eventSystem);
        this.frustumCulling = new FrustumCullingSystem(this.camera, this.eventSystem);
    }

    protected async onInitialize(): Promise<void> {
        try {
            // Initialize AssetManager first
            Logger.info('Initializing AssetManager...');
            await this.assetManager.initialize();
            Logger.info('AssetManager initialized successfully');

            // Setup scene
            this.setupLighting();
            await this.createGround();
            await this.createTrees();

            // Setup event listeners
            this.eventSystem.on('lodLevelChanged', (data: { objectId: string; level: number }) => {
                Logger.debug(`LOD level changed for object ${data.objectId} to level ${data.level}`);
            });

            this.eventSystem.on('visibilityChanged', (data: { objectId: string; visible: boolean }) => {
                Logger.debug(`Visibility changed for object ${data.objectId}: ${data.visible}`);
            });
        } catch (error) {
            Logger.error('Failed to initialize GameScene:', error);
            throw error;
        }
    }

    private setupLighting(): void {
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        this.add(directionalLight);
    }

    private async createGround(): Promise<void> {
        const geometry = new THREE.PlaneGeometry(1000, 1000);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a5f0b,
            roughness: 0.8,
            metalness: 0.2
        });

        this.ground = new THREE.Mesh(geometry, material);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.add(this.ground);

        // Add ground to frustum culling
        this.frustumCulling.addObject('ground', this.ground);
    }

    private async createTrees(): Promise<void> {
        const treePositions = [
            { x: 10, z: 10 },
            { x: -15, z: 20 },
            { x: 5, z: -10 },
            // Add more positions as needed
        ];

        for (let i = 0; i < treePositions.length; i++) {
            try {
                const treeId = `tree_${i}`;
                const treeEntity = new TreeEntity(
                    treeId,
                    'CommonTree_Snow_1.fbx',
                    new THREE.Vector3(treePositions[i].x, 0, treePositions[i].z),
                    new THREE.Euler(),
                    new THREE.Vector3(0.1, 0.1, 0.1)
                );

                await treeEntity.initialize();
                this.addEntity(treeEntity);

                const treeMesh = treeEntity.getMesh();
                if (treeMesh) {
                    // Add tree to LOD system with different detail levels
                    this.lodSystem.addObject(treeId, [
                        { distance: 0, object: treeMesh },
                        { distance: 50, object: this.createSimplifiedTree() },
                        { distance: 100, object: this.createBillboardTree() }
                    ]);

                    // Add tree to frustum culling
                    this.frustumCulling.addObject(treeId, treeMesh);
                }
            } catch (error) {
                Logger.error(`Failed to create tree at position ${i}:`, error);
            }
        }
    }

    private createSimplifiedTree(): THREE.Object3D {
        const geometry = new THREE.CylinderGeometry(0.5, 1, 5, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
        return new THREE.Mesh(geometry, material);
    }

    private createBillboardTree(): THREE.Object3D {
        const geometry = new THREE.PlaneGeometry(4, 6);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x2d5a27,
            side: THREE.DoubleSide
        });
        return new THREE.Mesh(geometry, material);
    }

    protected onUpdate(deltaTime: number): void {
        // Update LOD and frustum culling systems
        this.lodSystem.update();
        this.frustumCulling.update();
    }

    protected onCleanup(): void {
        // Cleanup systems
        this.lodSystem.cleanup();
        this.frustumCulling.cleanup();
        this.assetManager.cleanup();

        // Clean up event listeners
        this.eventSystem.clear();
    }
} 