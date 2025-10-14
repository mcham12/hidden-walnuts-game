import { Game } from './Game';
import { AudioManager } from './AudioManager';
import { LoadingScreen } from './LoadingScreen';
import { SettingsManager } from './SettingsManager';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Character interface matching characters.json structure
interface Character {
  id: string;
  name: string;
  modelPath: string;
  animations: { [key: string]: string };
  scale: number;
  category: string;
  description?: string;
  emoteAnimations?: { [emoteId: string]: string };
}

// Character descriptions for the selection screen (dynamically loaded from characters.json)
let CHARACTER_DESCRIPTIONS: Record<string, { name: string; description: string; category: string }> = {};
let CHARACTERS: Character[] = [];

/**
 * Load characters from characters.json and populate dropdown
 */
async function loadCharactersAndPopulateDropdown(charSelect: HTMLSelectElement): Promise<void> {
  try {
    console.log('🎭 Loading characters.json...');
    const response = await fetch('/characters.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch characters.json: ${response.status}`);
    }
    CHARACTERS = await response.json();
    console.log('✅ Loaded', CHARACTERS.length, 'characters');

    // Populate CHARACTER_DESCRIPTIONS
    CHARACTERS.forEach(char => {
      CHARACTER_DESCRIPTIONS[char.id] = {
        name: char.name,
        description: char.description || '',
        category: char.category
      };
    });

    // Clear existing options
    charSelect.innerHTML = '';

    // Group characters by category
    const categories: Record<string, Character[]> = {};
    CHARACTERS.forEach(char => {
      if (!categories[char.category]) {
        categories[char.category] = [];
      }
      categories[char.category].push(char);
    });

    // Add optgroups and options
    const categoryOrder = ['mammal', 'reptile', 'bird', 'aquatic'];
    const categoryLabels: Record<string, string> = {
      'mammal': 'Mammals',
      'reptile': 'Reptiles',
      'bird': 'Birds',
      'aquatic': 'Aquatic'
    };

    categoryOrder.forEach(category => {
      if (categories[category] && categories[category].length > 0) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = categoryLabels[category] || category;

        categories[category].forEach(char => {
          const option = document.createElement('option');
          option.value = char.id;
          option.textContent = char.name;
          optgroup.appendChild(option);
        });

        charSelect.appendChild(optgroup);
      }
    });

    // Set default selection to first character (Squirrel)
    if (CHARACTERS.length > 0) {
      charSelect.value = CHARACTERS[0].id;
    }

    console.log('✅ Character dropdown populated with', CHARACTERS.length, 'characters');
  } catch (error) {
    console.error('❌ Failed to load characters.json:', error);
    // Fallback to hardcoded Squirrel
    CHARACTERS = [{
      id: 'squirrel',
      name: 'Squirrel',
      modelPath: '/assets/models/characters/Squirrel_LOD0.glb',
      animations: {
        idle: '/assets/models/characters/Animations/Single/Squirrel_Idle_A.glb',
        walk: '/assets/models/characters/Animations/Single/Squirrel_Walk.glb',
        run: '/assets/models/characters/Animations/Single/Squirrel_Run.glb',
        jump: '/assets/models/characters/Animations/Single/Squirrel_Jump.glb'
      },
      scale: 0.3,
      category: 'mammal',
      description: 'Agile forest dweller'
    }];
    CHARACTER_DESCRIPTIONS['squirrel'] = {
      name: 'Squirrel',
      description: 'Agile forest dweller',
      category: 'mammal'
    };
    charSelect.innerHTML = '<option value="squirrel">Squirrel</option>';
  }
}

