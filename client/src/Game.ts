// Simple Game class - replaces complex ECS architecture
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface Player {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  mesh: THREE.Object3D;
  isLocal: boolean;
  animationMixer?: THREE.AnimationMixer;
  animations?: Map<string, THREE.AnimationAction>;
  currentAnimation?: THREE.AnimationAction;
  isMoving: boolean;
}

export class Game {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private players = new Map<string, Player>();
  private localPlayerId: string | null = null;
  private websocket: WebSocket | null = null;
  private keys = new Set<string>();
  private gltfLoader = new GLTFLoader();
  
  private lastFrame = 0;
  private isRunning = false;

  constructor() {
    this.setupInput();
  }

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);

    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    this.camera.position.set(0, 15, 15);
    this.camera.lookAt(0, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setClearColor(0x87CEEB);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 25);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Load terrain and forest
    await this.loadTerrain();
    await this.loadForest();

    console.log('🎮 Simple game initialized!');
  }

  private async loadTerrain(): Promise<void> {
    const { createTerrain } = await import('./terrain');
    const terrain = await createTerrain();
    this.scene.add(terrain);
  }

  private async loadForest(): Promise<void> {
    try {
      const { createForest } = await import('./forest');
      const forestObjects = await createForest();
      forestObjects.forEach(obj => this.scene.add(obj));
    } catch (error) {
      console.warn('Failed to load forest:', error);
    }
  }

  async connectMultiplayer(): Promise<void> {
    try {
      // Get session token
      const playerId = this.generatePlayerId();
      const authResponse = await fetch(`http://localhost:8787/join?squirrelId=${playerId}`, {
        method: 'POST'
      });
      
      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();
      this.localPlayerId = authData.squirrelId;

      // Connect WebSocket
      const wsUrl = `ws://localhost:8787/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = async () => {
        console.log('🌐 Connected to multiplayer!');
        await this.createLocalPlayer(authData.position);
      };

      this.websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleNetworkMessage(message);
      };

      this.websocket.onclose = () => {
        console.log('🔌 Disconnected from multiplayer');
      };

    } catch (error) {
      console.warn('Failed to connect to multiplayer:', error);
      // Create local player anyway for offline mode
      await this.createLocalPlayer({ x: 0, y: 2, z: 0 });
    }
  }

  private generatePlayerId(): string {
    let playerId = sessionStorage.getItem('playerId');
    if (!playerId) {
      playerId = crypto.randomUUID();
      sessionStorage.setItem('playerId', playerId);
    }
    return playerId;
  }

  private async loadColobusCharacter(): Promise<{
    mesh: THREE.Group;
    mixer: THREE.AnimationMixer;
    animations: Map<string, THREE.AnimationAction>;
    idleAnimation: THREE.AnimationAction;
  }> {
    // Load the character model
    const modelGltf = await this.loadGLTF('/assets/models/characters/Colobus_LOD0.glb');
    const characterMesh = modelGltf.scene.clone();
    
    // Set up the mesh
    characterMesh.scale.set(0.5, 0.5, 0.5);
    characterMesh.castShadow = true;
    characterMesh.receiveShadow = true;
    
    // Enable shadows for all child meshes
    characterMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Create animation mixer
    const mixer = new THREE.AnimationMixer(characterMesh);
    const animations = new Map<string, THREE.AnimationAction>();

    // Load animations
    const idleGltf = await this.loadGLTF('/assets/animations/characters/Single/Colobus_Idle_A.glb');
    const runGltf = await this.loadGLTF('/assets/animations/characters/Single/Colobus_Run.glb');

    // Create animation actions
    if (idleGltf.animations.length > 0) {
      const idleAction = mixer.clipAction(idleGltf.animations[0]);
      idleAction.loop = THREE.LoopRepeat;
      animations.set('idle', idleAction);
    }

    if (runGltf.animations.length > 0) {
      const runAction = mixer.clipAction(runGltf.animations[0]);
      runAction.loop = THREE.LoopRepeat;
      animations.set('run', runAction);
    }

    const idleAnimation = animations.get('idle')!;

    console.log(`🎭 Loaded Colobus with ${animations.size} animations`);

    return {
      mesh: characterMesh,
      mixer,
      animations,
      idleAnimation
    };
  }

  private loadGLTF(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
  }

  private async createLocalPlayer(position: { x: number; y: number; z: number }): Promise<void> {
    if (!this.localPlayerId) return;

    console.log('🐿️ Loading Colobus character...');
    
    try {
      const characterMesh = await this.loadColobusCharacter();
      
      const player: Player = {
        id: this.localPlayerId,
        position: new THREE.Vector3(position.x, position.y, position.z),
        rotation: 0,
        mesh: characterMesh.mesh,
        isLocal: true,
        animationMixer: characterMesh.mixer,
        animations: characterMesh.animations,
        currentAnimation: characterMesh.idleAnimation,
        isMoving: false
      };

      player.mesh.position.copy(player.position);
      this.scene.add(player.mesh);
      this.players.set(this.localPlayerId, player);

      // Start with idle animation
      if (player.currentAnimation) {
        player.currentAnimation.play();
      }

      console.log(`🐿️ Animated Colobus player created: ${this.localPlayerId}`);
    } catch (error) {
      console.error('❌ Failed to load Colobus character, falling back to capsule:', error);
      this.createFallbackPlayer(position);
    }
  }

  private createFallbackPlayer(position: { x: number; y: number; z: number }): void {
    if (!this.localPlayerId) return;

    const geometry = new THREE.CapsuleGeometry(0.3, 1.2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(0.3, 0.3, 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const player: Player = {
      id: this.localPlayerId,
      position: new THREE.Vector3(position.x, position.y, position.z),
      rotation: 0,
      mesh: mesh,
      isLocal: true,
      isMoving: false
    };

    mesh.position.copy(player.position);
    this.scene.add(mesh);
    this.players.set(this.localPlayerId, player);

    console.log(`🐿️ Fallback capsule player created: ${this.localPlayerId}`);
  }

  private createRemotePlayer(id: string, position: { x: number; y: number; z: number }): void {
    if (this.players.has(id)) return;

    const geometry = new THREE.CapsuleGeometry(0.3, 1.2);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red for remote
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(0.3, 0.3, 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const player: Player = {
      id: id,
      position: new THREE.Vector3(position.x, position.y, position.z),
      rotation: 0,
      mesh: mesh,
      isLocal: false
    };

    mesh.position.copy(player.position);
    this.scene.add(mesh);
    this.players.set(id, player);

    console.log(`👥 Remote player joined: ${id}`);
  }

  private removePlayer(id: string): void {
    const player = this.players.get(id);
    if (player) {
      this.scene.remove(player.mesh);
      this.players.delete(id);
      console.log(`👋 Player left: ${id}`);
    }
  }

  private handleNetworkMessage(message: any): void {
    switch (message.type) {
      case 'init':
        console.log('🚀 Server init message received');
        break;

      case 'player_joined':
        if (message.squirrelId !== this.localPlayerId && message.position) {
          this.createRemotePlayer(message.squirrelId, message.position);
        }
        break;

      case 'player_update':
        if (message.squirrelId !== this.localPlayerId) {
          this.updateRemotePlayer(message.squirrelId, message.position, message.rotationY);
        }
        break;

      case 'player_leave':
        this.removePlayer(message.squirrelId);
        break;

      case 'existing_players':
        if (message.players) {
          message.players.forEach((playerData: any) => {
            if (playerData.squirrelId !== this.localPlayerId) {
              this.createRemotePlayer(playerData.squirrelId, playerData.position);
            }
          });
        }
        break;
    }
  }

  private updateRemotePlayer(id: string, position: { x: number; y: number; z: number }, rotation: number): void {
    const player = this.players.get(id);
    if (player && !player.isLocal) {
      player.position.set(position.x, position.y, position.z);
      player.rotation = rotation;
      player.mesh.position.copy(player.position);
      player.mesh.rotation.y = rotation;
    }
  }

  private setupInput(): void {
    document.addEventListener('keydown', (event) => {
      this.keys.add(event.key.toLowerCase());
    });

    document.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  private updateLocalPlayer(deltaTime: number): void {
    if (!this.localPlayerId) return;
    
    const player = this.players.get(this.localPlayerId);
    if (!player) return;

    const moveSpeed = 5; // units per second
    const rotateSpeed = 3; // radians per second
    
    let moved = false;

    // Rotation
    if (this.keys.has('a')) {
      player.rotation += rotateSpeed * deltaTime;
      moved = true;
    }
    if (this.keys.has('d')) {
      player.rotation -= rotateSpeed * deltaTime;
      moved = true;
    }

    // Movement
    if (this.keys.has('w')) {
      player.position.x += Math.sin(player.rotation) * moveSpeed * deltaTime;
      player.position.z += Math.cos(player.rotation) * moveSpeed * deltaTime;
      moved = true;
    }
    if (this.keys.has('s')) {
      player.position.x -= Math.sin(player.rotation) * moveSpeed * deltaTime;
      player.position.z -= Math.cos(player.rotation) * moveSpeed * deltaTime;
      moved = true;
    }

    // Update animation state based on movement
    const wasMoving = player.isMoving;
    player.isMoving = moved;
    
    if (player.isMoving !== wasMoving) {
      this.updatePlayerAnimation(player, player.isMoving ? 'run' : 'idle');
    }

    // Update animation mixer
    if (player.animationMixer) {
      player.animationMixer.update(deltaTime);
    }

    // Update mesh
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation;

    // Send to server if moved
    if (moved && this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'player_update',
        squirrelId: this.localPlayerId,
        position: { x: player.position.x, y: player.position.y, z: player.position.z },
        rotationY: player.rotation,
        timestamp: Date.now()
      }));
    }

    // Update camera to follow player
    this.updateCamera(player);
  }

  private updatePlayerAnimation(player: Player, animationName: string): void {
    if (!player.animations || !player.animationMixer) return;

    const newAnimation = player.animations.get(animationName);
    if (!newAnimation) {
      console.warn(`⚠️ Animation '${animationName}' not found for player ${player.id}`);
      return;
    }

    if (newAnimation === player.currentAnimation) return;

    // Fade out current animation and fade in new one
    if (player.currentAnimation) {
      player.currentAnimation.fadeOut(0.2);
    }
    
    newAnimation.reset().fadeIn(0.2).play();
    player.currentAnimation = newAnimation;

    console.log(`🎭 Player ${player.id} animation: ${animationName}`);
  }

  private updateCamera(player: Player): void {
    const distance = 5;
    const height = 3;
    
    const idealX = player.position.x - Math.sin(player.rotation) * distance;
    const idealZ = player.position.z - Math.cos(player.rotation) * distance;
    const idealY = player.position.y + height;

    this.camera.position.lerp(new THREE.Vector3(idealX, idealY, idealZ), 0.1);
    this.camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrame = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.websocket) {
      this.websocket.close();
    }
  }

  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = (now - this.lastFrame) / 1000;
    this.lastFrame = now;

    // Update local player
    this.updateLocalPlayer(deltaTime);

    // Render
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.gameLoop);
  };
}