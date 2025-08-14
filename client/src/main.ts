// Clean Entry Point - A++ Architecture

import { configureServices, GameManager } from './GameComposition';
import { container, ServiceTokens } from './core/Container';
import { EventBus, GameEvents } from './core/EventBus';
import { Logger, LogCategory } from './core/Logger';

// Add debug element to page
const debugDiv = document.createElement('div');
debugDiv.style.cssText = `
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0,0,0,0.8);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999;
  max-width: 300px;
`;
debugDiv.innerHTML = 'Game loading...';
document.body.appendChild(debugDiv);

// Override console.log to also show in debug div
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  originalLog.apply(console, args);
  if (args[0] && typeof args[0] === 'string' && args[0].includes('🎮')) {
    debugDiv.innerHTML += '<br>' + args.join(' ');
  }
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  if (args[0] && typeof args[0] === 'string' && args[0].includes('⚠️')) {
    debugDiv.innerHTML += '<br>' + args.join(' ');
  }
};

console.error = (...args) => {
  originalError.apply(console, args);
  if (args[0] && typeof args[0] === 'string' && args[0].includes('❌')) {
    debugDiv.innerHTML += '<br>' + args.join(' ');
  }
};

class Application {
  private gameManager?: GameManager;
  private canvas?: HTMLCanvasElement;
  private lastQualityUpdate: number = 0; // TASK URGENTA.8: Track last quality update time

