import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { ObjectPool } from '../core/ObjectPool';
import { Logger } from '../core/Logger';

export interface AssetLoadingProgress {
    loaded: number;
    total: number;
    assetPath: string;
}

export type LoadingProgressCallback = (url: string, loaded: number, total: number) => void;

export class AssetManager {
    private static instance: AssetManager;
    private modelCache: Map<string, THREE.Object3D>;
    private textureCache: Map<string, THREE.Texture>;
    private gltfLoader: GLTFLoader;
    private fbxLoader: FBXLoader;
    private textureLoader: THREE.TextureLoader;
    private loadingManager: THREE.LoadingManager;
    private objectPool: ObjectPool;
    private logger: Logger;
    private onProgress: LoadingProgressCallback;
    private initialized: boolean;
    private readonly BASE_MODEL_PATH = '/assets/models/';
    private readonly BASE_TEXTURE_PATH = '/assets/textures/';

    private constructor(onProgress: LoadingProgressCallback = () => {}) {
        this.logger = Logger.getInstance();
        
        this.modelCache = new Map();
        this.textureCache = new Map();
        this.initialized = false;
        
        // Configure loading manager
        this.loadingManager = new THREE.LoadingManager();
        this.loadingManager.onProgress = (url, loaded, total) => {
            Logger.info(`Loading progress: ${url} (${loaded}/${total})`);
            this.onProgress(url, loaded, total);
        };
        this.loadingManager.onError = (url) => {
            Logger.error(`Error loading asset: ${url}`);
        };

        // Initialize loaders
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        this.fbxLoader = new FBXLoader(this.loadingManager);
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        
        // Initialize object pool
        this.objectPool = new ObjectPool(() => new THREE.Object3D());

        this.onProgress = onProgress;
    }

