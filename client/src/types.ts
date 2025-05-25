import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SquirrelAvatar {
  mesh: THREE.Object3D;
  gltf: GLTF;
} 