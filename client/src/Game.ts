import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrain } from './terrain.js';
import { createForestFromServer, bushPositions } from './forest.js';
import { getTerrainHeight } from './terrain.js';
import { AudioManager } from './AudioManager.js';
import { VFXManager } from './VFXManager.js';
import { ProjectileManager } from './ProjectileManager.js'; // MVP 8: Projectile system
import { ToastManager } from './ToastManager.js';
import { SettingsManager } from './SettingsManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { TouchControls } from './TouchControls.js';

interface Character {
  id: string;
  name: string;
  modelPath: string;
  animations: { [key: string]: string };
  scale: number;
  category: string;
  description?: string;
  emoteAnimations?: { [emoteId: string]: string }; // Maps emote IDs to animation names
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
  // @ts-ignore - MVP 5: Mouse sensitivity multiplier (0.25-2.0) - ready for future mouse controls
  private mouseSensitivity = 1.0;
  // Note: gravity removed - no longer needed without jump

  // INDUSTRY STANDARD: Asset caching system
  private static gltfLoader = new GLTFLoader(); // Singleton loader
  private static assetCache = new Map<string, THREE.Group>();
  private static animationCache = new Map<string, THREE.AnimationClip>();
  // Note: isJumping removed - jump feature disabled in favor of throwing
  private isEatingWalnut = false; // MVP 8: Block movement during eat animation
  private isStunned = false; // MVP 8: Block movement when hit by walnut
  private characters: Character[] = [];
  public selectedCharacterId = 'squirrel';
  public sessionToken: string = ''; // MVP 6: Player session token
  public username: string = ''; // MVP 6: Player username
  public turnstileToken: string | null = null; // MVP 7.1: Cloudflare Turnstile bot protection token
  private characterGroundOffset = 0; // Offset from character pivot to feet
  private characterCollisionRadius = 0.5; // Collision radius calculated from bounding box

  // MVP 6: Spawn coordination - prevent character updates until spawn position received from server
  // This fixes race condition where render loop starts before world_state arrives
  private spawnPositionReceived: boolean = false;
  private pendingSpawnPosition: { x: number; y: number; z: number } | null = null;
  private pendingSpawnRotationY: number | null = null;

  // STANDARD: Terrain and raycasting for ground detection
  private terrain: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();

  // MVP 5.9: World boundaries (soft push-back system)
  private readonly WORLD_RADIUS = 200; // Terrain is 400x400 (-200 to 200 on X and Z)
  private readonly BOUNDARY_PUSH_ZONE = 10; // Start pushing 10 units from edge
  private readonly BOUNDARY_PUSH_STRENGTH = 8; // Push force (units per second)
  private boundaryWarningElement: HTMLElement | null = null;
  private boundaryVignetteElement: HTMLElement | null = null;

  // Multiplayer properties
  private websocket: WebSocket | null = null;
  private playerId: string = '';
  private remotePlayers: Map<string, THREE.Group> = new Map();
  private connectionStatusElement: HTMLElement | null = null;

