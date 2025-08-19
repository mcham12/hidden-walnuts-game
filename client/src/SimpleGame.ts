// Step 1: Basic cube with green front indicator - following tutorial pattern
import * as THREE from 'three';

export class SimpleGame {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  
  // Player - simple cube
  private player!: THREE.Group;
  private playerRotation = 0; // Track player's Y rotation
  
  // Camera following system - using tutorial pattern
  private pivot!: THREE.Object3D;
  private yaw!: THREE.Object3D;
  private pitch!: THREE.Object3D;
  
  // Input
  private keys = new Set<string>();
  
  constructor() {
    this.setupInput();
  }
  
  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    
    // Camera - start at basic position
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 5);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    
    // Player - red cube with green front indicator
    this.player = new THREE.Group();
    
    // Main body (red cube)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.player.add(body);
    
    // Green front indicator - make it bigger and more visible
    const front = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    front.position.set(0, 0, -0.8); // Front of cube (negative Z)
    this.player.add(front);
    
    this.player.position.set(0, 0.5, 0);
    this.scene.add(this.player);
    
    // Camera pivot system - following tutorial pattern
    this.pivot = new THREE.Object3D();
    this.yaw = new THREE.Object3D();
    this.pitch = new THREE.Object3D();
    
    this.scene.add(this.pivot);
    this.pivot.add(this.yaw);
    this.yaw.add(this.pitch);
    this.pitch.add(this.camera);
    
    // Position camera behind player initially
    this.camera.position.set(0, 2, 5);
    this.pivot.position.copy(this.player.position);
    
    console.log('✅ Basic cube with pivot camera system created');
  }
  
  private setupInput(): void {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }
  
  start(): void {
    this.gameLoop();
  }
  
  private gameLoop = (): void => {
    const moveSpeed = 0.05;
    const rotationSpeed = 0.03;
    
    // A/D keys: Rotate player left/right
    if (this.keys.has('a')) {
      this.playerRotation += rotationSpeed;
    }
    if (this.keys.has('d')) {
      this.playerRotation -= rotationSpeed;
    }
    
    // Update player visual rotation
    this.player.rotation.y = this.playerRotation;
    
    // W/S keys: Move forward/backward in player's facing direction
    if (this.keys.has('w')) {
      // Move forward in the direction the player is facing
      this.player.position.x -= Math.sin(this.playerRotation) * moveSpeed;
      this.player.position.z -= Math.cos(this.playerRotation) * moveSpeed;
    }
    if (this.keys.has('s')) {
      // Move backward from the direction the player is facing
      this.player.position.x += Math.sin(this.playerRotation) * moveSpeed;
      this.player.position.z += Math.cos(this.playerRotation) * moveSpeed;
    }
    
    // Camera following using tutorial pivot pattern
    const playerWorldPosition = new THREE.Vector3();
    this.player.getWorldPosition(playerWorldPosition);
    
    // Smooth follow with lerp
    this.pivot.position.lerp(playerWorldPosition, 0.1);
    
    // Rotate camera system to face player's direction
    this.yaw.rotation.y = this.playerRotation;
    
    // Render
    this.renderer.render(this.scene, this.camera);
    
    requestAnimationFrame(this.gameLoop);
  };
}