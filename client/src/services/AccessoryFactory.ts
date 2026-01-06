
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AccessoryFactory {
    private static loader = new GLTFLoader();
    private static packPromise: Promise<GLTF> | null = null;
    private static cachedPack: GLTF | null = null;
    private static LOADING_PATH = '/assets/accessories/toontown_pack.glb';

    static async createAccessory(id: string): Promise<THREE.Group | null> {
        if (id === 'none') return null;

        if (!this.cachedPack) {
            await this.loadPack();
        }

        if (!this.cachedPack) return null;

        // Traverse to find the node
        let foundNode: THREE.Object3D | null = null;
        this.cachedPack.scene.traverse((child) => {
            if (child.name === id) {
                foundNode = child;
            }
        });

        if (foundNode) {
            // Must clone deeply to allow multiple instances
            const clone = foundNode.clone(); // THREE.Object3D
            const group = new THREE.Group();
            group.add(clone);

            // Reset transforms of the CLONE relative to the group, 
            // because the node inside GLB might have arbitrary transforms.
            // We want the group to be the attach point controlled by Registry offsets.
            clone.position.set(0, 0, 0);
            clone.rotation.set(0, 0, 0);
            clone.scale.set(1, 1, 1);

            // Ensure visualization
            clone.visible = true;
            clone.traverse((c) => {
                c.visible = true;
                if ((c as THREE.Mesh).isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            return group;
        }

        console.warn(`Accessory node '${id}' not found in pack.`);
        return null;
    }

    private static async loadPack(): Promise<void> {
        if (this.cachedPack) return;

        if (!this.packPromise) {
            console.log('🎩 Loading Accessory Pack...');
            this.packPromise = this.loader.loadAsync(this.LOADING_PATH);
        }

        try {
            this.cachedPack = await this.packPromise;
            console.log('🎩 Accessory Pack Loaded Successfully');
        } catch (error) {
            console.error('Failed to load accessory pack:', error);
            this.packPromise = null;
        }
    }
}
