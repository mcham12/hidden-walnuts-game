import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Logger } from '../core/Logger';

// Types for physics objects
interface PhysicsBody {
    body: CANNON.Body;
    isStatic: boolean;
    isPlayer?: boolean;
}

interface PhysicsOptions {
    mass?: number;
    isStatic?: boolean;
    shape?: 'box' | 'sphere' | 'cylinder' | 'heightfield';
    dimensions?: { x: number; y: number; z: number };
    radius?: number;
    height?: number;
    heightfieldData?: number[][];
    heightfieldWidth?: number;
    heightfieldHeight?: number;
    friction?: number;
    restitution?: number;
    fixedRotation?: boolean;
}

export class PhysicsSystem {
    private world: CANNON.World;
    private objects: Map<string, PhysicsBody>;
    private debugScene?: THREE.Scene;
    private isInitialized: boolean;

    constructor() {
        this.world = new CANNON.World({
            gravity: new CANNON.Vec3(0, -9.81, 0)
        });
        this.objects = new Map();
        this.isInitialized = false;

        // Configure world with damping
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.friction = 0.3;
        this.world.defaultContactMaterial.restitution = 0.3;
        this.world.quatNormalizeSkip = 0;
        this.world.quatNormalizeFast = false;
    }

    initialize(scene?: THREE.Scene): void {
        if (this.isInitialized) {
            Logger.warn('PhysicsSystem already initialized');
            return;
        }

        if (scene) {
            this.debugScene = scene;
        }

        this.isInitialized = true;
    }

    addObject(object: THREE.Object3D, options: PhysicsOptions = {}): void {
        const body = new CANNON.Body({
            mass: options.mass || 0,
            position: new CANNON.Vec3(
                object.position.x,
                object.position.y,
                object.position.z
            ),
            shape: this.createShape(options),
            material: new CANNON.Material({
                friction: options.friction || 0.3,
                restitution: options.restitution || 0.3
            }),
            type: options.isStatic ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC,
            fixedRotation: options.isStatic || options.fixedRotation || false
        });

        // Store physics body reference
        this.objects.set(object.uuid, {
            body,
            isStatic: options.isStatic || false,
            isPlayer: object.userData.isPlayer || false
        });

        // Store reference to physics body on the object
        object.userData.physicsBody = body;
        
        this.world.addBody(body);
    }

    private createShape(options: PhysicsOptions): CANNON.Shape {
        switch (options.shape) {
            case 'sphere':
                return new CANNON.Sphere(options.radius || 0.5);
            case 'cylinder':
                return new CANNON.Cylinder(
                    options.radius || 0.5,
                    options.radius || 0.5,
                    options.height || 1,
                    8
                );
            case 'heightfield':
                if (!options.heightfieldData || !options.heightfieldWidth || !options.heightfieldHeight) {
                    throw new Error('Heightfield data, width, and height are required for heightfield shape');
                }
                return new CANNON.Heightfield(
                    options.heightfieldData,
                    {
                        elementSize: 1,
                        minValue: 0,
                        maxValue: 1
                    }
                );
            default:
                return new CANNON.Box(new CANNON.Vec3(
                    (options.dimensions?.x || 1) / 2,
                    (options.dimensions?.y || 1) / 2,
                    (options.dimensions?.z || 1) / 2
                ));
        }
    }

    removeObject(object: THREE.Object3D): void {
        const physicsBody = this.objects.get(object.uuid);
        if (physicsBody) {
            this.world.removeBody(physicsBody.body);
            this.objects.delete(object.uuid);
        }
    }

    update(delta: number): void {
        this.world.step(delta);
        
        // Update Three.js objects based on physics
        for (const [uuid, physicsBody] of this.objects) {
            const object = this.findObjectByUUID(uuid);
            if (!object) continue;

            // Only update position for dynamic objects
            if (!physicsBody.isStatic) {
                object.position.copy(physicsBody.body.position as any);
                
                // Only update rotation if not a player
                if (!physicsBody.isPlayer) {
                    object.quaternion.copy(physicsBody.body.quaternion as any);
                }
            }
        }
    }

    private findObjectByUUID(uuid: string): THREE.Object3D | null {
        // Search through all objects in the scene
        if (this.debugScene) {
            const findObject = (obj: THREE.Object3D): THREE.Object3D | null => {
                if (obj.uuid === uuid) return obj;
                for (const child of obj.children) {
                    const found = findObject(child);
                    if (found) return found;
                }
                return null;
            };
            return findObject(this.debugScene);
        }
        return null;
    }

    getBody(object: THREE.Object3D): CANNON.Body | undefined {
        const physicsBody = this.objects.get(object.uuid);
        return physicsBody?.body;
    }

    cleanup(): void {
        this.objects.forEach(({ body }) => this.world.removeBody(body));
        this.objects.clear();
        this.isInitialized = false;
    }

    addHeightfieldTerrain(data: {
        heightData: number[][],
        width: number,
        height: number,
        resolution: number,
        minHeight: number,
        maxHeight: number,
        position: THREE.Vector3
    }): void {
        const { heightData, width, resolution, minHeight, maxHeight, position } = data;
        const elementSize = width / resolution;
        const shape = new CANNON.Heightfield(heightData, {
            elementSize,
            minValue: minHeight,
            maxValue: maxHeight
        });
        const body = new CANNON.Body({
            mass: 0, // static
            shape,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            type: CANNON.Body.STATIC
        });
        this.world.addBody(body);
    }
} 