/// <reference types="vite/client" />

declare module 'three/examples/jsm/loaders/GLTFLoader' {
    export class GLTFLoader {
      constructor(manager?: THREE.LoadingManager);
      load(
        url: string,
        onLoad: (gltf: any) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void
      ): void;
      loadAsync(url: string): Promise<any>;
    }
  }