import { Scene as ThreeScene, PerspectiveCamera, DirectionalLight, AmbientLight, PlaneGeometry, MeshStandardMaterial, Mesh, Color, DirectionalLightHelper, CameraHelper, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Scene } from '../../engine/core/Scene';
import { Engine } from '../../engine/core/Engine';
import { AssetManager } from '../AssetManager';

export class ModelTestScene extends Scene {
    private controls: OrbitControls | null = null;
    private assetManager: AssetManager | null = null;
    private models: Mesh[] = [];

    constructor() {
        super();
    }

    protected async onInitialize(): Promise<void> {
        // Position camera
        this.camera.position.set(15, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // Setup camera controls
        if (this.engine) {
            this.controls = new OrbitControls(this.camera, this.engine.getRenderer().getDomElement());
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
        }

        // Set up lights
        const dirLight = new DirectionalLight(0xffffff, 3);
        dirLight.position.set(10, 15, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 100;
        dirLight.shadow.camera.left = -15;
        dirLight.shadow.camera.right = 15;
        dirLight.shadow.camera.top = 15;
        dirLight.shadow.camera.bottom = -15;
        dirLight.shadow.bias = -0.001;
        this.add(dirLight);

        // Add ambient light
        const ambientLight = new AmbientLight(0xffffff, 0.3);
        this.add(ambientLight);

        // Create ground plane
        const groundGeometry = new PlaneGeometry(30, 30);
        const groundMaterial = new MeshStandardMaterial({
            color: new Color(0x808080),
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.add(ground);

        // Initialize asset manager
        this.assetManager = new AssetManager((loaded, total) => {
            console.log(`Loading progress: ${loaded}/${total}`);
        });

        // Load player model (squirrel)
        const playerModelPath = 'squirrel.glb';
        try {
            const model = await this.assetManager.loadModel(playerModelPath);
            model.position.set(0, 0, 0); // Centered
            this.add(model);
            console.log(`Successfully loaded and added player model: ${playerModelPath}`);
        } catch (error) {
            console.error('Error loading player model:', error);
        }

        // Add resize handler
        window.addEventListener('resize', this.onResize.bind(this));
    }

    onResize(): void {
        if (this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        }
    }

    onUpdate(deltaTime: number): void {
        if (this.controls) {
            this.controls.update();
        }
    }

    onCleanup(): void {
        if (this.controls) {
            this.controls.dispose();
        }
        if (this.assetManager) {
            this.assetManager.dispose();
        }
        window.removeEventListener('resize', this.onResize.bind(this));
    }
} 