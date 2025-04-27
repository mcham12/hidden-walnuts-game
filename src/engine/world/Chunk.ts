import * as THREE from 'three';

export class Chunk {
    public x: number;
    public z: number;
    public size: number;
    public group: THREE.Group | null = null;
    public objects: THREE.Object3D[] = [];
    public instancedGroups: Map<string, THREE.InstancedMesh> = new Map();
    public isLoaded: boolean = false;

    constructor(x: number, z: number, size: number) {
        this.x = x;
        this.z = z;
        this.size = size;
    }

    public get bounds(): THREE.Box3 {
        return new THREE.Box3(
            new THREE.Vector3(this.x, 0, this.z),
            new THREE.Vector3(this.x + this.size, 0, this.z + this.size)
        );
    }
} 