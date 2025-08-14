// Simple Game class - replaces complex ECS architecture
import * as THREE from 'three';

export interface Player {
  id: string;
  position: THREE.Vector3;
  rotation: number;
  mesh: THREE.Object3D;
  isLocal: boolean;
}

export class Game {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private players = new Map<string, Player>();
  private localPlayerId: string | null = null;
  private websocket: WebSocket | null = null;
  private keys = new Set<string>();
  
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

      this.websocket.onopen = () => {
        console.log('🌐 Connected to multiplayer!');
        this.createLocalPlayer(authData.position);
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
      this.createLocalPlayer({ x: 0, y: 2, z: 0 });
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

  private createLocalPlayer(position: { x: number; y: number; z: number }): void {
    if (!this.localPlayerId) return;

    const geometry = new THREE.CapsuleGeometry(0.3, 1.2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green for local
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(0.3, 0.3, 0.3);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const player: Player = {
      id: this.localPlayerId,
      position: new THREE.Vector3(position.x, position.y, position.z),
      rotation: 0,
      mesh: mesh,
      isLocal: true
    };

    mesh.position.copy(player.position);
    this.scene.add(mesh);
    this.players.set(this.localPlayerId, player);

    console.log(`🐿️ Local player created: ${this.localPlayerId}`);
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