import * as THREE from 'three';
import { Entity } from '../../engine/core/Entity';
import { AssetManager } from '../../engine/assets/AssetManager';
import { Logger } from '../../engine/core/Logger';

export class TreeEntity extends Entity {
    private modelPath: string;
    private position: THREE.Vector3;
    private rotation: THREE.Euler;
    private scale: THREE.Vector3;

    constructor(
        id: string,
        modelPath: string,
        position: THREE.Vector3 = new THREE.Vector3(),
        rotation: THREE.Euler = new THREE.Euler(),
        scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)
    ) {
        super(id);
        this.modelPath = modelPath;
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
    }

    async initialize(): Promise<void> {
        try {
            Logger.info(`Loading tree model: ${this.modelPath}`);
            // Note: AssetManager should be passed in or accessed through a service locator
            this.mesh = await AssetManager.getInstance().loadModel(this.modelPath);
            
            if (this.mesh) {
                this.mesh.position.copy(this.position);
                this.mesh.rotation.copy(this.rotation);
                this.mesh.scale.copy(this.scale);
                
                // Add shadow casting/receiving
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            } else {
                throw new Error('Failed to load tree model');
            }
        } catch (error) {
            Logger.error('Error initializing TreeEntity:', error);
            throw error;
        }
    }

    protected onUpdate(deltaTime: number): void {
        // Add any tree-specific update logic here
        // For example, swaying in the wind, etc.
    }

    protected onCleanup(): void {
        // Add any tree-specific cleanup logic here
        // Base class handles mesh disposal
    }

    setPosition(position: THREE.Vector3): void {
        this.position.copy(position);
        if (this.mesh) {
            this.mesh.position.copy(position);
        }
    }

    setRotation(rotation: THREE.Euler): void {
        this.rotation.copy(rotation);
        if (this.mesh) {
            this.mesh.rotation.copy(rotation);
        }
    }

    setScale(scale: THREE.Vector3): void {
        this.scale.copy(scale);
        if (this.mesh) {
            this.mesh.scale.copy(scale);
        }
    }
} 