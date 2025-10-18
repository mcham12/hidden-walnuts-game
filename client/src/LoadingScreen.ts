import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  // MVP 7.1: Turnstile bot protection
  private turnstileContainer: HTMLElement | null = null;
  private turnstileToken: string | null = null;

  constructor() {
    // Get DOM elements
    this.container = document.getElementById('loading-screen')!;
    this.progressBar = document.getElementById('loading-progress-bar')!;
    this.progressText = document.getElementById('loading-text')!;
    this.progressPercentage = document.getElementById('loading-percentage')!;

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
   * MVP 7.1: Added Turnstile verification before loading
   */
  async show(): Promise<void> {
    this.container.classList.remove('hidden');

    // Initialize progress to 0%
    this.updateProgress(0, 'Verifying you are human...');

    // MVP 7.1: Create Turnstile widget container
    if (!this.turnstileContainer) {
      this.turnstileContainer = document.createElement('div');
      this.turnstileContainer.id = 'turnstile-container';
      this.turnstileContainer.style.marginTop = '20px';
      this.turnstileContainer.style.marginBottom = '20px';
      this.turnstileContainer.style.display = 'flex';
      this.turnstileContainer.style.justifyContent = 'center';
      this.container.insertBefore(this.turnstileContainer, this.progressText);
    }

    // MVP 7.1: Render Turnstile widget
    await this.renderTurnstile();

    // Load walnut model in background (don't block)
    this.loadWalnut();

    // Start animation loop immediately
    this.startAnimation();
  }

  /**
   * MVP 7.1: Render Cloudflare Turnstile widget
   */
  private async renderTurnstile(): Promise<void> {
    return new Promise((resolve) => {
      // Wait for Turnstile script to load
      const checkTurnstile = () => {
        if (typeof (window as any).turnstile !== 'undefined') {
          const turnstile = (window as any).turnstile;

          // IMPORTANT: Replace with your Turnstile site key from Cloudflare dashboard
          // Get your key at: https://dash.cloudflare.com/?to=/:account/turnstile
          // Determine site key based on hostname
          const hostname = window.location.hostname;
          let TURNSTILE_SITE_KEY: string;

          // Check if this is a preview deployment (mvp-* branches) or localhost
          const isPreview = hostname.includes('mvp-') || hostname.includes('localhost') || hostname.includes('127.0.0.1');

          if (isPreview) {
            // Preview/localhost: Testing key (always passes)
            TURNSTILE_SITE_KEY = '1x00000000000000000000AA'; // Cloudflare testing key
          } else {
            // Production (game.hiddenwalnuts.com or main branch pages.dev): Real site key
            TURNSTILE_SITE_KEY = '0x4AAAAAAB7S9YhTOdtQjCTu'; // Production key
          }

          try {
            // Render Turnstile widget (widget ID not needed for basic usage)
            turnstile.render(this.turnstileContainer, {
              sitekey: TURNSTILE_SITE_KEY,
              callback: (token: string) => {
                this.turnstileToken = token;
                this.updateProgress(0.1, 'Verification successful! Loading assets...');
                resolve();
              },
              'error-callback': () => {
                console.error('Turnstile verification failed');
                this.updateProgress(0, 'Verification failed. Please refresh the page.');
              },
              theme: 'dark',
            });
          } catch (error) {
            console.error('Failed to render Turnstile:', error);
            // Continue without verification in development
            resolve();
          }
        } else {
          // Retry in 100ms
          setTimeout(checkTurnstile, 100);
        }
      };
      checkTurnstile();
    });
  }

  /**
   * MVP 7.1: Get Turnstile token (null if not verified)
   */
  getTurnstileToken(): string | null {
    return this.turnstileToken;
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
   * Clean up resources
   */
  destroy(): void {
    this.stopAnimation();
    this.renderer.dispose();
    if (this.walnutModel) {
      this.scene.remove(this.walnutModel);
    }
  }
}
