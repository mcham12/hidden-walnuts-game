import { Scene, PerspectiveCamera, WebGLRenderer, DirectionalLight, AmbientLight, Vector3 } from 'three';
import { AssetManager } from '../../engine/assets/AssetManager';

/**
 * ForestScene sets up the static 3D map for the game: ground, trees, bushes, lighting, camera, and player squirrel.
 */
export class ForestScene {
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public assetManager: AssetManager;
  public isReady = false;
  private squirrel?: any;

  constructor(renderer: WebGLRenderer) {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = renderer;
    this.assetManager = new AssetManager();
    this.setup();
  }

  private async setup() {
    // Ground (keep as primitive for now)
    const { Mesh, MeshStandardMaterial, PlaneGeometry } = await import('three');
    const ground = new Mesh(
      new PlaneGeometry(100, 100),
      new MeshStandardMaterial({ color: 0x228B22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Tree models
    const treeModels = [
      'Tree_01.glb', 'Tree_02.glb', 'Tree_03.glb', 'Tree_04.glb', 'Tree_05.glb'
    ];
    for (let i = 0; i < 5; i++) {
      const modelName = treeModels[Math.floor(Math.random() * treeModels.length)];
      const tree = await this.assetManager.loadModel(`/assets/models/${modelName}`);
      tree.position.set(Math.random() * 80 - 40, 0, Math.random() * 80 - 40);
      tree.scale.set(2, 2, 2);
      this.scene.add(tree);
    }

    // Bush models
    const bushModels = ['Bush_01.glb', 'Bush_02.glb', 'Bush_03.glb'];
    for (let i = 0; i < 8; i++) {
      const modelName = bushModels[Math.floor(Math.random() * bushModels.length)];
      const bush = await this.assetManager.loadModel(`/assets/models/${modelName}`);
      bush.position.set(Math.random() * 90 - 45, 0, Math.random() * 90 - 45);
      bush.scale.set(1.5, 1.5, 1.5);
      this.scene.add(bush);
    }

    // Squirrel model (player avatar)
    const squirrel = await this.assetManager.loadModel('/assets/models/squirrel.glb');
    squirrel.position.set(0, 0, 0);
    squirrel.scale.set(2, 2, 2);
    this.scene.add(squirrel);
    this.squirrel = squirrel;
    this.isReady = true;

    // Lighting
    const sun = new DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    this.scene.add(sun);
    const ambient = new AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    // Camera position
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(new Vector3(0, 0, 0));
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  public getSquirrel() {
    return this.squirrel;
  }
} 