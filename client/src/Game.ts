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
  private character: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction } = {};
  private currentAction: THREE.AnimationAction | null = null;
  private keys: Set<string> = new Set();
  private clock = new THREE.Clock();
  private velocity = new THREE.Vector3();
  private actualVelocity = new THREE.Vector3(); // Actual physics velocity for network sync
  private direction = new THREE.Vector3();
  private moveSpeed = 5; // Normal movement speed
  private acceleration = 20; // Units per second squared - how fast we accelerate
  private deceleration = 15; // Units per second squared - how fast we decelerate
  private rotationSpeed = Math.PI;
  private gravity = -9.8;
  private jumpVelocity = 5;


  // INDUSTRY STANDARD: Asset caching system
  private static gltfLoader = new GLTFLoader(); // Singleton loader
  private static assetCache = new Map<string, THREE.Group>();
  private static animationCache = new Map<string, THREE.AnimationClip>();
  private isJumping = false;
  private characters: Character[] = [];
  public selectedCharacterId = 'colobus';
  private characterGroundOffset = 0; // Offset from character pivot to feet
  
  // Multiplayer properties
  private websocket: WebSocket | null = null;
  private playerId: string = '';
  private remotePlayers: Map<string, THREE.Group> = new Map();
  // Entity interpolation with velocity-based extrapolation - industry standard for smooth multiplayer
  private remotePlayerBuffers: Map<string, Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; velocity?: THREE.Vector3; timestamp: number }>> = new Map();
  private INTERPOLATION_DELAY = 50; // 50ms - 1x the update interval (lower latency)
  private MAX_BUFFER_SIZE = 5; // Increased buffer for smoother interpolation
  private remotePlayerMixers: Map<string, THREE.AnimationMixer> = new Map();
  private remotePlayerActions: Map<string, { [key: string]: THREE.AnimationAction }> = new Map();
  private lastPositionSent = { x: 0, y: 0, z: 0, rotation: 0, animation: '', moveType: 'idle' };
  // Movement type tracking for proper animation sync
  private currentMoveType: string = 'idle'; // 'idle', 'walking', 'rotating'
  private currentAnimationName: string = 'idle';
  private lastNetworkAnimationName: string = 'idle'; // Track last animation sent to network
  private animationStateChanged: boolean = false; // Flag for animation state changes
  private animationStartTime: number = 0; // Time when current animation started (for sync)
  private positionSendInterval: number = 0;
  private heartbeatInterval: number = 0;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;
  private isConnected: boolean = false;

  // INDUSTRY STANDARD: Smooth camera interpolation
  private cameraLerpFactor = 0.15; // Higher = faster catch-up, lower = smoother

  // INDUSTRY STANDARD: Animation state machine with hysteresis (prevents rapid state oscillation)
  private lastAnimationChangeTime: number = 0;
  private animationChangeDelay: number = 0.1; // Minimum 100ms between animation changes

  // INDUSTRY STANDARD: Manual delta time calculation to avoid Clock.getDelta() issues
  private lastFrameTime: number = 0;
  private MAX_DELTA_TIME = 1/30; // Cap at 30fps to prevent spiral of death


  async init(canvas: HTMLCanvasElement) {
    console.log('🚀 GAME INIT STARTED');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    console.log('✅ Scene created with background color');

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
      // INDUSTRY STANDARD: Fallback matches characters.json structure exactly
      this.characters = [{
        id: 'colobus',
        modelPath: '/assets/models/characters/Colobus_LOD0.glb',
        animations: {
          "idle": "/assets/animations/characters/Single/Colobus_Idle_A.glb",
          "walk": "/assets/animations/characters/Single/Colobus_Walk.glb",
          "run": "/assets/animations/characters/Single/Colobus_Run.glb", 
          "jump": "/assets/animations/characters/Single/Colobus_Jump.glb"
        },
        scale: 0.3
      }];
    }

    // INDUSTRY STANDARD: Add basic sanity check before character loading
    console.log('🧪 Adding sanity check cube');
    this.addSanityCheckCube();
    console.log('📦 Scene children after sanity cube:', this.scene.children.length);

    // Load selected character
    await this.loadCharacter();

    // Add landmark cube for navigation  
    this.addLandmarkCube();

    // Setup multiplayer connection
    await this.setupMultiplayer();

    // Events
    this.setupEvents();

    // Start debug overlay updates
    this.startDebugUpdates();

    // Final debug output
    console.log('🏁 GAME INIT COMPLETE');
    console.log('📦 Final scene children count:', this.scene.children.length);
    console.log('📦 Scene children:', this.scene.children.map(child => ({ type: child.type, name: child.name || 'unnamed', position: child.position })));
    console.log('📷 Camera position:', this.camera.position);

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private async loadCharacter() {
    const char = this.characters.find(c => c.id === this.selectedCharacterId);
    if (!char) {
      console.error('❌ Character config not found:', this.selectedCharacterId);
      return;
    }

    console.log('🎮 Starting character load...');
    try {
      // INDUSTRY STANDARD: Use cached assets
      const characterModel = await this.loadCachedAsset(char.modelPath);
      if (!characterModel) {
        console.error('❌ Failed to load character model');
        return;
      }
      console.log('✅ Character model loaded successfully');
      
      this.character = characterModel;
      this.character.scale.set(char.scale, char.scale, char.scale);
      this.character.position.set(0, 0, 0);
      this.character.rotation.y = Math.PI;
      this.character.castShadow = true;
      this.scene.add(this.character);
      
      console.log('✅ Character added to scene');

      // INDUSTRY STANDARD: Animation mixer on character model
      this.mixer = new THREE.AnimationMixer(this.character);

      // INDUSTRY STANDARD: Parallel animation loading with caching and validation
      const animationPromises = Object.entries(char.animations).map(async ([name, path]) => {
        try {
          const clip = await this.loadCachedAnimation(path);
          if (clip) {
            this.actions[name] = this.mixer!.clipAction(clip);
            return { name, success: true };
          } else {
            console.error(`❌ Failed to load animation ${name}: clip not found`);
            return { name, success: false };
          }
        } catch (error) {
          console.error(`❌ Failed to load animation ${name}:`, error);
          return { name, success: false };
        }
      });

      const animationResults = await Promise.all(animationPromises);
      const successCount = animationResults.filter(r => r.success).length;
      console.log(`✅ Loaded ${successCount}/${animationResults.length} animations`);
      
      // Validate at least idle animation loaded
      if (!this.actions.idle) {
        console.error('❌ CRITICAL: Idle animation failed to load - character will not function properly');
      }

      // Use model's actual bounding box for accurate ground positioning
      const box = new THREE.Box3().setFromObject(this.character);
      this.characterGroundOffset = -box.min.y;

      this.setAction('idle');
      this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z) + this.characterGroundOffset;
    } catch (error) {
      console.error('❌ CRITICAL: Character loading failed:', error);
      console.error('❌ Game will not function properly without character');
      // Don't throw - let game continue but log the issue
    }
  }


  private setAction(name: string) {
    const newAction = this.actions[name];
    if (!newAction) return;

    if (newAction === this.currentAction) return;

    // Stop current animation
    if (this.currentAction) {
      this.currentAction.stop();
    }

    // INDUSTRY STANDARD: Configure animation to loop seamlessly
    newAction.reset();
    newAction.setLoop(THREE.LoopRepeat, Infinity);
    newAction.clampWhenFinished = false;
    newAction.play();

    this.currentAction = newAction;
    this.currentAnimationName = name;
    this.animationStateChanged = true;
    this.animationStartTime = performance.now();
  }

  private setRemotePlayerAction(playerId: string, animationName: string, animationStartTime?: number) {
    const actions = this.remotePlayerActions.get(playerId);
    if (!actions) return;

    const newAction = actions[animationName];
    if (!newAction) return;

    // Stop all running animations
    for (const action of Object.values(actions)) {
      if (action.isRunning()) {
        action.stop();
      }
    }

    // INDUSTRY STANDARD: Configure animation to loop seamlessly
    newAction.reset();
    newAction.setLoop(THREE.LoopRepeat, Infinity);
    newAction.clampWhenFinished = false;
    newAction.play();

    // Sync animation time if provided
    if (animationStartTime && newAction.getClip()) {
      const currentTime = performance.now();
      const elapsedTime = (currentTime - animationStartTime) / 1000;
      const animationDuration = newAction.getClip().duration;

      if (animationDuration > 0) {
        newAction.time = elapsedTime % animationDuration;
      }
    }
  }

  private setupEvents() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      // Jump with space
      if (e.key === ' ' && !this.isJumping) {
        this.isJumping = true;
        this.velocity.y = this.jumpVelocity;
        this.setAction('jump');
      }
      
      // Debug overlay toggle with F key
      if (e.key === 'f' || e.key === 'F') {
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) {
          debugOverlay.classList.toggle('hidden');
        }
      }
      
      // Debug scene contents with I key (Info)
      if (e.key === 'i' || e.key === 'I') {
        console.log('🔍 Scene debug info:');
        console.log('- Scene children count:', this.scene.children.length);
        console.log('- Remote players count:', this.remotePlayers.size);
        console.log('- Local character position:', this.character?.position);
        this.scene.children.forEach((child, i) => {
          console.log(`- Child ${i}:`, child.type, child.position, 'visible:', child.visible);
        });
        this.remotePlayers.forEach((player, id) => {
          console.log('- Remote player', id, 'position:', player.position, 'visible:', player.visible);
        });
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

  // Cleanup method for proper resource management
  public destroy(): void {
    console.log('🧹 Cleaning up game resources...');
    
    // Stop all intervals
    this.stopIntervals();
    
    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close(1000, 'Game shutdown');
      this.websocket = null;
    }
    
    // Remove all remote players
    for (const playerId of this.remotePlayers.keys()) {
      this.removeRemotePlayer(playerId);
    }
    this.remotePlayers.clear();
    this.remotePlayerMixers.clear();
    this.remotePlayerActions.clear();
    
    
    // Reset connection state
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.playerId = '';
  }

  private animate = () => {
    requestAnimationFrame(this.animate);

    // INDUSTRY STANDARD: Manual delta time calculation (avoids Clock.getDelta() issues)
    const currentTime = performance.now() / 1000; // Convert to seconds
    let delta = this.lastFrameTime === 0 ? 1/60 : currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // INDUSTRY STANDARD: Cap delta to prevent spiral of death on lag spikes
    delta = Math.min(delta, this.MAX_DELTA_TIME);

    // Update player physics
    if (this.character) {
      this.updatePlayer(delta);
      this.updateCamera();
    }

    // Update animations
    if (this.mixer) {
      this.mixer.update(delta);
    }

    for (const mixer of this.remotePlayerMixers.values()) {
      mixer.update(delta);
    }

    // Update remote player interpolation
    this.updateRemotePlayerInterpolation(delta);

    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(delta: number) {
    // STANDARD: Validate character exists before movement
    if (!this.character) return;

    // INDUSTRY STANDARD: Calculate desired velocity based on input
    const desiredVelocity = new THREE.Vector3(0, 0, 0);
    let moving = false;
    let rotating = false;

    // STANDARD: Character rotation (not camera rotation)
    if (this.keys.has('a')) {
      this.character.rotation.y += this.rotationSpeed * delta;
      rotating = true;
    }
    if (this.keys.has('d')) {
      this.character.rotation.y -= this.rotationSpeed * delta;
      rotating = true;
    }

    // Calculate desired horizontal velocity from input
    if (this.keys.has('w')) {
      this.direction.set(0, 0, 1).applyQuaternion(this.character.quaternion);
      desiredVelocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }
    if (this.keys.has('s')) {
      this.direction.set(0, 0, -1).applyQuaternion(this.character.quaternion);
      desiredVelocity.add(this.direction.multiplyScalar(this.moveSpeed));
      moving = true;
    }

    // INDUSTRY STANDARD: Smooth acceleration/deceleration for continuous velocity
    if (moving) {
      // Accelerate towards desired velocity
      const currentHorizontalVel = new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
      const desiredHorizontalVel = new THREE.Vector3(desiredVelocity.x, 0, desiredVelocity.z);
      const velocityDiff = desiredHorizontalVel.clone().sub(currentHorizontalVel);
      const accelAmount = this.acceleration * delta;

      if (velocityDiff.length() > accelAmount) {
        velocityDiff.normalize().multiplyScalar(accelAmount);
      }

      this.velocity.x += velocityDiff.x;
      this.velocity.z += velocityDiff.z;
      this.currentMoveType = 'walking';
    } else {
      // Decelerate to zero when no input
      const currentHorizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
      if (currentHorizontalSpeed > 0.01) {
        const decelAmount = this.deceleration * delta;
        if (currentHorizontalSpeed <= decelAmount) {
          // Snap to zero if close enough
          this.velocity.x = 0;
          this.velocity.z = 0;
        } else {
          // Gradually decelerate
          const decelFactor = Math.max(0, currentHorizontalSpeed - decelAmount) / currentHorizontalSpeed;
          this.velocity.x *= decelFactor;
          this.velocity.z *= decelFactor;
        }
      }

      if (rotating) {
        this.currentMoveType = 'rotating';
      } else {
        this.currentMoveType = 'idle';
      }
    }

    // Gravity and jump
    if (this.isJumping) {
      this.velocity.y += this.gravity * delta;
      this.character.position.y += this.velocity.y * delta;
      if (this.character.position.y <= getTerrainHeight(this.character.position.x, this.character.position.z) + this.characterGroundOffset) {
        this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z) + this.characterGroundOffset;
        this.isJumping = false;
        this.velocity.y = 0;
        // STANDARD: Use correct animation after landing
        const isRunning = moving && this.keys.has('shift');
        let animation = 'idle';
        if (moving) {
          animation = isRunning ? 'run' : 'walk';
        }
        this.setAction(animation);
      }
    }

    // Apply horizontal movement and update actual velocity for network sync
    const movementDelta = this.velocity.clone().setY(0).multiplyScalar(delta);
    this.character.position.add(movementDelta);

    // Update actual velocity (units per second) for accurate network transmission
    this.actualVelocity.x = this.velocity.x;
    this.actualVelocity.y = this.velocity.y;
    this.actualVelocity.z = this.velocity.z;

    // STANDARD: Use raycasting for precise ground detection (prevents sinking)
    this.snapToGround();

    if (!this.isJumping) {
      // INDUSTRY STANDARD: Animation state machine with hysteresis
      const currentTime = performance.now() / 1000; // Convert to seconds
      const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

      // Determine what animation should be playing
      let animation = 'idle';
      if (horizontalSpeed > 0.5) { // Increased threshold to prevent oscillation at low speeds
        const isRunning = this.keys.has('shift');
        animation = isRunning ? 'run' : 'walk';
      }

      // Only change animation if different AND enough time has passed (hysteresis)
      if (animation !== this.currentAnimationName &&
          (currentTime - this.lastAnimationChangeTime) >= this.animationChangeDelay) {
        this.setAction(animation);
        this.lastAnimationChangeTime = currentTime;
      }
    }
  }

  // Optimized ground detection using height function instead of expensive raycasting
  private snapToGround() {
    if (!this.character) return;

    // Use fast heightmap lookup instead of raycasting every frame
    this.character.position.y = getTerrainHeight(this.character.position.x, this.character.position.z) + this.characterGroundOffset;
  }

  private updateCamera() {
    // INDUSTRY STANDARD: Validate character exists before camera update
    if (!this.character) {
      console.warn('⚠️ updateCamera called but character is null');
      return;
    }

    // INDUSTRY STANDARD: Third-person camera with smooth interpolation
    const offset = new THREE.Vector3(0, 0.6, -0.9).applyQuaternion(this.character.quaternion);
    const targetCameraPosition = this.character.position.clone().add(offset);

    // Smooth camera interpolation - prevents stuttering
    this.camera.position.lerp(targetCameraPosition, this.cameraLerpFactor);

    // Smooth look-at target
    const lookAtTarget = this.character.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.camera.lookAt(lookAtTarget);
  }

  // Multiplayer methods
  private async setupMultiplayer() {
    // Generate player ID
    this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
    
    // Attempt connection with retry logic
    await this.connectWebSocket();
  }

  private async connectWebSocket(): Promise<void> {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.error('❌ Max connection attempts reached. Multiplayer disabled.');
      return;
    }

    this.connectionAttempts++;
    
    // Get WebSocket URL - check environment or use default
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:50569';
    const wsUrl = apiUrl.replace('http:', 'ws:').replace('https:', 'wss:') + 
                  `/ws?squirrelId=${this.playerId}&characterId=${this.selectedCharacterId}`;
    
    console.log(`🔌 Connecting to WebSocket (attempt ${this.connectionAttempts}):`, wsUrl);
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
          console.warn('⏰ WebSocket connection timeout');
          this.websocket.close();
        }
      }, 5000);
      
      this.websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        this.connectionAttempts = 0; // Reset on successful connection
        
        // Start position updates and heartbeat
        this.startPositionUpdates();
        this.startHeartbeat();
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };
      
      this.websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('❌ WebSocket error:', error);
      };
      
      this.websocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        
        this.stopIntervals();
        
        // Attempt reconnection if not intentional close
        if (event.code !== 1000 && this.connectionAttempts < this.maxConnectionAttempts) {
          console.log(`🔄 Reconnecting in 2 seconds... (attempt ${this.connectionAttempts + 1}/${this.maxConnectionAttempts})`);
          setTimeout(() => this.connectWebSocket(), 2000);
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      // Retry connection
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        setTimeout(() => this.connectWebSocket(), 2000);
      }
    }
  }

  private startPositionUpdates(): void {
    this.positionSendInterval = window.setInterval(() => {
      this.sendPositionUpdate();
    }, 50); // 20 updates per second - industry standard for smooth movement
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      this.sendMessage({ type: 'heartbeat' });
    }, 30000); // Heartbeat every 30 seconds
  }

  private stopIntervals(): void {
    if (this.positionSendInterval) {
      clearInterval(this.positionSendInterval);
      this.positionSendInterval = 0;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = 0;
    }
  }

  private sendMessage(message: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private calculateActualVelocity(): { x: number; y: number; z: number } {
    // Return the actual physics velocity instead of position-delta calculation
    return {
      x: Math.round(this.actualVelocity.x * 100) / 100,
      y: Math.round(this.actualVelocity.y * 100) / 100,
      z: Math.round(this.actualVelocity.z * 100) / 100
    };
  }

  private sendPositionUpdate(): void {
    if (!this.character || !this.isConnected) return;

    const pos = this.character.position;
    const rot = this.character.rotation.y;

    // DELTA COMPRESSION: Only send if changes exceed thresholds
    const positionThreshold = 0.1;
    const rotationThreshold = 0.1;

    const positionChanged = Math.abs(pos.x - this.lastPositionSent.x) > positionThreshold ||
                           Math.abs(pos.y - this.lastPositionSent.y) > positionThreshold ||
                           Math.abs(pos.z - this.lastPositionSent.z) > positionThreshold;

    const rotationChanged = Math.abs(rot - this.lastPositionSent.rotation) > rotationThreshold;

    // Only send animation if it changed since last network update (prevents per-frame spam)
    const animationChanged = this.animationStateChanged || this.currentAnimationName !== this.lastNetworkAnimationName;
    const moveTypeChanged = this.currentMoveType !== this.lastPositionSent.moveType;

    if (positionChanged || rotationChanged || animationChanged || moveTypeChanged) {
      // Always send complete transform state for reliability
      this.sendMessage({
        type: 'player_update',
        position: {
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100
        },
        rotationY: Math.round(rot * 100) / 100,
        animation: this.currentAnimationName,
        animationStartTime: this.animationStartTime,
        velocity: this.calculateActualVelocity(),
        timestamp: performance.now()
      });

      // Update last sent state
      this.lastPositionSent.x = pos.x;
      this.lastPositionSent.y = pos.y;
      this.lastPositionSent.z = pos.z;
      this.lastPositionSent.rotation = rot;
      this.lastPositionSent.animation = this.currentAnimationName;
      this.lastPositionSent.moveType = this.currentMoveType;
      this.animationStateChanged = false;
      this.lastNetworkAnimationName = this.currentAnimationName;
    }
  }

  private handleMessage(data: any): void {
    // Validate message structure
    if (!data || typeof data.type !== 'string') {
      console.warn('⚠️ Invalid message format:', data);
      return;
    }

    switch (data.type) {
      case 'world_state':
        console.log('🌍 Received world state');
        // World state contains terrainSeed, mapState, forestObjects
        // For now, just log it - can be used for world sync later
        break;
        
      case 'existing_players':
        console.log('👥 Existing players received:', data.players?.length || 0);
        if (Array.isArray(data.players)) {
          for (const player of data.players) {
            console.log('👤 Processing existing player:', player.squirrelId, 'at position:', player.position);
            if (this.validatePlayerData(player)) {
              this.createRemotePlayer(player.squirrelId, player.position, player.rotationY);
            } else {
              console.warn('⚠️ Invalid player data:', player);
            }
          }
        }
        break;
        
      case 'player_joined':
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          this.createRemotePlayer(data.squirrelId, data.position, data.rotationY);
        }
        break;
        
      case 'player_leave':  // Server sends "player_leave" not "player_left"
        console.log('👋 Player left:', data.squirrelId);
        if (data.squirrelId && data.squirrelId !== this.playerId) {
          this.removeRemotePlayer(data.squirrelId);
        }
        break;
        
      case 'player_update':  // Server sends position updates as "player_update"
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          this.updateRemotePlayer(data.squirrelId, data.position, data.rotationY, data.animation, data.velocity, data.animationStartTime, data.moveType);
        }
        break;

      case 'heartbeat':
        // Heartbeat response - connection is alive
        break;
        
      default:
        console.warn('⚠️ Unknown message type:', data.type);
    }
  }

  private validatePlayerData(data: any): boolean {
    return data && 
           typeof data.squirrelId === 'string' && 
           data.position && 
           typeof data.position.x === 'number' && 
           typeof data.position.y === 'number' && 
           typeof data.position.z === 'number' && 
           typeof data.rotationY === 'number';
  }

  private async createRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number): Promise<void> {
    if (this.remotePlayers.has(playerId)) {
      // Player already exists, just update position
      this.updateRemotePlayer(playerId, position, rotationY, undefined, undefined, undefined);
      return;
    }
    
    try {
      // INDUSTRY STANDARD: Use cached assets for remote players
      const char = this.characters.find(c => c.id === this.selectedCharacterId);
      if (!char) {
        console.error('❌ Character config not found');
        return;
      }

      const remoteCharacter = await this.loadCachedAsset(char.modelPath);
      if (!remoteCharacter) {
        console.error('❌ Failed to load remote player model');
        return;
      }

      // Visual distinction for remote players
      remoteCharacter.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const material = Array.isArray(child.material) 
            ? child.material.map((mat: any) => mat.clone())
            : child.material.clone();
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.color?.multiplyScalar(0.7));
          } else {
            material.color?.multiplyScalar(0.7);
          }
          child.material = material;
        }
      });

      remoteCharacter.scale.set(char.scale, char.scale, char.scale);
      remoteCharacter.castShadow = true;

      // INDUSTRY STANDARD: Use cached animations for remote players
      const remoteMixer = new THREE.AnimationMixer(remoteCharacter);
      const remoteActions: { [key: string]: THREE.AnimationAction } = {};

      // Parallel animation loading using cached clips
      const remoteAnimationPromises = Object.entries(char.animations).map(async ([name, path]) => {
        try {
          const clip = await this.loadCachedAnimation(path);
          if (clip) {
            remoteActions[name] = remoteMixer.clipAction(clip);
            return { name, success: true };
          } else {
            console.error(`❌ Failed to load remote animation ${name}: clip not found`);
            return { name, success: false };
          }
        } catch (error) {
          console.error(`❌ Failed to load remote animation ${name}:`, error);
          return { name, success: false };
        }
      });

      await Promise.all(remoteAnimationPromises);
      
      // Set initial position and rotation - will be managed by interpolation system
      remoteCharacter.position.set(position.x, position.y, position.z);
      const initialQuaternion = new THREE.Quaternion();
      initialQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      remoteCharacter.quaternion.copy(initialQuaternion);
      
      // Store all character data
      this.remotePlayers.set(playerId, remoteCharacter);
      this.remotePlayerMixers.set(playerId, remoteMixer);
      this.remotePlayerActions.set(playerId, remoteActions);
      
      // INDUSTRY STANDARD: Initialize interpolation buffer for newly created player
      const initialState = {
        position: new THREE.Vector3(position.x, position.y, position.z),
        quaternion: initialQuaternion.clone(), // Use the same quaternion from character setup
        velocity: new THREE.Vector3(0, 0, 0),
        timestamp: Date.now()
      };
      this.remotePlayerBuffers.set(playerId, [initialState]);
      
      // Start with idle animation
      if (remoteActions['idle']) {
        remoteActions['idle'].play();
      }
      
      this.scene.add(remoteCharacter);
      
      console.log('✅ Created remote player:', playerId);
    } catch (error) {
      console.error('❌ Failed to create remote player:', playerId, error);
    }
  }

  private updateRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; y: number; z: number }, animationStartTime?: number, moveType?: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      // ENTITY INTERPOLATION: Add new state to buffer for smooth interpolation
      const newQuaternion = new THREE.Quaternion();
      newQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      const newState = {
        position: new THREE.Vector3(position.x, position.y, position.z),
        quaternion: newQuaternion.clone(),
        velocity: velocity ? new THREE.Vector3(velocity.x, velocity.y, velocity.z) : new THREE.Vector3(0, 0, 0),
        timestamp: Date.now()
      };
      
      // Get or create buffer for this player
      let buffer = this.remotePlayerBuffers.get(playerId);
      if (!buffer) {
        buffer = [];
        this.remotePlayerBuffers.set(playerId, buffer);
      }
      
      // Add new state and maintain buffer - industry standard cleanup
      buffer.push(newState);
      
      // Remove states older than interpolation window + safety margin
      const cutoffTime = newState.timestamp - (this.INTERPOLATION_DELAY + 100);
      while (buffer.length > 2 && buffer[0].timestamp < cutoffTime) {
        buffer.shift();
      }
      
      // Safety: never let buffer exceed max size
      while (buffer.length > this.MAX_BUFFER_SIZE) {
        buffer.shift();
      }
      


      // Update animation if provided with time-based sync
      if (animation) {
        this.setRemotePlayerAction(playerId, animation, animationStartTime);
      }
    } else {
      // Player doesn't exist yet, create them
      this.createRemotePlayer(playerId, position, rotationY);
    }
  }

  // INDUSTRY STANDARD: Simplified buffered interpolation for smooth multiplayer
  private updateRemotePlayerInterpolation(deltaTime: number): void {
    const currentTime = Date.now();
    const renderTime = currentTime - this.INTERPOLATION_DELAY;

    for (const [playerId, buffer] of this.remotePlayerBuffers) {
      const player = this.remotePlayers.get(playerId);
      if (!player || buffer.length < 1) continue;

      // Single state - use it directly (no interpolation needed)
      if (buffer.length === 1) {
        const state = buffer[0];
        // Smooth lerp even for single state to reduce jitter
        player.position.lerp(state.position, 0.3);
        player.quaternion.slerp(state.quaternion, 0.3);
        continue;
      }

      // Find two states to interpolate between
      let fromState = buffer[0];
      let toState = buffer[buffer.length - 1];

      // Find the correct time bracket
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i].timestamp <= renderTime && buffer[i + 1].timestamp >= renderTime) {
          fromState = buffer[i];
          toState = buffer[i + 1];
          break;
        }
      }

      // Calculate interpolation factor
      const timeDelta = toState.timestamp - fromState.timestamp;
      let t = 0;

      if (timeDelta > 0) {
        t = (renderTime - fromState.timestamp) / timeDelta;
        // Clamp to [0, 1] - no extrapolation to avoid amplifying jitter
        t = Math.max(0, Math.min(1, t));
      }

      // Simple interpolation between two states
      player.position.lerpVectors(fromState.position, toState.position, t);
      player.quaternion.slerpQuaternions(fromState.quaternion, toState.quaternion, t);
    }
  }

  private removeRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      // Clean up geometry and materials to prevent memory leaks
      remotePlayer.traverse((child: any) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      
      this.scene.remove(remotePlayer);
      this.remotePlayers.delete(playerId);
      
      // Clean up animation system
      this.remotePlayerMixers.delete(playerId);
      this.remotePlayerActions.delete(playerId);
      
      // Clean up interpolation buffer
      this.remotePlayerBuffers.delete(playerId);
      
      console.log('🗑️ Removed remote player:', playerId);
    }
  }

  // Debug and utility methods
  private addSanityCheckCube(): void {
    // INDUSTRY STANDARD: Add basic visible primitive to verify rendering works
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00, // Bright green
      wireframe: false
    });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(3, 2, 3); // Offset from center
    this.scene.add(cube);
    
    console.log('🔧 Added sanity check cube at (3, 2, 3) - should be visible if rendering works');
  }

  private addLandmarkCube(): void {
    // Add a tall, visible red tower at origin for navigation reference
    const geometry = new THREE.BoxGeometry(2, 20, 2); // Wide and tall
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      transparent: false
    });
    const tower = new THREE.Mesh(geometry, material);
    tower.position.set(0, 10, 0); // Base at terrain level, extends up to 20
    this.scene.add(tower);
    
    console.log('📍 Added landmark tower at (0, 10, 0) - 20 units tall');
  }

  // INDUSTRY STANDARD: Asset caching methods with proper SkinnedMesh cloning
  private async loadCachedAsset(modelPath: string): Promise<THREE.Group | null> {
    if (Game.assetCache.has(modelPath)) {
      const cachedModel = Game.assetCache.get(modelPath)!;
      return this.cloneGLTF(cachedModel); // Proper GLTF cloning for SkinnedMesh
    }

    try {
      const gltf = await Game.gltfLoader.loadAsync(modelPath);
      Game.assetCache.set(modelPath, gltf.scene); // Store original scene
      return this.cloneGLTF(gltf.scene); // Return proper clone
    } catch (error) {
      console.error(`❌ Failed to load model ${modelPath}:`, error);
      return null;
    }
  }

  // INDUSTRY STANDARD: Proper GLTF scene cloning for animated models
  private cloneGLTF(gltfScene: THREE.Object3D): THREE.Group {
    const clonedScene = gltfScene.clone();
    
    // CRITICAL: Fix SkinnedMesh references after cloning
    const skinnedMeshes: { [key: string]: THREE.SkinnedMesh } = {};
    
    // First pass: collect all SkinnedMeshes
    gltfScene.traverse((node) => {
      if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes[node.name] = node as THREE.SkinnedMesh;
      }
    });
    
    // Second pass: fix skeleton references in cloned SkinnedMeshes
    clonedScene.traverse((node) => {
      if ((node as THREE.SkinnedMesh).isSkinnedMesh) {
        const skinnedMesh = node as THREE.SkinnedMesh;
        const originalMesh = skinnedMeshes[node.name];
        
        if (originalMesh && originalMesh.skeleton) {
          // Find corresponding bones in cloned hierarchy
          const bones: THREE.Bone[] = [];
          for (const originalBone of originalMesh.skeleton.bones) {
            const clonedBone = clonedScene.getObjectByName(originalBone.name) as THREE.Bone;
            if (clonedBone) {
              bones.push(clonedBone);
            }
          }
          
          if (bones.length > 0) {
            skinnedMesh.bind(new THREE.Skeleton(bones, originalMesh.skeleton.boneInverses));
          }
        }
      }
    });
    
    return clonedScene as THREE.Group;
  }

  private async loadCachedAnimation(animPath: string): Promise<THREE.AnimationClip | null> {
    if (Game.animationCache.has(animPath)) {
      return Game.animationCache.get(animPath)!;
    }

    try {
      const gltf = await Game.gltfLoader.loadAsync(animPath);
      if (gltf.animations && gltf.animations.length > 0) {
        const clip = gltf.animations[0];
        Game.animationCache.set(animPath, clip);
        return clip;
      } else {
        console.warn(`⚠️ No animations found in ${animPath}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to load animation ${animPath}:`, error);
      return null;
    }
  }

  private startDebugUpdates(): void {
    const updateDebug = () => {
      try {
        const playerPosSpan = document.getElementById('player-pos');
        const playerCountSpan = document.getElementById('player-count'); 
        const networkStatusSpan = document.getElementById('network-status');
        const playerIdSpan = document.getElementById('player-id');

        if (this.character && playerPosSpan) {
          const pos = this.character.position;
          playerPosSpan.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
        }

        if (playerCountSpan) {
          playerCountSpan.textContent = `${this.remotePlayers.size + 1}`; // +1 for local player
        }

        if (networkStatusSpan) {
          networkStatusSpan.textContent = this.isConnected ? 'Connected' : 'Disconnected';
        }

        if (playerIdSpan) {
          playerIdSpan.textContent = this.playerId || 'None';
        }
      } catch (error) {
        // Ignore debug update errors
      }
      
      requestAnimationFrame(updateDebug);
    };
    
    updateDebug();
  }
}