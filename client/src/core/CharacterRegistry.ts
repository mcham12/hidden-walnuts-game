// client/src/core/CharacterRegistry.ts

import { CharacterType } from './types';
import { Logger, LogCategory } from './Logger';
import characterData from '../../public/characters.json';

export class CharacterRegistry {
  private characters: Map<string, CharacterType> = new Map();
  private defaultCharacterId = 'squirrel';
  public ready: Promise<void>;

  constructor() {
    this.ready = this.loadCharacters();
  }

  private async loadCharacters(): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, '📚 Loading characters from imported JSON...');
      
      // Import the JSON directly as a module
      const characters: CharacterType[] = characterData;
      Logger.info(LogCategory.CORE, `✅ Successfully loaded ${characters.length} characters from JSON`);
      
      characters.forEach(char => {
        this.characters.set(char.id, char);
        // Logger.info(LogCategory.CORE, `Registered character: ${char.name} (${char.id})`); // Removed to reduce console spam
      });
      
      if (!this.characters.has(this.defaultCharacterId)) {
        Logger.warn(LogCategory.CORE, `Default character '${this.defaultCharacterId}' not found in characters.json`);
      }
    } catch (err) {
      Logger.error(LogCategory.CORE, `Failed to load characters.json:`, err);
      // Fallback: empty registry
      this.characters.clear();
    }
  }

  async getCharacter(id: string): Promise<CharacterType | undefined> {
    await this.ready;
    return this.characters.get(id);
  }

  async getDefaultCharacter(): Promise<CharacterType | undefined> {
    await this.ready;
    return this.characters.get(this.defaultCharacterId);
  }

  async getAllCharacters(): Promise<CharacterType[]> {
    await this.ready;
    return Array.from(this.characters.values());
  }

  async isUnlocked(char: CharacterType, playerLevel: number, achievements: string[]): Promise<boolean> {
    // No need to await ready, char is already provided
    if (char.unlockCondition === 'always') return true;
    if (char.unlockCondition.startsWith('level:')) {
      return playerLevel >= parseInt(char.unlockCondition.split(':')[1]);
    }
    if (char.unlockCondition.startsWith('achievement:')) {
      return achievements.includes(char.unlockCondition.split(':')[1]);
    }
    return false;
  }
}