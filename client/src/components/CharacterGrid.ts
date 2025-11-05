/**
 * Character Grid Component
 * MVP 16: Responsive character selection grid
 *
 * Platform-specific layouts:
 * - Desktop (1025px+): 4x3 grid (11 characters + 1 empty)
 * - iPad Portrait (768-1024px portrait): 3x4 grid
 * - iPad Landscape (768-1024px landscape): 4x3 grid
 * - iPhone Portrait (≤430px): 2x6 grid, vertical scroll
 * - iPhone Landscape (≤932px width, ≤500px height): Horizontal scroll, 2x6 grid
 *
 * Features:
 * - Visual grid of character cards
 * - Authentication status integration
 * - Bottom CTA banner
 * - Character preview on click
 */

import { CharacterCard, type CharacterCardData } from './CharacterCard';
import { getCurrentUser, isAuthenticated } from '../services/AuthService';
import { CharacterRegistry } from '../services/CharacterRegistry';
import { CharacterPreviewModal } from './CharacterPreviewModal';

export interface CharacterGridOptions {
  onCharacterSelect?: (characterId: string) => void;
  onSignUpClick?: () => void;
  onLoginClick?: () => void;
  selectedCharacterId?: string;
}

export class CharacterGrid {
  private container: HTMLElement;
  private options: CharacterGridOptions;
  private cards: Map<string, CharacterCard> = new Map();
  private gridContainer: HTMLElement | null = null;
  private ctaBanner: HTMLElement | null = null;

  constructor(container: HTMLElement, options: CharacterGridOptions = {}) {
    this.container = container;
    this.options = options;
    this.init();
  }

  /**
   * Initialize the character grid
   */
  private async init(): Promise<void> {
    // Load characters from registry
    await CharacterRegistry.loadCharacters();

    // Clear container
    this.container.innerHTML = '';

    // Add responsive styles
    this.addResponsiveStyles();

    // Create grid container
    this.createGridContainer();

    // Create CTA banner
    this.createCTABanner();

    // Render characters
    await this.renderCharacters();
  }

