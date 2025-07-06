import { Logger, LogCategory } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { CharacterSelectionManager } from '../core/CharacterSelectionManager';
import { AnimatedModelLoader } from '../entities/AnimatedModelLoader';
import { CharacterPreview } from './CharacterPreview';
import { 
  ICharacterSelectionUI,
  CharacterGalleryOptions,
  CharacterCardData,
  CharacterSelectionEvent,
  CharacterSelectionTheme
} from '../types/CharacterSelectionTypes';
import { CharacterConfig } from '../types/CharacterTypes';
import { CharacterCard } from './CharacterCard';

/**
 * CharacterGallery
 * Main UI component for character selection with 3D previews
 */
export class CharacterGallery implements ICharacterSelectionUI {
  private container: HTMLElement;
  private options: CharacterGalleryOptions;
  private galleryElement!: HTMLElement;
  private overlayElement!: HTMLElement;
  private cardElements: Map<string, HTMLElement> = new Map();
  private characterPreviews: Map<string, CharacterPreview> = new Map();
  private cardData: Map<string, CharacterCardData> = new Map();
  
  private characterRegistry: CharacterRegistry;
  private selectionManager: CharacterSelectionManager;
  private modelLoader: AnimatedModelLoader;
  private eventBus: EventBus;
  
  private galleryVisible: boolean = false;
  private selectedCharacter: string | null = null;
  
  private theme: CharacterSelectionTheme;
  private resizeObserver?: ResizeObserver;

  constructor(
    options: CharacterGalleryOptions,
    characterRegistry: CharacterRegistry,
    selectionManager: CharacterSelectionManager,
    modelLoader: AnimatedModelLoader,
    eventBus: EventBus
  ) {
    this.options = options;
    this.characterRegistry = characterRegistry;
    this.selectionManager = selectionManager;
    this.modelLoader = modelLoader;
    this.eventBus = eventBus;
    
    this.container = options.containerElement;
    this.theme = this.getDefaultTheme();
    
    this.initializeUI();
    this.loadCharacterData();
    this.setupEventListeners();
    this.setupResizeObserver();
    
    Logger.info(LogCategory.CORE, '[CharacterGallery] Initialized');
  }

  /**
   * Show the character gallery
   */
  showCharacterGallery(): void {
    if (this.galleryVisible) return;

    this.galleryVisible = true;
    this.overlayElement.style.display = 'flex';
    this.galleryElement.style.display = 'block';
    
    // Animate in
    setTimeout(() => {
      this.overlayElement.classList.add('active');
      this.galleryElement.classList.add('active');
    }, 10);
    
    // Load previews for visible characters
    this.loadVisiblePreviews();
    
    this.eventBus.emit('character:gallery_opened', {
      timestamp: Date.now()
    });
    
    Logger.info(LogCategory.CORE, '[CharacterGallery] Gallery shown');
  }

  /**
   * Hide the character gallery
   */
  hideCharacterGallery(): void {
    if (!this.galleryVisible) return;

    this.overlayElement.classList.remove('active');
    this.galleryElement.classList.remove('active');
    
    // Hide after animation
    setTimeout(() => {
      this.overlayElement.style.display = 'none';
      this.galleryElement.style.display = 'none';
      this.galleryVisible = false;
    }, 300);
    
    // Dispose previews to free memory
    this.disposeAllPreviews();
    
    this.eventBus.emit('character:gallery_closed', {
      timestamp: Date.now()
    });
    
    Logger.info(LogCategory.CORE, '[CharacterGallery] Gallery hidden');
  }

