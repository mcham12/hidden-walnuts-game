import * as THREE from 'three';
import { EventSystem } from '../core/EventSystem';

interface LODLevel {
    distance: number;
    object: THREE.Object3D;
}

export class LODSystem {
    private camera: THREE.Camera;
    private objects: Map<string, THREE.Object3D[]>;
    private levels: Map<string, LODLevel[]>;
    private eventSystem: EventSystem;

    constructor(camera: THREE.Camera, eventSystem: EventSystem) {
        this.camera = camera;
        this.eventSystem = eventSystem;
        this.objects = new Map();
        this.levels = new Map();
    }

    addObject(id: string, levels: LODLevel[]): void {
        if (levels.length === 0) return;

        // Sort levels by distance (ascending)
        levels.sort((a, b) => a.distance - b.distance);
        this.levels.set(id, levels);

        // Initially set to highest detail
        const objects = levels.map(level => level.object);
        this.objects.set(id, objects);

        // Set initial visibility
        objects.forEach((obj, index) => {
            obj.visible = index === 0;
        });
    }

    removeObject(id: string): void {
        this.objects.delete(id);
        this.levels.delete(id);
    }

    update(): void {
        this.objects.forEach((objects, id) => {
            const levels = this.levels.get(id);
            if (!levels) return;

            const position = objects[0].position;
            const distance = this.camera.position.distanceTo(position);

            // Find appropriate LOD level
            let activeIndex = levels.length - 1;
            for (let i = 0; i < levels.length; i++) {
                if (distance < levels[i].distance) {
                    activeIndex = i;
                    break;
                }
            }

            // Update visibility
            objects.forEach((obj, index) => {
                const wasVisible = obj.visible;
                obj.visible = index === activeIndex;
                
                if (wasVisible !== obj.visible) {
                    this.eventSystem.emit('lodChanged', {
                        objectId: id,
                        level: activeIndex,
                        distance: distance
                    });
                }
            });
        });
    }

    cleanup(): void {
        this.objects.clear();
        this.levels.clear();
    }
} 