  /**
   * Add responsive styles for all platforms
   */
  private addResponsiveStyles(): void {
    if (document.getElementById('character-grid-styles')) {
      return; // Already added
    }

    const style = document.createElement('style');
    style.id = 'character-grid-styles';
    style.textContent = `
      .character-grid-container {
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
      }

      .character-grid {
        display: grid;
        gap: 16px;
        margin-bottom: 20px;
      }

      /* Desktop (1025px+): 4x3 grid */
      @media (min-width: 1025px) {
        .character-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* iPad Portrait (768-1024px portrait): 3x4 grid */
      @media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
        .character-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      /* iPad Landscape (768-1024px landscape): 4x3 grid */
      @media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) {
        .character-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      /* iPhone Portrait (≤430px): 2 columns, vertical scroll */
      @media (max-width: 430px) and (orientation: portrait) {
        .character-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .character-grid-container {
          padding: 16px;
        }
      }

      /* iPhone Landscape (≤932px width, ≤500px height): 2 rows, horizontal scroll */
      @media (max-width: 932px) and (max-height: 500px) and (orientation: landscape) {
        .character-grid {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          grid-template-columns: none;
          gap: 12px;
          padding-bottom: 10px;
        }
        .character-grid .character-card {
          min-width: 120px;
          flex-shrink: 0;
        }
        .character-grid::-webkit-scrollbar {
          height: 8px;
        }
        .character-grid::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .character-grid::-webkit-scrollbar-thumb {
          background: rgba(255, 215, 0, 0.5);
          border-radius: 4px;
        }
        .character-grid::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 215, 0, 0.7);
        }
      }

      /* Tablets between iPhone and iPad (431-767px) */
      @media (min-width: 431px) and (max-width: 767px) {
        .character-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      /* CTA Banner responsive */
      .character-cta-banner {
        background: rgba(255, 215, 0, 0.1);
        border: 2px solid rgba(255, 215, 0, 0.4);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
      }

      @media (min-width: 768px) {
        .character-cta-banner {
          flex-direction: row;
          justify-content: space-between;
        }
      }

      .character-cta-banner .cta-text {
        color: #FFD700;
        font-size: 16px;
        font-weight: 700;
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
      }

      @media (max-width: 767px) {
        .character-cta-banner .cta-text {
          font-size: 14px;
        }
      }

      .character-cta-banner .cta-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: center;
      }

      .character-cta-banner button {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        white-space: nowrap;
      }

      @media (max-width: 430px) {
        .character-cta-banner button {
          padding: 8px 16px;
          font-size: 13px;
        }
      }

      .character-cta-banner button:hover {
        transform: scale(1.05);
      }

      .character-cta-banner .btn-primary {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        color: #2c5f2d;
        box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
      }

      .character-cta-banner .btn-secondary {
        background: rgba(255, 255, 255, 0.2);
        color: #FFD700;
        border: 2px solid rgba(255, 215, 0, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create grid container
   */
  private createGridContainer(): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'character-grid-container';

    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'character-grid';

    wrapper.appendChild(this.gridContainer);
    this.container.appendChild(wrapper);
  }

  /**
   * Create CTA banner
   */
  private createCTABanner(): void {
    this.ctaBanner = document.createElement('div');
    this.ctaBanner.className = 'character-cta-banner';
    this.ctaBanner.style.display = 'none'; // Will be shown after characters load

    const ctaText = document.createElement('div');
    ctaText.className = 'cta-text';

    const buttons = document.createElement('div');
    buttons.className = 'cta-buttons';

    this.ctaBanner.appendChild(ctaText);
    this.ctaBanner.appendChild(buttons);

    this.container.querySelector('.character-grid-container')?.appendChild(this.ctaBanner);
  }

  /**
   * Render all characters
   */
  private async renderCharacters(): Promise<void> {
    if (!this.gridContainer) return;

    // Get user authentication status
    const user = getCurrentUser();
    const userIsAuthenticated = isAuthenticated();
    const unlockedCharacters = user?.unlockedCharacters || [];

    // Get all characters
    const allCharacters = CharacterRegistry.getAllCharacters();
    const availableCharacters = CharacterRegistry.getAvailableCharacters(
      userIsAuthenticated,
      unlockedCharacters
    );

    // Create character card data
    const characterCards: CharacterCardData[] = allCharacters.map(char => ({
      id: char.id,
      name: char.name,
      modelPath: char.modelPath,
      tier: char.tier,
      price: char.price,
      isAvailable: availableCharacters.some(c => c.id === char.id),
      isSelected: char.id === this.options.selectedCharacterId
    }));

    // Filter out 'future' tier characters (not shown yet)
    const visibleCharacters = characterCards.filter(c => c.tier !== 'future');

    // Render character cards
    visibleCharacters.forEach(cardData => {
      const card = new CharacterCard(this.gridContainer!, cardData, {
        onClick: (id) => this.handleCharacterSelect(id),
        onPreview: (id) => this.handleCharacterPreview(id)
      });
      this.cards.set(cardData.id, card);
    });

    // Update CTA banner
    this.updateCTABanner(userIsAuthenticated);
  }

  /**
   * Update CTA banner based on authentication status
   */
  private updateCTABanner(isAuthenticated: boolean): void {
    if (!this.ctaBanner) return;

    const textElement = this.ctaBanner.querySelector('.cta-text') as HTMLElement;
    const buttonsElement = this.ctaBanner.querySelector('.cta-buttons') as HTMLElement;

    if (!textElement || !buttonsElement) return;

    // Clear buttons
    buttonsElement.innerHTML = '';

    if (!isAuthenticated) {
      // No-auth CTA
      textElement.textContent = '🔐 Sign Up Free to Unlock 6 Characters!';

      const signupBtn = document.createElement('button');
      signupBtn.className = 'btn-primary';
      signupBtn.textContent = 'Sign Up';
      signupBtn.addEventListener('click', () => this.options.onSignUpClick?.());

      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn-secondary';
      loginBtn.textContent = 'Log In';
      loginBtn.addEventListener('click', () => this.options.onLoginClick?.());

      buttonsElement.appendChild(signupBtn);
      buttonsElement.appendChild(loginBtn);
    } else {
      // Authenticated CTA
      textElement.textContent = 'Premium characters coming in MVP 17! Stay tuned 🐻';
    }

    this.ctaBanner.style.display = 'flex';
  }

  /**
   * Handle character selection
   */
  private handleCharacterSelect(characterId: string): void {
    // Update selected state for all cards
    this.cards.forEach((card, id) => {
      card.setSelected(id === characterId);
    });

    // Persist selection
    this.persistLastCharacter(characterId);

    // Call callback
    this.options.onCharacterSelect?.(characterId);
  }

  /**
   * Handle character preview (for locked characters)
   */
  private handleCharacterPreview(characterId: string): void {
    const character = CharacterRegistry.getCharacterById(characterId);
    if (!character) return;

    // Get user authentication status
    const user = getCurrentUser();
    const userIsAuthenticated = isAuthenticated();
    const unlockedCharacters = user?.unlockedCharacters || [];
    const availableCharacters = CharacterRegistry.getAvailableCharacters(
      userIsAuthenticated,
      unlockedCharacters
    );

    const isAvailable = availableCharacters.some(c => c.id === characterId);

    // Show character preview modal
    new CharacterPreviewModal({
      characterId,
      isAvailable,
      onSelect: (id) => this.handleCharacterSelect(id),
      onSignUp: () => this.options.onSignUpClick?.()
    });
  }

  /**
   * Persist last selected character
   */
  private persistLastCharacter(characterId: string): void {
    try {
      localStorage.setItem('last_character_id', characterId);
    } catch (error) {
      console.error('Error persisting character selection:', error);
    }
  }

  /**
   * Get last selected character
   */
  public static getLastSelectedCharacter(): string | null {
    try {
      return localStorage.getItem('last_character_id');
    } catch (error) {
      console.error('Error getting last character:', error);
      return null;
    }
  }

  /**
   * Destroy the grid
   */
  public destroy(): void {
    this.cards.forEach(card => card.destroy());
    this.cards.clear();
    this.container.innerHTML = '';
  }
}
