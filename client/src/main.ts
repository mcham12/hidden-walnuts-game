import { Game } from './Game';
import { AudioManager } from './AudioManager';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
    // Remove current model
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this.currentModel = null;
    }

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
      this.currentModel = gltf.scene;

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(this.currentModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      console.log('📦 Model bounds - size:', size, 'center:', center);

      // Center the model at origin
      this.currentModel.position.set(-center.x, -center.y, -center.z);

      // Scale to fit in view (target height of about 2 units)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.5 / maxDim;
      this.currentModel.scale.setScalar(scale);

      this.scene.add(this.currentModel);
      console.log('✅ Preview model loaded:', characterId, 'scale:', scale);
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

async function main() {
  const selectDiv = document.getElementById('character-select') as HTMLDivElement;
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const previewCanvas = document.getElementById('character-preview-canvas') as HTMLCanvasElement;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const charSelect = document.getElementById('char-select') as HTMLSelectElement;
  const charDescription = document.getElementById('char-description') as HTMLDivElement;
  const walnutHud = document.getElementById('walnut-hud') as HTMLDivElement;

  // MVP 5: Create audio manager for UI sounds
  const audioManager = new AudioManager();

  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  canvas.classList.add('hidden');

  // MVP 5: Load characters.json and populate dropdown
  await loadCharactersAndPopulateDropdown(charSelect);

  // Initialize character preview
  let characterPreview: CharacterPreview | null = null;
  if (previewCanvas) {
    console.log('🎨 Initializing character preview...');
    characterPreview = new CharacterPreview(previewCanvas);
    characterPreview.startAnimation();

    // Load initial character (Squirrel by default)
    console.log('🎨 Loading initial character:', charSelect.value);
    await characterPreview.loadCharacter(charSelect.value);
  } else {
    console.error('❌ Preview canvas not found!');
  }

  // Update character description and preview when selection changes
  const updateCharacter = async () => {
    const selectedId = charSelect.value;
    const charInfo = CHARACTER_DESCRIPTIONS[selectedId];

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

  // Set initial character
  updateCharacter();

  // Update on change
  charSelect.addEventListener('change', updateCharacter);

  startBtn.addEventListener('click', async () => {
    // MVP 5: Play UI sound for start button
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

    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    await game.init(canvas);
    game.start();
  });
}

main().catch(console.error);