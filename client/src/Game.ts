import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrain } from './terrain.js';
import { createForestFromServer, bushPositions } from './forest.js';
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

  // MVP 3: Walnut system properties
  private walnuts: Map<string, THREE.Group> = new Map(); // All walnuts in world
  private playerWalnutCount: number = 3; // Player starts with 3 walnuts to hide
  private playerScore: number = 0; // Player's current score
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private walnutLabels: Map<string, HTMLElement> = new Map(); // Labels for walnuts
  private labelsContainer: HTMLElement | null = null;

  // MVP 3: Proximity indicator properties
  private PROXIMITY_GLOW_DISTANCE = 3; // Show glow within 3 units
  private PROXIMITY_CURSOR_DISTANCE = 5; // Change cursor within 5 units

  // MVP 3: Navigation landmarks
  private landmarks: Map<string, THREE.Vector3> = new Map(); // Landmark name -> position

  // Forest synchronization
  private forestCreated: boolean = false;

  // MVP 3: Minimap
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapContext: CanvasRenderingContext2D | null = null;
  private MINIMAP_WORLD_SIZE = 100; // Show 100x100 world units on minimap
  private MINIMAP_SIZE = 200; // Canvas size in pixels

  // MVP 3: Tutorial system
  private tutorialMessages: string[] = [
    "Welcome to Hidden Walnuts! 🌰",
    "Movement: Press W to move forward, A/D to rotate left/right, S to move backward.",
    "You start with 3 walnuts to hide around the forest.",
    "Press H to hide a walnut. Hide near a bush (1 pt) or bury in ground (3 pts).",
    "Click on suspicious spots to find hidden walnuts!",
    "Finding others' walnuts = points + walnut back. Finding your own = just walnut back.",
    "Use the minimap (top-right) and landmarks to navigate the forest.",
    "Good luck! Have fun hiding and finding walnuts! 🎮"
  ];
  private currentTutorialStep: number = 0;
  private tutorialShown: boolean = false;

  // MVP 4: Leaderboard system
  private leaderboardVisible: boolean = false;
  private leaderboardUpdateInterval: number = 0;

  // MVP 4: Chat and Emotes
  private playerChatLabels: Map<string, HTMLElement> = new Map(); // Chat labels for players
  private emoteInProgress: boolean = false; // Prevent emote spam


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

    // Forest will be created from server data when we receive world_state

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

    // Add landmark cube for navigation (central landmark at origin)
    this.addLandmarkCube();

    // MVP 3: Add cardinal direction landmarks (N, S, E, W)
    this.addCardinalLandmarks();

    // MVP 3: Initialize labels container
    this.labelsContainer = document.getElementById('labels-container');

    // MVP 3: Initialize minimap
    this.initMinimap();

    // MVP 3: Initialize tutorial system
    this.initTutorial();

    // MVP 4: Initialize leaderboard
    this.initLeaderboard();

    // MVP 4: Initialize quick chat and emotes
    this.initChatAndEmotes();

    // Setup multiplayer connection (walnuts will be loaded from server)
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
      // Add extra offset to prevent sinking (scale-adjusted + larger safety margin)
      this.characterGroundOffset = -box.min.y * char.scale + 0.3;

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

      // MVP 3: Hide walnut with H key
      if (e.key === 'h' || e.key === 'H') {
        this.hideWalnut();
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

    // MVP 3: Mouse click for walnut finding
    window.addEventListener('click', (event) => {
      this.onMouseClick(event);
    });
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

    // MVP 3: Animate walnuts
    this.animateWalnuts(delta);

    // MVP 3: Update walnut labels
    this.updateWalnutLabels();

    // MVP 3: Update proximity indicators
    this.updateProximityIndicators();

    // MVP 3: Update minimap
    this.updateMinimap();

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
    if (this.leaderboardUpdateInterval) {
      clearInterval(this.leaderboardUpdateInterval);
      this.leaderboardUpdateInterval = 0;
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

  private async handleMessage(data: any): Promise<void> {
    // Validate message structure
    if (!data || typeof data.type !== 'string') {
      console.warn('⚠️ Invalid message format:', data);
      return;
    }

    switch (data.type) {
      case 'world_state':
        console.log('🌍 Received world state');

        // Create forest from server data (only once)
        if (!this.forestCreated && Array.isArray(data.forestObjects)) {
          console.log(`🌲 Creating forest from server: ${data.forestObjects.length} objects`);
          await createForestFromServer(this.scene, data.forestObjects);
          this.forestCreated = true;
        }

        // Load existing walnuts from server
        if (Array.isArray(data.mapState)) {
          console.log(`🌰 Loading ${data.mapState.length} existing walnuts from server`);
          for (const walnut of data.mapState) {
            if (!walnut.found) {
              // Convert server Walnut format to client format
              // Game walnuts (origin='game') should render as golden bonus walnuts
              const walnutType = walnut.origin === 'game' ? 'game' : walnut.hiddenIn;
              const points = walnut.origin === 'game' ? 5 : (walnut.hiddenIn === 'buried' ? 3 : 1);

              this.createRemoteWalnut({
                walnutId: walnut.id,
                ownerId: walnut.ownerId,
                walnutType: walnutType,
                position: walnut.location,
                points: points
              });
            }
          }
        }
        break;

      case 'walnut_hidden':
        // Another player hid a walnut - create it locally
        console.log('🌰 Walnut hidden by another player:', data.ownerId);
        if (data.ownerId !== this.playerId) {
          this.createRemoteWalnut({
            walnutId: data.walnutId,
            ownerId: data.ownerId,
            walnutType: data.walnutType,
            position: data.position,
            points: data.points
          });
        }
        break;

      case 'walnut_found':
        // Another player found a walnut - remove it locally
        console.log('🔍 Walnut found by another player:', data.finderId);
        if (data.walnutId && data.finderId !== this.playerId) {
          this.removeWalnut(data.walnutId);
        }
        break;

      case 'existing_players':
        console.log('👥 Existing players received:', data.players?.length || 0);
        if (Array.isArray(data.players)) {
          for (const player of data.players) {
            console.log('👤 Processing existing player:', player.squirrelId, 'character:', player.characterId, 'at position:', player.position);
            if (this.validatePlayerData(player)) {
              this.createRemotePlayer(player.squirrelId, player.position, player.rotationY, player.characterId);
            } else {
              console.warn('⚠️ Invalid player data:', player);
            }
          }
        }
        break;

      case 'player_joined':
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          console.log('👤 New player joined:', data.squirrelId, 'character:', data.characterId);
          this.createRemotePlayer(data.squirrelId, data.position, data.rotationY, data.characterId);
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

      case 'chat_message':
        // Received chat message from another player
        if (data.playerId && data.message && data.playerId !== this.playerId) {
          console.log('💬 Chat from', data.playerId, ':', data.message);
          this.showChatAboveCharacter(data.playerId, data.message, false);
        }
        break;

      case 'player_emote':
        // Received emote from another player
        if (data.playerId && data.emote && data.playerId !== this.playerId) {
          console.log('👋 Emote from', data.playerId, ':', data.emote);
          this.playRemoteEmoteAnimation(data.playerId, data.emote);
        }
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

  private async createRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, characterId?: string): Promise<void> {
    if (this.remotePlayers.has(playerId)) {
      // Player already exists, just update position
      this.updateRemotePlayer(playerId, position, rotationY, undefined, undefined, undefined);
      return;
    }

    try {
      // INDUSTRY STANDARD: Use cached assets for remote players
      // Use the remote player's character ID, or fall back to local player's character
      const remoteCharacterId = characterId || this.selectedCharacterId;
      console.log(`👤 Creating remote player ${playerId} with character: ${remoteCharacterId}`);

      const char = this.characters.find(c => c.id === remoteCharacterId);
      if (!char) {
        console.error('❌ Character config not found for:', remoteCharacterId);
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

  private updateRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; y: number; z: number }, animationStartTime?: number, _moveType?: string): void {
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
  private updateRemotePlayerInterpolation(_deltaTime: number): void {
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

  /**
   * MVP 3: Add colored landmark towers at cardinal directions (N, S, E, W)
   * These help players navigate and communicate locations
   */
  private addCardinalLandmarks(): void {
    const landmarkDistance = 40; // Distance from center
    const landmarkHeight = 15; // Height of towers

    // North (Blue)
    this.createLandmark(
      new THREE.Vector3(0, 0, landmarkDistance),
      0x0000ff, // Blue
      landmarkHeight,
      'North'
    );

    // South (Green)
    this.createLandmark(
      new THREE.Vector3(0, 0, -landmarkDistance),
      0x00ff00, // Green
      landmarkHeight,
      'South'
    );

    // East (Yellow)
    this.createLandmark(
      new THREE.Vector3(landmarkDistance, 0, 0),
      0xffff00, // Yellow
      landmarkHeight,
      'East'
    );

    // West (Purple)
    this.createLandmark(
      new THREE.Vector3(-landmarkDistance, 0, 0),
      0xff00ff, // Purple
      landmarkHeight,
      'West'
    );

    console.log('🧭 Added cardinal direction landmarks (N, S, E, W)');
  }

  /**
   * Create a single landmark tower with label
   */
  private createLandmark(position: THREE.Vector3, color: number, height: number, name: string): void {
    // Get terrain height
    const terrainY = getTerrainHeight(position.x, position.z);

    // Create tower
    const geometry = new THREE.BoxGeometry(1.5, height, 1.5);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3
    });
    const tower = new THREE.Mesh(geometry, material);
    const towerPosition = new THREE.Vector3(position.x, terrainY + height / 2, position.z);
    tower.position.copy(towerPosition);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);

    // Store landmark position for label updates
    const labelPosition = new THREE.Vector3(position.x, terrainY + height, position.z);
    this.landmarks.set(`landmark-${name}`, labelPosition);

    // Add floating label
    if (this.labelsContainer) {
      const label = this.createLabel(`${name}`, '#ffffff');
      label.style.fontWeight = 'bold';
      label.style.fontSize = '14px';
      // Store label for landmark (we'll update its position every frame)
      this.walnutLabels.set(`landmark-${name}`, label);
    }
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

        // MVP 3: Update walnut HUD
        this.updateWalnutHUD();
      } catch (error) {
        // Ignore debug update errors
      }

      requestAnimationFrame(updateDebug);
    };

    updateDebug();
  }

  /**
   * MVP 3: Update walnut HUD display
   */
  private updateWalnutHUD(): void {
    const walnutCountSpan = document.getElementById('walnut-count');
    const playerScoreSpan = document.getElementById('player-score');
    const gridLocationSpan = document.getElementById('grid-location');

    if (walnutCountSpan) {
      walnutCountSpan.textContent = `${this.playerWalnutCount}`;
    }

    if (playerScoreSpan) {
      playerScoreSpan.textContent = `${this.playerScore}`;
    }

    if (gridLocationSpan && this.character) {
      gridLocationSpan.textContent = this.calculateGridLocation(this.character.position);
    }
  }

  /**
   * MVP 3: Calculate grid location (A1-Z26 format)
   * World space is approximately -90 to +90 (180 units total)
   * We divide into 26x26 grid (A-Z columns, 1-26 rows)
   */
  private calculateGridLocation(position: THREE.Vector3): string {
    // World bounds (adjust based on your terrain size)
    const WORLD_MIN = -90;
    const WORLD_MAX = 90;
    const WORLD_SIZE = WORLD_MAX - WORLD_MIN; // 180 units
    const GRID_SIZE = 26;

    // Calculate grid coordinates
    // Column (A-Z) from X position
    const xNormalized = (position.x - WORLD_MIN) / WORLD_SIZE; // 0 to 1
    const col = Math.floor(xNormalized * GRID_SIZE); // 0 to 25
    const colClamped = Math.max(0, Math.min(GRID_SIZE - 1, col));
    const colLetter = String.fromCharCode(65 + colClamped); // 'A' to 'Z'

    // Row (1-26) from Z position
    const zNormalized = (position.z - WORLD_MIN) / WORLD_SIZE; // 0 to 1
    const row = Math.floor(zNormalized * GRID_SIZE); // 0 to 25
    const rowClamped = Math.max(0, Math.min(GRID_SIZE - 1, row));
    const rowNumber = rowClamped + 1; // 1 to 26

    return `${colLetter}${rowNumber}`;
  }

  // MVP 3: Label system for landmarks and walnuts

  /**
   * Create a label for a 3D object in world space
   */
  private createLabel(text: string, color: string = 'white'): HTMLElement {
    const label = document.createElement('div');
    label.className = 'landmark-label';
    label.textContent = text;
    label.style.color = color;
    if (this.labelsContainer) {
      this.labelsContainer.appendChild(label);
    }
    return label;
  }

  /**
   * Update label position in screen space from 3D world position
   */
  private updateLabelPosition(label: HTMLElement, position: THREE.Vector3): void {
    const vector = position.clone();
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (vector.y * -0.5 + 0.5) * window.innerHeight;

    label.style.left = `${x}px`;
    label.style.top = `${y}px`;

    // Hide label if behind camera
    const isBehindCamera = vector.z > 1;
    label.style.display = isBehindCamera ? 'none' : 'block';

    // Debug logging for chat labels
    if (label.textContent && (label.textContent.includes('Nice') || label.textContent.includes('Over') || label.textContent.includes('Good') || label.textContent.includes('Want'))) {
      console.log(`📍 Label "${label.textContent}" position - screen: (${x.toFixed(0)}, ${y.toFixed(0)}), z: ${vector.z.toFixed(2)}, behind camera: ${isBehindCamera}, display: ${label.style.display}`);
    }
  }

  /**
   * Update all walnut labels - only show when player is nearby
   * Also updates landmark labels
   */
  private updateWalnutLabels(): void {
    if (!this.character) return;

    const playerPos = this.character.position;
    const LABEL_VISIBILITY_DISTANCE = 10; // Only show labels within 10 units

    // Update walnut labels
    for (const [walnutId, walnutGroup] of this.walnuts) {
      const label = this.walnutLabels.get(walnutId);
      if (label && walnutGroup) {
        // Check distance to player
        const distance = playerPos.distanceTo(walnutGroup.position);

        if (distance <= LABEL_VISIBILITY_DISTANCE) {
          // Close enough - show label
          const labelPos = walnutGroup.position.clone();
          labelPos.y += 1; // Offset above walnut
          this.updateLabelPosition(label, labelPos);
        } else {
          // Too far - hide label
          label.style.display = 'none';
        }
      }
    }

    // Update landmark labels (always visible)
    for (const [landmarkId, landmarkPos] of this.landmarks) {
      const label = this.walnutLabels.get(landmarkId);
      if (label) {
        this.updateLabelPosition(label, landmarkPos);
      }
    }

    // Update chat labels above players
    for (const [playerId, label] of this.playerChatLabels) {
      const character = playerId === this.playerId ? this.character : this.remotePlayers.get(playerId);
      if (character) {
        const labelPos = character.position.clone();
        labelPos.y += 0.5; // Position just above character's head (0.5 units)
        this.updateLabelPosition(label, labelPos);
      }
    }
  }

  // MVP 3: Walnut visual system methods

  /**
   * Create visual indicator for a buried walnut (mound of dirt)
   */
  private createBuriedWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Mound geometry - slightly raised terrain bump
    const moundGeometry = new THREE.ConeGeometry(0.3, 0.15, 8);
    const moundMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728, // Darker soil color
      roughness: 0.9
    });
    const mound = new THREE.Mesh(moundGeometry, moundMaterial);
    mound.rotation.x = Math.PI; // Flip to be a bump, not a spike
    mound.position.y = 0.05; // Slightly raised
    mound.receiveShadow = true;
    group.add(mound);

    // Add subtle dirt particles (will be animated later)
    const particleGeometry = new THREE.SphereGeometry(0.02, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: 0x6b4423,
      transparent: true,
      opacity: 0.6
    });

    for (let i = 0; i < 3; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(
        (Math.random() - 0.5) * 0.3,
        0.1 + Math.random() * 0.05,
        (Math.random() - 0.5) * 0.3
      );
      group.add(particle);
    }

    // Add invisible collision sphere for easier clicking
    const collisionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0.1;
    group.add(collisionMesh);

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'buried';
    group.userData.points = 3;
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y + 0.1, position.z);

    return group;
  }

  /**
   * Create visual indicator for a bush walnut (hidden in foliage, partially visible)
   */
  private createBushWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Walnut geometry - partially transparent to show it's obscured by bush
    const geometry = new THREE.SphereGeometry(0.15, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // Brown walnut color
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.6 // Partially transparent - hidden in bush foliage
    });
    const walnut = new THREE.Mesh(geometry, material);
    walnut.position.y = 0.4; // Slightly elevated (in bush)
    walnut.castShadow = true;
    walnut.receiveShadow = true;
    group.add(walnut);

    // Add shimmer/glint effect to help players spot it
    const glintGeometry = new THREE.SphereGeometry(0.18, 8, 8);
    const glintMaterial = new THREE.MeshBasicMaterial({
      color: 0x90EE90, // Light green shimmer (blends with bush)
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    const glint = new THREE.Mesh(glintGeometry, glintMaterial);
    glint.position.copy(walnut.position);
    group.add(glint);

    // Add invisible collision sphere for easier clicking
    const collisionGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0.4;
    group.add(collisionMesh);

    // Store glint for animation
    group.userData.glint = glint;
    group.userData.glintPhase = Math.random() * Math.PI * 2;

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'bush';
    group.userData.points = 1;
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y + 0.4, position.z);

    return group;
  }

  /**
   * Create visual indicator for a game walnut (golden bonus)
   */
  private createGameWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Golden walnut geometry
    const geometry = new THREE.SphereGeometry(0.18, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Golden color
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    });
    const walnut = new THREE.Mesh(geometry, material);
    walnut.castShadow = true;
    walnut.position.y = 0.3; // Floating above ground
    group.add(walnut);

    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(walnut.position);
    group.add(glow);

    // Add sparkle particles
    const sparkleGeometry = new THREE.SphereGeometry(0.03, 4, 4);
    const sparkleMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8
    });

    for (let i = 0; i < 6; i++) {
      const sparkle = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
      const angle = (i / 6) * Math.PI * 2;
      sparkle.position.set(
        Math.cos(angle) * 0.3,
        walnut.position.y,
        Math.sin(angle) * 0.3
      );
      group.add(sparkle);
    }

    // Add invisible collision sphere for easier clicking
    const collisionGeometry = new THREE.SphereGeometry(0.6, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0.3;
    group.add(collisionMesh);

    // Store references for animation
    group.userData.walnut = walnut;
    group.userData.glow = glow;
    group.userData.animationPhase = Math.random() * Math.PI * 2;

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'game';
    group.userData.points = 5; // Bonus multiplier
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y + 0.3, position.z);

    return group;
  }

  /**
   * Animate walnuts (glints, pulses, particles)
   */
  private animateWalnuts(delta: number): void {
    for (const [_id, walnutGroup] of this.walnuts) {
      const type = walnutGroup.userData.type;

      if (type === 'bush') {
        // Animate glint effect
        const glint = walnutGroup.userData.glint as THREE.Mesh;
        if (glint) {
          walnutGroup.userData.glintPhase += delta * 2;
          const opacity = 0.2 + Math.sin(walnutGroup.userData.glintPhase) * 0.2;
          (glint.material as THREE.MeshBasicMaterial).opacity = Math.max(0, opacity);
        }
      } else if (type === 'game') {
        // Animate golden walnut (rotation + pulse)
        const walnut = walnutGroup.userData.walnut as THREE.Mesh;
        const glow = walnutGroup.userData.glow as THREE.Mesh;

        if (walnut) {
          walnutGroup.userData.animationPhase += delta;
          walnut.rotation.y += delta * 2; // Rotate

          // Pulse effect
          const pulse = 1 + Math.sin(walnutGroup.userData.animationPhase * 2) * 0.1;
          walnut.scale.set(pulse, pulse, pulse);

          // Glow pulse
          if (glow) {
            const glowPulse = 0.3 + Math.sin(walnutGroup.userData.animationPhase * 3) * 0.15;
            (glow.material as THREE.MeshBasicMaterial).opacity = glowPulse;
          }
        }
      }
    }
  }

  /**
   * MVP 3: Initialize minimap
   */
  private initMinimap(): void {
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (this.minimapCanvas) {
      this.minimapContext = this.minimapCanvas.getContext('2d');
      console.log('✅ Minimap initialized');
    } else {
      console.warn('⚠️ Minimap canvas not found');
    }
  }

  /**
   * MVP 3: Update minimap display
   */
  private updateMinimap(): void {
    if (!this.minimapContext || !this.minimapCanvas || !this.character) return;

    const ctx = this.minimapContext;
    const size = this.MINIMAP_SIZE;

    // Clear minimap
    ctx.clearRect(0, 0, size, size);

    // Draw background
    ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
    ctx.fillRect(0, 0, size, size);

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Draw grid lines (optional - shows 4x4 grid for easier navigation)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridDivisions = 4;
    for (let i = 1; i < gridDivisions; i++) {
      const pos = (i / gridDivisions) * size;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // Helper function to convert world coords to minimap coords
    const worldToMinimap = (worldX: number, worldZ: number) => {
      const playerPos = this.character!.position;
      // Relative to player position
      const relX = worldX - playerPos.x;
      const relZ = worldZ - playerPos.z;

      // Scale to minimap
      const scale = size / this.MINIMAP_WORLD_SIZE;
      const minimapX = (relX * scale) + size / 2;
      const minimapY = (relZ * scale) + size / 2;

      return { x: minimapX, y: minimapY };
    };

    // Draw landmarks
    for (const [landmarkId, landmarkPos] of this.landmarks) {
      const pos = worldToMinimap(landmarkPos.x, landmarkPos.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        // Get landmark color based on name
        let color = '#ffffff';
        if (landmarkId.includes('North')) color = '#0000ff';
        else if (landmarkId.includes('South')) color = '#00ff00';
        else if (landmarkId.includes('East')) color = '#ffff00';
        else if (landmarkId.includes('West')) color = '#ff00ff';

        ctx.fillStyle = color;
        ctx.fillRect(pos.x - 3, pos.y - 3, 6, 6);
      }
    }

    // Draw origin landmark (red tower at 0,0)
    const originPos = worldToMinimap(0, 0);
    if (originPos.x >= 0 && originPos.x <= size && originPos.y >= 0 && originPos.y <= size) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(originPos.x - 4, originPos.y - 4, 8, 8);
    }

    // Draw remote players
    for (const [_playerId, remotePlayer] of this.remotePlayers) {
      const pos = worldToMinimap(remotePlayer.position.x, remotePlayer.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        ctx.fillStyle = '#aaaaaa';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw local player (always at center)
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Draw player direction indicator
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    // Character starts at Math.PI (facing backward), adjust for minimap (top is north/+Z)
    const angle = this.character.rotation.y;
    // On minimap: top is +Z, so we use sin for X and cos for Y (reversed from before)
    ctx.lineTo(
      size / 2 + Math.sin(angle) * 10,
      size / 2 + Math.cos(angle) * 10
    );
    ctx.stroke();
  }

  /**
   * MVP 3: Update proximity indicators (cursor changes, glow effects)
   */
  private updateProximityIndicators(): void {
    if (!this.character) return;

    const playerPos = this.character.position;
    let closestWalnut: { id: string; distance: number; group: THREE.Group } | null = null;
    let minDistance = Infinity;

    // Find closest walnut
    for (const [walnutId, walnutGroup] of this.walnuts) {
      const distance = playerPos.distanceTo(walnutGroup.position);
      if (distance < minDistance) {
        minDistance = distance;
        closestWalnut = { id: walnutId, distance, group: walnutGroup };
      }
    }

    // Update cursor based on proximity
    if (closestWalnut && closestWalnut.distance <= this.PROXIMITY_CURSOR_DISTANCE) {
      // Change cursor to pointer when close to walnut
      document.body.style.cursor = 'pointer';

      // Add proximity glow if very close
      if (closestWalnut.distance <= this.PROXIMITY_GLOW_DISTANCE) {
        this.addProximityGlow(closestWalnut.group);
      } else {
        this.removeProximityGlow(closestWalnut.group);
      }
    } else {
      // Reset cursor when far from walnuts
      document.body.style.cursor = 'default';

      // Remove all proximity glows
      for (const walnutGroup of this.walnuts.values()) {
        this.removeProximityGlow(walnutGroup);
      }
    }
  }

  /**
   * Add a proximity glow effect to a walnut
   */
  private addProximityGlow(walnutGroup: THREE.Group): void {
    // Check if glow already exists
    if (walnutGroup.userData.proximityGlow) return;

    // Create a subtle glow sphere
    const glowGeometry = new THREE.SphereGeometry(0.6, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.position.copy(walnutGroup.userData.clickPosition || walnutGroup.position);

    // Add to group
    walnutGroup.add(glowMesh);
    walnutGroup.userData.proximityGlow = glowMesh;
  }

  /**
   * Remove proximity glow effect from a walnut
   */
  private removeProximityGlow(walnutGroup: THREE.Group): void {
    const glow = walnutGroup.userData.proximityGlow;
    if (glow) {
      walnutGroup.remove(glow);
      glow.geometry.dispose();
      (glow.material as THREE.Material).dispose();
      walnutGroup.userData.proximityGlow = null;
    }
  }

  /**
   * MVP 3: Hide a walnut at the player's current position
   * Context-based: near bush = hide in bush, else = bury in ground
   */
  private hideWalnut(): void {
    if (!this.character) return;

    // Check if player has walnuts to hide
    if (this.playerWalnutCount <= 0) {
      console.log('🚫 No walnuts to hide!');
      return;
    }

    // Get player position
    const playerPos = this.character.position.clone();
    const terrainY = getTerrainHeight(playerPos.x, playerPos.z);

    const walnutId = `player-${this.playerId}-${Date.now()}`;
    const BUSH_PROXIMITY_THRESHOLD = 2; // Units - player must be very close to bush to hide in it

    let walnutGroup: THREE.Group;
    let labelText: string;
    let labelColor: string;

    // CONTEXT-BASED HIDING: Check if player is near a bush
    let nearestBush: THREE.Vector3 | null = null;
    let minDistance = Infinity;

    if (bushPositions.length > 0) {
      for (const bushPos of bushPositions) {
        const distance = playerPos.distanceTo(bushPos);
        if (distance < minDistance) {
          minDistance = distance;
          nearestBush = bushPos;
        }
      }
    }

    // Decide: bush or buried based on proximity
    if (nearestBush && minDistance <= BUSH_PROXIMITY_THRESHOLD) {
      // HIDE IN BUSH - player is close enough to a bush
      const position = nearestBush.clone();
      position.y = getTerrainHeight(position.x, position.z);
      walnutGroup = this.createBushWalnutVisual(position);
      labelText = 'Your Bush Walnut (1 pt)';
      labelColor = '#90EE90';
      console.log(`🌿 Hidden in bush at (${position.x.toFixed(1)}, ${position.z.toFixed(1)}), distance: ${minDistance.toFixed(1)} units`);
    } else {
      // BURY IN GROUND - no bush nearby
      const position = new THREE.Vector3(playerPos.x, terrainY, playerPos.z);
      walnutGroup = this.createBuriedWalnutVisual(position);
      labelText = 'Your Buried Walnut (3 pts)';
      labelColor = '#8B4513';
      console.log(`🌰 Buried at player position (${position.x.toFixed(1)}, ${position.z.toFixed(1)}), nearest bush: ${minDistance.toFixed(1)} units away`);
    }

    // Add to scene and registry
    walnutGroup.userData.ownerId = this.playerId;
    walnutGroup.userData.id = walnutId;
    this.scene.add(walnutGroup);
    this.walnuts.set(walnutId, walnutGroup);

    // Add label for player-hidden walnut
    const label = this.createLabel(labelText, labelColor);
    this.walnutLabels.set(walnutId, label);

    // Decrement player walnut count
    this.playerWalnutCount--;
    console.log(`✅ Walnut hidden! Remaining: ${this.playerWalnutCount}`);

    // MULTIPLAYER: Send to server for sync
    this.sendMessage({
      type: 'walnut_hidden',
      walnutId: walnutId,
      ownerId: this.playerId,
      walnutType: walnutGroup.userData.type,
      position: {
        x: walnutGroup.position.x,
        y: walnutGroup.position.y,
        z: walnutGroup.position.z
      },
      points: walnutGroup.userData.points,
      timestamp: Date.now()
    });
  }

  /**
   * MVP 3: Remove a walnut from the world (when found)
   */
  private removeWalnut(walnutId: string): void {
    const walnutGroup = this.walnuts.get(walnutId);
    if (!walnutGroup) return;

    // Clean up geometry and materials
    walnutGroup.traverse((child: any) => {
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

    // Remove label if it exists
    const label = this.walnutLabels.get(walnutId);
    if (label && this.labelsContainer) {
      this.labelsContainer.removeChild(label);
      this.walnutLabels.delete(walnutId);
    }

    this.scene.remove(walnutGroup);
    this.walnuts.delete(walnutId);
    console.log('🗑️ Removed walnut:', walnutId);
  }

  /**
   * MVP 3: Handle mouse click for walnut finding
   */
  private onMouseClick(event: MouseEvent): void {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update raycaster with camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Check for intersections with walnuts
    const walnutObjects: THREE.Object3D[] = [];
    for (const walnutGroup of this.walnuts.values()) {
      walnutObjects.push(walnutGroup);
    }

    // Raycast against all walnut groups and their children
    const intersects = this.raycaster.intersectObjects(walnutObjects, true);

    if (intersects.length > 0) {
      // Find the walnut group that was clicked
      let clickedWalnut: THREE.Group | null = null;
      let walnutId: string | null = null;

      for (const intersect of intersects) {
        // Traverse up to find the walnut group
        let obj = intersect.object;
        while (obj.parent) {
          if (obj.parent.userData.id && obj.parent.userData.type) {
            clickedWalnut = obj.parent as THREE.Group;
            walnutId = obj.parent.userData.id;
            break;
          }
          obj = obj.parent;
        }
        if (clickedWalnut) break;
      }

      if (clickedWalnut && walnutId) {
        this.findWalnut(walnutId, clickedWalnut);
      }
    }
  }

  /**
   * MVP 3: Find a walnut (player clicked on it)
   * Game mechanics:
   * - Finding YOUR OWN walnut: No points, just get walnut back (prevents farming)
   * - Finding OTHERS' walnuts: Get points + walnut to rehide (core loop)
   */
  private findWalnut(walnutId: string, walnutGroup: THREE.Group): void {
    if (!this.character) return;

    // Use clickPosition if available, otherwise use group position
    const walnutPos = walnutGroup.userData.clickPosition || walnutGroup.position;
    const playerPos = this.character.position;

    // Check if player is close enough
    const distance = playerPos.distanceTo(walnutPos);
    const maxDistance = walnutGroup.userData.type === 'buried' ? 4 : 5;

    console.log(`🔍 Click detected: type=${walnutGroup.userData.type}, distance=${distance.toFixed(1)}, max=${maxDistance}`);

    if (distance > maxDistance) {
      console.log(`🚫 Too far away! Distance: ${distance.toFixed(1)}, need to be within ${maxDistance}`);
      return;
    }

    const points = walnutGroup.userData.points || 1;
    const isOwnWalnut = walnutGroup.userData.ownerId === this.playerId;

    if (isOwnWalnut) {
      // FOUND YOUR OWN WALNUT - No points (prevents farming), just get walnut back
      this.playerWalnutCount++;
      console.log(`🔄 Picked up your own walnut! No points awarded. Walnuts: ${this.playerWalnutCount}`);
    } else {
      // FOUND SOMEONE ELSE'S WALNUT - Award points AND give walnut to rehide
      this.playerScore += points;
      this.playerWalnutCount++;
      console.log(`🎉 Found another player's walnut! +${points} points (Score: ${this.playerScore}), +1 walnut (${this.playerWalnutCount} total)`);
    }

    // Remove the walnut from the world
    this.removeWalnut(walnutId);

    // MULTIPLAYER: Send to server for sync
    this.sendMessage({
      type: 'walnut_found',
      walnutId: walnutId,
      finderId: this.playerId,
      points: points,
      timestamp: Date.now()
    });
  }

  /**
   * MULTIPLAYER: Create a walnut from network data (when another player hides one)
   */
  private createRemoteWalnut(data: {
    walnutId: string;
    ownerId: string;
    walnutType: string;
    position: { x: number; y: number; z: number };
    points: number;
  }): void {
    // Don't create if already exists
    if (this.walnuts.has(data.walnutId)) {
      console.log(`⚠️ Walnut ${data.walnutId} already exists, skipping`);
      return;
    }

    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    let walnutGroup: THREE.Group;
    let labelText: string;
    let labelColor: string;

    // Create appropriate visual based on type
    switch (data.walnutType) {
      case 'buried':
        walnutGroup = this.createBuriedWalnutVisual(position);
        labelText = data.ownerId === this.playerId ? 'Your Buried Walnut (3 pts)' : `Buried Walnut (3 pts)`;
        labelColor = '#8B4513';
        break;

      case 'bush':
        walnutGroup = this.createBushWalnutVisual(position);
        labelText = data.ownerId === this.playerId ? 'Your Bush Walnut (1 pt)' : `Bush Walnut (1 pt)`;
        labelColor = '#90EE90';
        break;

      case 'game':
        walnutGroup = this.createGameWalnutVisual(position);
        labelText = '🌟 Bonus Walnut (5 pts)';
        labelColor = '#FFD700';
        break;

      default:
        console.warn(`⚠️ Unknown walnut type: ${data.walnutType}`);
        return;
    }

    // Add to scene and registry
    walnutGroup.userData.id = data.walnutId;
    walnutGroup.userData.ownerId = data.ownerId;
    this.scene.add(walnutGroup);
    this.walnuts.set(data.walnutId, walnutGroup);

    // Add label
    const label = this.createLabel(labelText, labelColor);
    this.walnutLabels.set(data.walnutId, label);

    console.log(`🌰 Created remote walnut: ${data.walnutId} (type: ${data.walnutType}, owner: ${data.ownerId})`);
  }

  // MVP 3: Tutorial system methods

  /**
   * Initialize the tutorial system
   */
  private initTutorial(): void {
    // Set up the next button event listener
    const nextButton = document.getElementById('tutorial-next');
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        this.nextTutorialStep();
      });
    }

    // Set up the close button event listener
    const closeButton = document.getElementById('tutorial-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.closeTutorial();
      });
    }

    // Show the tutorial after a short delay (allow game to fully load)
    setTimeout(() => {
      if (!this.tutorialShown) {
        this.showTutorial();
      }
    }, 1000);
  }

  /**
   * Show the tutorial overlay
   */
  private showTutorial(): void {
    this.tutorialShown = true;
    this.currentTutorialStep = 0;
    this.displayTutorialMessage();
  }

  /**
   * Display the current tutorial message
   */
  private displayTutorialMessage(): void {
    const overlay = document.getElementById('tutorial-overlay');
    const messageEl = document.getElementById('tutorial-message');
    const nextButton = document.getElementById('tutorial-next') as HTMLButtonElement;

    if (!overlay || !messageEl || !nextButton) return;

    // Show overlay
    overlay.classList.remove('hidden');

    // Update message
    messageEl.textContent = this.tutorialMessages[this.currentTutorialStep];

    // Update button text
    if (this.currentTutorialStep === this.tutorialMessages.length - 1) {
      nextButton.textContent = 'Start Playing!';
    } else {
      nextButton.textContent = 'Next';
    }
  }

  /**
   * Go to the next tutorial step
   */
  private nextTutorialStep(): void {
    this.currentTutorialStep++;

    if (this.currentTutorialStep >= this.tutorialMessages.length) {
      // Tutorial complete - hide overlay
      this.closeTutorial();
    } else {
      // Show next message
      this.displayTutorialMessage();
    }
  }

  /**
   * Close the tutorial (can be called anytime to skip)
   */
  private closeTutorial(): void {
    console.log('🎓 Closing tutorial...');
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      console.log('✅ Tutorial overlay found, adding hidden class');
      overlay.classList.add('hidden');
      console.log('Tutorial overlay classes:', overlay.classList.toString());
    } else {
      console.error('❌ Tutorial overlay not found!');
    }
  }

  // MVP 4: Leaderboard system methods

  /**
   * Initialize the leaderboard system
   */
  private initLeaderboard(): void {
    const toggleButton = document.getElementById('leaderboard-toggle');
    const leaderboardDiv = document.getElementById('leaderboard');

    if (toggleButton && leaderboardDiv) {
      // Show toggle button when game starts
      toggleButton.classList.remove('hidden');

      // Toggle leaderboard visibility
      toggleButton.addEventListener('click', () => {
        this.leaderboardVisible = !this.leaderboardVisible;
        if (this.leaderboardVisible) {
          leaderboardDiv.classList.remove('hidden');
          this.updateLeaderboard(); // Update immediately when shown
        } else {
          leaderboardDiv.classList.add('hidden');
        }
      });

      // Start periodic leaderboard updates (every 5 seconds)
      this.leaderboardUpdateInterval = window.setInterval(() => {
        if (this.leaderboardVisible) {
          this.updateLeaderboard();
        }
      }, 5000);

      // Initial update
      this.updateLeaderboard();

      console.log('✅ Leaderboard initialized');
    } else {
      console.warn('⚠️ Leaderboard elements not found');
    }
  }

  /**
   * Update the leaderboard display
   */
  private async updateLeaderboard(): Promise<void> {
    try {
      // For now, use mock data since server doesn't have leaderboard yet
      // TODO: Fetch from server endpoint
      const leaderboardData = this.getMockLeaderboardData();

      const leaderboardList = document.getElementById('leaderboard-list');
      if (!leaderboardList) return;

      // Clear existing entries
      leaderboardList.innerHTML = '';

      // Add entries (top 10)
      leaderboardData.slice(0, 10).forEach((entry, index) => {
        const li = document.createElement('li');

        // Highlight current player
        if (entry.playerId === this.playerId) {
          li.classList.add('current-player');
        }

        // Create entry HTML
        li.innerHTML = `
          <span class="leaderboard-rank">#${index + 1}</span>
          <span class="leaderboard-name">${entry.displayName}</span>
          <span class="leaderboard-score">${entry.score}</span>
        `;

        leaderboardList.appendChild(li);
      });
    } catch (error) {
      console.error('❌ Failed to update leaderboard:', error);
    }
  }

  /**
   * Get mock leaderboard data (temporary until server implements leaderboard)
   */
  private getMockLeaderboardData(): Array<{ playerId: string; displayName: string; score: number }> {
    // Create mock data including current player
    const mockData = [
      { playerId: this.playerId, displayName: 'You', score: this.playerScore }
    ];

    // Add some mock players for testing
    for (let i = 0; i < 9; i++) {
      mockData.push({
        playerId: `player_${i}`,
        displayName: `Player ${i + 1}`,
        score: Math.floor(Math.random() * 50)
      });
    }

    // Sort by score descending
    return mockData.sort((a, b) => b.score - a.score);
  }

  /**
   * Initialize quick chat and emote systems
   */
  private initChatAndEmotes(): void {
    console.log('🎮 Initializing Quick Chat and Emotes...');

    const quickChatDiv = document.getElementById('quick-chat');
    const emotesDiv = document.getElementById('emotes');

    console.log('🔍 Quick chat div:', quickChatDiv);
    console.log('🔍 Emotes div:', emotesDiv);

    // Show UI elements
    if (quickChatDiv) {
      quickChatDiv.classList.remove('hidden');
      console.log('✅ Quick chat UI shown');
    } else {
      console.error('❌ Quick chat div not found!');
    }

    if (emotesDiv) {
      emotesDiv.classList.remove('hidden');
      console.log('✅ Emotes UI shown');
    } else {
      console.error('❌ Emotes div not found!');
    }

    // Setup quick chat buttons
    const chatButtons = document.querySelectorAll('.chat-button');
    console.log(`🔍 Found ${chatButtons.length} chat buttons`);
    chatButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        console.log(`🖱️ Chat button ${index} clicked!`);
        const message = (button as HTMLElement).getAttribute('data-message');
        console.log('📝 Message:', message);
        if (message) {
          this.sendChatMessage(message);
        }
      });
    });

    // Setup emote buttons
    const emoteButtons = document.querySelectorAll('.emote-button');
    console.log(`🔍 Found ${emoteButtons.length} emote buttons`);
    emoteButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        console.log(`🖱️ Emote button ${index} clicked!`);
        const emote = (button as HTMLElement).getAttribute('data-emote');
        console.log('😀 Emote:', emote);
        if (emote) {
          this.sendEmote(emote);
        }
      });
    });

    console.log('✅ Quick chat and emotes initialized');
  }

  /**
   * Send a chat message (broadcasts to all players)
   */
  private sendChatMessage(message: string): void {
    console.log('💬 sendChatMessage called with:', message);
    console.log('🔌 Connection status - isConnected:', this.isConnected, 'websocket:', this.websocket);
    console.log('🆔 Player ID:', this.playerId);
    console.log('🎮 Character:', this.character);

    if (!this.isConnected || !this.websocket) {
      console.warn('⚠️ Not connected - cannot send chat message');
      console.warn('⚠️ You need to connect to the server first!');
      return;
    }

    // Display locally above own character
    console.log('📍 Showing chat above character...');
    this.showChatAboveCharacter(this.playerId, message, true);

    // Send to server to broadcast to all other players
    console.log('📡 Sending to server...');
    this.sendMessage({
      type: 'chat_message',
      message: message,
      playerId: this.playerId
    });

    console.log('💬 Chat message sent:', message);
  }

  /**
   * Send an emote (triggers character animation, broadcasts to all players)
   */
  private sendEmote(emote: string): void {
    console.log('👋 sendEmote called with:', emote);
    console.log('🔌 Connection status - isConnected:', this.isConnected, 'websocket:', this.websocket);

    if (!this.isConnected || !this.websocket) {
      console.warn('⚠️ Not connected - cannot send emote');
      console.warn('⚠️ You need to connect to the server first!');
      return;
    }

    // Prevent emote spam
    if (this.emoteInProgress) {
      console.log('⏸️ Emote in progress, please wait...');
      return;
    }

    // Play emote animation locally
    console.log('🎭 Playing emote animation...');
    this.playEmoteAnimation(emote);

    // Send to server to broadcast to all other players
    console.log('📡 Sending emote to server...');
    this.sendMessage({
      type: 'player_emote',
      emote: emote,
      playerId: this.playerId
    });

    console.log('👋 Emote sent:', emote);
  }

  /**
   * Show chat message above a character (floating text label)
   */
  private showChatAboveCharacter(playerId: string, message: string, isLocalPlayer: boolean = false): void {
    console.log(`💬 showChatAboveCharacter - playerId: ${playerId}, message: ${message}, isLocal: ${isLocalPlayer}`);

    // Get character position
    const character = isLocalPlayer ? this.character : this.remotePlayers.get(playerId);
    if (!character) {
      console.warn(`⚠️ Character not found for player ${playerId}`);
      return;
    }

    console.log(`✅ Character found at position:`, character.position);

    // Remove existing chat label if present
    const existingLabel = this.playerChatLabels.get(playerId);
    if (existingLabel && this.labelsContainer) {
      this.labelsContainer.removeChild(existingLabel);
      this.playerChatLabels.delete(playerId);
    }

    // Create new chat label (don't use landmark-label class due to transform conflict)
    const label = document.createElement('div');
    label.textContent = message;
    label.style.position = 'absolute';
    label.style.color = isLocalPlayer ? '#4CAF50' : '#FFF'; // Green for own messages
    label.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    label.style.padding = '8px 14px';
    label.style.borderRadius = '8px';
    label.style.fontSize = '15px';
    label.style.fontWeight = 'bold';
    label.style.maxWidth = '250px';
    label.style.wordWrap = 'break-word';
    label.style.fontFamily = 'Arial, sans-serif';
    label.style.pointerEvents = 'none';
    label.style.whiteSpace = 'nowrap';
    label.style.transform = 'translate(-50%, -120%)'; // Center and position above character
    label.style.zIndex = '2000'; // Above everything else
    label.style.boxShadow = '0 2px 8px rgba(0,0,0,0.4)';

    if (this.labelsContainer) {
      this.labelsContainer.appendChild(label);
      console.log('✅ Label added to DOM');
    } else {
      console.error('❌ Labels container not found!');
    }

    this.playerChatLabels.set(playerId, label);

    // IMPORTANT: Position the label immediately in screen space
    const labelPos = character.position.clone();
    labelPos.y += 0.5; // Position just above character's head (0.5 units, not 2.5!)
    this.updateLabelPosition(label, labelPos);
    console.log('✅ Label positioned at:', labelPos);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const label = this.playerChatLabels.get(playerId);
      if (label && this.labelsContainer) {
        this.labelsContainer.removeChild(label);
        this.playerChatLabels.delete(playerId);
        console.log(`🗑️ Chat label removed for ${playerId}`);
      }
    }, 5000);
  }

  /**
   * Play an emote animation on local character
   */
  private playEmoteAnimation(emote: string): void {
    console.log(`🎭 playEmoteAnimation called - emote: ${emote}`);
    console.log(`🎮 Character:`, this.character);
    console.log(`⏸️ Emote in progress:`, this.emoteInProgress);

    if (!this.character || this.emoteInProgress) {
      console.warn('⚠️ Cannot play emote - no character or emote in progress');
      return;
    }

    this.emoteInProgress = true;

    // Map emotes to animations (using existing animations)
    const emoteAnimationMap: { [key: string]: string } = {
      'wave': 'walk',      // Walk animation for wave (visible movement)
      'point': 'walk',     // Walk animation for point (visible movement)
      'celebrate': 'jump', // Jump is perfect for celebrate!
      'shrug': 'idle'      // Idle for shrug
    };

    const animationName = emoteAnimationMap[emote] || 'idle';
    console.log(`🎬 Playing animation: ${animationName}`);

    // Play emote animation
    this.setAction(animationName);

    // Return to previous animation after 2 seconds
    setTimeout(() => {
      // Only return if player hasn't moved (still idle)
      if (!this.keys.has('w') && !this.keys.has('a') && !this.keys.has('s') && !this.keys.has('d')) {
        this.setAction('idle');
      }
      this.emoteInProgress = false;
      console.log('✅ Emote animation complete');
    }, 2000);

    console.log(`✨ Playing emote animation: ${emote} (${animationName})`);
  }

  /**
   * Play emote animation on remote player
   */
  private playRemoteEmoteAnimation(playerId: string, emote: string): void {
    console.log(`🎭 playRemoteEmoteAnimation - playerId: ${playerId}, emote: ${emote}`);

    const remoteCharacter = this.remotePlayers.get(playerId);
    const remoteActions = this.remotePlayerActions.get(playerId);

    console.log(`👤 Remote character:`, remoteCharacter);
    console.log(`🎬 Remote actions:`, remoteActions);

    if (!remoteCharacter || !remoteActions) {
      console.warn(`⚠️ Cannot play remote emote - character or actions not found for ${playerId}`);
      return;
    }

    // Map emotes to animations
    const emoteAnimationMap: { [key: string]: string } = {
      'wave': 'walk',      // Use walk as placeholder (visible movement)
      'point': 'walk',     // Use walk as placeholder
      'celebrate': 'jump', // Jump is perfect for celebrate!
      'shrug': 'idle'      // Idle for shrug
    };

    const animationName = emoteAnimationMap[emote] || 'idle';
    const newAction = remoteActions[animationName];

    console.log(`🎬 Animation to play: ${animationName}`);
    console.log(`🎭 Action:`, newAction);

    if (!newAction) {
      console.warn(`⚠️ Animation ${animationName} not found for remote player`);
      return;
    }

    // Stop all current animations first
    Object.values(remoteActions).forEach(action => {
      if (action.isRunning()) {
        action.fadeOut(0.1);
      }
    });

    // Play emote animation forcefully
    newAction.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.1).play();

    // Return to idle after animation completes (2 seconds)
    setTimeout(() => {
      newAction.fadeOut(0.2);
      const idleAction = remoteActions['idle'];
      if (idleAction) {
        idleAction.reset().fadeIn(0.2).play();
      }
    }, 2000);

    console.log(`✨ Remote player ${playerId} emote: ${emote} (${animationName}) playing!`);
  }
}