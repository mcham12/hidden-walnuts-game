import * as THREE from 'three';
import { Logger, LogCategory } from '../core/Logger';
import { AnimatedModelLoader } from '../entities/AnimatedModelLoader';
import { AnimationController } from '../core/AnimationController';
import { 
  CharacterPreview as ICharacterPreview, 
  CharacterPreviewOptions
} from '../types/CharacterSelectionTypes';
import { AnimatedModel } from '../types/AnimationTypes';

/**
 * CharacterPreview
 * Handles 3D rendering of character models for selection UI
 */
export class CharacterPreview {
  private container: HTMLElement;
  private options: CharacterPreviewOptions;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationController?: AnimationController;
  private animatedModel?: AnimatedModel;
  
  private characterType: string;
  private isLoaded: boolean = false;
  private isDisposed: boolean = false;
  private isPlaying: boolean = false;
  private currentAnimation: string = 'idle_a';
  private lastUpdate: number = 0;
  
  // Animation cycling
  private animationCycleIndex: number = 0;
  private lastAnimationChange: number = 0;
  
  // Interaction handling
  private isMouseDown: boolean = false;
  private mousePosition: { x: number; y: number } = { x: 0, y: 0 };
  private cameraRotation: { x: number; y: number } = { x: 0, y: 0.3 };
  
  // Auto-rotation
  private autoRotationAngle: number = 0;
  
  // Lighting
  private ambientLight!: THREE.AmbientLight;
  private directionalLight!: THREE.DirectionalLight;
  
  private modelLoader: AnimatedModelLoader;

  constructor(
    container: HTMLElement,
    characterType: string,
    options: Partial<CharacterPreviewOptions>,
    modelLoader: AnimatedModelLoader
  ) {
    this.container = container;
    this.characterType = characterType;
    this.modelLoader = modelLoader;
    
    // Set up options with defaults
    this.options = {
      width: options.width || 200,
      height: options.height || 200,
      enableAnimations: options.enableAnimations !== false,
      enableRotation: options.enableRotation !== false,
      backgroundType: options.backgroundType || 'transparent',
      backgroundColor: options.backgroundColor || '#f0f0f0',
      cameraDistance: options.cameraDistance || 2.5,
      autoRotateSpeed: options.autoRotateSpeed || 0.005,
      enableInteraction: options.enableInteraction !== false,
      animationCycle: options.animationCycle || ['idle_a', 'idle_b', 'idle_c', 'walk'],
      animationDuration: options.animationDuration || 3000
    };

    this.initializeScene();
    this.setupLighting();
    this.setupInteraction();
    this.startRenderLoop();
    
    Logger.debug(LogCategory.CORE, `[CharacterPreview] Created for ${characterType}`);
  }

