import { Game } from './Game';

async function main() {
  const selectDiv = document.getElementById('character-select') as HTMLDivElement;
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const charSelect = document.getElementById('char-select') as HTMLSelectElement;
  const walnutHud = document.getElementById('walnut-hud') as HTMLDivElement;

  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  canvas.classList.add('hidden');

  startBtn.addEventListener('click', async () => {
    // Get selected character
    const selectedCharacterId = charSelect.value;
    console.log('🎮 Selected character:', selectedCharacterId);

    selectDiv.classList.add('hidden');
    canvas.classList.remove('hidden');

    // Show walnut HUD
    if (walnutHud) {
      walnutHud.classList.remove('hidden');
    }

    const game = new Game();
    game.selectedCharacterId = selectedCharacterId;
    await game.init(canvas);
    game.start();
  });
}

main().catch(console.error);