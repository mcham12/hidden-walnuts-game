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
    // EXACT COPY FROM WORKING TEST SCENE
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(-8, 5, 0);  // Test negative X
    this.camera.lookAt(0, 0, 0);         // Look at origin where player will be

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;

    // Basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

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
      console.log('🔑 Authenticating player:', playerId);
      
      const authResponse = await fetch(`http://localhost:8787/join?squirrelId=${playerId}`, {
        method: 'POST'
      });
      
      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const authData = await authResponse.json();
      this.localPlayerId = authData.squirrelId;
      console.log('✅ Authentication successful, connecting WebSocket...');

      // Try WebSocket connection with timeout
      const wsUrl = `ws://localhost:8787/ws?squirrelId=${authData.squirrelId}&token=${authData.token}`;
      
      try {
        await this.connectWebSocket(wsUrl, authData.position);
      } catch (wsError) {
        console.log('🔄 WebSocket failed, creating offline player...');
        await this.createLocalPlayer(authData.position || { x: 0, y: 2, z: 0 });
      }

    } catch (error) {
      console.warn('❌ Failed to connect to multiplayer:', error);
      console.log('🔄 Creating offline player...');
      // Create local player anyway for offline mode
      this.localPlayerId = this.generatePlayerId();
      await this.createLocalPlayer({ x: 0, y: 2, z: 0 });
    }
  }

  private connectWebSocket(wsUrl: string, position: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.websocket = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        this.websocket?.close();
        reject(new Error('WebSocket connection timeout'));
      }, 2000); // 2 second timeout

      this.websocket.onopen = async () => {
        clearTimeout(timeout);
        console.log('🌐 Connected to multiplayer!');
        await this.createLocalPlayer(position);
        resolve();
      };

      this.websocket.onerror = (error) => {
        clearTimeout(timeout);
        console.error('❌ WebSocket error:', error);
        reject(error);
      };

      this.websocket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleNetworkMessage(message);
      };

      this.websocket.onclose = (event) => {
        clearTimeout(timeout);
        console.log('🔌 Disconnected from multiplayer:', event.code, event.reason);
      };
    });
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
    // Try to load from the combined animations file first
    let modelGltf;
    let characterMesh;
    let mixer;
    let animations = new Map<string, THREE.AnimationAction>();

    try {
      // Try the combined animation file
      modelGltf = await this.loadGLTF('/assets/animations/characters/Colobus_Animations.glb');
      characterMesh = modelGltf.scene.clone();
      mixer = new THREE.AnimationMixer(characterMesh);

      // Load animations from the same file
      modelGltf.animations.forEach((clip, index) => {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        animations.set(clip.name.toLowerCase(), action);
        console.log(`🎬 Found animation: ${clip.name}`);
      });

      console.log(`🎭 Loaded Colobus with ${animations.size} animations from combined file`);
    } catch (error) {
      console.warn('⚠️ Combined animation file failed, trying model only:', error);
      
      // Fallback: Load just the model without animations
      modelGltf = await this.loadGLTF('/assets/models/characters/Colobus_LOD0.glb');
      characterMesh = modelGltf.scene.clone();
      mixer = new THREE.AnimationMixer(characterMesh);
      
      // Create a simple idle "animation" (no actual animation)
      animations.set('idle', mixer.clipAction(new THREE.AnimationClip('idle', 1, [])));
      animations.set('run', mixer.clipAction(new THREE.AnimationClip('run', 1, [])));
      
      console.log(`🎭 Loaded Colobus model without animations (fallback)`);
    }
    
    // Set up the mesh
    characterMesh.scale.set(2.0, 2.0, 2.0);
    characterMesh.castShadow = true;
    characterMesh.receiveShadow = true;
    
    // Enable shadows and fix materials for all child meshes
    characterMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        // Force visible material - common GLTF loading issue fix
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              mat.transparent = false;
              mat.opacity = 1.0;
              if (!mat.map) {
                // If no texture, use a solid color
                mat.color = new THREE.Color(0x8B4513); // Brown color for character
              }
            });
          } else {
            child.material.transparent = false;
            child.material.opacity = 1.0;
            if (!child.material.map) {
              // If no texture, use a solid color
              child.material.color = new THREE.Color(0x8B4513); // Brown color for character
            }
          }
        }
      }
    });

    // Get idle animation (try different possible names)
    let idleAnimation = animations.get('idle_a') || 
                      animations.get('idle') || 
                      animations.get('colobus_idle_a') ||
                      animations.values().next().value;

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
      // EXACT COPY FROM WORKING TEST SCENE
      console.log(`📂 Loading: /assets/animations/characters/Colobus_Animations.glb`);
      const gltf = await this.loadGLTF('/assets/animations/characters/Colobus_Animations.glb');
      console.log('✅ Model loaded');

      const character = gltf.scene.clone();
      
      // Try different scales
      character.scale.set(0.5, 0.5, 0.5);
      
      // Keep original materials but ensure visibility
      character.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            // Don't replace the material, just ensure it's visible
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.wireframe = false;
              });
            } else {
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.wireframe = false;
            }
          }
        }
      });

      // Position at origin with no rotation to test
      character.position.set(0, 0, 0);
      character.rotation.y = 0; // No rotation - test default orientation
      this.scene.add(character);

      // Setup animations if they exist
      let mixer: THREE.AnimationMixer | undefined;
      const animations = new Map<string, THREE.AnimationAction>();
      
      if (gltf.animations && gltf.animations.length > 0) {
        // Find the SkinnedMesh and create mixer on that instead of the character group
        let skinnedMesh: THREE.SkinnedMesh | null = null;
        character.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh) {
            skinnedMesh = child;
          }
        });
        
        if (skinnedMesh) {
          console.log(`🎭 Creating AnimationMixer on SkinnedMesh: ${skinnedMesh.name}`);
          mixer = new THREE.AnimationMixer(skinnedMesh);
        } else {
          console.log(`🎭 Creating AnimationMixer on character group`);
          mixer = new THREE.AnimationMixer(character);
        }
        
        gltf.animations.forEach((clip, index) => {
          
          const action = mixer!.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          
          // Ensure proper interpolation
          action.setEffectiveWeight(1.0);
          action.setEffectiveTimeScale(1.0);
          
          animations.set(clip.name.toLowerCase(), action);
        });
        
        console.log(`✅ Loaded ${gltf.animations.length} animations`);
      } else {
        console.log('⚠️ No animations found in model');
      }

      const player: Player = {
        id: this.localPlayerId,
        position: new THREE.Vector3(0, 0, 0),
        rotation: 0, // Initialize to 0
        mesh: character,
        isLocal: true,
        animationMixer: mixer,
        animations: animations,
        currentAnimation: animations.get('idle_a') || animations.values().next().value,
        isMoving: false
      };

      // Make sure mesh rotation matches player rotation
      player.mesh.rotation.y = player.rotation;

      this.players.set(this.localPlayerId, player);

      // Start animation
      if (player.currentAnimation) {
        player.currentAnimation.play();
      }

      // Test: Try camera from left side - negative X  
      this.camera.position.set(-8, 5, 0); // Test negative X position (left side)
      this.camera.lookAt(0, 0, 0); // Look at player at origin
      
      console.log('Camera positioned at:', this.camera.position);
      console.log('Player positioned at:', player.position);
      
      console.log(`🎯 Animated Colobus character created at position (${player.position.x}, ${player.position.y}, ${player.position.z}): ${this.localPlayerId}`);
      
    } catch (error) {
      console.error('❌ GLTF loading failed:', error);
      // Fall back to red cube if GLTF fails
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green for fallback
      const characterMesh = new THREE.Mesh(geometry, material);
      
      const player: Player = {
        id: this.localPlayerId,
        position: new THREE.Vector3(position.x, position.y, position.z),
        rotation: 0,
        mesh: characterMesh,
        isLocal: true,
        isMoving: false
      };

      player.mesh.position.copy(player.position);
      this.scene.add(player.mesh);
      this.players.set(this.localPlayerId, player);
      this.updateCamera(player);
      
      console.log('🟢 Fallback green cube created');
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

    // Immediately update camera to follow the player
    this.updateCamera(player);

    console.log(`🐿️ Fallback capsule player created: ${this.localPlayerId}`);
  }

  private async createRemotePlayer(id: string, position: { x: number; y: number; z: number }): Promise<void> {
    if (this.players.has(id)) return;

    console.log(`👥 Creating remote Colobus player: ${id}`);
    
    try {
      const characterMesh = await this.loadColobusCharacter();
      
      const player: Player = {
        id: id,
        position: new THREE.Vector3(position.x, position.y, position.z),
        rotation: 0,
        mesh: characterMesh.mesh,
        isLocal: false,
        animationMixer: characterMesh.mixer,
        animations: characterMesh.animations,
        currentAnimation: characterMesh.idleAnimation,
        isMoving: false
      };

      player.mesh.position.copy(player.position);
      this.scene.add(player.mesh);
      this.players.set(id, player);

      // Start with idle animation
      if (player.currentAnimation) {
        player.currentAnimation.play();
      }

      console.log(`👥 Animated remote Colobus player joined: ${id}`);
    } catch (error) {
      console.error('❌ Failed to load Colobus for remote player, falling back to capsule:', error);
      this.createFallbackRemotePlayer(id, position);
    }
  }

  private createFallbackRemotePlayer(id: string, position: { x: number; y: number; z: number }): void {
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
      isLocal: false,
      isMoving: false
    };

    mesh.position.copy(player.position);
    this.scene.add(mesh);
    this.players.set(id, player);

    console.log(`👥 Fallback remote player joined: ${id}`);
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
          this.updateRemotePlayer(message.squirrelId, message.position, message.rotationY, message.animationState);
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

  private updateRemotePlayer(id: string, position: { x: number; y: number; z: number }, rotation: number, animationState?: string): void {
    const player = this.players.get(id);
    if (player && !player.isLocal) {
      player.position.set(position.x, position.y, position.z);
      player.rotation = rotation;
      player.mesh.position.copy(player.position);
      player.mesh.rotation.y = rotation;
      
      // Update animation state if provided
      if (animationState && player.animations) {
        this.updatePlayerAnimation(player, animationState);
      }
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

    const moveSpeed = 5;
    const rotationSpeed = 3;
    let moved = false;

    // A/D keys: Rotate player left/right (Y-axis rotation)
    if (this.keys.has('a')) {
      player.rotation -= rotationSpeed * deltaTime;
      console.log('A pressed: player.rotation =', player.rotation.toFixed(2));
    }
    if (this.keys.has('d')) {
      player.rotation += rotationSpeed * deltaTime;
      console.log('D pressed: player.rotation =', player.rotation.toFixed(2));
    }

    // W/S keys: Move forward/backward in player's facing direction
    if (this.keys.has('w')) {
      // Forward: move in direction player is facing (cos for X, sin for Z)
      player.position.x += Math.cos(player.rotation) * moveSpeed * deltaTime;
      player.position.z += Math.sin(player.rotation) * moveSpeed * deltaTime;
      moved = true;
    }
    if (this.keys.has('s')) {
      // Backward: move opposite to player facing direction
      player.position.x -= Math.cos(player.rotation) * moveSpeed * deltaTime;
      player.position.z -= Math.sin(player.rotation) * moveSpeed * deltaTime;
      moved = true;
    }

    // Update mesh position and rotation
    player.mesh.position.copy(player.position);
    player.mesh.rotation.y = player.rotation;

    // Update animations
    const wasMoving = player.isMoving;
    player.isMoving = moved;
    
    if (player.isMoving !== wasMoving && player.animations) {
      const newAnimationName = player.isMoving ? 'run' : 'idle_a';
      this.updatePlayerAnimation(player, newAnimationName);
    }

    if (player.animationMixer) {
      player.animationMixer.update(deltaTime);
      
      player.mesh.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
          child.skeleton.update();
          
          if (child.geometry.attributes.position) {
            child.geometry.attributes.position.needsUpdate = true;
          }
          if (child.geometry.attributes.normal) {
            child.geometry.attributes.normal.needsUpdate = true;
          }
        }
      });
    }
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
  }

  private updateCamera(player: Player): void {
    // SIMPLE TEST: Camera directly follows player with fixed offset
    // This should make camera move when player moves
    this.camera.position.x = player.position.x;
    this.camera.position.y = player.position.y + 5;
    this.camera.position.z = player.position.z + 8;
    
    this.camera.lookAt(player.position);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastFrame = performance.now();
    console.log('🎮 Game loop starting...');
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

    // Update camera to follow local player
    const localPlayer = this.players.get(this.localPlayerId || '');
    if (localPlayer) {
      this.updateCamera(localPlayer);
    }

    // Update remote players' animation mixers
    this.players.forEach(player => {
      if (!player.isLocal && player.animationMixer) {
        player.animationMixer.update(deltaTime);
        
        // Force skeleton updates for remote players too
        player.mesh.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            child.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
            child.skeleton.update();
            
            if (child.geometry.attributes.position) {
              child.geometry.attributes.position.needsUpdate = true;
            }
            if (child.geometry.attributes.normal) {
              child.geometry.attributes.normal.needsUpdate = true;
            }
          }
        });
      }
    });

    // Render
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.gameLoop);
  };
}