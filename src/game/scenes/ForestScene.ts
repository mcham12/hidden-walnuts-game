import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, MeshStandardMaterial, PlaneGeometry, BoxGeometry, SphereGeometry, DirectionalLight, AmbientLight, Vector3 } from 'three';
import { AssetManager } from '../../engine/assets/AssetManager';

/**
 * ForestScene sets up the static 3D map for the game: ground, trees, bushes, lighting, and camera.
 */
export class ForestScene {
  public scene: Scene;
  public camera: PerspectiveCamera;
  public renderer: WebGLRenderer;
  public assetManager: AssetManager;

  constructor(renderer: WebGLRenderer) {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = renderer;
    this.assetManager = new AssetManager();
    this.setup();
  }

  private setup() {
    // Ground
    const ground = new Mesh(
      new PlaneGeometry(100, 100),
      new MeshStandardMaterial({ color: 0x228B22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Trees (as boxes for now)
    for (let i = 0; i < 5; i++) {
      const trunk = new Mesh(
        new BoxGeometry(0.5, 3, 0.5),
        new MeshStandardMaterial({ color: 0x8B5A2B })
      );
      trunk.position.set(Math.random() * 80 - 40, 1.5, Math.random() * 80 - 40);
      this.scene.add(trunk);
      const leaves = new Mesh(
        new SphereGeometry(1.5, 16, 16),
        new MeshStandardMaterial({ color: 0x228B22 })
      );
      leaves.position.set(trunk.position.x, trunk.position.y + 2, trunk.position.z);
      this.scene.add(leaves);
    }

    // Bushes (as spheres for now)
    for (let i = 0; i < 8; i++) {
      const bush = new Mesh(
        new SphereGeometry(1, 12, 12),
        new MeshStandardMaterial({ color: 0x2E8B57 })
      );
      bush.position.set(Math.random() * 90 - 45, 1, Math.random() * 90 - 45);
      this.scene.add(bush);
    }

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
} 