    public static getInstance(): AssetManager {
        if (!AssetManager.instance) {
            AssetManager.instance = new AssetManager();
        }
        return AssetManager.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            Logger.info('Initializing AssetManager...');
            
            // Verify the loaders are properly initialized
            if (!this.gltfLoader || !this.textureLoader) {
                throw new Error('Loaders not properly initialized');
            }
            
            this.initialized = true;
            Logger.info('AssetManager initialized successfully');
        } catch (error) {
            Logger.error('Failed to initialize AssetManager:', error);
            throw error;
        }
    }

    private getFullPath(url: string, isTexture = false): string {
        const base = isTexture ? this.BASE_TEXTURE_PATH : this.BASE_MODEL_PATH;
        return url.startsWith('/') || url.startsWith('http') ? url : base + url;
    }

    private processMaterials(object: THREE.Object3D) {
        object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                let materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                materials.forEach((mat) => {
                    // 1. Ensure PBR material
                    if (!(mat instanceof THREE.MeshStandardMaterial) && !(mat instanceof THREE.MeshPhysicalMaterial)) {
                        console.warn('Non-PBR material found on mesh:', mesh.name, mat);
                        // Optionally, convert to MeshStandardMaterial here
                    }
                    // 2. Set color space for albedo/baseColor map
                    if ((mat as any).map && (mat as any).map.isTexture) {
                        (mat as any).map.colorSpace = THREE.SRGBColorSpace;
                    }
                });
            }
        });
    }

    private deepCloneModel(model: THREE.Object3D): THREE.Object3D {
        const clone = model.clone(true);
        clone.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material = mesh.material.map(mat => mat.clone());
                    } else {
                        mesh.material = mesh.material.clone();
                    }
                }
            }
        });
        return clone;
    }

    async loadModel(url: string): Promise<THREE.Object3D> {
        if (!this.initialized) {
            throw new Error('AssetManager not initialized');
        }

        const fullPath = this.getFullPath(url);
        try {
            if (this.modelCache.has(fullPath)) {
                Logger.debug(`Using cached model: ${fullPath}`);
                return this.deepCloneModel(this.modelCache.get(fullPath)!);
            }
            Logger.info(`Loading model: ${fullPath}`);
            let model: THREE.Object3D;
            if (fullPath.toLowerCase().endsWith('.fbx')) {
                model = await this.loadFBX(fullPath);
            } else if (fullPath.toLowerCase().endsWith('.gltf') || fullPath.toLowerCase().endsWith('.glb')) {
                model = await this.loadGLTF(fullPath);
            } else {
                throw new Error(`Unsupported model format: ${fullPath}`);
            }
            this.modelCache.set(fullPath, model);
            return this.deepCloneModel(model);
        } catch (error) {
            Logger.error(`Failed to load model: ${fullPath}`, error);
            throw error;
        }
    }

    private loadFBX(url: string): Promise<THREE.Object3D> {
        return new Promise((resolve, reject) => {
            try {
                Logger.debug(`Starting FBX load: ${url}`);
                
                // Add error handler for the FBX loader
                const errorHandler = (error: unknown) => {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    Logger.error(`Failed to load FBX: ${url}`, errorMessage);
                    reject(new Error(`Failed to load FBX: ${errorMessage}`));
                };

                this.fbxLoader.load(
                    url,
                    (object) => {
                        try {
                            // Ensure the object is properly configured
                            object.traverse((child) => {
                                if (child instanceof THREE.Mesh) {
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                    
                                    // Ensure materials are properly configured
                                    if (child.material) {
                                        if (Array.isArray(child.material)) {
                                            child.material.forEach(mat => {
                                                mat.needsUpdate = true;
                                            });
                                        } else {
                                            child.material.needsUpdate = true;
                                        }
                                    }
                                }
                            });

                            Logger.info(`Successfully loaded FBX: ${url}`);
                            resolve(object);
                        } catch (error) {
                            errorHandler(error);
                        }
                    },
                    (progress) => {
                        const percent = (progress.loaded / progress.total * 100).toFixed(2);
                        Logger.debug(`Loading FBX ${url}: ${percent}%`);
                    },
                    errorHandler
                );
            } catch (error) {
                Logger.error(`Exception loading FBX: ${url}`, error);
                reject(error);
            }
        });
    }

    private async loadGLTF(url: string): Promise<THREE.Object3D> {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    try {
                        const model = gltf.scene;
                        this.processMaterials(model);
                        resolve(model);
                    } catch (error) {
                        Logger.error(`Error processing GLTF: ${url}`, error);
                        reject(error);
                    }
                },
                (progress) => this.onProgress(url, progress.loaded, progress.total),
                (error) => {
                    Logger.error(`Failed to load GLTF: ${url}`, error);
                    reject(error);
                }
            );
        });
    }

    async loadTexture(url: string): Promise<THREE.Texture> {
        if (!this.initialized) {
            throw new Error('AssetManager not initialized. Call initialize() first.');
        }

        if (this.textureCache.has(url)) {
            return this.textureCache.get(url)!;
        }

        return new Promise((resolve, reject) => {
            new THREE.TextureLoader().load(
                url,
                (texture) => {
                    this.textureCache.set(url, texture);
                    resolve(texture);
                },
                (progress) => this.onProgress(url, progress.loaded, progress.total),
                (error) => reject(error)
            );
        });
    }

    getModelFromPool(): THREE.Object3D {
        return this.objectPool.acquire();
    }

    returnModelToPool(model: THREE.Object3D): void {
        this.objectPool.release(model);
    }

    public dispose(): void {
        // Dispose of all cached models
        this.modelCache.forEach(model => {
            model.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        });
        this.modelCache.clear();

        // Dispose of all cached textures
        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();

        // Clear the object pool
        this.objectPool.clear();
    }

    cleanup(): void {
        // Dispose of cached models
        this.modelCache.forEach((model) => {
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        });

        // Dispose of cached textures
        this.textureCache.forEach((texture) => {
            texture.dispose();
        });

        // Clear caches
        this.modelCache.clear();
        this.textureCache.clear();
        this.objectPool.clear();
        this.initialized = false;
    }
} 