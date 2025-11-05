/**
 * Character Card Component
 * MVP 16: Individual character card for selection grid
 *
 * Features:
 * - Card design: Emoji/3D preview, name, status icon (✅/🔒/💎)
 * - Visual states:
 *   - Available: Full color, ✅ checkmark, clickable, hover scale 1.05
 *   - Locked Free: 80% opacity, 🔒 icon, tooltip "Sign Up to Unlock"
 *   - Locked Premium: Full color, gold border, 💎 icon + "$1.99"
 * - Click handlers for selection and unlock prompts
 */

export interface CharacterCardData {
  id: string;
  name: string;
  emoji?: string;
  modelPath: string;
  tier: 'no-auth' | 'free' | 'premium' | 'future';
  price?: number;
  isAvailable: boolean;
  isSelected?: boolean;
}

export interface CharacterCardOptions {
  onClick?: (characterId: string) => void;
  onPreview?: (characterId: string) => void;
}

export class CharacterCard {
  private container: HTMLElement;
  private data: CharacterCardData;
  private options: CharacterCardOptions;
  private card: HTMLElement | null = null;

  constructor(container: HTMLElement, data: CharacterCardData, options: CharacterCardOptions = {}) {
    this.container = container;
    this.data = data;
    this.options = options;
    this.render();
  }

  /**
   * Render the character card
   */
  private render(): void {
    this.card = document.createElement('div');
    this.card.className = 'character-card';

    // Base styles
    const baseStyles = `
      position: relative;
      background: linear-gradient(135deg, #2d5f2e 0%, #4a8f4d 100%);
      border-radius: 12px;
      padding: 16px;
      cursor: ${this.data.isAvailable ? 'pointer' : 'not-allowed'};
      transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 3px solid ${this.getBorderColor()};
      opacity: ${this.getOpacity()};
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      min-height: 140px;
    `;

    this.card.style.cssText = baseStyles;

    // Selected state
    if (this.data.isSelected) {
      this.card.style.borderColor = '#FFD700';
      this.card.style.boxShadow = '0 8px 24px rgba(255, 215, 0, 0.6)';
    }

    // Character emoji/icon
    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 48px;
      margin-bottom: 4px;
    `;
    icon.textContent = this.getCharacterEmoji();

    // Character name
    const name = document.createElement('div');
    name.style.cssText = `
      font-size: 16px;
      font-weight: 700;
      color: white;
      text-align: center;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    `;
    name.textContent = this.data.name;

    // Status indicator
    const status = document.createElement('div');
    status.style.cssText = `
      font-size: 24px;
      margin-top: 4px;
    `;
    status.textContent = this.getStatusIcon();

    // Price label for premium characters
    if (this.data.tier === 'premium' && this.data.price) {
      const price = document.createElement('div');
      price.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        color: #2c5f2d;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      `;
      price.textContent = `$${this.data.price.toFixed(2)}`;
      this.card.appendChild(price);
    }

    // Assemble card
    this.card.appendChild(icon);
    this.card.appendChild(name);
    this.card.appendChild(status);

    // Add tooltip for locked characters
    if (!this.data.isAvailable) {
      this.card.title = this.getTooltipText();
    }

    // Event listeners
    this.setupEventListeners();

    // Append to container
    this.container.appendChild(this.card);
  }

  /**
   * Get character emoji based on ID
   */
  private getCharacterEmoji(): string {
    const emojiMap: Record<string, string> = {
      'squirrel': '🐿️',
      'hare': '🐇',
      'goat': '🐐',
      'chipmunk': '🐿️',
      'turkey': '🦃',
      'mallard': '🦆',
      'lynx': '🐱',
      'bear': '🐻',
      'moose': '🦌',
      'badger': '🦡',
      'skunk': '🦨'
    };
    return emojiMap[this.data.id] || '🦊';
  }

  /**
   * Get border color based on tier and availability
   */
  private getBorderColor(): string {
    if (this.data.isSelected) {
      return '#FFD700';
    }
    if (this.data.tier === 'premium') {
      return 'rgba(255, 215, 0, 0.8)';
    }
    if (this.data.isAvailable) {
      return 'rgba(255, 215, 0, 0.4)';
    }
    return 'rgba(255, 255, 255, 0.3)';
  }

  /**
   * Get opacity based on availability
   */
  private getOpacity(): string {
    if (this.data.tier === 'premium') {
      return '1'; // Premium always full opacity to show it's available for purchase
    }
    if (!this.data.isAvailable) {
      return '0.6'; // Locked free characters are dimmed
    }
    return '1';
  }

  /**
   * Get status icon (✅/🔒/💎)
   */
  private getStatusIcon(): string {
    if (this.data.isAvailable) {
      return '✅';
    }
    if (this.data.tier === 'premium') {
      return '💎';
    }
    return '🔒';
  }

  /**
   * Get tooltip text for locked characters
   */
  private getTooltipText(): string {
    if (this.data.tier === 'premium') {
      return 'Premium Character - Coming Soon!';
    }
    return 'Sign Up to Unlock';
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.card) return;

    // Click handler
    this.card.addEventListener('click', () => {
      if (this.data.isAvailable) {
        this.options.onClick?.(this.data.id);
      } else {
        // Show preview or unlock prompt
        this.options.onPreview?.(this.data.id);
      }
    });

    // Hover effects (only for available characters)
    if (this.data.isAvailable) {
      this.card.addEventListener('mouseenter', () => {
        if (this.card) {
          this.card.style.transform = 'scale(1.05)';
          this.card.style.boxShadow = '0 8px 24px rgba(255, 215, 0, 0.5)';
        }
      });

      this.card.addEventListener('mouseleave', () => {
        if (this.card) {
          this.card.style.transform = 'scale(1)';
          this.card.style.boxShadow = this.data.isSelected
            ? '0 8px 24px rgba(255, 215, 0, 0.6)'
            : '0 4px 12px rgba(0, 0, 0, 0.3)';
        }
      });
    }
  }

  /**
   * Update selected state
   */
  public setSelected(selected: boolean): void {
    this.data.isSelected = selected;
    if (this.card) {
      if (selected) {
        this.card.style.borderColor = '#FFD700';
        this.card.style.boxShadow = '0 8px 24px rgba(255, 215, 0, 0.6)';
      } else {
        this.card.style.borderColor = this.getBorderColor();
        this.card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
      }
    }
  }

  /**
   * Destroy the card
   */
  public destroy(): void {
    this.card?.remove();
  }
}
