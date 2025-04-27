import { Logger } from '../core/Logger';
import { EventSystem } from '../core/EventSystem';

// Extend ImportMeta interface to include Vite's env
declare interface ImportMeta {
    env: {
        MODE: string;
    };
}

export interface ErrorInfo {
    message: string;
    stack?: string;
    componentStack?: string;
    timestamp: number;
}

export class ErrorBoundary {
    private static instance: ErrorBoundary;
    private logger: Logger;
    private eventSystem: EventSystem;
    private errors: ErrorInfo[];
    private maxErrors: number;
    private isDevelopment: boolean;

    private constructor() {
        this.logger = Logger.getInstance();
        this.eventSystem = new EventSystem();
        this.errors = [];
        this.maxErrors = 10; // Keep last 10 errors
        // Check if we're in development by looking for dev server
        this.isDevelopment = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        this.setupGlobalHandlers();
    }

    static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary();
        }
        return ErrorBoundary.instance;
    }

    private setupGlobalHandlers(): void {
        // Handle uncaught errors
        window.addEventListener('error', (event) => {
            this.handleError(event.error);
            event.preventDefault();
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason);
            event.preventDefault();
        });
    }

    handleError(error: unknown, componentStack?: string): void {
        const errorInfo: ErrorInfo = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            componentStack,
            timestamp: Date.now()
        };

        // Add to error list
        this.errors.push(errorInfo);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift(); // Remove oldest error
        }

        // Log the error
        this.logger.error(
            'Error caught by boundary:',
            error instanceof Error ? error : new Error(errorInfo.message)
        );
        if (componentStack) {
            this.logger.error('Component stack details:', new Error(componentStack));
        }

        // Emit error event
        this.eventSystem.emit('error', errorInfo);

        // In development, show an error overlay
        if (this.isDevelopment) {
            this.showErrorOverlay(errorInfo);
        }
    }

    private showErrorOverlay(error: ErrorInfo): void {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        overlay.style.color = '#ff5555';
        overlay.style.padding = '20px';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '14px';
        overlay.style.overflow = 'auto';
        overlay.style.zIndex = '9999';

        const content = document.createElement('div');
        content.innerHTML = `
            <h2 style="color: #ff5555;">Runtime Error</h2>
            <p>${error.message}</p>
            ${error.componentStack ? `<pre>${error.componentStack}</pre>` : ''}
            ${error.stack ? `<pre>${error.stack}</pre>` : ''}
            <p style="color: #666;">
                Press 'Esc' to dismiss this overlay.<br>
                The error has been logged to the console.
            </p>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Allow dismissing the overlay
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                window.removeEventListener('keydown', handleKeyDown);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
    }

    getErrors(): ErrorInfo[] {
        return [...this.errors];
    }

    clearErrors(): void {
        this.errors = [];
    }

    on(callback: (error: ErrorInfo) => void): void {
        this.eventSystem.on('error', callback);
    }

    off(callback: (error: ErrorInfo) => void): void {
        this.eventSystem.off('error', callback);
    }
} 