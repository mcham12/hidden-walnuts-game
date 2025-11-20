// Character Registry - Manages all available animated characters for multiplayer
// MVP 16: Enhanced with character tier system and authentication-based gating

export type CharacterTier = 'no-auth' | 'free' | 'premium' | 'future';

export interface CharacterDefinition {
  id: string;
  name: string;
  tier: CharacterTier;
  price?: number; // Only for premium characters
  modelPath: string;
  animations: {
    idle: string;
    idle_b?: string;
    idle_c?: string;
    walk: string;
    run: string;
    jump?: string;
    eat?: string;
    bounce?: string;
    spin?: string;
    clicked?: string;
    sit?: string;
    roll?: string;
    attack?: string;
    hit?: string;
    fear?: string;
    death?: string;
    fly?: string;
    swim?: string;
  };
  scale: number;
  category: 'mammal' | 'bird' | 'reptile' | 'aquatic';
  description?: string;
  emoteAnimations?: {
    wave?: string;
    point?: string;
    celebrate?: string;
  };
}

// Character tier constants matching server-side validation
export const NO_AUTH_CHARACTERS = ['squirrel'];

export const FREE_AUTH_CHARACTERS = [
  'squirrel',
  'hare',
  'goat',
  'chipmunk',
  'turkey',
  'mallard'
];

export const PREMIUM_CHARACTERS = [
  'lynx',
  'bear',
  'moose',
  'badger'
];

export const FUTURE_PREMIUM_CHARACTERS = [
  'skunk' // Seasonal/event character
];

export class CharacterRegistry {
  private static characters: CharacterDefinition[] = [];
  private static loaded = false;

