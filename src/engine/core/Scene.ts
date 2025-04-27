import * as THREE from 'three';
import { Entity } from './Entity';
import { Engine } from './Engine';
import { EventSystem } from './EventSystem';
import { Logger } from './Logger';

export abstract class Scene extends THREE.Scene {
    protected camera: THREE.PerspectiveCamera;
    protected engine: Engine | null;
    protected entities: Map<string, Entity>;
    protected isInitialized: boolean;
    protected eventSystem: EventSystem;

    constructor() {
        super();
        this.engine = null;
        this.entities = new Map();
        this.isInitialized = false;
        this.eventSystem = new EventSystem();
        
        // Setup default camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
    }

    async initialize(engine: Engine): Promise<void> {
        if (this.isInitialized) {
            Logger.warn('Scene already initialized');
            return;
        }

        this.engine = engine;
        this.isInitialized = true;
        await this.onInitialize();
    }

    update(deltaTime: number): void {
        // Update all entities
        this.entities.forEach(entity => {
            entity.update(deltaTime);
        });

        this.onUpdate(deltaTime);
    }

    addEntity(entity: Entity): void {
        const id = entity.getId();
        if (this.entities.has(id)) {
            Logger.warn(`Entity with id ${id} already exists in scene`);
            return;
        }

        this.entities.set(id, entity);
        entity.onAdd(this);
        
        // If entity has a THREE.Object3D, add it to the scene
        const mesh = entity.getMesh();
        if (mesh) {
            this.add(mesh);
        }
    }

    removeEntity(entityId: string): void {
        const entity = this.entities.get(entityId);
        if (!entity) return;

        // Remove from THREE.Scene if it has a 3D object
        const mesh = entity.getMesh();
        if (mesh) {
            this.remove(mesh);
        }

        entity.onRemove();
        this.entities.delete(entityId);
    }

    getEntity(entityId: string): Entity | undefined {
        return this.entities.get(entityId);
    }

    getEntities(): Entity[] {
        return Array.from(this.entities.values());
    }

    getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    cleanup(): void {
        // Cleanup all entities
        this.entities.forEach(entity => {
            entity.cleanup();
        });
        this.entities.clear();

        // Cleanup THREE.Scene
        this.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            }
        });

        this.onCleanup();
        this.isInitialized = false;
        this.engine = null;
    }

    protected abstract onInitialize(): Promise<void>;
    protected abstract onUpdate(deltaTime: number): void;
    protected abstract onCleanup(): void;
} 