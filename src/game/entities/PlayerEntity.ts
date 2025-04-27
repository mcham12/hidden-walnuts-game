import * as THREE from 'three';

export class PlayerEntity {
    id: string;
    model: THREE.Object3D;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    velocity: THREE.Vector3;

    constructor(id: string, model: THREE.Object3D) {
        this.id = id;
        this.model = model;
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.velocity = new THREE.Vector3();
    }

    updateFromNetwork(data: any) {
        // TODO: Update position, rotation, etc. from backend data
        this.position.copy(data.position);
        this.rotation.copy(data.rotation);
        this.model.position.copy(this.position);
        this.model.rotation.copy(this.rotation);
    }

    serialize() {
        // TODO: Return serializable state for backend sync
        return {
            id: this.id,
            position: this.position.toArray(),
            rotation: [this.rotation.x, this.rotation.y, this.rotation.z],
        };
    }

    sendUpdateToBackend() {
        // TODO: Placeholder for sending player state to backend (Cloudflare Worker, etc)
    }
} 