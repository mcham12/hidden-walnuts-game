/**
 * Character Preview Modal Component
 * MVP 16: Shows 3D character preview with description when clicking locked/available characters
 *
 * Features:
 * - 3D character model rendering with idle animation
 * - Character name and description
 * - Status-based CTA buttons:
 *   - Available: [Select Character]
 *   - Locked Free: [Sign Up to Unlock]
 *   - Locked Premium: [Coming Soon - $X.XX]
 * - Responsive across all platforms
 * - Close on backdrop click or X button
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterRegistry } from '../services/CharacterRegistry';

export interface CharacterPreviewOptions {
  characterId: string;
  isAvailable: boolean;
  isAuthenticated?: boolean;
  isEmailVerified?: boolean;
  onSelect?: (characterId: string) => void;
  onSignUp?: () => void;
  onVerify?: () => void;
  onClose?: () => void;
}

export class CharacterPreviewModal {
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private options: CharacterPreviewOptions;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private characterModel: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animationId: number | null = null;

  constructor(options: CharacterPreviewOptions) {
    this.options = options;
    this.createModal();
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    // Get or create overlay root
    let root = document.getElementById('overlay-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'overlay-root';
      document.body.appendChild(root);
    }
    this.container = root;

    // Create backdrop
    this.overlay = document.createElement('div');
    this.overlay.className = 'character-preview-modal';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      animation: fadeIn 0.3s ease;
    `;

    // Add animation styles
    this.addModalStyles();

    // Create content box
    const content = document.createElement('div');
    content.className = 'character-preview-content';
    content.style.cssText = `
      background: linear-gradient(135deg, #2d5f2e 0%, #4a8f4d 100%);
      border-radius: 16px;
      padding: 0;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      border: 3px solid rgba(255, 215, 0, 0.6);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      border: 2px solid rgba(255, 215, 0, 0.6);
      color: #FFD700;
      font-size: 24px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, background 0.2s;
      z-index: 10;
    `;
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.transform = 'scale(1.1)';
      closeButton.style.background = 'rgba(0, 0, 0, 0.7)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.transform = 'scale(1)';
      closeButton.style.background = 'rgba(0, 0, 0, 0.5)';
    });
    closeButton.addEventListener('click', () => this.close());

    // 3D preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'character-preview-3d';
    previewContainer.style.cssText = `
      width: 100%;
      height: 300px;
      position: relative;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 2px solid rgba(255, 215, 0, 0.3);
    `;

    // Info section
    const infoSection = document.createElement('div');
    infoSection.className = 'character-preview-info';
    infoSection.style.cssText = `
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    `;

    // Get character data
    const character = CharacterRegistry.getCharacterById(this.options.characterId);
    if (!character) {
      this.close();
      return;
    }

    // Character name
    const nameElement = document.createElement('h2');
    nameElement.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 28px;
      color: #FFD700;
      font-weight: 700;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    nameElement.textContent = character.name;

    // Character description
    const descriptionElement = document.createElement('p');
    descriptionElement.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #ffffff;
      line-height: 1.6;
    `;
    descriptionElement.textContent = character.description || 'A mysterious forest creature.';

    // Tier info
    const tierElement = document.createElement('div');
    tierElement.style.cssText = `
      margin-bottom: 20px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border: 2px solid rgba(255, 215, 0, 0.3);
    `;

    const tierLabel = document.createElement('div');
    tierLabel.style.cssText = `
      font-size: 14px;
      color: #FFD700;
      font-weight: 600;
      margin-bottom: 4px;
    `;

    const tierValue = document.createElement('div');
    tierValue.style.cssText = `
      font-size: 16px;
      color: #ffffff;
      font-weight: 700;
    `;

    // Fun & Free: All characters unlocked!
    tierLabel.textContent = 'Status';
    tierValue.textContent = '✅ Available';

    tierElement.appendChild(tierLabel);
    tierElement.appendChild(tierValue);

    // Action buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    `;

    // Fun & Free: Select button for ALL characters
    const selectButton = document.createElement('button');
    selectButton.style.cssText = `
        flex: 1;
        min-width: 200px;
        height: 50px;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        color: #2c5f2d;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
      `;
    selectButton.textContent = 'Select Character';
    selectButton.addEventListener('mouseenter', () => {
      selectButton.style.transform = 'scale(1.05)';
      selectButton.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.6)';
    });
    selectButton.addEventListener('mouseleave', () => {
      selectButton.style.transform = 'scale(1)';
      selectButton.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.4)';
    });
    selectButton.addEventListener('click', () => {
      this.options.onSelect?.(this.options.characterId);
      this.close();
    });
    buttonsContainer.appendChild(selectButton);

    // Assemble info section
    infoSection.appendChild(nameElement);
    infoSection.appendChild(descriptionElement);
    infoSection.appendChild(tierElement);
    infoSection.appendChild(buttonsContainer);

    // Assemble content
    content.appendChild(closeButton);
    content.appendChild(previewContainer);
    content.appendChild(infoSection);

    this.overlay.appendChild(content);
    this.container.appendChild(this.overlay);

    // Initialize 3D preview
    this.init3DPreview(previewContainer);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Close on backdrop click
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Close on ESC key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Add modal animation styles
   */
  private addModalStyles(): void {
    if (document.getElementById('character-preview-modal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'character-preview-modal-styles';
    style.textContent = `
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .character-preview-content {
          max-width: 95vw !important;
        }
        .character-preview-3d {
          height: 250px !important;
        }
      }

      @media (max-width: 430px) {
        .character-preview-content {
          max-width: 100vw !important;
          border-radius: 0 !important;
          max-height: 100vh !important;
        }
        .character-preview-3d {
          height: 200px !important;
        }
        .character-preview-info {
          padding: 16px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize 3D character preview
   */
  private async init3DPreview(container: HTMLElement): Promise<void> {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a3a1b);

    // Create camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 1, 3);
    this.camera.lookAt(0, 0.5, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 3, 2);
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-2, 1, -2);
    this.scene.add(fillLight);

    // Load character model
    await this.loadCharacter();

    // Start animation loop
    this.animate();

    // Handle window resize
    const handleResize = () => {
      if (!this.camera || !this.renderer || !container) return;
      const aspect = container.clientWidth / container.clientHeight;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
  }

  /**
   * Load character model and animations
   */
  private async loadCharacter(): Promise<void> {
    const character = CharacterRegistry.getCharacterById(this.options.characterId);
    if (!character || !this.scene) return;

    const loader = new GLTFLoader();

    try {
      // Load character model
      const gltf = await loader.loadAsync(character.modelPath);
      this.characterModel = gltf.scene;

      // Apply scale
      if (character.scale) {
        this.characterModel.scale.setScalar(character.scale);
      }

      // Center the model
      const box = new THREE.Box3().setFromObject(this.characterModel);
      const center = box.getCenter(new THREE.Vector3());
      this.characterModel.position.sub(center);
      this.characterModel.position.y = 0;

      this.scene.add(this.characterModel);

      // Load and play idle animation
      if (character.animations?.idle) {
        try {
          const animGltf = await loader.loadAsync(character.animations.idle);
          if (animGltf.animations && animGltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.characterModel);
            const action = this.mixer.clipAction(animGltf.animations[0]);
            action.play();
          }
        } catch (error) {
          console.warn('Could not load idle animation:', error);
        }
      }

      // Rotate character slowly
      this.animateCharacterRotation();
    } catch (error) {
      console.error('Error loading character preview:', error);
    }
  }

  /**
   * Animate character rotation
   */
  private animateCharacterRotation(): void {
    if (this.characterModel) {
      const rotationSpeed = 0.005;
      const animate = () => {
        if (!this.characterModel) return;
        this.characterModel.rotation.y += rotationSpeed;
      };
      // Store animation callback for cleanup
      (this.characterModel as any)._rotationAnimation = animate;
    }
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    // Update character rotation
    if (this.characterModel && (this.characterModel as any)._rotationAnimation) {
      (this.characterModel as any)._rotationAnimation();
    }

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(0.016); // ~60fps
    }

    // Render scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  /**
   * Close and clean up the modal
   */
  public close(): void {
    // Stop animation loop
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up Three.js resources
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    if (this.characterModel) {
      this.characterModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.characterModel = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;

    // Fade out and remove overlay
    if (this.overlay) {
      this.overlay.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        this.overlay?.remove();
      }, 300);
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Call close callback
    this.options.onClose?.();
  }

  /**
   * Show the modal (in case it was hidden)
   */
  public show(): void {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';
  }
}
