import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterRegistry } from '../services/CharacterRegistry';
import { AccessoryFactory } from '../services/AccessoryFactory';
import { AccessoryRegistry, DEFAULT_OFFSET } from '../services/AccessoryRegistry';

interface AccessoryConfig {
    scale: number;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export class AccessoryTweakerPage {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private loader: GLTFLoader;
    private mixer: THREE.AnimationMixer | null = null;
    private clock: THREE.Clock;

    private currentCharacterId: string = 'squirrel';
    private currentAccessoryId: string = 'hat_propeller_98';
    private currentModel: THREE.Group | null = null;
    private accessory: THREE.Group | null = null;
    private headBone: THREE.Object3D | null = null;

    private config: AccessoryConfig = { ...DEFAULT_OFFSET, position: { ...DEFAULT_OFFSET.position }, rotation: { ...DEFAULT_OFFSET.rotation } };

    constructor(container: HTMLElement) {
        this.container = container;
        this.loader = new GLTFLoader();
        this.clock = new THREE.Clock();

        this.init();
    }

    private async init() {
        // Setup layout
        this.container.style.display = 'flex';
        this.container.style.width = '100vw';
        this.container.style.height = '100vh';
        this.container.style.overflow = 'hidden';
        this.container.style.background = '#1a1a1a';

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 320px;
            background: #2a2a2a;
            color: #eee;
            padding: 20px;
            font-family: monospace;
            overflow-y: auto;
            border-right: 1px solid #444;
            display: flex;
            flex-direction: column;
            gap: 15px;
        `;
        this.container.appendChild(sidebar);

        // Sidebar Content
        const title = document.createElement('h2');
        title.innerText = "Accessory Tweaker";
        title.style.margin = "0 0 20px 0";
        title.style.color = "#4ECDC4";
        sidebar.appendChild(title);

        // Character Selector
        const charLabel = document.createElement('div');
        charLabel.innerText = "Select Character:";
        sidebar.appendChild(charLabel);

        const charSelect = document.createElement('select');
        charSelect.style.cssText = "width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555;";

        const characters = CharacterRegistry.getAllCharacters();
        characters.forEach(char => {
            const option = document.createElement('option');
            option.value = char.id;
            option.innerText = char.name;
            if (char.id === this.currentCharacterId) option.selected = true;
            charSelect.appendChild(option);
        });

        charSelect.addEventListener('change', (e) => {
            this.currentCharacterId = (e.target as HTMLSelectElement).value;
            this.loadCharacter(this.currentCharacterId);
        });
        sidebar.appendChild(charSelect);

        // Accessory Selector
        const accLabel = document.createElement('div');
        accLabel.innerText = "Select Accessory:";
        accLabel.style.marginTop = "15px";
        sidebar.appendChild(accLabel);

        const accSelect = document.createElement('select');
        accSelect.style.cssText = "width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555;";

        const accessories = AccessoryRegistry.getAll();
        accessories.forEach(acc => {
            const option = document.createElement('option');
            option.value = acc.id;
            option.innerText = `${acc.icon} ${acc.name}`;
            if (acc.id === this.currentAccessoryId) option.selected = true;
            accSelect.appendChild(option);
        });

        accSelect.addEventListener('change', (e) => {
            this.currentAccessoryId = (e.target as HTMLSelectElement).value;
            this.createAccessory();
        });
        sidebar.appendChild(accSelect);

        // Controls
        const createControl = (label: string, value: number, min: number, max: number, step: number, onChange: (val: number) => void) => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '5px';

            const labelEl = document.createElement('div');
            labelEl.style.display = 'flex';
            labelEl.style.justifyContent = 'space-between';
            labelEl.style.fontSize = '12px';

            const nameSpan = document.createElement('span');
            nameSpan.innerText = label;

            const valSpan = document.createElement('span');
            valSpan.innerText = value.toFixed(2);
            valSpan.style.color = '#4ECDC4';

            labelEl.appendChild(nameSpan);
            labelEl.appendChild(valSpan);
            wrapper.appendChild(labelEl);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = min.toString();
            input.max = max.toString();
            input.step = step.toString();
            input.value = value.toString();
            input.style.width = '100%';

            input.addEventListener('input', (e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                valSpan.innerText = val.toFixed(2);
                onChange(val);
                this.updateAccessoryTransform();
                this.updateOutput();
            });

            wrapper.appendChild(input);
            return wrapper;
        };

        const controlsGroup = document.createElement('div');
        controlsGroup.style.borderTop = '1px solid #444';
        controlsGroup.style.paddingTop = '15px';
        controlsGroup.style.marginTop = '20px';

        controlsGroup.appendChild(createControl('Scale', 1.0, 0.1, 5.0, 0.1, (v) => this.config.scale = v));

        controlsGroup.appendChild(document.createElement('hr'));

        controlsGroup.appendChild(createControl('Pos X', 0, -2, 2, 0.01, (v) => this.config.position.x = v));
        controlsGroup.appendChild(createControl('Pos Y', 0, -2, 2, 0.01, (v) => this.config.position.y = v));
        controlsGroup.appendChild(createControl('Pos Z', 0, -2, 2, 0.01, (v) => this.config.position.z = v));

        controlsGroup.appendChild(document.createElement('hr'));

        controlsGroup.appendChild(createControl('Rot X', 0, -Math.PI, Math.PI, 0.1, (v) => this.config.rotation.x = v));
        controlsGroup.appendChild(createControl('Rot Y', 0, -Math.PI, Math.PI, 0.1, (v) => this.config.rotation.y = v));
        controlsGroup.appendChild(createControl('Rot Z', 0, -Math.PI, Math.PI, 0.1, (v) => this.config.rotation.z = v));

        sidebar.appendChild(controlsGroup);

        // JSON Output
        const outputLabel = document.createElement('div');
        outputLabel.innerText = "Config JSON:";
        outputLabel.style.marginTop = "20px";
        sidebar.appendChild(outputLabel);

        const output = document.createElement('textarea');
        output.id = 'tweaker-output';
        output.readOnly = true;
        output.style.cssText = "width: 100%; height: 100px; background: #111; color: #0f0; border: 1px solid #333; font-family: monospace; font-size: 11px; padding: 5px;";
        sidebar.appendChild(output);

        // Game Area
        const gameArea = document.createElement('div');
        gameArea.style.flex = '1';
        gameArea.style.position = 'relative';
        this.container.appendChild(gameArea);

        // Setup ThreeJS
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x333333);

        // Grid
        const grid = new THREE.GridHelper(10, 10);
        this.scene.add(grid);
        const axes = new THREE.AxesHelper(2);
        this.scene.add(axes);

        // Lights
        const ambLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(2, 5, 3);
        this.scene.add(dirLight);

        // Camera
        this.camera = new THREE.PerspectiveCamera(50, gameArea.clientWidth / gameArea.clientHeight, 0.1, 100);
        this.camera.position.set(2, 1.5, 2);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(gameArea.clientWidth, gameArea.clientHeight);
        gameArea.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 0.5, 0);

        // Handle resize
        window.addEventListener('resize', () => {
            if (this.container.offsetParent) { // Only if visible
                this.camera.aspect = gameArea.clientWidth / gameArea.clientHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(gameArea.clientWidth, gameArea.clientHeight);
            }
        });

        // Load initial character
        this.updateOutput();
        await this.loadCharacter(this.currentCharacterId);

        // Start loop
        this.animate();
    }

    private updateOutput() {
        const out = document.getElementById('tweaker-output') as HTMLTextAreaElement;
        if (out) {
            out.value = JSON.stringify(this.config, null, 2);
        }
    }

    private async loadCharacter(id: string) {
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
            this.mixer = null;
            this.headBone = null;
            this.accessory = null; // Will recreate
        }

        const charDef = CharacterRegistry.getCharacterById(id);
        if (!charDef) return;

        try {
            const gltf = await this.loader.loadAsync(charDef.modelPath);
            this.currentModel = gltf.scene;

            // Apply character scale
            this.currentModel.scale.setScalar(charDef.scale);

            this.scene.add(this.currentModel);

            // Setup Mixer (Idle animation)
            if (charDef.animations.idle) {
                const animGltf = await this.loader.loadAsync(charDef.animations.idle);
                this.mixer = new THREE.AnimationMixer(this.currentModel);
                this.mixer.clipAction(animGltf.animations[0]).play();
            }

            // Find Head Bone (Improved logic matching Game.ts)
            this.headBone = null;
            this.currentModel.traverse((obj) => {
                if (this.headBone) return;
                const name = obj.name.toLowerCase();
                if (obj.type === 'Bone' && (
                    name === 'head' ||
                    name === 'righead' ||
                    name === 'bip001_head' ||
                    name === 'mixamorig:head' ||
                    name === 'def_head' ||
                    name === 'body' ||
                    name.includes('head')
                )) {
                    this.headBone = obj;
                }
            });

            if (this.headBone) {
                console.log(`Found head bone: ${this.headBone.name}`);
                await this.createAccessory();
            } else {
                console.warn("No head bone found! Dumping all nodes:");
                this.currentModel.traverse((node) => {
                    console.log(`- ${node.name} [${node.type}]`);
                });
            }

        } catch (e) {
            console.error("Failed to load character", e);
        }
    }

    private async createAccessory() {
        if (!this.headBone) return;

        // Remove existing
        if (this.accessory) {
            this.headBone.remove(this.accessory);
            this.accessory = null;
        }

        const savedOffset = AccessoryRegistry.getOffset(this.currentCharacterId, this.currentAccessoryId);
        this.config = {
            scale: savedOffset.scale,
            position: { ...savedOffset.position },
            rotation: { ...savedOffset.rotation }
        };

        try {
            const group = await AccessoryFactory.createAccessory(this.currentAccessoryId);
            if (group) {
                this.accessory = group;
                this.headBone.add(this.accessory);
                this.updateAccessoryTransform();
                this.updateOutput();
            }
        } catch (e) {
            console.error("Failed to create accessory", e);
        }
    }

    private updateAccessoryTransform() {
        if (!this.accessory) return;

        this.accessory.position.set(
            this.config.position.x,
            this.config.position.y,
            this.config.position.z
        );
        this.accessory.rotation.set(
            this.config.rotation.x,
            this.config.rotation.y,
            this.config.rotation.z
        );
        this.accessory.scale.setScalar(this.config.scale);
    }

    private animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        if (this.mixer) this.mixer.update(delta);

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public static handleRoute(): boolean {
        if (window.location.pathname === '/tweaker') {
            const container = document.createElement('div');
            container.id = 'tweaker-page';
            document.body.appendChild(container);

            CharacterRegistry.loadCharacters().then(() => {
                new AccessoryTweakerPage(container);
            });

            return true;
        }
        return false;
    }
}
