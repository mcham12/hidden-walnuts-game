// Character Registry and Types for MVP-8a Task 1

import ColobusConfig from './colobus';
import GeckoConfig from './gecko';
import HerringConfig from './herring';
import InkfishConfig from './inkfish';
import MuskratConfig from './muskrat';
import PuduConfig from './pudu';
import SparrowConfig from './sparrow';
import TaipanConfig from './taipan';

export interface CharacterLODModels {
  lod0: string;
  lod1: string;
  lod2: string;
  lod3: string;
}

export interface CharacterAnimations {
  idle: string[];
  movement: string[];
  actions: string[];
}

export interface CharacterTextures {
  diffuse: string;
  normal?: string;
  specular?: string;
}

export interface CharacterMetadata {
  unlockRequirement?: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  tags?: string[];
}

export interface CharacterConfig {
  id: string;
  name: string;
  description: string;
  models: CharacterLODModels;
  animations: CharacterAnimations;
  textures: CharacterTextures;
  metadata: CharacterMetadata;
}

// Character registry with all 8 characters
export const CharacterRegistry: Record<string, CharacterConfig> = {
  colobus: ColobusConfig,
  gecko: GeckoConfig,
  herring: HerringConfig,
  inkfish: InkfishConfig,
  muskrat: MuskratConfig,
  pudu: PuduConfig,
  sparrow: SparrowConfig,
  taipan: TaipanConfig,
};

// Utility functions for character management
export class CharacterRegistryManager {
  /**
   * Get a character config by ID
   */
  static getCharacter(id: string): CharacterConfig | undefined {
    return CharacterRegistry[id];
  }

  /**
   * Get all character IDs
   */
  static getAllCharacterIds(): string[] {
    return Object.keys(CharacterRegistry);
  }

  /**
   * Get all character configs
   */
  static getAllCharacters(): CharacterConfig[] {
    return Object.values(CharacterRegistry);
  }

  /**
   * Get characters by rarity
   */
  static getCharactersByRarity(rarity: CharacterMetadata['rarity']): CharacterConfig[] {
    return Object.values(CharacterRegistry).filter(char => char.metadata.rarity === rarity);
  }

  /**
   * Get unlocked characters based on player score
   */
  static getUnlockedCharacters(playerScore: number): CharacterConfig[] {
    return Object.values(CharacterRegistry).filter(char => 
      (char.metadata.unlockRequirement || 0) <= playerScore
    );
  }

  /**
   * Validate character config structure
   */
  static validateCharacterConfig(config: CharacterConfig): boolean {
    return !!(
      config.id &&
      config.name &&
      config.description &&
      config.models &&
      config.animations &&
      config.textures &&
      config.metadata
    );
  }

  /**
   * Get default character (Colobus)
   */
  static getDefaultCharacter(): CharacterConfig {
    return CharacterRegistry.colobus;
  }
} 