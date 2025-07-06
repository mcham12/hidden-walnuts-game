# Task 1: Character Configuration System

## 🎯 **Objective**
Create a flexible character configuration system that supports any animal type with configurable properties, enabling the game to use any animated animal as both players and NPCs.

## 📊 **Status**
- **Status**: 📋 **PENDING**
- **Priority**: 🔵 **HIGH** (Foundation for all other tasks)
- **Dependencies**: MVP 7 (Multiplayer Foundation) ✅ **COMPLETED**
- **Estimated Time**: 1 week

## 🏗️ **Technical Requirements**

### **Character Configuration Interface**
```typescript
interface CharacterConfig {
  id: string;                    // Unique identifier (e.g., 'colobus', 'gecko')
  name: string;                  // Display name (e.g., 'Colobus', 'Gecko')
  modelPath: string;             // Asset path (e.g., '/assets/models/Colobus_LOD0.glb')
  scale: number;                 // Model scale per animal type
  lodPaths: {
    lod0: string;                // High detail model
    lod1: string;                // Medium detail model
    lod2: string;                // Low detail model
    lod3: string;                // Minimal detail model
  };
  animations: {
    // Core animations
    idle_a: string;              // Idle animation variation A
    idle_b: string;              // Idle animation variation B
    idle_c: string;              // Idle animation variation C
    walk: string;                // Walking animation
    run: string;                 // Running animation
    jump: string;                // Jumping animation
    
    // Movement animations
    swim: string;                // Swimming animation
    fly: string;                 // Flying animation
    roll: string;                // Rolling animation
    bounce: string;              // Bouncing animation
    spin: string;                // Spinning animation
    
    // Action animations
    eat: string;                 // Eating animation
    clicked: string;             // Clicked/reaction animation
    fear: string;                // Fear/scared animation
    death: string;               // Death animation
    sit: string;                 // Sitting animation
  };
  blendshapes: {
    // Eye expressions
    eyes_blink: string;
    eyes_happy: string;
    eyes_sad: string;
    eyes_annoyed: string;
    eyes_squint: string;
    eyes_shrink: string;
    eyes_dead: string;
    eyes_lookOut: string;
    eyes_lookIn: string;
    eyes_lookUp: string;
    eyes_lookDown: string;
    eyes_excited_1: string;
    eyes_excited_2: string;
    eyes_rabid: string;
    eyes_spin_1: string;
    eyes_spin_2: string;
    eyes_spin_3: string;
    eyes_cry_1: string;
    eyes_cry_2: string;
    eyes_trauma: string;
    
    // Tear and sweat effects
    teardrop_1_L: string;
    teardrop_2_L: string;
    teardrop_1_R: string;
    teardrop_2_R: string;
    sweat_1_L: string;
    sweat_2_L: string;
    sweat_1_R: string;
    sweat_2_R: string;
  };
  behaviors: {
    isPlayer: boolean;           // Can be used as player character
    isNPC: boolean;              // Can be used as NPC
    movementSpeed: number;       // Movement speed multiplier
    jumpHeight: number;          // Jump height multiplier
    canSwim: boolean;            // Whether this animal can swim
    canFly: boolean;             // Whether this animal can fly
    aiBehaviors: string[];       // Available AI behaviors
  };
  network: {
    syncAnimations: boolean;     // Whether to sync animations over network
    compressionLevel: number;    // Animation data compression (0-1)
  };
}
```

### **Character Registry System**
```typescript
class CharacterRegistry {
  private characters: Map<string, CharacterConfig> = new Map();
  
  registerCharacter(config: CharacterConfig): void;
  getCharacter(id: string): CharacterConfig | null;
  getAllCharacters(): CharacterConfig[];
  getPlayerCharacters(): CharacterConfig[];
  getNPCCharacters(): CharacterConfig[];
  validateCharacter(id: string): boolean;
}
```

### **Universal Character Factory**
```typescript
class CharacterFactory {
  constructor(
    private assetManager: IAssetManager,
    private characterRegistry: CharacterRegistry
  ) {}
  
  async createPlayer(
    playerId: string,
    characterType: string,
    isLocal: boolean
  ): Promise<Entity>;
  
  async createNPC(
    npcId: string,
    characterType: string,
    position: Vector3
  ): Promise<Entity>;
  
  private async loadCharacterModel(config: CharacterConfig): Promise<THREE.Object3D>;
  private applyCharacterScale(model: THREE.Object3D, scale: number): void;
  private setupCharacterAnimations(model: THREE.Object3D, animations: any): void;
}
```

