import Stats from 'three/examples/jsm/libs/stats.module';
import * as THREE from 'three';
import { Logger } from '../core/Logger';

// Extend Performance interface to include memory
declare global {
    interface Performance {
        memory?: {
            usedJSHeapSize: number;
            jsHeapSizeLimit: number;
            totalJSHeapSize: number;
        };
    }
}

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
    textures: number;
    geometries: number;
    heap: number;
}

export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private stats: Stats;
    private metrics: PerformanceMetrics;
    private logger: Logger;
    private lastTime: number;
    private frameCount: number;
    private fpsUpdateInterval: number;

    private constructor() {
        this.stats = new Stats();
        this.logger = Logger.getInstance();
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            triangles: 0,
            textures: 0,
            geometries: 0,
            heap: 0
        };
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateInterval = 1000; // Update FPS every second
    }

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    initialize(): void {
        // Add Stats.js panels
        this.stats.showPanel(0); // FPS
        document.body.appendChild(this.stats.dom);

        // Start monitoring memory if available
        if (performance.memory) {
            this.monitorMemory();
        }
    }

    beginFrame(): void {
        this.stats.begin();
    }

    endFrame(): void {
        this.stats.end();
        this.frameCount++;

        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;

        if (elapsed >= this.fpsUpdateInterval) {
            this.metrics.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.metrics.frameTime = elapsed / this.frameCount;
            this.frameCount = 0;
            this.lastTime = currentTime;

            this.logMetrics();
        }
    }

    updateMetrics(renderer: THREE.WebGLRenderer): void {
        const info = renderer.info;
        this.metrics.drawCalls = info.render.calls;
        this.metrics.triangles = info.render.triangles;
        this.metrics.textures = info.memory.textures;
        this.metrics.geometries = info.memory.geometries;
    }

    private monitorMemory(): void {
        if (performance.memory) {
            this.metrics.heap = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        }
    }

    private logMetrics(): void {
        this.logger.debug('Performance Metrics:', {
            fps: this.metrics.fps,
            frameTime: Math.round(this.metrics.frameTime * 100) / 100,
            drawCalls: this.metrics.drawCalls,
            triangles: this.metrics.triangles,
            textures: this.metrics.textures,
            geometries: this.metrics.geometries,
            heapMB: this.metrics.heap
        });
    }

    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    cleanup(): void {
        if (this.stats.dom && this.stats.dom.parentElement) {
            this.stats.dom.parentElement.removeChild(this.stats.dom);
        }
    }
} 