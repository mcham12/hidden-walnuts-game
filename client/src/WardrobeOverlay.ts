import { AccessoryRegistry, AccessoryDefinition } from './services/AccessoryRegistry';
import { TouchControls } from './TouchControls';

export class WardrobeOverlay {
    private container: HTMLElement;
    private onSelect: (accessoryId: string) => void;
    private onClose: () => void;
    private characterId: string = 'squirrel';
    private currentAccessoryId: string = 'none';

    constructor(onSelect: (accessoryId: string) => void, onClose: () => void) {
        this.onSelect = onSelect;
        this.onClose = onClose;

        this.container = document.createElement('div');
        this.container.id = 'wardrobe-overlay';

        // Styles
        const style = document.createElement('style');
        style.textContent = `
      #wardrobe-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: none; /* Hidden by default */
        justify-content: center;
        align-items: center;
        z-index: 20000;
        backdrop-filter: blur(5px);
        font-family: 'Arial', sans-serif;
      }

      .wardrobe-content {
        background: rgba(40, 40, 40, 0.95);
        border: 4px solid #8B4513; /* Wood theme */
        border-radius: 20px;
        padding: 30px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        color: white;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      }

      .wardrobe-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .wardrobe-title {
        font-size: 2rem;
        color: #FFD700;
        margin: 0;
        text-shadow: 2px 2px 0 #000;
      }

      .close-btn {
        background: transparent;
        border: 2px solid rgba(255, 255, 255, 0.5);
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        font-size: 1.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: white;
      }

      .accessory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 15px;
        overflow-y: auto;
        padding: 10px;
      }

      .accessory-card {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 15px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: all 0.2s;
        text-align: center;
      }

      .accessory-card:hover {
        background: rgba(255, 255, 255, 0.15);
        transform: translateY(-2px);
      }

      .accessory-card.active {
        border-color: #FFD700;
        background: rgba(255, 215, 0, 0.1);
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
      }

      .acc-icon {
        font-size: 3rem;
        margin-bottom: 10px;
      }

      .acc-name {
        font-size: 0.9rem;
        font-weight: bold;
      }

      .empty-state {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 40px;
        font-style: italic;
      }
    `;
        document.head.appendChild(style);

        this.renderStructure();
        document.body.appendChild(this.container);
    }

    private renderStructure(): void {
        this.container.innerHTML = `
      <div class="wardrobe-content">
        <div class="wardrobe-header">
          <h2 class="wardrobe-title">Wardrobe</h2>
          <button class="close-btn">×</button>
        </div>
        <div class="accessory-grid" id="wardrobe-grid">
          <!-- Items injected here -->
        </div>
      </div>
    `;

        this.container.querySelector('.close-btn')?.addEventListener('click', () => {
            this.hide();
            this.onClose();
        });

        // Close on click outside
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.hide();
                this.onClose();
            }
        });
    }

    public show(characterId: string, currentAccessoryId: string): void {
        this.characterId = characterId;
        this.currentAccessoryId = currentAccessoryId;
        this.renderItems();
        this.container.style.display = 'flex';
    }

    public hide(): void {
        this.container.style.display = 'none';
    }

    private renderItems(): void {
        const grid = this.container.querySelector('#wardrobe-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const items = AccessoryRegistry.getAvailableForCharacter(this.characterId);

        if (items.length === 0 || (items.length === 1 && items[0].id === 'none')) {
            grid.innerHTML = `<div class="empty-state">No accessories fit this character yet!</div>`;
            return;
        }

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = `accessory-card ${item.id === this.currentAccessoryId ? 'active' : ''}`;

            card.innerHTML = `
        <div class="acc-icon">${item.icon}</div>
        <div class="acc-name">${item.name}</div>
      `;

            card.onclick = () => {
                this.currentAccessoryId = item.id;
                this.onSelect(item.id);
                this.renderItems(); // Re-render to update active state
            };

            grid.appendChild(card);
        });
    }
}
