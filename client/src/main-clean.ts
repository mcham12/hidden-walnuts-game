// Clean Entry Point - A++ Architecture

import { configureServices, GameManager } from './GameComposition';
import { container, ServiceTokens } from './core/Container';
import { EventBus, GameEvents } from './core/EventBus';

class Application {
  private gameManager?: GameManager;
  private canvas?: HTMLCanvasElement;

  async initialize(): Promise<void> {
    try {
      this.showLoadingScreen();
      
      // Configure dependency injection
      configureServices();
      
      // Setup canvas
      this.canvas = this.setupCanvas();
      
      // Initialize game with clean architecture
      this.gameManager = new GameManager();
      await this.gameManager.initialize(this.canvas);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      this.hideLoadingScreen();
      this.gameManager.start();
      
      console.log('🎮 Game started with A++ architecture!');
      
    } catch (error) {
      this.showErrorScreen(error as Error);
    }
  }

  private setupCanvas(): HTMLCanvasElement {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    return canvas;
  }

  private setupEventHandlers(): void {
    const eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    
    // System events
    eventBus.subscribe(GameEvents.SYSTEM_ERROR, (error: Error) => {
      console.error('💥 System Error:', error);
      this.showErrorScreen(error);
    });

    eventBus.subscribe('game.initialized', () => {
      console.log('✅ Game systems initialized');
    });

    eventBus.subscribe('scene.initialized', () => {
      console.log('🎭 Scene initialized');
    });

    eventBus.subscribe('terrain.loaded', () => {
      console.log('🌲 Terrain loaded');
    });
  }

  private showLoadingScreen(): void {
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        z-index: 1000;
      " id="loading-screen">
        <div style="font-size: 48px; margin-bottom: 20px;">🐿️</div>
        <h1 style="margin: 0 0 20px 0; font-weight: 300;">Hidden Walnuts</h1>
        <p style="margin: 0; opacity: 0.8;">Initializing A++ architecture...</p>
        <div style="
          width: 200px;
          height: 4px;
          background: rgba(255,255,255,0.2);
          margin-top: 20px;
          border-radius: 2px;
          overflow: hidden;
        ">
          <div style="
            width: 100%;
            height: 100%;
            background: white;
            animation: loading 2s ease-in-out infinite;
          "></div>
        </div>
      </div>
      <style>
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      </style>
      <canvas style="display: none;"></canvas>
    `;
  }

  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    const canvas = document.querySelector('canvas');
    
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.remove();
        if (canvas) {
          canvas.style.display = 'block';
        }
      }, 500);
    }
  }

  private showErrorScreen(error: Error): void {
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
      ">
        <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
        <h1 style="margin: 0 0 20px 0; font-weight: 300;">Game Error</h1>
        <p style="margin: 0 0 20px 0; opacity: 0.9; max-width: 600px;">
          ${error.message}
        </p>
        <button onclick="window.location.reload()" style="
          background: rgba(255,255,255,0.2);
          border: 1px solid white;
          color: white;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
        ">Restart Game</button>
      </div>
    `;
  }

  destroy(): void {
    if (this.gameManager) {
      this.gameManager.stop();
    }
  }
}

// Application entry point
const app = new Application();

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Start the application
app.initialize().catch(console.error);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
}); 