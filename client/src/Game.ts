import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrain } from './terrain.js';
import { createForest } from './forest.js';
import { getTerrainHeight } from './terrain.js';

interface Character {
  id: string;
  modelPath: string;
  animations: { [key: string]: string };
  scale: number;
}

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
  private gravity = -9.8;
  private jumpVelocity = 5;
  private isJumping = false;
  private characters: Character[] = [];
  private selectedCharacterId = 'colobus';

  async init(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 10); // Set initial camera position

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 100, 50);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.5;
    directional.shadow.camera.far = 500;
    directional.shadow.camera.left = -100;
    directional.shadow.camera.right = 100;
    directional.shadow.camera.top = 100;
    directional.shadow.camera.bottom = -100;
    this.scene.add(directional);

    // Terrain
    const terrain = await createTerrain();
    this.scene.add(terrain);
    console.log('Terrain added to scene. Scene children count:', this.scene.children.length);
    console.log('Scene children:', this.scene.children);

    // Forest
    await createForest(this.scene);

    // Load characters config with error handling
    try {
      const response = await fetch('/characters.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch characters.json: ${response.status}`);
      }
      this.characters = await response.json();
      console.log('Characters loaded:', this.characters);
    } catch (error) {
      console.error('Error loading characters.json:', error);
      // Fallback to default character
      this.characters = [{
        id: 'colobus',
        modelPath: '/assets/models/characters/Colobus_LOD0.glb',
        animations: {
          "idle": "/assets/animations/characters/Single/Colobus_Idle_A.glb",
          "run": "/assets/animations/characters/Single/Colobus_Run.glb",
          "jump": "/assets/animations/characters/Single/Colobus_Jump.glb"
        },
        scale: 0.3
      }];
    }

    // Load selected character
    await this.loadCharacter();

    // Events
    this.setupEvents();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private async loadCharacter() {
    const char = this.characters.find(c => c.id === this.selectedCharacterId);
    if (!char) return;

    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(char.modelPath);
      this.character = gltf.scene;
      this.character.scale.set(char.scale, char.scale, char.scale);
      this.character.position.set(0, 0, 0);
      this.character.rotation.y = Math.PI; // Flip to face -Z
      this.character.castShadow = true;
      this.scene.add(this.character);

      this.mixer = new THREE.AnimationMixer(this.character);

      // Load animations if separate
      for (const [name, path] of Object.entries(char.animations)) {
        const clipGltf = await loader.loadAsync(path);
        const clip = clipGltf.animations[0];
        this.actions[name] = this.mixer.clipAction(clip);
      }

      this.setAction('idle');
      this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z);
    } catch (error) {
      console.error('Error loading character:', error);
    }
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
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ' && !this.isJumping) {
        this.isJumping = true;
        this.velocity.y = this.jumpVelocity;
        this.setAction('jump');
      }
    });
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
    this.velocity.x = 0;
    this.velocity.z = 0;

    let moving = false;

    // Rotation
    if (this.keys.has('a')) {
      this.character.rotation.y += this.rotationSpeed * delta;
    }
    if (this.keys.has('d')) {
      this.character.rotation.y -= this.rotationSpeed * delta;
    }

    // Horizontal movement - swapped W/S directions
    if (this.keys.has('w')) {
      this.direction.set(0, 0, 1).applyQuaternion(this.character.quaternion); // Swapped to positive Z for forward
      this.velocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }
    if (this.keys.has('s')) {
      this.direction.set(0, 0, -1).applyQuaternion(this.character.quaternion); // Swapped to negative Z for backward
      this.velocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }

    // Gravity and jump
    if (this.isJumping) {
      this.velocity.y += this.gravity * delta;
      this.character.position.y += this.velocity.y * delta;
      if (this.character.position.y <= getTerrainHeight(this.character.position.x, this.character.position.z)) {
        this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z);
        this.isJumping = false;
        this.velocity.y = 0;
        this.setAction(moving ? 'run' : 'idle');
      }
    }

    // Apply horizontal movement
    this.character.position.add(this.velocity.clone().setY(0).multiplyScalar(delta));

    // Snap to terrain
    this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z);

    if (!this.isJumping) {
      this.setAction(moving ? 'run' : 'idle');
    }
  }

  private updateCamera() {
    // Camera behind: negative Z offset for behind if facing +Z
    const offset = new THREE.Vector3(0, 1, -2).applyQuaternion(this.character.quaternion);
    this.camera.position.copy(this.character.position).add(offset);
    this.camera.lookAt(this.character.position);
  }
}