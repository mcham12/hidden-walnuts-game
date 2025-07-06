import { Logger, LogCategory } from './Logger';
import { CharacterRegistry } from './CharacterRegistry';
import { EventBus } from './EventBus';
import { 
  ICharacterSelectionStorage, 
  CharacterSelectionEvent, 
  CharacterSelectionValidation,
  CharacterUnlockCriteria
} from '../types/CharacterSelectionTypes';
import { CharacterConfig } from '../types/CharacterTypes';

/**
 * CharacterSelectionManager
 * Manages character selection persistence, validation, and unlock state
 */
export class CharacterSelectionManager implements ICharacterSelectionStorage {
  private storageKey = 'hiddenWalnuts_selectedCharacter';
  private historyKey = 'hiddenWalnuts_characterHistory';
  private unlockedKey = 'hiddenWalnuts_unlockedCharacters';
  private defaultCharacter = 'colobus'; // Default to Colobus instead of squirrel
  private maxHistorySize = 10;
  
  private characterRegistry: CharacterRegistry;
  private eventBus: EventBus;
  private unlockCriteria: Map<string, CharacterUnlockCriteria> = new Map();

  constructor(characterRegistry: CharacterRegistry, eventBus: EventBus) {
    this.characterRegistry = characterRegistry;
    this.eventBus = eventBus;
    
    this.initializeUnlockCriteria();
    Logger.info(LogCategory.CORE, '[CharacterSelectionManager] Initialized');
  }

