declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import { LoadingManager, Object3D } from 'three';
  export class GLTFLoader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (event: unknown) => void
    ): void;
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<GLTF>;
  }
  export interface GLTF {
    scene: Object3D;
    scenes: Object3D[];
    animations: any[];
    [key: string]: any;
  }
} 