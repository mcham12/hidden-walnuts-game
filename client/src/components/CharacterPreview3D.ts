/**
 * CharacterPreview3D - Reusable 3D character preview component
 *
 * Creates a Three.js scene to display a character model with idle animation
 * and automatic rotation. Can be embedded in any HTML container.
 *
 * Based on CharacterPreviewModal.ts implementation
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterRegistry } from '../services/CharacterRegistry';

export interface CharacterPreview3DOptions {
  rotationSpeed?: number;      // Radians per frame (default: 0.005)
  autoRotate?: boolean;         // Enable auto-rotation (default: true)
  cameraDistance?: number;      // Distance from character (default: 3)
  showAnimation?: boolean;      // Play idle animation (default: true)
  initialRotation?: number;     // Initial rotation in radians (default: 0)
}

export class CharacterPreview3D {
  private containerId: string;
  private characterId: string;
  private options: Required<CharacterPreview3DOptions>;

  // Three.js components
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private character: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animationId: number | null = null;
  private loader: GLTFLoader = new GLTFLoader();

  constructor(containerId: string, characterId: string, options?: CharacterPreview3DOptions) {
    this.containerId = containerId;
    this.characterId = characterId;
    this.options = {
      rotationSpeed: options?.rotationSpeed ?? 0.005,
      autoRotate: options?.autoRotate ?? true,
      cameraDistance: options?.cameraDistance ?? 3,
      showAnimation: options?.showAnimation ?? true,
      initialRotation: options?.initialRotation ?? 0
    };
  }

  /**
   * Initialize the 3D preview scene
   */
  async init(): Promise<void> {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container ${this.containerId} not found`);
      return;
    }

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a3a1b); // Dark green forest background

    // Create camera
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 1, this.options.cameraDistance);
    this.camera.lookAt(0, 0.5, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    // Load character
    await this.loadCharacter(this.characterId);

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Load a character model
   */
  private async loadCharacter(characterId: string): Promise<void> {
    const characterData = CharacterRegistry.getCharacterById(characterId);
    if (!characterData) {
      console.error(`Character ${characterId} not found in registry`);
      return;
    }

    // Clear existing character
    if (this.character && this.scene) {
      this.scene.remove(this.character);
      this.character = null;
    }

    // Stop existing animation
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    try {
      // Load GLTF model
      const gltf = await this.loader.loadAsync(characterData.modelPath);
      this.character = gltf.scene;

      // Position and scale
      this.character.position.set(0, 0, 0);
      this.character.scale.set(1, 1, 1);

      // Apply initial rotation
      this.character.rotation.y = this.options.initialRotation;

      if (this.scene) {
        this.scene.add(this.character);
      }

      // Load and play idle animation if enabled
      if (this.options.showAnimation && characterData.animations.idle) {
        try {
          const animGltf = await this.loader.loadAsync(characterData.animations.idle);
          if (animGltf.animations && animGltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.character);
            const action = this.mixer.clipAction(animGltf.animations[0]);
            action.play();
          }
        } catch (error) {
          console.warn(`Could not load idle animation for ${characterId}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error loading character ${characterId}:`, error);
    }
  }

  /**
   * Switch to a different character (for carousel)
   */
  async switchCharacter(characterId: string): Promise<void> {
    this.characterId = characterId;
    await this.loadCharacter(characterId);
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(0.016); // ~60fps
    }

    // Auto-rotate character
    if (this.character && this.options.autoRotate) {
      this.character.rotation.y += this.options.rotationSpeed;
    }

    // Render scene
    if (this.scene && this.camera && this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    const container = document.getElementById(this.containerId);
    if (!container || !this.camera || !this.renderer) return;

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Cleanup and destroy resources
   */
  destroy(): void {
    // Stop animation loop
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Stop animation mixer
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    // Remove character from scene
    if (this.character && this.scene) {
      this.scene.remove(this.character);
      this.character = null;
    }

    // Dispose renderer
    if (this.renderer) {
      const container = document.getElementById(this.containerId);
      if (container && this.renderer.domElement.parentElement === container) {
        container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
      this.renderer = null;
    }

    // Clear scene
    this.scene = null;
    this.camera = null;

    // Remove resize listener
    window.removeEventListener('resize', this.handleResize);
  }
}
