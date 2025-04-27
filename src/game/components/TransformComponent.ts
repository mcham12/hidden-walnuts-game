import * as THREE from 'three';
import { Component } from '../../engine/core/Component';

export class TransformComponent extends Component {
    private position: THREE.Vector3;
    private rotation: THREE.Euler;
    private scale: THREE.Vector3;

    constructor(
        position: THREE.Vector3 = new THREE.Vector3(),
        scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
        rotation: THREE.Euler = new THREE.Euler()
    ) {
        super();
        this.position = position.clone();
        this.rotation = rotation.clone();
        this.scale = scale.clone();
    }

    update(deltaTime: number): void {
        if (!this.entity) return;

        const object3D = this.entity.getObject3D();
        if (object3D) {
            object3D.position.copy(this.position);
            object3D.rotation.copy(this.rotation);
            object3D.scale.copy(this.scale);
        }
    }

    setPosition(position: THREE.Vector3): void {
        this.position.copy(position);
    }

    setRotation(rotation: THREE.Euler): void {
        this.rotation.copy(rotation);
    }

    setScale(scale: THREE.Vector3): void {
        this.scale.copy(scale);
    }

    getPosition(): THREE.Vector3 {
        return this.position.clone();
    }

    getRotation(): THREE.Euler {
        return this.rotation.clone();
    }

    getScale(): THREE.Vector3 {
        return this.scale.clone();
    }

    protected onCleanup(): void {
        // No cleanup needed for transform data
    }
} 