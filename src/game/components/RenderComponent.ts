import * as THREE from 'three';
import { Component } from '../../engine/core/Component';
import { Entity } from '../../engine/core/Entity';

interface RenderOptions {
    castShadow?: boolean;
    receiveShadow?: boolean;
    material?: THREE.Material;
}

export class RenderComponent extends Component {
    private modelKey: string;
    private options: RenderOptions;
    private isLoaded: boolean = false;

    constructor(modelKey: string, options: RenderOptions = {}) {
        super();
        this.modelKey = modelKey;
        this.options = options;
    }

    onAdd(entity: Entity): void {
        super.onAdd(entity);
        this.loadModel();
    }

    private async loadModel(): Promise<void> {
        if (!this.entity || this.isLoaded) return;

        try {
            const scene = this.entity.getScene();
            if (!scene) return;

            const engine = scene.getEngine();
            if (!engine) return;

            const assetManager = engine.getAssetManager();
            const model = assetManager.getModel(this.modelKey);

            if (model) {
                // Apply render options
                model.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        if (this.options.castShadow !== undefined) {
                            object.castShadow = this.options.castShadow;
                        }
                        if (this.options.receiveShadow !== undefined) {
                            object.receiveShadow = this.options.receiveShadow;
                        }
                        if (this.options.material) {
                            object.material = this.options.material;
                        }
                    }
                });

                this.entity.setObject3D(model);
                this.isLoaded = true;
            } else {
                console.error(`Model ${this.modelKey} not found in asset manager`);
            }
        } catch (error) {
            console.error(`Failed to load model ${this.modelKey}:`, error);
        }
    }

    update(deltaTime: number): void {
        // Add any per-frame rendering updates here
    }

    protected onCleanup(): void {
        const object3D = this.entity?.getObject3D();
        if (object3D) {
            object3D.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
} 