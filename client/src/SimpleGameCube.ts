// Working cube version for reference
import * as THREE from 'three';

export class SimpleGame {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  
  // Player
  private player!: THREE.Mesh;
  private playerPosition = new THREE.Vector3(0, 0, 0);
  private playerRotation = 0;
  
  // Input
  private keys: {[key: string]: boolean} = {};
  
  // Game loop
  private lastTime = 0;
  
  constructor() {
    this.setupInput();
  }
  
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10); // Start behind player
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    
    // Player (simple cube with clear front/back)
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.player = new THREE.Mesh(playerGeometry, playerMaterial);
    
    // Add a small cube to front to show direction
    const frontIndicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    frontIndicator.position.set(0, 0, -0.7); // Front of player
    this.player.add(frontIndicator);
    
    this.player.position.copy(this.playerPosition);
    this.scene.add(this.player);
    
    console.log('✅ Simple game initialized');
  }
  
  private setupInput(): void {
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });
    
    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }
  
  private updatePlayer(deltaTime: number): void {
    const moveSpeed = 5;
    const rotationSpeed = 3;
    
    // A/D keys: Rotate player
    if (this.keys['a']) {
      this.playerRotation += rotationSpeed * deltaTime;
    }
    if (this.keys['d']) {
      this.playerRotation -= rotationSpeed * deltaTime;
    }
    
    // W/S keys: Move forward/backward based on player rotation
    if (this.keys['w']) {
      this.playerPosition.x -= Math.sin(this.playerRotation) * moveSpeed * deltaTime;
      this.playerPosition.z -= Math.cos(this.playerRotation) * moveSpeed * deltaTime;
    }
    if (this.keys['s']) {
      this.playerPosition.x += Math.sin(this.playerRotation) * moveSpeed * deltaTime;
      this.playerPosition.z += Math.cos(this.playerRotation) * moveSpeed * deltaTime;
    }
    
    // Update player mesh position and rotation
    this.player.position.copy(this.playerPosition);
    this.player.rotation.y = this.playerRotation;
  }
  
  private updateCamera(): void {
    // Camera stays behind player based on player rotation
    const distance = 10;
    const height = 5;
    
    // Calculate camera position behind player (negative to be behind)
    const cameraX = this.playerPosition.x - Math.sin(this.playerRotation) * distance;
    const cameraZ = this.playerPosition.z - Math.cos(this.playerRotation) * distance;
    
    this.camera.position.set(cameraX, this.playerPosition.y + height, cameraZ);
    this.camera.lookAt(this.playerPosition);
  }
  
  start(): void {
    this.lastTime = performance.now();
    this.gameLoop();
  }
  
  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    
    // Update game
    this.updatePlayer(deltaTime);
    this.updateCamera();
    
    // Render
    this.renderer.render(this.scene, this.camera);
    
    requestAnimationFrame(this.gameLoop);
  };
}