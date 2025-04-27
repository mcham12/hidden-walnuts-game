import * as THREE from 'three';

/**
 * A generic object pool for managing and reusing game objects
 */
export class ObjectPool {
    private available: THREE.Object3D[] = [];
    private inUse: THREE.Object3D[] = [];
    private createFn: () => THREE.Object3D;

    constructor(createFn: () => THREE.Object3D, initialSize: number = 10) {
        this.createFn = createFn;
        this.initialize(initialSize);
    }

    private initialize(size: number): void {
        for (let i = 0; i < size; i++) {
            this.available.push(this.createFn());
        }
    }

    acquire(): THREE.Object3D {
        let object: THREE.Object3D;
        
        if (this.available.length > 0) {
            object = this.available.pop()!;
        } else {
            object = this.createFn();
        }

        this.inUse.push(object);
        return object;
    }

    release(object: THREE.Object3D): void {
        const index = this.inUse.indexOf(object);
        if (index !== -1) {
            this.inUse.splice(index, 1);
            this.available.push(object);
        }
    }

    clear(): void {
        this.available = [];
        this.inUse = [];
    }

    getActiveCount(): number {
        return this.inUse.length;
    }

    getTotalCount(): number {
        return this.available.length + this.inUse.length;
    }
} 