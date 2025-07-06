import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CharacterSelectionManager } from '../core/CharacterSelectionManager';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { EventBus } from '../core/EventBus';
import { CharacterGallery } from '../ui/CharacterGallery';
import { CharacterPreview } from '../ui/CharacterPreview';

// Mock Three.js WebGLRenderer to avoid WebGL context errors in tests
vi.mock('three', () => ({
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: 0 }
  })),
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    children: [],
    background: null,
    fog: null
  })),
  PerspectiveCamera: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn()
  })),
  AmbientLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() }
  })),
  DirectionalLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: { mapSize: { width: 1024, height: 1024 }, camera: { near: 0.5, far: 50, left: -5, right: 5, top: 5, bottom: -5 } }
  })),
  Color: vi.fn().mockImplementation(() => ({})),
  Fog: vi.fn().mockImplementation(() => ({})),
  Box3: vi.fn().mockImplementation(() => ({
    setFromObject: vi.fn().mockReturnThis(),
    getCenter: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
    min: { y: 0 },
    max: { y: 1 }
  })),
  Vector3: vi.fn().mockImplementation(() => ({ x: 0, y: 0, z: 0, sub: vi.fn() })),
  BoxGeometry: vi.fn().mockImplementation(() => ({})),
  MeshBasicMaterial: vi.fn().mockImplementation(() => ({})),
  Mesh: vi.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    traverse: vi.fn(),
    castShadow: false,
    receiveShadow: false
  })),
  Object3D: vi.fn().mockImplementation(() => ({
    position: { x: 0, y: 0, z: 0 },
    rotation: { y: 0 },
    children: [],
    add: vi.fn(),
    remove: vi.fn(),
    traverse: vi.fn()
  })),
  PCFSoftShadowMap: 2
}));

// Mock minimal character config
const mockCharacter = {
  id: 'colobus',
  name: 'Colobus',
  modelPath: '/assets/models/Colobus_LOD0.glb',
  scale: 1,
  lodPaths: { lod0: '', lod1: '', lod2: '', lod3: '' },
  animations: {
    idle_a: 'idle_a', idle_b: 'idle_b', idle_c: 'idle_c', walk: 'walk', run: 'run', jump: 'jump', swim: 'swim', fly: 'fly', roll: 'roll', bounce: 'bounce', spin: 'spin', eat: 'eat', clicked: 'clicked', fear: 'fear', death: 'death', sit: 'sit'
  },
  blendshapes: {
    eyes_blink: '', eyes_happy: '', eyes_sad: '', eyes_annoyed: '', eyes_squint: '', eyes_shrink: '', eyes_dead: '', eyes_lookOut: '', eyes_lookIn: '', eyes_lookUp: '', eyes_lookDown: '', eyes_excited_1: '', eyes_excited_2: '', eyes_rabid: '', eyes_spin_1: '', eyes_spin_2: '', eyes_spin_3: '', eyes_cry_1: '', eyes_cry_2: '', eyes_trauma: '', teardrop_1_L: '', teardrop_2_L: '', teardrop_1_R: '', teardrop_2_R: '', sweat_1_L: '', sweat_2_L: '', sweat_1_R: '', sweat_2_R: ''
  },
  behaviors: {
    isPlayer: true, isNPC: false, movementSpeed: 1.2, jumpHeight: 1.1, canSwim: false, canFly: false, aiBehaviors: ['idle', 'walk']
  },
  network: { syncAnimations: true, compressionLevel: 0.5 }
};

class MockCharacterRegistry {
  getAllCharacters() { return [mockCharacter]; }
  getCharacter(_id: string) { return mockCharacter; }
}

describe('CharacterSelectionManager', () => {
  let manager: CharacterSelectionManager;
  let registry: CharacterRegistry;
  let eventBus: EventBus;

  beforeEach(() => {
    registry = new MockCharacterRegistry() as any;
    eventBus = new EventBus();
    manager = new CharacterSelectionManager(registry, eventBus);
    localStorage.clear();
  });

  it('persists and retrieves selected character', () => {
    manager.setSelectedCharacter('colobus');
    expect(manager.getSelectedCharacter()).toBe('colobus');
  });

  it('returns default if none selected', () => {
    expect(manager.getSelectedCharacterOrDefault()).toBe('colobus');
  });

  it('validates character selection', () => {
    const result = manager.validateCharacterSelection('colobus');
    expect(result.isValid).toBe(true);
  });
});

describe('CharacterGallery', () => {
  let gallery: CharacterGallery;
  let registry: CharacterRegistry;
  let manager: CharacterSelectionManager;
  let eventBus: EventBus;
  let container: HTMLElement;

  beforeEach(() => {
    registry = new MockCharacterRegistry() as any;
    eventBus = new EventBus();
    manager = new CharacterSelectionManager(registry, eventBus);
    container = document.createElement('div');
    document.body.appendChild(container);
    gallery = new CharacterGallery({
      containerElement: container,
      showPreviews: false,
      previewSize: { width: 100, height: 100 },
      layoutMode: 'grid',
      charactersPerRow: 1,
      enableSearch: false,
      enableFilters: false,
      allowMultiSelect: false,
      theme: 'auto'
    }, registry, manager, {} as any, eventBus);
  });

  it('renders character cards', () => {
    expect(container.querySelectorAll('.character-card').length).toBeGreaterThan(0);
  });

  it('shows selection feedback', () => {
    gallery.showCharacterGallery();
    const selected = container.querySelector('.character-card.selected');
    expect(selected).not.toBeNull();
  });
});

describe('CharacterPreview', () => {
  it('can be constructed and disposed', () => {
    const container = document.createElement('div');
    const preview = new CharacterPreview(container, 'colobus', {}, {} as any);
    expect(container.children.length).toBeGreaterThan(0);
    preview.dispose();
    expect(container.children.length).toBe(0);
  });
}); 