import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TipsManager } from './TipsManager.js';

/**
 * LoadingScreen - Displays animated 3D walnut while game assets load
 */
export class LoadingScreen {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private walnutModel: THREE.Group | null = null;
  private loader: GLTFLoader;
  private animationId: number | null = null;
  private progressBar: HTMLElement;
  private progressText: HTMLElement;
  private progressPercentage: HTMLElement;
  // MVP 14: Gameplay tips
  private tipElement: HTMLElement;
  private tipsManager: TipsManager;
  private tipRotationInterval: number | null = null;

  constructor() {
    // Get DOM elements
    this.container = document.getElementById('loading-screen')!;
    this.progressBar = document.getElementById('loading-progress-bar')!;
    this.progressText = document.getElementById('loading-text')!;
    this.progressPercentage = document.getElementById('loading-percentage')!;
    this.tipElement = document.getElementById('loading-tip')!;

    // MVP 14: Initialize tips manager
    this.tipsManager = new TipsManager();

    // Create canvas for 3D walnut
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '300px';
    this.canvas.style.height = '300px';
    this.canvas.style.marginTop = '30px';
    this.canvas.style.marginBottom = '20px';
    this.container.insertBefore(this.canvas, this.progressText);

    // Scene setup
    this.scene = new THREE.Scene();

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 2, 8);
    this.camera.lookAt(0, 0, 0);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(300, 300);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0); // Transparent background

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    this.scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(0xFFD700, 0.4);
    rimLight.position.set(-3, 3, -3);
    this.scene.add(rimLight);

    // Model loader
    this.loader = new GLTFLoader();
  }

  /**
   * Show the loading screen and start animation
   * MVP 16: Turnstile moved to WelcomeScreen (before user interaction)
   */
  async show(): Promise<void> {
    this.container.classList.remove('hidden');

    // Initialize progress to 0%
    this.updateProgress(0, 'Loading game assets...');

    // MVP 14: Start tip rotation
    this.startTipRotation();

    // Load walnut model in background (don't block)
    this.loadWalnut();

    // Start animation loop immediately
    this.startAnimation();
  }

  /**
   * Load the walnut GLB model
   */
  private async loadWalnut(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/assets/models/environment/walnut_free_download.glb');
      this.walnutModel = gltf.scene;

      // Center and scale the model
      const box = new THREE.Box3().setFromObject(this.walnutModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Center at origin
      this.walnutModel.position.set(-center.x, -center.y, -center.z);

      // Scale to fit nicely
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 3 / maxDim;
      this.walnutModel.scale.setScalar(scale);

      this.scene.add(this.walnutModel);
    } catch (error) {
      console.error('Failed to load walnut model for loading screen:', error);
      // Continue without the model
    }
  }

  /**
   * Start the animation loop
   */
  private startAnimation(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      // Rotate the walnut
      if (this.walnutModel) {
        this.walnutModel.rotation.y += 0.02;
        this.walnutModel.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
      }

      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  /**
   * Update loading progress
   */
  updateProgress(progress: number, message: string = 'Loading assets...'): void {
    const percentage = Math.round(progress * 100);
    this.progressBar.style.width = `${percentage}%`;
    this.progressText.textContent = message;
    this.progressPercentage.textContent = `${percentage}%`;
  }

  /**
   * Hide the loading screen
   */
  hide(): void {
    this.stopAnimation();
    this.stopTipRotation(); // MVP 14: Stop tip rotation
    this.container.classList.add('hidden');
  }

  /**
   * Stop animation loop
   */
  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * MVP 14: Start rotating gameplay tips
   */
  private startTipRotation(): void {
    // Show first tip immediately
    this.showNextTip();

    // Rotate tips every 5 seconds
    this.tipRotationInterval = window.setInterval(() => {
      this.showNextTip();
    }, 5000);
  }

  /**
   * MVP 14: Stop tip rotation
   */
  private stopTipRotation(): void {
    if (this.tipRotationInterval !== null) {
      clearInterval(this.tipRotationInterval);
      this.tipRotationInterval = null;
    }
  }

  /**
   * MVP 14: Display next random tip
   */
  private showNextTip(): void {
    const tip = this.tipsManager.getRandomTip();
    if (tip) {
      const emoji = tip.emoji ? `${tip.emoji} ` : '';
      this.tipElement.textContent = `${emoji}${tip.text}`;
      this.tipsManager.markTipAsSeen(tip.id);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAnimation();
    this.stopTipRotation(); // MVP 14: Clean up tip rotation
    this.renderer.dispose();
    if (this.walnutModel) {
      this.scene.remove(this.walnutModel);
    }
  }
}
