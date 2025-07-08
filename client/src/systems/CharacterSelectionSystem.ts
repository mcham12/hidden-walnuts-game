import { System } from '../ecs';
import { Logger, LogCategory } from '../core/Logger';
import { EventBus } from '../core/EventBus';
import { CharacterSelectionManager } from '../core/CharacterSelectionManager';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { CharacterGallery } from '../ui/CharacterGallery';
import { AnimatedModelLoader } from '../entities/AnimatedModelLoader';
import { 
  CharacterSelectionEvent,
  CharacterSelectionMetrics
} from '../types/CharacterSelectionTypes';

/**
 * CharacterSelectionSystem
 * ECS system for managing character selection state and UI
 */
export class CharacterSelectionSystem extends System {
  private characterRegistry: CharacterRegistry;
  private selectionManager: CharacterSelectionManager;
  private modelLoader: AnimatedModelLoader;
  private gallery?: CharacterGallery;
  
  // Metrics tracking
  private metrics: CharacterSelectionMetrics = {
    totalSelections: 0,
    characterPopularity: new Map(),
    averageSelectionTime: 0,
    previewLoadTimes: new Map(),
    uiResponseTime: 0,
    memoryUsage: 0,
    renderPerformance: {
      fps: 60,
      frameTime: 16.67,
      droppedFrames: 0
    }
  };
  
  private selectionStartTime: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;

  constructor(
    characterRegistry: CharacterRegistry,
    selectionManager: CharacterSelectionManager,
    modelLoader: AnimatedModelLoader,
    eventBus: EventBus
  ) {
    super(eventBus, [], 'character-selection-system');
    this.characterRegistry = characterRegistry;
    this.selectionManager = selectionManager;
    this.modelLoader = modelLoader;
    
    this.setupEventListeners();
    Logger.info(LogCategory.CORE, '[CharacterSelectionSystem] Initialized');
  }

