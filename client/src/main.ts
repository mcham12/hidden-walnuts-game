import './style.css'
import { GameManager } from './GameManager'
import { InputManager } from './InputManager'
import { updateSquirrelMovement } from './avatar'
import type { MultiplayerConfig } from './multiplayer'

// Environment setup
export const DEBUG = false;
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8787';

console.log('🔍 Environment Variables', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
console.log('🌐 Using API base URL:', API_BASE);

// Multiplayer configuration
const multiplayerConfig: MultiplayerConfig = {
  apiBaseUrl: API_BASE,
  reconnectAttempts: 5,
  reconnectDelay: 2000,
  heartbeatInterval: 30000,
  interpolationSpeed: 5.0,
  updateThreshold: 0.1,
  playerUpdateRate: 20
};

// A++ Architecture: Single entry point with proper initialization
async function initializeGame(): Promise<void> {
  try {
    console.log('[Build] Frontend build triggered');
    
    // Initialize systems
    const gameManager = new GameManager(multiplayerConfig);
    const inputManager = new InputManager();
    
    // Connect input to movement
    inputManager.onMovementChange((moveState) => {
      const avatar = gameManager.gameAvatar;
      if (avatar) {
        // Update movement directly - no more globals!
        const deltaTime = 1/60; // Assume 60fps for input response
        updateSquirrelMovement(deltaTime, moveState);
      }
    });
    
    // Initialize game with proper error handling
    await gameManager.initialize();
    
    console.log('🎮 Game initialized successfully');
    
  } catch (error) {
    console.error('❌ Game initialization failed:', error);
    showErrorScreen(error);
  }
}

function showErrorScreen(error: any): void {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: #ff4444; color: white; padding: 20px; border-radius: 8px;
    font-family: Arial, sans-serif; text-align: center; z-index: 1001;
    max-width: 500px;
  `;
  errorDiv.innerHTML = `
    <h3>🐿️ Hidden Walnuts - Initialization Error</h3>
    <p>${error.message || 'Unknown error occurred'}</p>
    <button onclick="location.reload()" style="
      background: white; color: #ff4444; border: none; padding: 10px 20px;
      border-radius: 4px; cursor: pointer; margin-top: 10px;
    ">Retry</button>
  `;
  document.body.appendChild(errorDiv);
}

// Start the game
initializeGame();

// Export terrain height function for backward compatibility
export async function getTerrainHeight(x: number, z: number): Promise<number> {
  const size = 200;
  const height = 5;
  
  // Simple terrain height calculation
  const xNorm = (x + size / 2) / size;
  const zNorm = (z + size / 2) / size;
  const noiseValue = Math.sin(xNorm * 10) * Math.cos(zNorm * 10);
  let terrainHeight = (noiseValue + 1) * (height / 2);
  
  if (terrainHeight < 0 || terrainHeight > 5) {
    terrainHeight = 2; // Safe fallback
  }
  
  return terrainHeight;
} 