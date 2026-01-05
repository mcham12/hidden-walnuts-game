import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterRegistry } from './CharacterRegistry';

interface PreviewView {
    characterId: string;
    canvas2d: HTMLCanvasElement;
    ctx2d: CanvasRenderingContext2D;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    model: THREE.Group | null;
    mixer: THREE.AnimationMixer | null;
    options: {
        rotationSpeed: number;
        autoRotate: boolean;
        cameraDistance: number;
        showAnimation: boolean;
        initialRotation?: number;
    };
}

/**
 * SharedCharacterRenderer - MVP 16 Stability Fix
 * Uses a single WebGLRenderer to render multiple characters and blit them to 2D canvases.
 * This prevents "Too many active WebGL contexts" errors.
 */
export class SharedCharacterRenderer {
    private static instance: SharedCharacterRenderer;
    private renderer: THREE.WebGLRenderer;
    private views: Map<string, PreviewView> = new Map();
    private animationId: number | null = null;
    private loader: GLTFLoader;

    private constructor() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true // Required for copying to 2D canvas
        });
        this.renderer.setPixelRatio(1); // Handle DPI manually via canvas sizes
        this.renderer.setSize(200, 200); // Internal buffer size
        this.loader = new GLTFLoader();
        // PERFORMANCE FIX: Don't start animation loop here - register() handles it correctly
        // when the first view is added. Starting it in constructor is wasteful.
    }

    public static getInstance(): SharedCharacterRenderer {
        if (!SharedCharacterRenderer.instance) {
            SharedCharacterRenderer.instance = new SharedCharacterRenderer();
        }
        return SharedCharacterRenderer.instance;
    }

    /**
     * Register a new character preview
     */
    public async register(
        viewId: string,
        characterId: string,
        canvas2d: HTMLCanvasElement,
        options: any = {}
    ): Promise<void> {
        const ctx2d = canvas2d.getContext('2d');
        if (!ctx2d) return;

        // Create scene and camera
        const scene = new THREE.Scene();

        // Setup camera
        const width = canvas2d.clientWidth || 200;
        const height = canvas2d.clientHeight || 200;
        const aspect = width / height;

        const cameraDistance = options.cameraDistance || 2;
        const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        // MATCH ORIGINAL CharacterPreview3D: position(0, 1, dist), lookAt(0, 0.5, 0)
        camera.position.set(0, 1, cameraDistance);
        camera.lookAt(0, 0.5, 0);

        // MATCH ORIGINAL: Dark forest background (but semi-transparent if alpha is true)
        scene.background = new THREE.Color(0x1a3a1b);

        // Setup lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        scene.add(directionalLight);

        const view: PreviewView = {
            characterId,
            canvas2d,
            ctx2d,
            scene,
            camera,
            model: null,
            mixer: null,
            options: {
                rotationSpeed: options.rotationSpeed || 0.005,
                autoRotate: options.autoRotate !== false,
                cameraDistance,
                showAnimation: options.showAnimation !== false,
                initialRotation: options.initialRotation || 0
            }
        };

        this.views.set(viewId, view);

        // Start loop if this is the first view
        if (this.views.size === 1 && !this.animationId) {
            this.startAnimationLoop();
        }

        // Load character model
        await this.loadCharacterModel(view);
    }

    private async loadCharacterModel(view: PreviewView): Promise<void> {
        const character = CharacterRegistry.getCharacterById(view.characterId);
        if (!character) return;

        try {
            const gltf = await this.loader.loadAsync(character.modelPath);
            view.model = gltf.scene;

            // MATCH ORIGINAL CharacterPreview3D: fixed scale 1.0 and 0,0,0 position
            view.model.scale.setScalar(1.0);
            view.model.position.set(0, 0, 0);

            if (view.options.initialRotation) {
                view.model.rotation.y = view.options.initialRotation;
            }

            view.scene.add(view.model);

            // Animation
            if (view.options.showAnimation && character.animations?.idle) {
                const animGltf = await this.loader.loadAsync(character.animations.idle);
                if (animGltf.animations.length > 0) {
                    view.mixer = new THREE.AnimationMixer(view.model);
                    view.mixer.clipAction(animGltf.animations[0]).play();
                }
            }
        } catch (error) {
            console.error(`Error loading model for ${view.characterId}:`, error);
        }
    }

    /**
     * Unregister and cleanup a preview
     */
    public unregister(viewId: string): void {
        const view = this.views.get(viewId);
        if (view) {
            // Cleanup scene objects
            view.scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            view.scene.clear();
            this.views.delete(viewId);

            // Stop loop if no more views
            if (this.views.size === 0 && this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
        }
    }

    private startAnimationLoop(): void {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            this.render();
        };
        animate();
    }

    private render(): void {
        const delta = 0.016; // ~60fps

        this.views.forEach((view) => {
            if (!view.model) return;

            // Update animation
            if (view.mixer) {
                view.mixer.update(delta);
            }

            // Rotate
            if (view.options.autoRotate) {
                view.model.rotation.y += view.options.rotationSpeed;
            }

            // Prepare renderer for this view
            const width = view.canvas2d.width;
            const height = view.canvas2d.height;
            if (this.renderer.domElement.width !== width || this.renderer.domElement.height !== height) {
                this.renderer.setSize(width, height, false);
            }

            // Render scene
            this.renderer.render(view.scene, view.camera);

            // Copy to 2D canvas
            view.ctx2d.clearRect(0, 0, width, height);
            view.ctx2d.drawImage(this.renderer.domElement, 0, 0);
        });
    }

    public destroy(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.views.clear();
    }
}
