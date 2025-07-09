// Player Entity Factory - Clean entity creation with all components

import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent, AnimationComponent, InputAnimationComponent } from '../ecs';
import { Vector3, Rotation } from '../core/types';
import { ISceneManager, IAssetManager } from '../GameComposition';
import { Logger, LogCategory } from '../core/Logger';
import { CharacterSelectionManager } from '../core/CharacterSelectionManager';
import { AnimatedModelLoader } from './AnimatedModelLoader';
import * as THREE from 'three';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { EventBus } from '../core/EventBus';

export class PlayerFactory {
  constructor(
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,
    private entityManager: import('../ecs').EntityManager,
    private characterRegistry: CharacterRegistry,
    private animatedModelLoader: AnimatedModelLoader,
    private characterSelectionManager: CharacterSelectionManager
  ) {}

  async createLocalPlayer(playerId: string, characterType?: string): Promise<Entity> {
    Logger.warn(LogCategory.PLAYER, `🐿️ Creating local player: ${playerId}`);
    
    // Get the selected character type (use provided characterType or fallback to selection manager)
    const selectedCharacterType = characterType || this.characterSelectionManager.getSelectedCharacterForPlayer();
    Logger.warn(LogCategory.PLAYER, `🎭 Using character: ${selectedCharacterType}`);
    
    // TASK 8 FIX: Spawn players very close to origin for easier multiplayer testing
    const spawnX = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    const spawnZ = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    
    // Get proper terrain height for spawn position
    let spawnY = 1.0; // Default fallback height
    try {
      const { container, ServiceTokens } = await import('../core/Container');
      const terrainService = container.resolve(ServiceTokens.TERRAIN_SERVICE) as any;
      if (terrainService) {
        const terrainHeight = await terrainService.getTerrainHeight(spawnX, spawnZ);
        spawnY = terrainHeight + 0.2; // Spawn slightly above terrain surface
        Logger.warn(LogCategory.PLAYER, `📍 Terrain height at spawn: ${terrainHeight.toFixed(2)}, spawn Y: ${spawnY.toFixed(2)}`);
      }
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Could not get terrain height, using default Y=${spawnY}`, error);
    }
    
    const spawnRotationY = Math.random() * Math.PI * 2; // Random rotation
    
    Logger.warn(LogCategory.PLAYER, `📍 Spawn position: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    Logger.warn(LogCategory.PLAYER, `✅ Entity created with ID: ${entity.id.value}`);
    
    // Load the selected character model using AnimatedModelLoader
    let model: THREE.Object3D;
    let characterScale = 0.3; // Default scale
    
    try {
      Logger.warn(LogCategory.PLAYER, `🔄 Loading character model for ${selectedCharacterType}...`);
      const animatedModel = await this.animatedModelLoader.loadCharacterModel(selectedCharacterType, {
        lodLevel: 0,
        enableCaching: true,
        validateModel: true
      });
      model = animatedModel.model;
      
      // Get character config for proper scaling
      const characterConfig = this.characterRegistry.getCharacter(selectedCharacterType);
      if (characterConfig) {
        characterScale = characterConfig.scale;
        Logger.warn(LogCategory.PLAYER, `✅ ${selectedCharacterType} model loaded successfully with scale ${characterScale}`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for ${selectedCharacterType}, using default scale`);
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load ${selectedCharacterType} model, falling back to squirrel`, error);
      // Fallback to squirrel model
      const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
      if (!gltf || !gltf.scene) {
        throw new Error('Failed to load fallback squirrel model');
      }
      model = gltf.scene.clone();
      characterScale = 0.3; // Default scale for fallback
    }
    
    // TASK 8 FIX: Apply proper scaling and ensure model is visible
    // Scale is already applied by AnimatedModelLoader, just validate it
    const actualScale = model.scale;
    if (Math.abs(actualScale.x - characterScale) > 0.01 || 
        Math.abs(actualScale.y - characterScale) > 0.01 || 
        Math.abs(actualScale.z - characterScale) > 0.01) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Model scale mismatch for ${selectedCharacterType}: expected=${characterScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
      // Force correct scale
      model.scale.set(characterScale, characterScale, characterScale);
    } else {
      Logger.warn(LogCategory.PLAYER, `✅ Model scale validated for ${selectedCharacterType}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
    }
    
    model.position.set(spawnX, spawnY, spawnZ);
    model.rotation.y = spawnRotationY;
    
    Logger.warn(LogCategory.PLAYER, `🎨 Model prepared: scale=${characterScale}, position=(${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    // Add to scene
    const scene = this.sceneManager.getScene();
    Logger.warn(LogCategory.PLAYER, `🎭 Adding model to scene...`);
    scene.add(model);
    Logger.warn(LogCategory.PLAYER, `✅ Local player added to scene at position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}) with scale ${characterScale}`);
    
    // Debug: Check if model is actually in scene
    const modelInScene = scene.children.find(child => child === model);
    Logger.warn(LogCategory.PLAYER, `🔍 Model in scene: ${modelInScene ? 'YES' : 'NO'}, Scene children count: ${scene.children.length}`);
    
    // Create animation controllers
    const characterConfig = this.characterRegistry.getCharacter(selectedCharacterType);
    let animationController: any = null;
    let playerAnimationController: any = null;
    
    Logger.warn(LogCategory.PLAYER, `🎭 Creating animation controllers for ${selectedCharacterType}...`);
    
    if (characterConfig) {
      try {
        // Create animation controller
        Logger.warn(LogCategory.PLAYER, `🔄 Creating AnimationController...`);
        const { AnimationController } = await import('../core/AnimationController');
        animationController = new AnimationController(model, characterConfig, playerId);
        Logger.warn(LogCategory.PLAYER, `✅ AnimationController created successfully`);
        
        // Create player animation controller
        Logger.warn(LogCategory.PLAYER, `🔄 Creating PlayerAnimationController...`);
        const { PlayerAnimationController } = await import('../controllers/PlayerAnimationController');
        const { container, ServiceTokens } = await import('../core/Container');
        const eventBus = container.resolve(ServiceTokens.EVENT_BUS) as EventBus;
        playerAnimationController = new PlayerAnimationController(characterConfig, model, playerId, eventBus);
        Logger.warn(LogCategory.PLAYER, `✅ PlayerAnimationController created successfully`);
        
        // Register with animation system
        Logger.warn(LogCategory.PLAYER, `🔄 Registering with animation system...`);
        const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
        if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
          animationSystem.addAnimationComponent(playerId, animationController, 8); // High priority for local player
          Logger.warn(LogCategory.PLAYER, `✅ Animation controller registered with system`);
        } else {
          Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available or missing addAnimationComponent method`);
          Logger.warn(LogCategory.PLAYER, `⚠️ Animation system type: ${typeof animationSystem}, methods: ${animationSystem ? Object.getOwnPropertyNames(animationSystem) : 'null'}`);
        }
        
        // Register with input animation system
        Logger.warn(LogCategory.PLAYER, `🔄 Registering with input animation system...`);
        const inputAnimationSystem = container.resolve(ServiceTokens.INPUT_ANIMATION_SYSTEM) as any;
        if (inputAnimationSystem && typeof inputAnimationSystem.addPlayerAnimationController === 'function') {
          inputAnimationSystem.addPlayerAnimationController(playerId, playerAnimationController, 8); // High priority for local player
          Logger.warn(LogCategory.PLAYER, `✅ Player animation controller registered with input system`);
        } else {
          Logger.warn(LogCategory.PLAYER, `⚠️ Input animation system not available or missing addPlayerAnimationController method`);
          Logger.warn(LogCategory.PLAYER, `⚠️ Input animation system type: ${typeof inputAnimationSystem}, methods: ${inputAnimationSystem ? Object.getOwnPropertyNames(inputAnimationSystem) : 'null'}`);
        }
        
        Logger.warn(LogCategory.PLAYER, `✅ Animation controllers created for ${selectedCharacterType}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create animation controllers for ${selectedCharacterType}`, error);
      }
    } else {
      Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for ${selectedCharacterType}, skipping animation controllers`);
    }
    
    // Add all required components using the Entity class methods
    Logger.warn(LogCategory.PLAYER, `🔧 Adding components to entity...`);
    
    entity
      .addComponent<PositionComponent>({
        type: 'position',
        value: new Vector3(spawnX, spawnY, spawnZ)
      })
      .addComponent<RotationComponent>({
        type: 'rotation',
        value: Rotation.fromRadians(spawnRotationY)
      })
      .addComponent<RenderComponent>({
        type: 'render',
        mesh: model,
        visible: true
      })
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: true,
        squirrelId: playerId,
        lastUpdate: performance.now(),
        characterType: selectedCharacterType
      })
      .addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      });
    
    Logger.warn(LogCategory.PLAYER, `✅ Basic components added to entity`);
    
    // Add animation components if controllers were created successfully
    if (animationController) {
      entity.addComponent<AnimationComponent>({
        type: 'animation',
        controller: animationController,
        isActive: true,
        lastUpdateTime: 0,
        updateInterval: 16,
        priority: 8
      });
      Logger.warn(LogCategory.PLAYER, `✅ Animation component added`);
    }
    
    if (playerAnimationController) {
      entity.addComponent<InputAnimationComponent>({
        type: 'input_animation',
        controller: playerAnimationController,
        isActive: true,
        lastUpdateTime: 0,
        updateInterval: 16,
        priority: 8
      });
      Logger.warn(LogCategory.PLAYER, `✅ Input animation component added`);
    }
    
    // Verify entity has all required components
    const components = entity.getComponents();
    Logger.warn(LogCategory.PLAYER, `📊 Entity components: ${components.map(c => c.type).join(', ')}`);
    
    // Verify render component
    const renderComponent = entity.getComponent<RenderComponent>('render');
    if (renderComponent) {
      Logger.warn(LogCategory.PLAYER, `🎨 Render component: mesh=${!!renderComponent.mesh}, visible=${renderComponent.visible}`);
      if (renderComponent.mesh) {
        Logger.warn(LogCategory.PLAYER, `📍 Mesh position: (${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)})`);
        Logger.warn(LogCategory.PLAYER, `🎭 Mesh visible: ${renderComponent.mesh.visible}`);
      }
    } else {
      Logger.error(LogCategory.PLAYER, `❌ No render component found on entity!`);
    }
    
    Logger.warn(LogCategory.PLAYER, `✅ Local player entity created with character type: ${selectedCharacterType}`);
    return entity;
  }

  async createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation, characterType: string = 'colobus'): Promise<Entity> {
    Logger.warn(LogCategory.PLAYER, `🌐 Creating remote player: ${squirrelId} with character: ${characterType}`);
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    Logger.warn(LogCategory.PLAYER, `✅ Remote entity created with ID: ${entity.id.value}`);
    
    // Load the character model using AnimatedModelLoader
    let model: THREE.Object3D;
    let characterScale = 0.3; // Default scale
    
    try {
      Logger.warn(LogCategory.PLAYER, `🔄 Loading remote character model for ${characterType}...`);
      const animatedModel = await this.animatedModelLoader.loadCharacterModel(characterType, {
        lodLevel: 0,
        enableCaching: true,
        validateModel: true
      });
      model = animatedModel.model;
      
      // Get character config for proper scaling
      const characterConfig = this.characterRegistry.getCharacter(characterType);
      if (characterConfig) {
        characterScale = characterConfig.scale;
        Logger.warn(LogCategory.PLAYER, `✅ ${characterType} remote model loaded successfully with scale ${characterScale}`);
        
        // Validate that the model was scaled correctly by AnimatedModelLoader
        const actualScale = model.scale;
        if (Math.abs(actualScale.x - characterScale) > 0.01 || 
            Math.abs(actualScale.y - characterScale) > 0.01 || 
            Math.abs(actualScale.z - characterScale) > 0.01) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Model scale mismatch for ${characterType}: expected=${characterScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
          // Force correct scale
          model.scale.set(characterScale, characterScale, characterScale);
        } else {
          Logger.warn(LogCategory.PLAYER, `✅ Model scale validated for ${characterType}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
        }
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for ${characterType}, using default scale`);
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load ${characterType} remote model, falling back to squirrel`, error);
      Logger.error(LogCategory.PLAYER, `🔍 Error details:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        characterType,
        squirrelId
      });
      
      // Fallback to squirrel model
      try {
        const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
        if (!gltf || !gltf.scene) {
          throw new Error('Failed to load fallback squirrel model for remote player');
        }
        model = gltf.scene.clone();
        characterScale = 0.3; // Default scale for fallback
        Logger.warn(LogCategory.PLAYER, `✅ Fallback squirrel model loaded for ${squirrelId}`);
      } catch (fallbackError) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to load fallback squirrel model for ${squirrelId}`, fallbackError);
        throw new Error(`Failed to load any model for remote player ${squirrelId}`);
      }
    }
    
    // Apply positioning (scale is already applied by AnimatedModelLoader)
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotation.y;
    
    // Add to scene
    const scene = this.sceneManager.getScene();
    scene.add(model);
    Logger.warn(LogCategory.PLAYER, `✅ Remote player added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) with scale ${characterScale}`);
    
    // Create animation controllers for remote player
    const characterConfig = this.characterRegistry.getCharacter(characterType);
    let animationController: any = null;
    
    if (characterConfig) {
      try {
        Logger.warn(LogCategory.PLAYER, `🔄 Creating remote AnimationController for ${characterType}...`);
        const { AnimationController } = await import('../core/AnimationController');
        animationController = new AnimationController(model, characterConfig, squirrelId);
        Logger.warn(LogCategory.PLAYER, `✅ Remote AnimationController created successfully`);
        
        // Register with animation system
        Logger.warn(LogCategory.PLAYER, `🔄 Registering remote animation controller with system...`);
        const { container, ServiceTokens } = await import('../core/Container');
        const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
        if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
          animationSystem.addAnimationComponent(squirrelId, animationController, 4); // Lower priority for remote players
          Logger.warn(LogCategory.PLAYER, `✅ Remote animation controller registered with system`);
        } else {
          Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available for remote player`);
        }
        
