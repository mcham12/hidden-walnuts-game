# Task 2: Animated Model Integration

## 🎯 **Objective**
Implement universal animated model loading and management system that works with any GLB animated model, supporting the character configuration system and providing smooth animation playback.

## 📊 **Status**
- **Status**: 📋 **PENDING**
- **Priority**: 🔵 **HIGH** (Core animation functionality)
- **Dependencies**: Task 1 (Character Configuration System) 📋 **PENDING**
- **Estimated Time**: 1 week

## 🏗️ **Technical Requirements**

### **Enhanced Asset Manager**
```typescript
interface IAnimatedAssetManager extends IAssetManager {
  loadAnimatedModel(path: string): Promise<AnimatedModel>;
  loadCharacterModel(characterType: string): Promise<AnimatedModel>;
  loadLODModel(characterType: string, lodLevel: number): Promise<AnimatedModel>;
  getAnimationMixer(model: THREE.Object3D): THREE.AnimationMixer | null;
  extractAnimations(model: THREE.Object3D): Map<string, THREE.AnimationClip>;
  extractBlendshapes(model: THREE.Object3D): Map<string, THREE.MorphTarget>;
  validateAnimatedModel(model: THREE.Object3D): boolean;
}

interface AnimatedModel {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationClip>;
  blendshapes: Map<string, THREE.MorphTarget>;
  characterType: string;
  config: CharacterConfig;
  lodLevel: number;
}
```

### **Animation Controller System**
```typescript
class AnimationController {
  private mixer: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationAction>;
  private blendshapes: Map<string, THREE.MorphTarget>;
  private currentAnimation: string | null = null;
  private blendTime: number = 0.3;
  
  constructor(model: THREE.Object3D, characterConfig: CharacterConfig);
  
  // Core animation methods
  playAnimation(name: string, blendTime?: number): void;
  stopAnimation(): void;
  update(deltaTime: number): void;
  getCurrentAnimation(): string | null;
  isPlaying(): boolean;
  setBlendTime(time: number): void;
  
  // Blendshape methods
  setBlendshape(name: string, weight: number): void;
  getBlendshape(name: string): number;
  animateBlendshape(name: string, targetWeight: number, duration: number): void;
  resetBlendshapes(): void;
  
  // Animation categories
  playIdleAnimation(variation: 'a' | 'b' | 'c'): void;
  playMovementAnimation(type: 'walk' | 'run' | 'jump' | 'swim' | 'fly'): void;
  playActionAnimation(type: 'eat' | 'clicked' | 'fear' | 'death' | 'sit'): void;
  playTrickAnimation(type: 'roll' | 'bounce' | 'spin'): void;
}
```

### **Model Loading Pipeline**
```typescript
class AnimatedModelLoader {
  private cache = new Map<string, AnimatedModel>();
  
  async loadModel(path: string, characterType: string): Promise<AnimatedModel>;
  async loadLODModel(characterType: string, lodLevel: number): Promise<AnimatedModel>;
  private extractAnimationData(model: THREE.Object3D): Map<string, THREE.AnimationClip>;
  private extractBlendshapeData(model: THREE.Object3D): Map<string, THREE.MorphTarget>;
  private createAnimationMixer(model: THREE.Object3D): THREE.AnimationMixer;
  private validateModelStructure(model: THREE.Object3D): boolean;
  private applyCharacterScale(model: THREE.Object3D, scale: number): void;
  private setupBlendshapes(model: THREE.Object3D): Map<string, THREE.MorphTarget>;
}
```

## 📁 **File Structure**
```
client/src/
├── core/
│   ├── AnimatedAssetManager.ts   # Enhanced asset manager for animations
│   └── AnimationController.ts    # Animation state management
├── systems/
│   └── AnimationSystem.ts        # System for updating animations
├── entities/
│   └── AnimatedModelLoader.ts    # Specialized model loader
└── types/
    └── AnimationTypes.ts         # Animation-related type definitions
```