  /**
   * Initialize the character gallery UI
   */
  initializeGallery(containerElement: HTMLElement): void {
    if (this.gallery) {
      Logger.warn(LogCategory.CORE, '[CharacterSelectionSystem] Gallery already initialized');
      return;
    }

    try {
      this.gallery = new CharacterGallery(
        {
          containerElement,
          showPreviews: true,
          previewSize: { width: 200, height: 200 },
          layoutMode: 'grid',
          charactersPerRow: 3,
          enableSearch: false,
          enableFilters: false,
          allowMultiSelect: false,
          theme: 'auto'
        },
        this.characterRegistry,
        this.selectionManager,
        this.modelLoader,
        this.eventBus
      );
      
      Logger.info(LogCategory.CORE, '[CharacterSelectionSystem] Gallery initialized');
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionSystem] Failed to initialize gallery', error);
    }
  }

  /**
   * Show the character selection gallery
   */
  showCharacterGallery(): void {
    if (!this.gallery) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionSystem] Gallery not initialized');
      return;
    }

    this.selectionStartTime = performance.now();
    this.gallery.showCharacterGallery();
    
    // Track gallery open event
    this.eventBus.emit('character:gallery_opened', {
      timestamp: Date.now()
    });
  }

  /**
   * Hide the character selection gallery
   */
  hideCharacterGallery(): void {
    if (!this.gallery) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionSystem] Gallery not initialized');
      return;
    }

    this.gallery.hideCharacterGallery();
    
    // Track gallery close event
    this.eventBus.emit('character:gallery_closed', {
      timestamp: Date.now()
    });
  }

  /**
   * Get the currently selected character
   */
  getSelectedCharacter(): string {
    return this.selectionManager.getSelectedCharacterOrDefault();
  }

  /**
   * Check if a character is unlocked
   */
  isCharacterUnlocked(characterType: string): boolean {
    return this.selectionManager.isCharacterUnlocked(characterType);
  }

  /**
   * Force unlock a character (for testing)
   */
  forceUnlockCharacter(characterType: string): void {
    this.selectionManager.forceUnlockCharacter(characterType);
    
    // Update gallery if visible
    if (this.gallery && this.gallery.isVisible()) {
      // Trigger gallery refresh
      this.eventBus.emit('character:unlocked', {
        characterType,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get character selection metrics
   */
  getMetrics(): CharacterSelectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalSelections: 0,
      characterPopularity: new Map(),
      averageSelectionTime: 0,
      previewLoadTimes: new Map(),
      uiResponseTime: 0,
      memoryUsage: 0,
      renderPerformance: {
        fps: 60,
        frameTime: 16.67,
        droppedFrames: 0
      }
    };
    
    Logger.info(LogCategory.CORE, '[CharacterSelectionSystem] Metrics reset');
  }

  /**
   * Update system (called by ECS)
   */
  update(deltaTime: number): void {
    // Update performance metrics
    this.updatePerformanceMetrics(deltaTime);
    
    // Update memory usage
    this.updateMemoryMetrics();
    
    // Check for auto-selection if no character is selected
    this.checkAutoSelection();
  }

  /**
   * Setup event listeners for character selection events
   */
  private setupEventListeners(): void {
    // Character selection events
    this.eventBus.subscribe('character:selection_changed', (event: CharacterSelectionEvent) => {
      this.handleCharacterSelection(event);
    });

    // Gallery events
    this.eventBus.subscribe('character:gallery_opened', () => {
      this.metrics.uiResponseTime = performance.now() - this.selectionStartTime;
    });

    this.eventBus.subscribe('character:gallery_closed', () => {
      // Track gallery usage
    });

    // Preview events
    this.eventBus.subscribe('character:preview_started', (event: any) => {
      const startTime = performance.now();
      this.metrics.previewLoadTimes.set(event.characterType, startTime);
    });

    this.eventBus.subscribe('character:preview_ended', (event: any) => {
      const startTime = this.metrics.previewLoadTimes.get(event.characterType);
      if (startTime) {
        const loadTime = performance.now() - startTime;
        this.metrics.previewLoadTimes.set(event.characterType, loadTime);
      }
    });

    // Error events
    this.eventBus.subscribe('character:error', (event: any) => {
      this.handleCharacterError(event);
    });
  }

  /**
   * Handle character selection events
   */
  private handleCharacterSelection(event: CharacterSelectionEvent): void {
    // Update metrics
    this.metrics.totalSelections++;
    
    // Track character popularity
    const currentCount = this.metrics.characterPopularity.get(event.selectedCharacter) || 0;
    this.metrics.characterPopularity.set(event.selectedCharacter, currentCount + 1);
    
    // Calculate selection time
    if (this.selectionStartTime > 0) {
      const selectionTime = performance.now() - this.selectionStartTime;
      this.metrics.averageSelectionTime = 
        (this.metrics.averageSelectionTime * (this.metrics.totalSelections - 1) + selectionTime) / 
        this.metrics.totalSelections;
    }
    
    Logger.info(LogCategory.CORE, `[CharacterSelectionSystem] Character selected: ${event.selectedCharacter}`);
    
    // Emit game-ready event
    this.eventBus.emit('game:character_ready', {
      characterType: event.selectedCharacter,
      characterConfig: event.characterConfig,
      timestamp: Date.now()
    });
    
    // Emit animation setup event
    this.eventBus.emit('character:animation_setup_required', {
      characterType: event.selectedCharacter,
      characterConfig: event.characterConfig,
      timestamp: Date.now()
    });
  }

  /**
   * Handle character selection errors
   */
  private handleCharacterError(event: any): void {
    Logger.error(LogCategory.CORE, `[CharacterSelectionSystem] Character error: ${event.error}`, event);
    
    // Track error metrics
    // In a real system, you'd want to track error rates and types
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(_deltaTime: number): void {
    const currentTime = performance.now();
    
    // Calculate FPS
    if (this.lastFrameTime > 0) {
      const frameTime = currentTime - this.lastFrameTime;
      this.metrics.renderPerformance.frameTime = frameTime;
      
      // Detect dropped frames (frame time > 33ms for 30fps threshold)
      if (frameTime > 33) {
        this.metrics.renderPerformance.droppedFrames++;
      }
      
      // Update FPS calculation (rolling average)
      const alpha = 0.1; // Smoothing factor
      const currentFPS = 1000 / frameTime;
      this.metrics.renderPerformance.fps = 
        this.metrics.renderPerformance.fps * (1 - alpha) + currentFPS * alpha;
    }
    
    this.lastFrameTime = currentTime;
    this.frameCount++;
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryMetrics(): void {
    // Estimate memory usage based on loaded models
    if (this.modelLoader) {
      const cacheStats = this.modelLoader.getCacheStats();
      this.metrics.memoryUsage = cacheStats.memoryUsed || 0;
    }
  }

  /**
   * Check if auto-selection is needed
   */
  private checkAutoSelection(): void {
    const selectedCharacter = this.selectionManager.getSelectedCharacter();
    
    // If no character is selected and we're in a game context, auto-select
    if (!selectedCharacter && this.isGameContext()) {
      const defaultCharacter = this.selectionManager.getSelectedCharacterOrDefault();
      Logger.info(LogCategory.CORE, `[CharacterSelectionSystem] Auto-selecting default character: ${defaultCharacter}`);
      
      // Auto-select without showing gallery
      this.selectionManager.setSelectedCharacter(defaultCharacter);
    }
  }

  /**
   * Check if we're in a game context (not in menu/selection)
   */
  private isGameContext(): boolean {
    // This would check game state in a real implementation
    // For now, assume we're in game context if gallery is not visible
    return !this.gallery || !this.gallery.isVisible();
  }

  /**
   * Get system statistics
   */
  getStats(): any {
    return {
      selectedCharacter: this.getSelectedCharacter(),
      unlockedCharacters: this.selectionManager.getUnlockedCharacters(),
      totalCharacters: this.characterRegistry.getAllCharacters().length,
      galleryVisible: this.gallery?.isVisible() || false,
      metrics: this.getMetrics()
    };
  }

  /**
   * Clean up system resources
   */
  dispose(): void {
    if (this.gallery) {
      this.gallery.dispose();
    }
    
    Logger.info(LogCategory.CORE, '[CharacterSelectionSystem] Disposed');
  }
} 