  // Load characters from JSON file
  static async loadCharacters(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch('/characters.json');
      if (!response.ok) {
        throw new Error(`Failed to load characters: ${response.statusText}`);
      }
      this.characters = await response.json();
      this.loaded = true;
    } catch (error) {
      console.error('Failed to load character definitions:', error);
      this.characters = [];
    }
  }

  // Ensure characters are loaded before using registry
  private static ensureLoaded(): void {
    if (!this.loaded) {
      throw new Error('CharacterRegistry not loaded. Call loadCharacters() first.');
    }
  }

  // Get all characters (regardless of availability)
  static getAllCharacters(): CharacterDefinition[] {
    this.ensureLoaded();
    return [...this.characters];
  }

  // Get character by ID
  static getCharacterById(id: string): CharacterDefinition | null {
    this.ensureLoaded();
    return this.characters.find(char => char.id === id) || null;
  }

  // Get character tier
  static getCharacterTier(characterId: string): CharacterTier | null {
    const character = this.getCharacterById(characterId);
    return character?.tier || null;
  }

  // Get character price (returns null for non-premium characters)
  static getCharacterPrice(characterId: string): number | null {
    const character = this.getCharacterById(characterId);
    return character?.price || null;
  }

  // Check if character is available to user
  static isCharacterAvailable(
    characterId: string,
    isAuthenticated: boolean,
    unlockedCharacters: string[] = []
  ): boolean {
    const character = this.getCharacterById(characterId);
    if (!character) return false;

    const tier = character.tier;

    // No-auth users: only squirrel
    if (!isAuthenticated) {
      return tier === 'no-auth';
    }

    // Authenticated users: no-auth + free characters + unlocked premium
    // MVP 16 FIX: Allow no-auth characters (squirrel) for authenticated users too
    if (tier === 'no-auth') return true;

    // Free tier now requires explicit unlock (via email verification)
    if (tier === 'free') {
      return unlockedCharacters.includes(characterId);
    }

    if (tier === 'premium' && unlockedCharacters.includes(characterId)) return true;

    // Future characters not available yet
    return false;
  }

  // Get all available characters for user
  static getAvailableCharacters(
    isAuthenticated: boolean,
    unlockedCharacters: string[] = []
  ): CharacterDefinition[] {
    this.ensureLoaded();

    return this.characters.filter(char =>
      this.isCharacterAvailable(char.id, isAuthenticated, unlockedCharacters)
    );
  }

  // Get locked characters (premium characters not yet unlocked)
  static getLockedCharacters(
    isAuthenticated: boolean,
    unlockedCharacters: string[] = []
  ): CharacterDefinition[] {
    this.ensureLoaded();

    if (!isAuthenticated) {
      // No-auth users see all premium + free characters as locked
      return this.characters.filter(char => char.tier !== 'no-auth' && char.tier !== 'future');
    }

    // Authenticated users see only premium characters they haven't unlocked
    return this.characters.filter(char =>
      char.tier === 'premium' && !unlockedCharacters.includes(char.id)
    );
  }

  // Get characters by category
  static getCharactersByCategory(category: CharacterDefinition['category']): CharacterDefinition[] {
    this.ensureLoaded();
    return this.characters.filter(char => char.category === category);
  }

  // Get random character (excluding specific ones)
  static getRandomCharacter(excludeIds: string[] = []): CharacterDefinition {
    this.ensureLoaded();
    const availableChars = this.characters.filter(char => !excludeIds.includes(char.id));
    const randomIndex = Math.floor(Math.random() * availableChars.length);
    return availableChars[randomIndex] || this.characters[0]; // Fallback to first character
  }

  // Get random character for multiplayer (ensures variety)
  static getRandomMultiplayerCharacter(usedCharacters: string[] = []): CharacterDefinition {
    this.ensureLoaded();
    // Prefer unused characters first
    const unusedChars = this.characters.filter(char => !usedCharacters.includes(char.id));

    if (unusedChars.length > 0) {
      const randomIndex = Math.floor(Math.random() * unusedChars.length);
      return unusedChars[randomIndex];
    }

    // If all characters are used, pick any random one
    return this.getRandomCharacter();
  }

  // Character color variants for multiplayer identification
  static getCharacterColorVariant(_characterId: string, playerId: string): string {
    // Generate consistent color based on player ID
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      const char = playerId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Predefined color palette for good visibility
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA0DD', // Plum
      '#F39C12', // Orange
      '#9B59B6', // Purple
      '#1ABC9C', // Turquoise
      '#E74C3C', // Crimson
      '#3498DB', // Sky Blue
      '#2ECC71', // Emerald
      '#F1C40F', // Gold
      '#E67E22', // Carrot
      '#8E44AD'  // Violet
    ];

    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  }

  // Validate character configuration
  static validateCharacter(characterId: string): boolean {
    const character = this.getCharacterById(characterId);
    if (!character) return false;

    // Basic validation - ensure required animations exist
    return !!(character.animations.idle && character.animations.walk && character.animations.run);
  }

  // Get character display info for UI
  static getCharacterDisplayInfo(characterId: string): {
    name: string;
    category: string;
    tier: CharacterTier;
    price?: number;
    emoji: string;
  } | null {
    const character = this.getCharacterById(characterId);
    if (!character) return null;

    // Category emojis for UI
    const categoryEmojis = {
      'mammal': '🐒',
      'bird': '🐦',
      'reptile': '🦎',
      'aquatic': '🐟'
    };

    return {
      name: character.name,
      category: character.category,
      tier: character.tier,
      price: character.price,
      emoji: categoryEmojis[character.category]
    };
  }

  // Get appropriate animation for movement state
  static getAnimationForState(characterId: string, state: 'idle' | 'walking' | 'running'): string | null {
    const character = this.getCharacterById(characterId);
    if (!character) return null;

    switch (state) {
      case 'idle':
        return character.animations.idle;
      case 'walking':
        return character.animations.walk;
      case 'running':
        return character.animations.run;
      default:
        return character.animations.idle;
    }
  }

  // Check if character is suitable for terrain type
  static isCharacterSuitableForTerrain(characterId: string, terrainType: 'land' | 'water'): boolean {
    const character = this.getCharacterById(characterId);
    if (!character) return false;

    // Aquatic characters prefer water, others prefer land
    if (terrainType === 'water') {
      return character.category === 'aquatic';
    } else {
      return character.category !== 'aquatic';
    }
  }
}