// Character preview system
class CharacterPreview {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private currentModel: THREE.Group | null = null;
  private loader: GLTFLoader;
  private animationId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8f5e9);

    // Get proper canvas dimensions
    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 250;

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1.5, 4);
    this.camera.lookAt(0, 1, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Model loader
    this.loader = new GLTFLoader();
  }

  async loadCharacter(characterId: string): Promise<void> {
    try {
      // Find character in loaded characters data
      const char = CHARACTERS.find(c => c.id === characterId);
      if (!char) {
        console.error('❌ Character not found:', characterId);
        return;
      }

      const modelPath = char.modelPath;
      console.log('🎨 Loading preview model:', modelPath);

      const gltf = await this.loader.loadAsync(modelPath);

      // DEBUG: Check what's in the scene before removal
      console.log('🔍 Scene children before removal:', this.scene.children.length);

      // Remove ALL non-light objects from scene (nuclear option)
      const objectsToRemove: THREE.Object3D[] = [];
      this.scene.traverse((obj) => {
        if (!obj.isLight && obj !== this.scene) {
          objectsToRemove.push(obj);
        }
      });
      objectsToRemove.forEach(obj => {
        if (obj.parent) {
          obj.parent.remove(obj);
        }
      });

      console.log('🔍 Scene children after removal:', this.scene.children.length);

      // Use SkeletonUtils.clone() for proper cloning of animated models
      const modelClone = clone(gltf.scene);

      // Get bounds for centering and scaling
      const box = new THREE.Box3().setFromObject(modelClone);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      console.log('📦 Model bounds - size:', size, 'center:', center);

      // Create a wrapper group for clean transforms
      this.currentModel = new THREE.Group();

      // Center the clone within wrapper
      modelClone.position.set(-center.x, -center.y, -center.z);
      this.currentModel.add(modelClone);

      // Scale the wrapper to fit in view (target height reduced to fit window)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.2 / maxDim;
      this.currentModel.scale.setScalar(scale);

      this.scene.add(this.currentModel);
      console.log('✅ Preview model loaded:', characterId, 'scale:', scale);
      console.log('🔍 Scene children after adding new model:', this.scene.children.length);
    } catch (error) {
      console.error('❌ Failed to load preview model:', error);
    }
  }

  startAnimation(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      // Rotate the model
      if (this.currentModel) {
        this.currentModel.rotation.y += 0.01;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy(): void {
    this.stopAnimation();
    this.renderer.dispose();
  }
}

// MVP 5.7: On-screen debug overlay for iPad debugging (console not visible on iOS)
let debugOverlay: HTMLDivElement | null = null;
function showDebugMessage(message: string, isError = false) {
  if (!debugOverlay) {
    debugOverlay = document.createElement('div');
    debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      max-height: 300px;
      overflow-y: auto;
      background: rgba(0,0,0,0.9);
      color: ${isError ? '#ff4444' : '#00ff00'};
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 999999;
      border-radius: 4px;
      white-space: pre-wrap;
      word-wrap: break-word;
    `;
    document.body.appendChild(debugOverlay);
  }

  const timestamp = new Date().toLocaleTimeString();
  const prefix = isError ? '❌' : '✅';
  debugOverlay.textContent = `${prefix} [${timestamp}] ${message}\n` + (debugOverlay.textContent || '');
  console.log(message);
}

// MVP 5.7: Global error handler for debugging iPad and mobile issues
window.addEventListener('error', (event) => {
  const errorMsg = `ERROR: ${event.message} at ${event.filename}:${event.lineno}`;
  showDebugMessage(errorMsg, true);
  console.error('🚨 Global error caught:', event);
});

window.addEventListener('unhandledrejection', (event) => {
  const errorMsg = `PROMISE REJECTION: ${event.reason}`;
  showDebugMessage(errorMsg, true);
  console.error('🚨 Unhandled promise rejection:', event);
});

async function main() {
  try {
    showDebugMessage('Starting app...');

    // MVP 5.7: Add loading timeout with on-screen alert
    const loadingTimeout = setTimeout(() => {
      showDebugMessage('TIMEOUT! App hung for 30 seconds. Check last message.', true);
    }, 30000);

    // MVP 5: Show loading screen with animated walnut
    showDebugMessage('Creating LoadingScreen...');
    const loadingScreen = new LoadingScreen();
    await loadingScreen.show();
    showDebugMessage('LoadingScreen shown');

  const selectDiv = document.getElementById('character-select') as HTMLDivElement;
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const previewCanvas = document.getElementById('character-preview-canvas') as HTMLCanvasElement;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const charSelect = document.getElementById('char-select') as HTMLSelectElement;
  const charDescription = document.getElementById('char-description') as HTMLDivElement;
  const walnutHud = document.getElementById('walnut-hud') as HTMLDivElement;

  if (!canvas) {
    showDebugMessage('Canvas not found!', true);
    return;
  }

  canvas.classList.add('hidden');
  showDebugMessage('Canvas ready');

  // CRITICAL: Create AudioManager but DON'T wait for audio on iOS (will hang)
  loadingScreen.updateProgress(0.3, 'Loading audio...');
  showDebugMessage('Creating AudioManager...');
  const audioManager = new AudioManager();

  // MVP 5.7: iOS FIX - Skip audio wait on mobile (iOS requires user interaction)
  const isMobile = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  if (!isMobile) {
    showDebugMessage('Waiting for audio (desktop)...');
    await audioManager.waitForLoad();
    showDebugMessage('Audio loaded');
  } else {
    showDebugMessage('Skipping audio wait on mobile (iOS fix)');
  }

  // MVP 5: Load characters.json and populate dropdown
  loadingScreen.updateProgress(0.6, 'Loading characters...');
  showDebugMessage('Loading characters.json...');
  await loadCharactersAndPopulateDropdown(charSelect);
  showDebugMessage('Characters loaded');

  // Initialize character preview (works fine on mobile!)
  loadingScreen.updateProgress(0.8, 'Preparing character preview...');
  let characterPreview: CharacterPreview | null = null;
  if (previewCanvas) {
    showDebugMessage('Initializing character preview...');
    characterPreview = new CharacterPreview(previewCanvas);
    characterPreview.startAnimation();

    // Load initial character (Squirrel by default)
    showDebugMessage('Loading preview model...');
    await characterPreview.loadCharacter(charSelect.value);
    showDebugMessage('Character preview ready');
  }

  // Hide loading screen and show character selection
  loadingScreen.updateProgress(1.0, 'Ready!');
  showDebugMessage('Hiding loading screen...');

  // Clear timeout
  clearTimeout(loadingTimeout);

  setTimeout(() => {
    loadingScreen.hide();
    loadingScreen.destroy();
    showDebugMessage('Loading complete! Ready to play.');

    // Hide debug overlay after 3 seconds if no errors
    setTimeout(() => {
      if (debugOverlay && !debugOverlay.textContent?.includes('ERROR')) {
        debugOverlay.style.display = 'none';
      }
    }, 3000);
  }, 500);

  // MVP 5: Initialize settings manager
  const settingsManager = new SettingsManager(audioManager);

  // Update character description and preview when selection changes
  const updateCharacter = async () => {
    const selectedId = charSelect.value;
    const charInfo = CHARACTER_DESCRIPTIONS[selectedId];

    // MVP 5: Unlock audio on first user interaction (await to ensure context is ready)
    await audioManager.unlock();

    // MVP 5: Play UI sound for character selection
    audioManager.playSound('ui', 'button_click');

    // Update description
    if (charInfo && charDescription) {
      charDescription.innerHTML = `<strong>${charInfo.name}</strong> ${charInfo.description}`;
    }

    // Update preview
    if (characterPreview) {
      await characterPreview.loadCharacter(selectedId);
    }
  };

  // Set initial character description (before updateCharacter to avoid audio unlock)
  const initialCharInfo = CHARACTER_DESCRIPTIONS[charSelect.value];
  if (initialCharInfo && charDescription) {
    charDescription.innerHTML = `<strong>${initialCharInfo.name}</strong> ${initialCharInfo.description}`;
  }

  // Set initial character (note: skip audio unlock on first call)
  // updateCharacter();

  // Update on change
  charSelect.addEventListener('change', updateCharacter);

  startBtn.addEventListener('click', async () => {
    // Unlock audio on button click
    await audioManager.unlock();

    // Play start sound
    audioManager.playSound('ui', 'button_click');

    // Get selected character
    const selectedCharacterId = charSelect.value;
    console.log('🎮 Selected character:', selectedCharacterId);

    // Clean up preview
    if (characterPreview) {
      characterPreview.destroy();
      characterPreview = null;
    }

    selectDiv.classList.add('hidden');
    canvas.classList.remove('hidden');

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    // MVP 5: Show persistent control guide (desktop only)
    const controlGuide = document.getElementById('control-guide');
    const controlGuideClose = document.getElementById('control-guide-close');

    // MVP 5.7: Show touch controls hint on mobile
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|windows phone/i.test(navigator.userAgent.toLowerCase()) ||
                     ('ontouchstart' in window && window.innerWidth < 768);

    if (isMobile) {
      // Show touch controls hint on mobile
      const touchHint = document.getElementById('touch-controls-hint');
      if (touchHint) {
        const touchHintDismissed = localStorage.getItem('touchHintDismissed');
        if (!touchHintDismissed) {
          touchHint.classList.remove('hidden');

          // Add click handler to dismiss
          touchHint.addEventListener('click', () => {
            touchHint.classList.add('hidden');
            localStorage.setItem('touchHintDismissed', 'true');
            audioManager.playSound('ui', 'button_click');
          });
        }
      }
    } else {
      // Show desktop control guide
      if (controlGuide) {
        const dismissed = localStorage.getItem('controlGuideDismissed');
        if (!dismissed) {
          controlGuide.classList.remove('hidden');
        }

        // Add close button handler
        if (controlGuideClose) {
          controlGuideClose.addEventListener('click', () => {
            controlGuide.classList.add('hidden');
            localStorage.setItem('controlGuideDismissed', 'true');
            audioManager.playSound('ui', 'button_click');
          });
        }
      }
    }

    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    await game.init(canvas, audioManager, settingsManager);
    game.start();

    // Show settings button after game starts
    settingsManager.show();
  });
  } catch (error) {
    console.error('🚨 Fatal error in main():', error);
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(255,0,0,0.9);color:white;padding:20px;border-radius:8px;font-family:Arial;text-align:center;z-index:10000;';
    errorDiv.innerHTML = `
      <h2>Error Loading Game</h2>
      <p>Please try refreshing the page.</p>
      <p style="font-size:12px;opacity:0.8;">${error instanceof Error ? error.message : 'Unknown error'}</p>
    `;
    document.body.appendChild(errorDiv);
  }
}

main().catch((error) => {
  console.error('🚨 Unhandled error in main():', error);
});