## 📁 **File Structure**
```
client/src/
├── core/
│   └── CharacterRegistry.ts     # Character configuration registry
├── entities/
│   ├── CharacterFactory.ts      # Universal character creation
│   └── CharacterConfig.ts       # Character configuration interfaces
├── config/
│   └── characters/
│       ├── index.ts             # Character registry initialization
│       ├── colobus.ts           # Colobus character config
│       ├── gecko.ts             # Gecko character config
│       ├── herring.ts           # Herring character config
│       ├── inkfish.ts           # Inkfish character config
│       ├── muskrat.ts           # Muskrat character config
│       ├── pudu.ts              # Pudu character config
│       ├── sparrow.ts           # Sparrow character config
│       └── taipan.ts            # Taipan character config
└── types/
    └── CharacterTypes.ts        # Character-related type definitions
```

## 🔧 **Implementation Plan**

### **Phase 1: Core Configuration System**
1. **Create CharacterConfig Interface**
   - Define all character properties
   - Add validation methods
   - Include animation mapping

2. **Implement CharacterRegistry**
   - Character registration system
   - Validation and lookup methods
   - Type-safe character access

3. **Create Default Character Configs**
   - Colobus configuration (monkey-like)
   - Gecko configuration (lizard-like)
   - Herring configuration (fish-like)
   - Inkfish configuration (squid-like)
   - Muskrat configuration (rodent-like)
   - Pudu configuration (deer-like)
   - Sparrow configuration (bird-like)
   - Taipan configuration (snake-like)

### **Phase 2: Universal Factory**
1. **Replace PlayerFactory with CharacterFactory**
   - Support any character type
   - Configurable model loading
   - Flexible animation setup

2. **Update Entity Creation**
   - Character type in NetworkComponent
   - Configurable component setup
   - Animation system integration

3. **Asset Management Integration**
   - Dynamic model loading
   - Character-specific scaling
   - Animation data extraction

### **Phase 3: Network Integration**
1. **Update NetworkComponent**
   - Add characterType field
   - Maintain backward compatibility
   - Character type synchronization

2. **Protocol Updates**
   - Character type in network messages
   - Animation data compression
   - Multi-character support

## 📈 **Success Criteria**

### **Configuration Flexibility**
- [ ] **8 Animal Types**: Colobus, Gecko, Herring, Inkfish, Muskrat, Pudu, Sparrow, Taipan
- [ ] **Configurable Properties**: Scale, animations, behaviors per animal
- [ ] **LOD Support**: LOD0-LOD3 model variants for performance
- [ ] **Blendshape Support**: 25+ eye expressions and emotional states
- [ ] **Validation System**: Automatic validation of character configs
- [ ] **Extensibility**: Easy addition of new animal types

### **Factory System**
- [ ] **Universal Creation**: Create any character type as player or NPC
- [ ] **Asset Loading**: Dynamic loading of different animal models
- [ ] **Scale Management**: Automatic scaling per character type
- [ ] **Animation Setup**: Configurable animation system per character

### **Network Compatibility**
- [ ] **Character Type Sync**: Character types synchronized across clients
- [ ] **Backward Compatibility**: Existing squirrel players continue working
- [ ] **Protocol Updates**: Network messages include character type
- [ ] **Performance**: No performance impact from character system

## 🧪 **Testing Strategy**

### **Unit Tests**
- **CharacterRegistry**: Test character registration and lookup
- **CharacterFactory**: Test character creation for different types
- **Configuration Validation**: Test character config validation
- **Asset Loading**: Test model loading for different characters

### **Integration Tests**
- **Player Creation**: Test player creation with different characters
- **NPC Creation**: Test NPC creation with different characters
- **Multiplayer Sync**: Test character type synchronization
- **Performance**: Test performance with multiple character types

### **Test Coverage Targets**
- **CharacterRegistry**: 95%+ coverage
- **CharacterFactory**: 95%+ coverage
- **Configuration System**: 90%+ coverage
- **Network Integration**: 85%+ coverage

## 🚀 **Next Steps**

### **Immediate**
1. Create CharacterConfig interface and types
2. Implement CharacterRegistry with basic functionality
3. Create default character configurations
4. Test with existing squirrel model

### **Short Term**
1. Implement CharacterFactory to replace PlayerFactory
2. Update NetworkComponent for character types
3. Add character validation system
4. Test multiplayer with different character types

### **Long Term**
1. Add more animal character configurations
2. Implement character-specific behaviors
3. Add character customization options
4. Performance optimization for multiple character types

## 📚 **Related Tasks**
- **Task 2**: Animated Model Integration - Uses character configs for model loading
- **Task 3**: Character Selection System - Uses character registry for available options
- **Task 4**: Player Animation System - Uses character configs for animation setup
- **Task 6**: NPC Character System - Uses character configs for NPC creation 