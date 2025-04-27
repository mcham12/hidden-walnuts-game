import * as THREE from 'three';
import { Logger, LogLevel } from '../core/Logger';
import { PerformanceMonitor } from './PerformanceMonitor';
import { DebugUI } from './DebugUI';
import { ErrorBoundary, ErrorInfo } from './ErrorBoundary';

export interface DebugConfig {
    enableLogging: boolean;
    logLevel: LogLevel;
    enablePerformanceMonitoring: boolean;
    enableDebugUI: boolean;
    enableErrorBoundary: boolean;
}

export class DebugManager {
    private static instance: DebugManager;
    private logger: Logger;
    private performanceMonitor: PerformanceMonitor;
    private debugUI: DebugUI;
    private errorBoundary: ErrorBoundary;
    private config: DebugConfig;

    private constructor(config: Partial<DebugConfig> = {}) {
        this.config = {
            enableLogging: config.enableLogging ?? true,
            logLevel: config.logLevel ?? LogLevel.INFO,
            enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
            enableDebugUI: config.enableDebugUI ?? true,
            enableErrorBoundary: config.enableErrorBoundary ?? true
        };

        this.logger = Logger.getInstance();
        this.performanceMonitor = PerformanceMonitor.getInstance();
        this.debugUI = DebugUI.getInstance();
        this.errorBoundary = ErrorBoundary.getInstance();
    }

    static getInstance(config?: Partial<DebugConfig>): DebugManager {
        if (!DebugManager.instance) {
            DebugManager.instance = new DebugManager(config);
        }
        return DebugManager.instance;
    }

    initialize(): void {
        this.logger.configure({
            level: this.config.logLevel,
            enableTimestamp: true,
            enableColors: true
        });

        if (this.config.enablePerformanceMonitoring) {
            this.performanceMonitor.initialize();
        }

        if (this.config.enableDebugUI) {
            this.debugUI.initialize();
        }

        // Set up error handling
        if (this.config.enableErrorBoundary) {
            this.errorBoundary.on((errorInfo: ErrorInfo) => {
                this.logger.error('Application error:', new Error(errorInfo.message));
            });
        }

        this.logger.info('Debug systems initialized');
    }

    beginFrame(): void {
        if (this.config.enablePerformanceMonitoring) {
            this.performanceMonitor.beginFrame();
        }
    }

    endFrame(renderer: THREE.WebGLRenderer): void {
        if (this.config.enablePerformanceMonitoring) {
            this.performanceMonitor.updateMetrics(renderer);
            this.performanceMonitor.endFrame();
        }
    }

    handleError(error: unknown, componentStack?: string): void {
        if (this.config.enableErrorBoundary) {
            this.errorBoundary.handleError(error, componentStack);
        }
    }

    getPerformanceMetrics() {
        return this.config.enablePerformanceMonitoring ? 
            this.performanceMonitor.getMetrics() : 
            null;
    }

    toggleDebugUI(): void {
        if (this.config.enableDebugUI) {
            this.debugUI.toggleVisibility();
        }
    }

    cleanup(): void {
        if (this.config.enablePerformanceMonitoring) {
            this.performanceMonitor.cleanup();
        }

        if (this.config.enableDebugUI) {
            this.debugUI.cleanup();
        }

        this.logger.info('Debug systems cleaned up');
    }
} 