# Task 4: Player Animation System

## 🎯 **Objective**
Implement a comprehensive player animation system that manages local player animation states, handles input-driven animations, and provides smooth transitions between different animation states for any character type.

## 📊 **Status**
- **Status**: 📋 **PENDING**
- **Priority**: 🔵 **HIGH** (Core player experience)
- **Dependencies**: Task 1 (Character Configuration System) 📋 **PENDING**, Task 2 (Animated Model Integration) 📋 **PENDING**
- **Estimated Time**: 1 week

## 🏗️ **Technical Requirements**

### **Player Animation Controller**
```typescript
class PlayerAnimationController {
  private animationController: AnimationController;
  private characterConfig: CharacterConfig;
  private currentState: PlayerAnimationState;
  private inputState: InputComponent;
  
  constructor(characterConfig: CharacterConfig, model: THREE.Object3D);
  
  update(deltaTime: number, input: InputComponent): void;
  private determineAnimationState(input: InputComponent): PlayerAnimationState;
  private transitionToAnimation(state: PlayerAnimationState): void;
  private handleMovementAnimations(input: InputComponent): void;
  private handleIdleAnimations(): void;
  private handleActionAnimations(input: InputComponent): void;
  private handleBlendshapeAnimations(): void;
  private handleEmotionalStates(): void;
}

enum PlayerAnimationState {
  // Core movement states
  IDLE_A = 'idle_a',
  IDLE_B = 'idle_b', 
  IDLE_C = 'idle_c',
  WALK = 'walk',
  RUN = 'run',
  JUMP = 'jump',
  
  // Advanced movement states
  SWIM = 'swim',
  FLY = 'fly',
  ROLL = 'roll',
  BOUNCE = 'bounce',
  SPIN = 'spin',
  
  // Action states
  EAT = 'eat',
  CLICKED = 'clicked',
  FEAR = 'fear',
  DEATH = 'death',
  SIT = 'sit'
}
```

### **Animation State Machine**
```typescript
interface AnimationTransition {
  from: PlayerAnimationState;
  to: PlayerAnimationState;
  condition: (input: InputComponent) => boolean;
  blendTime: number;
}

class AnimationStateMachine {
  private currentState: PlayerAnimationState;
  private transitions: AnimationTransition[];
  private animationController: AnimationController;
  
  constructor(animationController: AnimationController);
  
  update(input: InputComponent): void;
  addTransition(transition: AnimationTransition): void;
  private evaluateTransitions(input: InputComponent): PlayerAnimationState | null;
  private transitionToState(state: PlayerAnimationState, blendTime: number): void;
}
```

### **Input-Driven Animation System**
```typescript
class InputAnimationSystem extends System {
  private playerAnimationControllers: Map<string, PlayerAnimationController>;
  
  update(deltaTime: number): void;
  private updatePlayerAnimations(entity: Entity, deltaTime: number): void;
  private handleInputChanges(entity: Entity, input: InputComponent): void;
  private syncAnimationState(entity: Entity): void;
}
```

## 📁 **File Structure**
```
client/src/
├── systems/
│   ├── PlayerAnimationSystem.ts     # Main player animation system
│   └── InputAnimationSystem.ts      # Input-driven animation updates
├── controllers/
│   ├── PlayerAnimationController.ts # Player-specific animation controller
│   └── AnimationStateMachine.ts    # Animation state management
├── types/
│   └── PlayerAnimationTypes.ts      # Player animation type definitions
└── components/
    └── AnimationComponent.ts        # ECS component for animations
```

## 🔧 **Implementation Plan**

### **Phase 1: Core Animation System**
1. **Player Animation Controller**
   - Character-specific animation management
   - Input state processing
   - Animation state transitions

2. **Animation State Machine**
   - State transition logic
   - Condition evaluation
   - Smooth blending between states

3. **ECS Integration**
   - Animation component system
   - System-based animation updates
   - Entity-animation mapping

### **Phase 2: Input Integration**
1. **Input Processing**
   - WASD movement animations (walk, run, jump)
   - Advanced movement animations (swim, fly, roll, bounce, spin)
   - Action animations (eat, clicked, fear, death, sit)
   - Idle variations (idle_a, idle_b, idle_c)
   - Blendshape animations (25+ eye expressions)

2. **Animation Mapping**
   - Character config animation mapping
   - Fallback animation handling
   - Performance optimization

3. **State Synchronization**
   - Animation state persistence
   - Network state preparation
   - Performance monitoring

### **Phase 3: Advanced Features**
1. **Animation Blending**
   - Smooth transitions between animations
   - Configurable blend times
   - Performance optimization

2. **Character-Specific Animations**
   - Different animation sets per character
   - Character-specific movement styles
   - Custom animation behaviors

## 📈 **Success Criteria**

### **Animation Quality**
- [ ] **Smooth Transitions**: No visible animation popping
- [ ] **Responsive Input**: Animations respond immediately to input
- [ ] **Character Variety**: Different characters have distinct animation styles
- [ ] **Performance**: 60 FPS animation updates maintained

### **Input Integration**
- [ ] **Movement Animations**: Walk, run, jump animations based on movement
- [ ] **Advanced Movement**: Swim, fly, roll, bounce, spin animations
- [ ] **Action Animations**: Eat, clicked, fear, death, sit animations for actions
- [ ] **Idle Variations**: Natural idle animation variations (A, B, C)
- [ ] **Blendshape Animations**: 25+ eye expressions and emotional states
- [ ] **State Persistence**: Animation states persist across frames

### **Character Support**
- [ ] **Any Character Type**: Works with any configured character
- [ ] **Configurable Animations**: Animation names from character configs
- [ ] **Fallback Handling**: Graceful handling of missing animations
- [ ] **Performance**: No performance impact from character variety

## 🧪 **Testing Strategy**

### **Unit Tests**
- **PlayerAnimationController**: Test animation state management
- **AnimationStateMachine**: Test state transitions
- **InputAnimationSystem**: Test input-driven animations
- **Animation Blending**: Test smooth transitions

### **Integration Tests**
- **Character Integration**: Test with different character types
- **Input Integration**: Test with movement and action inputs
- **Performance Tests**: Test animation system performance
- **Multiplayer Sync**: Test animation state preparation

### **Test Coverage Targets**
- **PlayerAnimationController**: 95%+ coverage
- **AnimationStateMachine**: 95%+ coverage
- **InputAnimationSystem**: 90%+ coverage
- **Animation Blending**: 85%+ coverage

## 🚀 **Next Steps**

### **Immediate**
1. Create PlayerAnimationController
2. Implement AnimationStateMachine
3. Integrate with existing input system
4. Test with squirrel character

### **Short Term**
1. Add character-specific animation mapping
2. Implement smooth animation blending
3. Add performance monitoring
4. Prepare for network synchronization

### **Long Term**
1. Add advanced animation features
2. Implement character-specific behaviors
3. Add animation customization options
4. Performance optimization

## 📚 **Related Tasks**
- **Task 1**: Character Configuration System - Provides character configs for animations
- **Task 2**: Animated Model Integration - Provides animation controllers
- **Task 3**: Character Selection System - Determines which character to animate
- **Task 5**: Animation Synchronization - Synchronizes animation states across network 

## 📝 As Implemented

- The system uses `PlayerAnimationTypes.ts` for all player animation enums and interfaces, ensuring type safety and extensibility.
- `InputAnimationSystem` and `AnimationSystem` are both registered in the ECS and dependency injection container, and are included in the ECS execution order.
- Each player entity can have its own `PlayerAnimationController` instance, supporting per-entity animation state and transitions.
- The file structure, class names, and method signatures match this documentation. 