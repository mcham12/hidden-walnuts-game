import * as THREE from 'three';
import { Component } from './Component';
import { Scene } from './Scene';
import { v4 as uuidv4 } from 'uuid';

export abstract class Entity {
    protected mesh: THREE.Object3D | null = null;
    private id: string;
    private components: Map<string, Component>;
    protected scene: Scene | null;

    constructor(id: string) {
        this.id = id;
        this.components = new Map();
        this.scene = null;
    }

    getId(): string {
        return this.id;
    }

    getMesh(): THREE.Object3D | null {
        return this.mesh;
    }

    addComponent<T extends Component>(component: T): void {
        const componentName = component.constructor.name;
        if (this.components.has(componentName)) {
            console.warn(`Component ${componentName} already exists on entity ${this.id}`);
            return;
        }

        this.components.set(componentName, component);
        component.onAdd(this);
    }

    removeComponent(componentName: string): void {
        const component = this.components.get(componentName);
        if (!component) return;

        component.onRemove();
        this.components.delete(componentName);
    }

    getComponent<T extends Component>(componentName: string): T | undefined {
        return this.components.get(componentName) as T;
    }

    hasComponent(componentName: string): boolean {
        return this.components.has(componentName);
    }

    update(deltaTime: number): void {
        // Update all components
        this.components.forEach(component => {
            component.update(deltaTime);
        });

        this.onUpdate(deltaTime);
    }

    protected abstract onUpdate(deltaTime: number): void;

    onAdd(scene: Scene): void {
        this.scene = scene;
    }

    onRemove(): void {
        this.scene = null;
    }

    cleanup(): void {
        // Cleanup all components
        this.components.forEach(component => {
            component.cleanup();
        });
        this.components.clear();

        // Cleanup 3D object if it exists
        if (this.mesh) {
            if (this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
            this.mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.mesh = null;
        }

        this.onCleanup();
    }

    protected abstract onCleanup(): void;

    abstract initialize(): Promise<void>;
} 