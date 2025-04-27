import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min';
import { Logger } from '../core/Logger';
import { PerformanceMonitor } from './PerformanceMonitor';

interface DebugFolder {
    name: string;
    gui: GUI;
}

export class DebugUI {
    private static instance: DebugUI;
    private gui: GUI;
    private folders: Map<string, DebugFolder>;
    private logger: Logger;
    private visible: boolean;
    private performanceMonitor: PerformanceMonitor;

    private constructor() {
        this.gui = new GUI();
        this.folders = new Map();
        this.logger = Logger.getInstance();
        this.visible = true;
        this.performanceMonitor = PerformanceMonitor.getInstance();
        
        // Hide by default
        this.gui.hide();
    }

    static getInstance(): DebugUI {
        if (!DebugUI.instance) {
            DebugUI.instance = new DebugUI();
        }
        return DebugUI.instance;
    }

    initialize(): void {
        // Add keyboard shortcut to toggle visibility
        window.addEventListener('keydown', (e) => {
            if (e.key === '`') { // Backtick key
                this.toggleVisibility();
            }
        });

        this.setupPerformanceFolder();
        this.setupSceneFolder();
        this.setupRenderingFolder();
    }

    private setupPerformanceFolder(): void {
        const folder = this.addFolder('Performance');
        const metrics = this.performanceMonitor.getMetrics();

        folder.gui.add(metrics, 'fps').listen();
        folder.gui.add(metrics, 'frameTime').listen();
        folder.gui.add(metrics, 'drawCalls').listen();
        folder.gui.add(metrics, 'triangles').listen();
        folder.gui.add(metrics, 'textures').listen();
        folder.gui.add(metrics, 'geometries').listen();
        folder.gui.add(metrics, 'heap').name('Heap (MB)').listen();
    }

    private setupSceneFolder(): void {
        const folder = this.addFolder('Scene');
        const sceneConfig = {
            showAxes: false,
            showGrid: false,
            showBoundingBoxes: false
        };

        folder.gui.add(sceneConfig, 'showAxes').onChange((value: boolean) => {
            this.logger.debug('Toggle axes helper:', value);
            // Implement axes helper toggle
        });

        folder.gui.add(sceneConfig, 'showGrid').onChange((value: boolean) => {
            this.logger.debug('Toggle grid helper:', value);
            // Implement grid helper toggle
        });

        folder.gui.add(sceneConfig, 'showBoundingBoxes').onChange((value: boolean) => {
            this.logger.debug('Toggle bounding boxes:', value);
            // Implement bounding boxes toggle
        });
    }

    private setupRenderingFolder(): void {
        const folder = this.addFolder('Rendering');
        const renderConfig = {
            shadows: true,
            antialiasing: true,
            pixelRatio: window.devicePixelRatio
        };

        folder.gui.add(renderConfig, 'shadows').onChange((value: boolean) => {
            this.logger.debug('Toggle shadows:', value);
            // Implement shadow toggle
        });

        folder.gui.add(renderConfig, 'antialiasing').onChange((value: boolean) => {
            this.logger.debug('Toggle antialiasing:', value);
            // Implement antialiasing toggle
        });

        folder.gui.add(renderConfig, 'pixelRatio', 0.5, 2).step(0.1).onChange((value: number) => {
            this.logger.debug('Change pixel ratio:', value);
            // Implement pixel ratio change
        });
    }

    addFolder(name: string): DebugFolder {
        if (this.folders.has(name)) {
            return this.folders.get(name)!;
        }

        const folder = {
            name,
            gui: this.gui.addFolder(name)
        };
        this.folders.set(name, folder);
        return folder;
    }

    addControl(folderName: string, object: any, property: string, min?: number, max?: number, step?: number): void {
        const folder = this.folders.get(folderName);
        if (!folder) {
            this.logger.warn(`Folder ${folderName} not found`);
            return;
        }

        const control = folder.gui.add(object, property);
        if (typeof min === 'number' && typeof max === 'number') {
            control.min(min).max(max);
            if (typeof step === 'number') {
                control.step(step);
            }
        }
    }

    toggleVisibility(): void {
        this.visible = !this.visible;
        if (this.visible) {
            this.gui.show();
        } else {
            this.gui.hide();
        }
    }

    cleanup(): void {
        this.gui.destroy();
        this.folders.clear();
    }
} 