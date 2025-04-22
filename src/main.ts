console.log('Starting game initialization...');

import { Scene } from './game/Scene';
import { Player } from './game/Player';
import { WalnutManager } from './game/WalnutManager';

class Game {
    private scene: Scene;
    private player: Player;
    private walnutManager: WalnutManager;

    constructor() {
        console.log('Creating game instance...');
        try {
            this.scene = new Scene();
            console.log('Scene created successfully');
            
            this.player = new Player(this.scene);
            console.log('Player created successfully');
            
            this.walnutManager = new WalnutManager(this.scene);
            console.log('WalnutManager created successfully');
            
            this.init();
            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Error during game initialization:', error);
        }
    }

    private init() {
        // Show hide walnut button after 30 second scouting phase
        setTimeout(() => {
            const hideButton = document.getElementById('hide-walnut');
            if (hideButton) {
                hideButton.style.display = 'block';
                console.log('Hide walnut button displayed');
            }
        }, 30000);

        // Handle hide walnut button click
        document.getElementById('hide-walnut')?.addEventListener('click', () => {
            console.log('Hide walnut button clicked');
            this.walnutManager.hideWalnut(this.player.getPosition());
        });

        // Update test message
        const testMessage = document.getElementById('test-message');
        if (testMessage) {
            testMessage.textContent = 'Game loaded! Use WASD to move.';
        }
    }

    public animate() {
        requestAnimationFrame(() => this.animate());
        this.scene.render();
        this.player.update();
    }
}

// Start the game
try {
    console.log('Creating game...');
    const game = new Game();
    console.log('Starting game animation loop...');
    game.animate();
} catch (error) {
    console.error('Fatal error starting game:', error);
} 