## 🔧 **Implementation Plan**

### **Phase 1: Enhanced Asset Management**
1. **Extend AssetManager**
   - Add animated model loading capabilities
   - Implement animation extraction
   - Add model validation

2. **Create Animation Controller**
   - Animation state management
   - Smooth transitions between animations
   - Performance optimization

3. **Model Loading Pipeline**
   - GLB animation extraction
   - Character-specific scaling
   - Animation data validation

### **Phase 2: Integration with Character System**
1. **Character Factory Integration**
   - Use character configs for model loading
   - Apply character-specific scaling
   - Setup animation controllers

2. **Animation Mapping**
   - Map character config animations to model animations
   - Handle missing animations gracefully
   - Support optional animations

3. **Performance Optimization**
   - Model caching system
   - Animation data compression
   - Memory management

### **Phase 3: Animation System**
1. **Animation System Component**
   - ECS integration for animations
   - Animation state synchronization
   - Performance monitoring

2. **Network Integration**
   - Animation state serialization
   - Compressed animation data
   - Real-time synchronization

## 📈 **Success Criteria**

### **Model Loading**
- [ ] **8 Animal Models**: Colobus, Gecko, Herring, Inkfish, Muskrat, Pudu, Sparrow, Taipan
- [ ] **LOD Support**: LOD0-LOD3 model variants for performance optimization
- [ ] **Animation Extraction**: Automatic extraction of 15+ animation clips
- [ ] **Blendshape Extraction**: Automatic extraction of 25+ eye expressions
- [ ] **Character Scaling**: Automatic scaling per character type
- [ ] **Validation**: Robust model validation and error handling

### **Animation System**
- [ ] **Core Animations**: Idle (3 variations), Walk, Run, Jump, Swim, Fly, Roll, Bounce, Spin
- [ ] **Action Animations**: Eat, Clicked, Fear, Death, Sit
- [ ] **Blendshape Animations**: 25+ eye expressions and emotional states
- [ ] **Smooth Transitions**: No visible animation popping
- [ ] **Performance**: 60 FPS animation updates
- [ ] **Memory Efficiency**: <50MB animation system overhead
- [ ] **Network Sync**: Animation states synchronized across clients

### **Character Integration**
- [ ] **Configurable Animations**: Animation names mapped from character configs
- [ ] **Flexible Scaling**: Different scales for different character types
- [ ] **Error Handling**: Graceful handling of missing animations
- [ ] **Backward Compatibility**: Existing squirrel model continues working

## 🧪 **Testing Strategy**

### **Unit Tests**
- **AnimatedAssetManager**: Test animated model loading
- **AnimationController**: Test animation state management
- **Model Validation**: Test model structure validation
- **Animation Extraction**: Test animation clip extraction

### **Integration Tests**
- **Character Integration**: Test with different character types
- **Performance Tests**: Test animation system performance
- **Memory Tests**: Test memory usage with multiple animated models
- **Network Tests**: Test animation synchronization

### **Test Coverage Targets**
- **AnimatedAssetManager**: 95%+ coverage
- **AnimationController**: 95%+ coverage
- **Model Loading**: 90%+ coverage
- **Animation System**: 85%+ coverage

## 🚀 **Next Steps**

### **Immediate**
1. Extend AssetManager for animated model support
2. Create AnimationController for state management
3. Implement model loading pipeline
4. Test with existing squirrel model

### **Short Term**
1. Integrate with CharacterFactory
2. Add animation mapping from character configs
3. Implement performance optimization
4. Add network synchronization

### **Long Term**
1. Add support for more animation types
2. Implement advanced animation blending
3. Add animation compression for network
4. Performance monitoring and optimization

## 📚 **Related Tasks**
- **Task 1**: Character Configuration System - Provides character configs for model loading
- **Task 3**: Character Selection System - Uses animated models for character preview
- **Task 4**: Player Animation System - Uses animation controllers for player animations
- **Task 5**: Animation Synchronization - Synchronizes animation states across network 