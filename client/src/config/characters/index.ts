import { CharacterRegistry } from '../../core/CharacterRegistry';
import { EventBus } from '../../core/EventBus';
import { Logger, LogCategory } from '../../core/Logger';

// Import all character configurations
import { colobusConfig } from './colobus';
import { geckoConfig } from './gecko';
import { herringConfig } from './herring';
import { inkfishConfig } from './inkfish';
import { muskratConfig } from './muskrat';
import { puduConfig } from './pudu';
import { sparrowConfig } from './sparrow';
import { taipanConfig } from './taipan';

// Export all character configurations
export { colobusConfig } from './colobus';
export { geckoConfig } from './gecko';
export { herringConfig } from './herring';
export { inkfishConfig } from './inkfish';
export { muskratConfig } from './muskrat';
export { puduConfig } from './pudu';
export { sparrowConfig } from './sparrow';
export { taipanConfig } from './taipan';

/**
 * All available character configurations
 */
export const ALL_CHARACTER_CONFIGS = [
  colobusConfig,
  geckoConfig,
  herringConfig,
  inkfishConfig,
  muskratConfig,
  puduConfig,
  sparrowConfig,
  taipanConfig
];

/**
 * Character configurations by ID for quick lookup
 */
export const CHARACTER_CONFIGS_BY_ID = {
  colobus: colobusConfig,
  gecko: geckoConfig,
  herring: herringConfig,
  inkfish: inkfishConfig,
  muskrat: muskratConfig,
  pudu: puduConfig,
  sparrow: sparrowConfig,
  taipan: taipanConfig
};

/**
 * Initialize the character registry with all available characters
 */
export function initializeCharacterRegistry(eventBus: EventBus): CharacterRegistry {
  Logger.info(LogCategory.CORE, '🎭 Initializing character registry...');
  
  const registry = new CharacterRegistry(eventBus);
  
  // Register all character configurations
  ALL_CHARACTER_CONFIGS.forEach(config => {
    registry.registerCharacter(config);
  });
  
  const stats = registry.getStats();
  Logger.info(LogCategory.CORE, `✅ Character registry initialized with ${stats.totalCharacters} characters`);
  Logger.info(LogCategory.CORE, `📊 Character stats: ${stats.playerCharacters} player types, ${stats.npcCharacters} NPC types`);
  Logger.info(LogCategory.CORE, `🐾 Categories: ${stats.categories.mammals} mammals, ${stats.categories.birds} birds, ${stats.categories.reptiles} reptiles, ${stats.categories.fish} fish`);
  
  return registry;
}

/**
 * Get default character ID (for backwards compatibility)
 */
export function getDefaultCharacterId(): string {
  return 'colobus'; // Default to Colobus monkey (most similar to original squirrel)
}

/**
 * Get character configuration by ID with fallback
 */
export function getCharacterConfig(characterId?: string) {
  const id = characterId || getDefaultCharacterId();
  const config = CHARACTER_CONFIGS_BY_ID[id as keyof typeof CHARACTER_CONFIGS_BY_ID];
  
  if (!config) {
    Logger.warn(LogCategory.CORE, `Character ${id} not found, using default (${getDefaultCharacterId()})`);
    return CHARACTER_CONFIGS_BY_ID[getDefaultCharacterId() as keyof typeof CHARACTER_CONFIGS_BY_ID];
  }
  
  return config;
}

/**
 * Get all player-selectable characters
 */
export function getPlayerSelectableCharacters() {
  return ALL_CHARACTER_CONFIGS.filter(config => config.behaviors.isPlayer);
}

/**
 * Get all NPC-capable characters
 */
export function getNPCCapableCharacters() {
  return ALL_CHARACTER_CONFIGS.filter(config => config.behaviors.isNPC);
}

/**
 * Character type definitions for type safety
 */
export type CharacterType = 'colobus' | 'gecko' | 'herring' | 'inkfish' | 'muskrat' | 'pudu' | 'sparrow' | 'taipan';

/**
 * Validate character type
 */
export function isValidCharacterType(characterType: string): characterType is CharacterType {
  return characterType in CHARACTER_CONFIGS_BY_ID;
} 