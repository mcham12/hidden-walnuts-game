import { Game } from './Game';

async function main() {
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  const game = new Game();
  await game.init(canvas);
  game.start();
}

main().catch(console.error);