  async initialize(): Promise<void> {
    // TASK 8 FIX: Remove diagnostic console spam
    Logger.info(LogCategory.CORE, '🚀 Application.initialize() called');
    Logger.debug(LogCategory.CORE, '🔍 Testing debug level');
    Logger.warn(LogCategory.CORE, '⚠️ Testing warn level');
    Logger.error(LogCategory.CORE, '🚨 Testing error level');
    
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
      
      Logger.info(LogCategory.CORE, '🎮 Game started with A++ architecture!');
      
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

    // Enhanced connection quality monitoring with throttling
    let lastQualityUpdate = 0;
    eventBus.subscribe('network.connection_quality', (metrics: any) => {
      const now = Date.now();
      // Only update UI every 10 seconds to prevent spam
      if (now - lastQualityUpdate > 10000) {
        Logger.debug(LogCategory.NETWORK, '🎨 Received connection quality event:', metrics);
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
    // playerManager removed - using simple multiplayer system now
    const networkSystem = this.gameManager.getNetworkSystem();
    const localPlayer = this.gameManager.getLocalPlayer();
    
    return {
      systems: 'Running',
      localPlayer: localPlayer?.id?.value || 'None',
      networkState: networkSystem?.isConnected() ? 'Connected' : 'Disconnected',
      remotePlayers: 0, // TODO: implement in simple multiplayer system
      totalRemotePlayers: 0, // TODO: implement in simple multiplayer system
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
        // getPlayerManager removed - using simple multiplayer system
        getNetworkSystem: () => this.gameManager?.getNetworkSystem(),
        getPlayerCount: () => {
          // pm removed - using simple multiplayer system
          return {
            visible: 0, // TODO: implement in simple multiplayer system
            total: 0, // TODO: implement in simple multiplayer system
            stats: {} // TODO: implement in simple multiplayer system
          };
        },
        debugScene: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            const camera = sceneManager.getCamera();
            
            console.log('🔍 SCENE DEBUG:');
            console.log(`Total scene children: ${scene.children.length}`);
            console.log(`📷 Camera position: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})`);
            console.log(`📷 Camera near/far: ${camera.near}/${camera.far}`);
            
            let playerMeshes = 0;
            scene.traverse((child: any) => {
              if (child.__squirrelId || child.__entityType) {
                playerMeshes++;
                console.log(`Player mesh: ${child.__squirrelId || 'unknown'} (${child.__entityType || 'unknown'})`);
                console.log(`  - visible: ${child.visible}`);
                console.log(`  - position: (${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)})`);
                console.log(`  - scale: (${child.scale.x}, ${child.scale.y}, ${child.scale.z})`);
                console.log(`  - in scene: ${scene.children.includes(child)}`);
                
                // Calculate distance from camera to player
                const distance = Math.sqrt(
                  Math.pow(child.position.x - camera.position.x, 2) +
                  Math.pow(child.position.y - camera.position.y, 2) +
                  Math.pow(child.position.z - camera.position.z, 2)
                );
                console.log(`  - distance from camera: ${distance.toFixed(2)}`);
                
                // Check if mesh is in camera frustum
                child.traverse((submesh: any) => {
                  if (submesh.isMesh) {
                    console.log(`    - submesh visible: ${submesh.visible}`);
                    console.log(`    - submesh material opacity: ${submesh.material?.opacity || 'N/A'}`);
                    console.log(`    - submesh material transparent: ${submesh.material?.transparent || 'N/A'}`);
                  }
                });
              }
            });
            
            console.log(`Found ${playerMeshes} player meshes in scene`);
            return { totalChildren: scene.children.length, playerMeshes };
          } catch (error) {
            console.error('Error debugging scene:', error);
            return null;
          }
        },
        setCameraFixed: (x = 0, y = 15, z = 15) => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const camera = sceneManager.getCamera();
            
            console.log(`📷 Setting camera to fixed position: (${x}, ${y}, ${z})`);
            camera.position.set(x, y, z);
            camera.lookAt(0, 2, 0);
            
            // Disable camera following by modifying the game manager temporarily
            const gameManager = this.gameManager;
            if (gameManager) {
              console.log('📷 Disabling camera following temporarily');
              (gameManager as any).updateCameraToFollowLocalPlayer = () => {
                // No-op to disable camera following
              };
            }
            
            return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
          } catch (error) {
            console.error('Error setting fixed camera:', error);
            return null;
          }
        },
        makeRemotePlayersVisible: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔧 Making remote players more visible...');
            let modifiedCount = 0;
            let allSquirrelMeshes = 0;
            
            // First attempt: look for marked remote players
            scene.traverse((child: any) => {
              if (child.__squirrelId && child.__entityType === 'remote_player') {
                console.log(`🔧 Found marked remote player: ${child.__squirrelId}`);
                
                // Make much larger temporarily
                child.scale.set(2.0, 2.0, 2.0);
                
                // Ensure visibility
                child.visible = true;
                
                // Modify materials to be more visible
                child.traverse((submesh: any) => {
                  if (submesh.isMesh && submesh.material) {
                    if (Array.isArray(submesh.material)) {
                      submesh.material.forEach((mat: any) => {
                        mat.emissive = { r: 0.2, g: 0.2, b: 0.8 }; // Blue glow
                        mat.emissiveIntensity = 0.3;
                      });
                    } else {
                      submesh.material.emissive = { r: 0.2, g: 0.2, b: 0.8 }; // Blue glow
                      submesh.material.emissiveIntensity = 0.3;
                    }
                    submesh.visible = true;
                  }
                });
                
                modifiedCount++;
              }
            });
            
            // If no marked remote players found, look for any squirrel models that might be remote players
            if (modifiedCount === 0) {
              console.log('🔧 No marked remote players found, looking for any squirrel models...');
              
              scene.traverse((child: any) => {
                // Look for meshes that might be squirrel models (scale 0.3 is typical)
                if (child.scale && Math.abs(child.scale.x - 0.3) < 0.1 && child.position) {
                  allSquirrelMeshes++;
                  console.log(`🔧 Found potential squirrel mesh at position (${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)}) with scale (${child.scale.x}, ${child.scale.y}, ${child.scale.z})`);
                  console.log(`🔧 Mesh has __squirrelId: ${child.__squirrelId || 'NONE'}, __entityType: ${child.__entityType || 'NONE'}`);
                  
                  // Make it visible regardless
                  child.scale.set(2.0, 2.0, 2.0);
                  child.visible = true;
                  
                  // Add bright red color to distinguish from local player
                  child.traverse((submesh: any) => {
                    if (submesh.isMesh && submesh.material) {
                      if (Array.isArray(submesh.material)) {
                        submesh.material.forEach((mat: any) => {
                          mat.emissive = { r: 0.8, g: 0.1, b: 0.1 }; // Red glow
                          mat.emissiveIntensity = 0.5;
                        });
                      } else {
                        submesh.material.emissive = { r: 0.8, g: 0.1, b: 0.1 }; // Red glow  
                        submesh.material.emissiveIntensity = 0.5;
                      }
                      submesh.visible = true;
                    }
                  });
                  
                  modifiedCount++;
                }
              });
            }
            
            console.log(`🔧 Modified ${modifiedCount} meshes for visibility (found ${allSquirrelMeshes} potential squirrel meshes)`);
            return { modified: modifiedCount, potentialSquirrels: allSquirrelMeshes };
          } catch (error) {
            console.error('Error making remote players visible:', error);
            return null;
          }
        },
        inspectAllMeshes: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔍 FULL SCENE INSPECTION:');
            console.log(`Scene has ${scene.children.length} direct children`);
            
            let totalMeshes = 0;
            let squirrelMeshes = 0;
            
            scene.traverse((child: any) => {
              if (child.isMesh || (child.scale && child.position)) {
                totalMeshes++;
                
                const isSquirrelScale = child.scale && Math.abs(child.scale.x - 0.3) < 0.1;
                const hasSquirrelId = child.__squirrelId;
                const isRemotePlayer = child.__entityType === 'remote_player';
                
                if (isSquirrelScale || hasSquirrelId || isRemotePlayer) {
                  squirrelMeshes++;
                  console.log(`🐿️ SQUIRREL MESH #${squirrelMeshes}:`);
                  console.log(`  - Type: ${child.type || 'unknown'}`);
                  console.log(`  - Position: (${child.position?.x?.toFixed(1) || 'N/A'}, ${child.position?.y?.toFixed(1) || 'N/A'}, ${child.position?.z?.toFixed(1) || 'N/A'})`);
                  console.log(`  - Scale: (${child.scale?.x || 'N/A'}, ${child.scale?.y || 'N/A'}, ${child.scale?.z || 'N/A'})`);
                  console.log(`  - Visible: ${child.visible}`);
                  console.log(`  - Parent: ${child.parent ? child.parent.type || 'Object3D' : 'NONE'}`);
                  console.log(`  - In scene directly: ${scene.children.includes(child)}`);
                  console.log(`  - __squirrelId: ${child.__squirrelId || 'NONE'}`);
                  console.log(`  - __entityType: ${child.__entityType || 'NONE'}`);
                  console.log(`  - Material count: ${child.material ? (Array.isArray(child.material) ? child.material.length : 1) : 'NO MATERIAL'}`);
                  
                  // Check if it has geometry
                  if (child.geometry) {
                    console.log(`  - Geometry: ${child.geometry.type}, vertices: ${child.geometry.attributes?.position?.count || 'unknown'}`);
                  } else {
                    console.log(`  - Geometry: NONE`);
                  }
                  
                  // Check children
                  if (child.children && child.children.length > 0) {
                    console.log(`  - Children: ${child.children.length}`);
                    child.children.forEach((childMesh: any, i: number) => {
                      if (childMesh.isMesh) {
                        console.log(`    - Child ${i}: ${childMesh.type}, visible: ${childMesh.visible}, material: ${!!childMesh.material}`);
                      }
                    });
                  }
                  
                  console.log(`  ---`);
                }
              }
            });
            
            console.log(`Total meshes in scene: ${totalMeshes}`);
            console.log(`Squirrel-like meshes: ${squirrelMeshes}`);
            
            return { totalMeshes, squirrelMeshes };
          } catch (error) {
            console.error('Error inspecting meshes:', error);
            return null;
          }
        },
        fixRemotePlayerMesh: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔧 FIXING REMOTE PLAYER MESH:');
            let fixedCount = 0;
            
            scene.traverse((child: any) => {
              if (child.__squirrelId && child.__entityType === 'remote_player') {
                console.log(`🔧 Found remote player: ${child.__squirrelId}`);
                console.log(`🔧 Remote player has ${child.children.length} children:`);
                
                child.children.forEach((childMesh: any, i: number) => {
                  console.log(`  Child ${i}: ${childMesh.type}, visible: ${childMesh.visible}`);
                  console.log(`    - isMesh: ${childMesh.isMesh}`);
                  console.log(`    - geometry: ${!!childMesh.geometry}`);
                  console.log(`    - material: ${!!childMesh.material}`);
                  console.log(`    - position: (${childMesh.position?.x?.toFixed(1) || 'N/A'}, ${childMesh.position?.y?.toFixed(1) || 'N/A'}, ${childMesh.position?.z?.toFixed(1) || 'N/A'})`);
                  console.log(`    - scale: (${childMesh.scale?.x || 'N/A'}, ${childMesh.scale?.y || 'N/A'}, ${childMesh.scale?.z || 'N/A'})`);
                  
                  if (childMesh.children && childMesh.children.length > 0) {
                    console.log(`    - has ${childMesh.children.length} sub-children:`);
                    childMesh.children.forEach((subChild: any, j: number) => {
                      console.log(`      SubChild ${j}: ${subChild.type}, visible: ${subChild.visible}, isMesh: ${subChild.isMesh}, material: ${!!subChild.material}`);
                      
                      // Try to fix any invisible submeshes
                      if (subChild.isMesh) {
                        subChild.visible = true;
                        if (subChild.material) {
                          if (Array.isArray(subChild.material)) {
                            subChild.material.forEach((mat: any) => {
                              mat.emissive = { r: 1.0, g: 0.5, b: 0.0 }; // Bright orange
                              mat.emissiveIntensity = 0.8;
                            });
                          } else {
                            subChild.material.emissive = { r: 1.0, g: 0.5, b: 0.0 }; // Bright orange
                            subChild.material.emissiveIntensity = 0.8;
                          }
                        }
                        console.log(`      ✅ Enhanced SubChild ${j} with orange glow`);
                      }
                    });
                  }
                  
                  // Also try to fix the direct child
                  if (childMesh.isMesh) {
                    childMesh.visible = true;
                    if (childMesh.material) {
                      if (Array.isArray(childMesh.material)) {
                        childMesh.material.forEach((mat: any) => {
                          mat.emissive = { r: 1.0, g: 0.0, b: 1.0 }; // Bright magenta
                          mat.emissiveIntensity = 0.8;
                        });
                      } else {
                        childMesh.material.emissive = { r: 1.0, g: 0.0, b: 1.0 }; // Bright magenta
                        childMesh.material.emissiveIntensity = 0.8;
                      }
                    }
                    console.log(`  ✅ Enhanced Child ${i} with magenta glow`);
                  }
                });
                
                // Make the container bigger too
                child.scale.set(2.0, 2.0, 2.0);
                console.log(`🔧 Scaled up remote player container to 2.0x`);
                
                fixedCount++;
              }
            });
            
            console.log(`🔧 Fixed ${fixedCount} remote player meshes`);
            return { fixed: fixedCount };
          } catch (error) {
            console.error('Error fixing remote player mesh:', error);
            return null;
          }
        },
        findExactRemotePlayer: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔍 SEARCHING FOR EXACT REMOTE PLAYER:');
            const targetId = '717dfd7a-3659-4936-ae65-ff3008a40787';
            
            let found = false;
            scene.traverse((child: any) => {
              // Look for the exact mesh we know exists at position (6.0, 1.0, 1.6)
              if (child.position && 
                  Math.abs(child.position.x - 6.0) < 0.5 && 
                  Math.abs(child.position.y - 1.0) < 0.5 && 
                  Math.abs(child.position.z - 1.6) < 0.5) {
                
                found = true;
                console.log(`🎯 FOUND MESH AT TARGET POSITION:`);
                console.log(`  - Type: ${child.type}`);
                console.log(`  - Position: (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
                console.log(`  - Scale: (${child.scale?.x || 'N/A'}, ${child.scale?.y || 'N/A'}, ${child.scale?.z || 'N/A'})`);
                console.log(`  - Visible: ${child.visible}`);
                console.log(`  - __squirrelId: ${child.__squirrelId || 'NONE'}`);
                console.log(`  - __entityType: ${child.__entityType || 'NONE'}`);
                
                // FORCE this mesh to be unmissable
                console.log(`🔧 FORCING VISIBILITY ON TARGET MESH:`);
                
                // Make container huge and bright red
                child.scale.set(5.0, 5.0, 5.0);
                child.visible = true;
                
                // Skip the wireframe due to Three.js import issues
                console.log('🔧 Skipping wireframe creation due to import issue');
                
                // Traverse all children and make them glow bright red
                child.traverse((descendant: any) => {
                  if (descendant.isMesh && descendant.material) {
                    descendant.visible = true;
                    if (Array.isArray(descendant.material)) {
                      descendant.material.forEach((mat: any) => {
                        mat.emissive = { r: 1.0, g: 0.0, b: 0.0 }; // Bright red
                        mat.emissiveIntensity = 1.0; // Maximum glow
                      });
                    } else {
                      descendant.material.emissive = { r: 1.0, g: 0.0, b: 0.0 }; // Bright red
                      descendant.material.emissiveIntensity = 1.0; // Maximum glow
                    }
                    console.log(`  ✅ Made descendant ${descendant.type} glow bright red`);
                  }
                });
                
                console.log(`🔧 Target mesh scaled to 5.0x with red wireframe and bright red glow`);
              }
            });
            
            if (!found) {
              console.log(`❌ NO MESH FOUND AT POSITION (6.0, 1.0, 1.6)`);
            }
            
            return { found };
          } catch (error) {
            console.error('Error finding exact remote player:', error);
            return null;
          }
        },
        debugMaterialSharing: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔍 INVESTIGATING MATERIAL SHARING:');
            
            let localPlayerMeshes = [];
            let remotePlayerMeshes = [];
            let allMaterials = new Map();
            
            scene.traverse((child: any) => {
              if (child.scale && Math.abs(child.scale.x - 0.3) < 0.2) {
                const position = `(${child.position?.x?.toFixed(1) || 'N/A'}, ${child.position?.y?.toFixed(1) || 'N/A'}, ${child.position?.z?.toFixed(1) || 'N/A'})`;
                const meshInfo = {
                  type: child.type,
                  position: position,
                  squirrelId: child.__squirrelId || 'NONE',
                  entityType: child.__entityType || 'NONE',
                  materials: []
                };
                
                // Collect all materials in this mesh hierarchy
                child.traverse((descendant: any) => {
                  if (descendant.isMesh && descendant.material) {
                    if (Array.isArray(descendant.material)) {
                      descendant.material.forEach((mat: any, i: number) => {
                        const matId = mat.uuid || `mat_${i}`;
                        meshInfo.materials.push(matId);
                        if (!allMaterials.has(matId)) {
                          allMaterials.set(matId, []);
                        }
                        allMaterials.get(matId).push(`${meshInfo.squirrelId || meshInfo.entityType}_${descendant.type}`);
                      });
                    } else {
                      const matId = descendant.material.uuid || 'unknown';
                      meshInfo.materials.push(matId);
                      if (!allMaterials.has(matId)) {
                        allMaterials.set(matId, []);
                      }
                      allMaterials.get(matId).push(`${meshInfo.squirrelId || meshInfo.entityType}_${descendant.type}`);
                    }
                  }
                });
                
                if (child.__entityType === 'remote_player') {
                  remotePlayerMeshes.push(meshInfo);
                } else {
                  localPlayerMeshes.push(meshInfo);
                }
              }
            });
            
            console.log(`📊 Found ${localPlayerMeshes.length} local player meshes, ${remotePlayerMeshes.length} remote player meshes`);
            
            localPlayerMeshes.forEach((mesh, i) => {
              console.log(`🐿️ LOCAL MESH ${i + 1}:`);
              console.log(`  Position: ${mesh.position}`);
              console.log(`  SquirrelId: ${mesh.squirrelId}`);
              console.log(`  Materials: [${mesh.materials.join(', ')}]`);
            });
            
            remotePlayerMeshes.forEach((mesh, i) => {
              console.log(`🌐 REMOTE MESH ${i + 1}:`);
              console.log(`  Position: ${mesh.position}`);
              console.log(`  SquirrelId: ${mesh.squirrelId}`);
              console.log(`  Materials: [${mesh.materials.join(', ')}]`);
            });
            
            console.log(`🔗 MATERIAL SHARING ANALYSIS:`);
            let sharedMaterials = 0;
            allMaterials.forEach((usedBy, materialId) => {
              if (usedBy.length > 1) {
                sharedMaterials++;
                console.log(`  Material ${materialId} is SHARED by: ${usedBy.join(', ')}`);
              }
            });
            
            if (sharedMaterials === 0) {
              console.log('  ✅ No shared materials detected');
            } else {
              console.log(`  ⚠️ Found ${sharedMaterials} shared materials - this could cause the bug!`);
            }
            
            return { localMeshes: localPlayerMeshes.length, remoteMeshes: remotePlayerMeshes.length, sharedMaterials };
          } catch (error) {
            console.error('Error debugging material sharing:', error);
            return null;
          }
        },
        debugMeshHierarchy: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            console.log('🔍 MESH HIERARCHY ANALYSIS:');
            
            scene.traverse((child: any) => {
              if (child.__squirrelId === '717dfd7a-3659-4936-ae65-ff3008a40787') {
                console.log(`🌐 REMOTE PLAYER HIERARCHY:`);
                console.log(`Root: ${child.type} at (${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)})`);
                
                const printHierarchy = (obj: any, depth = 0) => {
                  const indent = '  '.repeat(depth);
                  console.log(`${indent}- ${obj.type} (${obj.children.length} children)`);
                  
                  if (obj.isMesh && obj.material) {
                    const matId = obj.material.uuid || 'unknown';
                    console.log(`${indent}  📦 Material: ${matId}`);
                    console.log(`${indent}  📦 Material object: ${typeof obj.material}`);
                    console.log(`${indent}  📦 Is cloned: ${obj.material.name?.includes('clone') || 'unknown'}`);
                  }
                  
                  obj.children.forEach((childObj: any) => {
                    printHierarchy(childObj, depth + 1);
                  });
                };
                
                printHierarchy(child);
              }
            });
            
            // Also check local player for comparison
            scene.traverse((child: any) => {
              if (child.scale && Math.abs(child.scale.x - 0.3) < 0.1 && 
                  child.position && child.position.x > 10) { // Local player is at position ~13
                console.log(`🐿️ LOCAL PLAYER HIERARCHY:`);
                console.log(`Root: ${child.type} at (${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)})`);
                
                const printHierarchy = (obj: any, depth = 0) => {
                  const indent = '  '.repeat(depth);
                  console.log(`${indent}- ${obj.type} (${obj.children.length} children)`);
                  
                  if (obj.isMesh && obj.material) {
                    const matId = obj.material.uuid || 'unknown';
                    console.log(`${indent}  📦 Material: ${matId}`);
                  }
                  
                  obj.children.forEach((childObj: any) => {
                    printHierarchy(childObj, depth + 1);
                  });
                };
                
                printHierarchy(child);
                return; // Only show first local player
              }
            });
            
            return { analyzed: true };
          } catch (error) {
            console.error('Error debugging mesh hierarchy:', error);
            return null;
          }
        },
        finalVisibilityTest: () => {
          try {
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            const camera = sceneManager.getCamera();
            
            console.log('🎯 FINAL VISIBILITY TEST:');
            
            scene.traverse((child: any) => {
              if (child.__squirrelId === '717dfd7a-3659-4936-ae65-ff3008a40787') {
                console.log(`🌐 Remote player found at (${child.position.x}, ${child.position.y}, ${child.position.z})`);
                console.log(`📷 Camera at (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`);
                
                // Make it ABSOLUTELY UNMISSABLE
                child.scale.set(10.0, 10.0, 10.0);  // Massive scale
                child.position.y = 5.0;  // Lift it up in the air
                
                child.traverse((descendant: any) => {
                  if (descendant.isMesh && descendant.material) {
                    // Bright emissive pink that glows in the dark
                    descendant.material.emissive = { r: 1.0, g: 0.0, b: 1.0 };
                    descendant.material.emissiveIntensity = 2.0;
                    descendant.material.transparent = false;
                    descendant.material.opacity = 1.0;
                    descendant.visible = true;
                    console.log(`✅ Made descendant UNMISSABLE: ${descendant.type}`);
                  }
                  descendant.visible = true;
                });
                
                child.visible = true;
                console.log(`🚀 Remote player made UNMISSABLE: 10x scale, pink glow, lifted to y=5`);
                
                return { success: true };
              }
            });
            
            return { tested: true };
          } catch (error) {
            console.error('Error in final visibility test:', error);
            return null;
          }
        },
        createTestRemotePlayer: async () => {
          try {
            const THREE = await import('three');
            const sceneManager = container.resolve<import('./GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
            const scene = sceneManager.getScene();
            
            // Create a simple test mesh
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshStandardMaterial({ 
              color: 0xff0000,
              emissive: 0xff0000,
              emissiveIntensity: 0.5
            });
            const testMesh = new THREE.Mesh(geometry, material);
            
            testMesh.position.set(6, 5, 1.6);
            testMesh.name = 'TEST_REMOTE_PLAYER';
            scene.add(testMesh);
            
            return { created: true };
          } catch (error) {
            return { error: error.message };
          }
        },
        forceLogLevel: (category: string, level: string) => {
          Logger.info(LogCategory.CORE, `🔧 Force log test: ${category} ${level}`);
          Logger.debug(LogCategory.NETWORK, `🔧 Network debug test`);
          Logger.debug(LogCategory.PLAYER, `🔧 Player debug test`);
        }
      };
      Logger.info(LogCategory.CORE, '🎮 Debug commands available at window.gameDebug');
    }
  }

  private updateConnectionQualityDisplay(metrics: any): void {
    // TASK URGENTA.8: Reduce connection quality update frequency
    const now = performance.now();
    if (!this.lastQualityUpdate || now - this.lastQualityUpdate > 30000) { // Update every 30 seconds
      this.lastQualityUpdate = now;
      Logger.debug(LogCategory.NETWORK, '🎨 Updating connection quality display:', metrics);
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
        Logger.debug(LogCategory.NETWORK, 'Failed to fetch server metrics:', error);
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