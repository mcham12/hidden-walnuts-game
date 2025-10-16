import { Game } from './Game';
import { AudioManager } from './AudioManager';
import { LoadingScreen } from './LoadingScreen';
import { WelcomeScreen } from './WelcomeScreen';
import { SettingsManager } from './SettingsManager';
import { TouchControls } from './TouchControls';
import { SessionManager } from './SessionManager'; // MVP 6: Player identity
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

// MVP 5.7: Global error handler for debugging
window.addEventListener('error', (event) => {
  console.error('🚨 Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise
  });
});

/**
 * MVP 6: Check if username exists and link sessionToken
 * FIXED: Pass username as query param (not sessionToken)
 * Returns: { exists: boolean, characterId?: string }
 */
async function checkExistingUsername(username: string, sessionToken: string): Promise<{ exists: boolean; characterId?: string }> {
  try {
    console.log(`🔍 DEBUG: checkExistingUsername("${username}", "${sessionToken.substring(0, 8)}...")`);
    const response = await fetch(`/api/identity?action=check&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
    console.log('🔍 DEBUG: Response status:', response.status);
    if (!response.ok) {
      console.error('❌ Failed to check username:', response.status);
      return { exists: false };
    }
    const data = await response.json();
    console.log('🔍 DEBUG: Response data:', data);
    const result = {
      exists: data.exists || false,
      characterId: data.lastCharacterId || undefined // FIXED: Explicitly handle null
    };
    console.log('🔍 DEBUG: Returning:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to check username:', error);
    return { exists: false };
  }
}

/**
 * MVP 6: Create new username identity
 * FIXED: Pass username as query param
 */
async function saveUsername(username: string, sessionToken: string): Promise<void> {
  try {
    console.log(`💾 DEBUG: saveUsername("${username}", "${sessionToken.substring(0, 8)}...")`);
    const response = await fetch(`/api/identity?action=set&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionToken })
    });

    console.log('💾 DEBUG: Response status:', response.status);
    if (!response.ok) {
      console.error('❌ Failed to save username:', response.status);
    } else {
      const data = await response.json();
      console.log('💾 DEBUG: Response data:', data);
      console.log('✅ Username saved to server');
    }
  } catch (error) {
    console.error('❌ Failed to save username:', error);
  }
}

/**
 * MVP 6: Try to load username from localStorage
 * Returns null if not available (private browsing or new user)
 */
function loadStoredUsername(): string | null {
  try {
    const username = localStorage.getItem('hw_username');
    console.log(`📦 DEBUG: loadStoredUsername() returned: ${username ? `"${username}"` : 'null'}`);
    return username;
  } catch (e) {
    console.warn('⚠️ localStorage not available (private browsing?)');
    return null;
  }
}

/**
 * MVP 6: Save username to localStorage (for convenience)
 */
function storeUsername(username: string): void {
  try {
    localStorage.setItem('hw_username', username);
    console.log(`💾 DEBUG: storeUsername("${username}") - saved to localStorage`);
  } catch (e) {
    console.warn('⚠️ localStorage not available (private browsing?)');
  }
}

/**
 * MVP 6: Update character selection on server
 */
