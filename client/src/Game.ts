import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Game {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private character!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private actions: { [key: string]: THREE.AnimationAction } = {};
  private currentAction: THREE.AnimationAction | null = null;
  private keys: Set<string> = new Set();
  private clock = new THREE.Clock();
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private moveSpeed = 5;
  private rotationSpeed = Math.PI;

  async init(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 5);
    directional.castShadow = true;
    this.scene.add(directional);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x228B22 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Load character
    await this.loadCharacter();

    // Events
    this.setupEvents();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private async loadCharacter() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/assets/animations/characters/Colobus_Animations.glb');

    this.character = gltf.scene;
    this.character.scale.set(0.3, 0.3, 0.3);
    this.character.position.set(0, 0, 0);
    this.character.rotation.y = 0; // Face +Z
    this.character.castShadow = true;
    this.scene.add(this.character);

    this.mixer = new THREE.AnimationMixer(this.character);

    gltf.animations.forEach((clip) => {
      const name = clip.name.toLowerCase();
      this.actions[name] = this.mixer.clipAction(clip);
    });

    this.setAction('idle_a');
  }

  private setAction(name: string) {
    const newAction = this.actions[name];
    if (!newAction || newAction === this.currentAction) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(0.2);
    }

    newAction.reset().fadeIn(0.2).play();
    this.currentAction = newAction;
  }

  private setupEvents() {
    document.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    document.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    this.animate();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();

    this.updatePlayer(delta);
    this.updateCamera();

    this.mixer.update(delta);

    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(delta: number) {
    this.velocity.set(0, 0, 0);

    let moving = false;

    // Rotation - A left (positive), D right (negative)
    if (this.keys.has('a')) {
      this.character.rotation.y += this.rotationSpeed * delta;
    }
    if (this.keys.has('d')) {
      this.character.rotation.y -= this.rotationSpeed * delta;
    }

    // Movement - W forward (+Z), S backward (-Z)
    if (this.keys.has('w')) {
      this.direction.set(0, 0, 1).applyQuaternion(this.character.quaternion);
      this.velocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }
    if (this.keys.has('s')) {
      this.direction.set(0, 0, -1).applyQuaternion(this.character.quaternion);
      this.velocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }

    this.character.position.add(this.velocity.clone().multiplyScalar(delta));

    this.setAction(moving ? 'run' : 'idle_a');
  }

  private updateCamera() {
    // Camera behind: negative Z offset, closer distance
    const offset = new THREE.Vector3(0, 2, -3).applyQuaternion(this.character.quaternion); // Changed from -5 to -3
    this.camera.position.copy(this.character.position).add(offset);
    this.camera.lookAt(this.character.position);
  }
}