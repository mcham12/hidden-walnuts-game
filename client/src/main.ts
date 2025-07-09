console.log('main.ts loaded');
// Clean Entry Point - A++ Architecture

import { configureServices, GameManager } from './GameComposition';
import { container, ServiceTokens } from './core/Container';
import { EventBus, GameEvents } from './core/EventBus';
import { Logger, LogCategory } from './core/Logger';

class Application {
  private gameManager?: GameManager;
  private canvas?: HTMLCanvasElement;
  private lastQualityUpdate: number = 0; // TASK URGENTA.8: Track last quality update time

  async initialize(): Promise<void> {
    // TASK 8 FIX: Remove diagnostic console spam
    // Logger.info(LogCategory.CORE, '🚀 Application.initialize() called');
    // Logger.debug(LogCategory.CORE, '🔍 Testing debug level');
    // Logger.warn(LogCategory.CORE, '⚠️ Testing warn level');
    // Logger.error(LogCategory.CORE, '🚨 Testing error level');
    
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
      
      // Start server metrics polling
      this.startServerMetricsPolling();
      
      this.hideLoadingScreen();
      this.gameManager.start();
      
      // Setup character selection button
      this.setupCharacterSelectionButton();
      
      // Logger.info(LogCategory.CORE, '🎮 Game started with A++ architecture!');
      
    } catch (error) {
      Logger.error(LogCategory.CORE, '❌ Error in initialize()', error);
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
      // Logger.info(LogCategory.CORE, '✅ Game systems initialized');
    });

    eventBus.subscribe('scene.initialized', () => {
      // Logger.info(LogCategory.CORE, '🎭 Scene initialized');
    });

    eventBus.subscribe('terrain.loaded', () => {
      // Logger.info(LogCategory.CORE, '🌲 Terrain loaded');
    });

    // Add multiplayer event logging for debugging using proper Logger system
    eventBus.subscribe(GameEvents.MULTIPLAYER_CONNECTED, () => {
      // Logger.info(LogCategory.NETWORK, '🌐 ✅ Multiplayer connected!');
      this.updateMultiplayerStatus('Connected', 'status-connected');
    });
    
    eventBus.subscribe('remote_player_state', (_data: any) => {
      // Logger.debug(LogCategory.NETWORK, `🎮 Remote player update: ${data.squirrelId} at (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`);
    });
    
    eventBus.subscribe('player_disconnected', (_data: any) => {
      // Logger.info(LogCategory.NETWORK, `👋 Player disconnected: ${data.squirrelId}`);
    });

    // Enhanced connection quality monitoring with throttling
    let lastQualityUpdate = 0;
    eventBus.subscribe('network.connection_quality', (metrics: any) => {
      const now = Date.now();
      // Only update UI every 10 seconds to prevent spam
      if (now - lastQualityUpdate > 10000) {
        // Logger.debug(LogCategory.NETWORK, '🎨 Received connection quality event:', metrics);
        this.updateConnectionQualityDisplay(metrics);
        lastQualityUpdate = now;
      }
    });

    eventBus.subscribe('network.error', (error: any) => {
      this.displayNetworkError(error);
    });
  }

  private showLoadingScreen(): void {
    // Create loading screen without overwriting existing HTML
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
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
      ">
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
    `;
    
    // Add loading styles
    const loadingStyle = document.createElement('style');
    loadingStyle.textContent = `
      @keyframes loading {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(0%); }
        100% { transform: translateX(100%); }
      }
    `;
    
    document.head.appendChild(loadingStyle);
    document.body.appendChild(loadingScreen);
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

  private setupCharacterSelectionButton(): void {
    const characterButton = document.getElementById('open-character-gallery');
    if (characterButton && this.gameManager) {
      characterButton.addEventListener('click', () => {
        try {
          // Initialize gallery if not already done
          const containerElement = document.body;
          const characterSystem = this.gameManager!.getCharacterSelectionSystem();
          characterSystem.initializeGallery(containerElement);
          characterSystem.showCharacterGallery();
          // Logger.info(LogCategory.CORE, '🎭 Character gallery opened');
        } catch (error) {
          Logger.error(LogCategory.CORE, 'Failed to open character gallery', error);
        }
      });
      // Logger.info(LogCategory.CORE, '🎭 Character selection button initialized');
    } else {
      // Logger.warn(LogCategory.CORE, 'Character selection button not found or game manager not ready');
    }
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
    
    const eventBus = this.gameManager.getEventBus();
    const playerManager = this.gameManager.getPlayerManager();
    const networkSystem = this.gameManager.getNetworkSystem();
    const localPlayer = this.gameManager.getLocalPlayer();
    
    return {
      systems: 'Running',
      localPlayer: localPlayer?.id?.value || 'None',
      networkState: networkSystem?.isConnected() ? 'Connected' : 'Disconnected',
      remotePlayers: playerManager?.getVisiblePlayerCount() || 0,
      totalRemotePlayers: playerManager?.getAllPlayers()?.size || 0,
      events: eventBus ? 'Active' : 'None'
    };
  }

  private startDebugOverlay(): void {
    // TASK URGENTA.4: Reduced debug update frequency from 1 to 10 seconds
    setInterval(() => {
      this.updateMultiplayerStatus('Debug Info', 'status-debug');
    }, 10000); // TASK URGENTA.4: Increased from 1 to 10 seconds
    
    // Add debug commands to global scope for browser console
    if (typeof window !== 'undefined') {
      (window as any).gameDebug = {
        getPlayerManager: () => this.gameManager?.getPlayerManager(),
        getNetworkSystem: () => this.gameManager?.getNetworkSystem(),
        getPlayerCount: () => {
          const pm = this.gameManager?.getPlayerManager();
          return {
            visible: pm?.getVisiblePlayerCount() || 0,
            total: pm?.getAllPlayers()?.size || 0,
            stats: pm?.getPlayerStats()
          };
        },
        forceLogLevel: (_category: string, _level: string) => {
          // Logger.info(LogCategory.CORE, `🔧 Force log test: ${category} ${level}`);
          // Logger.debug(LogCategory.NETWORK, `🔧 Network debug test`);
          // Logger.debug(LogCategory.PLAYER, `🔧 Player debug test`);
        }
      };
      // Logger.info(LogCategory.CORE, '🎮 Debug commands available at window.gameDebug');
    }
  }

  private updateConnectionQualityDisplay(metrics: any): void {
    // TASK URGENTA.8: Reduce connection quality update frequency
    const now = performance.now();
    if (!this.lastQualityUpdate || now - this.lastQualityUpdate > 30000) { // Update every 30 seconds
      this.lastQualityUpdate = now;
      // Logger.debug(LogCategory.NETWORK, '🎨 Updating connection quality display:', metrics);
    } else {
      return; // Skip update if too frequent
    }
    
    // Get or create the multiplayer status container
    let statusContainer = document.getElementById('multiplayer-status');
    if (!statusContainer) {
      statusContainer = document.createElement('div');
      statusContainer.id = 'multiplayer-status';
      statusContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 1000;
        min-width: 200px;
      `;
      document.body.appendChild(statusContainer);
    }
    
    // Get or create the connection quality element
    let qualityElement = document.getElementById('connection-quality');
    if (!qualityElement) {
      qualityElement = document.createElement('div');
      qualityElement.id = 'connection-quality';
      qualityElement.style.cssText = `
        font-weight: bold;
        margin: 5px 0;
      `;
      statusContainer.appendChild(qualityElement);
    }
    
    // Get or create the connection metrics element
    let metricsElement = document.getElementById('connection-metrics');
    if (!metricsElement) {
      metricsElement = document.createElement('div');
      metricsElement.id = 'connection-metrics';
      metricsElement.style.cssText = `
        font-size: 12px;
        margin-top: 5px;
        opacity: 0.8;
      `;
      statusContainer.appendChild(metricsElement);
    }

    const qualityColors = {
      excellent: '#00ff00',
      good: '#90EE90',
      fair: '#ffff00',
      poor: '#ffa500',
      critical: '#ff0000'
    };

    const quality = (metrics.quality as keyof typeof qualityColors) || 'poor';
    const color = qualityColors[quality] || '#ff0000';
    
    qualityElement.style.color = color;
    qualityElement.textContent = `Connection: ${quality.toUpperCase()}`;
    
    // Update detailed metrics if available
    if (metricsElement) {
      metricsElement.innerHTML = `
        <div>Latency: ${metrics.latency?.toFixed(1) || 'N/A'}ms</div>
        <div>Packet Loss: ${metrics.packetLoss?.toFixed(1) || '0'}%</div>
        <div>Uptime: ${this.formatUptime(metrics.connectionUptime)}</div>
        <div>Messages: ${metrics.messageCount || 0}</div>
        <div>Errors: ${metrics.errorCount || 0}</div>
      `;
    }
  }

  private displayNetworkError(error: any): void {
    // Get or create the network errors element
    let errorElement = document.getElementById('network-errors');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'network-errors';
      errorElement.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 1000;
        max-width: 400px;
      `;
      document.body.appendChild(errorElement);
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'network-error';
    errorDiv.innerHTML = `
      <span class="error-time">${new Date(error.timestamp).toLocaleTimeString()}</span>
      <span class="error-type">${error.type}</span>
      <span class="error-message">${error.message}</span>
      <span class="error-recoverable">${error.recoverable ? '🔄' : '❌'}</span>
    `;

    errorElement.appendChild(errorDiv);

    // Keep only last 5 errors
    while (errorElement.children.length > 5) {
      errorElement.removeChild(errorElement.firstChild!);
    }

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 10000);
  }

  private formatUptime(ms: number): string {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private startServerMetricsPolling(): void {
    // TASK URGENTA.4: Reduced polling frequency from 10 to 60 seconds
    setInterval(async () => {
      try {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const response = await fetch(`${apiBase}/server-metrics`);
        
        if (response.ok) {
          const metrics = await response.json();
          this.updateServerMetricsDisplay(metrics);
        }
      } catch (error) {
        // Logger.debug(LogCategory.NETWORK, 'Failed to fetch server metrics:', error);
      }
    }, 60000); // TASK URGENTA.4: Increased from 10 to 60 seconds
  }

  private updateServerMetricsDisplay(metrics: any): void {
    // Get or create the server metrics element
    let metricsElement = document.getElementById('server-metrics');
    if (!metricsElement) {
      metricsElement = document.createElement('div');
      metricsElement.id = 'server-metrics';
      metricsElement.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        z-index: 1000;
        max-width: 250px;
      `;
      document.body.appendChild(metricsElement);
    }

    const serverMetrics = metrics.serverMetrics || {};
    const uptime = this.formatUptime(serverMetrics.uptime || 0);
    const avgLatency = serverMetrics.averageLatency ? `${serverMetrics.averageLatency.toFixed(1)}ms` : 'N/A';

    metricsElement.innerHTML = `
      <h4>🖥️ Server Metrics</h4>
      <div>Active Players: ${metrics.activePlayers || 0}</div>
      <div>Total Connections: ${serverMetrics.totalConnections || 0}</div>
      <div>Server Uptime: ${uptime}</div>
      <div>Average Latency: ${avgLatency}</div>
      <div>Total Errors: ${serverMetrics.totalErrors || 0}</div>
    `;
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