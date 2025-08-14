// Simple main.ts - no complex dependencies
import { Game } from './Game';

async function main() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  try {
    // Create simple game instance
    const game = new Game();
    
    // Initialize game
    await game.initialize(canvas);
    
    // Connect to multiplayer
    await game.connectMultiplayer();
    
    // Start the game
    game.start();
    
    console.log('🎮 Hidden Walnuts game started successfully!');
  } catch (error) {
    console.error('Failed to start game:', error);
    
    // Show error to user
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #ff4444; color: white; padding: 20px; border-radius: 10px;
      font-family: monospace; font-size: 14px; text-align: center; z-index: 9999;
    `;
    errorElement.innerHTML = `
      <h3>🚨 Game Failed to Start</h3>
      <p>Check the console for details</p>
      <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px;">
        Retry
      </button>
    `;
    document.body.appendChild(errorElement);
  }
}

main();