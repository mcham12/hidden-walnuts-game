import * as THREE from 'three';
import { Scene } from '../core/Scene';
import { Logger } from '../core/Logger';

export interface RendererConfig {
    containerId?: string;
    width?: number;
    height?: number;
    antialias?: boolean;
}

export class Renderer {
    private renderer: THREE.WebGLRenderer;
    private container: HTMLElement;

    constructor(config: RendererConfig = {}) {
        // Create renderer with proper configuration
        this.renderer = new THREE.WebGLRenderer({
            antialias: config.antialias ?? true,
            powerPreference: 'high-performance',
            stencil: false
        });

        // Setup container
        const containerId = config.containerId ?? 'game-container';
        let container = document.getElementById(containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            document.body.appendChild(container);
        }
        this.container = container;

        // Configure renderer
        this.renderer.setSize(
            config.width ?? window.innerWidth,
            config.height ?? window.innerHeight
        );
        
        // Enable and configure shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Configure color management
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        // Set background color (darker blue sky)
        this.renderer.setClearColor(0x2c3e50, 1);
        
        // Set pixel ratio with a maximum of 2 for performance
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Add canvas to container
        this.container.appendChild(this.renderer.domElement);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    initialize(): void {
        Logger.info('Renderer initialized');
    }

    render(scene: Scene): void {
        this.renderer.render(scene, scene.getCamera());
    }

    cleanup(): void {
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }

    getDomElement(): HTMLCanvasElement {
        return this.renderer.domElement;
    }

    private onWindowResize(): void {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
    }
}