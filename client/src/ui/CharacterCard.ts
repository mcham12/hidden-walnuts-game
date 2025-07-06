import { CharacterConfig } from '../types/CharacterTypes';

export interface CharacterCardOptions {
  isUnlocked: boolean;
  isSelected: boolean;
  previewElement: HTMLElement;
  statsHtml: string;
  animHtml: string;
  description: string;
  onClick: () => void;
  onHover: () => void;
  onUnhover: () => void;
  lockOverlayHtml?: string;
  loadingIndicatorHtml?: string;
}

export class CharacterCard {
  private element: HTMLElement;

  constructor(character: CharacterConfig, options: CharacterCardOptions) {
    this.element = document.createElement('div');
    this.element.className = `character-card ${options.isUnlocked ? 'unlocked' : 'locked'} ${options.isSelected ? 'selected' : ''}`;
    this.element.dataset.characterType = character.id;

    // Preview
    this.element.appendChild(options.previewElement);

    // Info
    const info = document.createElement('div');
    info.className = 'character-info';
    const name = document.createElement('h3');
    name.className = 'character-name';
    name.textContent = character.name;
    info.appendChild(name);
    const description = document.createElement('p');
    description.className = 'character-description';
    description.textContent = options.description;
    info.appendChild(description);
    // Stats
    info.innerHTML += options.statsHtml;
    // Animations
    info.innerHTML += options.animHtml;
    this.element.appendChild(info);

    // Lock overlay
    if (!options.isUnlocked && options.lockOverlayHtml) {
      const lockOverlay = document.createElement('div');
      lockOverlay.className = 'character-lock-overlay';
      lockOverlay.innerHTML = options.lockOverlayHtml;
      this.element.appendChild(lockOverlay);
    }
    // Loading indicator
    if (options.loadingIndicatorHtml) {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'character-loading';
      loadingIndicator.innerHTML = options.loadingIndicatorHtml;
      loadingIndicator.style.display = 'none';
      this.element.appendChild(loadingIndicator);
    }

    // Events
    this.element.addEventListener('click', options.onClick);
    this.element.addEventListener('mouseenter', options.onHover);
    this.element.addEventListener('mouseleave', options.onUnhover);
  }

  getElement(): HTMLElement {
    return this.element;
  }
} 