// Clean Entry Point - A++ Architecture

import { configureServices, GameManager } from './GameComposition';
import { container, ServiceTokens } from './core/Container';
import { EventBus, GameEvents } from './core/EventBus';
import { Logger, LogCategory } from './core/Logger';

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
      
      // Make game manager accessible for debugging
      (window as any).gameManager = this.gameManager;
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Start debug overlay updates
      this.startDebugOverlay();
      
      this.hideLoadingScreen();
      this.gameManager.start();
      
      Logger.info(LogCategory.CORE, '🎮 Game started with A++ architecture!');
      
    } catch (error) {
      this.showErrorScreen(error as Error);
    }
  }

  private setupCanvas(): HTMLCanvasElement {
    let canvas = document.querySelector('canvas');
    
    if (!canvas) {
      // Create canvas if it doesn't exist
      canvas = document.createElement('canvas');
      const app = document.getElementById('app');
      if (app) {
        app.appendChild(canvas);
      } else {
        document.body.appendChild(canvas);
      }
    }

    // Set canvas size and style
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    // Handle window resize
    window.addEventListener('resize', () => {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    });

    return canvas;
  }

  private setupEventHandlers(): void {
    const eventBus = container.resolve<EventBus>(ServiceTokens.EVENT_BUS);
    
    // System events
    eventBus.subscribe(GameEvents.SYSTEM_ERROR, (error: Error) => {
      Logger.error(LogCategory.CORE, '💥 System Error', error);
      this.showErrorScreen(error);
    });

    eventBus.subscribe('game.initialized', () => {
      Logger.info(LogCategory.CORE, '✅ Game systems initialized');
    });

    eventBus.subscribe('scene.initialized', () => {
      Logger.info(LogCategory.CORE, '🎭 Scene initialized');
    });

    eventBus.subscribe('terrain.loaded', () => {
      Logger.info(LogCategory.CORE, '🌲 Terrain loaded');
    });

    // Add multiplayer event logging for debugging using proper Logger system
    eventBus.subscribe(GameEvents.MULTIPLAYER_CONNECTED, () => {
      Logger.info(LogCategory.NETWORK, '🌐 ✅ Multiplayer connected!');
      this.updateMultiplayerStatus('Connected', 'status-connected');
    });
    
    eventBus.subscribe('remote_player_state', (data: any) => {
      Logger.debug(LogCategory.NETWORK, `🎮 Remote player update: ${data.squirrelId} at (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`);
    });
    
    eventBus.subscribe('player_disconnected', (data: any) => {
      Logger.info(LogCategory.NETWORK, `👋 Player disconnected: ${data.squirrelId}`);
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
    `;
  }

  private hideLoadingScreen(): void {
    const loadingScreen = document.getElementById('loading-screen');
    
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.remove();
      }, 500);
    }
  }

  private showErrorScreen(error: Error): void {
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: monospace;
        text-align: center;
        z-index: 9999;
      ">
        <h2>🚨 Game Error</h2>
        <p>The game encountered a critical error and cannot continue.</p>
        <pre>${error.message}</pre>
        <button onclick="location.reload()" style="
          margin-top: 10px;
          padding: 10px 20px;
          background: white;
          color: #ff4444;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Reload Game</button>
      </div>
    `;
  }

  destroy(): void {
    if (this.gameManager) {
      this.gameManager.stop();
    }
  }

  private updateMultiplayerStatus(_status: string, className: string): void {
    let statusDiv = document.getElementById('multiplayer-status');
    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.id = 'multiplayer-status';
      statusDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: monospace;
        font-size: 12px;
        z-index: 1000;
        min-width: 200px;
      `;
      document.body.appendChild(statusDiv);
    }
    
    // Get additional debug info
    const debugInfo = this.getDebugInfo();
    
    statusDiv.innerHTML = `
      <div style="color: ${className === 'status-connected' ? '#4CAF50' : '#FF9800'}">
        <strong>🎮 Hidden Walnuts Debug</strong>
      </div>
      <div style="margin-top: 5px; font-size: 11px;">
        <div>🌐 Network: ${debugInfo.networkState || 'Unknown'}</div>
        <div>🐿️ Local Player: ${debugInfo.localPlayer?.substring(0, 8) || 'None'}</div>
        <div>👥 Remote Players: ${debugInfo.remotePlayers}/${debugInfo.totalRemotePlayers}</div>
        <div>⚙️ Systems: ${debugInfo.systems || 'Unknown'}</div>
        <div>📡 Events: ${debugInfo.events || 'Unknown'}</div>
        <div style="margin-top: 3px; color: #888;">
          ${new Date().toLocaleTimeString()}
        </div>
      </div>
    `;
    statusDiv.className = className;
  }

  private getDebugInfo(): any {
    if (!this.gameManager) return {};
    
    const eventBus = (this.gameManager as any).eventBus;
    const playerManager = (this.gameManager as any).playerManager;
    const networkSystem = (this.gameManager as any).networkSystem;
    
    return {
      systems: 'Running',
      localPlayer: (this.gameManager as any).localPlayer?.id?.value || 'None',
      networkState: networkSystem?.websocket?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected',
      remotePlayers: playerManager?.getVisiblePlayerCount() || 0,
      totalRemotePlayers: playerManager?.getAllPlayers()?.size || 0,
      events: eventBus ? 'Active' : 'None'
    };
  }

  private startDebugOverlay(): void {
    // Update debug info every second
    setInterval(() => {
      this.updateMultiplayerStatus('Debug Info', 'status-debug');
    }, 1000);
  }
}

// Application entry point
const app = new Application();

// Global error handling
window.addEventListener('error', (event) => {
  Logger.error(LogCategory.CORE, 'Unhandled error', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  Logger.error(LogCategory.CORE, 'Unhandled promise rejection', event.reason);
});

// Start the application
app.initialize().catch((error) => {
  Logger.error(LogCategory.CORE, 'Failed to start game', error);
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.destroy();
});

// Legacy exports for backward compatibility with existing terrain/forest code
// CHEN'S FIX: Use relative URLs in dev (proxy handles routing) and absolute in production
export const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:8787');
export const DEBUG = false;

async function main() {
  // ... existing main function content ...
}

// Start the game
main().catch((error) => {
  Logger.error(LogCategory.CORE, 'Game initialization failed:', error);
}); 