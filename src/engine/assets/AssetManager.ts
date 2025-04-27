import { Texture, TextureLoader, Object3D, LoadingManager } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * AssetManager handles loading and caching of models, textures, and sounds.
 */
export class AssetManager {
  private textures: Map<string, Texture> = new Map();
  private models: Map<string, Object3D> = new Map();
  private loadingManager = new LoadingManager();

  /**
   * Load a texture and cache it by URL.
   */
  async loadTexture(url: string): Promise<Texture> {
    if (this.textures.has(url)) {
      return this.textures.get(url)!;
    }
    const loader = new TextureLoader(this.loadingManager);
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (texture) => {
          this.textures.set(url, texture);
          resolve(texture);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  /**
   * Load a model (GLTF/GLB) and cache it by URL. Requires GLTFLoader.
   */
  async loadModel(url: string): Promise<Object3D> {
    if (this.models.has(url)) {
      return this.models.get(url)!;
    }
    // Dynamically import GLTFLoader to avoid loading it if not needed
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
    const loader = new GLTFLoader(this.loadingManager);
    return new Promise<Object3D>((resolve, reject) => {
      loader.load(
        url,
        (gltf: GLTF) => {
          this.models.set(url, gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        (err: unknown) => reject(err)
      );
    });
  }

  // You can add similar methods for sounds, fonts, etc.
} 