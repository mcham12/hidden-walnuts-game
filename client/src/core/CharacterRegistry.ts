// client/src/core/CharacterRegistry.ts

import { CharacterType, CharacterAnimationMap } from './types';
import { Logger, LogCategory } from './Logger';

// AI NOTE: Registry loads character definitions from JSON for extensibility. Supports future additions without code changes. Defaults to squirrel.

export class CharacterRegistry {
  private characters: Map<string, CharacterType> = new Map();
  private defaultCharacterId = 'squirrel';

  constructor() {
    this.loadCharacters();
  }

  private loadCharacters(): void {
    // In production, load from JSON fetch or public/characters.json
    // For now, hardcoded with asset metadata references; replace with dynamic load
    const characterData: CharacterType[] = [
      {
        id: 'squirrel',
        name: 'Squirrel',
        modelPath: '/assets/models/environment/squirrel.glb', // From asset metadata: 1 mesh, 0 bones, no animations (add later)
        lodModels: [], // No LODs in metadata
        animations: this.getAnimationsFor('Squirrel'), // No animations in base model; extend with /animations/...
        scale: 0.3,
        stats: { speed: 1.0, jumpHeight: 1.0 },
        unlockCondition: 'always', // Default unlocked
        isNPCCompatible: true
      },
      {
        id: 'colobus',
        name: 'Colobus Monkey',
        modelPath: '/models/characters/Colobus_LOD0.glb', // Metadata: 1 mesh, 10 bones
        lodModels: [
          '/models/characters/Colobus_LOD1.glb',
          '/models/characters/Colobus_LOD2.glb',
          '/models/characters/Colobus_LOD3.glb'
        ],
        animations: this.getAnimationsFor('Colobus'), // Reference metadata: 18 animations (Attack, Idle, etc.)
        scale: 0.3,
        stats: { speed: 1.2, jumpHeight: 1.5 },
        unlockCondition: 'level:5', // Example locked
        isNPCCompatible: true
      },
      // Add more from metadata, e.g., Gecko, Herring, etc. for extensibility
      {
        id: 'gecko',
        name: 'Gecko',
        modelPath: '/models/characters/Gecko_LOD0.glb', // Metadata: 1 mesh, 8 bones
        lodModels: [
          '/models/characters/Gecko_LOD1.glb',
          '/models/characters/Gecko_LOD2.glb',
          '/models/characters/Gecko_LOD3.glb'
        ],
        animations: this.getAnimationsFor('Gecko'),
        scale: 0.3,
        stats: { speed: 0.8, jumpHeight: 0.5 },
        unlockCondition: 'achievement:explorer',
        isNPCCompatible: true
      }
      // Extend with others as needed; future: load from public/characters.json
    ];

    characterData.forEach(char => {
      this.characters.set(char.id, char);
      Logger.info(LogCategory.CORE, `Registered character: ${char.name} (${char.id})`);
    });
  }

  private getAnimationsFor(character: string): CharacterAnimationMap {
    // Map from asset metadata; single animations in /animations/characters/Single/
    // Full sets in /animations/characters/{character}_Animations.glb (18 animations each)
    return {
      idle: `/animations/characters/Single/${character}_Idle_A.glb`,
      walk: `/animations/characters/Single/${character}_Walk.glb`,
      run: `/animations/characters/Single/${character}_Run.glb`,
      jump: `/animations/characters/Single/${character}_Jump.glb`,
      // Add more states; extensible map
    };
  }

  getCharacter(id: string): CharacterType | undefined {
    return this.characters.get(id);
  }

  getDefaultCharacter(): CharacterType {
    return this.characters.get(this.defaultCharacterId)!;
  }

  getAllCharacters(): CharacterType[] {
    return Array.from(this.characters.values());
  }

  isUnlocked(char: CharacterType, playerLevel: number, achievements: string[]): boolean {
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