import * as THREE from 'three';
import { EventSystem } from '../core/EventSystem';

export class FrustumCullingSystem {
    private camera: THREE.Camera;
    private frustum: THREE.Frustum;
    private frustumMatrix: THREE.Matrix4;
    private objects: Map<string, THREE.Object3D>;
    private eventSystem: EventSystem;
    private boundingSpheres: Map<string, THREE.Sphere>;

    constructor(camera: THREE.Camera, eventSystem: EventSystem) {
        this.camera = camera;
        this.frustum = new THREE.Frustum();
        this.frustumMatrix = new THREE.Matrix4();
        this.objects = new Map();
        this.boundingSpheres = new Map();
        this.eventSystem = eventSystem;
    }

    addObject(id: string, object: THREE.Object3D): void {
        this.objects.set(id, object);
        
        // Calculate bounding sphere
        const boundingSphere = new THREE.Sphere();
        if (object instanceof THREE.Mesh && object.geometry) {
            object.geometry.computeBoundingSphere();
            boundingSphere.copy(object.geometry.boundingSphere!);
            boundingSphere.applyMatrix4(object.matrixWorld);
        } else {
            // For non-mesh objects, use a simple sphere based on position
            boundingSphere.center.copy(object.position);
            boundingSphere.radius = 1; // Default radius
        }
        this.boundingSpheres.set(id, boundingSphere);
    }

    removeObject(id: string): void {
        this.objects.delete(id);
        this.boundingSpheres.delete(id);
    }

    update(): void {
        // Update the frustum
        this.frustumMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.frustumMatrix);

        // Check each object against the frustum
        this.objects.forEach((object, id) => {
            const boundingSphere = this.boundingSpheres.get(id);
            if (!boundingSphere) return;

            // Update bounding sphere position if object has moved
            boundingSphere.center.copy(object.position);

            const wasVisible = object.visible;
            const isInFrustum = this.frustum.intersectsSphere(boundingSphere);
            object.visible = isInFrustum;

            if (wasVisible !== isInFrustum) {
                this.eventSystem.emit('visibilityChanged', {
                    objectId: id,
                    visible: isInFrustum
                });
            }
        });
    }

    cleanup(): void {
        this.objects.clear();
        this.boundingSpheres.clear();
    }
} 