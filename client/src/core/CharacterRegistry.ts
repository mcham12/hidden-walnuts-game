import { CharacterConfig, LODConfig, CharacterCategory } from '../types/CharacterTypes';
import { Logger, LogCategory } from './Logger';
import { EventBus } from './EventBus';

/**
 * Character Registry System
 * Manages all character configurations and provides type-safe access
 */
export class CharacterRegistry {
  private characters = new Map<string, CharacterConfig>();
  private lodConfig: LODConfig;
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    
    // Default LOD distances (can be configured per character)
    this.lodConfig = {
      lod0Distance: 15,  // High detail - close up
      lod1Distance: 30,  // Medium detail - medium distance
      lod2Distance: 50,  // Low detail - far distance
      lod3Distance: 100  // Minimal detail - very far
    };
  }

  /**
   * Register a new character configuration
   */
  registerCharacter(config: CharacterConfig): void {
    if (this.characters.has(config.id)) {
      Logger.warn(LogCategory.CORE, `Character ${config.id} already registered, overwriting`);
    }

    // Validate character configuration
    if (!this.validateCharacterConfig(config)) {
      Logger.error(LogCategory.CORE, `Invalid character configuration for ${config.id}`);
      return;
    }

    this.characters.set(config.id, config);
    Logger.info(LogCategory.CORE, `✅ Registered character: ${config.name} (${config.id})`);
    
    // Emit event for character registration
    this.eventBus.emit('character_registered', { characterId: config.id, config });
  }

  /**
   * Get a character configuration by ID
   */
  getCharacter(id: string): CharacterConfig | null {
    const config = this.characters.get(id);
    if (!config) {
      Logger.warn(LogCategory.CORE, `Character ${id} not found in registry`);
      return null;
    }
    return config;
  }

  /**
   * Get all registered character configurations
   */
  getAllCharacters(): CharacterConfig[] {
    return Array.from(this.characters.values());
  }

  /**
   * Get all characters that can be used as players
   */
  getPlayerCharacters(): CharacterConfig[] {
    return this.getAllCharacters().filter(config => config.behaviors.isPlayer);
  }

  /**
   * Get all characters that can be used as NPCs
   */
  getNPCCharacters(): CharacterConfig[] {
    return this.getAllCharacters().filter(config => config.behaviors.isNPC);
  }

  /**
   * Get characters by category
   */
  getCharactersByCategory(category: CharacterCategory): CharacterConfig[] {
    return this.getAllCharacters().filter(config => {
      // Simple category detection based on character ID
      switch (category) {
        case CharacterCategory.MAMMAL:
          return ['colobus', 'muskrat', 'pudu'].includes(config.id);
        case CharacterCategory.BIRD:
          return ['sparrow'].includes(config.id);
        case CharacterCategory.REPTILE:
          return ['gecko', 'taipan'].includes(config.id);
        case CharacterCategory.FISH:
          return ['herring', 'inkfish'].includes(config.id);
        default:
          return false;
      }
    });
  }

  /**
   * Validate a character configuration
   */
  validateCharacter(id: string): boolean {
    const config = this.getCharacter(id);
    return config !== null && this.validateCharacterConfig(config);
  }

  /**
   * Get appropriate LOD model path based on distance
   */
  getLODModelPath(characterId: string, distance: number): string {
    const config = this.getCharacter(characterId);
    if (!config) {
      Logger.error(LogCategory.CORE, `Cannot get LOD for unknown character: ${characterId}`);
      return '';
    }

    if (distance <= this.lodConfig.lod0Distance) {
      return config.lodPaths.lod0;
    } else if (distance <= this.lodConfig.lod1Distance) {
      return config.lodPaths.lod1;
    } else if (distance <= this.lodConfig.lod2Distance) {
      return config.lodPaths.lod2;
    } else {
      return config.lodPaths.lod3;
    }
  }

  /**
   * Get LOD level (0-3) based on distance
   */
  getLODLevel(distance: number): number {
    if (distance <= this.lodConfig.lod0Distance) {
      return 0;
    } else if (distance <= this.lodConfig.lod1Distance) {
      return 1;
    } else if (distance <= this.lodConfig.lod2Distance) {
      return 2;
    } else {
      return 3;
    }
  }

  /**
   * Get character count by type
   */
  getCharacterCount(): { total: number; players: number; npcs: number } {
    const all = this.getAllCharacters();
    return {
      total: all.length,
      players: all.filter(c => c.behaviors.isPlayer).length,
      npcs: all.filter(c => c.behaviors.isNPC).length
    };
  }

  /**
   * Check if a character exists
   */
  hasCharacter(id: string): boolean {
    return this.characters.has(id);
  }

  /**
   * Get character IDs
   */
  getCharacterIds(): string[] {
    return Array.from(this.characters.keys());
  }

  /**
   * Clear all registered characters (for testing)
   */
  clear(): void {
    this.characters.clear();
    Logger.info(LogCategory.CORE, 'Character registry cleared');
  }

  /**
   * Private method to validate character configuration
   */
  private validateCharacterConfig(config: CharacterConfig): boolean {
    // Check required fields
    if (!config.id || !config.name || !config.modelPath) {
      Logger.error(LogCategory.CORE, 'Character config missing required fields');
      return false;
    }

    // Check LOD paths
    if (!config.lodPaths || !config.lodPaths.lod0 || !config.lodPaths.lod1 || 
        !config.lodPaths.lod2 || !config.lodPaths.lod3) {
      Logger.error(LogCategory.CORE, `Character ${config.id} missing LOD paths`);
      return false;
    }

    // Check animations
    if (!config.animations || !config.animations.idle_a || !config.animations.walk || 
        !config.animations.run) {
      Logger.error(LogCategory.CORE, `Character ${config.id} missing required animations`);
      return false;
    }

    // Check behaviors
    if (!config.behaviors || (config.behaviors.movementSpeed <= 0)) {
      Logger.error(LogCategory.CORE, `Character ${config.id} has invalid behavior configuration`);
      return false;
    }

    // Check network settings
    if (!config.network || config.network.compressionLevel < 0 || config.network.compressionLevel > 1) {
      Logger.error(LogCategory.CORE, `Character ${config.id} has invalid network configuration`);
      return false;
    }

    return true;
  }

  /**
   * Get statistics about registered characters
   */
  getStats(): {
    totalCharacters: number;
    playerCharacters: number;
    npcCharacters: number;
    categories: { [key: string]: number };
  } {
    const all = this.getAllCharacters();
    const stats = {
      totalCharacters: all.length,
      playerCharacters: all.filter(c => c.behaviors.isPlayer).length,
      npcCharacters: all.filter(c => c.behaviors.isNPC).length,
      categories: {
        mammals: this.getCharactersByCategory(CharacterCategory.MAMMAL).length,
        birds: this.getCharactersByCategory(CharacterCategory.BIRD).length,
        reptiles: this.getCharactersByCategory(CharacterCategory.REPTILE).length,
        fish: this.getCharactersByCategory(CharacterCategory.FISH).length,
      }
    };

    return stats;
  }
} 