  /**
   * Select a character
   */
  async selectCharacter(characterType: string): Promise<boolean> {
    try {
      this.selectionManager.setSelectedCharacter(characterType);
      this.selectedCharacter = characterType;
      this.updateSelectedVisuals();
      
      // Auto-hide gallery after selection
      setTimeout(() => {
        this.hideCharacterGallery();
      }, 1000);
      
      return true;
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterGallery] Failed to select character', error);
      this.showErrorMessage(`Failed to select ${characterType}`);
      return false;
    }
  }

  /**
   * Preview a character (load its 3D model)
   */
  async previewCharacter(characterType: string): Promise<void> {
    if (this.characterPreviews.has(characterType)) {
      return; // Already loaded
    }

    try {
      const cardData = this.cardData.get(characterType);
      if (!cardData || !cardData.previewElement) {
        Logger.warn(LogCategory.CORE, `[CharacterGallery] No preview element for ${characterType}`);
        return;
      }

      // Set loading state
      cardData.isLoading = true;
      this.updateCardLoadingState(characterType);

      // Create preview
      const preview = new CharacterPreview(
        cardData.previewElement,
        characterType,
        {
          width: this.options.previewSize.width,
          height: this.options.previewSize.height,
          enableAnimations: true,
          enableRotation: true,
          backgroundType: 'transparent',
          enableInteraction: true,
          animationCycle: ['idle_a', 'idle_b', 'walk'],
          animationDuration: 4000
        },
        this.modelLoader
      );

      // Load the character
      await preview.loadCharacter();

      // Store preview
      this.characterPreviews.set(characterType, preview);
      
      // Update loading state
      cardData.isLoading = false;
      this.updateCardLoadingState(characterType);
      
      Logger.info(LogCategory.CORE, `[CharacterGallery] Preview loaded for ${characterType}`);
      
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterGallery] Failed to preview character ${characterType}`, error);
      
      const cardData = this.cardData.get(characterType);
      if (cardData) {
        cardData.isLoading = false;
        this.updateCardLoadingState(characterType);
      }
    }
  }

  /**
   * Get the currently selected character
   */
  getSelectedCharacter(): string {
    return this.selectedCharacter || this.selectionManager.getSelectedCharacterOrDefault();
  }

  /**
   * Check if a character is unlocked
   */
  isCharacterUnlocked(characterType: string): boolean {
    return this.selectionManager.isCharacterUnlocked(characterType);
  }

  /**
   * Check if the gallery is visible
   */
  isVisible(): boolean {
    return this.galleryVisible;
  }

  /**
   * Initialize the UI structure
   */
  private initializeUI(): void {
    // Create overlay
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'character-gallery-overlay';
    this.overlayElement.style.display = 'none';
    
    // Create gallery container
    this.galleryElement = document.createElement('div');
    this.galleryElement.className = 'character-gallery';
    
    // Create header
    const header = this.createHeader();
    this.galleryElement.appendChild(header);
    
    // Create character grid
    const grid = this.createCharacterGrid();
    this.galleryElement.appendChild(grid);
    
    // Create footer
    const footer = this.createFooter();
    this.galleryElement.appendChild(footer);
    
    // Add to overlay
    this.overlayElement.appendChild(this.galleryElement);
    
    // Add to container
    this.container.appendChild(this.overlayElement);
    
    // Add CSS styles
    this.addStyles();
  }

  /**
   * Create the header section
   */
  private createHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'gallery-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Choose Your Character';
    title.className = 'gallery-title';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'gallery-close';
    closeButton.innerHTML = '×';
    closeButton.addEventListener('click', () => this.hideCharacterGallery());
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    return header;
  }

  /**
   * Create the character grid
   */
  private createCharacterGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'character-grid';
    
    const availableCharacters = this.characterRegistry.getAllCharacters();
    
    for (const character of availableCharacters) {
      const card = this.createCharacterCard(character);
      grid.appendChild(card);
    }
    
    return grid;
  }

  /**
   * Create the footer section
   */
  private createFooter(): HTMLElement {
    const footer = document.createElement('div');
    footer.className = 'gallery-footer';
    
    const info = document.createElement('div');
    info.className = 'gallery-info';
    info.innerHTML = `
      <p>Click on a character to select it. Use mouse to rotate the 3D preview.</p>
      <p>Some characters may need to be unlocked through gameplay.</p>
    `;
    
    footer.appendChild(info);
    
    return footer;
  }

  /**
   * Create a character card
   */
  private createCharacterCard(character: CharacterConfig): HTMLElement {
    const isUnlocked = this.isCharacterUnlocked(character.id);
    const isSelected = this.getSelectedCharacter() === character.id;
    
    // Preview container
    const previewContainer = document.createElement('div');
    previewContainer.className = 'character-preview';

    // Description
    const description = this.getCharacterDescription(character);
    // Stats
    const statsHtml = `
      <div class="character-stats">
        <div><strong>Speed:</strong> ${character.behaviors.movementSpeed.toFixed(2)}</div>
        <div><strong>Jump:</strong> ${character.behaviors.jumpHeight.toFixed(2)}</div>
        <div><strong>Swim:</strong> ${character.behaviors.canSwim ? 'Yes' : 'No'}</div>
        <div><strong>Fly:</strong> ${character.behaviors.canFly ? 'Yes' : 'No'}</div>
      </div>
    `;
    // Animations
    const animKeys = Object.keys(character.animations).filter(k => typeof character.animations[k as keyof typeof character.animations] === 'string');
    const animHtml = `<div class="character-animations"><strong>Animations:</strong> <span>${animKeys.join(', ')}</span></div>`;
    // Lock overlay
    let lockOverlayHtml: string | undefined = undefined;
    if (!isUnlocked) {
      lockOverlayHtml = `
        <div class="lock-icon">🔒</div>
        <div class="lock-message">${this.getUnlockMessage(character.id)}</div>
      `;
    }
    // Loading indicator
    const loadingIndicatorHtml = '<div class="loading-spinner"></div>';

    // Event handlers
    const onClick = () => {
      if (isUnlocked) {
        this.selectCharacter(character.id);
      } else {
        this.showUnlockInfo(character.id);
      }
    };
    const onHover = () => {
      previewContainer.classList.add('hovered');
      if (isUnlocked && this.options.showPreviews) {
        this.previewCharacter(character.id);
      }
      this.eventBus.emit('character:hovered', {
        characterType: character.id,
        timestamp: Date.now()
      });
    };
    const onUnhover = () => {
      previewContainer.classList.remove('hovered');
      this.eventBus.emit('character:unhovered', {
        characterType: character.id,
        timestamp: Date.now()
      });
    };

    // Create card
    const card = new CharacterCard(character, {
      isUnlocked,
      isSelected,
      previewElement: previewContainer,
      statsHtml,
      animHtml,
      description,
      onClick,
      onHover,
      onUnhover,
      lockOverlayHtml,
      loadingIndicatorHtml
    });

    // Store references
    this.cardElements.set(character.id, card.getElement());
    this.cardData.set(character.id, {
      config: character,
      isSelected,
      isUnlocked,
      isLoading: false,
      previewElement: previewContainer,
      cardElement: card.getElement()
    });

    return card.getElement();
  }

  /**
   * Load character data and set up initial state
   */
  private loadCharacterData(): void {
    this.selectedCharacter = this.selectionManager.getSelectedCharacterOrDefault();
    this.updateSelectedVisuals();
  }

  /**
   * Update visual indicators for selected character
   */
  private updateSelectedVisuals(): void {
    // Remove previous selection
    this.cardElements.forEach(card => {
      card.classList.remove('selected');
    });
    
    // Add selection to current character
    if (this.selectedCharacter) {
      const card = this.cardElements.get(this.selectedCharacter);
      if (card) {
        card.classList.add('selected');
      }
    }
  }

  /**
   * Load previews for visible characters
   */
  private loadVisiblePreviews(): void {
    if (!this.options.showPreviews) return;
    
    // Load previews for unlocked characters
    this.characterRegistry.getAllCharacters().forEach(character => {
      if (this.isCharacterUnlocked(character.id)) {
        // Delay loading to avoid overwhelming the GPU
        setTimeout(() => {
          this.previewCharacter(character.id);
        }, Math.random() * 2000);
      }
    });
  }

  /**
   * Update card loading state
   */
  private updateCardLoadingState(characterType: string): void {
    const card = this.cardElements.get(characterType);
    const cardData = this.cardData.get(characterType);
    
    if (card && cardData) {
      const loadingIndicator = card.querySelector('.character-loading') as HTMLElement;
      if (loadingIndicator) {
        loadingIndicator.style.display = cardData.isLoading ? 'flex' : 'none';
      }
    }
  }

  /**
   * Get character description for display
   */
  private getCharacterDescription(character: CharacterConfig): string {
    const behaviors = character.behaviors.aiBehaviors.slice(0, 2).join(', ');
    const habitat = this.getCharacterHabitat(character);
    return `${habitat} • ${behaviors}`;
  }

  /**
   * Get character habitat based on behavior
   */
  private getCharacterHabitat(character: CharacterConfig): string {
    const behaviors = character.behaviors.aiBehaviors;
    
    if (behaviors.includes('swimming') || behaviors.includes('aquatic')) {
      return 'Aquatic';
    } else if (behaviors.includes('flying') || behaviors.includes('aerial')) {
      return 'Aerial';
    } else if (behaviors.includes('climbing') || behaviors.includes('arboreal')) {
      return 'Arboreal';
    } else {
      return 'Terrestrial';
    }
  }

  /**
   * Get unlock message for a character
   */
  private getUnlockMessage(characterType: string): string {
    const criteria = this.selectionManager.getUnlockCriteria(characterType);
    return criteria?.unlockMessage || 'Unlock through gameplay';
  }

  /**
   * Show unlock info for locked characters
   */
  private showUnlockInfo(characterType: string): void {
    const unlockMessage = this.getUnlockMessage(characterType);
    this.showInfoMessage(`Character Locked`, unlockMessage);
  }

  /**
   * Show error message
   */
  private showErrorMessage(message: string): void {
    // Simple error display - in a real app, this would be more sophisticated
    alert(`Error: ${message}`);
  }

  /**
   * Show info message
   */
  private showInfoMessage(title: string, message: string): void {
    // Simple info display - in a real app, this would be more sophisticated
    alert(`${title}: ${message}`);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for selection changes
    this.eventBus.subscribe('character:selection_changed', (event: CharacterSelectionEvent) => {
      this.selectedCharacter = event.selectedCharacter;
      this.updateSelectedVisuals();
    });
    
    // Listen for character unlocks
    this.eventBus.subscribe('character:unlocked', (event: any) => {
      const characterType = event.characterType;
      const cardData = this.cardData.get(characterType);
      const card = this.cardElements.get(characterType);
      
      if (cardData && card) {
        cardData.isUnlocked = true;
        card.classList.remove('locked');
        card.classList.add('unlocked');
        
        // Remove lock overlay
        const lockOverlay = card.querySelector('.character-lock-overlay');
        if (lockOverlay) {
          lockOverlay.remove();
        }
      }
    });
    
    // Close gallery on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isVisible()) {
        this.hideCharacterGallery();
      }
    });
    
    // Close gallery on overlay click
    this.overlayElement.addEventListener('click', (event) => {
      if (event.target === this.overlayElement) {
        this.hideCharacterGallery();
      }
    });
  }

  /**
   * Setup resize observer for responsive layout
   */
  private setupResizeObserver(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Handle container resize
   */
  private handleResize(): void {
    // Update preview sizes if needed
    this.characterPreviews.forEach(preview => {
      preview.resize(this.options.previewSize.width, this.options.previewSize.height);
    });
  }

  /**
   * Dispose all previews
   */
  private disposeAllPreviews(): void {
    this.characterPreviews.forEach(preview => {
      preview.dispose();
    });
    this.characterPreviews.clear();
  }

  /**
   * Get default theme
   */
  private getDefaultTheme(): CharacterSelectionTheme {
    return {
      name: 'default',
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b',
        accent: '#10b981',
        background: '#f8fafc',
        surface: '#ffffff',
        text: '#1e293b',
        textSecondary: '#64748b',
        border: '#e2e8f0',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444'
      },
      fonts: {
        primary: 'system-ui, -apple-system, sans-serif',
        secondary: 'system-ui, -apple-system, sans-serif',
        code: 'ui-monospace, monospace'
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        lg: '1rem'
      },
      shadows: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        preview: '0 8px 25px -5px rgba(0, 0, 0, 0.1)',
        gallery: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }
    };
  }

  /**
   * Add CSS styles to the page
   */
  private addStyles(): void {
    const styleId = 'character-gallery-styles';
    
    // Don't add styles if already present
    if (document.getElementById(styleId)) {
      return;
    }
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .character-gallery-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .character-gallery-overlay.active {
        opacity: 1;
      }
      
      .character-gallery {
        background: ${this.theme.colors.surface};
        border-radius: ${this.theme.borderRadius.lg};
        box-shadow: ${this.theme.shadows.gallery};
        max-width: 90vw;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: scale(0.8);
        transition: transform 0.3s ease;
      }
      
      .character-gallery.active {
        transform: scale(1);
      }
      
      .gallery-header {
        padding: ${this.theme.spacing.lg};
        border-bottom: 1px solid ${this.theme.colors.border};
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .gallery-title {
        margin: 0;
        font-size: 1.5rem;
        color: ${this.theme.colors.text};
        font-family: ${this.theme.fonts.primary};
      }
      
      .gallery-close {
        background: none;
        border: none;
        font-size: 2rem;
        color: ${this.theme.colors.textSecondary};
        cursor: pointer;
        padding: 0;
        width: 2rem;
        height: 2rem;
        border-radius: ${this.theme.borderRadius.sm};
        transition: all 0.2s ease;
      }
      
      .gallery-close:hover {
        background: ${this.theme.colors.border};
        color: ${this.theme.colors.text};
      }
      
      .character-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: ${this.theme.spacing.lg};
        padding: ${this.theme.spacing.lg};
        overflow-y: auto;
        max-height: 60vh;
      }
      
      .character-card {
        background: ${this.theme.colors.surface};
        border: 2px solid ${this.theme.colors.border};
        border-radius: ${this.theme.borderRadius.md};
        padding: ${this.theme.spacing.md};
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
      }
      
      .character-card:hover {
        transform: translateY(-2px);
        box-shadow: ${this.theme.shadows.card};
      }
      
      .character-card.selected {
        border-color: ${this.theme.colors.primary};
        background: linear-gradient(135deg, ${this.theme.colors.primary}10 0%, ${this.theme.colors.primary}20 100%);
      }
      
      .character-card.locked {
        opacity: 0.6;
        cursor: not-allowed;
      }
      
      .character-preview {
        width: 100%;
        height: 200px;
        background: ${this.theme.colors.background};
        border-radius: ${this.theme.borderRadius.sm};
        overflow: hidden;
        position: relative;
        margin-bottom: ${this.theme.spacing.md};
      }
      
      .character-info {
        text-align: center;
      }
      
      .character-name {
        margin: 0 0 ${this.theme.spacing.sm} 0;
        font-size: 1.2rem;
        color: ${this.theme.colors.text};
        font-family: ${this.theme.fonts.primary};
      }
      
      .character-description {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        color: ${this.theme.colors.textSecondary};
        line-height: 1.4;
      }
      
      .character-stats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem 1.5rem;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        color: ${this.theme.colors.text};
      }
      .character-stats div {
        min-width: 70px;
      }
      .character-animations {
        font-size: 0.8rem;
        color: ${this.theme.colors.textSecondary};
        margin-bottom: 0.5rem;
      }
      .character-animations strong {
        color: ${this.theme.colors.text};
      }
      
      .character-lock-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        z-index: 1;
      }
      
      .lock-icon {
        font-size: 2rem;
        margin-bottom: ${this.theme.spacing.sm};
      }
      
      .lock-message {
        text-align: center;
        font-size: 0.9rem;
        padding: 0 ${this.theme.spacing.md};
      }
      
      .character-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 2;
      }
      
      .loading-spinner {
        width: 2rem;
        height: 2rem;
        border: 3px solid ${this.theme.colors.border};
        border-top: 3px solid ${this.theme.colors.primary};
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .gallery-footer {
        padding: ${this.theme.spacing.lg};
        border-top: 1px solid ${this.theme.colors.border};
        background: ${this.theme.colors.background};
      }
      
      .gallery-info {
        text-align: center;
        color: ${this.theme.colors.textSecondary};
        font-size: 0.9rem;
      }
      
      .gallery-info p {
        margin: 0.5rem 0;
      }
      
      @media (max-width: 768px) {
        .character-grid {
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: ${this.theme.spacing.md};
        }
        
        .character-preview {
          height: 150px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disposeAllPreviews();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    // Remove from DOM
    if (this.container.contains(this.overlayElement)) {
      this.container.removeChild(this.overlayElement);
    }
    
    // Remove styles
    const styleElement = document.getElementById('character-gallery-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    Logger.info(LogCategory.CORE, '[CharacterGallery] Disposed');
  }
} 