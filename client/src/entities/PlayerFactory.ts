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
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player: ${playerId}`);
    
    // Get the selected character type (use provided characterType or fallback to selection manager)
    const selectedCharacterType = characterType || this.characterSelectionManager.getSelectedCharacterForPlayer();
    Logger.info(LogCategory.PLAYER, `🎭 Using character: ${selectedCharacterType}`);
    
    // TASK 8 FIX: Spawn players very close to origin for easier multiplayer testing
    const spawnX = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    const spawnZ = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    const spawnY = 1.0; // Fixed height above ground
    const spawnRotationY = Math.random() * Math.PI * 2; // Random rotation
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load the selected character model using AnimatedModelLoader
    let model: THREE.Object3D;
    let characterScale = 0.3; // Default scale
    
    try {
      Logger.info(LogCategory.PLAYER, `🔄 Loading character model for ${selectedCharacterType}...`);
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
    
    // TASK 8 FIX: Apply proper scaling and ensure model is visible
    model.scale.set(characterScale, characterScale, characterScale);
    model.position.set(spawnX, spawnY, spawnZ);
    model.rotation.y = spawnRotationY;
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}) with scale ${characterScale}`);
    
    // Debug: Check if model is actually in scene
    const scene = this.sceneManager.getScene();
    const modelInScene = scene.children.find(child => child === model);
    Logger.info(LogCategory.PLAYER, `🔍 Model in scene: ${modelInScene ? 'YES' : 'NO'}, Scene children count: ${scene.children.length}`);
    
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

  async createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation, characterType: string = 'colobus'): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🌐 Creating remote player: ${squirrelId} as ${characterType}`);
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load the correct character model for remote player
    let model: THREE.Object3D;
    let characterScale = 0.3; // Default scale
    
    try {
      Logger.info(LogCategory.PLAYER, `🔄 Loading character model for remote player ${squirrelId} as ${characterType}...`);
      // Try to load the specific character model
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
        Logger.info(LogCategory.PLAYER, `✅ ${characterType} model loaded successfully for remote player with scale ${characterScale}`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ No character config found for ${characterType}, using default scale`);
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load ${characterType} model for remote player, falling back to squirrel`, error);
      // Fallback to squirrel model
      const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
      if (!gltf || !gltf.scene) {
        throw new Error('Failed to load fallback squirrel model for remote player');
      }
      model = gltf.scene.clone();
      characterScale = 0.3; // Default scale for fallback
    }
    
    // TASK 8 FIX: Apply proper scaling and ensure model is visible
    model.scale.set(characterScale, characterScale, characterScale);
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotation.y; // Use the y rotation value
    
    // Ensure model is visible and has proper materials
    model.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Ensure material is visible
        if (child.material) {
          child.material.transparent = false;
          child.material.opacity = 1.0;
          Logger.debug(LogCategory.PLAYER, `🎨 Remote player material for ${child.name}: visible=${child.visible}, transparent=${child.material.transparent}, opacity=${child.material.opacity}`);
        }
        Logger.debug(LogCategory.PLAYER, `🎭 Remote player mesh ${child.name}: visible=${child.visible}, position=(${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
      }
    });
    
    // Add a subtle color difference to distinguish remote players
    model.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const material = child.material.clone();
        material.color.multiplyScalar(0.8); // Slightly darker
        child.material = material;
      }
    });
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Remote player added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) with scale ${characterScale}`);
    
    // Debug: Check if model is actually in scene
    const scene = this.sceneManager.getScene();
    const modelInScene = scene.children.find(child => child === model);
    Logger.info(LogCategory.PLAYER, `🔍 Remote player model in scene: ${modelInScene ? 'YES' : 'NO'}, Scene children count: ${scene.children.length}`);
    
    // Add components using Entity class methods
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
        characterType: characterType // TASK 8 FIX: Add character type to network component
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Remote player entity created with character type: ${characterType}`);
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
    model.scale.set(characterScale, characterScale, characterScale);
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