async function updateCharacterSelection(username: string, characterId: string): Promise<void> {
  try {
    console.log(`🎮 DEBUG: updateCharacterSelection("${username}", "${characterId}")`);
    const response = await fetch(`/api/identity?action=updateCharacter&username=${encodeURIComponent(username)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId })
    });

    console.log('🎮 DEBUG: Response status:', response.status);
    if (!response.ok) {
      console.error('❌ Failed to update character:', response.status);
    } else {
      const data = await response.json();
      console.log('🎮 DEBUG: Response data:', data);
      console.log('✅ Character selection saved to server:', characterId);
    }
  } catch (error) {
    console.error('❌ Failed to update character:', error);
  }
}

async function main() {
  try {
    // MVP 6: STEP 0 - Initialize session management
    console.log('🔐 Step 0: Initializing session...');
    const sessionManager = new SessionManager();
    const sessionToken = sessionManager.getToken();
    console.log('✅ Session token ready');

    // MVP 6: STEP 1 - Try to load username from localStorage
    console.log('🔍 Step 1: Checking for stored username...');
    const storedUsername = loadStoredUsername();

    let username: string;
    let savedCharacterId: string | undefined;

    if (storedUsername) {
      // Found username in localStorage - check if it still exists on server
      console.log('📦 Found stored username:', storedUsername);
      const result = await checkExistingUsername(storedUsername, sessionToken);

      if (result.exists) {
        // Username exists on server - show welcome back and link sessionToken
        console.log('✅ Username verified, linking session...');
        console.log(`🎮 DEBUG: savedCharacterId from server: ${result.characterId ? `"${result.characterId}"` : 'undefined'}`);
        const welcomeScreen = new WelcomeScreen();
        await welcomeScreen.showWelcomeBack(storedUsername);
        await welcomeScreen.hide();
        welcomeScreen.destroy();
        username = storedUsername;
        savedCharacterId = result.characterId;
        console.log(`🎮 DEBUG: savedCharacterId assigned: ${savedCharacterId ? `"${savedCharacterId}"` : 'undefined'}`);
      } else {
        // Username doesn't exist on server anymore - prompt for new username
        console.log('⚠️ Stored username not found on server, prompting for new username');
        const welcomeScreen = new WelcomeScreen();
        username = await welcomeScreen.show();
        console.log('👤 Username entered:', username);

        // Check if this new username exists or create it
        const newResult = await checkExistingUsername(username, sessionToken);
        if (!newResult.exists) {
          await saveUsername(username, sessionToken);
        }
        savedCharacterId = newResult.characterId;

        // Store new username locally
        storeUsername(username);

        await welcomeScreen.hide();
        welcomeScreen.destroy();
      }
    } else {
      // No stored username (new user or private browsing) - prompt for username
      console.log('🆕 No stored username - prompting...');
      const welcomeScreen = new WelcomeScreen();
      username = await welcomeScreen.show();
      console.log('👤 Username entered:', username);

      // Check if username exists on server (private browsing case!)
      const result = await checkExistingUsername(username, sessionToken);

      if (result.exists) {
        // Username exists! This is a returning user in private browsing
        console.log('✅ Username exists on server - linking session');
        savedCharacterId = result.characterId;
        // Session already linked by checkExistingUsername call
      } else {
        // New username - create identity
        console.log('🆕 Creating new identity');
        await saveUsername(username, sessionToken);
      }

      // Store username locally (for convenience next time)
      storeUsername(username);

      await welcomeScreen.hide();
      welcomeScreen.destroy();
    }

    // MVP 6: STEP 2 - Character selection (skip if returning user with saved character)
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const walnutHud = document.getElementById('walnut-hud') as HTMLDivElement;

    if (!canvas) {
      console.error('Canvas not found');
      return;
    }

    canvas.classList.add('hidden');

    // Initialize audio manager (don't load sounds yet - will load when game starts)
    const audioManager = new AudioManager();

    // Initialize settings manager
    const settingsManager = new SettingsManager(audioManager);

    let selectedCharacterId: string;

    // Check if user has saved character
    console.log(`🎮 DEBUG: Checking savedCharacterId: ${savedCharacterId ? `"${savedCharacterId}"` : 'undefined'}`);
    if (savedCharacterId) {
      // Returning user with saved character - skip selection!
      console.log('✅ Using saved character, SKIPPING selection:', savedCharacterId);
      selectedCharacterId = savedCharacterId;
    } else {
      // New user or no saved character - show character selection
      console.log('🌲 Step 2: SHOWING character selection (no saved character)...');
      const selectDiv = document.getElementById('character-select') as HTMLDivElement;
      const previewCanvas = document.getElementById('character-preview-canvas') as HTMLCanvasElement;
      const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
      const charSelect = document.getElementById('char-select') as HTMLSelectElement;
      const charDescription = document.getElementById('char-description') as HTMLDivElement;

      // Load characters.json (tiny, instant)
      await loadCharactersAndPopulateDropdown(charSelect);
      console.log('✅ Characters loaded');

      // Show character selection
      selectDiv.classList.remove('hidden');

      // Initialize character preview
      let characterPreview: CharacterPreview | null = null;
      if (previewCanvas) {
        characterPreview = new CharacterPreview(previewCanvas);
        characterPreview.startAnimation();
        await characterPreview.loadCharacter(charSelect.value);
      }

      // Update character description and preview when selection changes
      const updateCharacter = async () => {
        const selectedId = charSelect.value;
        const charInfo = CHARACTER_DESCRIPTIONS[selectedId];

        // MVP 5: Unlock audio on first user interaction
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

      // Update on change
      charSelect.addEventListener('change', updateCharacter);

      // Wait for user to click start button
      selectedCharacterId = await new Promise<string>((resolve) => {
        startBtn.addEventListener('click', async () => {
          // Unlock audio on button click
          await audioManager.unlock();

          // Play start sound
          audioManager.playSound('ui', 'button_click');

          // Get selected character
          const charId = charSelect.value;
          console.log('🎮 Selected character:', charId);

          // Save character selection to server
          await updateCharacterSelection(username, charId);

          // Clean up preview
          if (characterPreview) {
            characterPreview.destroy();
            characterPreview = null;
          }

          // Hide character selection
          selectDiv.classList.add('hidden');

          resolve(charId);
        });
      });
    }

    // MVP 6: STEP 3 - Show SINGLE loading screen and load ALL game assets
    console.log('🌲 Step 3: Loading game assets...');
    const loadingScreen = new LoadingScreen();
    await loadingScreen.show(); // Sets to 0% immediately

    // Start loading audio
    loadingScreen.updateProgress(0.1, 'Loading audio...');
    await audioManager.waitForLoad();
    console.log('✅ Audio loaded');

    // Audio complete
    loadingScreen.updateProgress(0.5, 'Preparing game world...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Almost ready
    loadingScreen.updateProgress(0.9, 'Almost ready...');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete loading
    loadingScreen.updateProgress(1.0, 'Ready!');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Hide loading screen
    loadingScreen.hide();
    loadingScreen.destroy();

    // Show game
    canvas.classList.remove('hidden');

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    // MVP 5: Show persistent control guide (desktop only)
    const controlGuide = document.getElementById('control-guide');
    const controlGuideClose = document.getElementById('control-guide-close');

    // MVP 5.7: Use TouchControls.isMobile() for consistent, reliable detection
    // This properly detects modern iPads (which report as Mac in user agent)
    const isMobile = TouchControls.isMobile();

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

      // MVP 5.7: Show mobile action buttons on mobile
      const mobileActions = document.getElementById('mobile-actions');
      if (mobileActions) {
        mobileActions.classList.add('visible');
        console.log('✅ Mobile action buttons shown');
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
    game.sessionToken = sessionToken; // MVP 6: Pass session token
    game.username = username; // MVP 6: Pass username
    await game.init(canvas, audioManager, settingsManager);
    game.start();

    // Show settings button after game starts
    settingsManager.show();
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