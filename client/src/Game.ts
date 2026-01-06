import * as THREE from 'three';
// Test comment for IDE integration
// Additional test comment for IDE integration
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createTerrain, setTerrainMesh } from './terrain.js';
import { createForestFromServer, bushPositions } from './forest.js';
import { getTerrainHeight } from './terrain.js';
import { AudioManager } from './AudioManager.js';
import { VFXManager } from './VFXManager.js';
import { ProjectileManager } from './ProjectileManager.js'; // MVP 8: Projectile system
import { ToastManager } from './ToastManager.js';
import { BonusOverlay } from './BonusOverlay.js';
import { SettingsManager } from './SettingsManager.js';
import { CollisionSystem } from './CollisionSystem.js';
import { TouchControls } from './TouchControls.js';
import { RankOverlay } from './RankOverlay.js';
import { SkyManager } from './SkyManager.js';
import { EnticementService } from './services/EnticementService.js'; // MVP 16: Signup reminders
import { AuthModal } from './components/AuthModal.js'; // MVP 16: Authentication modal
import { SessionExpiredBanner } from './components/SessionExpiredBanner.js'; // MVP 16: Session expiry
import { isAuthenticated, getCurrentUser } from './services/AuthService.js'; // MVP 16: Auth state checking
import { CharacterRegistry } from './services/CharacterRegistry.js'; // MVP 16: Character availability
import { CharacterGrid } from './components/CharacterGrid.js'; // Character selection grid
import { CharacterPreview3D } from './components/CharacterPreview3D.js'; // MVP 16: 3D character previews
import { AccessoryFactory } from './services/AccessoryFactory.js'; // MVP 17: Visual accessories
import { AccessoryRegistry } from './services/AccessoryRegistry.js'; // MVP 17: Visual accessories