  // Entity interpolation with velocity-based extrapolation - industry standard for smooth multiplayer
  private remotePlayerBuffers: Map<string, Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; velocity?: THREE.Vector3; timestamp: number }>> = new Map();
  private INTERPOLATION_DELAY = 150; // 150ms - Render 1.5x behind server updates (100ms) for smooth interpolation
  private MAX_BUFFER_SIZE = 10; // Larger buffer for smoother interpolation (10 updates = 1 second history)
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

  // MVP 5: Enhanced character animations (Squirrel-first)
  private lastIdleVariationTime: number = 0;

  // MVP 6: Remote player username labels (Map playerId → HTML label element)
  private remotePlayerNameLabels: Map<string, HTMLElement> = new Map();

  // MVP 7: NPC System - AI characters rendered on client
  private npcs: Map<string, THREE.Group> = new Map();
  private npcMixers: Map<string, THREE.AnimationMixer> = new Map();
  private npcActions: Map<string, { [key: string]: THREE.AnimationAction }> = new Map();
  private npcCurrentAnimations: Map<string, string> = new Map(); // Track current animation to prevent unnecessary resets
  private npcNameLabels: Map<string, HTMLElement> = new Map();
  private npcInterpolationBuffers: Map<string, Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; timestamp: number }>> = new Map();
  private npcPendingUpdates: Map<string, Array<{ position: any; rotationY: number; animation?: string; velocity?: any; behavior?: string; timestamp: number }>> = new Map();

  private idleVariationInterval: number = 10000; // 10 seconds between idle variations
  private availableIdleAnimations: string[] = ['idle', 'idle_b', 'idle_c'];
  private isPlayingOneShotAnimation: boolean = false;

  // MVP 5: Footstep particle effects
  private lastFootstepTime: number = 0;
  private footstepInterval: number = 500; // 500ms between footsteps (more subtle)

  // MVP 5.5: Camera shake on collision (standard game feel technique)
  private cameraShakeIntensity: number = 0;
  private cameraShakeDuration: number = 0;
  private cameraShakeTime: number = 0;
  private cameraBaseOffset: THREE.Vector3 = new THREE.Vector3();

  // INDUSTRY STANDARD: Manual delta time calculation to avoid Clock.getDelta() issues
  private lastFrameTime: number = 0;
  private MAX_DELTA_TIME = 1/30; // Cap at 30fps to prevent spiral of death

  // MVP 5: Performance tracking for debug overlay
  private fps: number = 60;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private networkLatency: number = 0;
  private lastPingSent: number = 0;

  // MVP 8: Entity collision tracking (for spin animation on bump)
  private lastEntityCollisionTime: number = 0;

  // MVP 3: Walnut system properties
  private walnuts: Map<string, THREE.Group> = new Map(); // All walnuts in world
  private bushGlows: Map<string, THREE.Mesh> = new Map(); // MVP 8: Glow indicators for bush walnuts
  // Note: playerWalnutCount removed in MVP 8 - using unified walnutInventory instead
  private playerScore: number = 0; // Player's current score
  private displayedScore: number = 0; // MVP 5: Animated score for tweening effect
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

  // MVP 3: Minimap - Static north-up design for better landmark navigation
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapContext: CanvasRenderingContext2D | null = null;
  private MINIMAP_WORLD_SIZE = 200; // Show 200x200 world units (covers all landmarks at ±80)
  private MINIMAP_SIZE = 200; // Canvas size in pixels

  // MVP 3: Tutorial system
  private tutorialMessages: string[] = [
    "Welcome to Hidden Walnuts! 🌰",
    "Movement: Press W to move forward, A/D to rotate left/right, S to move backward.",
    "You start with 3 walnuts to hide around the forest.",
    "Press H to hide a walnut. Hide near a bush (1 pt) or bury in ground (3 pts).",
    "Press SPACEBAR (or T) to throw walnuts at other players! Pick up more walnuts to restock.",
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
  private emoteInProgress: boolean = false; // Prevent emote spam (local player)
  private remotePlayerEmotes: Map<string, boolean> = new Map(); // Track which remote players are emoting

  // MVP 5: Audio system (passed from main to reuse loaded sounds)
  private audioManager!: AudioManager;

  // MVP 5: Visual effects system
  private vfxManager: VFXManager | null = null;

  // MVP 8: Projectile system (flying walnuts)
  private projectileManager: ProjectileManager | null = null;
  private walnutInventory: number = 0; // Player's walnut count (0-10) - unified for throw/eat/hide
  private lastThrowTime: number = 0; // For throw cooldown tracking
  private readonly THROW_COOLDOWN = 1500; // 1.5 seconds in milliseconds
  // Note: MAX_INVENTORY enforced server-side (10 walnuts)

  // MVP 8 FIX: Shared walnut model for visual consistency
  private walnutModel: THREE.Group | null = null;
  private readonly WALNUT_SIZE = 0.06; // Unified walnut radius for all types

  // MVP 5: Toast notification system
  private toastManager: ToastManager = new ToastManager();

  // MVP 5.5: Collision detection system
  private collisionSystem: CollisionSystem | null = null;

  // MVP 5.7: Touch controls for mobile
  private touchControls: TouchControls | null = null;
  private wasTouchActive: boolean = false; // Track if touch was active last frame


  async init(canvas: HTMLCanvasElement, audioManager: AudioManager, settingsManager: SettingsManager) {
    try {
      // MVP 5: Set audio manager (reuse from main.ts with preloaded sounds)
      this.audioManager = audioManager;

      // MVP 5: Apply initial mouse sensitivity from settings
      this.mouseSensitivity = settingsManager.getMouseSensitivity();

      // Listen for settings changes
      window.addEventListener('settingsChanged', ((e: CustomEvent) => {
        this.mouseSensitivity = e.detail.mouseSensitivity;
      }) as EventListener);

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x87ceeb);

      // Camera
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.set(0, 10, 10); // Set initial camera position

      // Renderer
      // MVP 5.7: Detect mobile and optimize renderer settings
      const isMobile = TouchControls.isMobile();
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile, // Disable antialiasing on mobile for performance
        powerPreference: isMobile ? 'low-power' : 'high-performance'
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2)); // Lower pixel ratio on mobile
      this.renderer.shadowMap.enabled = !isMobile; // Disable shadows on mobile for performance

      // Lights
      const ambient = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambient);

      const directional = new THREE.DirectionalLight(0xffffff, 0.8);
      directional.position.set(50, 100, 50);

      // MVP 5.7: Only enable shadows on desktop
      if (!isMobile) {
        directional.castShadow = true;
        directional.shadow.mapSize.width = 2048;
        directional.shadow.mapSize.height = 2048;
        directional.shadow.camera.near = 0.5;
        directional.shadow.camera.far = 500;
        directional.shadow.camera.left = -100;
        directional.shadow.camera.right = 100;
        directional.shadow.camera.top = 100;
        directional.shadow.camera.bottom = -100;
      }
      this.scene.add(directional);

      // Terrain
      this.terrain = await createTerrain();
      this.scene.add(this.terrain);

      // Forest will be created from server data when we receive world_state

      // Load characters config with error handling
      try {
        const response = await fetch('/characters.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch characters.json: ${response.status}`);
        }
        this.characters = await response.json();
      } catch (error) {
        console.error('Error loading characters.json:', error);
        // INDUSTRY STANDARD: Fallback matches characters.json structure exactly
        this.characters = [{
          id: 'squirrel',
          name: 'Squirrel',
          modelPath: '/assets/models/characters/Squirrel_LOD0.glb',
          animations: {
            "idle": "/assets/models/characters/Animations/Single/Squirrel_Idle_A.glb",
            "walk": "/assets/models/characters/Animations/Single/Squirrel_Walk.glb",
            "run": "/assets/models/characters/Animations/Single/Squirrel_Run.glb",
            "jump": "/assets/models/characters/Animations/Single/Squirrel_Jump.glb"
          },
          scale: 0.3,
          category: 'mammal',
          description: 'Agile forest dweller'
        }];
      }

      // INDUSTRY STANDARD: Add basic sanity check before character loading
      this.addSanityCheckCube();

      // Load selected character
      await this.loadCharacter();

      // MVP 3: Initialize labels container
      this.labelsContainer = document.getElementById('labels-container');

      // MVP 5.5: Initialize Collision System BEFORE adding landmarks (so they can register collision)
      this.collisionSystem = new CollisionSystem(this.scene);

      // Add landmark trees (now collision system is ready)
      await this.addLandmarks();

      // MVP 5: Initialize VFX Manager
      this.vfxManager = new VFXManager(this.scene, this.camera);

      // MVP 8: Initialize Projectile Manager
      this.projectileManager = new ProjectileManager(this.scene, this.vfxManager, this.audioManager);

      // MVP 8 FIX: Load shared walnut model for visual consistency
      await this.loadWalnutModel();

      // MVP 3: Initialize minimap
      this.initMinimap();

      // MVP 5: Initialize connection status indicator
      this.initConnectionStatus();

      // MVP 3: Initialize tutorial system
      this.initTutorial();

      // MVP 4: Initialize leaderboard
      this.initLeaderboard();

      // MVP 4: Initialize quick chat and emotes
      this.initChatAndEmotes();

      // MVP 5: Initialize settings menu
      this.initSettingsMenu();

      // Setup multiplayer connection (walnuts will be loaded from server)
      await this.setupMultiplayer();

      // Events
      this.setupEvents();

      // Start debug overlay updates
      this.startDebugUpdates();

      window.addEventListener('resize', this.onResize.bind(this));
    } catch (error) {
      console.error('❌ Error during initialization:', error);
      // Show error to user
      if (this.toastManager) {
        this.toastManager.error('Failed to initialize game. Please refresh.');
      }
    }
  }


  private async loadCharacter() {
    const char = this.characters.find(c => c.id === this.selectedCharacterId);
    if (!char) {
      console.error('❌ Character config not found:', this.selectedCharacterId);
      return;
    }

    try {
      // INDUSTRY STANDARD: Use cached assets with progress tracking
      const characterModel = await this.loadCachedAsset(char.modelPath);
      if (!characterModel) {
        console.error('❌ Failed to load character model');
        return;
      }

      this.character = characterModel;
      this.character.scale.set(char.scale, char.scale, char.scale);
      this.character.position.set(0, 0, 0);
      this.character.rotation.y = Math.PI;
      this.character.castShadow = true;
      this.scene.add(this.character);

      // MVP 5.5: Add local player collision
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          this.playerId,
          this.character.position,
          0.5 // Character collision radius
        );
      }

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

      const results = await Promise.all(animationPromises);

      // MVP 8: Log loaded animations for debugging
      const loadedAnims = results.filter(r => r.success).map(r => r.name);
      const failedAnims = results.filter(r => !r.success).map(r => r.name);
      console.log(`✅ Loaded animations for local player: ${loadedAnims.join(', ')}`);
      if (failedAnims.length > 0) {
        console.warn(`⚠️ Failed to load animations: ${failedAnims.join(', ')}`);
      }

      // Validate at least idle animation loaded
      if (!this.actions.idle) {
        console.error('❌ CRITICAL: Idle animation failed to load - character will not function properly');
      }

      // Use model's actual bounding box for accurate ground positioning and collision
      // INDUSTRY STANDARD: Update transforms before calculating bounds
      this.character.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.character);
      const size = box.getSize(new THREE.Vector3());

      // INDUSTRY STANDARD: Ground offset = distance from pivot to feet (no margin needed)
      // Formula: position.y = groundY - box.min.y places feet exactly on ground
      this.characterGroundOffset = -box.min.y;

      // Calculate collision radius based on character size (use XZ plane for horizontal radius)
      this.characterCollisionRadius = Math.max(size.x, size.z) * 0.5;


      this.setAction('idle');
      // MVP 6: DON'T position character here - wait for spawn position from server
      // Character stays at (0, 0, 0) until world_state message arrives with spawn position
      // this.character.position.y = this.positionLocalPlayerOnGround(); // REMOVED - causes race condition

      // MVP 6: Check if spawn position arrived before character finished loading
      if (this.pendingSpawnPosition) {
        this.character.position.set(
          this.pendingSpawnPosition.x,
          this.pendingSpawnPosition.y,
          this.pendingSpawnPosition.z
        );
        if (this.pendingSpawnRotationY !== null) {
          this.character.rotation.y = this.pendingSpawnRotationY;
        }
        this.pendingSpawnPosition = null;
        this.pendingSpawnRotationY = null;
        this.spawnPositionReceived = true;
      }
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

  /**
   * MVP 5: Play a one-shot animation (like eating, spinning) that returns to idle when finished
   * @param name Animation name to play
   * @param returnToIdleDelay Optional delay before returning to idle (default: auto-detect from animation duration)
   */
  private playOneShotAnimation(name: string, returnToIdleDelay?: number): void {
    const newAction = this.actions[name];
    if (!newAction) {
      console.warn(`Animation "${name}" not found, cannot play one-shot animation`);
      return;
    }

    // Mark that we're playing a one-shot animation (prevents idle variation from interrupting)
    this.isPlayingOneShotAnimation = true;

    // Stop current animation
    if (this.currentAction) {
      this.currentAction.stop();
    }

    // Configure animation to play once and stop
    newAction.reset();
    newAction.setLoop(THREE.LoopOnce, 1);
    newAction.clampWhenFinished = true;
    newAction.play();

    this.currentAction = newAction;
    this.currentAnimationName = name;

    // Calculate when to return to idle
    const duration = returnToIdleDelay ?? newAction.getClip().duration * 1000; // Convert to ms

    // Return to idle after animation completes
    setTimeout(() => {
      this.isPlayingOneShotAnimation = false;
      // Only return to idle if we're still playing this animation (prevent race conditions)
      if (this.currentAnimationName === name) {
        this.setAction('idle');
      }
    }, duration);
  }

  private setRemotePlayerAction(playerId: string, animationName: string, animationStartTime?: number) {
    // Don't override animation if remote player is emoting
    if (this.remotePlayerEmotes.get(playerId)) {
      return;
    }

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
      // MVP 5.8: Normalize arrow keys to WASD for accessibility
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';

      this.keys.add(key);

      // MVP 8: Throw with spacebar (more important than jump)
      if (e.key === ' ') {
        this.throwWalnut();
      }

      // MVP 3: Hide walnut with H key
      if (e.key === 'h' || e.key === 'H') {
        this.hideWalnut();
      }

      // MVP 8: Throw walnut with T key (alternative to spacebar)
      if (e.key === 't' || e.key === 'T') {
        this.throwWalnut();
      }

      // Debug overlay toggle with F key
      if (e.key === 'f' || e.key === 'F') {
        const debugOverlay = document.getElementById('debug-overlay');
        if (debugOverlay) {
          debugOverlay.classList.toggle('hidden');
        }
        // MVP 5.5: Also toggle collision debug visualization
        if (this.collisionSystem) {
          this.collisionSystem.toggleDebug();
        }
      }

      // MVP 5: Mute toggle with M key
      if (e.key === 'm' || e.key === 'M') {
        this.audioManager.toggleMute();
      }

      // Debug: Teleport to nearest golden walnut with G key
      if (e.key === 'g' || e.key === 'G') {
        this.teleportToNearestGoldenWalnut();
      }

      // Debug scene contents with I key (Info)
      if (e.key === 'i' || e.key === 'I') {
        // Scene debug info available via debug overlay
      }
    });

    document.addEventListener('keyup', (e) => {
      // MVP 5.8: Normalize arrow keys to WASD for accessibility
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';

      this.keys.delete(key);
    });

    // MVP 3: Mouse click for walnut finding
    window.addEventListener('click', (event) => {
      this.onMouseClick(event);
    });

    // MVP 5: Mouse hover for cursor highlighting
    window.addEventListener('mousemove', (event) => {
      this.onMouseMove(event);
    });

    // MVP 8: Projectile hit detection events
    window.addEventListener('projectile-hit', ((e: CustomEvent) => {
      this.onProjectileHit(e.detail);
    }) as EventListener);

    // MVP 8: Projectile miss events (create pickupable walnut on ground)
    window.addEventListener('projectile-miss', ((e: CustomEvent) => {
      this.onProjectileMiss(e.detail);
    }) as EventListener);

    // MVP 8: Projectile near-miss events (play fear animation)
    window.addEventListener('projectile-near-miss', ((e: CustomEvent) => {
      this.onProjectileNearMiss(e.detail);
    }) as EventListener);

    // MVP 5.7: Touch controls for mobile
    this.touchControls = new TouchControls(this.renderer.domElement);

    // Set up tap callback for finding walnuts
    this.touchControls.onTap((x: number, y: number) => {
      // Convert touch coordinates to mouse event for finding walnuts
      const mouseEvent = new MouseEvent('click', {
        clientX: x,
        clientY: y,
        bubbles: true
      });
      this.onMouseClick(mouseEvent);
    });

    // MVP 5.7 IMPROVED: Remove double-tap gesture, use on-screen button instead
    // (Double-tap is not discoverable, on-screen button is clear and visible)
    // this.touchControls.onDoubleTap(() => {
    //   this.hideWalnut();
    // });

    // Set up camera rotation callback
    this.touchControls.onCameraRotate((deltaX: number, _deltaY: number) => {
      // Rotate character based on horizontal drag
      if (this.character) {
        this.character.rotation.y -= deltaX * 0.01;
      }
    });

    // MVP 5.7: Initialize mobile action buttons (Hide, future: Throw)
    this.initMobileActionButtons();
  }

  /**
   * MVP 5.7: Initialize mobile action buttons for hiding/throwing walnuts
   * Replaces double-tap gesture with visible, discoverable on-screen buttons
   * Note: Visibility is controlled by CSS media queries, not JavaScript
   */
  private initMobileActionButtons(): void {
    // Hide button
    const hideButton = document.getElementById('mobile-hide-btn');
    if (hideButton) {
      hideButton.addEventListener('click', () => {
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        this.hideWalnut();
      });

      // Pulse animation on first load (tutorial hint)
      const hasSeenHideButton = localStorage.getItem('hideButtonSeen');
      if (!hasSeenHideButton) {
        hideButton.classList.add('pulse');
        // Remove pulse after 10 seconds or first click
        setTimeout(() => {
          hideButton.classList.remove('pulse');
          localStorage.setItem('hideButtonSeen', 'true');
        }, 10000);
        hideButton.addEventListener('click', () => {
          hideButton.classList.remove('pulse');
          localStorage.setItem('hideButtonSeen', 'true');
        }, { once: true });
      }
    }

    // MVP 8: Wire up throw button for mobile
    const throwButton = document.getElementById('mobile-throw-btn');
    if (throwButton) {
      throwButton.addEventListener('click', () => {
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        this.throwWalnut();
      });
    }

  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    // MVP 5: Start ambient forest sounds
    this.audioManager.playAmbient();
    this.animate();
  }

  // Cleanup method for proper resource management
  public destroy(): void {
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

    // MVP 5: Cleanup audio and VFX
    this.audioManager.dispose();

    // MVP 5.7: Cleanup touch controls
    if (this.touchControls) {
      this.touchControls.destroy();
      this.touchControls = null;
    }
    if (this.vfxManager) {
      this.vfxManager.dispose();
    }

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

    // MVP 5: Calculate FPS for debug overlay (update every second)
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1.0) {
      this.fps = this.frameCount / (currentTime - this.lastFpsUpdate);
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    // Update player physics
    // MVP 6: Only update player AND camera after spawn position received (prevents race condition)
    // Don't update camera before spawn position arrives - prevents upside-down flash when character teleports
    if (this.character && this.spawnPositionReceived) {
      this.updatePlayer(delta);
      this.updateCamera();
      // MVP 5.5: Update camera shake effect
      this.updateCameraShake(delta);
    }
    // If character exists but spawn position not received yet, do nothing - let camera stay at initial position

    // Update animations
    if (this.mixer) {
      this.mixer.update(delta);
    }

    for (const mixer of this.remotePlayerMixers.values()) {
      mixer.update(delta);
    }

    // MVP 7: Update NPC animations
    for (const mixer of this.npcMixers.values()) {
      mixer.update(delta);
    }

    // Update remote player interpolation
    this.updateRemotePlayerInterpolation(delta);

    // MVP 7: Update NPC interpolation
    this.updateNPCInterpolation(delta);

    // MVP 8: Update projectiles (flying walnuts)
    if (this.projectileManager) {
      // Build entity map for hit detection
      const entities = new Map<string, { position: THREE.Vector3, isInvulnerable?: boolean }>();

      // Add local player
      if (this.character) {
        entities.set(this.playerId, { position: this.character.position.clone() });
      }

      // Add remote players
      this.remotePlayers.forEach((player, id) => {
        entities.set(id, { position: player.position.clone() });
      });

      // Add NPCs
      this.npcs.forEach((npc, id) => {
        entities.set(id, { position: npc.position.clone() });
      });

      this.projectileManager.update(delta, entities);
    }

    // MVP 3: Animate walnuts
    this.animateWalnuts(delta);

    // MVP 8: Check proximity pickup for walnuts (walk over to collect)
    this.checkProximityWalnutPickup();

    // MVP 5: Animate score counter with tweening
    if (this.displayedScore !== this.playerScore) {
      const diff = this.playerScore - this.displayedScore;
      // Smooth lerp toward target score (faster for larger differences)
      const tweenSpeed = Math.max(Math.abs(diff) * 5, 2); // Min speed of 2/sec
      this.displayedScore += Math.sign(diff) * Math.min(Math.abs(diff), tweenSpeed * delta);

      // Snap to target if very close
      if (Math.abs(this.playerScore - this.displayedScore) < 0.1) {
        this.displayedScore = this.playerScore;
      }
    }

    // MVP 3: Update walnut labels
    this.updateWalnutLabels();

    // MVP 6: Update remote player username labels
    this.updateRemotePlayerNameLabels();

    // MVP 7: Update NPC name labels
    this.updateNPCNameLabels();

    // MVP 3: Update proximity indicators
    this.updateProximityIndicators();

    // MVP 3: Update minimap
    this.updateMinimap();

    // MVP 5: Update VFX and apply screen shake
    if (this.vfxManager) {
      this.vfxManager.update(delta);

      // Apply screen shake to camera
      const shakeOffset = this.vfxManager.updateScreenShake();
      const originalCameraPos = this.camera.position.clone();
      this.camera.position.add(shakeOffset);

      this.renderer.render(this.scene, this.camera);

      // Restore camera position after render
      this.camera.position.copy(originalCameraPos);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updatePlayer(delta: number) {
    // STANDARD: Validate character exists before movement
    if (!this.character) return;

    // MVP 5.7: Sync touch controls input to keys (drag-to-move for mobile)
    // CRITICAL FIX: Clear keys when touch stops to prevent infinite movement
    if (this.touchControls) {
      const touchInput = this.touchControls.getMovementInput();
      const isTouchActive = touchInput.magnitude > 0;

      if (isTouchActive) {
        // Touch is active - set keys based on touch input
        this.wasTouchActive = true;

        if (touchInput.forward) {
          this.keys.add('w');
        } else {
          this.keys.delete('w');
        }

        if (touchInput.backward) {
          this.keys.add('s');
        } else {
          this.keys.delete('s');
        }

        if (touchInput.left) {
          this.keys.add('a');
        } else {
          this.keys.delete('a');
        }

        if (touchInput.right) {
          this.keys.add('d');
        } else {
          this.keys.delete('d');
        }
      } else if (this.wasTouchActive) {
        // Touch just stopped - clear all movement keys to stop character
        this.keys.delete('w');
        this.keys.delete('a');
        this.keys.delete('s');
        this.keys.delete('d');
        this.wasTouchActive = false;
      }
      // When touch was never active, leave keyboard keys alone
    }

    // INDUSTRY STANDARD: Calculate desired velocity based on input
    const desiredVelocity = new THREE.Vector3(0, 0, 0);
    let moving = false;
    let rotating = false;

    // MVP 8: Block all movement input during eat animation or when stunned from hit
    if (!this.isEatingWalnut && !this.isStunned) {
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

    // MVP 8: No jump/gravity - characters always grounded
    // (Jump feature removed in favor of throwing mechanics)

    // MVP 5.5: Apply horizontal movement with collision detection
    const movementDelta = this.velocity.clone().setY(0).multiplyScalar(delta);
    const currentPosition = this.character.position.clone();
    const desiredPosition = currentPosition.clone().add(movementDelta);

    // Check collision and get adjusted position (slides around obstacles)
    const collisionResult = this.collisionSystem
      ? this.collisionSystem.checkCollision(this.playerId, currentPosition, desiredPosition)
      : { position: desiredPosition, collided: false };

    // MVP 5.5: Trigger camera shake on collision
    if (collisionResult.collided && moving) {
      this.triggerCameraShake(0.03, 0.15);
    }

    this.character.position.copy(collisionResult.position);

    // MVP 8: Check collision with other players/NPCs (spin animation on bump)
    this.checkEntityCollisions(moving);

    // MVP 5.9: Apply soft boundary push-back (prevent falling off world edge)
    this.applyBoundaryPushBack(delta);

    // Update actual velocity (units per second) for accurate network transmission
    this.actualVelocity.x = this.velocity.x;
    this.actualVelocity.y = this.velocity.y;
    this.actualVelocity.z = this.velocity.z;

    // STANDARD: Use raycasting for precise ground detection (prevents sinking)
    this.snapToGround();

    // MVP 5.5: Update player collision position
    if (this.collisionSystem) {
      this.collisionSystem.updateColliderPosition(this.playerId, this.character.position);
    }

    // Calculate horizontal speed once (reused for footsteps and animations)
    const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
    const currentTime = performance.now();

    // MVP 5: Spawn footstep dust particles when moving on ground (subtle)
    if (horizontalSpeed > 1.0 && this.vfxManager) {
      if (currentTime - this.lastFootstepTime >= this.footstepInterval) {
        // Spawn subtle dust particles at character's feet
        const footPosition = this.character.position.clone();
        footPosition.y = getTerrainHeight(footPosition.x, footPosition.z) + 0.05;
        this.vfxManager.spawnParticles('dust', footPosition, 3); // Very subtle (3 particles)
        this.lastFootstepTime = currentTime;
      }
    }

    // INDUSTRY STANDARD: Animation state machine with hysteresis
    const animationTime = currentTime / 1000; // Convert to seconds for animation timing

    // Determine what animation should be playing
    let animation = 'idle';
    if (horizontalSpeed > 0.5) { // Increased threshold to prevent oscillation at low speeds
      const isRunning = this.keys.has('shift');
      animation = isRunning ? 'run' : 'walk';
    }

    // Only change animation if different AND enough time has passed (hysteresis)
    // AND if no emote is playing AND if not playing a one-shot animation
    if (!this.emoteInProgress &&
        !this.isPlayingOneShotAnimation &&
        animation !== this.currentAnimationName &&
        (animationTime - this.lastAnimationChangeTime) >= this.animationChangeDelay) {
      this.setAction(animation);
      this.lastAnimationChangeTime = animationTime;
    }

    // MVP 5: Idle variation system (Squirrel-first feature)
    // Randomly cycle between idle animations when character is standing still
    if (animation === 'idle' &&
        this.currentAnimationName === 'idle' &&
        !this.emoteInProgress &&
        !this.isPlayingOneShotAnimation) {
      const timeSinceLastVariation = performance.now() - this.lastIdleVariationTime;
      if (timeSinceLastVariation >= this.idleVariationInterval) {
        // Filter idle animations that exist in the current character
        const availableIdles = this.availableIdleAnimations.filter(anim => this.actions[anim]);
        if (availableIdles.length > 0) {
          // Pick a random idle animation (including the current one for variety)
          const randomIdle = availableIdles[Math.floor(Math.random() * availableIdles.length)];
          if (randomIdle !== 'idle' && this.actions[randomIdle]) {
            // Play the idle variation as a one-shot that returns to 'idle'
            this.playOneShotAnimation(randomIdle);
            this.lastIdleVariationTime = performance.now();
          }
        }
      }
    }
  }

  /**
   * MVP 8: Check collision with other players/NPCs
   * Triggers spin animation on bump
   */
  private checkEntityCollisions(isMoving: boolean): void {
    if (!this.character || !isMoving) return;

    const COLLISION_RADIUS = 1.0; // Distance to trigger collision
    const COLLISION_COOLDOWN = 2000; // 2 seconds between collisions
    const now = Date.now();

    // Skip if on cooldown
    if (now - this.lastEntityCollisionTime < COLLISION_COOLDOWN) {
      return;
    }

    const playerPos = this.character.position;

    // Check collision with remote players
    for (const [remoteId, remotePlayer] of this.remotePlayers) {
      const distance = playerPos.distanceTo(remotePlayer.position);
      if (distance < COLLISION_RADIUS) {
        console.log(`💥 Bumped into player ${remoteId}!`);
        this.triggerBumpEffect();
        this.lastEntityCollisionTime = now;
        return; // Only one collision per update
      }
    }

    // Check collision with NPCs
    for (const [npcId, npc] of this.npcs) {
      const distance = playerPos.distanceTo(npc.position);
      if (distance < COLLISION_RADIUS) {
        console.log(`💥 Bumped into NPC ${npcId}!`);
        this.triggerBumpEffect();
        this.lastEntityCollisionTime = now;
        return; // Only one collision per update
      }
    }
  }

  /**
   * MVP 8: Trigger visual/audio feedback when bumping into another entity
   * Plays spin animation and camera shake
   */
  private triggerBumpEffect(): void {
    // Play spin animation if available
    if (this.actions && this.actions['spin']) {
      const spinAction = this.actions['spin'];
      spinAction.reset().setLoop(THREE.LoopOnce, 1).play();
      spinAction.clampWhenFinished = true;
    }

    // Camera shake
    this.triggerCameraShake(0.08, 0.3);

    // Particle effect (dust cloud on impact)
    if (this.vfxManager && this.character) {
      this.vfxManager.spawnParticles('dirt', this.character.position, 15);
    }

    // TODO: Add health loss in next MVP section (user requested to save for later)
  }

  /**
   * MVP 8: Trigger intense visual effects when hit by projectile
   * Screen shake, blur effect, particles
   */
  private triggerHitEffects(): void {
    // INTENSE camera shake (much stronger than bump)
    this.triggerCameraShake(0.2, 0.5);

    // Screen flash effect (blur/dizzy)
    this.vfxManager?.screenShake(0.3, 0.8); // Stronger screen shake through VFX manager

    // Particle burst (stars/sparkles for "dazed" effect)
    if (this.vfxManager && this.character) {
      this.vfxManager.spawnParticles('sparkle', this.character.position, 40);
      // Add confetti for silly cartoon effect
      this.vfxManager.spawnParticles('confetti', this.character.position, 30);
    }

    // Toast notification
    this.toastManager.warning('OUCH!');
  }

  // STANDARD: Snap local player to ground using heightmap
  private snapToGround() {
    if (!this.character) return;

    // Use heightmap for fast local player ground positioning
    this.character.position.y = this.positionLocalPlayerOnGround();
  }

  private updateCamera() {
    // INDUSTRY STANDARD: Validate character exists before camera update
    if (!this.character) {
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

    // MVP 5.5: Fix collision bug - Update collision system with actual player ID
    // (Collision was registered with empty string '' before playerId was set)
    if (this.collisionSystem && this.character) {
      this.collisionSystem.removeCollider('');  // Remove old collider with empty ID
      this.collisionSystem.addPlayerCollider(this.playerId, this.character.position, this.characterCollisionRadius);
    }

    // Attempt connection with retry logic
    await this.connectWebSocket();
  }

  private async connectWebSocket(): Promise<void> {
    if (this.connectionAttempts >= this.maxConnectionAttempts) {
      console.warn('⚠️ Max connection attempts reached. Multiplayer disabled.');
      return;
    }

    this.connectionAttempts++;

    // Get WebSocket URL - check environment or use default
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:50569';
    // MVP 7.1: Include Turnstile token for bot protection (optional parameter - null if not verified)
    const turnstileParam = this.turnstileToken ? `&turnstileToken=${this.turnstileToken}` : '';
    // MVP 6: Include sessionToken and username in WebSocket URL
    const wsUrl = apiUrl.replace('http:', 'ws:').replace('https:', 'wss:') +
                  `/ws?squirrelId=${this.playerId}&characterId=${this.selectedCharacterId}&sessionToken=${this.sessionToken}&username=${encodeURIComponent(this.username)}${turnstileParam}`;
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
          this.websocket.close();
        }
      }, 5000);

      this.websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        this.isConnected = true;
        this.connectionAttempts = 0; // Reset on successful connection

        // MVP 5: Update connection status
        this.updateConnectionStatus('connected');

        // MVP 5: Show connection toast
        this.toastManager.success('Connected to server');

        // Start position updates and heartbeat
        this.startPositionUpdates();
        this.startHeartbeat();

        // MVP 6: Safety fallback - if spawn position never arrives within 5 seconds, enable movement anyway
        setTimeout(() => {
          if (!this.spawnPositionReceived) {
            this.spawnPositionReceived = true;
          }
        }, 5000);
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

        // MVP 5: Show error toast
        this.toastManager.error('Connection error occurred');
      };
      
      this.websocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isConnected = false;

        this.stopIntervals();

        // Attempt reconnection if not intentional close
        if (event.code !== 1000 && this.connectionAttempts < this.maxConnectionAttempts) {
          // MVP 5: Update connection status to reconnecting
          this.updateConnectionStatus('reconnecting');

          // MVP 5: Show reconnection toast
          this.toastManager.warning('Connection lost, reconnecting...');

          setTimeout(() => this.connectWebSocket(), 2000);
        } else {
          // MVP 5: Update connection status to disconnected
          this.updateConnectionStatus('disconnected');

          // MVP 5: Show disconnection toast
          this.toastManager.error('Disconnected from server');
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      // Retry connection
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        // MVP 5: Update connection status to reconnecting
        this.updateConnectionStatus('reconnecting');
        setTimeout(() => this.connectWebSocket(), 2000);
      } else {
        // MVP 5: Update connection status to disconnected
        this.updateConnectionStatus('disconnected');
      }
    }
  }

  private startPositionUpdates(): void {
    this.positionSendInterval = window.setInterval(() => {
      this.sendPositionUpdate();
    }, 100); // 10 updates per second - optimized for Cloudflare free tier
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      // MVP 5.8: Send heartbeat for session management
      this.lastPingSent = performance.now();
      this.sendMessage({ type: 'heartbeat', timestamp: this.lastPingSent });
    }, 30000); // Heartbeat every 30 seconds - optimized for Cloudflare free tier
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
      // BUT: Don't send animation updates if emote is in progress (emote has its own broadcast)
      const messageData: any = {
        type: 'player_update',
        position: {
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
          z: Math.round(pos.z * 100) / 100
        },
        rotationY: Math.round(rot * 100) / 100,
        velocity: this.calculateActualVelocity(),
        timestamp: performance.now()
      };

      // Only include animation if no emote is playing (prevents emote override)
      if (!this.emoteInProgress) {
        messageData.animation = this.currentAnimationName;
        messageData.animationStartTime = this.animationStartTime;
      }

      this.sendMessage(messageData);

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
        // Create forest from server data (only once)
        if (!this.forestCreated && Array.isArray(data.forestObjects)) {
          // MVP 5.5: Pass collision system to add tree collisions
          await createForestFromServer(this.scene, data.forestObjects, this.collisionSystem || undefined);
          this.forestCreated = true;
        }

        // Load existing walnuts from server
        if (Array.isArray(data.mapState)) {
          for (const walnut of data.mapState) {
            // MVP 8: Check isGolden flag (true = golden, false/undefined = regular)
            const isGoldenWalnut = walnut.isGolden === true;
            const isGameWalnut = walnut.origin === 'game';

            // ALWAYS create game walnuts (they respawn), only check found status for player walnuts
            if (isGameWalnut || !walnut.found) {
              // Convert server Walnut format to client format
              // Golden walnuts (isGolden=true) render as golden bonus, others use hiddenIn type
              const walnutType = isGoldenWalnut ? 'game' : walnut.hiddenIn;

              // CRITICAL FIX: Skip walnuts with undefined type (corrupted/old data)
              if (!walnutType) {
                console.warn(`⚠️ Skipping walnut ${walnut.id} with undefined type (hiddenIn=${walnut.hiddenIn}, origin=${walnut.origin})`);
                continue;
              }

              const points = isGoldenWalnut ? 5 : (walnut.hiddenIn === 'buried' ? 3 : 1);

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

        // MVP 6: Handle spawn position from server (for returning players)
        if (data.spawnPosition) {
          if (this.character) {
            // Character exists - apply spawn position immediately
            this.character.position.set(
              data.spawnPosition.x,
              data.spawnPosition.y,
              data.spawnPosition.z
            );
            if (typeof data.spawnRotationY === 'number') {
              this.character.rotation.y = data.spawnRotationY;
            }
            // MVP 6: Mark spawn position as received - now safe to update character in render loop
            this.spawnPositionReceived = true;
          } else {
            // Character not loaded yet - store spawn position for later
            this.pendingSpawnPosition = data.spawnPosition;
            this.pendingSpawnRotationY = data.spawnRotationY;
          }
        } else {
          // No spawn position provided - enable movement anyway (fallback)
          this.spawnPositionReceived = true;
        }
        break;

      case 'walnut_hidden':
        // Another player hid a walnut - create it locally
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
        if (data.walnutId && data.finderId !== this.playerId) {
          this.removeWalnut(data.walnutId);

          // MVP 8: Play 'eat' animation for remote player or NPC who found the walnut
          const remotePlayer = this.remotePlayers.get(data.finderId);
          if (remotePlayer && this.remotePlayerActions.has(data.finderId)) {
            const actions = this.remotePlayerActions.get(data.finderId);
            if (actions && actions['eat']) {
              // Play eat animation once
              actions['eat'].reset().setLoop(THREE.LoopOnce, 1).play();
              // Return to idle after animation completes
              actions['eat'].clampWhenFinished = true;
            }
          }

          // Check if finder is an NPC
          const npc = this.npcs.get(data.finderId);
          if (npc && this.npcActions.has(data.finderId)) {
            const actions = this.npcActions.get(data.finderId);
            if (actions && actions['eat']) {
              // Play eat animation once
              actions['eat'].reset().setLoop(THREE.LoopOnce, 1).play();
              // Return to idle after animation completes
              actions['eat'].clampWhenFinished = true;
            }
          }
        }
        break;

      case 'walnut_dropped':
        // MVP 8: A projectile hit/missed and created a pickupable walnut on ground
        this.createRemoteWalnut({
          walnutId: data.walnutId,
          ownerId: 'game', // No specific owner
          walnutType: 'ground', // New type for dropped walnuts
          position: data.position,
          points: 1 // Same as bush walnut
        });

        // MVP 8: Set immunity for specific player if hit (miss = no immunity)
        const droppedWalnut = this.walnuts.get(data.walnutId);
        if (droppedWalnut && data.immunePlayerId) {
          droppedWalnut.userData.immunePlayerId = data.immunePlayerId;
          droppedWalnut.userData.immuneUntil = data.immuneUntil;
        }
        break;

      case 'existing_players':
        if (Array.isArray(data.players)) {
          for (const player of data.players) {
            if (this.validatePlayerData(player) && player.squirrelId !== this.playerId) {
              // MVP 6: Pass username when creating remote player
              this.createRemotePlayer(player.squirrelId, player.position, player.rotationY, player.characterId, player.username);
            }
          }
        }
        break;

      case 'player_joined':
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          this.createRemotePlayer(data.squirrelId, data.position, data.rotationY, data.characterId, data.username);

          // MVP 6: Show player joined toast with format "username - Character"
          const characterName = data.characterId ? this.getCharacterName(data.characterId) : 'Player';
          const username = data.username || 'Anonymous';
          this.toastManager.info(`${username} - ${characterName} joined the game`);
        }
        break;

      case 'player_leave':  // Server sends "player_leave" not "player_left"
        if (data.squirrelId && data.squirrelId !== this.playerId) {
          this.removeRemotePlayer(data.squirrelId);

          // MVP 6: Show player left toast with format "username - Character"
          const characterName = data.characterId ? this.getCharacterName(data.characterId) : 'Player';
          const username = data.username || 'Anonymous';
          this.toastManager.info(`${username} - ${characterName} left the game`);
        }
        break;

      case 'player_disconnected':
        // MVP 5.8: Mark player as disconnected (visual feedback)
        if (data.squirrelId && data.squirrelId !== this.playerId) {
          // MVP 6: Pass username and characterId for proper toast message
          this.markPlayerAsDisconnected(data.squirrelId, data.username, data.characterId);
        }
        break;

      case 'player_reconnected':
        // MVP 5.8: Mark player as reconnected (restore visual)
        if (data.squirrelId && data.squirrelId !== this.playerId) {
          this.markPlayerAsReconnected(data.squirrelId);
        }
        break;

      case 'player_update':  // Server sends position updates as "player_update"
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          this.updateRemotePlayer(data.squirrelId, data.position, data.rotationY, data.animation, data.velocity, data.animationStartTime, data.moveType, data.characterId);
        }
        break;

      case 'heartbeat':
        // Heartbeat response - connection is alive
        break;

      case 'chat_message':
        // Received chat message from another player
        if (data.playerId && data.message && data.playerId !== this.playerId) {
          this.showChatAboveCharacter(data.playerId, data.message, false);
        }
        break;

      case 'player_emote':
        // Received emote from another player
        if (data.playerId && data.emote && data.playerId !== this.playerId) {
          this.playRemoteEmoteAnimation(data.playerId, data.emote);
        }
        break;

      case 'npc_spawned':
        // MVP 7: NPC spawned on server, create NPC entity on client
        console.log('📨 Received npc_spawned message:', data.npc);
        if (data.npc && data.npc.id) {
          console.log(`🤖 Creating NPC client-side: ${data.npc.id} (${data.npc.username})`);
          this.createNPC(data.npc.id, data.npc.position, data.npc.rotationY, data.npc.characterId, data.npc.username, data.npc.animation);
        } else {
          console.error('❌ Invalid npc_spawned data:', data);
        }
        break;

      case 'npc_update':
        // MVP 7: NPC position/animation update from server (legacy single update)
        if (data.npcId) {
          this.updateNPC(data.npcId, data.position, data.rotationY, data.animation, data.velocity, data.behavior);
        }
        break;

      case 'npc_updates_batch':
        // MVP 7.1: Batched NPC updates (all NPCs in single message for efficiency)
        if (data.npcs && Array.isArray(data.npcs)) {
          for (const npcData of data.npcs) {
            this.updateNPC(npcData.npcId, npcData.position, npcData.rotationY, npcData.animation, npcData.velocity, npcData.behavior);
          }
        }
        break;

      case 'npc_despawned':
        // MVP 7: NPC despawned on server, remove from client
        if (data.npcId) {
          this.removeNPC(data.npcId);
        }
        break;

      case 'npc_throw':
        // MVP 7: NPC threw walnut, spawn projectile animation
        if (data.npcId && data.fromPosition && data.toPosition) {
          this.handleNPCThrow(data.npcId, data.fromPosition, data.toPosition, data.targetId);
        }
        break;

      case 'pong':
        // MVP 5: Calculate network latency from ping/pong
        if (data.timestamp && this.lastPingSent > 0) {
          const now = performance.now();
          this.networkLatency = now - this.lastPingSent;
        }
        break;

      case 'inventory_update':
        // MVP 8: Update player walnut inventory count
        if (typeof data.walnutCount === 'number') {
          this.walnutInventory = data.walnutCount;
          console.log(`🌰 Inventory updated: ${this.walnutInventory} walnuts`);
          // Update all UI displays
          this.updateMobileThrowButton();
          this.updateMobileHideButton();
          this.updateWalnutHUD();
        }
        break;

      case 'throw_event':
        // MVP 8: Someone threw a walnut - spawn projectile
        if (data.throwerId && data.fromPosition && data.toPosition) {
          this.handleThrowEvent(data.throwerId, data.fromPosition, data.toPosition, data.targetId);
        }
        break;

      case 'throw_rejected':
        // MVP 8: Server rejected throw (cooldown or no ammo)
        if (data.reason === 'cooldown') {
          this.toastManager.warning('Throw on cooldown!');
        } else if (data.reason === 'no_ammo') {
          this.toastManager.warning('No walnuts to throw!');
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

  /**
   * MVP 6: Get character display name from character ID
   */
  private getCharacterName(characterId: string): string {
    const char = this.characters.find(c => c.id === characterId);
    return char ? char.name : characterId.charAt(0).toUpperCase() + characterId.slice(1);
  }

  private async createRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, characterId?: string, username?: string): Promise<void> {
    if (this.remotePlayers.has(playerId)) {
      // Player already exists, just update position
      this.updateRemotePlayer(playerId, position, rotationY, undefined, undefined, undefined);
      return;
    }

    try {
      // INDUSTRY STANDARD: Use cached assets for remote players
      // Use the remote player's character ID, or fall back to local player's character
      const remoteCharacterId = characterId || this.selectedCharacterId;

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

      // Calculate character bounding box for collision (in bind pose, before animations play)
      // INDUSTRY STANDARD: Update transforms before calculating bounds
      remoteCharacter.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(remoteCharacter);
      const size = box.getSize(new THREE.Vector3());

      // Calculate collision radius based on character size (use XZ plane for horizontal radius)
      const collisionRadius = Math.max(size.x, size.z) * 0.5;

      // INDUSTRY STANDARD: Ground offset = distance from pivot to feet (no margin)
      // Formula: position.y = groundY - box.min.y places feet exactly on ground
      const remoteGroundOffset = -box.min.y;

      // Store character metadata in userData
      remoteCharacter.userData.characterId = remoteCharacterId;
      remoteCharacter.userData.collisionRadius = collisionRadius;
      remoteCharacter.userData.size = size;
      remoteCharacter.userData.groundOffset = remoteGroundOffset;

      // STANDARD: Position character on ground using raycasting
      const groundY = this.positionRemotePlayerOnGround(remoteCharacter, position.x, position.z);
      remoteCharacter.position.set(position.x, groundY, position.z);
      const initialQuaternion = new THREE.Quaternion();
      initialQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      remoteCharacter.quaternion.copy(initialQuaternion);

      // Ensure visibility
      remoteCharacter.visible = true;
      remoteCharacter.traverse((child: any) => {
        child.visible = true;
        if (child.isMesh) {
          child.frustumCulled = true; // Enable frustum culling for performance
        }
      });

      // Store all character data
      this.remotePlayers.set(playerId, remoteCharacter);
      this.remotePlayerMixers.set(playerId, remoteMixer);
      this.remotePlayerActions.set(playerId, remoteActions);

      // INDUSTRY STANDARD: Initialize interpolation buffer for newly created player
      const initialState = {
        position: new THREE.Vector3(position.x, groundY, position.z),
        quaternion: initialQuaternion.clone(),
        velocity: new THREE.Vector3(0, 0, 0),
        timestamp: Date.now()
      };
      this.remotePlayerBuffers.set(playerId, [initialState]);

      // Start with idle animation - configure properly to match player animation behavior
      if (remoteActions['idle']) {
        const idleAction = remoteActions['idle'];
        idleAction.reset();
        idleAction.setLoop(THREE.LoopRepeat, Infinity);
        idleAction.clampWhenFinished = false;
        idleAction.play();
      }

      this.scene.add(remoteCharacter);

      // MVP 6: Create username label for remote player (styled to match NPCs but with solid color)
      if (username) {
        const usernameLabel = this.createLabel(username, '#FFFFFF'); // White text
        usernameLabel.style.backgroundColor = 'rgba(100, 100, 255, 0.9)'; // Blue background for players
        usernameLabel.style.padding = '4px 10px';
        usernameLabel.style.borderRadius = '12px';
        usernameLabel.style.fontSize = '13px';
        usernameLabel.style.fontWeight = 'bold';
        usernameLabel.style.whiteSpace = 'nowrap';
        usernameLabel.style.pointerEvents = 'none';
        usernameLabel.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        usernameLabel.style.position = 'absolute'; // Ensure absolute positioning
        usernameLabel.style.visibility = 'visible'; // Explicitly set visibility
        usernameLabel.style.display = 'block'; // Ensure display is block
        usernameLabel.style.zIndex = '1000'; // Ensure it's above other elements
        this.remotePlayerNameLabels.set(playerId, usernameLabel);
      }

      // MVP 5.5: Add remote player collision with proper radius
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          playerId,
          remoteCharacter.position,
          collisionRadius
        );
      }
    } catch (error) {
      console.error('❌ Failed to create remote player:', playerId, error);
    }
  }

  private updateRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; y: number; z: number }, animationStartTime?: number, _moveType?: string, _characterId?: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      // STANDARD: Calculate ground position using raycasting
      const groundY = this.positionRemotePlayerOnGround(remotePlayer, position.x, position.z);

      const newQuaternion = new THREE.Quaternion();
      newQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      const newState = {
        position: new THREE.Vector3(position.x, groundY, position.z),
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
      // MVP 6: Don't create players from player_update messages (no username)
      // Players should only be created from player_joined and existing_players
      console.warn(`⚠️ Received update for unknown player ${playerId}, ignoring (will be created on player_joined)`);
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

      // MVP 5.5: Update remote player collision position
      if (this.collisionSystem) {
        this.collisionSystem.updateColliderPosition(playerId, player.position);
      }
    }
  }

  /**
   * MVP 7: Buffered interpolation for NPCs (industry standard approach)
   * Based on Gabriel Gambetta's Entity Interpolation guide
   */
  private updateNPCInterpolation(_deltaTime: number): void {
    const currentTime = Date.now();
    const renderTime = currentTime - this.INTERPOLATION_DELAY;

    for (const [npcId, buffer] of this.npcInterpolationBuffers) {
      const npc = this.npcs.get(npcId);
      if (!npc || buffer.length < 1) continue;

      // Single state - smoothly move toward it (avoids cumulative lerp drift)
      if (buffer.length === 1) {
        const state = buffer[0];
        const distance = npc.position.distanceTo(state.position);

        // If close enough, snap to position
        if (distance < 0.01) {
          npc.position.copy(state.position);
          npc.quaternion.copy(state.quaternion);
        } else {
          // Smooth lerp with frame-rate independent factor
          const alpha = Math.min(1, _deltaTime * 10); // 10x per second
          npc.position.lerp(state.position, alpha);
          npc.quaternion.slerp(state.quaternion, alpha);
        }

        // Update NPC collision position
        if (this.collisionSystem) {
          this.collisionSystem.updateColliderPosition(npcId, npc.position);
        }
        continue;
      }

      // Find two states to interpolate between for the render time
      let fromState = buffer[0];
      let toState = buffer[1];

      // Find the bracket: fromState.timestamp <= renderTime < toState.timestamp
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i].timestamp <= renderTime && buffer[i + 1].timestamp >= renderTime) {
          fromState = buffer[i];
          toState = buffer[i + 1];
          break;
        }
      }

      // If renderTime is beyond latest state, use the last two states
      if (renderTime >= buffer[buffer.length - 1].timestamp) {
        fromState = buffer[buffer.length - 2];
        toState = buffer[buffer.length - 1];
      }

      // Calculate interpolation factor
      const timeDelta = toState.timestamp - fromState.timestamp;
      let t = 0;

      if (timeDelta > 0) {
        t = (renderTime - fromState.timestamp) / timeDelta;
        t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]
      }

      // Interpolate position and rotation
      npc.position.lerpVectors(fromState.position, toState.position, t);
      npc.quaternion.slerpQuaternions(fromState.quaternion, toState.quaternion, t);

      // Update NPC collision position
      if (this.collisionSystem) {
        this.collisionSystem.updateColliderPosition(npcId, npc.position);
      }
    }
  }

  /**
   * MVP 7: Update NPC name labels (position above NPC heads)
   */
  private updateNPCNameLabels(): void {
    for (const [npcId, label] of this.npcNameLabels) {
      const npc = this.npcs.get(npcId);
      if (npc) {
        // Position label above NPC's head (2.5 units up, same as players)
        const labelPos = npc.position.clone();
        labelPos.y += 2.5;
        this.updateLabelPosition(label, labelPos);
      }
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

      // MVP 5.5: Remove collision
      if (this.collisionSystem) {
        this.collisionSystem.removeCollider(playerId);
      }

      // MVP 6: Remove username label
      const nameLabel = this.remotePlayerNameLabels.get(playerId);
      if (nameLabel && this.labelsContainer) {
        this.labelsContainer.removeChild(nameLabel);
        this.remotePlayerNameLabels.delete(playerId);
      }
    }
  }

  /**
   * MVP 5.8: Mark a remote player as disconnected (visual feedback)
   * MVP 6: Add username and characterId parameters for proper toast message
   */
  private markPlayerAsDisconnected(playerId: string, username?: string, characterId?: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {

      // Set opacity to 33% for more obvious disconnect indicator
      remotePlayer.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => {
              mat.transparent = true;
              mat.opacity = 0.33;
            });
          } else {
            child.material.transparent = true;
            child.material.opacity = 0.33;
          }
        }
      });

      // MVP 6: Show disconnected toast with format "username - Character"
      const charId = characterId || remotePlayer.userData?.characterId || 'Player';
      const characterName = charId ? this.getCharacterName(charId) : 'Player';
      const displayUsername = username || 'Anonymous';
      this.toastManager.warning(`${displayUsername} - ${characterName} disconnected`);
    }
  }

  /**
   * MVP 5.8: Mark a remote player as reconnected (restore visual)
   */
  private markPlayerAsReconnected(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {

      // Restore opacity to 100%
      remotePlayer.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: any) => {
              mat.transparent = false;
              mat.opacity = 1.0;
              mat.needsUpdate = true; // Force shader recompilation
            });
          } else {
            child.material.transparent = false;
            child.material.opacity = 1.0;
            child.material.needsUpdate = true; // Force shader recompilation
          }
        }
      });

      // Show reconnected toast
      const characterId = remotePlayer.userData?.characterId || 'Player';
      const characterName = characterId.charAt(0).toUpperCase() + characterId.slice(1);
      this.toastManager.success(`${characterName} reconnected`);
    }
  }

  /**
   * MVP 7: Create NPC entity on client (server-spawned AI character)
   * MVP 8: Fixed race condition that caused ghost NPCs
   */
  private async createNPC(npcId: string, position: { x: number; y: number; z: number }, rotationY: number, characterId: string, username: string, animation: string): Promise<void> {
    if (this.npcs.has(npcId)) {
      // NPC already exists, just update position
      this.updateNPC(npcId, position, rotationY, animation, undefined, undefined);
      return;
    }

    // MVP 8: Check if NPC is currently being created (prevent race condition ghost NPCs)
    const loadingKey = `loading_${npcId}`;
    if ((this as any)[loadingKey]) {
      console.log(`⏳ NPC ${npcId} is already being created, ignoring duplicate spawn`);
      return;
    }

    // Mark as loading to prevent duplicate creation
    (this as any)[loadingKey] = true;

    try {
      // Load character model (same as remote players)
      const char = this.characters.find(c => c.id === characterId);
      if (!char) {
        console.error('❌ Character config not found for NPC:', characterId);
        delete (this as any)[loadingKey]; // Clean up loading flag
        return;
      }

      const npcCharacter = await this.loadCachedAsset(char.modelPath);
      if (!npcCharacter) {
        console.error('❌ Failed to load NPC model');
        delete (this as any)[loadingKey]; // Clean up loading flag
        return;
      }

      // NPCs keep full brightness (unlike remote players which are darkened)
      npcCharacter.scale.set(char.scale, char.scale, char.scale);
      npcCharacter.castShadow = true;

      // Load animations
      const npcMixer = new THREE.AnimationMixer(npcCharacter);
      const npcActions: { [key: string]: THREE.AnimationAction } = {};

      const npcAnimationPromises = Object.entries(char.animations).map(async ([name, path]) => {
        try {
          const clip = await this.loadCachedAnimation(path);
          if (clip) {
            npcActions[name] = npcMixer.clipAction(clip);
            return { name, success: true };
          } else {
            console.error(`❌ Failed to load NPC animation ${name}: clip not found`);
            return { name, success: false };
          }
        } catch (error) {
          console.error(`❌ Failed to load NPC animation ${name}:`, error);
          return { name, success: false };
        }
      });

      await Promise.all(npcAnimationPromises);

      // Calculate character bounding box
      npcCharacter.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(npcCharacter);
      const size = box.getSize(new THREE.Vector3());
      const collisionRadius = Math.max(size.x, size.z) * 0.5;
      const npcGroundOffset = -box.min.y;

      // Store metadata
      npcCharacter.userData.characterId = characterId;
      npcCharacter.userData.collisionRadius = collisionRadius;
      npcCharacter.userData.size = size;
      npcCharacter.userData.groundOffset = npcGroundOffset;
      npcCharacter.userData.isNPC = true; // Mark as NPC

      // Position on ground
      const groundY = this.positionRemotePlayerOnGround(npcCharacter, position.x, position.z);
      npcCharacter.position.set(position.x, groundY, position.z);
      const initialQuaternion = new THREE.Quaternion();
      initialQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      npcCharacter.quaternion.copy(initialQuaternion);

      // Ensure visibility
      npcCharacter.visible = true;
      npcCharacter.traverse((child: any) => {
        child.visible = true;
        if (child.isMesh) {
          child.frustumCulled = true;
        }
      });

      // Store NPC data
      this.npcs.set(npcId, npcCharacter);
      this.npcMixers.set(npcId, npcMixer);
      this.npcActions.set(npcId, npcActions);

      // Initialize interpolation buffer
      const initialState = {
        position: new THREE.Vector3(position.x, groundY, position.z),
        quaternion: initialQuaternion.clone(),
        timestamp: Date.now()
      };
      this.npcInterpolationBuffers.set(npcId, [initialState]);

      // Start with animation - configure properly to match player animation behavior
      const initialAnimationName = animation || 'idle';
      const initialAnimation = npcActions[initialAnimationName];
      if (initialAnimation) {
        initialAnimation.reset();
        initialAnimation.setLoop(THREE.LoopRepeat, Infinity);
        initialAnimation.clampWhenFinished = false;
        initialAnimation.play();

        // Track current animation to prevent unnecessary resets
        this.npcCurrentAnimations.set(npcId, initialAnimationName);
      }

      this.scene.add(npcCharacter);

      // MVP 7: Add NPC collision
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          npcId,
          npcCharacter.position,
          collisionRadius
        );
      }

      // MVP 7: Create NPC name label with cyan/yellow color + italic styling
      const npcNameLabel = this.createLabel(username, '#000000'); // Black text for readability
      npcNameLabel.style.background = 'linear-gradient(90deg, rgba(0,255,255,0.9), rgba(255,255,0,0.9))'; // Cyan to yellow gradient
      npcNameLabel.style.padding = '4px 10px';
      npcNameLabel.style.borderRadius = '12px';
      npcNameLabel.style.fontSize = '13px';
      npcNameLabel.style.fontWeight = 'bold';
      npcNameLabel.style.fontStyle = 'italic'; // Italic for NPCs
      npcNameLabel.style.whiteSpace = 'nowrap';
      npcNameLabel.style.pointerEvents = 'none';
      npcNameLabel.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      npcNameLabel.style.position = 'absolute'; // Ensure absolute positioning
      npcNameLabel.style.visibility = 'visible'; // Explicitly set visibility
      npcNameLabel.style.display = 'block'; // Ensure display is block
      npcNameLabel.style.zIndex = '1000'; // Ensure it's above other elements
      this.npcNameLabels.set(npcId, npcNameLabel);

      // Add label to DOM
      if (this.labelsContainer) {
        this.labelsContainer.appendChild(npcNameLabel);
        console.log(`🏷️ Added NPC label to DOM: ${username}`);
      } else {
        console.error('❌ No labels container found for NPC label');
      }

      console.log(`🤖 Created NPC: ${username} (${characterId}) at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);

      // Process any pending updates that arrived while NPC was loading
      const pendingQueue = this.npcPendingUpdates.get(npcId);
      if (pendingQueue && pendingQueue.length > 0) {
        console.log(`📦 Processing ${pendingQueue.length} queued updates for ${npcId}`);
        for (const update of pendingQueue) {
          this.updateNPC(npcId, update.position, update.rotationY, update.animation, update.velocity, update.behavior);
        }
        this.npcPendingUpdates.delete(npcId);
      }

      // MVP 8: Clear loading flag after successful creation
      delete (this as any)[loadingKey];
    } catch (error) {
      console.error('❌ Failed to create NPC:', npcId, error);
      // MVP 8: Clear loading flag on error
      delete (this as any)[loadingKey];
    }
  }

  /**
   * MVP 7: Update NPC position and animation from server
   */
  private updateNPC(npcId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; z: number }, behavior?: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      // Calculate ground position
      const groundY = this.positionRemotePlayerOnGround(npc, position.x, position.z);

      const newQuaternion = new THREE.Quaternion();
      newQuaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));
      const newState = {
        position: new THREE.Vector3(position.x, groundY, position.z),
        quaternion: newQuaternion.clone(),
        timestamp: Date.now()
      };

      // Get or create buffer
      let buffer = this.npcInterpolationBuffers.get(npcId);
      if (!buffer) {
        buffer = [];
        this.npcInterpolationBuffers.set(npcId, buffer);
      }

      // Add new state and maintain buffer
      buffer.push(newState);

      // Remove old states (keep recent history for interpolation)
      const cutoffTime = newState.timestamp - (this.INTERPOLATION_DELAY + 200);
      while (buffer.length > 2 && buffer[0].timestamp < cutoffTime) {
        buffer.shift();
      }

      // Safety: limit buffer size
      while (buffer.length > this.MAX_BUFFER_SIZE) {
        buffer.shift();
      }

      // Update animation ONLY if it has changed (prevent constant resets)
      if (animation) {
        const currentAnimation = this.npcCurrentAnimations.get(npcId);

        // Only reset and play if animation name has actually changed
        if (currentAnimation !== animation) {
          const actions = this.npcActions.get(npcId);
          if (actions && actions[animation]) {
            // Stop current animation
            Object.values(actions).forEach(action => action.stop());
            // Play new animation with proper loop configuration
            const action = actions[animation];
            action.reset();
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.clampWhenFinished = false;
            action.play();

            // Update tracked animation
            this.npcCurrentAnimations.set(npcId, animation);
          }
        }
      }
    } else {
      // NPC not loaded yet - queue the update for when it's ready
      let pendingQueue = this.npcPendingUpdates.get(npcId);
      if (!pendingQueue) {
        pendingQueue = [];
        this.npcPendingUpdates.set(npcId, pendingQueue);
      }

      // Add update to queue (limit queue size to prevent memory issues)
      pendingQueue.push({ position, rotationY, animation, velocity, behavior, timestamp: Date.now() });
      if (pendingQueue.length > 20) {
        pendingQueue.shift(); // Remove oldest
      }
    }
  }

  /**
   * MVP 7: Remove NPC from client (server despawn)
   */
  private removeNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      // Clean up geometry and materials
      npc.traverse((child: any) => {
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

      this.scene.remove(npc);
      this.npcs.delete(npcId);

      // Clean up animation system
      this.npcMixers.delete(npcId);
      this.npcActions.delete(npcId);
      this.npcCurrentAnimations.delete(npcId);

      // Clean up collision
      if (this.collisionSystem) {
        this.collisionSystem.removeCollider(npcId);
      }

      // Clean up interpolation buffer
      this.npcInterpolationBuffers.delete(npcId);

      // Clean up pending updates queue
      this.npcPendingUpdates.delete(npcId);

      // Remove name label
      const nameLabel = this.npcNameLabels.get(npcId);
      if (nameLabel && this.labelsContainer) {
        this.labelsContainer.removeChild(nameLabel);
        this.npcNameLabels.delete(npcId);
      }

      console.log(`🤖 Removed NPC: ${npcId}`);
    }
  }

  /**
   * MVP 7: Handle NPC throwing walnut at target
   */
  private handleNPCThrow(npcId: string, fromPosition: { x: number; y: number; z: number }, toPosition: { x: number; y: number; z: number }, targetId: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      // MVP 8: Play attack animation when NPC throws (no 'throw' animation, use 'attack')
      const actions = this.npcActions.get(npcId);
      if (actions && actions['attack']) {
        actions['attack'].reset().setLoop(THREE.LoopOnce, 1).play();
        actions['attack'].clampWhenFinished = true;
      }

      // MVP 8: Spawn flying walnut projectile
      if (this.projectileManager) {
        const from = new THREE.Vector3(fromPosition.x, fromPosition.y + 1.5, fromPosition.z); // Add height for throw origin
        const to = new THREE.Vector3(toPosition.x, toPosition.y + 1.0, toPosition.z); // Aim at chest height
        this.projectileManager.spawnProjectile(from, to, npcId, targetId);
      }
    }
  }

  /**
   * MVP 8: Handle throw event (player or NPC throwing walnut)
   */
  private handleThrowEvent(throwerId: string, fromPosition: { x: number; y: number; z: number }, toPosition: { x: number; y: number; z: number }, targetId?: string): void {
    // Spawn projectile
    if (this.projectileManager) {
      const from = new THREE.Vector3(fromPosition.x, fromPosition.y, fromPosition.z);
      const to = new THREE.Vector3(toPosition.x, toPosition.y, toPosition.z);
      this.projectileManager.spawnProjectile(from, to, throwerId, targetId);
      console.log(`🌰 Projectile spawned: ${throwerId} → ${targetId || 'ground'}`);
    }

    // MVP 8: Play attack animation for the thrower (no 'throw' animation, use 'attack')
    if (throwerId !== this.playerId) {
      // Check if it's a remote player
      const remotePlayer = this.remotePlayers.get(throwerId);
      if (remotePlayer) {
        const actions = this.remotePlayerActions.get(throwerId);
        if (actions && actions['attack']) {
          actions['attack'].reset().setLoop(THREE.LoopOnce, 1).play();
          actions['attack'].clampWhenFinished = true;
        }
      } else {
        // Check if it's an NPC
        const npc = this.npcs.get(throwerId);
        if (npc) {
          const actions = this.npcActions.get(throwerId);
          if (actions && actions['attack']) {
            actions['attack'].reset().setLoop(THREE.LoopOnce, 1).play();
            actions['attack'].clampWhenFinished = true;
          }
        }
      }
    } else {
      // Local player threw - play local attack animation if available
      if (this.actions && this.actions['attack']) {
        this.actions['attack'].reset().setLoop(THREE.LoopOnce, 1).play();
        this.actions['attack'].clampWhenFinished = true;
      }
    }
  }

  /**
   * MVP 8: Handle projectile hitting an entity
   * This is called when ProjectileManager detects a hit
   */
  private onProjectileHit(data: { projectileId: string; ownerId: string; targetId: string; position: THREE.Vector3; mesh: THREE.Group }): void {
    console.log(`🌰 Projectile hit! Owner: ${data.ownerId}, Target: ${data.targetId}`);

    // MVP 8: Show "HIT!" feedback to the thrower
    if (data.ownerId === this.playerId) {
      this.toastManager.success('HIT!');
    }

    // MVP 8: Check if LOCAL player was hit (stun + forced hit animation)
    if (data.targetId === this.playerId) {
      // MVP 8 FIX: Add intense visual effects when hit
      this.triggerHitEffects();

      // Local player was hit - force hit animation and block movement for 1.5s
      if (this.actions && this.actions['hit']) {
        const hitAction = this.actions['hit'];
        const normalDuration = hitAction.getClip().duration * 1000; // ms
        hitAction.timeScale = 0.65; // Slow down to 65% speed (54% longer)

        this.isStunned = true;
        this.velocity.set(0, 0, 0); // Stop current movement

        this.playOneShotAnimation('hit', normalDuration * 1.54); // 1/0.65 = 1.54x longer

        // Clear stunned flag after 1.5 seconds
        setTimeout(() => {
          this.isStunned = false;
        }, 1500);
      }
    }

    // MVP 8: Trigger hit animation on target (remote player or NPC)
    const remotePlayer = this.remotePlayers.get(data.targetId);
    if (remotePlayer && this.remotePlayerActions.has(data.targetId)) {
      const actions = this.remotePlayerActions.get(data.targetId);
      if (actions && actions['hit']) {
        // Play hit animation for 1.5 seconds
        const hitAction = actions['hit'];
        hitAction.timeScale = 0.65; // Slow down
        hitAction.reset().setLoop(THREE.LoopOnce, 1).play();
        hitAction.clampWhenFinished = true;
      }
    }

    // Check if target is an NPC
    const npc = this.npcs.get(data.targetId);
    if (npc && this.npcActions.has(data.targetId)) {
      const actions = this.npcActions.get(data.targetId);
      if (actions && actions['hit']) {
        // Play hit animation for 1.5 seconds
        const hitAction = actions['hit'];
        hitAction.timeScale = 0.65; // Slow down
        hitAction.reset().setLoop(THREE.LoopOnce, 1).play();
        hitAction.clampWhenFinished = true;
      }
    }

    // BEST PRACTICE: Transform projectile mesh into pickup walnut (no destroy/recreate)
    const walnutId = `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // MVP 8 FIX: Position on terrain (walnut center at radius above ground so bottom touches)
    const terrainHeight = getTerrainHeight(data.position.x, data.position.z);
    data.mesh.position.y = terrainHeight + (this.WALNUT_SIZE / 2); // Radius offset so bottom touches ground

    // Stop spinning animation (projectile was spinning in flight)
    data.mesh.rotation.set(0, 0, 0);

    // Update metadata to convert from projectile to pickup
    data.mesh.userData.id = walnutId;
    data.mesh.userData.ownerId = 'game';
    data.mesh.userData.type = 'ground';
    data.mesh.userData.points = 1;
    data.mesh.userData.clickPosition = data.mesh.position.clone();

    // Set immunity for hit player
    data.mesh.userData.immunePlayerId = data.targetId;
    data.mesh.userData.immuneUntil = Date.now() + 1500;

    // Add to walnuts registry (mesh already in scene from projectile)
    this.walnuts.set(walnutId, data.mesh);

    // Add label
    const label = this.createLabel('Dropped Walnut (1 pt)', '#CD853F');
    this.walnutLabels.set(walnutId, label);

    // Notify server to sync with other clients
    this.sendMessage({
      type: 'spawn_dropped_walnut',
      position: {
        x: data.mesh.position.x,
        y: data.mesh.position.y,
        z: data.mesh.position.z
      },
      immunePlayerId: data.targetId
    });

    // TODO Phase 3: Apply damage to target
    // TODO Phase 3: Send hit message to server for validation
  }

  /**
   * MVP 8: Handle projectile missing (hit ground)
   * BEST PRACTICE: Transform projectile mesh into pickup walnut (no destroy/recreate)
   */
  private onProjectileMiss(data: { projectileId: string; ownerId: string; position: THREE.Vector3; mesh: THREE.Group }): void {
    console.log(`🌰 Projectile missed! Transforming to pickupable walnut at position:`, data.position);

    // BEST PRACTICE: Transform projectile mesh into pickup walnut (no destroy/recreate)
    const walnutId = `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // MVP 8 FIX: Position on terrain (walnut center at radius above ground so bottom touches)
    const terrainHeight = getTerrainHeight(data.position.x, data.position.z);
    data.mesh.position.y = terrainHeight + (this.WALNUT_SIZE / 2); // Radius offset so bottom touches ground

    // Stop spinning animation (projectile was spinning in flight)
    data.mesh.rotation.set(0, 0, 0);

    // Update metadata to convert from projectile to pickup
    data.mesh.userData.id = walnutId;
    data.mesh.userData.ownerId = 'game';
    data.mesh.userData.type = 'ground';
    data.mesh.userData.points = 1;
    data.mesh.userData.clickPosition = data.mesh.position.clone();

    // No immunity for misses - anyone can pick up immediately

    // Add to walnuts registry (mesh already in scene from projectile)
    this.walnuts.set(walnutId, data.mesh);

    // Add label
    const label = this.createLabel('Dropped Walnut (1 pt)', '#CD853F');
    this.walnutLabels.set(walnutId, label);

    // Notify server to sync with other clients
    this.sendMessage({
      type: 'spawn_dropped_walnut',
      position: {
        x: data.mesh.position.x,
        y: data.mesh.position.y,
        z: data.mesh.position.z
      }
      // No immunity for misses
    });
  }

  /**
   * MVP 8: Handle projectile near-miss (play fear animation)
   * This is called when ProjectileManager detects a near miss
   */
  private onProjectileNearMiss(data: { projectileId: string; ownerId: string; entityId: string; position: THREE.Vector3 }): void {
    console.log(`😨 Projectile near-miss! Entity: ${data.entityId}`);

    // Play fear animation for the entity that experienced the near miss
    if (data.entityId === this.playerId) {
      // Local player had near miss - slower for emphasis
      if (this.actions && this.actions['fear']) {
        const fearAction = this.actions['fear'];
        const normalDuration = fearAction.getClip().duration * 1000; // ms
        fearAction.timeScale = 0.65; // Slow down to 65% speed (54% longer)
        this.playOneShotAnimation('fear', normalDuration * 1.54); // 1/0.65 = 1.54x longer
      }
    } else {
      // Check if it's a remote player
      const remotePlayer = this.remotePlayers.get(data.entityId);
      if (remotePlayer && this.remotePlayerActions.has(data.entityId)) {
        const actions = this.remotePlayerActions.get(data.entityId);
        if (actions && actions['fear']) {
          actions['fear'].reset().setLoop(THREE.LoopOnce, 1).play();
          actions['fear'].clampWhenFinished = true;
        }
      }

      // Check if it's an NPC
      const npc = this.npcs.get(data.entityId);
      if (npc && this.npcActions.has(data.entityId)) {
        const actions = this.npcActions.get(data.entityId);
        if (actions && actions['fear']) {
          actions['fear'].reset().setLoop(THREE.LoopOnce, 1).play();
          actions['fear'].clampWhenFinished = true;
        }
      }
    }
  }

  /**
   * INDUSTRY STANDARD: Position LOCAL player on ground using raycasting
   * Uses the same technique as remote players for consistency
   */
  private positionLocalPlayerOnGround(): number {
    const x = this.character.position.x;
    const z = this.character.position.z;

    if (!this.terrain) {
      return getTerrainHeight(x, z) + this.characterGroundOffset;
    }

    // INDUSTRY STANDARD: Raycast from above downward to find terrain
    const rayOrigin = new THREE.Vector3(x, 100, z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    this.raycaster.set(rayOrigin, rayDirection);

    const intersects = this.raycaster.intersectObject(this.terrain, false);

    if (intersects.length > 0) {
      const groundY = intersects[0].point.y;
      return groundY + this.characterGroundOffset;
    }

    // Fallback to heightmap
    return getTerrainHeight(x, z) + this.characterGroundOffset;
  }

  /**
   * STANDARD: Position REMOTE player on ground using raycasting
   * Raycasts downward to find terrain, calculates feet offset from bounding box
   */
  private positionRemotePlayerOnGround(character: THREE.Group, x: number, z: number): number {
    // Use stored ground offset (calculated once in bind pose)
    const groundOffset = character.userData.groundOffset || 0;

    if (!this.terrain) {
      return getTerrainHeight(x, z) + groundOffset;
    }

    // Raycast from above downward to find terrain
    const rayOrigin = new THREE.Vector3(x, 100, z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    this.raycaster.set(rayOrigin, rayDirection);

    const intersects = this.raycaster.intersectObject(this.terrain, false);

    if (intersects.length > 0) {
      const groundY = intersects[0].point.y;
      return groundY + groundOffset;
    }

    // Fallback to heightmap
    return getTerrainHeight(x, z) + groundOffset;
  }

  /**
   * MVP 5.9: Apply soft boundary push-back (prevents walking off world edge)
   * INDUSTRY STANDARD: Gradual push toward center (no jarring collision)
   */
  private applyBoundaryPushBack(delta: number): void {
    if (!this.character) return;

    const pos = this.character.position;
    const distanceFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    const pushStartDistance = this.WORLD_RADIUS - this.BOUNDARY_PUSH_ZONE;

    // Check if player is in push zone
    if (distanceFromCenter > pushStartDistance) {
      // Calculate push strength (0 at start of zone, 1 at edge)
      const pushProgress = (distanceFromCenter - pushStartDistance) / this.BOUNDARY_PUSH_ZONE;
      const pushStrength = Math.min(1, pushProgress); // Clamp to [0, 1]

      // Calculate direction from player to center
      const angle = Math.atan2(pos.z, pos.x);
      const pushForce = this.BOUNDARY_PUSH_STRENGTH * pushStrength * delta;

      // Push toward center
      pos.x -= Math.cos(angle) * pushForce;
      pos.z -= Math.sin(angle) * pushForce;

      // Update visual feedback
      this.updateBoundaryWarning(pushStrength);
    } else {
      // Hide warning when not near boundary
      this.updateBoundaryWarning(0);
    }
  }

  /**
   * MVP 5.9: Update boundary warning visual feedback
   * Shows vignette and message when approaching edge
   */
  private updateBoundaryWarning(intensity: number): void {
    // Create elements on first use
    if (!this.boundaryVignetteElement) {
      this.createBoundaryWarningElements();
    }

    if (!this.boundaryVignetteElement || !this.boundaryWarningElement) return;

    if (intensity > 0) {
      // Show and update intensity
      const opacity = Math.min(0.6, intensity * 0.6); // Max 60% opacity
      this.boundaryVignetteElement.style.opacity = opacity.toString();
      this.boundaryVignetteElement.style.display = 'block';

      // Show warning text when getting close (>50% into push zone)
      if (intensity > 0.5) {
        this.boundaryWarningElement.style.opacity = ((intensity - 0.5) * 2).toString();
        this.boundaryWarningElement.style.display = 'block';
      } else {
        this.boundaryWarningElement.style.display = 'none';
      }
    } else {
      // Hide everything
      this.boundaryVignetteElement.style.display = 'none';
      this.boundaryWarningElement.style.display = 'none';
    }
  }

  /**
   * MVP 5.9: Create boundary warning UI elements
   */
  private createBoundaryWarningElements(): void {
    // Create vignette overlay
    this.boundaryVignetteElement = document.createElement('div');
    this.boundaryVignetteElement.id = 'boundary-vignette';
    this.boundaryVignetteElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 500;
      display: none;
      background: radial-gradient(circle, transparent 20%, rgba(0,0,0,0.8) 100%);
    `;
    document.body.appendChild(this.boundaryVignetteElement);

    // Create warning text
    this.boundaryWarningElement = document.createElement('div');
    this.boundaryWarningElement.id = 'boundary-warning';
    this.boundaryWarningElement.textContent = '⚠️ Turn Back';
    this.boundaryWarningElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ff4444;
      font-size: 32px;
      font-weight: bold;
      font-family: Arial, sans-serif;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      pointer-events: none;
      z-index: 501;
      display: none;
      animation: pulse 1s ease-in-out infinite;
    `;
    document.body.appendChild(this.boundaryWarningElement);

    // Add pulse animation if not already present
    if (!document.getElementById('boundary-animation-style')) {
      const style = document.createElement('style');
      style.id = 'boundary-animation-style';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
        }
      `;
      document.head.appendChild(style);
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
  }

  /**
   * Add landmark trees for navigation
   */
  private async addLandmarks(): Promise<void> {

    // Origin landmark at (0, 0)
    await this.createLandmark(0, 0, '/assets/models/environment/Dead_straight_tree.glb', 'Origin');

    // North landmark at (0, -80)
    await this.createLandmark(0, -80, '/assets/models/environment/bottle_tree.glb', 'North');

    // South landmark at (0, 80) - Collision auto-calculated from mesh
    await this.createLandmark(0, 80, '/assets/models/environment/Big_pine.glb', 'South');

    // East landmark at (80, 0) - 1.75x bigger
    await this.createLandmark(80, 0, '/assets/models/environment/Straight_sphere_tree.glb', 'East', 17.5);

    // West landmark at (-80, 0)
    await this.createLandmark(-80, 0, '/assets/models/environment/W_branch_tree.glb', 'West');

  }

  /**
   * Create a single landmark tree
   */
  private async createLandmark(
    x: number,
    z: number,
    modelPath: string,
    name: string,
    scale: number = 10
  ): Promise<void> {
    try {
      // Load the tree model
      const loadedModel = await this.loadCachedAsset(modelPath);
      if (!loadedModel) {
        console.error(`❌ Failed to load landmark: ${modelPath}`);
        return;
      }

      // Debug: Count meshes and find the one closest to origin
      let meshCount = 0;
      let closestMesh: THREE.Mesh | null = null;
      let closestDistance = Infinity;

      loadedModel.traverse((child: any) => {
        if (child instanceof THREE.Mesh) {
          meshCount++;
          const worldPos = new THREE.Vector3();
          child.getWorldPosition(worldPos);
          const distance = worldPos.length();

          // Keep track of mesh closest to origin
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMesh = child;
          }
        }
      });

      if (!closestMesh) {
        console.error(`❌ No mesh found in landmark: ${modelPath}`);
        return;
      }

      // Create new group with only the closest mesh
      const tree = new THREE.Group();
      const meshClone = closestMesh.clone();

      // Reset mesh local position to origin so it's centered in the group
      meshClone.position.set(0, 0, 0);
      tree.add(meshClone);

      // Scale the tree (default 10x for landmarks)
      tree.scale.setScalar(scale);

      // Get terrain height at this position
      const terrainY = getTerrainHeight(x, z);

      // Position the tree on the terrain
      tree.position.set(x, terrainY, z);
      tree.castShadow = true;
      tree.receiveShadow = true;

      this.scene.add(tree);

      // Register landmark in map for minimap display
      this.landmarks.set(name, new THREE.Vector3(x, terrainY, z));

      // MVP 5.5: Add collision using ACTUAL tree mesh (standard game practice)
      if (this.collisionSystem) {
        const treeWorldPos = new THREE.Vector3(x, terrainY, z);
        this.collisionSystem.addTreeMeshCollider(
          `landmark_${name}`,
          tree,
          treeWorldPos
        );
      }

      // Add floating text label above the landmark (1.3x higher to clear tree canopy)
      this.createLandmarkLabel(name, x, terrainY + 39, z);
    } catch (error) {
      console.error(`❌ Error creating landmark ${name}:`, error);
    }
  }

  /**
   * Create a floating text label above a landmark (sprite-based, cartoony style)
   */
  private createLandmarkLabel(text: string, x: number, y: number, z: number): void {
    // Extract just the first letter
    const label = text.charAt(0);

    // Choose color based on landmark (matching minimap)
    let bgColor = '#FFD700'; // Gold for Origin
    if (text === 'North') bgColor = '#4CAF50'; // Green
    else if (text === 'South') bgColor = '#2196F3'; // Blue
    else if (text === 'East') bgColor = '#FF9800'; // Orange
    else if (text === 'West') bgColor = '#9C27B0'; // Purple

    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 128;
    canvas.height = 128;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 55;

    // Clear canvas (transparent background)
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw drop shadow (cartoony style)
    context.fillStyle = 'rgba(0, 0, 0, 0.4)';
    context.beginPath();
    context.arc(centerX + 3, centerY + 3, radius, 0, Math.PI * 2);
    context.fill();

    // Draw colored circle background
    context.fillStyle = bgColor;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();

    // Draw thick black outline (comic style)
    context.strokeStyle = '#000000';
    context.lineWidth = 6;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();

    // Draw letter with thick outline (cartoon style)
    context.font = 'bold 70px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Letter outline (black stroke)
    context.strokeStyle = '#000000';
    context.lineWidth = 8;
    context.strokeText(label, centerX, centerY);

    // Letter fill (white)
    context.fillStyle = '#ffffff';
    context.fillText(label, centerX, centerY);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // Create sprite material (depthTest enabled so labels are occluded by trees)
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });

    // Create sprite (billboard - always faces camera)
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(6, 6, 1); // Smaller, more subtle

    this.scene.add(sprite);
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

  /**
   * MVP 8 FIX: Load shared walnut model for visual consistency
   * All walnut types use this same model with different effects/sizes
   */
  private async loadWalnutModel(): Promise<void> {
    try {
      const walnutScene = await this.loadCachedAsset('/assets/models/environment/walnut_free_download.glb');
      if (walnutScene) {
        this.walnutModel = walnutScene;

        // Scale to standard size
        const box = new THREE.Box3().setFromObject(this.walnutModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = this.WALNUT_SIZE / maxDim;
        this.walnutModel.scale.setScalar(scale);

        console.log('✅ Loaded shared walnut model');
      } else {
        console.warn('⚠️ Failed to load walnut model, using fallback');
        this.createFallbackWalnutModel();
      }
    } catch (error) {
      console.error('❌ Error loading walnut model:', error);
      this.createFallbackWalnutModel();
    }
  }

  /**
   * Create fallback walnut model if GLB fails to load
   */
  private createFallbackWalnutModel(): void {
    const geometry = new THREE.SphereGeometry(this.WALNUT_SIZE, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // Brown
      roughness: 0.8,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.walnutModel = new THREE.Group();
    this.walnutModel.add(mesh);
  }

  /**
   * Create a walnut mesh from the shared model
   * Returns a clone ready to add to the scene
   */
  private createWalnutMesh(): THREE.Group {
    if (!this.walnutModel) {
      console.warn('⚠️ Walnut model not loaded, creating fallback');
      this.createFallbackWalnutModel();
    }
    return this.walnutModel!.clone();
  }

  private startDebugUpdates(): void {
    const updateDebug = () => {
      try {
        const playerPosSpan = document.getElementById('player-pos');
        const playerCountSpan = document.getElementById('player-count');
        const networkStatusSpan = document.getElementById('network-status');
        const playerIdSpan = document.getElementById('player-id');
        const fpsSpan = document.getElementById('debug-fps');
        const memorySpan = document.getElementById('debug-memory');
        const latencySpan = document.getElementById('debug-latency');

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

        // MVP 5: Enhanced debug info
        if (fpsSpan) {
          fpsSpan.textContent = `${Math.round(this.fps)}`;
        }

        if (memorySpan) {
          // @ts-ignore - performance.memory is available in Chrome/Edge
          if (performance.memory) {
            // @ts-ignore
            const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            memorySpan.textContent = `${usedMB} MB`;
          } else {
            memorySpan.textContent = 'N/A';
          }
        }

        if (latencySpan) {
          latencySpan.textContent = `${Math.round(this.networkLatency)} ms`;
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

    if (walnutCountSpan) {
      // MVP 8: Display unified walnut inventory
      walnutCountSpan.textContent = `${this.walnutInventory}`;
    }

    if (playerScoreSpan) {
      // MVP 5: Display animated score with tweening
      playerScoreSpan.textContent = `${Math.floor(this.displayedScore)}`;
    }

    // MVP 5.7: Update mobile hide button
    this.updateMobileHideButton();
  }

  /**
   * MVP 5.7: Update mobile hide button state (count, enabled/disabled)
   */
  private updateMobileHideButton(): void {
    const hideButton = document.getElementById('mobile-hide-btn') as HTMLButtonElement;
    const hideCountSpan = document.getElementById('mobile-hide-count');

    if (hideButton && hideCountSpan) {
      // MVP 8: Update count display using unified walnut inventory
      hideCountSpan.textContent = `(${this.walnutInventory})`;

      // Enable/disable button based on walnut count
      if (this.walnutInventory <= 0) {
        hideButton.disabled = true;
        hideButton.style.opacity = '0.4';
      } else {
        hideButton.disabled = false;
        hideButton.style.opacity = '1';
      }
    }
  }

  /**
   * MVP 8: Update mobile throw button state (count, enabled/disabled)
   */
  private updateMobileThrowButton(): void {
    const throwButton = document.getElementById('mobile-throw-btn') as HTMLButtonElement;
    const throwCountSpan = document.getElementById('mobile-throw-count');

    if (throwButton && throwCountSpan) {
      // Update count display
      throwCountSpan.textContent = `(${this.walnutInventory})`;

      // Enable/disable button based on walnut inventory
      if (this.walnutInventory <= 0) {
        throwButton.disabled = true;
        throwButton.style.opacity = '0.4';
      } else {
        throwButton.disabled = false;
        throwButton.style.opacity = '1';
      }
    }
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
  }

  /**
   * MVP 6: Update remote player username labels (always visible, positioned above player)
   */
  private updateRemotePlayerNameLabels(): void {
    for (const [playerId, label] of this.remotePlayerNameLabels) {
      const player = this.remotePlayers.get(playerId);
      if (player) {
        // Position label above player's head (2.5 units up)
        const labelPos = player.position.clone();
        labelPos.y += 2.5;
        this.updateLabelPosition(label, labelPos);
      }
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

  /**
   * MVP 5.5: Trigger camera shake on collision (standard game feel technique)
   */
  private triggerCameraShake(intensity: number = 0.03, duration: number = 0.15): void {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeDuration = duration;
    this.cameraShakeTime = 0;
  }

  /**
   * MVP 5.5: Update camera shake effect (called each frame)
   */
  private updateCameraShake(delta: number): void {
    if (this.cameraShakeTime >= this.cameraShakeDuration) {
      // Shake finished - reset camera offset
      this.camera.position.sub(this.cameraBaseOffset);
      this.cameraBaseOffset.set(0, 0, 0);
      return;
    }

    // Remove previous shake offset
    this.camera.position.sub(this.cameraBaseOffset);

    // Calculate new shake offset (random direction, decreasing intensity)
    this.cameraShakeTime += delta;
    const progress = this.cameraShakeTime / this.cameraShakeDuration;
    const currentIntensity = this.cameraShakeIntensity * (1 - progress); // Linear decay

    // Random shake in all directions
    this.cameraBaseOffset.set(
      (Math.random() - 0.5) * currentIntensity * 2,
      (Math.random() - 0.5) * currentIntensity * 2,
      (Math.random() - 0.5) * currentIntensity * 2
    );

    // Apply new shake offset
    this.camera.position.add(this.cameraBaseOffset);
  }

  // MVP 3: Walnut visual system methods

  /**
   * Create visual indicator for a buried walnut (mound of dirt)
   * MVP 5: Improved to be more rounded and natural-looking
   * MVP 8: Using shared walnut mesh for visual consistency
   */
  private createBuriedWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // MVP 8 FIX: Use shared walnut mesh (partially buried above mound)
    const walnut = this.createWalnutMesh();
    walnut.position.y = 0.04; // Partially visible above dirt mound
    walnut.castShadow = true;
    walnut.receiveShadow = true;
    group.add(walnut);

    // Dirt mound around walnut (smaller, more subtle)
    const moundGeometry = new THREE.SphereGeometry(0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2); // Reduced from 0.16 to 0.12
    const moundMaterial = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a, // Lighter soil color (more visible than before)
      roughness: 0.95,
      metalness: 0.1
    });
    const mound = new THREE.Mesh(moundGeometry, moundMaterial);
    mound.scale.set(1, 0.3, 1); // Flatter mound
    mound.position.y = 0.01;
    mound.receiveShadow = true;
    mound.castShadow = true;
    group.add(mound);

    // Add a darker ring at base for depth
    const ringGeometry = new THREE.RingGeometry(0.18, 0.25, 16);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3a2a,
      roughness: 0.98,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    ring.receiveShadow = true;
    group.add(ring);

    // Add invisible collision sphere for easier clicking (MVP 5: Increased to 1.2 for even better click detection)
    const collisionGeometry = new THREE.SphereGeometry(1.2, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0.05;
    group.add(collisionMesh);

    // MVP 5: Add hover highlight ring (initially hidden)
    const hoverRingGeometry = new THREE.TorusGeometry(0.3, 0.03, 8, 24);
    const hoverRingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const hoverRing = new THREE.Mesh(hoverRingGeometry, hoverRingMaterial);
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.y = 0.03;
    group.add(hoverRing);
    group.userData.hoverRing = hoverRing;

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'buried';
    group.userData.points = 3;
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y + 0.05, position.z);

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

    // Add invisible collision sphere for easier clicking (MVP 5: Increased to 1.0 for better click detection)
    const collisionGeometry = new THREE.SphereGeometry(1.0, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0.4;
    group.add(collisionMesh);

    // MVP 5: Add hover highlight glow (initially hidden)
    const hoverGlowGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const hoverGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff88,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const hoverGlow = new THREE.Mesh(hoverGlowGeometry, hoverGlowMaterial);
    hoverGlow.position.y = 0.4;
    group.add(hoverGlow);
    group.userData.hoverGlow = hoverGlow;

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
   * MVP 8: Reduced size for better gameplay visibility
   */
  /**
   * MVP 8 FIX: Create golden (game-spawned bonus) walnut using shared model
   * Simple golden walnut with subtle throbbing glow (like ground walnut)
   */
  private createGameWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Use shared walnut model for consistency
    const walnut = this.createWalnutMesh();
    walnut.position.y = 0;

    // Override material to golden color (subtle, not garish)
    walnut.traverse((child: any) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xDAA520, // Goldenrod - natural golden walnut
          emissive: 0xB8860B, // Dark goldenrod emissive (subtle glow)
          emissiveIntensity: 0.2,
          metalness: 0.3,
          roughness: 0.7
        });
      }
    });
    group.add(walnut);

    // Invisible collision sphere for clicking
    const collisionGeometry = new THREE.SphereGeometry(1.0, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0;
    group.add(collisionMesh);

    // Throbbing glow effect (initially visible, will pulse via animation)
    const glowGeometry = new THREE.SphereGeometry(this.WALNUT_SIZE * 2, 16, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFD700, // Gold
      transparent: true,
      opacity: 0.2, // Start subtle
      blending: THREE.AdditiveBlending
    });
    const throbGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    throbGlow.position.y = 0;
    group.add(throbGlow);
    group.userData.throbGlow = throbGlow; // Store for throb animation

    // Hover pulse glow (initially hidden)
    const hoverPulseGeometry = new THREE.SphereGeometry(this.WALNUT_SIZE * 3, 16, 12);
    const hoverPulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const hoverPulse = new THREE.Mesh(hoverPulseGeometry, hoverPulseMaterial);
    hoverPulse.position.y = 0;
    group.add(hoverPulse);
    group.userData.hoverPulse = hoverPulse;

    // Store references
    group.userData.walnut = walnut;

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'game';
    group.userData.points = 5; // Bonus multiplier
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y, position.z);

    return group;
  }

  /**
   * MVP 8: Create visual for ground walnut (dropped from throw)
   * Simple walnut on ground surface, no fancy effects
   */
  /**
   * MVP 8 FIX: Create ground walnut using shared model
   * Used for dropped walnuts from throws (hits and misses)
   */
  private createGroundWalnutVisual(position: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();

    // Use shared walnut model for consistency
    const walnut = this.createWalnutMesh();
    walnut.position.y = 0; // On ground surface
    group.add(walnut);

    // Invisible collision sphere for clicking
    const collisionGeometry = new THREE.SphereGeometry(1.0, 8, 8);
    const collisionMaterial = new THREE.MeshBasicMaterial({
      visible: false
    });
    const collisionMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    collisionMesh.position.y = 0;
    group.add(collisionMesh);

    // Hover pulse glow (initially hidden)
    const hoverPulseGeometry = new THREE.SphereGeometry(this.WALNUT_SIZE * 3, 16, 12);
    const hoverPulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xCD853F, // Peru/tan color
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const hoverPulse = new THREE.Mesh(hoverPulseGeometry, hoverPulseMaterial);
    hoverPulse.position.y = 0;
    group.add(hoverPulse);
    group.userData.hoverPulse = hoverPulse;

    // Store references
    group.userData.walnut = walnut;

    // Position the entire group
    group.position.copy(position);
    group.userData.type = 'ground';
    group.userData.points = 1;
    group.userData.clickPosition = new THREE.Vector3(position.x, position.y, position.z);

    return group;
  }

  /**
   * Animate walnuts (glints, pulses, particles)
   */
  private animateWalnuts(delta: number): void {
    for (const [_id, walnutGroup] of this.walnuts) {
      const type = walnutGroup.userData.type;

      if (type === 'bush') {
        // MVP 5: Enhanced glint effect with shimmer/sparkle
        const glint = walnutGroup.userData.glint as THREE.Mesh;
        if (glint) {
          walnutGroup.userData.glintPhase += delta * 3;

          // Pulsing opacity with occasional bright sparkles
          const baseOpacity = 0.25 + Math.sin(walnutGroup.userData.glintPhase) * 0.25;
          const sparkle = Math.sin(walnutGroup.userData.glintPhase * 5) * 0.15;
          const opacity = baseOpacity + Math.max(0, sparkle);
          (glint.material as THREE.MeshBasicMaterial).opacity = Math.max(0, opacity);

          // Subtle scale pulse for shimmer effect
          const scale = 1 + Math.sin(walnutGroup.userData.glintPhase * 1.5) * 0.1;
          glint.scale.set(scale, scale, scale);
        }
      } else if (type === 'game') {
        // MVP 8 FIX: Simple golden walnut animation (just gentle throb on glow, no rotation)
        const throbGlow = walnutGroup.userData.throbGlow as THREE.Mesh;

        if (throbGlow) {
          // Initialize phase if not present
          if (walnutGroup.userData.throbPhase === undefined) {
            walnutGroup.userData.throbPhase = Math.random() * Math.PI * 2;
          }

          walnutGroup.userData.throbPhase += delta * 1.5;

          // Gentle glow throb (opacity only, no size change)
          const opacity = 0.2 + Math.sin(walnutGroup.userData.throbPhase) * 0.15;
          (throbGlow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.05, opacity);
        }
      }
    }

    // MVP 8: Animate bush glows (subtle pulsing effect)
    this.bushGlows.forEach((glowMesh) => {
      // Update pulse phase
      glowMesh.userData.pulsePhase += delta * 1.5;

      // Gentle opacity pulse
      const baseOpacity = glowMesh.userData.baseOpacity || 0.15;
      const pulse = baseOpacity + Math.sin(glowMesh.userData.pulsePhase) * 0.1;
      (glowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, pulse);

      // Subtle scale pulse
      const scale = 1 + Math.sin(glowMesh.userData.pulsePhase * 0.8) * 0.05;
      glowMesh.scale.set(scale, scale, scale);
    });
  }

  /**
   * MVP 3: Initialize minimap
   */
  private initMinimap(): void {
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (this.minimapCanvas) {
      this.minimapContext = this.minimapCanvas.getContext('2d');

      // MVP 5.7: Show minimap when game starts (was hidden on character select)
      const minimapContainer = document.getElementById('minimap');
      if (minimapContainer) {
        minimapContainer.classList.add('visible');
      }
    }
  }

  /**
   * MVP 5: Initialize connection status indicator
   */
  private initConnectionStatus(): void {
    // Create connection status element
    this.connectionStatusElement = document.createElement('div');
    this.connectionStatusElement.id = 'connection-status';
    this.connectionStatusElement.style.position = 'fixed';
    this.connectionStatusElement.style.top = '10px';
    this.connectionStatusElement.style.left = '10px';
    this.connectionStatusElement.style.padding = '8px 12px';
    this.connectionStatusElement.style.borderRadius = '8px';
    this.connectionStatusElement.style.fontSize = '14px';
    this.connectionStatusElement.style.fontWeight = 'bold';
    this.connectionStatusElement.style.zIndex = '1000';
    this.connectionStatusElement.style.transition = 'all 0.3s ease';
    this.connectionStatusElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    document.body.appendChild(this.connectionStatusElement);

    // Set initial status
    this.updateConnectionStatus('disconnected');
  }

  /**
   * MVP 5: Update connection status indicator
   * Only show when disconnected or reconnecting (hide when connected)
   */
  private updateConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    if (!this.connectionStatusElement) return;

    switch (status) {
      case 'connected':
        // Hide indicator when connected (no need to show "Connected")
        this.connectionStatusElement.style.display = 'none';
        break;
      case 'disconnected':
        this.connectionStatusElement.textContent = '● Disconnected';
        this.connectionStatusElement.style.backgroundColor = '#f44336';
        this.connectionStatusElement.style.color = '#ffffff';
        this.connectionStatusElement.style.display = 'block';
        break;
      case 'reconnecting':
        this.connectionStatusElement.textContent = '⟳ Reconnecting...';
        this.connectionStatusElement.style.backgroundColor = '#FF9800';
        this.connectionStatusElement.style.color = '#ffffff';
        this.connectionStatusElement.style.display = 'block';
        break;
    }
  }

  /**
   * MVP 3: Update minimap display - Static north-up orientation
   * North is always at the top, player moves around the map
   */
  private updateMinimap(): void {
    if (!this.minimapContext || !this.minimapCanvas || !this.character) return;

    const ctx = this.minimapContext;
    const size = this.MINIMAP_SIZE;

    // Clear minimap
    ctx.clearRect(0, 0, size, size);

    // Draw background
    ctx.fillStyle = 'rgba(34, 34, 34, 0.95)';
    ctx.fillRect(0, 0, size, size);

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    // Helper function: Convert world coords to minimap coords (static north-up)
    const worldToMinimap = (worldX: number, worldZ: number) => {
      // World center (0, 0) maps to canvas center
      // Scale: MINIMAP_WORLD_SIZE world units = MINIMAP_SIZE pixels
      const scale = size / this.MINIMAP_WORLD_SIZE;

      // Convert world coordinates to minimap pixel coordinates
      // X: -100 to +100 world → 0 to 200 pixels
      // Z: -100 to +100 world → 0 to 200 pixels
      // NOTE: -Z is north (top of screen), +Z is south (bottom)
      const minimapX = (worldX + this.MINIMAP_WORLD_SIZE / 2) * scale;
      const minimapY = (worldZ + this.MINIMAP_WORLD_SIZE / 2) * scale;

      return { x: minimapX, y: minimapY };
    };

    // Draw crosshair at world origin
    const origin = worldToMinimap(0, 0);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(origin.x - 5, origin.y);
    ctx.lineTo(origin.x + 5, origin.y);
    ctx.moveTo(origin.x, origin.y - 5);
    ctx.lineTo(origin.x, origin.y + 5);
    ctx.stroke();

    // Draw landmark trees
    for (const [landmarkId, landmarkPos] of this.landmarks) {
      const pos = worldToMinimap(landmarkPos.x, landmarkPos.z);

      // Only draw if within bounds
      if (pos.x < 0 || pos.x > size || pos.y < 0 || pos.y > size) continue;

      // Determine landmark label and color
      let label = '?';
      let color = '#ffffff';

      if (landmarkId.includes('Origin')) {
        label = 'O';
        color = '#FFD700'; // Gold for origin
      } else if (landmarkId.includes('North')) {
        label = 'N';
        color = '#4CAF50'; // Green for north
      } else if (landmarkId.includes('South')) {
        label = 'S';
        color = '#2196F3'; // Blue for south
      } else if (landmarkId.includes('East')) {
        label = 'E';
        color = '#FF9800'; // Orange for east
      } else if (landmarkId.includes('West')) {
        label = 'W';
        color = '#9C27B0'; // Purple for west
      }

      // Draw landmark circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pos.x, pos.y);
    }

    // Draw remote players
    for (const [_playerId, remotePlayer] of this.remotePlayers) {
      const pos = worldToMinimap(remotePlayer.position.x, remotePlayer.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // MVP 7: Draw NPCs on minimap (cyan/yellow gradient)
    for (const [_npcId, npc] of this.npcs) {
      const pos = worldToMinimap(npc.position.x, npc.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        // Draw gradient circle for NPCs (cyan to yellow)
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 5);
        gradient.addColorStop(0, '#00FFFF'); // Cyan center
        gradient.addColorStop(1, '#FFFF00'); // Yellow edge
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Draw local player
    const playerPos = worldToMinimap(this.character.position.x, this.character.position.z);

    // Player dot
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Player border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw player direction indicator (arrow showing rotation)
    // Player rotation: 0 = facing +Z (south), Math.PI = facing -Z (north)
    // Canvas: rotation 0 = up (north), PI = down (south), -PI/2 = right (east), PI/2 = left (west)
    ctx.save();
    ctx.translate(playerPos.x, playerPos.y);
    ctx.rotate(Math.PI - this.character.rotation.y); // Correct mapping for static north-up minimap

    // Draw direction arrow
    ctx.strokeStyle = '#00ff00';
    ctx.fillStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -10);  // Arrow tip
    ctx.lineTo(-4, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
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

    // MVP 8: Check if player has walnuts to hide (unified inventory)
    if (this.walnutInventory <= 0) {
      return;
    }

    // MVP 5: Play hide sound effect IMMEDIATELY (before heavy VFX work)
    this.audioManager.playSound('hide');

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
    } else {
      // BURY IN GROUND - no bush nearby
      const position = new THREE.Vector3(playerPos.x, terrainY, playerPos.z);
      walnutGroup = this.createBuriedWalnutVisual(position);
      labelText = 'Your Buried Walnut (3 pts)';
      labelColor = '#8B4513';
    }

    // Add to scene and registry
    walnutGroup.userData.ownerId = this.playerId;
    walnutGroup.userData.id = walnutId;
    this.scene.add(walnutGroup);
    this.walnuts.set(walnutId, walnutGroup);

    // Add label for player-hidden walnut
    const label = this.createLabel(labelText, labelColor);
    this.walnutLabels.set(walnutId, label);

    // MVP 8: Decrement unified walnut inventory
    this.walnutInventory--;
    this.updateMobileHideButton(); // Update UI
    this.updateMobileThrowButton(); // Update UI

    // MVP 5: Spawn dirt particles (sound already played at start for instant feedback)
    if (this.vfxManager) {
      this.vfxManager.spawnParticles('dirt', walnutGroup.position, 30);
    }

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
   * MVP 8: Throw walnut at target
   */
  private throwWalnut(): void {
    if (!this.character || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    // Check cooldown
    const now = performance.now();
    if (now - this.lastThrowTime < this.THROW_COOLDOWN) {
      const remaining = Math.ceil((this.THROW_COOLDOWN - (now - this.lastThrowTime)) / 1000);
      this.toastManager.warning(`Throw cooldown: ${remaining}s`);
      return;
    }

    // Check inventory
    if (this.walnutInventory <= 0) {
      this.toastManager.warning('No walnuts to throw!');
      return;
    }

    // INDUSTRY STANDARD: Camera raycast to determine aim point
    // This ensures projectiles go exactly where the camera is looking
    const fromPosition = this.character.position.clone();
    fromPosition.y += 0.5; // Throw from waist height

    // Raycast from camera center forward to find what player is aiming at
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);

    this.raycaster.set(this.camera.position, cameraDirection);
    const throwRange = 20; // Max throw range

    // Raycast against all objects (terrain, players, NPCs, obstacles)
    const intersectObjects: THREE.Object3D[] = [];

    // Add terrain if exists
    if (this.terrain) {
      intersectObjects.push(this.terrain);
    }

    // Add remote players
    this.remotePlayers.forEach((player) => {
      intersectObjects.push(player);
    });

    // Add NPCs
    this.npcs.forEach((npc) => {
      intersectObjects.push(npc);
    });

    const intersects = this.raycaster.intersectObjects(intersectObjects, true);

    // Determine aim point
    let toPosition: THREE.Vector3;
    let targetId: string | undefined = undefined;

    if (intersects.length > 0 && intersects[0].distance <= throwRange) {
      // Hit something - aim at that point
      toPosition = intersects[0].point.clone();

      // Check if we hit a player or NPC for tracking
      let hitObject = intersects[0].object;
      while (hitObject.parent && !(hitObject instanceof THREE.Group)) {
        hitObject = hitObject.parent;
      }

      // Check if it's a remote player
      for (const [id, player] of this.remotePlayers) {
        if (player === hitObject || player.children.includes(hitObject as any)) {
          targetId = id;
          break;
        }
      }

      // Check if it's an NPC
      if (!targetId) {
        for (const [id, npc] of this.npcs) {
          if (npc === hitObject || npc.children.includes(hitObject as any)) {
            targetId = id;
            break;
          }
        }
      }
    } else {
      // Didn't hit anything - aim at max range in camera direction
      toPosition = this.camera.position.clone().add(
        cameraDirection.multiplyScalar(throwRange)
      );

      // Clamp to terrain
      const terrainHeight = getTerrainHeight(toPosition.x, toPosition.z);
      if (toPosition.y < terrainHeight) {
        toPosition.y = terrainHeight + 0.5;
      }
    }

    // Update throw cooldown (optimistic - assume server will accept)
    this.lastThrowTime = now;

    // MVP 8: Play 'attack' animation when throwing - slower for emphasis
    if (this.actions['attack']) {
      const attackAction = this.actions['attack'];
      const normalDuration = attackAction.getClip().duration * 1000; // ms
      attackAction.timeScale = 0.6; // Slow down to 60% speed (67% longer)
      this.playOneShotAnimation('attack', normalDuration * 1.67); // 1/0.6 = 1.67x longer
    }

    // Send throw command to server
    this.sendMessage({
      type: 'player_throw',
      fromPosition: {
        x: fromPosition.x,
        y: fromPosition.y,
        z: fromPosition.z
      },
      toPosition: {
        x: toPosition.x,
        y: toPosition.y,
        z: toPosition.z
      },
      targetId: targetId
    });

    console.log(`🌰 Throw request sent (inventory: ${this.walnutInventory}, target: ${targetId || 'none'})`);
  }

  /**
   * Debug: Teleport to nearest golden walnut for testing
   */
  private teleportToNearestGoldenWalnut(): void {
    if (!this.character) return;

    let nearestGoldenWalnut: THREE.Group | null = null;
    let minDistance = Infinity;

    // Find nearest golden walnut
    for (const [_id, walnutGroup] of this.walnuts) {
      if (walnutGroup.userData.type === 'game') {
        const distance = this.character.position.distanceTo(walnutGroup.position);
        if (distance < minDistance) {
          minDistance = distance;
          nearestGoldenWalnut = walnutGroup;
        }
      }
    }

    if (nearestGoldenWalnut) {
      // Teleport player near the golden walnut (5 units away so they can see it)
      const offset = new THREE.Vector3(5, 0, 5);
      this.character.position.copy(nearestGoldenWalnut.position).add(offset);
      this.character.position.y = 2; // Keep player at proper height
    } else {
    }
  }

  /**
   * MVP 8: Create subtle glow/throb effect on bush containing walnut
   * Helps players discover walnuts hidden in bushes
   */
  private createBushGlow(walnutId: string, walnutPosition: THREE.Vector3): void {
    // Create subtle pulsing sphere at bush location
    const glowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x90EE90, // Light green to match bush/nature
      transparent: true,
      opacity: 0.15, // Very subtle
      blending: THREE.AdditiveBlending
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

    // Position at bush/walnut location, slightly elevated
    glowMesh.position.copy(walnutPosition);
    glowMesh.position.y += 0.5; // Center of bush height

    // Add to scene and track
    this.scene.add(glowMesh);
    this.bushGlows.set(walnutId, glowMesh);

    // Store animation data for pulsing effect
    glowMesh.userData.baseOpacity = 0.15;
    glowMesh.userData.pulsePhase = Math.random() * Math.PI * 2; // Random start phase
  }

  /**
   * MVP 8: Check proximity pickup for walnuts (walk over to collect)
   * Automatically collects walnuts when player is within pickup range
   */
  private checkProximityWalnutPickup(): void {
    if (!this.character) return;

    const PICKUP_RANGE = 1.5; // Distance in units to auto-collect walnut
    const playerPos = this.character.position.clone();
    const now = performance.now();

    // Check each walnut for proximity
    this.walnuts.forEach((walnutGroup, walnutId) => {
      // MVP 8: Skip walnuts where THIS PLAYER is immune (hit by projectile)
      if (walnutGroup.userData.immunePlayerId === this.playerId && walnutGroup.userData.immuneUntil) {
        if (now < walnutGroup.userData.immuneUntil) {
          return; // This player is still immune (was hit), skip this walnut
        }
      }

      // Get walnut position from group
      const walnutPos = walnutGroup.position.clone();

      // Calculate horizontal distance (ignore y to avoid issues with height differences)
      const dx = playerPos.x - walnutPos.x;
      const dz = playerPos.z - walnutPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // If within pickup range, collect it
      if (distance <= PICKUP_RANGE) {
        // Call the existing findWalnut method which handles score and server notification
        this.findWalnut(walnutId, walnutGroup);
      }
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

    // MVP 8: Remove bush glow if it exists
    const bushGlow = this.bushGlows.get(walnutId);
    if (bushGlow) {
      if (bushGlow.geometry) bushGlow.geometry.dispose();
      if (bushGlow.material) {
        if (Array.isArray(bushGlow.material)) {
          bushGlow.material.forEach((mat: any) => mat.dispose());
        } else {
          (bushGlow.material as any).dispose();
        }
      }
      this.scene.remove(bushGlow);
      this.bushGlows.delete(walnutId);
    }

    this.scene.remove(walnutGroup);
    this.walnuts.delete(walnutId);
  }

  /**
   * MVP 5: Handle mouse move for cursor highlighting and hover effects
   */
  private onMouseMove(event: MouseEvent): void {
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

    // Check if hovering over a walnut that's within interaction range
    let hoveringWalnut = false;
    let hoveredWalnutGroup: THREE.Group | null = null;

    if (intersects.length > 0 && this.character) {
      // Find the walnut group that's being hovered
      for (const intersect of intersects) {
        let obj = intersect.object;
        while (obj.parent) {
          if (obj.parent.userData.id && obj.parent.userData.type) {
            const walnutGroup = obj.parent as THREE.Group;
            const walnutPos = walnutGroup.userData.clickPosition || walnutGroup.position;
            const playerPos = this.character.position;
            const distance = playerPos.distanceTo(walnutPos);
            const maxDistance = walnutGroup.userData.type === 'buried' ? 4 : 5;

            // Only show pointer cursor if within interaction range
            if (distance <= maxDistance) {
              hoveringWalnut = true;
              hoveredWalnutGroup = walnutGroup;
            }
            break;
          }
          obj = obj.parent;
        }
        if (hoveringWalnut) break;
      }
    }

    // Update hover effects on all walnuts
    for (const walnutGroup of this.walnuts.values()) {
      const isHovered = walnutGroup === hoveredWalnutGroup;
      const hoverEffect = walnutGroup.userData.hoverRing || walnutGroup.userData.hoverGlow || walnutGroup.userData.hoverPulse;

      if (hoverEffect && hoverEffect.material) {
        // Smoothly fade in/out hover effect
        const targetOpacity = isHovered ? 0.6 : 0;
        const currentOpacity = (hoverEffect.material as THREE.MeshBasicMaterial).opacity;
        const newOpacity = currentOpacity + (targetOpacity - currentOpacity) * 0.1;
        (hoverEffect.material as THREE.MeshBasicMaterial).opacity = newOpacity;
      }
    }

    // Update cursor style
    document.body.style.cursor = hoveringWalnut ? 'pointer' : 'default';
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

    // MVP 8 FIX: Check immunity FIRST (before distance check)
    // Prevents hit players from immediately picking up the walnut that hit them
    if (walnutGroup.userData.immunePlayerId === this.playerId && walnutGroup.userData.immuneUntil) {
      const now = Date.now();
      if (now < walnutGroup.userData.immuneUntil) {
        console.log(`⚠️ Player is immune to walnut ${walnutId} (${Math.round((walnutGroup.userData.immuneUntil - now) / 1000)}s remaining)`);
        return; // Player is still immune, cannot pick up
      }
    }

    // Use clickPosition if available, otherwise use group position
    const walnutPos = walnutGroup.userData.clickPosition || walnutGroup.position;
    const playerPos = this.character.position;

    // Check if player is close enough
    const distance = playerPos.distanceTo(walnutPos);
    const maxDistance = walnutGroup.userData.type === 'buried' ? 4 : 5;

    if (distance > maxDistance) {
      return;
    }

    const points = walnutGroup.userData.points || 1;
    const isOwnWalnut = walnutGroup.userData.ownerId === this.playerId;

    // MVP 5: Play find sound effect IMMEDIATELY (before heavy VFX work)
    if (!isOwnWalnut && points >= 3) {
      this.audioManager.playSound('find');
      // Play bonus bling sound for big finds
      setTimeout(() => this.audioManager.playSound('ui', 'score_pop'), 200);
    } else {
      this.audioManager.playSound('find');
    }

    if (isOwnWalnut) {
      // MVP 8: FOUND YOUR OWN WALNUT - No points, server handles inventory
      // (Server increments walnutInventory and sends inventory_update)

      // MVP 5: Subtle visual feedback for retrieving your own walnut
      if (this.vfxManager) {
        this.vfxManager.spawnParticles('sparkle', walnutPos, 20); // Fewer sparkles than finding others'
      }

      // MVP 5: Toast notification for finding your own walnut
      this.toastManager.info('Found your walnut');
    } else {
      // MVP 8: FOUND SOMEONE ELSE'S WALNUT - Award points, server handles inventory
      this.playerScore += points;
      // (Server increments walnutInventory and sends inventory_update)

      // MVP 5: Visual feedback for scoring (audio already played for instant response)
      if (this.vfxManager && this.character) {
        this.vfxManager.spawnParticles('sparkle', walnutPos, 40);
        // Add confetti particles for celebration
        this.vfxManager.spawnParticles('confetti', walnutPos, points >= 3 ? 60 : 30);
        this.vfxManager.showScorePopup(points, walnutPos);
        this.vfxManager.playerGlow(this.character);

        // Screen shake for big finds (3+ points)
        if (points >= 3) {
          this.vfxManager.screenShake(0.15, 0.4);
        }
      }

      // MVP 5: Toast notification for scoring
      this.toastManager.success(`+${points} points!`);
    }

    // Remove the walnut from the world
    this.removeWalnut(walnutId);

    // MVP 8: Play eating animation (all characters) - block movement for 1 second
    if (this.actions['eat']) {
      console.log('🍽️ Playing eat animation for local player');
      const eatAction = this.actions['eat'];
      const normalDuration = eatAction.getClip().duration * 1000; // ms
      eatAction.timeScale = 1.0; // Normal speed (snappier)

      // MVP 8: Block movement for 1 second during eat animation
      this.isEatingWalnut = true;
      this.velocity.set(0, 0, 0); // Stop current movement

      this.playOneShotAnimation('eat', normalDuration); // Normal duration

      // Clear eating flag after 1 second
      setTimeout(() => {
        this.isEatingWalnut = false;
      }, 1000);
    } else {
      console.warn('⚠️ Eat animation not available for local player!');
    }

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
      return;
    }

    // NOTE: For ground walnuts from hits/misses, the local client transforms the projectile
    // mesh directly. Server broadcasts to OTHER clients who need to create the mesh.
    // No duplicate detection needed since local client reuses projectile mesh.

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

        // MVP 8: Add subtle glow/throb effect on bush containing walnut
        this.createBushGlow(data.walnutId, position);
        break;

      case 'game':
        // Adjust position to terrain level (walnut will be half-buried)
        const terrainHeight = getTerrainHeight(position.x, position.z);
        position.y = terrainHeight;
        walnutGroup = this.createGameWalnutVisual(position);
        labelText = '🌟 Bonus Walnut (5 pts)';
        labelColor = '#FFD700';
        break;

      case 'ground':
        // MVP 8: Dropped walnut from thrown projectile (on ground surface, not buried)
        const groundHeight = getTerrainHeight(position.x, position.z);
        position.y = groundHeight + (this.WALNUT_SIZE / 2); // MVP 8 FIX: Radius offset so bottom touches ground
        walnutGroup = this.createGroundWalnutVisual(position);
        labelText = 'Dropped Walnut (1 pt)';
        labelColor = '#CD853F'; // Peru/tan color
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
    // MVP 5.7: Skip keyboard tutorial on mobile - touch-controls-hint serves as mobile tutorial
    setTimeout(() => {
      if (!this.tutorialShown && !TouchControls.isMobile()) {
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
    // MVP 5: Play UI sound for tutorial next
    this.audioManager.playSound('ui', 'button_click');

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
    // MVP 5: Play UI sound for tutorial close
    this.audioManager.playSound('ui', 'button_click');

    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
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

      // Click outside to dismiss leaderboard (user-requested feature)
      document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;

        // Check if click is outside leaderboard AND outside toggle button
        if (this.leaderboardVisible &&
            !leaderboardDiv.contains(target) &&
            !toggleButton.contains(target)) {
          this.leaderboardVisible = false;
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
    // MVP 6: Show actual username instead of just "You"
    const displayName = this.username ? `You (${this.username})` : 'You';
    const mockData = [
      { playerId: this.playerId, displayName, score: this.playerScore }
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
    const quickChatDiv = document.getElementById('quick-chat');
    const emotesDiv = document.getElementById('emotes');

    // Show UI elements
    if (quickChatDiv) {
      quickChatDiv.classList.remove('hidden');
    } else {
      console.error('❌ Quick chat div not found!');
    }

    if (emotesDiv) {
      emotesDiv.classList.remove('hidden');
    } else {
      console.error('❌ Emotes div not found!');
    }

    // Setup quick chat buttons
    const chatButtons = document.querySelectorAll('.chat-button');
    chatButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const message = (button as HTMLElement).getAttribute('data-message');
        if (message) {
          this.sendChatMessage(message);
        }
      });
    });

    // Setup emote buttons
    const emoteButtons = document.querySelectorAll('.emote-button');
    emoteButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const emote = (button as HTMLElement).getAttribute('data-emote');
        if (emote) {
          this.sendEmote(emote);
        }
      });
    });
  }

  /**
   * Send a chat message (broadcasts to all players)
   */
  private sendChatMessage(message: string): void {
    if (!this.isConnected || !this.websocket) {
      return;
    }

    // MVP 5: Play chat send sound
    this.audioManager.playSound('ui', 'chat_send');

    // Display locally above own character
    this.showChatAboveCharacter(this.playerId, message, true);

    // Send to server to broadcast to all other players
    this.sendMessage({
      type: 'chat_message',
      message: message,
      playerId: this.playerId
    });
  }

  /**
   * Send an emote (triggers character animation, broadcasts to all players)
   */
  private sendEmote(emote: string): void {
    if (!this.isConnected || !this.websocket) {
      return;
    }

    // Prevent emote spam
    if (this.emoteInProgress) {
      return;
    }

    // MVP 5: Play emote send sound
    this.audioManager.playSound('ui', 'emote_send');

    // Play emote animation locally
    this.playEmoteAnimation(emote);

    // Send to server to broadcast to all other players
    this.sendMessage({
      type: 'player_emote',
      emote: emote,
      playerId: this.playerId
    });
  }

  /**
   * Show chat message above a character (floating text label)
   */
  private showChatAboveCharacter(playerId: string, message: string, isLocalPlayer: boolean = false): void {
    // Get character position
    const character = isLocalPlayer ? this.character : this.remotePlayers.get(playerId);
    if (!character) {
      return;
    }

    // MVP 5: Play chat receive sound for remote players
    if (!isLocalPlayer) {
      this.audioManager.playSound('ui', 'chat_receive');
    }

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
    } else {
      console.error('❌ Labels container not found!');
    }

    this.playerChatLabels.set(playerId, label);

    // IMPORTANT: Position the label immediately in screen space
    const labelPos = character.position.clone();
    labelPos.y += 0.5; // Position just above character's head (0.5 units, not 2.5!)
    this.updateLabelPosition(label, labelPos);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const label = this.playerChatLabels.get(playerId);
      if (label && this.labelsContainer) {
        this.labelsContainer.removeChild(label);
        this.playerChatLabels.delete(playerId);
      }
    }, 5000);
  }

  /**
   * MVP 5: Play an emote animation on local character
   * Uses character-specific emoteAnimations mapping (Squirrel-first feature)
   */
  private playEmoteAnimation(emote: string): void {
    if (!this.character || this.emoteInProgress) {
      return;
    }

    this.emoteInProgress = true;

    // Get current character config
    const char = this.characters.find(c => c.id === this.selectedCharacterId);

    // Use character-specific emote animation mapping if available
    let animationName = 'idle'; // Fallback
    if (char?.emoteAnimations && char.emoteAnimations[emote]) {
      animationName = char.emoteAnimations[emote];
    } else {
      // Fallback mapping for legacy characters without emoteAnimations
      const fallbackMap: { [key: string]: string } = {
        'wave': 'walk',
        'point': 'run',
        'celebrate': 'jump'
      };
      animationName = fallbackMap[emote] || 'idle';
    }

    // Play emote animation as one-shot if it exists
    if (this.actions[animationName]) {
      // Get the actual animation duration from the clip
      const action = this.actions[animationName];
      const animDuration = action.getClip().duration * 1000; // Convert to ms

      // Play the animation (will auto-return to idle after its actual duration)
      this.playOneShotAnimation(animationName); // No hardcoded delay!

      // Clear emote flag after the actual animation duration
      setTimeout(() => {
        this.emoteInProgress = false;
      }, animDuration);
    } else {
      // Animation not found, clear flag immediately
      this.emoteInProgress = false;
    }
  }

  /**
   * MVP 5: Play emote animation on remote player
   * Uses character-specific emoteAnimations mapping (Squirrel-first feature)
   */
  private playRemoteEmoteAnimation(playerId: string, emote: string): void {
    const remoteCharacter = this.remotePlayers.get(playerId);
    const remoteActions = this.remotePlayerActions.get(playerId);

    if (!remoteCharacter || !remoteActions) {
      return;
    }

    // MVP 5: Play emote receive sound
    this.audioManager.playSound('ui', 'emote_receive');

    // Set emote flag to prevent network animation updates from overriding
    this.remotePlayerEmotes.set(playerId, true);

    // Get remote player's character config
    const characterId = remoteCharacter.userData.characterId || this.selectedCharacterId;
    const char = this.characters.find(c => c.id === characterId);

    // Use character-specific emote animation mapping if available
    let animationName = 'idle'; // Fallback
    if (char?.emoteAnimations && char.emoteAnimations[emote]) {
      animationName = char.emoteAnimations[emote];
    } else {
      // Fallback mapping for legacy characters without emoteAnimations
      const fallbackMap: { [key: string]: string } = {
        'wave': 'walk',
        'point': 'run',
        'celebrate': 'jump'
      };
      animationName = fallbackMap[emote] || 'idle';
    }
    const newAction = remoteActions[animationName];

    if (!newAction) {
      this.remotePlayerEmotes.delete(playerId);
      return;
    }

    // Stop all current animations first
    Object.values(remoteActions).forEach(action => {
      if (action.isRunning()) {
        action.fadeOut(0.1);
      }
    });

    // Get animation duration for proper timing
    const animDuration = newAction.getClip().duration * 1000; // Convert to ms
    // Use a minimum duration of 1.5 seconds for short animations (makes them more visible)
    const emoteDisplayDuration = Math.max(animDuration * 1.5, 1500);

    // Play emote animation with continuous looping
    // Looping ensures short animations don't look choppy by repeating them
    newAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.1).play();

    // Return to idle after animation display duration
    setTimeout(() => {
      newAction.fadeOut(0.2);
      const idleAction = remoteActions['idle'];
      if (idleAction) {
        idleAction.reset().fadeIn(0.2).play();
      }
      // Clear emote flag to allow network animation updates again
      this.remotePlayerEmotes.delete(playerId);
    }, emoteDisplayDuration);
  }

  // MVP 5: Settings Menu System

  /**
   * Initialize the settings menu system
   */
  private initSettingsMenu(): void {
    const settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
    const settingsOverlay = document.getElementById('settings-overlay') as HTMLDivElement;
    const settingsApply = document.getElementById('settings-apply') as HTMLButtonElement;
    const settingsCancel = document.getElementById('settings-cancel') as HTMLButtonElement;

    // Show settings toggle button when game starts
    if (settingsToggle) {
      settingsToggle.classList.remove('hidden');
    }

    // Tab switching
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabButton = e.target as HTMLButtonElement;
        const tabName = tabButton.getAttribute('data-tab');

        // Remove active class from all tabs and content
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));

        // Add active class to clicked tab and corresponding content
        tabButton.classList.add('active');
        const content = document.getElementById(`${tabName}-tab`);
        if (content) {
          content.classList.add('active');
        }

        // Play UI sound
        this.audioManager.playSound('ui', 'button_click');
      });
    });

    // Volume sliders
    const masterVolume = document.getElementById('master-volume') as HTMLInputElement;
    const sfxVolume = document.getElementById('sfx-volume') as HTMLInputElement;
    const ambientVolume = document.getElementById('ambient-volume') as HTMLInputElement;
    const muteToggle = document.getElementById('mute-toggle') as HTMLInputElement;

    // Update volume displays and AudioManager
    const updateVolume = (type: 'master' | 'sfx' | 'ambient', value: number) => {
      const percentage = Math.round(value);
      const valueSpan = document.getElementById(`${type}-volume-value`);
      if (valueSpan) {
        valueSpan.textContent = `${percentage}%`;
      }
      this.audioManager.setVolume(type, value / 100);
    };

    if (masterVolume) {
      masterVolume.addEventListener('input', (e) => {
        updateVolume('master', parseFloat((e.target as HTMLInputElement).value));
      });
    }

    if (sfxVolume) {
      sfxVolume.addEventListener('input', (e) => {
        updateVolume('sfx', parseFloat((e.target as HTMLInputElement).value));
      });
    }

    if (ambientVolume) {
      ambientVolume.addEventListener('input', (e) => {
        updateVolume('ambient', parseFloat((e.target as HTMLInputElement).value));
      });
    }

    // Mute toggle checkbox
    if (muteToggle) {
      muteToggle.addEventListener('change', (e) => {
        const isMuted = (e.target as HTMLInputElement).checked;
        this.audioManager.setMute(isMuted);
      });
    }

    // Mouse sensitivity slider
    const sensitivitySlider = document.getElementById('mouse-sensitivity') as HTMLInputElement;
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', (e) => {
        const value = parseFloat((e.target as HTMLInputElement).value);
        const valueSpan = document.getElementById('sensitivity-value');
        if (valueSpan) {
          valueSpan.textContent = `${Math.round(value)}%`;
        }
        // Apply sensitivity to controls (value is 25-200, convert to multiplier)
        this.mouseSensitivity = value / 100;
      });
    }

    // Show/hide settings menu
    const showSettings = () => {
      if (settingsOverlay) {
        settingsOverlay.classList.remove('hidden');
        this.audioManager.playSound('ui', 'button_click');
      }
    };

    const hideSettings = () => {
      if (settingsOverlay) {
        settingsOverlay.classList.add('hidden');
        this.audioManager.playSound('ui', 'button_click');
      }
    };

    // Settings toggle button click
    if (settingsToggle) {
      settingsToggle.addEventListener('click', showSettings);
    }

    // Apply button
    if (settingsApply) {
      settingsApply.addEventListener('click', hideSettings);
    }

    // Cancel button
    if (settingsCancel) {
      settingsCancel.addEventListener('click', hideSettings);
    }

    // ESC key to toggle settings
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
          hideSettings();
        } else {
          showSettings();
        }
      }
    });
  }
}