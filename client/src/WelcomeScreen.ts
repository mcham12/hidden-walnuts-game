/**
 * WelcomeScreen - MVP 5.8: Startup Experience
 *
 * Playful forest entrance with animated 3D walnut
 * Responsive design for iPhone, iPad, and Desktop
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class WelcomeScreen {
  private container: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private walnut: THREE.Group | null = null;
  private animationId: number | null = null;
  private particles: THREE.Points | null = null;
  private walnutLoadedPromise: Promise<void> | null = null;

  private resolvePromise: (() => void) | null = null;

  constructor() {
    this.createHTML();
    this.setupThreeJS();
    this.walnutLoadedPromise = this.loadWalnut();
    this.createParticles();
  }

  /**
   * Create HTML structure for welcome screen
   */
  private createHTML(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'welcome-screen';
    this.container.innerHTML = `
      <div class="welcome-content">
        <div class="welcome-canvas-container">
          <canvas id="welcome-canvas"></canvas>
        </div>
        <div class="welcome-text">
          <h1 class="welcome-title">Hidden Walnuts</h1>
          <p class="welcome-tagline">A Multiplayer Forest Adventure</p>
        </div>
        <button id="welcome-button" class="welcome-button">
          Enter the Forest
        </button>
      </div>

      <!-- Decorative elements -->
      <div class="forest-rays"></div>
      <div class="floating-leaf leaf-1">🍃</div>
      <div class="floating-leaf leaf-2">🍂</div>
      <div class="floating-leaf leaf-3">🍃</div>
      <div class="floating-leaf leaf-4">🍂</div>
    `;

    document.body.appendChild(this.container);

    // Get canvas reference
    this.canvas = document.getElementById('welcome-canvas') as HTMLCanvasElement;

    // Setup button click handler
    const button = document.getElementById('welcome-button');
    if (button) {
      button.addEventListener('click', () => this.onButtonClick());
    }
  }

  /**
   * Setup Three.js scene for 3D walnut
   */
  private setupThreeJS(): void {
    if (!this.canvas) return;

    // Scene
    this.scene = new THREE.Scene();

    // Camera - adjust based on viewport
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting - warm forest lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffd700, 0.8);
    directionalLight.position.set(3, 5, 2);
    this.scene.add(directionalLight);

    const rimLight = new THREE.DirectionalLight(0x90ee90, 0.4);
    rimLight.position.set(-3, 2, -2);
    this.scene.add(rimLight);

    // Handle resize
    window.addEventListener('resize', () => this.onResize());
  }

  /**
   * Load walnut GLB model
   */
  private async loadWalnut(): Promise<void> {
    const loader = new GLTFLoader();

    try {
      const gltf = await loader.loadAsync('/assets/models/environment/walnut_free_download.glb');
      this.walnut = gltf.scene;

      // Center and scale walnut
      const box = new THREE.Box3().setFromObject(this.walnut);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      this.walnut.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxDim;
      this.walnut.scale.setScalar(scale);

      this.scene!.add(this.walnut);

      // Start animation
      this.animate();
    } catch (error) {
      console.error('Failed to load walnut model:', error);
    }
  }

  /**
   * Create particle glow around walnut
   */
  private createParticles(): void {
    const particleCount = 50;
    const positions = new Float32Array(particleCount * 3);

    // Create particles in sphere around center
    for (let i = 0; i < particleCount; i++) {
      const radius = 0.8 + Math.random() * 0.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene!.add(this.particles);
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    // Rotate walnut slowly
    if (this.walnut) {
      this.walnut.rotation.y += 0.005;
    }

    // Rotate particles slowly in opposite direction
    if (this.particles) {
      this.particles.rotation.y -= 0.002;
      this.particles.rotation.x += 0.001;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  /**
   * Handle window resize
   */
  private onResize(): void {
    if (!this.canvas || !this.camera || !this.renderer) return;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Handle button click
   */
  private onButtonClick(): void {
    if (this.resolvePromise) {
      this.resolvePromise();
    }
  }

  /**
   * Show welcome screen and wait for user interaction
   * Waits for walnut model to load before displaying
   */
  async show(): Promise<void> {
    // Wait for walnut model to load first
    if (this.walnutLoadedPromise) {
      await this.walnutLoadedPromise;
    }

    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      if (this.container) {
        // Fade in
        this.container.style.opacity = '0';
        this.container.style.display = 'flex';

        requestAnimationFrame(() => {
          if (this.container) {
            this.container.style.transition = 'opacity 0.5s ease-in';
            this.container.style.opacity = '1';
          }
        });
      }
    });
  }

  /**
   * Hide welcome screen with fade out
   */
  async hide(): Promise<void> {
    return new Promise((resolve) => {
      if (this.container) {
        this.container.style.transition = 'opacity 0.5s ease-out';
        this.container.style.opacity = '0';

        setTimeout(() => {
          if (this.container) {
            this.container.style.display = 'none';
          }
          resolve();
        }, 500);
      } else {
        resolve();
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop animation
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Cleanup Three.js
    if (this.renderer) {
      this.renderer.dispose();
    }

    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (object.material instanceof THREE.Material) {
            object.material.dispose();
          }
        }
      });
    }

    // Remove from DOM
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    // Remove resize listener
    window.removeEventListener('resize', this.onResize);
  }
}
