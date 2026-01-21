import { AccessoryRegistry } from './services/AccessoryRegistry';


export class WardrobeOverlay {
  private container: HTMLElement;
  private onSelect: (accessories: Record<string, string>) => void;
  private onClose: () => void;
  private characterId: string = 'squirrel';
  // active items per category
  private activeAccessories: Record<string, string> = {
    'hat': 'none',
    'glasses': 'none',
    'backpack': 'none',
    'mask': 'none'
  };
  // Track which categories are expanded to show all items
  private expandedCategories: Set<string> = new Set();

  constructor(onSelect: (accessories: Record<string, string>) => void, onClose: () => void) {
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
        max-width: 700px;
        max-height: 85vh;
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

      .wardrobe-body {
        overflow-y: auto;
        flex: 1;
        padding-right: 10px;
      }

      .category-section {
        margin-bottom: 30px;
      }

      .category-title {
        font-size: 1.2rem;
        color: #FFE4B5;
        margin-bottom: 15px;
        border-bottom: 1px solid rgba(139, 69, 19, 0.5);
        padding-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .accessory-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
        gap: 12px;
      }

      .accessory-card {
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px;
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

      .acc-name {
        font-size: 0.85rem;
        font-weight: bold;
      }

      .empty-state {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 20px;
        font-style: italic;
        font-size: 0.9rem;
      }

      .category-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .see-all-btn {
        background: transparent;
        border: 1px solid rgba(255, 215, 0, 0.5);
        color: #FFD700;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      .see-all-btn:hover {
        background: rgba(255, 215, 0, 0.1);
        border-color: #FFD700;
      }

      .acc-icon {
        font-size: 1.8rem;
        margin-bottom: 5px;
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
        <div class="wardrobe-body" id="wardrobe-body">
          <!-- Categories injected here -->
        </div>
      </div>
    `;

    this.container.querySelector('.close-btn')?.addEventListener('click', () => {
      this.hide();
      this.onClose();
    });

    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.hide();
        this.onClose();
      }
    });
  }

  // Accepts map of type -> id, e.g. { hat: 'propeller', glasses: 'none' }
  public show(characterId: string, currentAccessories: Record<string, string>): void {
    this.characterId = characterId;
    this.activeAccessories = { ...currentAccessories };
    // Ensure defaults
    ['hat', 'glasses', 'backpack'].forEach(t => {
      if (!this.activeAccessories[t]) this.activeAccessories[t] = 'none';
    });

    this.renderItems();
    this.container.style.display = 'flex';
  }

  public hide(): void {
    this.container.style.display = 'none';
  }

  private renderItems(): void {
    const body = this.container.querySelector('#wardrobe-body');
    if (!body) return;
    body.innerHTML = '';

    const categories: ('hat' | 'glasses' | 'backpack')[] = ['hat', 'glasses', 'backpack'];

    // Render each category
    categories.forEach(type => {
      const showAll = this.expandedCategories.has(type);
      let items: any[];
      let hasMore = false;

      if (showAll) {
        // Show all available items
        const allItems = AccessoryRegistry.getAvailableForCharacter(this.characterId);
        items = allItems.filter(a => a.type === type);
      } else {
        // Show daily picks
        const result = AccessoryRegistry.getDailyPicks(this.characterId, type);
        items = result.picks;
        hasMore = result.hasMore;
      }

      const section = document.createElement('div');
      section.className = 'category-section';

      const title = type.charAt(0).toUpperCase() + type.slice(1) + (type === 'glasses' ? '' : 's');
      const toggleText = showAll ? '← Show Less' : (hasMore ? 'See All →' : '');

      section.innerHTML = `
        <div class="category-header">
          <div class="category-title">${title}</div>
          ${toggleText ? `<button class="see-all-btn" data-category="${type}">${toggleText}</button>` : ''}
        </div>
        <div class="accessory-grid" id="grid-${type}">
          ${items.length === 0 ? '<div class="empty-state">No items available</div>' : ''}
        </div>
      `;

      body.appendChild(section);

      // Add See All button handler
      const seeAllBtn = section.querySelector('.see-all-btn');
      if (seeAllBtn) {
        seeAllBtn.addEventListener('click', () => {
          if (this.expandedCategories.has(type)) {
            this.expandedCategories.delete(type);
          } else {
            this.expandedCategories.add(type);
          }
          this.renderItems();
        });
      }

      const grid = section.querySelector(`#grid-${type}`);
      if (grid && items.length > 0) {
        items.forEach(item => {
          const card = document.createElement('div');
          const isActive = this.activeAccessories[type] === item.id || (item.id === 'none' && (!this.activeAccessories[type] || this.activeAccessories[type] === 'none'));

          card.className = `accessory-card ${isActive ? 'active' : ''}`;
          card.innerHTML = `
            <div class="acc-icon">${item.icon || ''}</div>
            <div class="acc-name">${item.name}</div>
          `;

          card.onclick = () => {
            this.selectItem(type, item.id);
          };
          grid.appendChild(card);
        });
      }
    });
  }

  private selectItem(type: string, id: string) {
    // Toggle logic: If clicking the active item, set to 'none' (unless it's already none)
    if (this.activeAccessories[type] === id && id !== 'none') {
      this.activeAccessories[type] = 'none';
    } else {
      this.activeAccessories[type] = id;
      // Record usage for "recently used" feature
      if (type === 'hat' || type === 'glasses' || type === 'backpack') {
        AccessoryRegistry.recordAccessoryUsage(id, type);
      }
    }
    this.onSelect(this.activeAccessories);
    this.renderItems();
  }
}