  /**
   * Load and display the character model
   */
  async loadCharacter(): Promise<void> {
    if (this.isDisposed) return;

    try {
      Logger.debug(LogCategory.CORE, `[CharacterPreview] Loading character: ${this.characterType}`);
      
      // Load the animated model
      this.animatedModel = await this.modelLoader.loadCharacterModel(this.characterType, {
        lodLevel: 0, // Use highest quality for preview
        enableCaching: true,
        validateModel: true
      });

      // Create animation controller
      this.animationController = new AnimationController(
        this.animatedModel.model,
        this.animatedModel.config,
        `preview_${this.characterType}`
      );

      // Add model to scene
      this.scene.add(this.animatedModel.model);

      // Position the model
      this.positionModel();

      // Start animations if enabled
      if (this.options.enableAnimations) {
        this.startAnimationCycle();
      }

      this.isLoaded = true;
      this.isPlaying = this.options.enableAnimations;

      Logger.info(LogCategory.CORE, `[CharacterPreview] Character loaded: ${this.characterType}`);
      
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterPreview] Failed to load character: ${this.characterType}`, error);
      this.showErrorState();
    }
  }

  /**
   * Start the animation cycle
   */
  startAnimationCycle(): void {
    if (!this.animationController || !this.options.enableAnimations) return;

    const animation = this.options.animationCycle[this.animationCycleIndex];
    this.playAnimation(animation);
    this.lastAnimationChange = performance.now();
  }

  /**
   * Play a specific animation
   */
  playAnimation(animationName: string): void {
    if (!this.animationController) return;

    try {
      const success = this.animationController.playAnimation(animationName);
      if (success) {
        this.currentAnimation = animationName;
        this.isPlaying = true;
        Logger.debug(LogCategory.CORE, `[CharacterPreview] Playing animation: ${animationName}`);
      }
    } catch (error) {
      Logger.warn(LogCategory.CORE, `[CharacterPreview] Failed to play animation: ${animationName}`, error);
    }
  }

  /**
   * Stop all animations
   */
  stopAnimations(): void {
    if (this.animationController) {
      this.animationController.stopAnimation();
      this.isPlaying = false;
    }
  }

  /**
   * Resume animations
   */
  resumeAnimations(): void {
    if (this.animationController && this.options.enableAnimations) {
      this.startAnimationCycle();
    }
  }

  /**
   * Update the preview (called in render loop)
   */
  update(deltaTime: number): void {
    if (!this.isLoaded || this.isDisposed) return;

    // Update animation controller
    if (this.animationController && this.isPlaying) {
      this.animationController.update(deltaTime);
    }

    // Handle animation cycling
    if (this.options.enableAnimations && this.options.animationCycle.length > 1) {
      const now = performance.now();
      if (now - this.lastAnimationChange > this.options.animationDuration) {
        this.cycleToNextAnimation();
        this.lastAnimationChange = now;
      }
    }

    // Auto-rotation
    if (this.options.enableRotation && this.animatedModel && !this.isMouseDown) {
      this.autoRotationAngle += this.options.autoRotateSpeed;
      this.animatedModel.model.rotation.y = this.autoRotationAngle + this.cameraRotation.y;
    }

    // Update camera based on interaction
    this.updateCamera();
  }

  /**
   * Resize the preview
   */
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * Show error state when model fails to load
   */
  private showErrorState(): void {
    // Create a simple error display
    const errorGeometry = new THREE.BoxGeometry(1, 1, 1);
    const errorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const errorMesh = new THREE.Mesh(errorGeometry, errorMaterial);
    
    this.scene.add(errorMesh);
    Logger.warn(LogCategory.CORE, `[CharacterPreview] Showing error state for ${this.characterType}`);
  }

  /**
   * Initialize the Three.js scene
   */
  private initializeScene(): void {
    // Create scene
    this.scene = new THREE.Scene();
    
    // Set background
    if (this.options.backgroundType === 'color') {
      this.scene.background = new THREE.Color(this.options.backgroundColor);
    } else if (this.options.backgroundType === 'gradient') {
      // Simple gradient using fog
      this.scene.fog = new THREE.Fog(0x1e3a8a, 2, 15);
      this.scene.background = new THREE.Color(0x3b82f6);
    }
    // transparent background = no scene.background

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      50, // fov
      this.options.width / this.options.height, // aspect
      0.1, // near
      100 // far
    );
    
    this.camera.position.set(0, 1, this.options.cameraDistance);
    this.camera.lookAt(0, 0.5, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: this.options.backgroundType === 'transparent' 
    });
    
    this.renderer.setSize(this.options.width, this.options.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add renderer to container
    this.container.appendChild(this.renderer.domElement);
  }

  /**
   * Set up lighting for the scene
   */
  private setupLighting(): void {
    // Ambient light for overall illumination
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    // Directional light for definition and shadows
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(2, 4, 3);
    this.directionalLight.castShadow = true;
    
    // Configure shadow map
    this.directionalLight.shadow.mapSize.width = 1024;
    this.directionalLight.shadow.mapSize.height = 1024;
    this.directionalLight.shadow.camera.near = 0.5;
    this.directionalLight.shadow.camera.far = 50;
    this.directionalLight.shadow.camera.left = -5;
    this.directionalLight.shadow.camera.right = 5;
    this.directionalLight.shadow.camera.top = 5;
    this.directionalLight.shadow.camera.bottom = -5;
    
    this.scene.add(this.directionalLight);
  }

  /**
   * Set up mouse/touch interaction
   */
  private setupInteraction(): void {
    if (!this.options.enableInteraction) return;

    const canvas = this.renderer.domElement;

    // Mouse events
    canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    canvas.addEventListener('wheel', this.onWheel.bind(this));

    // Touch events for mobile
    canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Position the model in the scene
   */
  private positionModel(): void {
    if (!this.animatedModel) return;

    const model = this.animatedModel.model;
    
    // Center the model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    // Scale the model to fit nicely in the preview
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const targetSize = 2.0; // Target size for preview
    const scale = targetSize / maxSize;
    model.scale.setScalar(scale);

    // Recalculate box after scaling
    const scaledBox = new THREE.Box3().setFromObject(model);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
    model.position.sub(scaledCenter);

    // Position slightly above ground
    model.position.y = -scaledBox.min.y;

    // Enable shadow casting/receiving
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Cycle to the next animation in the sequence
   */
  private cycleToNextAnimation(): void {
    this.animationCycleIndex = (this.animationCycleIndex + 1) % this.options.animationCycle.length;
    const nextAnimation = this.options.animationCycle[this.animationCycleIndex];
    this.playAnimation(nextAnimation);
  }

  /**
   * Update camera position based on interaction
   */
  private updateCamera(): void {
    if (!this.animatedModel) return;

    const distance = this.options.cameraDistance;
    const model = this.animatedModel.model;
    
    // Calculate camera position based on rotation
    const x = Math.sin(this.cameraRotation.y) * distance;
    const z = Math.cos(this.cameraRotation.y) * distance;
    const y = Math.sin(this.cameraRotation.x) * distance + 1;
    
    this.camera.position.set(x, y, z);
    this.camera.lookAt(model.position);
  }

  /**
   * Start the render loop
   */
  private startRenderLoop(): void {
    const animate = () => {
      if (this.isDisposed) return;

      const now = performance.now();
      const deltaTime = (now - this.lastUpdate) / 1000;
      this.lastUpdate = now;

      this.update(deltaTime);
      this.renderer.render(this.scene, this.camera);

      requestAnimationFrame(animate);
    };

    this.lastUpdate = performance.now();
    animate();
  }

  /**
   * Mouse event handlers
   */
  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isMouseDown = true;
    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isMouseDown) return;

    const deltaX = event.clientX - this.mousePosition.x;
    const deltaY = event.clientY - this.mousePosition.y;

    this.cameraRotation.y += deltaX * 0.01;
    this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x + deltaY * 0.01));

    this.mousePosition.x = event.clientX;
    this.mousePosition.y = event.clientY;
  }

  private onMouseUp(): void {
    this.isMouseDown = false;
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    
    const delta = event.deltaY * 0.001;
    this.options.cameraDistance = Math.max(1.5, Math.min(8, this.options.cameraDistance + delta));
  }

  /**
   * Touch event handlers
   */
  private onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    if (event.touches.length === 1) {
      this.isMouseDown = true;
      this.mousePosition.x = event.touches[0].clientX;
      this.mousePosition.y = event.touches[0].clientY;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.isMouseDown || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - this.mousePosition.x;
    const deltaY = event.touches[0].clientY - this.mousePosition.y;

    this.cameraRotation.y += deltaX * 0.01;
    this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x + deltaY * 0.01));

    this.mousePosition.x = event.touches[0].clientX;
    this.mousePosition.y = event.touches[0].clientY;
  }

  private onTouchEnd(): void {
    this.isMouseDown = false;
  }

  /**
   * Get preview data for external access
   */
  getPreviewData(): ICharacterPreview {
    return {
      characterType: this.characterType,
      model: this.animatedModel?.model || new THREE.Object3D(),
      animatedModel: this.animatedModel!,
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      isPlaying: this.isPlaying,
      currentAnimation: this.currentAnimation,
      isLoaded: this.isLoaded,
      lastUpdate: this.lastUpdate
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.stopAnimations();

    // Dispose animation controller
    if (this.animationController) {
      this.animationController.dispose();
    }

    // Remove model from scene
    if (this.animatedModel) {
      this.scene.remove(this.animatedModel.model);
    }

    // Dispose renderer
    this.renderer.dispose();

    // Remove canvas from container
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }

    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    Logger.debug(LogCategory.CORE, `[CharacterPreview] Disposed preview for ${this.characterType}`);
  }
} 