import { TutorialOverlay } from './TutorialOverlay.js';
import { getPlayerTitle, shouldPredatorsTargetPlayer } from '@shared/PlayerRanks';
import { TipsManager } from './TipsManager.js'; // MVP 14: Contextual tips
import { OverlayManager, OverlayPriority } from './OverlayManager.js'; // MVP 14: Overlay queue
import { TipCard } from './TipCard.js'; // MVP 14 Phase 9: Dismissible tips
import { ModeSelectionOverlay } from './ModeSelectionOverlay.js'; // MVP 15: Game Mode Selection
import { WardrobeOverlay } from './WardrobeOverlay.js'; // MVP 17: Wardrobe UI

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
  private textureLoader!: THREE.TextureLoader;
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
  private rotationSpeed = Math.PI / 2.5; // MVP 8: Reduced from Math.PI for easier aiming (72 deg/sec)
  // @ts-ignore - MVP 5: Mouse sensitivity multiplier (0.25-2.0) - ready for future mouse controls
  private mouseSensitivity = 1.0;
  // Note: gravity removed - no longer needed without jump

  // INDUSTRY STANDARD: Asset caching system
  private static gltfLoader = new GLTFLoader(); // Singleton loader
  private static assetCache = new Map<string, THREE.Group>();
  private static animationCache = new Map<string, THREE.AnimationClip>();
  // Note: isJumping removed - jump feature disabled in favor of throwing
  // PHASE 3 CLEANUP: isEatingWalnut and isStunned removed - now handled by animState.blocksMovement
  private characters: Character[] = [];
  public selectedCharacterId = 'squirrel';
  public selectedAccessoryId = localStorage.getItem('selectedAccessoryId') || 'none'; // MVP 17: Load saved accessory

  public sessionToken: string = ''; // MVP 6: Player session token
  public username: string = ''; // MVP 6: Player username
  public turnstileToken: string | null = null; // MVP 7.1: Cloudflare Turnstile bot protection token
  private characterGroundOffset = 0; // Offset from character pivot to feet
  private characterCollisionRadius = 0.3; // MVP 9: Reduced for tighter player collisions (was 0.5)

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
  private settingsManager!: SettingsManager; // MVP 16: Reference to settings manager for UI updates

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

  // PHASE 3.5 CLEANUP: Old animation timing removed - state machine handles all transitions now
  // (lastAnimationChangeTime, animationChangeDelay, lastFlagCheckTime no longer needed)

  // MVP 5: Enhanced character animations (Squirrel-first)
  private lastIdleVariationTime: number = 0;

  // MVP 6: Remote player username labels (Map playerId → HTML label element)
  private remotePlayerNameLabels: Map<string, HTMLElement> = new Map();

  // MVP 9: Health bars for remote players (Map playerId → { container, fill })
  private remotePlayerHealthBars: Map<string, { container: HTMLElement; fill: HTMLElement; }> = new Map();

  // MVP 7: NPC System - AI characters rendered on client
  private npcs: Map<string, THREE.Group> = new Map();
  private npcMixers: Map<string, THREE.AnimationMixer> = new Map();
  private npcActions: Map<string, { [key: string]: THREE.AnimationAction }> = new Map();
  private npcCurrentAnimations: Map<string, string> = new Map(); // Track current animation to prevent unnecessary resets
  private npcNameLabels: Map<string, HTMLElement> = new Map();

  // MVP 9: Health bars for NPCs (Map npcId → { container, fill })
  private npcHealthBars: Map<string, { container: HTMLElement; fill: HTMLElement; }> = new Map();

  // MVP 12: Predator System - AI predators (aerial and ground threats)
  private predators: Map<string, THREE.Group> = new Map();
  private predatorMixers: Map<string, THREE.AnimationMixer> = new Map();
  private predatorActions: Map<string, { [key: string]: THREE.AnimationAction }> = new Map();
  private predatorCurrentAnimations: Map<string, string> = new Map();
  private predatorSoundCooldowns: Map<string, { nearby: number; attack: number }> = new Map();
  private predatorInterpolationBuffers: Map<string, Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; timestamp: number }>> = new Map();
  private npcInterpolationBuffers: Map<string, Array<{ position: THREE.Vector3; quaternion: THREE.Quaternion; timestamp: number }>> = new Map();
  private npcPendingUpdates: Map<string, Array<{ position: any; rotationY: number; animation?: string; velocity?: any; behavior?: string; timestamp: number }>> = new Map();

  // MVP 12: Annoyance bars for wildebeest predators (Map predatorId → { container, fill })
  private wildebeestAnnoyanceBars: Map<string, { container: HTMLElement; fill: HTMLElement; }> = new Map();

  // MVP 9 FIX: Track last combat event timestamp to prevent stale health data from overwriting fresh combat data
  private lastPlayerHealthUpdateTime: Map<string, number> = new Map(); // playerId → timestamp
  private lastNPCHealthUpdateTime: Map<string, number> = new Map(); // npcId → timestamp

  private idleVariationInterval: number = 10000; // 10 seconds between idle variations
  private availableIdleAnimations: string[] = ['idle', 'idle_b', 'idle_c'];
  // PHASE 3 CLEANUP: isPlayingOneShotAnimation removed - now handled by animState.overrideAnimation

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
  private MAX_DELTA_TIME = 1 / 30; // Cap at 30fps to prevent spiral of death

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
  // MVP 12: Track recently planted trees for minimap display (30 second duration)
  private recentTrees: Array<{ x: number; z: number; timestamp: number }> = [];

  // MVP 4: Leaderboard system
  private leaderboardVisible: boolean = false;
  private leaderboardUpdateInterval: number = 0;
  private currentLeaderboardTab: 'weekly' | 'alltime' = 'weekly'; // MVP 9: Default to weekly

  // MVP 4: Chat and Emotes
  private playerChatLabels: Map<string, HTMLElement> = new Map(); // Chat labels for players
  // PHASE 3 CLEANUP: emoteInProgress removed - now handled by animState.overrideAnimation
  private remotePlayerEmotes: Map<string, boolean> = new Map(); // Track which remote players are emoting

  // BEST PRACTICE: Two-Layer Animation State Machine (replaces boolean flags)
  // Priority constants (will be used in Phase 2 migration)
  // @ts-ignore - unused until Phase 2
  private readonly ANIM_PRIORITY_DEAD = 3;
  // @ts-ignore - unused until Phase 2
  private readonly ANIM_PRIORITY_STUN = 2;        // hit, fear
  // @ts-ignore - unused until Phase 2
  private readonly ANIM_PRIORITY_ACTION = 1;      // eat, throw, emote
  // @ts-ignore - unused until Phase 2
  private readonly ANIM_PRIORITY_IDLE_VARIANT = 0; // subtle idle animations

  // Animation state
  private animState = {
    baseAnimation: 'idle',        // Always tracks correct movement animation
    overrideAnimation: null as string | null, // Temporary animation (hit, eat, etc)
    overrideEndTime: null as number | null,   // When override expires (ms)
    overridePriority: -1,         // Priority of current override
    blocksMovement: false         // Whether override blocks input
  };

  // MVP 5: Audio system (passed from main to reuse loaded sounds)
  private audioManager!: AudioManager;

  // MVP 5: Visual effects system
  private vfxManager: VFXManager | null = null;

  // MVP 8: Projectile system (flying walnuts)
  private projectileManager: ProjectileManager | null = null;
  private walnutInventory: number = 0; // Player's walnut count (0-10) - unified for throw/eat/hide
  private readonly MAX_INVENTORY = 10; // Maximum walnuts player can carry (server-side limit)
  private lastThrowTime: number = 0; // For throw cooldown tracking
  private readonly BASE_THROW_COOLDOWN = 1500; // Base cooldown: 1.5 seconds
  private readonly COOLDOWN_INCREMENT = 1000; // Add 1 second per consecutive throw
  private readonly COOLDOWN_RESET_TIME = 5000; // Reset counter after 5s of no throwing
  private consecutiveThrows: number = 0; // Track consecutive throws for progressive cooldown
  private lastInventoryFullMessageTime: number = 0; // Throttle "inventory full" messages
  private readonly INVENTORY_FULL_MESSAGE_COOLDOWN = 2000; // 2 seconds between messages

  // MVP 9: Track tree-dropped walnut IDs (projectileId -> serverWalnutId)
  private treeWalnutProjectiles: Map<string, string> = new Map();

  // MVP 8 Phase 3: Health & Combat system
  private health: number = 100; // Current health (0-100)
  private readonly MAX_HEALTH = 100;
  private readonly REGEN_RATE = 1; // HP per tick
  private readonly REGEN_INTERVAL = 10000; // 10 seconds in milliseconds
  private readonly PROJECTILE_DAMAGE = 20; // Damage from thrown walnut hit
  private readonly COLLISION_DAMAGE = 10; // Damage from player collision
  private readonly COLLISION_DAMAGE_COOLDOWN = 2000; // 2s cooldown between collision damage
  private lastCollisionDamageTime: number = 0;
  private lastRegenTime: number = 0;
  private isDead: boolean = false;
  // MVP 12: Cooldown for "can't eat when dead" message (prevent spam)
  private lastDeadEatMessageTime: number = 0;
  private readonly DEAD_EAT_MESSAGE_COOLDOWN = 3000; // 3 seconds
  // MVP 8: Spawn protection after respawn
  private isInvulnerable: boolean = false;
  private invulnerabilityEndTime: number = 0;
  private readonly SPAWN_PROTECTION_DURATION = 3000; // 3 seconds
  private invulnerabilityMesh: THREE.Mesh | null = null; // Visual effect for invulnerability

  // MVP 8 FIX: Shared walnut model for visual consistency
  private walnutModel: THREE.Group | null = null;
  private readonly WALNUT_SIZE = 0.06; // Unified walnut radius for all types

  // MVP 5: Toast notification system
  private toastManager: ToastManager = new ToastManager();

  // MVP 16: Enticement system for signup reminders
  private enticementService: EnticementService | null = null;

  // MVP 16: Authentication modal
  private authModal: AuthModal | null = null;

  // MVP 16: Death screen enticement - 3D character preview
  private deathEnticementPreview: CharacterPreview3D | null = null;
  private deathCharacterGrid: CharacterGrid | null = null; // Character selection in death overlay


  // MVP 16: Session expired banner
  private sessionExpiredBanner: SessionExpiredBanner | null = null;

  // MVP 16: Initialization guards to prevent double-initialization
  private leaderboardInitialized = false;
  private chatEmotesInitialized = false;
  private settingsInitialized = false;

  // MVP 14: Contextual tips system
  private tipsManager: TipsManager = new TipsManager(); // MVP 14: Use TipsManager instead of direct overlays where suitable

  // MVP 15: Game Modes
  public isCarefree: boolean = false; // Public so ModeSelectionOverlay can access/set it
  private isGameStarted: boolean = false; // Pauses game loop until mode selected


  // MVP 14 Phase 9: Dismissible tip cards (separate from toasts)
  private tipCard: TipCard = new TipCard();

  // MVP 14: Overlay queue manager (prevents conflicts)
  private overlayManager: OverlayManager = new OverlayManager();

  // PERFORMANCE FIX: Cached DOM references and dirty tracking to prevent redundant HUD updates
  private hudElements: {
    walnutCount: HTMLElement | null;
    playerScore: HTMLElement | null;
    playerTitle: HTMLElement | null;
    hideBtn: HTMLButtonElement | null;
    hideCount: HTMLElement | null;
    throwBtn: HTMLButtonElement | null;
    throwCount: HTMLElement | null;
    eatBtn: HTMLButtonElement | null;
    eatCount: HTMLElement | null;
  } = {
      walnutCount: null, playerScore: null, playerTitle: null,
      hideBtn: null, hideCount: null, throwBtn: null, throwCount: null, eatBtn: null, eatCount: null
    };
  private hudLastValues = {
    walnutInventory: -1,
    displayedScore: -1,
    playerTitle: '',
    health: -1
  };

  // MVP 12: Rank overlay system (full-screen announcements)
  private rankOverlay: RankOverlay = new RankOverlay();

  // MVP 14: Tree growing bonus overlay
  private bonusOverlay: BonusOverlay = new BonusOverlay();
  private playerTitleName: string = 'Rookie'; // Current player title name

  // Sky elements system (sun + clouds)
  private skyManager: SkyManager | null = null;

  // Tutorial system ("How to Play" overlay)
  private tutorialOverlay: TutorialOverlay | null = null;

  // MVP 5.5: Collision detection system
  private collisionSystem: CollisionSystem | null = null;

  // MVP 5.7: Touch controls for mobile
  private touchControls: TouchControls | null = null;
  private wasTouchActive: boolean = false; // Track if touch was active last frame

  // MVP 17: Wardrobe Overlay
  private wardrobeOverlay: WardrobeOverlay | null = null;


  async init(canvas: HTMLCanvasElement, audioManager: AudioManager, settingsManager: SettingsManager) {
    try {
      // MVP 5: Set audio manager (reuse from main.ts with preloaded sounds)
      this.audioManager = audioManager;
      this.settingsManager = settingsManager; // MVP 16: Store reference

      // MVP 5: Apply initial mouse sensitivity from settings
      this.mouseSensitivity = settingsManager.getMouseSensitivity();

      // Listen for settings changes
      window.addEventListener('settingsChanged', ((e: CustomEvent) => {
        this.mouseSensitivity = e.detail.mouseSensitivity;
      }) as EventListener);

      // CRITICAL iOS FIX: Add auto-resume listener for AudioContext
      // iOS Safari often suspends AudioContext if not created in direct response to user gesture
      // or if the tab is backgrounded. We need to resume it on any touch interaction.
      const resumeAudio = () => {
        if (Howler.ctx && Howler.ctx.state === 'suspended') {
          Howler.ctx.resume().then(() => {
            console.log('🎵 Game: AudioContext resumed by user interaction');
          });
        }
      };

      window.addEventListener('touchstart', resumeAudio, { passive: true });
      window.addEventListener('click', resumeAudio, { passive: true });
      window.addEventListener('keydown', resumeAudio, { passive: true });

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
      // CRITICAL: Set clear color to forest green to prevent white screen flash
      this.renderer.setClearColor(0x1b5e20); // Matches canvas background-color

      // Texture Loader
      this.textureLoader = new THREE.TextureLoader();

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

      // Set terrain mesh for raycasting-based height sampling
      setTerrainMesh(this.terrain);

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

      // Initialize Sky Manager (sun + clouds)
      this.skyManager = new SkyManager(this.scene, this.textureLoader);
      await this.skyManager.init();

      // MVP 8: Initialize Projectile Manager (with collision system for tree/rock detection)
      this.projectileManager = new ProjectileManager(this.scene, this.vfxManager, this.audioManager, this.collisionSystem);

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

      // MVP 17: Initialize Wardrobe
      this.initWardrobeMenu();

      // Setup multiplayer connection (walnuts will be loaded from server)
      await this.setupMultiplayer();

      // Events
      this.setupEvents();

      // Start debug overlay updates
      this.startDebugUpdates();

      // MVP 16: Initialize authentication modal
      this.authModal = new AuthModal({
        onAuthSuccess: (userData) => {
          console.log('✅ User authenticated:', userData);
          this.handleAuthSuccess(userData);
        },
        onClose: () => {
          console.log('🚪 Auth modal closed');
        }
      });

      // MVP 16: Initialize session expired banner
      this.sessionExpiredBanner = new SessionExpiredBanner({
        onLoginClick: () => {
          this.openLoginModal();
        },
        onDismiss: () => {
          console.log('🚪 Session expired banner dismissed');
        }
      });

      // MVP 16: Start enticement system (passive signup reminders)
      // IMPORTANT: Only passive toasts, no action buttons during gameplay
      this.enticementService = new EnticementService(this.toastManager);
      this.enticementService.start();

      // MVP 15: Initialize Mode Selection Overlay
      new ModeSelectionOverlay((mode) => {
        console.log(`🎮 Game Mode Selected: ${mode}`);
        this.isGameStarted = true;
        this.isCarefree = (mode === 'carefree');

        // Send mode to server
        if (this.isCarefree) {
          this.sendMessage({
            type: 'set_carefree_mode',
            enabled: true
          });
          this.toastManager.info('Carefree Mode: Activated! Relax and enjoy.', 4000);
        } else {
          this.toastManager.info('Standard Mode: Good luck out there!', 3000);
        }

        // Initialize mode indicator in HUD
        this.updateModeIndicator();

        // Play start sound
        this.audioManager.playSound('ui', 'game_start');
      });
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

      // Use local variable to prevent race condition with update loop
      // Don't assign to this.character until fully ready
      const newCharacter = characterModel;
      newCharacter.scale.set(char.scale, char.scale, char.scale);
      newCharacter.position.set(0, 0, 0);
      newCharacter.rotation.y = Math.PI;
      newCharacter.castShadow = true;

      // MVP 5.5: Add local player collision
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          this.playerId,
          newCharacter.position,
          this.characterCollisionRadius // MVP 9: Use calculated radius
        );
      }

      // INDUSTRY STANDARD: Animation mixer on character model
      const newMixer = new THREE.AnimationMixer(newCharacter);

      // INDUSTRY STANDARD: Parallel animation loading with caching and validation
      const animationPromises = Object.entries(char.animations).map(async ([name, path]) => {
        try {
          const clip = await this.loadCachedAnimation(path);
          if (clip) {
            this.actions[name] = newMixer.clipAction(clip);
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

      // MVP 12: Check for failed animations
      const failedAnims = results.filter(r => !r.success).map(r => r.name);
      if (failedAnims.length > 0) {
        console.warn(`⚠️ Failed to load animations: ${failedAnims.join(', ')}`);
      }

      // Validate at least idle animation loaded
      if (!this.actions.idle) {
        console.error('❌ CRITICAL: Idle animation failed to load - character will not function properly');
      }

      // Use model's actual bounding box for accurate ground positioning and collision
      // INDUSTRY STANDARD: Update transforms before calculating bounds
      newCharacter.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(newCharacter);
      const size = box.getSize(new THREE.Vector3());

      // INDUSTRY STANDARD: Ground offset = distance from pivot to feet (no margin needed)
      // Formula: position.y = groundY - box.min.y places feet exactly on ground
      this.characterGroundOffset = -box.min.y;

      // MVP 9: Calculate collision radius based on character size
      // Industry standard: Use 0.35 instead of 0.5 for tighter player collisions
      // 0.5 = cylinder matches bounding box (too loose, includes empty space)
      // 0.35 = tighter fit around actual character mesh (proven in Unity/Three.js games)
      this.characterCollisionRadius = Math.max(size.x, size.z) * 0.35;

      // CRITICAL: Only now assign to class properties and add to scene
      // This prevents the update loop from seeing a half-loaded character at (0,0,0)
      this.character = newCharacter;
      this.mixer = newMixer;
      this.scene.add(this.character);

      // MVP 17: Attach accessory
      await this.attachAccessory(this.character, this.selectedCharacterId, this.selectedAccessoryId);

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
   * BEST PRACTICE: Reset animation state machine to clean state
   * Called when animations get stuck or on major state transitions (respawn, etc)
   */
  private resetAnimationState(): void {
    // MVP 12: Removed non-critical debug log

    // PHASE 3 CLEANUP: Reset state machine (single source of truth)
    this.animState.overrideAnimation = null;
    this.animState.overrideEndTime = null;
    this.animState.overridePriority = -1;
    this.animState.blocksMovement = false;

    // Stop ALL running animations
    for (const action of Object.values(this.actions)) {
      if (action.isRunning()) {
        action.stop();
      }
      // Reset timeScale to prevent stuck slow-motion
      action.timeScale = 1.0;
    }

    // Determine correct animation based on current movement state
    if (this.character && !this.isDead) {
      const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

      let targetAnimation = 'idle';
      if (horizontalSpeed > 0.5) {
        const isRunning = this.keys.has('shift');
        targetAnimation = isRunning ? 'run' : 'walk';
      }

      // Update base animation in state machine
      this.animState.baseAnimation = targetAnimation;

      // Start fresh with correct animation
      if (this.actions[targetAnimation]) {
        const action = this.actions[targetAnimation];
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        this.currentAction = action;
        this.currentAnimationName = targetAnimation;
        // MVP 12: Removed non-critical animation reset completion log
      }
    }
  }

  /**
   * BEST PRACTICE: Request an animation to play (NEW state machine)
   * @param name Animation name
   * @param priority Priority level (higher can interrupt lower, equal priority blocks)
   * @param duration Duration in milliseconds
   * @param blocksMovement Whether this animation blocks movement input
   * @returns true if animation was started, false if blocked by higher/equal priority
   */
  // @ts-ignore - unused until Phase 2 migration
  private requestAnimation(name: string, priority: number, duration: number, blocksMovement: boolean = false): boolean {
    const now = performance.now();

    // Check if we can interrupt current override
    if (this.animState.overrideAnimation !== null) {
      if (priority <= this.animState.overridePriority) {
        // MVP 12: Removed animation blocking debug log
        return false; // Can't interrupt higher or equal priority (prevents spam)
      }
    }

    // Set override
    this.animState.overrideAnimation = name;
    this.animState.overridePriority = priority;
    this.animState.overrideEndTime = now + duration;
    this.animState.blocksMovement = blocksMovement;

    // MVP 12: Removed non-critical animation state change log

    // Actually play the animation
    this.playAnimation(name);
    return true;
  }

  /**
   * BEST PRACTICE: Update animation state machine (called every frame)
   */
  private updateAnimationState(_delta: number): void {
    const now = performance.now();

    // Check if override has expired
    if (this.animState.overrideAnimation !== null && this.animState.overrideEndTime !== null) {
      if (now >= this.animState.overrideEndTime) {
        // MVP 12: Removed animation override expiry debug log

        // Clear override
        this.animState.overrideAnimation = null;
        this.animState.overridePriority = -1;
        this.animState.overrideEndTime = null;
        this.animState.blocksMovement = false;

        // Return to base animation
        this.playAnimation(this.animState.baseAnimation);
      }
    }

    // FINAL FIX: Update base animation, but FREEZE it when movement is blocked
    // When blocksMovement=true, velocity becomes 0, which would incorrectly set baseAnimation='idle'
    // We need to preserve what the player WAS doing before the blocking animation started
    if (this.character && !this.isDead && !this.animState.blocksMovement) {
      const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

      let targetBaseAnimation = 'idle';
      if (horizontalSpeed > 0.5) {
        const isRunning = this.keys.has('shift');
        targetBaseAnimation = isRunning ? 'run' : 'walk';
      }

      // Update base if changed
      if (targetBaseAnimation !== this.animState.baseAnimation) {
        this.animState.baseAnimation = targetBaseAnimation;
        // MVP 12: Removed base animation update debug log

        // Only play immediately if no override active
        if (this.animState.overrideAnimation === null) {
          this.playAnimation(targetBaseAnimation);
        }
        // Otherwise, when override expires (line 637), it will return to this PRESERVED base
      }
    }
  }

  /**
   * BEST PRACTICE: Actually play an animation (low-level helper)
   */
  private playAnimation(name: string): void {
    const action = this.actions[name];
    if (!action) {
      console.warn(`Animation "${name}" not found`);
      return;
    }

    // Stop current
    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.stop();
    }

    // Reset timeScale (prevent stuck slow-motion)
    action.timeScale = 1.0;

    // Configure and play
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    this.currentAction = action;
    this.currentAnimationName = name;
  }

  // PHASE 3 CLEANUP: playOneShotAnimation() removed - replaced by requestAnimation() state machine

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

      // MVP 8 Phase 3: Eat walnut with E key (heal +25 HP)
      if (e.key === 'e' || e.key === 'E') {
        this.eatWalnut();
      }

      // MVP 5: Mute toggle with M key
      if (e.key === 'm' || e.key === 'M') {
        this.audioManager.toggleMute();
      }

      // Debug: Self Destruct with K key
      if (e.key === 'k' || e.key === 'K') {
        this.triggerSelfDestruct();
      }

      // MVP 17: Wardrobe with B key
      if (e.key === 'b' || e.key === 'B') {
        const btn = document.getElementById('wardrobe-toggle');
        if (btn && !btn.classList.contains('hidden')) {
          btn.click();
        }
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

    // Add orientation change listener
    window.addEventListener('orientationchange', () => {
      // Call onResize to update camera and renderer
      this.onResize();

      // Reset touch controls if active
      if (this.touchControls) {
        this.touchControls.onOrientationChange();
      }

      // Clear movement keys to prevent stuck input
      this.keys.clear();
    });
  }

  /**
   * Debug: Trigger self destruct for testing death mechanics
   */
  private triggerSelfDestruct(): void {
    if (this.isDead) return;

    console.log('💥 Self destruct initiated');
    this.takeDamage(1000, 'self_destruct');
  }

  /**
   * MVP 5.7: Initialize mobile action buttons for hiding/throwing walnuts
   * Replaces double-tap gesture with visible, discoverable on-screen buttons
   * Note: Visibility is controlled by CSS media queries, not JavaScript
   */
  private initMobileActionButtons(): void {
    // Hide button - COPY EMOTE BUTTON PATTERN: Simple, always clickable
    const hideButton = document.getElementById('mobile-hide-btn');
    if (hideButton) {
      hideButton.addEventListener('click', () => {
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        this.hideWalnut(); // Function already checks inventory
      });

      // Pulse animation on first load (tutorial hint)
      const hasSeenHideButton = localStorage.getItem('hideButtonSeen');
      if (!hasSeenHideButton) {
        hideButton.classList.add('pulse');
        // Remove pulse after 10 seconds or first pointerdown
        setTimeout(() => {
          hideButton.classList.remove('pulse');
          localStorage.setItem('hideButtonSeen', 'true');
        }, 10000);
        hideButton.addEventListener('pointerdown', () => {
          hideButton.classList.remove('pulse');
          localStorage.setItem('hideButtonSeen', 'true');
        }, { once: true });
      }
    }

    // MVP 8: Wire up throw button - COPY EMOTE BUTTON PATTERN: Simple, always clickable
    const throwButton = document.getElementById('mobile-throw-btn');
    if (throwButton) {
      throwButton.addEventListener('click', () => {
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        this.throwWalnut(); // Function already checks inventory
      });
    }

    // MVP 8 Phase 3: Wire up eat button - COPY EMOTE BUTTON PATTERN: Simple, always clickable
    const eatButton = document.getElementById('mobile-eat-btn');
    if (eatButton) {
      eatButton.addEventListener('click', () => {
        // Haptic feedback on mobile
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        this.eatWalnut(); // Function already checks inventory
      });
    }



    // CRITICAL: Initialize button states immediately (don't wait for server)
    this.updateMobileButtons();
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Additional reset for touch controls
    if (this.touchControls) {
      this.touchControls.onOrientationChange();
    }
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
    if (this.skyManager) {
      this.skyManager.dispose();
    }
    if (this.tutorialOverlay) {
      this.tutorialOverlay.destroy();
      this.tutorialOverlay = null;
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
    let delta = this.lastFrameTime === 0 ? 1 / 60 : currentTime - this.lastFrameTime;
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

    // MVP 15: Game Mode Selection - Logic Split
    // If game started: Update player physics and camera as normal
    // If NOT started: Rotate camera slowly for ambiance, but SKIP player physics
    if (this.isGameStarted) {
      // Update player physics
      // MVP 6: Only update player AND camera after spawn position received (prevents race condition)
      // Don't update camera before spawn position arrives - prevents upside-down flash when character teleports
      if (this.character && this.spawnPositionReceived) {
        this.updatePlayer(delta);
        this.updateCamera();
        // MVP 5.5: Update camera shake effect
        this.updateCameraShake(delta);
      }
    } else {
      // Game NOT started - Idle Camera Animation
      if (this.camera) {
        const idleTime = performance.now() * 0.0001;
        this.camera.position.x = Math.sin(idleTime) * 20;
        this.camera.position.z = Math.cos(idleTime) * 20;
        this.camera.lookAt(0, 5, 0);
      }
    }



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

    // MVP 12: Update Predator animations
    for (const mixer of this.predatorMixers.values()) {
      mixer.update(delta);
    }

    // BEST PRACTICE: Update animation state machine (NEW system)
    this.updateAnimationState(delta);

    // Update remote player interpolation
    this.updateRemotePlayerInterpolation(delta);

    // MVP 7: Update NPC interpolation
    this.updateNPCInterpolation(delta);

    // MVP 12: Update Predator interpolation
    this.updatePredatorInterpolation(delta);

    // MVP 8: Update invulnerability (check expiry and update visual)
    if (this.isInvulnerable && Date.now() >= this.invulnerabilityEndTime) {
      this.isInvulnerable = false;
      this.removeInvulnerabilityEffect();
      // MVP 12: Removed spawn protection expiry log
    }

    // MVP 8: Update invulnerability visual effect
    if (this.isInvulnerable && this.invulnerabilityMesh) {
      this.updateInvulnerabilityEffect(delta);
    }

    // MVP 8: Update projectiles (flying walnuts)
    if (this.projectileManager) {
      // Build entity map for hit detection
      const entities = new Map<string, { position: THREE.Vector3, isInvulnerable?: boolean }>();

      // Add local player (with invulnerability flag)
      if (this.character) {
        entities.set(this.playerId, {
          position: this.character.position.clone(),
          isInvulnerable: this.isInvulnerable
        });
      }

      // Add remote players
      this.remotePlayers.forEach((player, id) => {
        entities.set(id, { position: player.position.clone() });
      });

      // Add NPCs
      this.npcs.forEach((npc, id) => {
        entities.set(id, { position: npc.position.clone() });
      });

      // MVP 12: Add wildebeest predators (aerial predators are distracted, not hit)
      this.predators.forEach((predatorMesh, id) => {
        const predatorType = predatorMesh.userData?.type;
        if (predatorType === 'wildebeest') {
          entities.set(id, { position: predatorMesh.position.clone() });
        }
      });

      this.projectileManager.update(delta, entities);
    }

    // MVP 3: Animate walnuts
    this.animateWalnuts(delta);

    // MVP 8: Check proximity pickup for walnuts (walk over to collect)
    this.checkProximityWalnutPickup();

    // MVP 8 Phase 3: Check player collisions for damage
    this.checkPlayerCollisions();

    // MVP 8 Phase 3: Update health (regen system)
    this.updateHealth();

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

    // CRITICAL FIX: Always update HUD, not just during animation
    // This ensures score displays even when not animating (displayedScore === playerScore)
    this.updateWalnutHUD();

    // MVP 3: Update walnut labels
    this.updateWalnutLabels();

    // MVP 6: Update remote player username labels
    this.updateRemotePlayerNameLabels();

    // MVP 9: Update remote player health bars
    this.updateRemotePlayerHealthBars();

    // MVP 7: Update NPC name labels
    this.updateNPCNameLabels();

    // MVP 9: Update NPC health bars
    this.updateNPCHealthBars();

    // MVP 12: Update wildebeest annoyance bars (proximity-based)
    this.updateWildebeestAnnoyanceBars();

    // MVP 3: Update proximity indicators
    this.updateProximityIndicators();

    // MVP 3: Update minimap
    this.updateMinimap();

    // Update sky elements (sun + clouds)
    if (this.skyManager) {
      this.skyManager.update(delta);
    }

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

    // MIGRATION PHASE 2.5: Only check state machine for movement blocking
    // State machine is now the single source of truth (handles eat, stun, death, etc.)
    if (!this.animState.blocksMovement) {
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

    // PHASE 3.5 CLEANUP: OLD animation watchdog completely removed
    // State machine (updateAnimationState) handles ALL animation transitions now
    // No need for duplicate logic here

    // MVP 5: Idle variation system (Squirrel-first feature)
    // Randomly cycle between idle animations when character is standing still
    // PHASE 3.5: Use state machine for idle variations (IDLE_VARIANT priority)
    const hasOverrideForIdle = this.animState.overrideAnimation !== null;
    if (this.animState.baseAnimation === 'idle' &&
      this.currentAnimationName === 'idle' &&
      !hasOverrideForIdle) {
      const timeSinceLastVariation = performance.now() - this.lastIdleVariationTime;
      if (timeSinceLastVariation >= this.idleVariationInterval) {
        // Filter idle animations that exist in the current character
        const availableIdles = this.availableIdleAnimations.filter(anim => this.actions[anim]);
        if (availableIdles.length > 0) {
          // Pick a random idle animation (including the current one for variety)
          const randomIdle = availableIdles[Math.floor(Math.random() * availableIdles.length)];
          if (randomIdle !== 'idle' && this.actions[randomIdle]) {
            // Get animation duration
            const idleAction = this.actions[randomIdle];
            const duration = idleAction.getClip().duration * 1000; // Convert to ms

            // Use lowest priority (IDLE_VARIANT) - any action can interrupt
            this.requestAnimation(randomIdle, this.ANIM_PRIORITY_IDLE_VARIANT, duration, false);
            this.lastIdleVariationTime = performance.now();

            // No need for old flags - state machine handles everything!
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
    for (const remotePlayer of this.remotePlayers.values()) {
      const distance = playerPos.distanceTo(remotePlayer.position);
      if (distance < COLLISION_RADIUS) {
        // MVP 11: Play collision sound
        this.audioManager.playSound('player', 'player_collision');
        this.triggerBumpEffect();
        this.lastEntityCollisionTime = now;
        return; // Only one collision per update
      }
    }

    // Check collision with NPCs
    for (const npc of this.npcs.values()) {
      const distance = playerPos.distanceTo(npc.position);
      if (distance < COLLISION_RADIUS) {
        // MVP 11: Play collision sound
        this.audioManager.playSound('player', 'player_collision');
        this.triggerBumpEffect();
        this.lastEntityCollisionTime = now;
        return; // Only one collision per update
      }
    }

    // Check collision with Predators (Wildebeest)
    for (const predator of this.predators.values()) {
      const distance = playerPos.distanceTo(predator.position);
      // Wildebeest is larger, so use slightly larger radius
      if (distance < COLLISION_RADIUS * 1.5) {
        // Take damage from predator collision
        this.takeDamage(10, 'predator');
        // Play collision sound
        this.audioManager.playSound('player', 'player_collision');
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
    // FINAL FIX: Use state machine for spin animation (was bypassing and causing stuck animations)
    if (this.actions && this.actions['spin']) {
      const spinAction = this.actions['spin'];
      const duration = spinAction.getClip().duration * 1000; // Convert to ms
      // Use ACTION priority, doesn't block movement (can bump while moving)
      this.requestAnimation('spin', this.ANIM_PRIORITY_ACTION, duration, false);
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

  // MVP 16: Handle seamless authentication success
  private async handleAuthSuccess(userData: any) {
    console.log('✅ Handling auth success seamlessly:', userData);

    // 1. Update local user state
    this.username = userData.username;

    // 2. Reconnect WebSocket to authenticate session
    await this.reconnectWebSocket();

    // 3. Update UI elements

    // Refresh death overlay (toggles sign-up/logged-in views)
    this.showDeathOverlay();

    // Reset death character grid so it re-initializes with new unlocked characters next time it's opened
    if (this.deathCharacterGrid) {
      this.deathCharacterGrid.destroy();
      this.deathCharacterGrid = null;
    }

    const characterGridContainer = document.getElementById('death-character-grid-container');
    const changeCharacterBtn = document.getElementById('death-change-character-btn');

    if (characterGridContainer) {
      characterGridContainer.classList.add('hidden');
    }
    if (changeCharacterBtn) {
      changeCharacterBtn.textContent = 'Change Character';
    }

    // Update main menu profile if visible
    const loginBtn = document.getElementById('login-button');
    const signupBtn = document.getElementById('signup-button');
    const userProfile = document.getElementById('user-profile');

    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      const nameEl = userProfile.querySelector('.profile-username');
      if (nameEl) nameEl.textContent = this.username;
    }

    // Show success message
    this.toastManager.success(`Welcome back, ${this.username}!`);

    // 4. Refresh Settings UI (Account tab)
    if (this.settingsManager) {
      this.settingsManager.refreshAccountInfo();
    }
  }

  // MVP 16: Reconnect WebSocket with new credentials
  private async reconnectWebSocket() {
    console.log('🔄 Reconnecting WebSocket...');

    if (this.websocket) {
      // Remove listeners to prevent auto-reconnect logic from interfering
      this.websocket.onclose = null;
      this.websocket.onerror = null;
      this.websocket.close();
      this.websocket = null;
    }

    // MVP 16 FIX: Clear local state to prevent duplicates (zombie NPCs/players)
    // 1. Clear NPCs
    this.npcs.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.npcs.clear();
    this.npcMixers.clear();
    this.npcActions.clear();
    this.npcCurrentAnimations.clear();
    this.npcNameLabels.forEach((label) => {
      if (label.parentNode) label.parentNode.removeChild(label);
    });
    this.npcNameLabels.clear();
    this.npcHealthBars.forEach((bar) => {
      if (bar.container.parentNode) bar.container.parentNode.removeChild(bar.container);
    });
    this.npcHealthBars.clear();
    this.npcInterpolationBuffers.clear();
    this.npcPendingUpdates.clear();

    // 2. Clear Remote Players
    this.remotePlayers.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.remotePlayers.clear();
    this.remotePlayerMixers.clear();
    this.remotePlayerActions.clear();
    this.remotePlayerNameLabels.forEach((label) => {
      if (label.parentNode) label.parentNode.removeChild(label);
    });
    this.remotePlayerNameLabels.clear();
    this.remotePlayerHealthBars.forEach((bar) => {
      if (bar.container.parentNode) bar.container.parentNode.removeChild(bar.container);
    });
    this.remotePlayerHealthBars.clear();
    this.remotePlayerBuffers.clear();

    // Reset connection attempts
    this.connectionAttempts = 0;

    // Connect again (will pick up new token from localStorage)
    await this.connectWebSocket();
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

    // MVP 16: Include JWT access token for authenticated users (character gating validation)
    const accessToken = localStorage.getItem('auth_access_token');
    const accessTokenParam = accessToken ? `&accessToken=${accessToken}` : '';

    // MVP 6: Include sessionToken and username in WebSocket URL
    const wsUrl = apiUrl.replace('http:', 'ws:').replace('https:', 'wss:') +
      `/ws?squirrelId=${this.playerId}&characterId=${this.selectedCharacterId}&accessoryId=${this.selectedAccessoryId}&sessionToken=${this.sessionToken}&username=${encodeURIComponent(this.username)}${accessTokenParam}${turnstileParam}`;


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
        this.connectionAttempts = 0; // Reset on successful connection
        this.isConnected = true; // MVP 16 FIX: Mark as connected

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
        }
      };

      this.websocket.onerror = () => {
        clearTimeout(connectionTimeout);

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

      // MIGRATION PHASE 2.1: Only include animation if no override is playing (prevents override on remote)
      // Check state machine instead of emoteInProgress flag
      if (this.animState.overrideAnimation === null) {
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

        // MVP 12: Handle initial title data and show welcome message if first join
        if (data.titleId && data.titleName) {
          this.playerTitleName = data.titleName;

          // Show welcome overlay if this is first join
          if (data.isFirstJoin) {
            this.overlayManager.enqueue(
              'welcome',
              OverlayPriority.MEDIUM,
              () => this.rankOverlay.showWelcome(data.titleName),
              3000 // Duration from RankOverlay
            );
          } else {
          }
        } else {
          // Fallback: Calculate title from score if not provided
          const currentTitle = getPlayerTitle(this.playerScore);
          this.playerTitleName = currentTitle.name;
        }

        // MVP 15: Initialize carefree mode from server
        if (typeof data.isCarefree === 'boolean') {
          this.isCarefree = data.isCarefree;
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
        // Simple approach: If we don't have this ID, create it. If we do, skip (echo from server).
        // This is the proven pattern that worked before - no complex duplicate detection needed.
        if (!this.walnuts.has(data.walnutId)) {
          this.createRemoteWalnut({
            walnutId: data.walnutId,
            ownerId: 'game',
            walnutType: 'ground',
            position: data.position,
            points: 1
          });

          // Add settling delay to remote dropped walnuts
          const droppedWalnut = this.walnuts.get(data.walnutId);
          if (droppedWalnut) {
            droppedWalnut.userData.settlingUntil = Date.now() + 500;

            // Legacy immunity (now using settling delay instead)
            if (data.immunePlayerId) {
              droppedWalnut.userData.immunePlayerId = data.immunePlayerId;
              droppedWalnut.userData.immuneUntil = data.immuneUntil;
            }
          }
        }
        break;

      case 'tree_walnut_drop':
        // MVP 9: Tree dropped walnut - spawn at random canopy position, falls straight down with bounce/roll
        if (data.treePosition && data.walnutId && this.projectileManager) {
          // IMPROVED: Randomize both angle AND distance for natural walnut drop pattern
          // Avoids regular circle pattern, simulates realistic tree physics
          const minCanopyOffset = 0.7; // Minimum distance from trunk (avoid walnut obscured by trunk)
          const maxCanopyOffset = 1.5; // Maximum canopy radius (natural variation)
          const canopyOffset = minCanopyOffset + Math.random() * (maxCanopyOffset - minCanopyOffset);
          const randomAngle = Math.random() * Math.PI * 2;
          const spawnPos = new THREE.Vector3(
            data.treePosition.x + Math.cos(randomAngle) * canopyOffset,
            data.treePosition.y, // Canopy height from server
            data.treePosition.z + Math.sin(randomAngle) * canopyOffset
          );

          // Spawn with zero initial velocity - gravity pulls straight down
          const projectileId = this.projectileManager.spawnFallingWalnut(spawnPos, 'game');

          if (projectileId) {
            this.treeWalnutProjectiles.set(projectileId, data.walnutId);
          }
        }
        break;

      case 'tree_grown':
        // MVP 9: Walnut grew into tree - animate growth and add to scene
        if (data.tree && data.walnutId) {
          await this.handleTreeGrowth(data);
        }
        break;

      case 'existing_players':
        if (Array.isArray(data.players)) {
          for (const player of data.players) {
            if (this.validatePlayerData(player) && player.squirrelId !== this.playerId) {
              // MVP 6: Pass username when creating remote player
              this.createRemotePlayer(player.squirrelId, player.position, player.rotationY, player.characterId, player.username, player.accessoryId);
            }
          }
        }
        break;

      case 'player_joined':
        if (this.validatePlayerData(data) && data.squirrelId !== this.playerId) {
          this.createRemotePlayer(data.squirrelId, data.position, data.rotationY, data.characterId, data.username, data.accessoryId);

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
        if (this.validatePlayerData(data)) {
          if (data.squirrelId === this.playerId) {
            // MVP 8: Update local player's server-authoritative score and health
            if (typeof data.score === 'number' && data.score !== this.playerScore) {
              this.playerScore = data.score;
            }
            if (typeof data.health === 'number' && data.health !== this.health) {
              this.health = data.health;
            }
          } else {
            // Remote player update
            this.updateRemotePlayer(data.squirrelId, data.position, data.rotationY, data.animation, data.velocity, data.animationStartTime, data.moveType, data.characterId, data.health, data.accessoryId);
          }
        }
        break;


      case 'hide_rejected':
        // MVP 16: Server rejected hide (e.g. rate limit). Rollback optimistic update.
        if (data.walnutId) {
          console.warn(`⚠️ Hide rejected by server: ${data.reason}`);

          // Remove from local map and scene
          const walnutGroup = this.walnuts.get(data.walnutId);
          if (walnutGroup) {
            this.scene.remove(walnutGroup);
            this.walnuts.delete(data.walnutId);

            // Remove label
            const label = this.walnutLabels.get(data.walnutId);
            if (label) {
              label.remove();
              this.walnutLabels.delete(data.walnutId);
            }

            // Despawn VFX (particles) is not easily reversible, but acceptable minor glitch

            // Notify user
            if (data.reason === 'rate_limit') {
              this.toastManager.error("You're hiding walnuts too fast! Slow down.", 3000);
            } else if (data.reason === 'no_walnuts') {
              this.toastManager.error("You don't have any walnuts!", 3000);
            }
          }
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
        if (data.npc && data.npc.id) {
          this.createNPC(data.npc.id, data.npc.position, data.npc.rotationY, data.npc.characterId, data.npc.username, data.npc.animation);
        } else {
        }
        break;

      case 'npc_update':
        // MVP 7: NPC position/animation update from server (legacy single update)
        if (data.npcId) {
          this.updateNPC(data.npcId, data.position, data.rotationY, data.animation, data.velocity, data.behavior, data.health, data.accessoryId);
        }
        break;

      case 'npc_updates_batch':
        // MVP 7.1: Batched NPC updates (all NPCs in single message for efficiency)
        if (data.npcs && Array.isArray(data.npcs)) {
          for (const npcData of data.npcs) {
            this.updateNPC(npcData.npcId, npcData.position, npcData.rotationY, npcData.animation, npcData.velocity, npcData.behavior, npcData.health, npcData.accessoryId);
          }
        }
        break;

      case 'npc_despawned':
        // MVP 7: NPC despawned on server, remove from client
        if (data.npcId) {
          this.removeNPC(data.npcId);
        }
        break;

      case 'predators_update':
        // MVP 12: Predator system - batch update for all predators
        this.updatePredators(data.predators);
        break;

      case 'predator_annoyance_update':
        // MVP 12: Update wildebeest annoyance bar
        if (data.predatorId && typeof data.annoyanceLevel === 'number') {
          this.updateWildebeestAnnoyanceBar(data.annoyanceLevel, data.fleeing || false);
        }
        break;

      case 'predators_distracted':
        // MVP 12: Birds distracted by walnut throw
        if (data.predatorIds && Array.isArray(data.predatorIds) && data.predatorIds.length > 0) {
          // Play audio feedback for successful distraction
          this.audioManager.playSound('combat', 'flying_predator_nearby');
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
          // Update all UI displays
          this.updateMobileButtons();
          this.updateWalnutHUD();
        }
        break;

      case 'health_update':
        // Server sends health updates on reconnect/sync
        if (data.playerId === this.playerId && typeof data.health === 'number') {
          this.health = data.health;
          this.updateHealthUI();
        }
        break;

      case 'score_update':
        // MVP 8: Direct score update from server (real-time HUD sync)
        if (typeof data.score === 'number') {
          this.playerScore = data.score;
          // Note: HUD will update in next animation frame via updateWalnutHUD()
        }
        break;

      case 'rank_up':
        // MVP 12: Player ranked up!
        if (data.titleName && data.description) {
          this.playerTitleName = data.titleName;

          // MVP 14: Queue rank up overlay (prevents conflicts with bonus overlay)
          this.overlayManager.enqueue(
            'rank_up',
            OverlayPriority.MEDIUM,
            () => this.rankOverlay.showRankUp(data.titleName, data.description),
            3500 // Duration from RankOverlay
          );

          // MVP 14: Show contextual tip on first rank up
          this.showContextualTip('first_rank_up', 'combat');
        }
        break;

      case 'tree_growing_bonus':
        // MVP 14: Player earned tree growing bonus!
        if (typeof data.points === 'number' && typeof data.count === 'number' && data.message) {

          // MVP 14: Queue bonus overlay (prevents conflicts with rank overlay)
          this.overlayManager.enqueue(
            'tree_bonus',
            OverlayPriority.MEDIUM,
            () => this.bonusOverlay.show(data.message, data.points, data.count),
            4000 // Duration from BonusOverlay
          );
        }
        break;

      case 'entity_healed':
        // MVP 8: Someone healed (ate a walnut)
        if (data.playerId && typeof data.healing === 'number' && typeof data.newHealth === 'number') {
          if (data.playerId === this.playerId) {
            // Local player healed - apply server-authoritative health
            this.health = data.newHealth;
            this.updateHealthUI();
          } else {
            // MVP 9 FIX: Remote player or NPC healed - update their health
            const remotePlayer = this.remotePlayers.get(data.playerId);
            if (remotePlayer) {
              remotePlayer.userData.health = data.newHealth;
              // Mark timestamp to prevent stale player_update from overwriting
              this.lastPlayerHealthUpdateTime.set(data.playerId, Date.now());
            }

            const npc = this.npcs.get(data.playerId);
            if (npc) {
              npc.userData.health = data.newHealth;
              // Mark timestamp to prevent stale npc_updates_batch from overwriting
              this.lastNPCHealthUpdateTime.set(data.playerId, Date.now());
            }
          }
        }
        break;

      case 'entity_damaged':
        // MVP 9: Someone took damage from a projectile
        if (data.targetId && typeof data.newHealth === 'number') {
          if (data.targetId === this.playerId) {
            // Local player took damage - apply server-authoritative health
            this.health = data.newHealth;
            this.updateHealthUI();

            // Show visual feedback (blood particles)
            if (this.vfxManager && this.character) {
              this.vfxManager.spawnParticles('sparkle', this.character.position, 15);
            }
          } else {
            // Remote player or NPC took damage - update their health in userData
            const remotePlayer = this.remotePlayers.get(data.targetId);
            if (remotePlayer) {
              remotePlayer.userData.health = data.newHealth;
              // MVP 9 FIX: Mark timestamp to prevent stale player_update from overwriting
              this.lastPlayerHealthUpdateTime.set(data.targetId, Date.now());

              // Show blood particles at remote player position
              if (this.vfxManager) {
                this.vfxManager.spawnParticles('sparkle', remotePlayer.position, 15);
              }

              // MVP 9: Show kill notification if local player got the kill
              if (data.newHealth <= 0 && data.attackerId === this.playerId) {
                this.showKillNotification(remotePlayer.userData.username || 'Player');
              }
            }

            const npc = this.npcs.get(data.targetId);
            if (npc) {
              npc.userData.health = data.newHealth;
              // MVP 9 FIX: Mark timestamp to prevent stale npc_updates_batch from overwriting
              this.lastNPCHealthUpdateTime.set(data.targetId, Date.now());

              // Show blood particles at NPC position
              if (this.vfxManager) {
                this.vfxManager.spawnParticles('sparkle', npc.position, 15);
              }

              // MVP 9: Show kill notification if local player got the kill
              if (data.newHealth <= 0 && data.attackerId === this.playerId) {
                this.showKillNotification(npc.userData.username || 'NPC');
              }
            }
          }
        }
        break;

      case 'throw_event':
        // MVP 8: Someone threw a walnut - spawn projectile
        if (data.throwerId && data.fromPosition && data.toPosition) {
          this.handleThrowEvent(data.throwerId, data.fromPosition, data.toPosition, data.targetId);
        }
        break;

      case 'player_death':
        // Server broadcasts when a player dies
        if (data.victimId && data.killerId) {
          // If it's a remote player dying, play their death animation
          if (data.victimId !== this.playerId) {
            const remotePlayer = this.remotePlayers.get(data.victimId);
            if (remotePlayer && this.remotePlayerActions.has(data.victimId)) {
              const actions = this.remotePlayerActions.get(data.victimId);
              if (actions && actions['death']) {
                const deathAction = actions['death'];
                deathAction.reset().setLoop(THREE.LoopOnce, 1).play();
                deathAction.clampWhenFinished = true;
              }
            }

            // Check if it's an NPC dying
            const npc = this.npcs.get(data.victimId);
            if (npc && this.npcActions.has(data.victimId)) {
              const actions = this.npcActions.get(data.victimId);
              if (actions && actions['death']) {
                const deathAction = actions['death'];
                deathAction.reset().setLoop(THREE.LoopOnce, 1).play();
                deathAction.clampWhenFinished = true;
              }
            }
          }
        }
        break;

      case 'player_respawn':
        // MVP 8: Player respawned after death
        if (data.playerId === this.playerId) {
          // Local player respawn - apply server-authoritative state
          if (typeof data.walnutInventory === 'number') {
            this.walnutInventory = data.walnutInventory;
            this.updateWalnutHUD();
            this.updateMobileButtons();
          }
          if (typeof data.health === 'number') {
            this.health = data.health;
            this.updateHealthUI();
          }
        } else {
          // MVP 9 FIX: Remote player respawned - update their health
          const remotePlayer = this.remotePlayers.get(data.playerId);
          if (remotePlayer) {
            if (typeof data.health === 'number') {
              remotePlayer.userData.health = data.health;
              // Mark timestamp so player_update doesn't overwrite immediately
              this.lastPlayerHealthUpdateTime.set(data.playerId, Date.now());
            }

            // FIX: Reset animation state on respawn (prevent stuck death animation)
            const actions = this.remotePlayerActions.get(data.playerId);
            if (actions) {
              const deathAction = actions['death'];
              if (deathAction) {
                deathAction.stop();
                deathAction.reset();
              }
              // Play idle immediately to ensure they stand up
              const idleAction = actions['idle'];
              if (idleAction) {
                idleAction.reset().play();
              }
            }
          }
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

      case 'carefree_mode_updated':
        if (typeof data.isCarefree === 'boolean') {
          this.isCarefree = data.isCarefree;

          // Update UI indicators
          this.updateModeIndicator();
          this.updateScoreDisplay();

          // Show toast message (use custom message if provided)
          if (data.message) {
            this.toastManager.info(data.message, 4000);
          } else if (this.isCarefree) {
            this.toastManager.info('Carefree Mode: Predators will ignore you!');
          } else {
            this.toastManager.info('Carefree Mode: Off. Predators may now target you.');
          }
        }
        break;

      case 'score_restored':
        // Server restored competitive score when exiting Carefree mode
        if (typeof data.score === 'number') {
          this.playerScore = data.score;
          this.updateScoreDisplay();

          if (data.rank) {
            this.playerTitleName = data.rank;
          }

          if (data.message) {
            this.toastManager.success(data.message, 5000);
          }
        }
        break;

      default:
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

  // MVP 17: Helper to attach accessories to characters
  // MVP 17: Helper to attach accessories to characters
  private async attachAccessory(model: THREE.Group, characterId: string, accessoryIdOrJson: string = 'none') {
    // Determine what we're equipping
    let accessoriesToEquip: Record<string, string> = {};

    try {
      if (accessoryIdOrJson && accessoryIdOrJson !== 'none') {
        if (accessoryIdOrJson.startsWith('{')) {
          accessoriesToEquip = JSON.parse(accessoryIdOrJson);
        } else {
          // Single legacy ID - assume hat for now, or look up type
          const def = AccessoryRegistry.getAccessory(accessoryIdOrJson);
          if (def) {
            accessoriesToEquip[def.type] = accessoryIdOrJson;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse accessory JSON', e);
    }

    // Improved Head Bone finding logic
    let headBone: THREE.Object3D | undefined;
    model.traverse((child) => {
      if (headBone) return;
      const name = child.name.toLowerCase();
      // Common bone names in various rigs
      if (child.type === 'Bone' && (
        name === 'head' ||
        name === 'righead' ||
        name === 'bip001_head' ||
        name === 'mixamorig:head' ||
        name === 'def_head' ||
        name === 'body' ||
        name.includes('head') // Fallback
      )) {
        headBone = child;
      }
    });

    if (!headBone) {
      console.warn(`Could not find head bone for character ${characterId}`);
      return;
    }

    // Process each category we know about
    // const categories = ['hat', 'glasses', 'backpack', 'mask'];

    // 1. Remove obsolete items or items we are about to replace
    // We iterate backwards to safely remove children
    for (let i = headBone.children.length - 1; i >= 0; i--) {
      const child = headBone.children[i];
      if (child.name.startsWith('equipped_accessory_')) {
        const type = child.name.replace('equipped_accessory_', '');

        // If we have a new setting for this type, remove the old one
        // Or if existing setup is different (this handles the "None" case naturally if we pass {hat: 'none'})
        if (accessoriesToEquip[type] !== undefined) {
          headBone.remove(child);
        }
      } else if (child.name === 'equipped_accessory') {
        // Legacy cleanup
        headBone.remove(child);
      }
    }

    // 2. Add new items
    for (const [type, id] of Object.entries(accessoriesToEquip)) {
      if (id === 'none') continue;

      const accessory = await AccessoryFactory.createAccessory(id);
      if (accessory) {
        accessory.name = `equipped_accessory_${type}`;
        const offsets = AccessoryRegistry.getOffset(characterId, id);
        accessory.position.set(offsets.position.x, offsets.position.y, offsets.position.z);
        accessory.rotation.set(offsets.rotation.x, offsets.rotation.y, offsets.rotation.z);
        accessory.scale.setScalar(offsets.scale);
        headBone.add(accessory);
      }
    }
  }

  private async createRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, characterId?: string, username?: string, accessoryId: string = 'none'): Promise<void> {
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
        return;
      }

      const remoteCharacter = await this.loadCachedAsset(char.modelPath);
      if (!remoteCharacter) {
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
            return { name, success: false };
          }
        } catch (error) {
          return { name, success: false };
        }
      });

      await Promise.all(remoteAnimationPromises);

      // Calculate character bounding box for collision (in bind pose, before animations play)
      // INDUSTRY STANDARD: Update transforms before calculating bounds
      remoteCharacter.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(remoteCharacter);
      const size = box.getSize(new THREE.Vector3());

      // MVP 9: Calculate collision radius (same formula as local player)
      const collisionRadius = Math.max(size.x, size.z) * 0.35;

      // INDUSTRY STANDARD: Ground offset = distance from pivot to feet (no margin)
      // Formula: position.y = groundY - box.min.y places feet exactly on ground
      const remoteGroundOffset = -box.min.y;

      // Store character metadata in userData
      remoteCharacter.userData.characterId = remoteCharacterId;
      remoteCharacter.userData.collisionRadius = collisionRadius;
      remoteCharacter.userData.size = size;
      remoteCharacter.userData.groundOffset = remoteGroundOffset;

      // MVP 17: Attach accessory
      await this.attachAccessory(remoteCharacter, remoteCharacterId, accessoryId);

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

      // MVP 9: Create health bar for remote player
      const healthBar = this.createHealthBar();
      this.remotePlayerHealthBars.set(playerId, healthBar);
      // Store initial health in userData (will be updated by player_update messages)
      remoteCharacter.userData.health = 100; // Default to full health
      remoteCharacter.userData.maxHealth = 100;

      // MVP 5.5: Add remote player collision with proper radius
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          playerId,
          remoteCharacter.position,
          collisionRadius
        );
      }
    } catch (error) {
    }
  }

  private updateRemotePlayer(playerId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; y: number; z: number }, animationStartTime?: number, _moveType?: string, _characterId?: string, health?: number, accessoryId?: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      // MVP 9 FIX: Only update health if no recent combat event (prevents stale data from overwriting fresh combat data)
      if (typeof health === 'number') {
        const lastCombatTime = this.lastPlayerHealthUpdateTime.get(playerId) || 0;
        const timeSinceCombat = Date.now() - lastCombatTime;
        const COMBAT_COOLDOWN = 1000; // 1 second cooldown after combat events

        if (timeSinceCombat > COMBAT_COOLDOWN) {
          // Safe to sync health (no recent combat or initial sync)
          remotePlayer.userData.health = health;
        }
        // Otherwise ignore stale health data from player_update
      }

      // MVP 17: Update accessory if changed
      if (accessoryId && accessoryId !== 'none' && remotePlayer.userData.accessoryId !== accessoryId) {
        remotePlayer.userData.accessoryId = accessoryId;
        const cId = remotePlayer.userData.characterId || this.selectedCharacterId;
        this.attachAccessory(remotePlayer, cId, accessoryId);
      }

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
   * MVP 12: Buffered interpolation for Predators (Source Engine style)
   */
  private updatePredatorInterpolation(_deltaTime: number): void {
    const currentTime = Date.now();
    const renderTime = currentTime - this.INTERPOLATION_DELAY;

    for (const [predatorId, buffer] of this.predatorInterpolationBuffers) {
      const predator = this.predators.get(predatorId);
      if (!predator || buffer.length < 1) continue;

      // Single state - smoothly move toward it
      if (buffer.length === 1) {
        const state = buffer[0];
        const distance = predator.position.distanceTo(state.position);

        if (distance < 0.01) {
          predator.position.copy(state.position);
          predator.quaternion.copy(state.quaternion);
        } else {
          const alpha = Math.min(1, _deltaTime * 10);
          predator.position.lerp(state.position, alpha);
          predator.quaternion.slerp(state.quaternion, alpha);
        }

        // Apply terrain clamping (industry standard)
        const isAerial = predator.userData.isAerial;
        if (isAerial) {
          // Aerial: Clamp above terrain (Warcraft 3/StarCraft 2 style)
          const terrainY = this.getTerrainHeightAtPosition(predator.position.x, predator.position.z);
          const minHeight = terrainY + 1.0;
          if (predator.position.y < minHeight) {
            predator.position.y = minHeight;
          }
        } else {
          // Ground: Position on terrain (raycasting like NPCs)
          predator.position.y = this.positionRemotePlayerOnGround(predator, predator.position.x, predator.position.z);
        }

        // Update collision position
        if (this.collisionSystem) {
          this.collisionSystem.updateColliderPosition(predatorId, predator.position);
        }
        continue;
      }

      // Find two states to interpolate between
      let fromState = buffer[0];
      let toState = buffer[1];

      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i].timestamp <= renderTime && buffer[i + 1].timestamp >= renderTime) {
          fromState = buffer[i];
          toState = buffer[i + 1];
          break;
        }
      }

      if (renderTime >= buffer[buffer.length - 1].timestamp) {
        fromState = buffer[buffer.length - 2];
        toState = buffer[buffer.length - 1];
      }

      // Calculate interpolation factor
      const timeDelta = toState.timestamp - fromState.timestamp;
      let t = 0;

      if (timeDelta > 0) {
        t = (renderTime - fromState.timestamp) / timeDelta;
        t = Math.max(0, Math.min(1, t));
      }

      // Interpolate position and rotation
      predator.position.lerpVectors(fromState.position, toState.position, t);
      predator.quaternion.slerpQuaternions(fromState.quaternion, toState.quaternion, t);

      // Apply terrain clamping (industry standard for aerial/ground units)
      const isAerial = predator.userData.isAerial;
      if (isAerial) {
        // Aerial: Clamp above terrain to prevent clipping (Warcraft 3/StarCraft 2 style)
        const terrainY = this.getTerrainHeightAtPosition(predator.position.x, predator.position.z);
        const minHeight = terrainY + 1.0;
        if (predator.position.y < minHeight) {
          predator.position.y = minHeight;
        }
      } else {
        // Ground: Position on terrain like NPCs (raycasting)
        predator.position.y = this.positionRemotePlayerOnGround(predator, predator.position.x, predator.position.z);
      }

      // Update collision position
      if (this.collisionSystem) {
        this.collisionSystem.updateColliderPosition(predatorId, predator.position);
      }

      // MVP 16 FIX: Update predator animation based on movement (like NPCs/players)
      // Only for GROUND predators (wildebeest), aerial predators always fly
      if (!isAerial) {
        // Calculate movement speed to determine animation (idle/walk/run)
        const distanceMoved = fromState.position.distanceTo(toState.position);
        const timeDeltaSeconds = timeDelta / 1000; // Convert ms to seconds
        const speed = timeDeltaSeconds > 0 ? distanceMoved / timeDeltaSeconds : 0;

        // Determine animation based on speed (same thresholds as NPCs)
        let animationName = 'idle';
        if (speed > 3.0) {
          animationName = 'run';
        } else if (speed > 0.5) {
          animationName = 'walk';
        }

        // Only switch animation if it changed (prevent unnecessary resets)
        const currentAnimation = this.predatorCurrentAnimations.get(predatorId);
        if (currentAnimation !== animationName) {
          const mixer = this.predatorMixers.get(predatorId);
          const actions = this.predatorActions.get(predatorId);

          if (mixer && actions) {
            const newAction = actions[animationName];
            const oldAction = currentAnimation ? actions[currentAnimation] : null;

            if (newAction) {
              newAction.reset();
              newAction.setLoop(THREE.LoopRepeat, Infinity);
              newAction.clampWhenFinished = false;
              newAction.play();

              // Crossfade from old animation
              if (oldAction && oldAction !== newAction) {
                newAction.crossFadeFrom(oldAction, 0.2, true);
              }

              this.predatorCurrentAnimations.set(predatorId, animationName);
            }
          }
        }
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
        // MVP 9: Dynamic height adjustment based on distance to camera
        const distanceToCamera = this.camera.position.distanceTo(npc.position);
        let nameLabelYOffset = 2.5; // Default position above NPC's head

        // When close to NPC (< 8 units), lower the label for better visibility
        if (distanceToCamera < 8) {
          nameLabelYOffset = 1.2; // Much lower when close
        }

        // Position label above NPC's head (same as players)
        const labelPos = npc.position.clone();
        labelPos.y += nameLabelYOffset;
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

      // MVP 9: Remove health bar
      const healthBar = this.remotePlayerHealthBars.get(playerId);
      if (healthBar && this.labelsContainer) {
        this.labelsContainer.removeChild(healthBar.container);
        this.remotePlayerHealthBars.delete(playerId);
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
  private async createNPC(npcId: string, position: { x: number; y: number; z: number }, rotationY: number, characterId: string, username: string, animation: string, accessoryId?: string): Promise<void> {
    if (this.npcs.has(npcId)) {
      // NPC already exists, just update position
      this.updateNPC(npcId, position, rotationY, animation, undefined, undefined, undefined);
      return;
    }

    // MVP 8: Check if NPC is currently being created (prevent race condition ghost NPCs)
    const loadingKey = `loading_${npcId}`;
    if ((this as any)[loadingKey]) {
      return;
    }

    // Mark as loading to prevent duplicate creation
    (this as any)[loadingKey] = true;

    try {
      // Load character model (same as remote players)
      const char = this.characters.find(c => c.id === characterId);
      if (!char) {
        delete (this as any)[loadingKey]; // Clean up loading flag
        return;
      }

      const npcCharacter = await this.loadCachedAsset(char.modelPath);
      if (!npcCharacter) {
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
            return { name, success: false };
          }
        } catch (error) {
          return { name, success: false };
        }
      });

      await Promise.all(npcAnimationPromises);

      // Calculate character bounding box
      npcCharacter.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(npcCharacter);
      const size = box.getSize(new THREE.Vector3());
      const collisionRadius = Math.max(size.x, size.z) * 0.35; // MVP 9: Same as players
      const npcGroundOffset = -box.min.y;

      // Store metadata
      npcCharacter.userData.username = username; // MVP 9: Store username for kill notifications
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

      // MVP 17: Attach random accessory if provided
      if (accessoryId && accessoryId !== 'none') {
        await this.attachAccessory(npcCharacter, characterId, accessoryId);
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
      } else {
      }

      // MVP 9: Create health bar for NPC
      const healthBar = this.createHealthBar();
      this.npcHealthBars.set(npcId, healthBar);
      // Store initial health in userData (will be updated by npc_update messages)
      npcCharacter.userData.health = 100; // Default to full health
      npcCharacter.userData.maxHealth = 100;


      // Process any pending updates that arrived while NPC was loading
      const pendingQueue = this.npcPendingUpdates.get(npcId);
      if (pendingQueue && pendingQueue.length > 0) {
        for (const update of pendingQueue) {
          this.updateNPC(npcId, update.position, update.rotationY, update.animation, update.velocity, update.behavior, undefined);
        }
        this.npcPendingUpdates.delete(npcId);
      }

      // MVP 8: Clear loading flag after successful creation
      delete (this as any)[loadingKey];
    } catch (error) {
      // MVP 8: Clear loading flag on error
      delete (this as any)[loadingKey];
    }
  }

  /**
   * MVP 7: Update NPC position and animation from server
   */
  private updateNPC(npcId: string, position: { x: number; y: number; z: number }, rotationY: number, animation?: string, velocity?: { x: number; z: number }, behavior?: string, health?: number, accessoryId?: string): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      // MVP 9 FIX: Only update health if no recent combat event (prevents stale data from overwriting fresh combat data)
      if (typeof health === 'number') {
        const lastCombatTime = this.lastNPCHealthUpdateTime.get(npcId) || 0;
        const timeSinceCombat = Date.now() - lastCombatTime;
        const COMBAT_COOLDOWN = 1000; // 1 second cooldown after combat events

        if (timeSinceCombat > COMBAT_COOLDOWN) {
          // Safe to sync health (no recent combat or initial sync)
          npc.userData.health = health;
        }
        // Otherwise ignore stale health data from npc_updates_batch
      }

      // MVP 17: Handle accessory updates
      // Check if accessory changed (or if we never set it)
      if (accessoryId && accessoryId !== 'none' && npc.userData.accessoryId !== accessoryId) {
        npc.userData.accessoryId = accessoryId;
        const charId = npc.userData.characterId || 'squirrel';
        // Fire and forget (it handles async internally)
        this.attachAccessory(npc, charId, accessoryId);
      }

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
            // Stop all animations
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

      // MVP 9: Remove health bar
      const healthBar = this.npcHealthBars.get(npcId);
      if (healthBar && this.labelsContainer) {
        this.labelsContainer.removeChild(healthBar.container);
        this.npcHealthBars.delete(npcId);
      }

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
   * MVP 12: Create predator model and animations
   */
  private async createPredator(predatorId: string, type: string, position: { x: number; y: number; z: number }, rotationY: number): Promise<void> {
    if (this.predators.has(predatorId)) {
      return; // Already exists
    }

    // Prevent race condition
    const loadingKey = `loading_${predatorId}`;
    if ((this as any)[loadingKey]) {
      return;
    }
    (this as any)[loadingKey] = true;

    try {
      // Determine model and animation paths based on type
      const modelPath = `/assets/models/characters/Merged LOD/${type.charAt(0).toUpperCase() + type.slice(1)}_LOD_All.glb`;
      const isAerial = type === 'cardinal' || type === 'toucan';

      // Animation paths
      const animPaths = {
        idle: `/assets/models/characters/Animations/Single/${type.charAt(0).toUpperCase() + type.slice(1)}_Idle_A.glb`,
        fly: `/assets/models/characters/Animations/Single/${type.charAt(0).toUpperCase() + type.slice(1)}_${isAerial ? 'Fly' : 'Run'}.glb`,
        attack: `/assets/models/characters/Animations/Single/${type.charAt(0).toUpperCase() + type.slice(1)}_Attack.glb`,
      };

      // Load model
      const predatorModel = await this.loadCachedAsset(modelPath);
      if (!predatorModel) {
        delete (this as any)[loadingKey];
        return;
      }

      predatorModel.scale.set(1.0, 1.0, 1.0);
      predatorModel.castShadow = true;
      predatorModel.receiveShadow = true;

      // Load animations
      const predatorMixer = new THREE.AnimationMixer(predatorModel);
      const predatorActions: { [key: string]: THREE.AnimationAction } = {};

      const animPromises = Object.entries(animPaths).map(async ([name, path]) => {
        try {
          const clip = await this.loadCachedAnimation(path);
          if (clip) {
            predatorActions[name] = predatorMixer.clipAction(clip);
          }
        } catch (error) {
        }
      });

      await Promise.all(animPromises);

      // Calculate bounding box for collision and ground offset (industry standard)
      predatorModel.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(predatorModel);
      const size = box.getSize(new THREE.Vector3());
      const collisionRadius = Math.max(size.x, size.z) * 0.5;
      const groundOffset = -box.min.y; // Standard: Distance from model origin to feet

      // Store metadata
      predatorModel.userData.type = type;
      predatorModel.userData.collisionRadius = collisionRadius;
      predatorModel.userData.isPredator = true;
      predatorModel.userData.isAerial = isAerial;
      predatorModel.userData.groundOffset = groundOffset;
      predatorModel.userData.size = size;

      // Position predator using industry standard terrain handling
      let finalY;
      if (isAerial) {
        // Aerial units: Use flying height but clamp above terrain (Warcraft 3/StarCraft 2 style)
        const terrainY = this.getTerrainHeightAtPosition(position.x, position.z);
        const minHeight = terrainY + 1.0; // 1 unit clearance above terrain
        finalY = Math.max(position.y, minHeight);
      } else {
        // Ground units: Raycast to terrain like NPCs/players
        finalY = this.positionRemotePlayerOnGround(predatorModel, position.x, position.z);
      }

      predatorModel.position.set(position.x, finalY, position.z);
      predatorModel.rotation.y = rotationY;
      predatorModel.visible = true;

      // Store predator data
      this.predators.set(predatorId, predatorModel);
      this.predatorMixers.set(predatorId, predatorMixer);
      this.predatorActions.set(predatorId, predatorActions);

      // Start with idle animation
      if (predatorActions['idle']) {
        predatorActions['idle'].reset().setLoop(THREE.LoopRepeat, Infinity).play();
        this.predatorCurrentAnimations.set(predatorId, 'idle');
      }

      this.scene.add(predatorModel);

      // MVP 12: Add predator collision
      if (this.collisionSystem) {
        this.collisionSystem.addPlayerCollider(
          predatorId,
          predatorModel.position,
          collisionRadius
        );
      }

      // MVP 12: Create annoyance bar for wildebeest (floating above like NPC health bars)
      if (type === 'wildebeest') {
        const annoyanceBar = this.createAnnoyanceBar();
        this.wildebeestAnnoyanceBars.set(predatorId, annoyanceBar);
        // Store initial annoyance level in userData (will be updated by server messages)
        predatorModel.userData.annoyanceLevel = 0; // 0-4 hits to flee
        predatorModel.userData.fleeing = false;
      }

      delete (this as any)[loadingKey];
    } catch (error) {
      delete (this as any)[loadingKey];
    }
  }

  /**
   * MVP 12: Update all predators from server broadcast
   */
  private updatePredators(predatorsData: any[]): void {
    const currentIds = new Set<string>();
    const now = Date.now();
    const NEARBY_DISTANCE = 20.0; // Distance threshold for "nearby" sounds
    const NEARBY_SOUND_COOLDOWN = 5000; // 5 seconds between "nearby" sounds per predator
    const ATTACK_COOLDOWN = 5000; // 5 seconds cooldown (generous - player can escape)

    // Update or create each predator
    predatorsData.forEach((data: any) => {
      currentIds.add(data.id);

      const predator = this.predators.get(data.id);
      if (!predator) {
        // Create new predator
        this.createPredator(data.id, data.type, data.position, data.rotationY);
      } else {
        // Update existing predator with interpolation buffer (Source Engine style)
        const newQuaternion = new THREE.Quaternion();
        newQuaternion.setFromEuler(new THREE.Euler(0, data.rotationY, 0));
        const newState = {
          position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
          quaternion: newQuaternion.clone(),
          timestamp: now
        };

        // Get or create buffer
        let buffer = this.predatorInterpolationBuffers.get(data.id);
        if (!buffer) {
          buffer = [];
          this.predatorInterpolationBuffers.set(data.id, buffer);
        }

        // Add new state
        buffer.push(newState);

        // Remove old states
        const cutoffTime = newState.timestamp - (this.INTERPOLATION_DELAY + 200);
        while (buffer.length > 2 && buffer[0].timestamp < cutoffTime) {
          buffer.shift();
        }

        // Safety: limit buffer size
        while (buffer.length > this.MAX_BUFFER_SIZE) {
          buffer.shift();
        }

        // MVP 12: Sound effects - Calculate distance to local player
        if (this.character) {
          const dx = data.position.x - this.character.position.x;
          const dz = data.position.z - this.character.position.z;
          const distance = Math.sqrt(dx * dx + dz * dz);

          const isAerial = data.type === 'cardinal' || data.type === 'toucan';

          // Initialize cooldown tracking for this predator
          if (!this.predatorSoundCooldowns.has(data.id)) {
            this.predatorSoundCooldowns.set(data.id, { nearby: 0, attack: 0 });
          }
          const cooldowns = this.predatorSoundCooldowns.get(data.id)!;

          // MVP 12: Play "nearby" sound if:
          // 1. Predator is close
          // 2. Cooldown expired
          // 3. Player is a valid target (Rank > Apprentice) OR override for testing
          // 4. Player is NOT in Carefree mode
          const isTargetable = shouldPredatorsTargetPlayer(this.playerScore) && !this.isCarefree;

          if (isTargetable && distance < NEARBY_DISTANCE && now - cooldowns.nearby > NEARBY_SOUND_COOLDOWN) {
            const soundName = isAerial ? 'flying_predator_nearby' : 'ground_predator_nearby';
            this.audioManager.playSound('combat', soundName);

            // MMO-style threat warning (for players with sound off)
            const predatorName = data.type.charAt(0).toUpperCase() + data.type.slice(1);
            this.toastManager.warning(`⚠️ ${predatorName} nearby!`, 2000);

            // MVP 14: Show contextual tip on first predator encounter
            this.showContextualTip('first_predator', 'combat');

            cooldowns.nearby = now;
          }

          // Predator attack (generous cooldown so player can escape)
          if (data.state === 'attacking' && data.targetId === this.playerId && now - cooldowns.attack > ATTACK_COOLDOWN) {
            const soundName = isAerial ? 'flying_predator_attack' : 'ground_predator_attack';
            this.audioManager.playSound('combat', soundName);
            cooldowns.attack = now;

            // Reuse bump effect (spin + shake + particles) like player collisions
            this.triggerBumpEffect();

            // Additional screen shake for impactful hit
            if (isAerial) {
              // Aerial predators: Steal walnut + 10 HP damage
              if (this.vfxManager) {
                this.vfxManager.screenShake(0.2, 0.4);
              }
              this.toastManager.error('🦅 Aerial Attack! -1 walnut, -10 HP!', 2000);

              // Apply damage
              this.takeDamage(10, data.id);

              // Steal walnut (if player has any)
              if (this.walnutInventory > 0) {
                this.walnutInventory = Math.max(0, this.walnutInventory - 1);
                this.updateWalnutHUD();
                this.updateMobileButtons();
              }
            } else {
              // Ground predators: 30 HP damage (heavier hit)
              if (this.vfxManager) {
                this.vfxManager.screenShake(0.3, 0.6);
              }
              this.toastManager.error('🐃 Wildebeest Attack! -30 HP!', 2000);

              // Apply damage
              this.takeDamage(30, data.id);
            }
          }
        }

        // Update animation based on state
        let targetAnim = 'idle';

        if (data.state === 'attacking') {
          targetAnim = 'attack';
        } else if (data.state === 'targeting' || data.state === 'returning') {
          targetAnim = 'fly'; // 'fly' animation for aerial, 'run' for ground (loaded as 'fly' key)
        } else {
          targetAnim = 'idle';
        }

        // Only change animation if different
        const currentAnim = this.predatorCurrentAnimations.get(data.id);
        if (currentAnim !== targetAnim) {
          const actions = this.predatorActions.get(data.id);
          if (actions && actions[targetAnim]) {
            // Stop all animations
            Object.values(actions).forEach(action => action.stop());
            // Play new animation
            const action = actions[targetAnim];
            if (targetAnim === 'attack') {
              action.reset().setLoop(THREE.LoopOnce, 1).play();
              action.clampWhenFinished = true;
            } else {
              action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
            }
            this.predatorCurrentAnimations.set(data.id, targetAnim);
          }
        }
      }
    });

    // Remove predators that are no longer in the update (despawned)
    const toRemove: string[] = [];
    this.predators.forEach((_, id) => {
      if (!currentIds.has(id)) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => this.removePredator(id));
  }

  /**
   * MVP 12: Remove predator from scene
   */
  private removePredator(predatorId: string): void {
    const predator = this.predators.get(predatorId);
    if (predator) {
      // Clean up geometry and materials
      predator.traverse((child: any) => {
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

      this.scene.remove(predator);
      this.predators.delete(predatorId);
      this.predatorMixers.delete(predatorId);
      this.predatorActions.delete(predatorId);
      this.predatorCurrentAnimations.delete(predatorId);
      this.predatorSoundCooldowns.delete(predatorId);

      // MVP 12: Remove collision
      if (this.collisionSystem) {
        this.collisionSystem.removeCollider(predatorId);
      }

      // MVP 12: Remove wildebeest annoyance bar if it exists
      const annoyanceBar = this.wildebeestAnnoyanceBars.get(predatorId);
      if (annoyanceBar && this.labelsContainer) {
        this.labelsContainer.removeChild(annoyanceBar.container);
        this.wildebeestAnnoyanceBars.delete(predatorId);
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
    }

    // MVP 8: Play attack animation for the thrower (no 'throw' animation, use 'attack')
    // FINAL FIX: Only play for REMOTE players/NPCs
    // Local player animation already handled in throwWalnut() via state machine (line 4910)
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
    }
    // Local player throw animation removed - already played via requestAnimation() in throwWalnut()
  }

  /**
   * MVP 8: Handle projectile hitting an entity
   * This is called when ProjectileManager detects a hit
   */
  private onProjectileHit(data: { projectileId: string; ownerId: string; targetId: string; position: THREE.Vector3; mesh: THREE.Group }): void {

    // MVP 11: Play hit sound
    this.audioManager.playSound('combat', 'walnut_hit');

    // MVP 8: Send hit to server for validation and scoring (only if we're the attacker)
    if (data.ownerId === this.playerId && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: 'player_hit',
        targetId: data.targetId,
        damage: this.PROJECTILE_DAMAGE,
        position: data.position
      });

      // Show local feedback immediately (optimistic)
      this.toastManager.success('HIT!');
    }

    // MVP 8: Apply effects immediately (optimistic) - server will broadcast authoritative damage
    // This provides instant feedback while waiting for server validation
    if (data.targetId === this.playerId) {
      // Client-side optimistic damage (server will send authoritative update)
      this.takeDamage(this.PROJECTILE_DAMAGE, data.ownerId);

      // Visual/audio feedback
      this.triggerHitEffects();

      // Hit animation via state machine
      if (this.actions && this.actions['hit']) {
        const hitAction = this.actions['hit'];
        hitAction.timeScale = 0.65;
        this.velocity.set(0, 0, 0);
        this.requestAnimation('hit', this.ANIM_PRIORITY_STUN, 1500, true);
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

      // MVP 8: Show damage floater on remote player
      // MVP 12: Removed projectile hit debug log
      if (this.vfxManager) {
        const damagePosition = remotePlayer.position.clone();
        damagePosition.y += 2; // Show above player head
        this.vfxManager.showDamageFloater(this.PROJECTILE_DAMAGE, damagePosition);
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

      // MVP 8: Show damage floater on NPC
      // MVP 12: Removed projectile hit debug log
      if (this.vfxManager) {
        const damagePosition = npc.position.clone();
        damagePosition.y += 2; // Show above NPC head
        this.vfxManager.showDamageFloater(this.PROJECTILE_DAMAGE, damagePosition);
      }
    }

    // MVP 12: Check if target is a wildebeest predator
    const predator = this.predators.get(data.targetId);
    if (predator && predator.userData?.type === 'wildebeest') {
      // Send hit to server (only if we're the attacker)
      if (data.ownerId === this.playerId && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'predator_hit',
          predatorId: data.targetId,
          damage: this.PROJECTILE_DAMAGE
        });
      }

      // Play hit animation if available
      if (this.predatorActions.has(data.targetId)) {
        const actions = this.predatorActions.get(data.targetId);
        if (actions && actions['hit']) {
          const hitAction = actions['hit'];
          hitAction.timeScale = 0.65;
          hitAction.reset().setLoop(THREE.LoopOnce, 1).play();
          hitAction.clampWhenFinished = true;
        }
      }

      // MVP 12: Play hit sound
      this.audioManager.playSound('combat', 'walnut_hit');

      // Show damage floater
      if (this.vfxManager) {
        const damagePosition = predator.position.clone();
        damagePosition.y += 3; // Show above wildebeest
        this.vfxManager.showDamageFloater(this.PROJECTILE_DAMAGE, damagePosition);
      }
    }

    // BEST PRACTICE: Transform projectile mesh into pickup walnut (no destroy/recreate)
    const walnutId = `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // MVP 8 FIX: Explicitly set all coordinates (not just Y) to prevent drift at close range
    // At close range with fast projectiles, mesh position must match hit position exactly
    const terrainHeight = getTerrainHeight(data.position.x, data.position.z);
    const finalPosition = new THREE.Vector3(
      data.position.x,
      terrainHeight + (this.WALNUT_SIZE / 2), // Radius offset so bottom touches ground
      data.position.z
    );
    data.mesh.position.copy(finalPosition);

    // Stop spinning animation (projectile was spinning in flight)
    data.mesh.rotation.set(0, 0, 0);

    // Update metadata to convert from projectile to pickup
    data.mesh.userData.id = walnutId;
    data.mesh.userData.ownerId = 'game';
    data.mesh.userData.type = 'ground';
    data.mesh.userData.points = 1;
    data.mesh.userData.clickPosition = data.mesh.position.clone();

    // MVP 8 FIX: Add settling delay so walnut is visible before being pickupable
    // Prevents instant auto-pickup at close range (looks like walnut disappeared)
    data.mesh.userData.settlingUntil = Date.now() + 500; // 0.5 second visual settling time

    // MVP 8: Immunity removed - thrower should be able to pick up (advantage over stunned target)
    // Target is stunned for 1.5s anyway, so they can't pick it up during that time

    // Add to walnuts registry (mesh already in scene from projectile)
    this.walnuts.set(walnutId, data.mesh);

    // Add label
    const label = this.createLabel('Dropped Walnut (1 pt)', '#CD853F');
    this.walnutLabels.set(walnutId, label);

    // Notify server to sync with other clients
    this.sendMessage({
      type: 'spawn_dropped_walnut',
      walnutId: walnutId, // CRITICAL FIX: Send OUR ID so server echoes it back (was missing, caused pickup bug)
      position: {
        x: data.mesh.position.x,
        y: data.mesh.position.y,
        z: data.mesh.position.z
      }
      // No immunity - settling delay handles visual timing instead
    });

    // TODO Phase 3: Apply damage to target
    // TODO Phase 3: Send hit message to server for validation
  }

  /**
   * MVP 8: Handle projectile missing (hit ground)
   * MVP 9: Also handles tree-dropped walnuts (reuses server ID, doesn't notify server)
   * BEST PRACTICE: Transform projectile mesh into pickup walnut (no destroy/recreate)
   */
  private onProjectileMiss(data: { projectileId: string; ownerId: string; position: THREE.Vector3; mesh: THREE.Group }): void {

    // MVP 11: Play miss sound (reuse for tree drops too)
    this.audioManager.playSound('combat', 'walnut_miss');

    // MVP 9: Check if this is a tree walnut (has server-provided ID)
    const isTreeWalnut = this.treeWalnutProjectiles.has(data.projectileId);
    const walnutId = isTreeWalnut
      ? this.treeWalnutProjectiles.get(data.projectileId)!
      : `dropped-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Cleanup tree walnut tracking
    if (isTreeWalnut) {
      this.treeWalnutProjectiles.delete(data.projectileId);
    }

    // CRITICAL FIX: Explicitly set mesh position (same approach as onProjectileHit)
    // This ensures correct positioning for glow/pickup detection
    // Previously relied on ProjectileManager's position, but didn't verify/correct it
    const terrainHeight = getTerrainHeight(data.position.x, data.position.z);
    const finalPosition = new THREE.Vector3(
      data.position.x,
      terrainHeight + (this.WALNUT_SIZE / 2), // Radius offset so bottom touches ground
      data.position.z
    );
    data.mesh.position.copy(finalPosition);

    // Stop spinning animation (projectile was spinning in flight)
    data.mesh.rotation.set(0, 0, 0);

    // Update metadata to convert from projectile to pickup
    data.mesh.userData.id = walnutId;
    data.mesh.userData.ownerId = 'game';
    data.mesh.userData.type = 'ground';
    data.mesh.userData.points = 1;
    data.mesh.userData.clickPosition = data.mesh.position.clone();

    // MVP 8 FIX: Add settling delay for visual feedback (same as hits)
    data.mesh.userData.settlingUntil = Date.now() + 500; // 0.5 second visual settling time

    // No immunity for misses - anyone can pick up after settling delay

    // Add to walnuts registry (mesh already in scene from projectile)
    this.walnuts.set(walnutId, data.mesh);

    // Add label
    const label = this.createLabel('Dropped Walnut (1 pt)', '#CD853F');
    this.walnutLabels.set(walnutId, label);

    // MVP 9: Only notify server for player-thrown walnuts, NOT tree walnuts
    // (Server already knows about tree walnuts, notified all clients)
    if (!isTreeWalnut) {
      this.sendMessage({
        type: 'spawn_dropped_walnut',
        walnutId: walnutId, // Send OUR ID so server echoes it back
        position: {
          x: data.mesh.position.x,
          y: data.mesh.position.y,
          z: data.mesh.position.z
        }
        // No immunity for misses
      });
    }

  }

  /**
   * MVP 8: Handle projectile near-miss (play fear animation)
   * This is called when ProjectileManager detects a near miss
   */
  private onProjectileNearMiss(data: { projectileId: string; ownerId: string; entityId: string; position: THREE.Vector3 }): void {

    // MIGRATION PHASE 2.3: Use state machine for fear animation (STUN priority, doesn't block movement)
    if (data.entityId === this.playerId) {
      // Local player had near miss - slower for emphasis
      if (this.actions && this.actions['fear']) {
        const fearAction = this.actions['fear'];
        const normalDuration = fearAction.getClip().duration * 1000; // ms
        fearAction.timeScale = 0.65; // Slow down to 65% speed (54% longer)
        // Use STUN priority but don't block movement (just visual reaction)
        this.requestAnimation('fear', this.ANIM_PRIORITY_STUN, normalDuration * 1.54, false);
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
   * MVP 8 Phase 3: Apply damage to local player
   */
  private takeDamage(amount: number, attackerId: string): void {
    if (this.isDead) return; // Can't damage dead players
    if (this.isInvulnerable) {
      return; // Invulnerable - no damage taken
    }

    this.health = Math.max(0, this.health - amount);

    // MVP 8: Show damage floater on local player
    if (this.character && this.vfxManager) {
      const damagePosition = this.character.position.clone();
      damagePosition.y += 2; // Show above player head
      this.vfxManager.showDamageFloater(amount, damagePosition);
    }

    // MVP 8: Apply knockback effect (push away from attacker)
    if (this.character) {
      let attackerPos: THREE.Vector3 | null = null;

      // Find attacker position
      const remotePlayer = this.remotePlayers.get(attackerId);
      if (remotePlayer) {
        attackerPos = remotePlayer.position;
      } else {
        const npc = this.npcs.get(attackerId);
        if (npc) {
          attackerPos = npc.position;
        }
      }

      // Apply knockback if attacker found
      if (attackerPos) {
        // Calculate knockback direction (from attacker to victim)
        const knockbackDir = new THREE.Vector3()
          .subVectors(this.character.position, attackerPos)
          .normalize();

        // Apply knockback impulse (2.5 units horizontal, 1.5 units vertical)
        const knockbackStrength = 2.5;
        this.velocity.x += knockbackDir.x * knockbackStrength;
        this.velocity.z += knockbackDir.z * knockbackStrength;
        this.velocity.y += 1.5; // Small upward boost for visual effect

      }
    }

    // Send damage event to server
    this.sendMessage({
      type: 'player_damaged',
      damage: amount,
      attackerId: attackerId,
      health: this.health
    });

    // Check if player died
    if (this.health <= 0) {
      this.onDeath(attackerId);
    }

    // Update health bar UI (will implement later)
    this.updateHealthUI();
  }

  /**
   * MVP 8 Phase 3: Heal local player
   * @param amount - Amount of health to restore
   * @param fromEating - True if healing is from eating a walnut (plays healthboost sound), false for passive regen
   */
  private heal(amount: number, fromEating: boolean = false): void {
    if (this.isDead) return;

    const oldHealth = this.health;
    this.health = Math.min(this.MAX_HEALTH, this.health + amount);
    const actualHeal = this.health - oldHealth;

    if (actualHeal > 0) {
      // MVP 11: Only play health boost sound when eating walnuts, not passive regen
      if (fromEating) {
        this.audioManager.playSound('player', 'health_boost');
      }

      // Send heal event to server
      this.sendMessage({
        type: 'player_healed',
        amount: actualHeal,
        health: this.health
      });

      // Update health bar UI
      this.updateHealthUI();
    }
  }

  /**
   * MVP 8 Phase 3: Update health (regen system)
   */
  private updateHealth(): void {
    if (this.isDead) return;

    const now = Date.now();

    // Health regeneration (every 10 seconds)
    if (now - this.lastRegenTime >= this.REGEN_INTERVAL) {
      this.lastRegenTime = now;

      if (this.health < this.MAX_HEALTH) {
        this.heal(this.REGEN_RATE);
      }
    }
  }

  /**
   * MVP 8 Phase 3: Check for player-to-player collisions and apply damage
   */
  private checkPlayerCollisions(): void {
    if (!this.character || this.isDead) return;

    const now = Date.now();

    // Check cooldown
    if (now - this.lastCollisionDamageTime < this.COLLISION_DAMAGE_COOLDOWN) {
      // DEBUG: Log cooldown status
      const remainingCooldown = this.COLLISION_DAMAGE_COOLDOWN - (now - this.lastCollisionDamageTime);
      if (remainingCooldown > 1000) { // Only log if more than 1s remaining
      }
      return; // Still on cooldown
    }

    // MVP 8 FIX: Increased from 1.0 to 1.5 - collision system prevents < 0.7 distance
    // Players have radius 0.5 each, soft collision allows min 0.7 distance
    // Using 1.5 gives more leeway for damage detection
    const COLLISION_RADIUS = 1.5; // Distance for collision damage
    const playerPos = this.character.position.clone();

    // Check collisions with remote players
    this.remotePlayers.forEach((remotePlayer, playerId) => {
      const distance = playerPos.distanceTo(remotePlayer.position);

      if (distance < COLLISION_RADIUS) {
        // Collision detected! Apply damage
        // MVP 11: Play collision sound
        this.audioManager.playSound('player', 'player_collision');
        this.takeDamage(this.COLLISION_DAMAGE, playerId);
        this.lastCollisionDamageTime = now;


        // Visual feedback
        this.triggerHitEffects();
      }
    });

    // MVP 8 FIX: Also check collisions with NPCs
    this.npcs.forEach((npc, npcId) => {
      const distance = playerPos.distanceTo(npc.position);

      if (distance < COLLISION_RADIUS) {
        // Collision detected! Apply damage
        // MVP 11: Play collision sound
        this.audioManager.playSound('player', 'player_collision');
        this.takeDamage(this.COLLISION_DAMAGE, npcId);
        this.lastCollisionDamageTime = now;


        // Visual feedback
        this.triggerHitEffects();
      }
    });
  }

  /**
   * Track respawn timer for cleanup
   */
  private respawnTimerId: number | null = null;
  private respawnCountdownInterval: number | null = null;
  // MVP 16: Pause control for death screen
  private respawnPaused: boolean = false;
  private respawnTimeRemaining: number = 0;

  /**
   * MVP 16: Handle player death with new death screen
   * Fixed 10-second respawn timer with skip button
   */
  private onDeath(killerId: string): void {

    this.isDead = true;

    // MVP 11: Play death sound
    this.audioManager.playSound('player', 'player_death');

    // Stop all movement
    this.velocity.set(0, 0, 0);

    // MIGRATION PHASE 2.3: Use state machine for death animation (DEAD priority, blocks everything)
    if (this.actions && this.actions['death']) {
      this.requestAnimation('death', this.ANIM_PRIORITY_DEAD, 3000, true);
    }

    // MVP 16: Fixed 10-second respawn timer (gives 8s to interact with overlay after 2s delay)
    const respawnTime = 10000;

    // MVP 16: Show new death overlay
    const deathOverlay = document.getElementById('death-overlay');
    const deathScoreValue = document.getElementById('death-score-value');
    const respawnCountdown = document.getElementById('respawn-countdown');
    const respawnProgressBar = document.getElementById('respawn-progress-bar');

    if (deathOverlay) {
      // Remove hidden class to show overlay
      deathOverlay.classList.remove('hidden');

      // Update score
      if (deathScoreValue) {
        deathScoreValue.textContent = this.playerScore.toString();
      }

      // Countdown with progress bar
      let timeRemaining = respawnTime;
      const updateInterval = 100; // Update every 100ms for smooth progress bar

      this.respawnCountdownInterval = window.setInterval(() => {
        // MVP 16: Skip countdown update if paused
        if (!this.respawnPaused) {
          timeRemaining -= updateInterval;
          this.respawnTimeRemaining = timeRemaining; // Track for pause/resume
          const secondsLeft = Math.ceil(timeRemaining / 1000);
          const progress = (timeRemaining / respawnTime) * 100;

          if (respawnCountdown) {
            respawnCountdown.textContent = secondsLeft.toString();
          }

          if (respawnProgressBar) {
            respawnProgressBar.style.width = `${progress}%`;
          }

          if (timeRemaining <= 0 && this.respawnCountdownInterval) {
            clearInterval(this.respawnCountdownInterval);
            this.respawnCountdownInterval = null;
          }
        }
      }, updateInterval);

      // MVP 16: Wire skip button
      const skipButton = document.getElementById('death-skip-button');
      if (skipButton) {
        skipButton.onclick = () => this.skipRespawn();
      }

      // MVP 16: Wire pause button
      const pauseButton = document.getElementById('death-pause-button');
      if (pauseButton) {
        pauseButton.onclick = () => this.toggleRespawnPause();
      }
      // Reset pause state
      this.respawnPaused = false;
      this.respawnTimeRemaining = respawnTime;

      // MVP 16: Show appropriate overlay content immediately (no delay)
      this.showDeathOverlay();
    }

    // Drop all walnuts at death location
    if (this.walnutInventory > 0 && this.character) {
      const dropPosition = this.character.position.clone();

      this.sendMessage({
        type: 'player_died',
        killerId: killerId,
        position: {
          x: dropPosition.x,
          y: dropPosition.y,
          z: dropPosition.z
        },
        walnuts: this.walnutInventory
      });

      this.walnutInventory = 0;
      this.updateWalnutHUD();
    }

    // Start respawn timer (10 seconds)
    this.respawnTimerId = window.setTimeout(() => {
      this.respawn();
    }, respawnTime);
  }

  /**
   * MVP 16: Skip respawn countdown and respawn immediately
   */
  private skipRespawn(): void {
    // Clear timers
    if (this.respawnTimerId) {
      clearTimeout(this.respawnTimerId);
      this.respawnTimerId = null;
    }
    if (this.respawnCountdownInterval) {
      clearInterval(this.respawnCountdownInterval);
      this.respawnCountdownInterval = null;
    }

    // Respawn immediately
    this.respawn();
  }

  /**
   * MVP 16: Toggle pause/resume for respawn countdown
   */
  private toggleRespawnPause(): void {
    const pauseButton = document.getElementById('death-pause-button');
    if (!pauseButton) return;

    this.respawnPaused = !this.respawnPaused;

    if (this.respawnPaused) {
      // PAUSE: Stop auto-respawn timer
      if (this.respawnTimerId) {
        clearTimeout(this.respawnTimerId);
        this.respawnTimerId = null;
      }
      // Update button text
      pauseButton.innerHTML = 'RESUME';

    } else {
      // RESUME: Restart auto-respawn timer with remaining time
      this.respawnTimerId = window.setTimeout(() => {
        this.respawn();
      }, this.respawnTimeRemaining);
      // Update button text
      pauseButton.innerHTML = 'PAUSE';

    }
  }

  /**
   * MVP 16: Show appropriate death overlay content based on authentication status
   * New unified design: show appropriate content panel within single overlay
   */
  /**
   * MVP 16: Show death overlay with simplified Fun & Free UI
   */
  private showDeathOverlay(): void {
    const deathContentMain = document.getElementById('death-content-main');
    if (deathContentMain) {
      deathContentMain.classList.remove('hidden');
    }

    // TODO: Fetch and update player rank from leaderboard
    const playerRank = document.getElementById('player-rank');
    if (playerRank) {
      // In a real implementation this would fetch from Leaderboard
      playerRank.textContent = '42'; // Placeholder
    }

    // Update score
    const scoreValue = document.getElementById('death-score-value');
    if (scoreValue) {
      scoreValue.textContent = Math.floor(this.playerScore).toString();
    }

    // Initialize unified 3D character preview (Just for fun!)
    this.initDeathEnticementCharacter();

    // Setup "Change Character" button
    const changeCharacterBtn = document.getElementById('death-change-character-btn');
    const characterGridContainer = document.getElementById('death-character-grid-container');

    if (changeCharacterBtn && characterGridContainer) {
      changeCharacterBtn.onclick = () => {
        // Toggle character grid visibility
        const isHidden = characterGridContainer.classList.contains('hidden');

        if (isHidden) {
          // Show character grid
          characterGridContainer.classList.remove('hidden');
          changeCharacterBtn.textContent = '✖️ Close';

          // Auto-pause respawn countdown to give user time to browse
          if (!this.respawnPaused) {
            this.toggleRespawnPause();
          }

          // Initialize CharacterGrid if not already done
          if (!this.deathCharacterGrid) {
            this.deathCharacterGrid = new CharacterGrid(characterGridContainer, {
              selectedCharacterId: this.selectedCharacterId,
              onCharacterSelect: (characterId: string) => {
                // Update selected character
                this.selectedCharacterId = characterId;

                // Save to localStorage
                try {
                  localStorage.setItem('last_character_id', characterId);
                } catch (e) {
                  console.error('Failed to save character preference', e);
                }

                // Update UI visually
                this.updateCharacterSelectionUI();

                // Show toast
                this.toastManager.show('Character selected for next spawn!', { type: 'success' });

                // Trigger respawn with new character
                this.respawnWithNewCharacter(characterId);
              }
            });
          }
        } else {
          // Hide character grid
          characterGridContainer.classList.add('hidden');
          changeCharacterBtn.textContent = 'Change Character';
        }
      };
    }

    this.setupDeathModeSelection();
  }

  /**
   * Update character selection UI (HUD etc)
   */
  private updateCharacterSelectionUI(): void {
    // Placeholder for future UI updates
    // For now, the change is handled by the respawn logic
  }

  /**
   * Setup mode selection buttons in death overlay
   */
  private setupDeathModeSelection(): void {
    const carefreeBtn = document.getElementById('death-mode-carefree');
    const standardBtn = document.getElementById('death-mode-standard');

    if (!carefreeBtn || !standardBtn) return;

    // Set initial active state based on current mode
    if (this.isCarefree) {
      carefreeBtn.classList.add('active');
      standardBtn.classList.remove('active');
    } else {
      standardBtn.classList.add('active');
      carefreeBtn.classList.remove('active');
    }

    // Remove existing listeners
    carefreeBtn.onclick = null;
    standardBtn.onclick = null;

    // Add click handlers
    carefreeBtn.addEventListener('click', () => {
      if (!this.isCarefree) {
        this.requestModeSwitch('carefree', carefreeBtn, standardBtn);
      }
    });

    standardBtn.addEventListener('click', () => {
      if (this.isCarefree) {
        this.requestModeSwitch('standard', standardBtn, carefreeBtn);
      }
    });
  }

  /**
   * Request mode switch with confirmation dialog
   */
  private requestModeSwitch(mode: 'carefree' | 'standard', activeBtn: HTMLElement, inactiveBtn: HTMLElement): void {
    const enteringCarefree = (mode === 'carefree');

    if (enteringCarefree) {
      this.showModeConfirmation(
        'Switch to Carefree Mode?',
        'Your competitive score will be paused. You can return to Standard mode anytime.',
        () => this.executeModeSwitch(mode, activeBtn, inactiveBtn)
      );
    } else {
      this.showModeConfirmation(
        'Return to Standard Mode?',
        'Your competitive score will be restored. Predators will target you again!',
        () => this.executeModeSwitch(mode, activeBtn, inactiveBtn)
      );
    }
  }

  /**
   * Execute the mode switch
   */
  private executeModeSwitch(mode: 'carefree' | 'standard', activeBtn: HTMLElement, inactiveBtn: HTMLElement): void {
    this.isCarefree = (mode === 'carefree');

    // Update button states
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');

    // Send to server
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'set_carefree_mode',
        enabled: this.isCarefree
      }));
    }

    // Update UI (will be handled by server response)
    this.updateModeIndicator();
    this.updateScoreDisplay();
  }

  /**
   * Show mode switch confirmation dialog
   */
  private showModeConfirmation(title: string, message: string, onConfirm: () => void): void {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: rgba(40, 40, 40, 0.98);
      border: 3px solid #FFD700;
      border-radius: 16px;
      padding: 30px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    `;

    dialog.innerHTML = `
      <h2 style="color: #FFD700; margin: 0 0 15px 0;">${title}</h2>
      <p style="color: white; margin-bottom: 25px; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="mode-confirm-yes" style="
          padding: 10px 24px;
          background: #4CAF50;
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
        ">Confirm</button>
        <button id="mode-confirm-no" style="
          padding: 10px 24px;
          background: rgba(255,255,255,0.1);
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 8px;
          color: white;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
        ">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Event listeners
    document.getElementById('mode-confirm-yes')?.addEventListener('click', () => {
      onConfirm();
      overlay.remove();
    });

    document.getElementById('mode-confirm-no')?.addEventListener('click', () => {
      overlay.remove();
    });
  }



  /**
   * MVP 16: Initialize 3D character preview on death screen
   * Shows a random character just for fun/visual appeal
   */
  private async initDeathEnticementCharacter(): Promise<void> {
    // Cleanup any existing preview
    this.cleanupDeathEnticementCharacter();

    // Use unified container ID
    const targetContainerId = 'death-character-preview';

    // Use current character instead of random
    const allCharacters = CharacterRegistry.getAllCharacters();
    const characterToShow = CharacterRegistry.getCharacterById(this.selectedCharacterId) || allCharacters[0];

    if (!characterToShow) return;

    // Initialize 3D preview
    this.deathEnticementPreview = new CharacterPreview3D(
      targetContainerId,
      characterToShow.id,
      {
        rotationSpeed: 0.01,
        autoRotate: true,
        cameraDistance: 2.5,
        showAnimation: true
      }
    );

    // Initialize the preview
    await this.deathEnticementPreview.init();
  }

  /**
   * MVP 16: Cleanup death screen enticement character
   */
  private cleanupDeathEnticementCharacter(): void {
    if (this.deathEnticementPreview) {
      this.deathEnticementPreview.destroy();
      this.deathEnticementPreview = null;
    }
  }

  // Removed unused handleBuyCharacter method




  // Removed unused handleWatchAd method

  /**
   * Respawn with a new character selection
   * Updates the selected character and triggers respawn
   */
  private async respawnWithNewCharacter(characterId: string): Promise<void> {


    // CRITICAL: Clear any existing respawn timers to prevent double-respawn
    if (this.respawnTimerId) {
      clearTimeout(this.respawnTimerId);
      this.respawnTimerId = null;
    }
    if (this.respawnCountdownInterval) {
      clearInterval(this.respawnCountdownInterval);
      this.respawnCountdownInterval = null;
    }

    // Hide death overlay immediately
    const deathOverlay = document.getElementById('death-overlay');
    if (deathOverlay) {
      deathOverlay.classList.add('hidden');
    }

    // Clean up character grid
    if (this.deathCharacterGrid) {
      this.deathCharacterGrid.destroy();
      this.deathCharacterGrid = null;
    }

    // Clean up death enticement preview
    this.cleanupDeathEnticementCharacter();

    // Update selected character ID for next spawn
    this.selectedCharacterId = characterId;

    // Save to localStorage
    try {
      localStorage.setItem('last_character_id', characterId);
    } catch (e) {
      console.error('Failed to save character selection:', e);
    }

    // Remove old character from scene
    if (this.character) {
      this.scene.remove(this.character);
      this.character = null;
    }

    // Reset mixer
    if (this.mixer) {
      this.mixer = null;
    }

    try {
      // Load new character model
      await this.loadCharacter();

      // Don't call respawn() - it causes rotation issues
      // Instead, manually reset health and position
      this.health = this.MAX_HEALTH;
      this.isDead = false;

      // Teleport to random spawn position (same as respawn() does)
      if (this.character) {
        const spawnX = (Math.random() - 0.5) * 300; // -150 to 150
        const spawnZ = (Math.random() - 0.5) * 300; // -150 to 150
        const spawnY = getTerrainHeight(spawnX, spawnZ) + 2; // 2 units above ground

        this.character.position.set(spawnX, spawnY, spawnZ);
        // Explicitly reset rotation to ensure consistent orientation
        this.character.rotation.set(0, Math.PI, 0);
        this.velocity.set(0, 0, 0);

        // Snap camera to new position immediately to prevent "upside down" flips during lerp
        const offset = new THREE.Vector3(0, 0.6, -0.9).applyQuaternion(this.character.quaternion);
        const targetCameraPosition = this.character.position.clone().add(offset);
        this.camera.position.copy(targetCameraPosition);

        const lookAtTarget = this.character.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        this.camera.lookAt(lookAtTarget);

        // Reset animation state
        this.resetAnimationState();

        // Notify server of respawn with new position
        this.sendMessage({
          type: 'player_respawn',
          position: {
            x: this.character.position.x,
            y: this.character.position.y,
            z: this.character.position.z
          }
        });
      }

      // Hide death overlay
      const deathOverlay = document.getElementById('death-overlay');
      if (deathOverlay) {
        deathOverlay.classList.add('hidden');
      }

      // Hide content panels
      const anonymousContent = document.getElementById('death-content-anonymous');
      const signedInContent = document.getElementById('death-content-signedin');
      if (anonymousContent) anonymousContent.classList.add('hidden');
      if (signedInContent) signedInContent.classList.add('hidden');


    } catch (error) {
      console.error('Failed to load new character:', error);

      // On error, just hide overlay and reset health
      this.health = this.MAX_HEALTH;
      this.isDead = false;

      const deathOverlay = document.getElementById('death-overlay');
      if (deathOverlay) {
        deathOverlay.classList.add('hidden');
      }
    }
  }

  /**
   * MVP 16: Respawn player after death
   * Enhanced with random teleport and fade effects
   */
  private respawn(): void {
    // Clear any remaining timers
    if (this.respawnTimerId) {
      clearTimeout(this.respawnTimerId);
      this.respawnTimerId = null;
    }
    if (this.respawnCountdownInterval) {
      clearInterval(this.respawnCountdownInterval);
      this.respawnCountdownInterval = null;
    }

    // Reset health
    this.health = this.MAX_HEALTH;
    this.isDead = false;

    // MVP 8 UX: Teleport to random location (avoid spawn camping)
    if (this.character) {
      // Generate random spawn position within terrain bounds
      const spawnX = (Math.random() - 0.5) * 300; // -150 to 150
      const spawnZ = (Math.random() - 0.5) * 300; // -150 to 150
      const spawnY = getTerrainHeight(spawnX, spawnZ) + 2; // 2 units above ground



      this.character.position.set(spawnX, spawnY, spawnZ);

      // Reset velocity
      this.velocity.set(0, 0, 0);

      // BEST PRACTICE: Use centralized animation reset
      this.resetAnimationState();
    }

    // Request respawn from server (notify server of new position)
    this.sendMessage({
      type: 'player_respawn',
      position: this.character ? {
        x: this.character.position.x,
        y: this.character.position.y,
        z: this.character.position.z
      } : undefined
    });

    // MVP 16: Hide death overlay (unified design)
    const deathOverlay = document.getElementById('death-overlay');
    if (deathOverlay) {
      deathOverlay.classList.add('hidden');
    }

    // Also hide content panels
    const anonymousContent = document.getElementById('death-content-anonymous');
    const signedInContent = document.getElementById('death-content-signedin');
    if (anonymousContent) {
      anonymousContent.classList.add('hidden');
    }
    if (signedInContent) {
      signedInContent.classList.add('hidden');
    }

    // MVP 16: Cleanup death screen enticement character
    this.cleanupDeathEnticementCharacter();

    // MVP 8: Enable spawn protection (3 seconds invulnerability)
    this.isInvulnerable = true;
    this.invulnerabilityEndTime = Date.now() + this.SPAWN_PROTECTION_DURATION;
    this.createInvulnerabilityEffect();

    // Update UI
    this.updateHealthUI();
    this.updateWalnutHUD();
  }

  /**
   * MVP 8: Create invulnerability visual effect (shimmer sphere)
   */
  private createInvulnerabilityEffect(): void {
    if (!this.character || this.invulnerabilityMesh) return; // Already has effect

    // Create transparent shimmering sphere around player
    const geometry = new THREE.SphereGeometry(1.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00FFFF, // Cyan shimmer
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.invulnerabilityMesh = new THREE.Mesh(geometry, material);
    this.invulnerabilityMesh.position.copy(this.character.position);
    this.invulnerabilityMesh.position.y += 1; // Center on player
    this.scene.add(this.invulnerabilityMesh);
  }

  /**
   * MVP 8: Remove invulnerability visual effect
   */
  private removeInvulnerabilityEffect(): void {
    if (this.invulnerabilityMesh) {
      this.scene.remove(this.invulnerabilityMesh);
      this.invulnerabilityMesh.geometry.dispose();
      (this.invulnerabilityMesh.material as THREE.Material).dispose();
      this.invulnerabilityMesh = null;
    }
  }

  /**
   * MVP 8: Update invulnerability effect (call every frame)
   */
  private updateInvulnerabilityEffect(delta: number): void {
    if (!this.invulnerabilityMesh || !this.character) return;

    // Follow player position
    this.invulnerabilityMesh.position.copy(this.character.position);
    this.invulnerabilityMesh.position.y += 1; // Center on player

    // Pulse animation (scale and opacity)
    const time = Date.now() * 0.003; // Slow pulse
    const pulse = Math.sin(time) * 0.1 + 1.0; // Oscillate between 0.9 and 1.1
    this.invulnerabilityMesh.scale.setScalar(pulse);

    // Opacity pulse (more subtle)
    const material = this.invulnerabilityMesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.2 + Math.sin(time * 2) * 0.1; // Oscillate between 0.1 and 0.3

    // Rotate for shimmer effect
    this.invulnerabilityMesh.rotation.y += delta * 1.5;
    this.invulnerabilityMesh.rotation.x += delta * 0.5;
  }

  /**
   * MVP 8 Phase 3: Update health bar UI
   */
  private updateHealthUI(): void {
    const healthBar = document.getElementById('health-bar');
    const healthText = document.getElementById('health-text');

    if (healthBar) {
      const healthPercent = Math.max(0, Math.min(100, (this.health / this.MAX_HEALTH) * 100));
      healthBar.style.width = healthPercent + '%';

      // Color changes based on health level
      if (healthPercent > 60) {
        healthBar.style.background = 'linear-gradient(90deg, #44ff44 0%, #66ff66 100%)'; // Green
      } else if (healthPercent > 30) {
        healthBar.style.background = 'linear-gradient(90deg, #ffaa44 0%, #ffcc66 100%)'; // Orange
      } else {
        healthBar.style.background = 'linear-gradient(90deg, #ff4444 0%, #ff6666 100%)'; // Red
      }
    } else {
      console.error('❌ Health bar element not found! ID: health-bar');
    }

    if (healthText) {
      healthText.textContent = Math.round(this.health) + '/' + this.MAX_HEALTH;
    }
  }

  /**
   * MVP 12: Update wildebeest annoyance data (stores in predator userData)
   * The floating annoyance bar is updated in updateWildebeestAnnoyanceBars() during render loop
   */
  private updateWildebeestAnnoyanceBar(annoyanceLevel: number, fleeing: boolean): void {
    // Find the wildebeest predator and update its userData
    // Note: Server sends this message but doesn't specify which wildebeest
    // In practice, there's typically only one wildebeest at a time
    for (const [_, predator] of this.predators) {
      if (predator.userData?.type === 'wildebeest') {
        predator.userData.annoyanceLevel = annoyanceLevel;
        predator.userData.fleeing = fleeing;
        // The bar display is handled by updateWildebeestAnnoyanceBars() in render loop
      }
    }
  }

  /**
   * MVP 9: Show kill notification when player eliminates an NPC or remote player
   */
  private showKillNotification(targetName: string): void {
    // MVP 11: Play elimination sound
    this.audioManager.playSound('player', 'player_eliminated');

    // Create notification element
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.padding = '20px 40px';
    notification.style.backgroundColor = 'rgba(255, 215, 0, 0.95)';
    notification.style.color = '#2b1810';
    notification.style.fontSize = '32px';
    notification.style.fontWeight = 'bold';
    notification.style.borderRadius = '10px';
    notification.style.border = '3px solid #ffd700';
    notification.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.6)';
    notification.style.zIndex = '10000';
    notification.style.pointerEvents = 'none';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.textContent = `Eliminated ${targetName} !`;

    document.body.appendChild(notification);

    // Animate fade out and remove
    setTimeout(() => {
      notification.style.transition = 'opacity 0.5s ease';
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 500);
    }, 2000);
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
   * MVP 12: Get terrain height at position (helper for aerial units)
   */
  private getTerrainHeightAtPosition(x: number, z: number): number {
    if (!this.terrain) {
      return getTerrainHeight(x, z);
    }

    // Raycast from above downward to find terrain
    const rayOrigin = new THREE.Vector3(x, 100, z);
    const rayDirection = new THREE.Vector3(0, -1, 0);
    this.raycaster.set(rayOrigin, rayDirection);

    const intersects = this.raycaster.intersectObject(this.terrain, false);

    if (intersects.length > 0) {
      return intersects[0].point.y;
    }

    // Fallback to heightmap
    return getTerrainHeight(x, z);
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
          width: 100 %;
          height: 100 %;
          pointer - events: none;
          z - index: 500;
          display: none;
          background: radial - gradient(circle, transparent 20 %, rgba(0, 0, 0, 0.8) 100 %);
          `;
    document.body.appendChild(this.boundaryVignetteElement);

    // Create warning text
    this.boundaryWarningElement = document.createElement('div');
    this.boundaryWarningElement.id = 'boundary-warning';
    this.boundaryWarningElement.textContent = '⚠️ Turn Back';
    this.boundaryWarningElement.style.cssText = `
          position: fixed;
          top: 50 %;
          left: 50 %;
          transform: translate(-50 %, -50 %);
          color: #ff4444;
          font - size: 32px;
          font - weight: bold;
          font - family: Arial, sans - serif;
          text - shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
          pointer - events: none;
          z - index: 501;
          display: none;
          animation: pulse 1s ease -in -out infinite;
          `;
    document.body.appendChild(this.boundaryWarningElement);

    // Add pulse animation if not already present
    if (!document.getElementById('boundary-animation-style')) {
      const style = document.createElement('style');
      style.id = 'boundary-animation-style';
      style.textContent = `
          @keyframes pulse {
            0 %, 100 % { opacity: 0.6; transform: translate(-50 %, -50 %) scale(1); }
            50 % { opacity: 1; transform: translate(-50 %, -50 %) scale(1.1); }
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
        console.error(`❌ Failed to load landmark: ${modelPath} `);
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
        console.error(`❌ No mesh found in landmark: ${modelPath} `);
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
          `landmark_${name} `,
          tree,
          treeWorldPos
        );
      }

      // Add floating text label above the landmark (1.3x higher to clear tree canopy)
      this.createLandmarkLabel(name, x, terrainY + 39, z);
    } catch (error) {
      console.error(`❌ Error creating landmark ${name}: `, error);
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
      console.error(`❌ Failed to load model ${modelPath}: `, error);
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
        console.warn(`⚠️ No animations found in ${animPath} `);
        return null;
      }
    } catch (error) {
      console.error(`❌ Failed to load animation ${animPath}: `, error);
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
          playerPosSpan.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)} `;
        }

        if (playerCountSpan) {
          playerCountSpan.textContent = `${this.remotePlayers.size + 1} `; // +1 for local player
        }

        if (networkStatusSpan) {
          networkStatusSpan.textContent = this.isConnected ? 'Connected' : 'Disconnected';
        }

        if (playerIdSpan) {
          playerIdSpan.textContent = this.playerId || 'None';
        }

        // MVP 5: Enhanced debug info
        if (fpsSpan) {
          fpsSpan.textContent = `${Math.round(this.fps)} `;
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

        // REMOVED: Duplicate updateWalnutHUD call - already called in main animate() loop
        // This was causing HUD updates to run twice per frame
      } catch (error) {
        // Ignore debug update errors
      }

      requestAnimationFrame(updateDebug);
    };

    updateDebug();
  }

  /**
   * MVP 3: Update walnut HUD display
   * PERFORMANCE FIX: Uses cached DOM elements and dirty checking to prevent redundant updates
   */
  private updateWalnutHUD(): void {
    // Cache DOM elements on first call to avoid lookups every frame
    if (!this.hudElements.walnutCount) {
      this.hudElements.walnutCount = document.getElementById('walnut-count');
      this.hudElements.playerScore = document.getElementById('player-score');
      this.hudElements.playerTitle = document.getElementById('player-title');
      this.hudElements.hideBtn = document.getElementById('mobile-hide-btn') as HTMLButtonElement;
      this.hudElements.hideCount = document.getElementById('mobile-hide-count');
      this.hudElements.throwBtn = document.getElementById('mobile-throw-btn') as HTMLButtonElement;
      this.hudElements.throwCount = document.getElementById('mobile-throw-count');
      this.hudElements.eatBtn = document.getElementById('mobile-eat-btn') as HTMLButtonElement;
      this.hudElements.eatCount = document.getElementById('mobile-eat-count');
    }

    // Only update DOM when values actually change
    const flooredScore = Math.floor(this.displayedScore);
    const characterName = this.getCharacterName(this.selectedCharacterId);
    const titleText = `${this.playerTitleName} ${characterName} `;

    if (this.hudLastValues.walnutInventory !== this.walnutInventory) {
      this.hudLastValues.walnutInventory = this.walnutInventory;
      if (this.hudElements.walnutCount) {
        this.hudElements.walnutCount.textContent = `${this.walnutInventory} `;
      }
      // Mobile buttons also depend on inventory - update them
      this.updateMobileButtons();
    }

    if (this.hudLastValues.displayedScore !== flooredScore) {
      this.hudLastValues.displayedScore = flooredScore;
      if (this.hudElements.playerScore) {
        this.hudElements.playerScore.textContent = `${flooredScore} `;
      }
    }

    if (this.hudLastValues.playerTitle !== titleText) {
      this.hudLastValues.playerTitle = titleText;
      if (this.hudElements.playerTitle) {
        this.hudElements.playerTitle.textContent = titleText;
      }
    }
  }

  /**
   * Update score display with visual feedback for Carefree mode
   */
  private updateScoreDisplay(): void {
    const playerScoreSpan = document.getElementById('player-score');
    if (playerScoreSpan) {
      playerScoreSpan.textContent = `${Math.floor(this.displayedScore)} `;

      if (this.isCarefree) {
        playerScoreSpan.style.opacity = '0.5';
        playerScoreSpan.style.filter = 'grayscale(50%)';
        playerScoreSpan.title = 'Score not tracked in Carefree mode';
      } else {
        playerScoreSpan.style.opacity = '1';
        playerScoreSpan.style.filter = 'none';
        playerScoreSpan.title = '';
      }
    }

    const playerTitleSpan = document.getElementById('player-title');
    if (playerTitleSpan) {
      const characterName = this.getCharacterName(this.selectedCharacterId);
      if (this.isCarefree) {
        playerTitleSpan.textContent = `${this.playerTitleName} ${characterName} (Paused) `;
        playerTitleSpan.style.opacity = '0.6';
        playerTitleSpan.title = 'Rank frozen in Carefree mode';
      } else {
        playerTitleSpan.textContent = `${this.playerTitleName} ${characterName} `;
        playerTitleSpan.style.opacity = '1';
        playerTitleSpan.title = '';
      }
    }
  }

  /**
   * Update or create mode indicator in HUD
   */
  private updateModeIndicator(): void {
    let indicator = document.getElementById('mode-indicator');

    if (!indicator) {
      // Create indicator if it doesn't exist
      indicator = document.createElement('div');
      indicator.id = 'mode-indicator';
      document.body.appendChild(indicator);
    }

    indicator.style.cssText = `
      position: fixed;
      top: 70px;
      right: 10px;
      padding: 6px 12px;
      background: ${this.isCarefree ? 'rgba(33, 150, 243, 0.9)' : 'rgba(76, 175, 80, 0.9)'};
      border: 2px solid ${this.isCarefree ? '#2196F3' : '#4CAF50'};
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: bold;
      color: white;
      z-index: 100;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      display: block;
      font-family: Arial, sans-serif;
    `;
    indicator.textContent = this.isCarefree ? '🧘 Carefree' : '🏆 Standard';
  }

  /**
   * MVP 5.7: Update mobile button states (Hide, Throw, Eat)
   * PERFORMANCE FIX: Uses cached DOM elements from hudElements
   */
  private updateMobileButtons(): void {
    const inventory = this.walnutInventory;
    const countText = `(${inventory})`;
    const dimOpacity = inventory <= 0 ? '0.4' : '1';

    // Update HIDE button (uses cached elements)
    if (this.hudElements.hideBtn && this.hudElements.hideCount) {
      this.hudElements.hideCount.textContent = countText;
      this.hudElements.hideBtn.style.opacity = dimOpacity;
    }

    // Update THROW button (uses cached elements)
    if (this.hudElements.throwBtn && this.hudElements.throwCount) {
      this.hudElements.throwCount.textContent = countText;
      this.hudElements.throwBtn.style.opacity = dimOpacity;
    }

    // MVP 8 Phase 3: Update EAT button (uses cached elements)
    if (this.hudElements.eatBtn && this.hudElements.eatCount) {
      this.hudElements.eatCount.textContent = countText;
      // Dim if no walnuts OR already at full health
      const canEat = inventory > 0 && this.health < this.MAX_HEALTH;
      this.hudElements.eatBtn.style.opacity = canEat ? '1' : '0.4';
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
   * MVP 9: Create health bar for remote player or NPC
   * Returns { container, fill } for updating health later
   */
  private createHealthBar(): { container: HTMLElement; fill: HTMLElement } {
    // Create container (background)
    const container = document.createElement('div');
    container.className = 'health-bar-container';
    container.style.position = 'absolute';
    container.style.width = '60px';
    container.style.height = '6px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    container.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    container.style.borderRadius = '3px';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '999';
    // MVP 9 FIX: Center health bar horizontally like username labels
    container.style.transform = 'translateX(-50%)';

    // Create fill (foreground - health percentage)
    const fill = document.createElement('div');
    fill.className = 'health-bar-fill';
    fill.style.position = 'absolute';
    fill.style.top = '0';
    fill.style.left = '0';
    fill.style.height = '100%';
    fill.style.width = '100%'; // Start at full health
    fill.style.backgroundColor = '#44ff44'; // Green
    fill.style.transition = 'width 0.3s ease, background-color 0.3s ease';

    container.appendChild(fill);

    if (this.labelsContainer) {
      this.labelsContainer.appendChild(container);
    }

    return { container, fill };
  }

  /**
   * MVP 12: Create annoyance bar for wildebeest (similar to health bar but orange)
   * Returns { container, fill } for updating annoyance level later
   */
  private createAnnoyanceBar(): { container: HTMLElement; fill: HTMLElement } {
    // Create container (background)
    const container = document.createElement('div');
    container.className = 'annoyance-bar-container';
    container.style.position = 'absolute';
    container.style.width = '60px';
    container.style.height = '6px';
    container.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    container.style.border = '1px solid rgba(255, 136, 0, 0.5)'; // Orange border
    container.style.borderRadius = '3px';
    // container.style.overflow = 'hidden'; // REMOVED: Causes label to be clipped (invisible)
    container.style.pointerEvents = 'none';
    container.style.zIndex = '999';
    container.style.transform = 'translateX(-50%)';
    container.style.display = 'none'; // Hidden by default (only show when in proximity)

    // Create fill (foreground - annoyance percentage)
    const fill = document.createElement('div');
    fill.className = 'annoyance-bar-fill';
    fill.style.borderRadius = '3px'; // Match container since overflow is visible
    fill.style.borderRadius = '3px'; // Match container since overflow is visible
    fill.style.position = 'absolute';
    fill.style.top = '0';
    fill.style.left = '0';
    fill.style.height = '100%';
    fill.style.width = '0%'; // Start at 0 annoyance
    fill.style.background = 'linear-gradient(90deg, #ff8800 0%, #ffaa00 100%)'; // Orange gradient
    fill.style.transition = 'width 0.3s ease';

    container.appendChild(fill);

    // Add "Predator" label (Capsule style)
    const label = document.createElement('div');
    label.textContent = 'Predator';
    label.style.position = 'absolute';
    label.style.top = '-24px'; // Moved up slightly to accommodate padding
    label.style.left = '50%';
    label.style.transform = 'translateX(-50%)';
    label.style.padding = '2px 8px';
    label.style.backgroundColor = 'rgba(255, 68, 68, 0.9)'; // Red background
    label.style.color = 'white';
    label.style.fontSize = '12px';
    label.style.fontWeight = 'bold';
    label.style.borderRadius = '10px';
    label.style.whiteSpace = 'nowrap';
    label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    container.appendChild(label);

    if (this.labelsContainer) {
      this.labelsContainer.appendChild(container);
    }

    return { container, fill };
  }

  /**
   * MVP 9: Update health bar fill and color based on health percentage
   */
  private updateHealthBar(fill: HTMLElement, currentHealth: number, maxHealth: number): void {
    const healthPercent = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100));
    fill.style.width = `${healthPercent}% `;

    // Color-coded based on health percentage
    if (healthPercent > 60) {
      fill.style.backgroundColor = '#44ff44'; // Green
    } else if (healthPercent > 30) {
      fill.style.backgroundColor = '#ffaa44'; // Yellow/Orange
    } else {
      fill.style.backgroundColor = '#ff4444'; // Red
    }
  }

  /**
   * MVP 6: Update remote player username labels (always visible, positioned above player)
   */
  private updateRemotePlayerNameLabels(): void {
    for (const [playerId, label] of this.remotePlayerNameLabels) {
      const player = this.remotePlayers.get(playerId);
      if (player) {
        // MVP 9: Dynamic height adjustment based on distance to camera
        const distanceToCamera = this.camera.position.distanceTo(player.position);
        let nameLabelYOffset = 2.5; // Default position above player's head

        // When close to player (< 8 units), lower the label for better visibility
        if (distanceToCamera < 8) {
          nameLabelYOffset = 1.2; // Much lower when close
        }

        // Position label above player's head
        const labelPos = player.position.clone();
        labelPos.y += nameLabelYOffset;
        this.updateLabelPosition(label, labelPos);
      }
    }
  }

  /**
   * MVP 9: Update remote player health bars (position and fill)
   */
  private updateRemotePlayerHealthBars(): void {
    for (const [playerId, healthBar] of this.remotePlayerHealthBars) {
      const player = this.remotePlayers.get(playerId);
      if (player) {
        // MVP 9: Dynamic height adjustment based on distance to camera
        const distanceToCamera = this.camera.position.distanceTo(player.position);
        let healthBarYOffset = 2.0; // Default position below username

        // When close to player (< 8 units), lower the health bar for better visibility
        if (distanceToCamera < 8) {
          healthBarYOffset = 0.8; // Much lower when close
        }

        // Position health bar below username
        const barPos = player.position.clone();
        barPos.y += healthBarYOffset;
        this.updateLabelPosition(healthBar.container, barPos);

        // Update health bar fill based on userData
        // MVP 9 FIX: Use ?? instead of || to avoid treating 0 health as falsy (which would default to 100)
        const health = player.userData.health ?? 100;
        const maxHealth = player.userData.maxHealth ?? 100;
        this.updateHealthBar(healthBar.fill, health, maxHealth);
      }
    }
  }

  /**
   * MVP 9: Update NPC health bars (position and fill)
   */
  private updateNPCHealthBars(): void {
    for (const [npcId, healthBar] of this.npcHealthBars) {
      const npc = this.npcs.get(npcId);
      if (npc) {
        // MVP 9: Dynamic height adjustment based on distance to camera
        const distanceToCamera = this.camera.position.distanceTo(npc.position);
        let healthBarYOffset = 2.0; // Default position below username

        // When close to NPC (< 8 units), lower the health bar for better visibility
        if (distanceToCamera < 8) {
          healthBarYOffset = 0.8; // Much lower when close
        }

        // Position health bar below username
        const barPos = npc.position.clone();
        barPos.y += healthBarYOffset;
        this.updateLabelPosition(healthBar.container, barPos);

        // Update health bar fill based on userData
        // MVP 9 FIX: Use ?? instead of || to avoid treating 0 health as falsy (which would default to 100)
        const health = npc.userData.health ?? 100;
        const maxHealth = npc.userData.maxHealth ?? 100;
        this.updateHealthBar(healthBar.fill, health, maxHealth);
      }
    }
  }

  /**
   * MVP 12: Update wildebeest annoyance bars (position and fill, only show in proximity)
   */
  private updateWildebeestAnnoyanceBars(): void {
    if (!this.character) return;

    const playerPos = this.character.position;
    const PROXIMITY_DISTANCE = 30; // Only show bar within 30 units

    for (const [predatorId, annoyanceBar] of this.wildebeestAnnoyanceBars) {
      const wildebeest = this.predators.get(predatorId);
      if (wildebeest && wildebeest.userData?.type === 'wildebeest') {
        // Calculate distance to player
        const dx = wildebeest.position.x - playerPos.x;
        const dz = wildebeest.position.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Only show bar if within proximity and not fleeing
        const fleeing = wildebeest.userData.fleeing ?? false;
        if (distance < PROXIMITY_DISTANCE && !fleeing) {
          annoyanceBar.container.style.display = 'block';

          // MVP 12: Dynamic height adjustment based on distance to camera (like NPC health bars)
          const distanceToCamera = this.camera.position.distanceTo(wildebeest.position);
          let barYOffset = 3.5; // Default: higher than NPCs since wildebeest is larger

          // When close to wildebeest (< 10 units), lower the bar for better visibility
          if (distanceToCamera < 10) {
            barYOffset = 1.2; // Much lower when close (slightly higher than NPCs due to size)
          }

          // Position bar above wildebeest with dynamic offset
          const barPos = wildebeest.position.clone();
          barPos.y += barYOffset;
          this.updateLabelPosition(annoyanceBar.container, barPos);

          // Update annoyance bar fill based on userData (0-4 hits = 0-100%)
          const annoyanceLevel = wildebeest.userData.annoyanceLevel ?? 0;
          const annoyancePercent = Math.max(0, Math.min(100, (annoyanceLevel / 4) * 100));
          annoyanceBar.fill.style.width = `${annoyancePercent}% `;
        } else {
          // Hide bar if too far or fleeing
          annoyanceBar.container.style.display = 'none';
        }
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

    // MVP 8 FIX: Use shared walnut mesh (sits on ground patch)
    const walnut = this.createWalnutMesh();
    walnut.position.y = 0.03; // Slightly above ground
    walnut.castShadow = true;
    walnut.receiveShadow = true;
    group.add(walnut);

    // Simple brownish ground patch - flat disc slightly bigger than walnut
    // Walnut radius: 0.06, patch radius: 0.10 (just slightly bigger)
    const patchGeometry = new THREE.CircleGeometry(0.10, 16);
    const patchMaterial = new THREE.MeshStandardMaterial({
      color: 0x6B5A4D, // Slightly brownish, earthy color
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const patch = new THREE.Mesh(patchGeometry, patchMaterial);
    patch.rotation.x = -Math.PI / 2; // Lay flat on ground
    patch.position.y = 0.01; // Just above terrain to prevent z-fighting
    patch.receiveShadow = true;
    group.add(patch);

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

    // MVP 9: Add green throbbing glow for player-hidden walnuts
    const glowGeometry = new THREE.SphereGeometry(this.WALNUT_SIZE * 2, 16, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FF00, // Green
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const throbGlow = new THREE.Mesh(glowGeometry, glowMaterial);
    throbGlow.position.y = 0.05;
    group.add(throbGlow);
    group.userData.throbGlow = throbGlow;

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

    // MVP 9: Add green throbbing glow for player-hidden walnuts
    const throbGlowGeometry = new THREE.SphereGeometry(this.WALNUT_SIZE * 2, 16, 12);
    const throbGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00FF00, // Green
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const throbGlow = new THREE.Mesh(throbGlowGeometry, throbGlowMaterial);
    throbGlow.position.y = 0.4;
    group.add(throbGlow);
    group.userData.throbGlow = throbGlow;

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

        // MVP 9: Animate green glow for player-hidden bush walnuts
        const throbGlow = walnutGroup.userData.throbGlow as THREE.Mesh;
        if (throbGlow) {
          if (walnutGroup.userData.throbPhase === undefined) {
            walnutGroup.userData.throbPhase = Math.random() * Math.PI * 2;
          }
          walnutGroup.userData.throbPhase += delta * 1.5;
          const opacity = 0.2 + Math.sin(walnutGroup.userData.throbPhase) * 0.15;
          (throbGlow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.05, opacity);
        }
      } else if (type === 'buried') {
        // MVP 9: Animate green glow for player-hidden buried walnuts
        const throbGlow = walnutGroup.userData.throbGlow as THREE.Mesh;
        if (throbGlow) {
          if (walnutGroup.userData.throbPhase === undefined) {
            walnutGroup.userData.throbPhase = Math.random() * Math.PI * 2;
          }
          walnutGroup.userData.throbPhase += delta * 1.5;
          const opacity = 0.2 + Math.sin(walnutGroup.userData.throbPhase) * 0.15;
          (throbGlow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.05, opacity);
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

    // MVP 12: Draw recently planted trees (last 30 seconds)
    const now = Date.now();
    const TREE_DISPLAY_DURATION = 30000; // 30 seconds

    // Clean up old trees
    this.recentTrees = this.recentTrees.filter(tree => now - tree.timestamp < TREE_DISPLAY_DURATION);

    // Draw tree icons
    for (const tree of this.recentTrees) {
      const pos = worldToMinimap(tree.x, tree.z);

      // Only draw if within bounds
      if (pos.x < 0 || pos.x > size || pos.y < 0 || pos.y > size) continue;

      // Draw tree icon (small green circle with triangle on top)
      // Tree trunk (small brown circle)
      ctx.fillStyle = '#8B4513'; // Brown
      ctx.beginPath();
      ctx.arc(pos.x, pos.y + 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // Tree foliage (green triangle)
      ctx.fillStyle = '#228B22'; // Forest green
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - 4); // Top point
      ctx.lineTo(pos.x - 4, pos.y + 2); // Bottom left
      ctx.lineTo(pos.x + 4, pos.y + 2); // Bottom right
      ctx.closePath();
      ctx.fill();
    }

    // Draw remote players
    for (const [_playerId, remotePlayer] of this.remotePlayers) {
      const pos = worldToMinimap(remotePlayer.position.x, remotePlayer.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        ctx.fillStyle = '#00ff00'; // Green for human players
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // MVP 7: Draw NPCs on minimap (Gray for bots)
    for (const [_npcId, npc] of this.npcs) {
      const pos = worldToMinimap(npc.position.x, npc.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        ctx.fillStyle = '#888888'; // Gray for NPCs
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // MVP 12: Draw Predators on minimap (red squares for danger)
    for (const [_predatorId, predator] of this.predators) {
      const pos = worldToMinimap(predator.position.x, predator.position.z);

      // Only draw if within minimap bounds
      if (pos.x >= 0 && pos.x <= size && pos.y >= 0 && pos.y <= size) {
        // Draw red square for predators (danger indicator)
        ctx.fillStyle = '#FF0000'; // Bright red
        ctx.fillRect(pos.x - 5, pos.y - 5, 10, 10);

        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(pos.x - 5, pos.y - 5, 10, 10);
      }
    }

    // Draw local player (MVP 8 FIX: Hide indicator while dead, show after respawn)
    if (!this.isDead && this.character) {
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

    const walnutId = `player - ${this.playerId} -${Date.now()} `;
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
    // MVP 8 FIX: Add settling cooldown to prevent immediate pickup (same as thrown projectiles)
    walnutGroup.userData.settlingUntil = Date.now() + 5000; // 5 second cooldown (increased from 2s)
    this.scene.add(walnutGroup);
    this.walnuts.set(walnutId, walnutGroup);

    // Add label for player-hidden walnut
    const label = this.createLabel(labelText, labelColor);
    this.walnutLabels.set(walnutId, label);

    // MVP 8: Server will decrement inventory and send inventory_update
    // (Removed optimistic decrement to prevent desync)

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

    // MVP 14: Show contextual tip on first walnut hidden
    this.showContextualTip('first_walnut_hidden', 'trees');
  }

  /**
   * MVP 8: Throw walnut at target
   */
  /**
   * MVP 12: Get aerial predators in player's awareness zone
   * Used for bird distraction mechanic
   *
   * Uses generous distance + direction check instead of strict frustum for better gameplay:
   * - Birds within 50 units are detected
   * - Birds roughly in front of player (wide 240-degree cone)
   * - Much easier to distract birds than pixel-perfect on-screen requirement
   */
  private getVisibleAerialPredators(): string[] {
    const visibleIds: string[] = [];

    // Get player position and camera forward direction
    const playerPos = this.character.position;
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // Ignore vertical component (horizontal plane only)
    cameraDirection.normalize();

    const AWARENESS_DISTANCE = 80; // 80 units - very generous detection range for easy distractions
    const AWARENESS_DOT_THRESHOLD = -0.8; // ~290 degree cone (almost full circle, birds anywhere nearby)

    // Check each predator
    for (const [id, predatorMesh] of this.predators) {
      // Get predator type from userData (set during predator creation)
      const predatorType = predatorMesh.userData?.type;

      // Only check aerial predators (not wildebeest)
      if (predatorType !== 'cardinal' && predatorType !== 'toucan') {
        continue;
      }

      // Calculate vector from player to predator (horizontal plane only)
      const toPredator = new THREE.Vector3(
        predatorMesh.position.x - playerPos.x,
        0, // Ignore vertical
        predatorMesh.position.z - playerPos.z
      );

      const distance = toPredator.length();

      // Too far? Skip
      if (distance > AWARENESS_DISTANCE) {
        continue;
      }

      // Check if roughly in front of player (dot product check)
      toPredator.normalize();
      const dotProduct = cameraDirection.dot(toPredator);

      // If dot > threshold, bird is in awareness zone
      if (dotProduct > AWARENESS_DOT_THRESHOLD) {
        visibleIds.push(id);
      }
    }

    return visibleIds;
  }

  private throwWalnut(): void {
    if (!this.character || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;

    const now = performance.now();

    // Reset consecutive throws if enough time has passed since last throw
    if (now - this.lastThrowTime > this.COOLDOWN_RESET_TIME) {
      this.consecutiveThrows = 0;
    }

    // Calculate progressive cooldown: base + (increment * consecutive throws)
    const currentCooldown = this.BASE_THROW_COOLDOWN + (this.COOLDOWN_INCREMENT * this.consecutiveThrows);

    // Check cooldown
    if (now - this.lastThrowTime < currentCooldown) {
      const remaining = Math.ceil((currentCooldown - (now - this.lastThrowTime)) / 1000);
      this.toastManager.warning(`Throw cooldown: ${remaining} s`);
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
    this.consecutiveThrows++; // Increment for progressive cooldown

    // MVP 11: Play throw sound
    this.audioManager.playSound('combat', 'throw_walnut');

    // MIGRATION PHASE 2.2: Use state machine for throw animation
    if (this.actions['attack']) {
      const attackAction = this.actions['attack'];
      const normalDuration = attackAction.getClip().duration * 1000; // ms
      attackAction.timeScale = 0.6; // Slow down to 60% speed (67% longer)
      // Use ACTION priority, doesn't block movement (can throw while moving)
      this.requestAnimation('attack', this.ANIM_PRIORITY_ACTION, normalDuration * 1.67, false);
    }

    // MVP 12: Get visible aerial predators for distraction mechanic
    const visiblePredators = this.getVisibleAerialPredators();

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
      targetId: targetId,
      visiblePredators: visiblePredators // MVP 12: For bird distraction
    });
  }

  /**
   * MVP 8 Phase 3: Eat a walnut from inventory to heal (+25 HP)
   */
  private eatWalnut(): void {
    // Check if player can eat
    if (this.isDead) {
      // MVP 12: Add cooldown to prevent spam
      const now = Date.now();
      if (now - this.lastDeadEatMessageTime >= this.DEAD_EAT_MESSAGE_COOLDOWN) {
        this.toastManager.warning('Cannot eat while dead!');
        this.lastDeadEatMessageTime = now;
      }
      return;
    }

    if (this.walnutInventory <= 0) {
      this.toastManager.warning('No walnuts to eat!');
      return;
    }

    if (this.health >= this.MAX_HEALTH) {
      this.toastManager.info('Already at full health!');
      return;
    }

    // MVP 8: Server will decrement inventory and send inventory_update
    // (Removed optimistic decrement to prevent double-decrement)
    // Optimistically heal for instant UX (server will confirm via entity_healed)
    this.heal(25, true); // fromEating = true

    // MVP 11: Play eat sound
    this.audioManager.playSound('player', 'walnut_eat');

    // MIGRATION PHASE 2.2: Use state machine for eat animation
    if (this.actions['eat']) {
      const eatAction = this.actions['eat'];
      eatAction.timeScale = 1.0;

      // Stop current movement (eating should feel deliberate)
      this.velocity.set(0, 0, 0);

      // Use ACTION priority with movement blocking (can't move while eating)
      // Fixed 1s duration for eating
      this.requestAnimation('eat', this.ANIM_PRIORITY_ACTION, 1000, true);

      // No need for isEatingWalnut flag or setTimeout - state machine handles it!
    }

    // Visual/audio feedback
    this.toastManager.success('+25 HP!');
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

    const PICKUP_RANGE = 0.8; // MVP 8: Reduced from 1.5 to require closer proximity
    const playerPos = this.character.position.clone();
    const now = Date.now(); // MVP 8 FIX: Must match Date.now() used for settlingUntil

    // Check each walnut for proximity
    this.walnuts.forEach((walnutGroup, walnutId) => {
      // MVP 8 FIX: Skip walnuts that are still settling (just landed from projectile)
      if (walnutGroup.userData.settlingUntil && now < walnutGroup.userData.settlingUntil) {
        return; // Walnut still settling, not yet pickupable
      }

      // MVP 8: Skip walnuts where THIS PLAYER is immune (legacy - now using settling delay instead)
      if (walnutGroup.userData.immunePlayerId === this.playerId && walnutGroup.userData.immuneUntil) {
        if (now < walnutGroup.userData.immuneUntil) {
          return; // This player is still immune (threw it), skip this walnut
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

    const now = Date.now();

    // Check if inventory is full
    if (this.walnutInventory >= this.MAX_INVENTORY) {
      // Throttle message to prevent spam (industry standard: message cooldown)
      if (now - this.lastInventoryFullMessageTime > this.INVENTORY_FULL_MESSAGE_COOLDOWN) {
        this.toastManager.warning("You can't carry any more walnuts!");
        this.lastInventoryFullMessageTime = now;
      }
      return;
    }

    // MVP 8 FIX: Check settling delay FIRST (walnut just landed from projectile)
    if (walnutGroup.userData.settlingUntil && now < walnutGroup.userData.settlingUntil) {
      return; // Walnut still settling, not yet pickupable
    }

    // MVP 8: Check immunity (legacy - now using settling delay instead)
    if (walnutGroup.userData.immunePlayerId === this.playerId && walnutGroup.userData.immuneUntil) {
      if (now < walnutGroup.userData.immuneUntil) {
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
      // MVP 8: FOUND SOMEONE ELSE'S WALNUT - Server awards points and handles inventory
      // (Server increments walnutInventory, score, and sends updates via player_update)
      // Note: Score update comes from server via player_update message (server-authoritative)

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
      this.toastManager.success(`+ ${points} points!`);
    }

    // Remove the walnut from the world
    this.removeWalnut(walnutId);

    // FINAL FIX: Restore eat animation on pickup (via state machine)
    // Server increments walnutInventory (sent via inventory_update message)
    // Play eat animation for ~1 second, blocks movement briefly
    if (this.actions['eat']) {
      const eatAction = this.actions['eat'];
      eatAction.timeScale = 1.0; // Normal speed

      // Stop current movement (eating should feel deliberate)
      this.velocity.set(0, 0, 0);

      // Use ACTION priority with movement blocking (same as manual eat)
      // Fixed 1s duration - animation plays, then player can continue if W still held
      this.requestAnimation('eat', this.ANIM_PRIORITY_ACTION, 1000, true);
    }

    // MULTIPLAYER: Send to server for sync
    this.sendMessage({
      type: 'walnut_found',
      walnutId: walnutId,
      finderId: this.playerId,
      points: points,
      timestamp: Date.now(),
      // MVP 16: Send auth status for All-Time leaderboard filtering
      isAuthenticated: isAuthenticated(),
      emailVerified: getCurrentUser()?.emailVerified || false
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
        labelText = data.ownerId === this.playerId ? 'Your Buried Walnut (3 pts)' : `Buried Walnut(3 pts)`;
        labelColor = '#8B4513';
        break;

      case 'bush':
        walnutGroup = this.createBushWalnutVisual(position);
        labelText = data.ownerId === this.playerId ? 'Your Bush Walnut (1 pt)' : `Bush Walnut(1 pt)`;
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
        console.warn(`⚠️ Unknown walnut type: ${data.walnutType} `);
        return;
    }

    // Add to scene and registry
    walnutGroup.userData.id = data.walnutId;
    walnutGroup.userData.ownerId = data.ownerId;
    walnutGroup.userData.type = data.walnutType; // CRITICAL: Set type for findWalnut checks
    walnutGroup.userData.points = data.points; // CRITICAL: Set points for scoring
    walnutGroup.userData.clickPosition = walnutGroup.position.clone(); // CRITICAL: Set clickPosition for proximity
    this.scene.add(walnutGroup);
    this.walnuts.set(data.walnutId, walnutGroup);

    // Add label
    const label = this.createLabel(labelText, labelColor);
    this.walnutLabels.set(data.walnutId, label);
  }

  /**
   * MVP 9: Tree walnut animation - REMOVED
   * Now uses ProjectileManager (same as thrown walnuts) - see tree_walnut_drop case handler
   * This eliminates 90 lines of duplicate physics code and all associated bugs
   */

  // MVP 3: Tutorial system methods

  /**
   * Initialize the tutorial system
   */
  private initTutorial(): void {
    // Initialize new tutorial overlay system
    // Industry standard: Don't pause multiplayer games - overlay is enough visual feedback
    this.tutorialOverlay = new TutorialOverlay();

    // Show toggle button when game starts
    const helpToggle = document.getElementById('help-toggle');
    if (helpToggle) {
      helpToggle.classList.remove('hidden');
    }
  }

  // MVP 4: Leaderboard system methods

  /**
   * Initialize the leaderboard system
   */
  private initLeaderboard(): void {
    // MVP 16: Guard against double-initialization (prevents duplicate event listeners)
    if (this.leaderboardInitialized) {

      return;
    }

    const toggleButton = document.getElementById('leaderboard-toggle');
    const leaderboardDiv = document.getElementById('leaderboard');

    // MVP 16: Defensive null checks with logging
    if (!toggleButton) {
      console.error('❌ [initLeaderboard] Leaderboard toggle button not found in DOM');
      return;
    }
    if (!leaderboardDiv) {
      console.error('❌ [initLeaderboard] Leaderboard div not found in DOM');
      return;
    }



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

    // MVP 9: Tab switching for All-Time vs Weekly
    const weeklyTab = leaderboardDiv.querySelector('[data-tab="weekly"]') as HTMLElement;
    const alltimeTab = leaderboardDiv.querySelector('[data-tab="alltime"]') as HTMLElement;

    if (weeklyTab && alltimeTab) {

      // Set weekly as default active tab
      weeklyTab.classList.add('active');

      // Weekly tab pointerdown handler
      weeklyTab.addEventListener('click', () => {

        if (this.currentLeaderboardTab !== 'weekly') {
          this.currentLeaderboardTab = 'weekly';
          weeklyTab.classList.add('active');
          alltimeTab.classList.remove('active');
          this.updateLeaderboard();
        }
      });

      // All-time tab pointerdown handler
      alltimeTab.addEventListener('click', () => {

        if (this.currentLeaderboardTab !== 'alltime') {
          this.currentLeaderboardTab = 'alltime';
          alltimeTab.classList.add('active');
          weeklyTab.classList.remove('active');
          this.updateLeaderboard();
        }
      });
    } else {
      console.error('❌ [initLeaderboard] Tab elements not found');
    }

    // Click/tap outside to dismiss leaderboard (user-requested feature)
    const dismissLeaderboard = (event: Event) => {
      const target = event.target as HTMLElement;

      // Check if click/tap is outside leaderboard AND outside toggle button
      if (this.leaderboardVisible &&
        !leaderboardDiv.contains(target) &&
        !toggleButton.contains(target)) {
        this.leaderboardVisible = false;
        leaderboardDiv.classList.add('hidden');
      }
    };

    // Listen for both click (desktop) and touchend (mobile/tablet)
    document.addEventListener('click', dismissLeaderboard);
    document.addEventListener('touchend', dismissLeaderboard);

    // Start periodic leaderboard updates (every 5 seconds)
    this.leaderboardUpdateInterval = window.setInterval(() => {
      if (this.leaderboardVisible) {
        this.updateLeaderboard();
      }
    }, 5000);

    // Initial update
    this.updateLeaderboard();

    // MVP 16: Mark as initialized to prevent duplicate calls
    this.leaderboardInitialized = true;
  }

  /**
   * Update the leaderboard display
   */
  private async updateLeaderboard(): Promise<void> {
    try {
      // MVP 9/16: Fetch leaderboard data based on selected tab (weekly or all-time)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const leaderboardType = this.currentLeaderboardTab; // 'weekly' or 'alltime'
      const endpoint = `${apiUrl}/api/leaderboard/top?limit=10&type=${leaderboardType}`;



      const response = await fetch(endpoint);

      let leaderboardData;
      if (!response.ok) {
        console.error(`❌ Leaderboard fetch failed (${response.status} ${response.statusText})`);
        leaderboardData = []; // Empty leaderboard on API failure
      } else {
        const data = await response.json();


        if (data.leaderboard.length === 0) {

          leaderboardData = [];
        } else {
          // MVP 16: Determine effective player ID (username for authenticated, squirrelId for guests)
          const effectivePlayerId = (this.username && this.username !== 'Anonymous')
            ? this.username
            : this.playerId;

          // MVP 16: Include authentication fields in leaderboard data
          leaderboardData = data.leaderboard.map((entry: any) => ({
            playerId: entry.playerId,
            displayName: entry.playerId === effectivePlayerId
              ? (this.username ? `You (${this.username})` : 'You')
              : (entry.displayName || entry.playerId), // MVP 17: Show display name
            score: entry.score,
            isAuthenticated: entry.isAuthenticated || false, // MVP 16: Auth status
            emailVerified: entry.emailVerified || false, // MVP 16: Verification status
            characterId: entry.characterId || 'squirrel' // MVP 16: Character used
          }));


        }
      }

      const leaderboardList = document.getElementById('leaderboard-list');
      if (!leaderboardList) return;

      // Clear existing entries
      leaderboardList.innerHTML = '';

      // Add entries (top 10)
      const top10 = leaderboardData.slice(0, 10);
      let playerInTop10 = false;

      top10.forEach((entry: any, index: number) => {
        const li = document.createElement('li');

        // Track if current player is in top 10
        if (entry.playerId === this.playerId) {
          li.classList.add('current-player');
          playerInTop10 = true;
        }

        // MVP 16: Add verified badge based on email verification status
        let badge = '';
        if (entry.emailVerified) {
          // Green checkmark for verified email users
          badge = '<span style="color: #2ecc71; font-weight: bold;" title="Verified Email">✓</span> ';
        } else if (entry.isAuthenticated) {
          // Cloud icon for authenticated users (Cloud Saved)
          badge = '<span style="color: #3498db;" title="Cloud Saved">☁️</span> ';
        }
        // No badge for guest players

        // Create entry HTML
        li.innerHTML = `
            <span class="leaderboard-rank">#${index + 1}</span>
            <span class="leaderboard-name">${badge}${entry.displayName}</span>
            <span class="leaderboard-score">${entry.score}</span>
          `;

        leaderboardList.appendChild(li);
      });

      // MVP 16: Show player rank below top 10 if not in top 10
      if (!playerInTop10) {
        // Fetch specific player rank from API
        try {
          const type = this.currentLeaderboardTab || 'weekly';

          // MVP 16: Use username for authenticated players to match server-side ID
          // This fixes the bug where authenticated players weren't finding their rank
          // because the client was querying with squirrelId but server stored under username
          const effectivePlayerId = (this.username && this.username !== 'Anonymous')
            ? this.username
            : this.playerId;



          const rankResponse = await fetch(`${apiUrl}/api/leaderboard/player?playerId=${effectivePlayerId}&type=${this.currentLeaderboardTab}`);
          if (rankResponse.ok) {
            const playerEntry = await rankResponse.json();

            if (playerEntry && playerEntry.rank > 0) {
              // Add separator
              const separator = document.createElement('div');
              separator.style.cssText = `
              border-top: 1px solid rgba(255, 215, 0, 0.3);
              margin: 10px 0;
              `;
              leaderboardList.appendChild(separator);

              // Add player's rank
              const playerLi = document.createElement('li');
              playerLi.classList.add('current-player');

              // Use same badge logic as top 10
              let playerBadge = '';
              if (playerEntry.emailVerified) {
                playerBadge = '<span style="color: #2ecc71; font-weight: bold;" title="Verified Email">✓</span> ';
              } else if (playerEntry.isAuthenticated) {
                playerBadge = '<span style="color: #95a5a6;" title="Signed In (Unverified)">🔒</span> ';
              }

              playerLi.innerHTML = `
                  <span class="leaderboard-rank">#${playerEntry.rank}</span>
                  <span class="leaderboard-name">${playerBadge}You (${this.username || 'Player'})</span>
                  <span class="leaderboard-score">${playerEntry.score}</span>
                `;

              leaderboardList.appendChild(playerLi);

              // MVP 16: Add CTA for no-auth players ranked below top 10
              if (!playerEntry.isAuthenticated && type === 'weekly') {
                const ctaEl = document.createElement('div');
                ctaEl.style.cssText = `
              text-align: center;
              font-size: 11px;
              color: #FFD700;
              margin-top: 8px;
              padding: 8px;
              background: rgba(255, 215, 0, 0.1);
              border-radius: 4px;
              cursor: pointer;
              `;
                ctaEl.innerHTML = '🔒 Sign in to save your score!';
                ctaEl.onclick = () => {
                  // Open settings to account tab
                  const settingsToggle = document.getElementById('settings-toggle');
                  if (settingsToggle) settingsToggle.click();
                };
                leaderboardList.appendChild(ctaEl);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching player rank:', err);
        }
      }
    } catch (error) {
      console.error('❌ Failed to update leaderboard:', error);
    }
  }

  /**
   * Initialize quick chat and emote systems
   */
  private initChatAndEmotes(): void {
    // MVP 16: Guard against double-initialization (prevents duplicate event listeners)
    if (this.chatEmotesInitialized) {
      console.log('⚠️ [initChatAndEmotes] Already initialized, skipping');
      return;
    }

    console.log('💬 [initChatAndEmotes] Initializing chat and emotes...');

    const quickChatDiv = document.getElementById('quick-chat');
    const emotesDiv = document.getElementById('emotes');

    // MVP 16: Defensive null checks with logging
    if (!quickChatDiv) {
      console.error('❌ [initChatAndEmotes] Quick chat div not found in DOM');
      return;
    }
    if (!emotesDiv) {
      console.error('❌ [initChatAndEmotes] Emotes div not found in DOM');
      return;
    }

    // Show UI elements
    quickChatDiv.classList.remove('hidden');
    emotesDiv.classList.remove('hidden');
    console.log('✅ [initChatAndEmotes] UI elements revealed');

    // Setup quick chat buttons
    const chatButtons = document.querySelectorAll('.chat-button');
    console.log(`💬 [initChatAndEmotes] Found ${chatButtons.length} chat buttons`);

    chatButtons.forEach((button) => {
      // Handle both click and touchstart to ensure responsiveness
      const handleChat = (e: Event) => {
        e.preventDefault(); // Prevent double-firing and default behavior
        e.stopPropagation(); // Prevent event from reaching game canvas

        const message = (button as HTMLElement).getAttribute('data-message');
        console.log(`💬 [Chat] Button clicked: "${message}"`);

        if (message) {
          this.sendChatMessage(message);
        }
      };

      button.addEventListener('click', handleChat);
      button.addEventListener('touchstart', handleChat, { passive: false });
    });

    // Setup emote buttons
    const emoteButtons = document.querySelectorAll('.emote-button');
    console.log(`😊 [initChatAndEmotes] Found ${emoteButtons.length} emote buttons`);

    emoteButtons.forEach((button) => {
      // Handle both click and touchstart to ensure responsiveness
      const handleEmote = (e: Event) => {
        e.preventDefault(); // Prevent double-firing and default behavior
        e.stopPropagation(); // Prevent event from reaching game canvas

        const emote = (button as HTMLElement).getAttribute('data-emote');
        console.log(`😊 [Emote] Button clicked: "${emote}"`);

        if (emote) {
          this.sendEmote(emote);
        }
      };

      button.addEventListener('click', handleEmote);
      button.addEventListener('touchstart', handleEmote, { passive: false });
    });

    // MVP 16: Mark as initialized to prevent duplicate calls
    this.chatEmotesInitialized = true;
    console.log('✅ [initChatAndEmotes] Initialization complete');
  }

  /**
   * Send a chat message (broadcasts to all players)
   */
  private sendChatMessage(message: string): void {
    console.log(`💬 [sendChatMessage] Attempting to send: "${message}"`);
    console.log(`   [sendChatMessage] Connected: ${this.isConnected}, WebSocket: ${!!this.websocket}`);

    if (!this.isConnected || !this.websocket) {
      console.warn('⚠️ [sendChatMessage] Cannot send - not connected');
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
    console.log(`😊 [sendEmote] Attempting to send: "${emote}"`);
    console.log(`   [sendEmote] Connected: ${this.isConnected}, WebSocket: ${!!this.websocket}`);

    if (!this.isConnected || !this.websocket) {
      console.warn('⚠️ [sendEmote] Cannot send - not connected');
      return;
    }

    // MIGRATION PHASE 2.1: Spam prevention now handled by state machine
    // playEmoteAnimation() uses requestAnimation() which blocks equal/higher priority

    // MVP 5: Play emote send sound
    this.audioManager.playSound('ui', 'emote_send');

    // Play emote animation locally (will be blocked if another animation is playing)
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
    if (!this.character) {
      return;
    }

    // MIGRATION PHASE 2.1: Use new animation state machine instead of emoteInProgress flag
    // State machine handles spam prevention via priority/duration system

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

      // PHASE 3 CLEANUP: Using state machine requestAnimation() (old playOneShotAnimation removed)
      this.requestAnimation(animationName, this.ANIM_PRIORITY_ACTION, animDuration, false);

      // No need for setTimeout - state machine handles expiration automatically!
      // No need for emoteInProgress flag - state machine prevents interrupts via priority!
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
  /**
   * MVP 17: Initialize Wardrobe UI
   */
  private initWardrobeMenu(): void {
    const toggleBtn = document.getElementById('wardrobe-toggle');
    if (!toggleBtn) return;

    toggleBtn.classList.remove('hidden');

    this.wardrobeOverlay = new WardrobeOverlay(
      async (accessories) => {
        console.log('Selected accessories:', accessories);
        // Serialize to JSON for storage/network
        const json = JSON.stringify(accessories);
        this.selectedAccessoryId = json;
        // Save to local storage
        localStorage.setItem('selectedAccessoryId', json);

        // Visual update
        if (this.character) {
          await this.attachAccessory(this.character, this.selectedCharacterId, json);
        }

        // Send to server
        this.sendMessage({
          type: 'update_accessory',
          accessoryId: json // Server treats as opaque string
        });

        // Play sound
        this.audioManager.playSound('ui', 'button_click');
      },
      () => {
        // On Close
        this.audioManager.playSound('ui', 'button_click');
      }
    );

    toggleBtn.addEventListener('click', () => {
      // Check if overlay initialized and character loaded
      if (this.wardrobeOverlay && this.character) {
        // determine character ID (fallback to squirrel if needed)
        // Accessing this.selectedCharacterId is the source of truth set by main.ts
        const charId = this.selectedCharacterId || 'squirrel';

        // Parse current selection
        let current: Record<string, string> = {};
        try {
          if (this.selectedAccessoryId && this.selectedAccessoryId !== 'none') {
            current = JSON.parse(this.selectedAccessoryId);
          }
        } catch (e) {
          // Legacy or single item
          current = { 'hat': this.selectedAccessoryId };
        }

        this.wardrobeOverlay.show(charId, current);
        this.audioManager.playSound('ui', 'button_click');
      }
    });
  }

  private initSettingsMenu(): void {
    // MVP 16: Guard against double-initialization (prevents duplicate event listeners)
    if (this.settingsInitialized) {
      return;
    }

    // Original implementation continues...

    const settingsToggle = document.getElementById('settings-toggle') as HTMLButtonElement;
    const settingsOverlay = document.getElementById('settings-overlay') as HTMLDivElement;
    const settingsClose = document.getElementById('settings-close-btn') as HTMLButtonElement;

    // MVP 16: Defensive null checks with logging
    if (!settingsToggle) {
      console.error('❌ [initSettingsMenu] Settings toggle button not found in DOM');
      return;
    }
    if (!settingsOverlay) {
      console.error('❌ [initSettingsMenu] Settings overlay not found in DOM');
      return;
    }
    if (!settingsClose) {
      console.error('❌ [initSettingsMenu] Settings close button not found in DOM');
      return;
    }



    // Show settings toggle button when game starts
    settingsToggle.classList.remove('hidden');

    // Tab switching (Legacy support if tabs exist)
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
      settingsOverlay.classList.remove('hidden');
      this.audioManager.playSound('ui', 'button_click');
    };

    const hideSettings = () => {
      settingsOverlay.classList.add('hidden');
      this.audioManager.playSound('ui', 'button_click');
    };

    // Settings toggle button pointerdown
    settingsToggle.addEventListener('click', () => {
      showSettings();
    });

    // Close button pointerdown
    settingsClose.addEventListener('click', () => {
      hideSettings();
    });

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

    // MVP 9: Click/tap outside settings to dismiss (matches Leaderboard pattern)
    const dismissSettings = (event: Event) => {
      const target = event.target as HTMLElement;
      if (settingsOverlay &&
        !settingsOverlay.classList.contains('hidden') &&
        !settingsOverlay.contains(target) &&
        settingsToggle &&
        !settingsToggle.contains(target)) {
        hideSettings();
      }
    };

    document.addEventListener('click', dismissSettings);
    document.addEventListener('touchend', dismissSettings); // Mobile support

    // MVP 16: Mark as initialized to prevent duplicate calls
    this.settingsInitialized = true;
  }

  /**
   * MVP 9: Handle tree growth - remove walnut, animate tree growing from 0 to full scale
   */
  private async handleTreeGrowth(data: any): Promise<void> {
    // Remove the walnut visual
    const walnut = this.walnuts.get(data.walnutId);
    if (walnut) {
      this.scene.remove(walnut);
      this.walnuts.delete(data.walnutId);

      // Remove label
      const label = this.walnutLabels.get(data.walnutId);
      if (label) {
        label.remove();
        this.walnutLabels.delete(data.walnutId);
      }
    }

    // Load tree model (reuse existing loader)
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();

    try {
      const gltf = await loader.loadAsync('/assets/models/environment/Tree_01.glb');
      const tree = gltf.scene.clone();

      // Set up shadows
      tree.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Position tree (resample terrain height for accurate placement on slopes)
      const treeY = getTerrainHeight(data.tree.x, data.tree.z);
      tree.position.set(data.tree.x, treeY, data.tree.z);
      tree.scale.set(0, 0, 0); // Start at zero scale

      this.scene.add(tree);

      // Add collision if collision system exists
      if (this.collisionSystem) {
        const collisionRadius = 0.3 * data.tree.scale;
        const collisionHeight = 5 * data.tree.scale;
        this.collisionSystem.addTreeCollider(
          data.tree.id,
          new THREE.Vector3(data.tree.x, treeY, data.tree.z),
          collisionRadius,
          collisionHeight
        );
      }

      // MVP 12: Track tree on minimap for 30 seconds (local player only)
      // Server sends ownerId at top level, not in tree object
      if (data.ownerId === this.playerId) {
        this.recentTrees.push({
          x: data.tree.x,
          z: data.tree.z,
          timestamp: Date.now()
        });
        console.log(`🌳 Tree tracked on minimap at(${data.tree.x.toFixed(1)}, ${data.tree.z.toFixed(1)}) - total: ${this.recentTrees.length} `);
      } else {
        console.log(`🌳 Tree grew but not local player's - ownerId: ${data.ownerId}, playerId: ${this.playerId}`);
      }

      // Animate growth: 0 → full scale over 3 seconds with easing
      const targetScale = data.tree.scale;
      const duration = 3000; // 3 seconds
      const startTime = performance.now();

      const animateGrowth = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic easing out (natural growth feel)
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentScale = eased * targetScale;

        tree.scale.set(currentScale, currentScale, currentScale);

        if (progress < 1) {
          requestAnimationFrame(animateGrowth);
        } else {
        }
      };

      animateGrowth();

      // MVP 9: Show celebration effects only to the owner
      if (data.ownerId === this.playerId) {
        // Big celebration with multiple VFX effects
        if (this.vfxManager) {
          // Massive sparkle burst at tree base
          this.vfxManager.spawnParticles('sparkle', tree.position, 80);

          // Confetti explosion for celebration
          const confettiPos = tree.position.clone();
          confettiPos.y += 2; // Higher up for better visibility
          this.vfxManager.spawnParticles('confetti', confettiPos, 100);

          // Screen shake for impact
          this.vfxManager.screenShake(0.2, 0.6);

          // Show big score popup
          this.vfxManager.showScorePopup(10, confettiPos);
        }

        // MVP 11: Play tree growth sound
        this.audioManager.playSound('player', 'tree_growth');

        // Show enthusiastic toast notification
        if (this.toastManager) {
          this.toastManager.success('🌳 YOUR TREE GREW! +10 points! 🌳', 4000);
        }

        // MVP 14: Show contextual tip on first tree growth
        this.showContextualTip('first_tree_grown', 'trees');
      } else {
        // Other players see subtle sparkles only
        if (this.vfxManager) {
          this.vfxManager.spawnParticles('sparkle', tree.position, 30);
        }
      }

    } catch (error) {
      console.error('Failed to load tree model for growth:', error);
    }
  }

  /**
   * MVP 14 Phase 9: Show contextual tip on first occurrence of an event
   * Uses dismissible TipCard (not toast) for better UX
   */
  private showContextualTip(eventKey: string, category: 'combat' | 'trees' | 'strategy' | 'basics'): void {
    const storageKey = `hiddenWalnuts_tip_${eventKey}`;
    const hasSeenTip = localStorage.getItem(storageKey);

    if (!hasSeenTip) {
      const tip = this.tipsManager.getRandomTipByCategory(category);
      if (tip) {
        // MVP 14 Phase 9: Use dismissible tip card (not toast)
        this.tipCard.show(tip.text, tip.emoji);
        this.tipsManager.markTipAsSeen(tip.id);
        localStorage.setItem(storageKey, 'true');
      }
    }
  }

  /**
   * MVP 16: Open the signup modal
   * Used by enticement CTAs (leaderboard, character selection, etc.)
   */
  public openSignupModal(): void {
    if (this.authModal) {
      this.authModal.open('signup');
    } else {
      console.error('❌ AuthModal not initialized');
    }
  }

  /**
   * MVP 16: Open the login modal
   * Used by existing users
   */
  public openLoginModal(): void {
    if (this.authModal) {
      this.authModal.open('login');
    } else {
      console.error('❌ AuthModal not initialized');
    }
  }

  /**
   * MVP 16: Show session expired banner
   * Called when API returns 401 (token expired mid-game)
   */
  public showSessionExpiredBanner(): void {
    if (this.sessionExpiredBanner && !this.sessionExpiredBanner.isVisible()) {
      this.sessionExpiredBanner.show();
    }
  }

}// MVP 16 Test: Innocuous client comment for workflow verification (post-branch switch)
// MVP 16 Test: Innocuous client comment for workflow verification (re-append post-branch switch)