  /**
   * Get the currently selected character
   */
  getSelectedCharacter(): string | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored && this.validateCharacterType(stored)) {
        return stored;
      }
      return null;
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error getting selected character', error);
      return null;
    }
  }

  /**
   * Set the selected character with validation
   */
  setSelectedCharacter(characterType: string): void {
    const validation = this.validateCharacterSelection(characterType);
    
    if (!validation.isValid) {
      const errorMsg = `Cannot select character ${characterType}: ${validation.errors.join(', ')}`;
      Logger.error(LogCategory.CORE, `[CharacterSelectionManager] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const previousCharacter = this.getSelectedCharacter();
    
    try {
      localStorage.setItem(this.storageKey, characterType);
      this.addCharacterToHistory(characterType);
      
      // Fire selection event
      const selectionEvent: CharacterSelectionEvent = {
        previousCharacter,
        selectedCharacter: characterType,
        characterConfig: this.characterRegistry.getCharacter(characterType)!,
        timestamp: Date.now(),
        source: 'user'
      };
      
      this.eventBus.emit('character:selection_changed', selectionEvent);
      
      Logger.info(LogCategory.CORE, `[CharacterSelectionManager] Character selected: ${characterType}`);
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error setting selected character', error);
      throw new Error('Failed to save character selection');
    }
  }

  /**
   * Check if a character has been selected
   */
  hasSelectedCharacter(): boolean {
    return this.getSelectedCharacter() !== null;
  }

  /**
   * Get or set default character if none selected
   */
  getSelectedCharacterOrDefault(): string {
    const selected = this.getSelectedCharacter();
    if (selected) {
      return selected;
    }

    // Set default character if none selected
    if (this.isCharacterUnlocked(this.defaultCharacter)) {
      this.setSelectedCharacterSilently(this.defaultCharacter);
      return this.defaultCharacter;
    }

    // Find first unlocked character as fallback
    const unlockedCharacters = this.getUnlockedCharacters();
    if (unlockedCharacters.length > 0) {
      const fallback = unlockedCharacters[0];
      this.setSelectedCharacterSilently(fallback);
      return fallback;
    }

    // Emergency fallback - unlock and select default
    this.setCharacterUnlocked(this.defaultCharacter, true);
    this.setSelectedCharacterSilently(this.defaultCharacter);
    return this.defaultCharacter;
  }

  /**
   * Get character selection history
   */
  getCharacterHistory(): string[] {
    try {
      const stored = localStorage.getItem(this.historyKey);
      if (stored) {
        const history = JSON.parse(stored);
        return Array.isArray(history) ? history : [];
      }
      return [];
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error getting character history', error);
      return [];
    }
  }

  /**
   * Add character to selection history
   */
  addCharacterToHistory(characterType: string): void {
    if (!this.validateCharacterType(characterType)) {
      return;
    }

    try {
      let history = this.getCharacterHistory();
      
      // Remove existing entry if present
      history = history.filter(char => char !== characterType);
      
      // Add to front
      history.unshift(characterType);
      
      // Limit history size
      if (history.length > this.maxHistorySize) {
        history = history.slice(0, this.maxHistorySize);
      }
      
      localStorage.setItem(this.historyKey, JSON.stringify(history));
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error adding to character history', error);
    }
  }

  /**
   * Get unlocked characters
   */
  getUnlockedCharacters(): string[] {
    try {
      const stored = localStorage.getItem(this.unlockedKey);
      if (stored) {
        const unlocked = JSON.parse(stored);
        return Array.isArray(unlocked) ? unlocked : this.getDefaultUnlockedCharacters();
      }
      return this.getDefaultUnlockedCharacters();
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error getting unlocked characters', error);
      return this.getDefaultUnlockedCharacters();
    }
  }

  /**
   * Set character unlock status
   */
  setCharacterUnlocked(characterType: string, unlocked: boolean): void {
    if (!this.validateCharacterType(characterType)) {
      Logger.warn(LogCategory.CORE, `[CharacterSelectionManager] Invalid character type: ${characterType}`);
      return;
    }

    try {
      let unlockedCharacters = this.getUnlockedCharacters();
      
      if (unlocked) {
        if (!unlockedCharacters.includes(characterType)) {
          unlockedCharacters.push(characterType);
          Logger.info(LogCategory.CORE, `[CharacterSelectionManager] Character unlocked: ${characterType}`);
          
          // Fire unlock event
          this.eventBus.emit('character:unlocked', {
            characterType,
            timestamp: Date.now()
          });
        }
      } else {
        unlockedCharacters = unlockedCharacters.filter(char => char !== characterType);
        Logger.info(LogCategory.CORE, `[CharacterSelectionManager] Character locked: ${characterType}`);
      }
      
      localStorage.setItem(this.unlockedKey, JSON.stringify(unlockedCharacters));
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error setting character unlock status', error);
    }
  }

  /**
   * Check if character is unlocked
   */
  isCharacterUnlocked(characterType: string): boolean {
    const unlockedCharacters = this.getUnlockedCharacters();
    return unlockedCharacters.includes(characterType);
  }

  /**
   * Validate character selection
   */
  validateCharacterSelection(characterType: string): CharacterSelectionValidation {
    const result: CharacterSelectionValidation = {
      isValid: false,
      characterType,
      errors: [],
      warnings: [],
      isUnlocked: false,
      canSelect: false
    };

    // Check if character exists
    if (!this.validateCharacterType(characterType)) {
      result.errors.push(`Character type '${characterType}' not found`);
      return result;
    }

    // Check if character is unlocked
    const isUnlocked = this.isCharacterUnlocked(characterType);
    result.isUnlocked = isUnlocked;
    
    if (!isUnlocked) {
      result.errors.push(`Character '${characterType}' is locked`);
      result.canSelect = false;
    } else {
      result.canSelect = true;
    }

    // Additional validation based on unlock criteria
    const criteria = this.unlockCriteria.get(characterType);
    if (criteria && !criteria.isUnlocked) {
      result.warnings.push(criteria.unlockMessage || `Character '${characterType}' has special unlock requirements`);
    }

    result.isValid = result.errors.length === 0 && result.canSelect;
    return result;
  }

  /**
   * Clear current selection
   */
  clearSelection(): void {
    try {
      localStorage.removeItem(this.storageKey);
      Logger.info(LogCategory.CORE, '[CharacterSelectionManager] Character selection cleared');
      
      this.eventBus.emit('character:selection_cleared', {
        timestamp: Date.now()
      });
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error clearing selection', error);
    }
  }

  /**
   * Clear selection history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(this.historyKey);
      Logger.info(LogCategory.CORE, '[CharacterSelectionManager] Character history cleared');
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error clearing history', error);
    }
  }

  /**
   * Export selection data for backup
   */
  exportSelectionData(): any {
    return {
      selectedCharacter: this.getSelectedCharacter(),
      history: this.getCharacterHistory(),
      unlockedCharacters: this.getUnlockedCharacters(),
      timestamp: Date.now(),
      version: '1.0'
    };
  }

  /**
   * Import selection data from backup
   */
  importSelectionData(data: any): boolean {
    try {
      if (!data || typeof data !== 'object') {
        return false;
      }

      // Import unlocked characters
      if (Array.isArray(data.unlockedCharacters)) {
        localStorage.setItem(this.unlockedKey, JSON.stringify(data.unlockedCharacters));
      }

      // Import history
      if (Array.isArray(data.history)) {
        localStorage.setItem(this.historyKey, JSON.stringify(data.history));
      }

      // Import selected character
      if (data.selectedCharacter && this.validateCharacterType(data.selectedCharacter)) {
        localStorage.setItem(this.storageKey, data.selectedCharacter);
      }

      Logger.info(LogCategory.CORE, '[CharacterSelectionManager] Selection data imported successfully');
      return true;
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error importing selection data', error);
      return false;
    }
  }

  /**
   * Get available characters from registry
   */
  getAvailableCharacters(): string[] {
    return this.characterRegistry.getAllCharacters().map(config => config.id);
  }

  /**
   * Get character configuration
   */
  getCharacterConfig(characterType: string): CharacterConfig | null {
    return this.characterRegistry.getCharacter(characterType);
  }

  /**
   * Reset to defaults (for testing or first-time setup)
   */
  resetToDefaults(): void {
    this.clearSelection();
    this.clearHistory();
    
    // Set default unlocked characters
    const defaultUnlocked = this.getDefaultUnlockedCharacters();
    localStorage.setItem(this.unlockedKey, JSON.stringify(defaultUnlocked));
    
    Logger.info(LogCategory.CORE, '[CharacterSelectionManager] Reset to defaults');
  }

  /**
   * Private helper methods
   */
  private validateCharacterType(characterType: string): boolean {
    return this.characterRegistry.getCharacter(characterType) !== null;
  }

  private setSelectedCharacterSilently(characterType: string): void {
    try {
      localStorage.setItem(this.storageKey, characterType);
      this.addCharacterToHistory(characterType);
      
      // Fire silent selection event
      const selectionEvent: CharacterSelectionEvent = {
        previousCharacter: null,
        selectedCharacter: characterType,
        characterConfig: this.characterRegistry.getCharacter(characterType)!,
        timestamp: Date.now(),
        source: 'system'
      };
      
      this.eventBus.emit('character:selection_changed', selectionEvent);
    } catch (error) {
      Logger.error(LogCategory.CORE, '[CharacterSelectionManager] Error setting character silently', error);
    }
  }

  private getDefaultUnlockedCharacters(): string[] {
    // By default, unlock first 3 characters: Colobus, Gecko, Muskrat
    return ['colobus', 'gecko', 'muskrat'];
  }

  private initializeUnlockCriteria(): void {
    // Default characters (unlocked by default)
    this.unlockCriteria.set('colobus', {
      characterType: 'colobus',
      unlockType: 'default',
      isUnlocked: true,
      unlockMessage: 'Available from the start'
    });

    this.unlockCriteria.set('gecko', {
      characterType: 'gecko',
      unlockType: 'default',
      isUnlocked: true,
      unlockMessage: 'Available from the start'
    });

    this.unlockCriteria.set('muskrat', {
      characterType: 'muskrat',
      unlockType: 'default',
      isUnlocked: true,
      unlockMessage: 'Available from the start'
    });

    // Characters that can be unlocked through gameplay
    this.unlockCriteria.set('herring', {
      characterType: 'herring',
      unlockType: 'achievement',
      isUnlocked: false,
      requirements: {
        achievements: ['swimmer']
      },
      unlockMessage: 'Unlock by demonstrating swimming abilities'
    });

    this.unlockCriteria.set('sparrow', {
      characterType: 'sparrow',
      unlockType: 'achievement',
      isUnlocked: false,
      requirements: {
        achievements: ['flyer']
      },
      unlockMessage: 'Unlock by demonstrating flying abilities'
    });

    this.unlockCriteria.set('inkfish', {
      characterType: 'inkfish',
      unlockType: 'progress',
      isUnlocked: false,
      requirements: {
        playtime: 60 // 1 hour
      },
      unlockMessage: 'Unlock after 1 hour of playtime'
    });

    this.unlockCriteria.set('pudu', {
      characterType: 'pudu',
      unlockType: 'achievement',
      isUnlocked: false,
      requirements: {
        achievements: ['forest_explorer']
      },
      unlockMessage: 'Unlock by exploring the entire forest'
    });

    this.unlockCriteria.set('taipan', {
      characterType: 'taipan',
      unlockType: 'achievement',
      isUnlocked: false,
      requirements: {
        achievements: ['master_player']
      },
      unlockMessage: 'Unlock by mastering all other characters'
    });
  }

  /**
   * Get unlock criteria for a character
   */
  getUnlockCriteria(characterType: string): CharacterUnlockCriteria | null {
    return this.unlockCriteria.get(characterType) || null;
  }

  /**
   * Check if character can be unlocked based on criteria
   */
  checkUnlockEligibility(characterType: string, _playerData?: any): boolean {
    const criteria = this.unlockCriteria.get(characterType);
    if (!criteria || criteria.isUnlocked) {
      return true;
    }

    // For now, we'll implement basic unlock logic
    // In a real game, this would check against actual player progress
    switch (criteria.unlockType) {
      case 'default':
        return true;
      case 'achievement':
      case 'progress':
      case 'purchase':
        // TODO: Implement based on actual game progression
        return false;
      default:
        return false;
    }
  }

  /**
   * Manually unlock character (for testing or admin purposes)
   */
  forceUnlockCharacter(characterType: string): void {
    this.setCharacterUnlocked(characterType, true);
    
    const criteria = this.unlockCriteria.get(characterType);
    if (criteria) {
      criteria.isUnlocked = true;
    }
    
    Logger.info(LogCategory.CORE, `[CharacterSelectionManager] Force unlocked character: ${characterType}`);
  }
} 