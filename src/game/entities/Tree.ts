import * as THREE from 'three';
import { Entity } from '../../engine/core/Entity';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';

export class Tree extends Entity {
    constructor(position: THREE.Vector3, scale: THREE.Vector3) {
        super();
        
        // Add transform component
        this.addComponent(new TransformComponent(position, scale));
        
        // Add render component
        this.addComponent(new RenderComponent('BirchTree_1.fbx', {
            castShadow: true,
            receiveShadow: true
        }));
    }

    protected onUpdate(deltaTime: number): void {
        // Add any tree-specific update logic here
    }

    protected onCleanup(): void {
        // Add any tree-specific cleanup here
    }
} 