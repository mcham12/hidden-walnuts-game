// Character Registry - Manages all available animated characters for multiplayer

export interface CharacterDefinition {
  id: string;
  name: string;
  modelPath: string;
  animations: {
    idle: string;
    walk: string;
    run: string;
    jump?: string;
    attack?: string;
    sit?: string;
  };
  scale: number;
  category: 'mammal' | 'bird' | 'reptile' | 'aquatic';
}

export class CharacterRegistry {
  private static characters: CharacterDefinition[] = [
    // Mammals
    {
      id: 'colobus',
      name: 'Colobus Monkey',
      modelPath: '/assets/models/characters/Colobus_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Colobus_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Colobus_Walk.glb',
        run: '/assets/animations/characters/Single/Colobus_Run.glb',
        jump: '/assets/animations/characters/Single/Colobus_Jump.glb',
        attack: '/assets/animations/characters/Single/Colobus_Attack.glb',
        sit: '/assets/animations/characters/Single/Colobus_Sit.glb'
      },
      scale: 0.3,
      category: 'mammal'
    },
    {
      id: 'muskrat',
      name: 'Muskrat',
      modelPath: '/assets/models/characters/Muskrat_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Muskrat_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Muskrat_Walk.glb',
        run: '/assets/animations/characters/Single/Muskrat_Run.glb',
        jump: '/assets/animations/characters/Single/Muskrat_Jump.glb',
        attack: '/assets/animations/characters/Single/Muskrat_Attack.glb'
      },
      scale: 0.3,
      category: 'mammal'
    },
    {
      id: 'pudu',
      name: 'Pudu (Small Deer)',
      modelPath: '/assets/models/characters/Pudu_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Pudu_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Pudu_Walk.glb',
        run: '/assets/animations/characters/Single/Pudu_Run.glb',
        jump: '/assets/animations/characters/Single/Pudu_Jump.glb',
        attack: '/assets/animations/characters/Single/Pudu_Attack.glb'
      },
      scale: 0.3,
      category: 'mammal'
    },
    
    // Reptiles
    {
      id: 'gecko',
      name: 'Gecko',
      modelPath: '/assets/models/characters/Gecko_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Gecko_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Gecko_Walk.glb',
        run: '/assets/animations/characters/Single/Gecko_Run.glb',
        jump: '/assets/animations/characters/Single/Gecko_Jump.glb',
        attack: '/assets/animations/characters/Single/Gecko_Attack.glb'
      },
      scale: 0.3,
      category: 'reptile'
    },
    {
      id: 'taipan',
      name: 'Taipan Snake',
      modelPath: '/assets/models/characters/Taipan_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Taipan_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Taipan_Walk.glb',
        run: '/assets/animations/characters/Single/Taipan_Run.glb',
        attack: '/assets/animations/characters/Single/Taipan_Attack.glb'
      },
      scale: 0.3,
      category: 'reptile'
    },
    
    // Birds
    {
      id: 'sparrow',
      name: 'Sparrow',
      modelPath: '/assets/models/characters/Sparrow_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Sparrow_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Sparrow_Walk.glb',
        run: '/assets/animations/characters/Single/Sparrow_Run.glb',
        jump: '/assets/animations/characters/Single/Sparrow_Jump.glb',
        attack: '/assets/animations/characters/Single/Sparrow_Attack.glb'
      },
      scale: 0.3,
      category: 'bird'
    },
    
    // Aquatic
    {
      id: 'herring',
      name: 'Herring Fish',
      modelPath: '/assets/models/characters/Herring_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Herring_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Herring_Swim.glb',
        run: '/assets/animations/characters/Single/Herring_Swim.glb',
        attack: '/assets/animations/characters/Single/Herring_Attack.glb'
      },
      scale: 0.3,
      category: 'aquatic'
    },
    {
      id: 'inkfish',
      name: 'Inkfish (Squid)',
      modelPath: '/assets/models/characters/Inkfish_LOD0.glb',
      animations: {
        idle: '/assets/animations/characters/Single/Inkfish_Idle_A.glb',
        walk: '/assets/animations/characters/Single/Inkfish_Swim.glb',
        run: '/assets/animations/characters/Single/Inkfish_Swim.glb',
        attack: '/assets/animations/characters/Single/Inkfish_Attack.glb'
      },
      scale: 0.3,
      category: 'aquatic'
    }
  ];

  // Get all available characters
  static getAllCharacters(): CharacterDefinition[] {
    return [...this.characters];
  }

  // Get character by ID
  static getCharacterById(id: string): CharacterDefinition | null {
    return this.characters.find(char => char.id === id) || null;
  }

  // Get characters by category
  static getCharactersByCategory(category: CharacterDefinition['category']): CharacterDefinition[] {
    return this.characters.filter(char => char.category === category);
  }

  // Get random character (excluding specific ones)
  static getRandomCharacter(excludeIds: string[] = []): CharacterDefinition {
    const availableChars = this.characters.filter(char => !excludeIds.includes(char.id));
    const randomIndex = Math.floor(Math.random() * availableChars.length);
    return availableChars[randomIndex] || this.characters[0]; // Fallback to first character
  }

  // Get random character for multiplayer (ensures variety)
  static getRandomMultiplayerCharacter(usedCharacters: string[] = []): CharacterDefinition {
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
  static getCharacterDisplayInfo(characterId: string): { name: string; category: string; emoji: string } | null {
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