        Logger.warn(LogCategory.PLAYER, `✅ Remote animation controllers created for ${characterType}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create remote animation controllers for ${characterType}`, error);
      }
    } else {
      Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for remote ${characterType}, skipping animation controllers`);
    }
    
    // Add all required components using the Entity class methods
    Logger.warn(LogCategory.PLAYER, `🔧 Adding components to remote entity...`);
    
    entity
      .addComponent<PositionComponent>({
        type: 'position',
        value: position
      })
      .addComponent<RotationComponent>({
        type: 'rotation',
        value: rotation
      })
      .addComponent<RenderComponent>({
        type: 'render',
        mesh: model,
        visible: true
      })
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: false,
        squirrelId: squirrelId,
        lastUpdate: performance.now(),
        characterType: characterType
      });
    
    Logger.warn(LogCategory.PLAYER, `✅ Basic components added to remote entity`);
    
    // Add animation component if controller was created successfully
    if (animationController) {
      entity.addComponent<AnimationComponent>({
        type: 'animation',
        controller: animationController,
        isActive: true,
        lastUpdateTime: 0,
        updateInterval: 16,
        priority: 4
      });
      Logger.warn(LogCategory.PLAYER, `✅ Remote animation component added`);
    }
    
    // Verify entity has all required components
    const components = entity.getComponents();
    Logger.warn(LogCategory.PLAYER, `📊 Remote entity components: ${components.map(c => c.type).join(', ')}`);
    
    // Verify render component
    const renderComponent = entity.getComponent<RenderComponent>('render');
    if (renderComponent) {
      Logger.warn(LogCategory.PLAYER, `✅ Remote render component verified: mesh=${renderComponent.mesh ? 'YES' : 'NO'}, visible=${renderComponent.visible}`);
    } else {
      Logger.error(LogCategory.PLAYER, `❌ Remote entity missing render component!`);
    }
    
    Logger.warn(LogCategory.PLAYER, `✅ Remote player ${squirrelId} created successfully with character: ${characterType}`);
    return entity;
  }

  async createLocalPlayerWithPosition(playerId: string, savedPosition: { x: number; y: number; z: number }, savedRotationY: number, characterType?: string): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player with saved position: ${playerId}`);
    Logger.info(LogCategory.PLAYER, `📍 Using saved position: (${savedPosition.x.toFixed(1)}, ${savedPosition.y.toFixed(1)}, ${savedPosition.z.toFixed(1)})`);
    
    // Get the selected character type (use provided characterType or fallback to selection manager)
    const selectedCharacterType = characterType || this.characterSelectionManager.getSelectedCharacterForPlayer();
    Logger.info(LogCategory.PLAYER, `🎭 Using character: ${selectedCharacterType}`);
    
    // Use saved position instead of random spawn
    const spawnX = savedPosition.x;
    const spawnY = savedPosition.y;
    const spawnZ = savedPosition.z;
    const spawnRotationY = savedRotationY;
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load the selected character model using AnimatedModelLoader
    let model: THREE.Object3D;
    let characterScale = 0.3; // Default scale
    
    try {
      const animatedModel = await this.animatedModelLoader.loadCharacterModel(selectedCharacterType, {
        lodLevel: 0,
        enableCaching: true,
        validateModel: true
      });
      model = animatedModel.model;
      
      // Get character config for proper scaling
      const characterConfig = this.characterRegistry.getCharacter(selectedCharacterType);
      if (characterConfig) {
        characterScale = characterConfig.scale;
        Logger.info(LogCategory.PLAYER, `✅ ${selectedCharacterType} model loaded successfully with scale ${characterScale}`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for ${selectedCharacterType}, using default scale`);
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load ${selectedCharacterType} model, falling back to squirrel`, error);
      // Fallback to squirrel model
      const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
      if (!gltf || !gltf.scene) {
        throw new Error('Failed to load fallback squirrel model');
      }
      model = gltf.scene.clone();
      characterScale = 0.3; // Default scale for fallback
    }
    
    // Apply proper scaling and positioning
    // Scale is already applied by AnimatedModelLoader, just validate it
    const actualScale = model.scale;
    if (Math.abs(actualScale.x - characterScale) > 0.01 || 
        Math.abs(actualScale.y - characterScale) > 0.01 || 
        Math.abs(actualScale.z - characterScale) > 0.01) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Model scale mismatch for ${selectedCharacterType}: expected=${characterScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
      // Force correct scale
      model.scale.set(characterScale, characterScale, characterScale);
    } else {
      Logger.info(LogCategory.PLAYER, `✅ Model scale validated for ${selectedCharacterType}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
    }
    
    model.position.set(spawnX, spawnY, spawnZ);
    model.rotation.y = spawnRotationY;
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at SAVED position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}) with scale ${characterScale}`);
    
    // Create animation controllers
    const characterConfig = this.characterRegistry.getCharacter(selectedCharacterType);
    let animationController: any = null;
    let playerAnimationController: any = null;
    
    if (characterConfig) {
      try {
        // Create animation controller
        const { AnimationController } = await import('../core/AnimationController');
        animationController = new AnimationController(model, characterConfig, playerId);
        
        // Create player animation controller
        const { PlayerAnimationController } = await import('../controllers/PlayerAnimationController');
        const { container, ServiceTokens } = await import('../core/Container');
        const eventBus = container.resolve(ServiceTokens.EVENT_BUS) as EventBus;
        playerAnimationController = new PlayerAnimationController(characterConfig, model, playerId, eventBus);
        
        // Register with animation system
        const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
        if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
          animationSystem.addAnimationComponent(playerId, animationController, 8); // High priority for local player
          Logger.info(LogCategory.PLAYER, `✅ Animation controller registered with system`);
        } else {
          Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available`);
        }
        
        // Register with input animation system
        const inputAnimationSystem = container.resolve(ServiceTokens.INPUT_ANIMATION_SYSTEM) as any;
        if (inputAnimationSystem && typeof inputAnimationSystem.addPlayerAnimationController === 'function') {
          inputAnimationSystem.addPlayerAnimationController(playerId, playerAnimationController, 8); // High priority for local player
          Logger.info(LogCategory.PLAYER, `✅ Player animation controller registered with input system`);
        } else {
          Logger.warn(LogCategory.PLAYER, `⚠️ Input animation system not available`);
        }
        
        Logger.info(LogCategory.PLAYER, `✅ Animation controllers created for ${selectedCharacterType}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create animation controllers for ${selectedCharacterType}`, error);
      }
    }
    
    // Add all required components using the Entity class methods
    entity
      .addComponent<PositionComponent>({
        type: 'position',
        value: new Vector3(spawnX, spawnY, spawnZ)
      })
      .addComponent<RotationComponent>({
        type: 'rotation',
        value: Rotation.fromRadians(spawnRotationY)
      })
      .addComponent<RenderComponent>({
        type: 'render',
        mesh: model,
        visible: true
      })
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: true,
        squirrelId: playerId,
        lastUpdate: performance.now(),
        characterType: selectedCharacterType // TASK 8 FIX: Add character type to network component
      })
      .addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      });
    
    // Add animation components if controllers were created successfully
    if (animationController) {
      entity.addComponent<AnimationComponent>({
        type: 'animation',
        controller: animationController,
        isActive: true,
        lastUpdateTime: 0,
        updateInterval: 16,
        priority: 8
      });
    }
    
    if (playerAnimationController) {
      entity.addComponent<InputAnimationComponent>({
        type: 'input_animation',
        controller: playerAnimationController,
        isActive: true,
        lastUpdateTime: 0,
        updateInterval: 16,
        priority: 8
      });
    }
    
    Logger.info(LogCategory.PLAYER, `✅ Local player entity created with character type: ${selectedCharacterType}`);
    return entity;
  }
}