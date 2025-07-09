import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent, AnimationComponent, InputAnimationComponent } from '../ecs';
import { Vector3, Rotation } from '../core/types';
import { ISceneManager, IAssetManager } from '../GameComposition';
import { ITerrainService } from '../services/TerrainService';
import { Logger, LogCategory } from '../core/Logger';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { CharacterConfig, CharacterInstance } from '../types/CharacterTypes';
import { AnimationController } from '../core/AnimationController';
import { container, ServiceTokens } from '../core/Container';
import * as THREE from 'three';
import { PlayerAnimationController } from '../controllers/PlayerAnimationController';

/**
 * Universal Character Factory
 * Creates any animal character type as either players or NPCs
 */
export class CharacterFactory {
  private characterInstances = new Map<string, CharacterInstance>();
  
  constructor(
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,
    private entityManager: import('../ecs').EntityManager,
    private terrainService: ITerrainService,
    private characterRegistry: CharacterRegistry
  ) {}

  /**
   * Create a local player character
   */
  async createLocalPlayer(playerId: string, characterType: string = 'colobus'): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🎮 Creating local player: ${playerId} as ${characterType}`);
    
    try {
      const config = this.characterRegistry.getCharacter(characterType);
      if (!config) {
        Logger.error(LogCategory.PLAYER, `❌ Unknown character type: ${characterType}`);
        throw new Error(`Unknown character type: ${characterType}`);
      }
      
      Logger.info(LogCategory.PLAYER, `🎨 Character config found for ${characterType}, creating entity...`);
      
      // Create entity first
      const entity = this.entityManager.createEntity();
      Logger.info(LogCategory.PLAYER, `🏗️ Entity created with ID: ${entity.id.value}`);
      
      // Get spawn position from terrain service
      const spawnX = Math.random() * 100;
      const spawnZ = Math.random() * 100;
      const spawnY = await this.terrainService.getTerrainHeight(spawnX, spawnZ) + 2; // Spawn 2 units above terrain
      
      Logger.info(LogCategory.PLAYER, `📍 Spawn position calculated: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
      
      // Load character model and setup
      Logger.info(LogCategory.PLAYER, `🎭 Creating character instance for ${playerId}...`);
      const characterInstance = await this.createCharacterInstance(
        playerId,
        characterType,
        config,
        new Vector3(spawnX, spawnY, spawnZ),
        Rotation.fromRadians(0)
      );
      Logger.info(LogCategory.PLAYER, `✅ Character instance created for ${playerId}`);
      
      // Add model to scene
      this.sceneManager.getScene().add(characterInstance.model);
      Logger.info(LogCategory.PLAYER, `✅ Character model added to scene`);
      
      // Create animation controller
      const animationController = new AnimationController(
        characterInstance.model,
        config,
        playerId
      );
      
      // Re-initialize animations after they're loaded from separate files
      animationController.reinitializeAnimations();
      
      // Create player animation controller for input-driven animations
      const playerAnimationController = new PlayerAnimationController(
        config,
        characterInstance.model,
        playerId,
        container.resolve(ServiceTokens.EVENT_BUS)
      );
      
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
    
      // Add all required components using the Entity class methods
      entity
        .addComponent<PositionComponent>({
          type: 'position',
          value: new Vector3(spawnX, spawnY, spawnZ)
        })
        .addComponent<RotationComponent>({
          type: 'rotation',
          value: Rotation.fromRadians(0)
        })
        .addComponent<RenderComponent>({
          type: 'render',
          mesh: characterInstance.model,
          visible: true
        })
        .addComponent<NetworkComponent>({
          type: 'network',
          isLocalPlayer: true,
          squirrelId: playerId,
          lastUpdate: performance.now(),
          characterType: characterType // Add character type to network component
        })
        .addComponent<InputComponent>({
          type: 'input',
          forward: false,
          backward: false,
          turnLeft: false,
          turnRight: false
        })
        .addComponent<AnimationComponent>({
          type: 'animation',
          controller: animationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 8
        })
        .addComponent<InputAnimationComponent>({
          type: 'input_animation',
          controller: playerAnimationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 8
        });
      
      // Store character instance
      this.characterInstances.set(playerId, characterInstance);
      
      Logger.info(LogCategory.PLAYER, `✅ Local player entity created with ${entity.getComponents().length} components`);
      Logger.info(LogCategory.PLAYER, `🎮 WASD controls should now work for local ${characterType} player!`);
      return entity;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create local player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a remote player character
   */
  async createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation, characterType: string = 'colobus'): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🌐 Creating remote player: ${squirrelId} as ${characterType}`);
    
    try {
      const config = this.characterRegistry.getCharacter(characterType);
      if (!config) {
        Logger.error(LogCategory.PLAYER, `❌ Unknown character type: ${characterType}`);
        throw new Error(`Unknown character type: ${characterType}`);
      }
      
      Logger.info(LogCategory.PLAYER, `🎨 Character config found for ${characterType}, creating entity...`);
      
      // Create entity first
      const entity = this.entityManager.createEntity();
      Logger.info(LogCategory.PLAYER, `🏗️ Entity created with ID: ${entity.id.value}`);
      
      // Load character model and setup
      Logger.info(LogCategory.PLAYER, `🎭 Creating character instance for ${squirrelId}...`);
      const characterInstance = await this.createCharacterInstance(
        squirrelId,
        characterType,
        config,
        position,
        rotation
      );
      Logger.info(LogCategory.PLAYER, `✅ Character instance created for ${squirrelId}`);
    
      // Add a subtle color difference to distinguish remote players
      characterInstance.model.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const material = child.material.clone();
          material.color.multiplyScalar(0.8); // Slightly darker
          child.material = material;
        }
      });
      
      // Add to scene
      this.sceneManager.getScene().add(characterInstance.model);
      Logger.info(LogCategory.PLAYER, `✅ Remote player added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
      
      // Create animation controller
      const animationController = new AnimationController(
        characterInstance.model,
        config,
        squirrelId
      );
      
      // Re-initialize animations after they're loaded from separate files
      animationController.reinitializeAnimations();
      
      // Create player animation controller for input-driven animations
      const playerAnimationController = new PlayerAnimationController(
        config,
        characterInstance.model,
        squirrelId,
        container.resolve(ServiceTokens.EVENT_BUS)
      );
      
      // Register with animation system
      const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
      if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
        animationSystem.addAnimationComponent(squirrelId, animationController, 5); // Medium priority for remote players
        Logger.info(LogCategory.PLAYER, `✅ Animation controller registered with system`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available`);
      }
      
      // Register with input animation system
      const inputAnimationSystem = container.resolve(ServiceTokens.INPUT_ANIMATION_SYSTEM) as any;
      if (inputAnimationSystem && typeof inputAnimationSystem.addPlayerAnimationController === 'function') {
        inputAnimationSystem.addPlayerAnimationController(squirrelId, playerAnimationController, 5); // Medium priority for remote players
        Logger.info(LogCategory.PLAYER, `✅ Player animation controller registered with input system`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Input animation system not available`);
      }
      
      // Add components for remote player
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
          mesh: characterInstance.model,
          visible: true
        })
        .addComponent<NetworkComponent>({
          type: 'network',
          isLocalPlayer: false,
          squirrelId: squirrelId,
          lastUpdate: performance.now(),
          characterType: characterType
        })
        .addComponent<AnimationComponent>({
          type: 'animation',
          controller: animationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 5
        })
        .addComponent<InputAnimationComponent>({
          type: 'input_animation',
          controller: playerAnimationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 5
        });
      
      // Store character instance
      this.characterInstances.set(squirrelId, characterInstance);
      
      Logger.info(LogCategory.PLAYER, `✅ Remote player entity created`);
      return entity;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player ${squirrelId}:`, error);
      throw error;
    }
  }

  /**
   * Create a local player with saved position
   */
  async createLocalPlayerWithPosition(
    playerId: string, 
    savedPosition: { x: number; y: number; z: number }, 
    savedRotationY: number,
    characterType: string = 'colobus'
  ): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🎭 Creating local player with saved position: ${playerId} as ${characterType}`);
    Logger.info(LogCategory.PLAYER, `📍 Using saved position: (${savedPosition.x.toFixed(1)}, ${savedPosition.y.toFixed(1)}, ${savedPosition.z.toFixed(1)})`);
    
    try {
      const config = this.characterRegistry.getCharacter(characterType);
      if (!config) {
        Logger.error(LogCategory.PLAYER, `❌ Unknown character type: ${characterType}`);
        throw new Error(`Unknown character type: ${characterType}`);
      }
      
      // Use saved position instead of random spawn
      const spawnX = savedPosition.x;
      const spawnY = savedPosition.y;
      const spawnZ = savedPosition.z;
      const spawnRotationY = savedRotationY;
      
      // Create entity first
      const entity = this.entityManager.createEntity();
      
      // Load character model and setup
      const characterInstance = await this.createCharacterInstance(
        playerId,
        characterType,
        config,
        new Vector3(spawnX, spawnY, spawnZ),
        Rotation.fromRadians(spawnRotationY)
      );
      
      // Add to scene
      this.sceneManager.getScene().add(characterInstance.model);
      Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at SAVED position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
      
      // Create animation controller
      const animationController = new AnimationController(
        characterInstance.model,
        config,
        playerId
      );
      
      // Re-initialize animations after they're loaded from separate files
      animationController.reinitializeAnimations();
      
      // Register with animation system
      const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
      if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
        animationSystem.addAnimationComponent(playerId, animationController, 8); // High priority for local player
        Logger.info(LogCategory.PLAYER, `✅ Animation controller registered with system`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available`);
      }
      
      // Add all required components
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
          mesh: characterInstance.model,
          visible: true
        })
        .addComponent<NetworkComponent>({
          type: 'network',
          isLocalPlayer: true,
          squirrelId: playerId,
          lastUpdate: performance.now(),
          characterType: characterType // Add character type to network component
        })
        .addComponent<InputComponent>({
          type: 'input',
          forward: false,
          backward: false,
          turnLeft: false,
          turnRight: false
        })
        .addComponent<AnimationComponent>({
          type: 'animation',
          controller: animationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 8
        });
      
      // Store character instance
      this.characterInstances.set(playerId, characterInstance);
      
      Logger.info(LogCategory.PLAYER, `✅ Local player entity created with saved position`);
      return entity;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create local player with saved position ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Create an NPC character
   */
  async createNPC(npcId: string, characterType: string, position: Vector3): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🤖 Creating NPC: ${npcId} as ${characterType}`);
    
    try {
      const config = this.characterRegistry.getCharacter(characterType);
      if (!config || !config.behaviors.isNPC) {
        Logger.error(LogCategory.PLAYER, `❌ Character type ${characterType} cannot be used as NPC`);
        throw new Error(`Character type ${characterType} cannot be used as NPC`);
      }
      
      // Create entity first
      const entity = this.entityManager.createEntity();
      
      // Load character model and setup
      const characterInstance = await this.createCharacterInstance(
        npcId,
        characterType,
        config,
        position,
        Rotation.fromRadians(Math.random() * Math.PI * 2) // Random initial rotation
      );
      
      // Add to scene
      this.sceneManager.getScene().add(characterInstance.model);
      Logger.info(LogCategory.PLAYER, `✅ NPC added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
      
      // Create animation controller
      const animationController = new AnimationController(
        characterInstance.model,
        config,
        npcId
      );
      
      // Re-initialize animations after they're loaded from separate files
      animationController.reinitializeAnimations();
      
      // Create player animation controller for input-driven animations
      const playerAnimationController = new PlayerAnimationController(
        config,
        characterInstance.model,
        npcId,
        container.resolve(ServiceTokens.EVENT_BUS)
      );
      
      // Register with animation system
      const animationSystem = container.resolve(ServiceTokens.ANIMATION_SYSTEM) as any;
      if (animationSystem && typeof animationSystem.addAnimationComponent === 'function') {
        animationSystem.addAnimationComponent(npcId, animationController, 3); // Low priority for NPCs
        Logger.info(LogCategory.PLAYER, `✅ Animation controller registered with system`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Animation system not available`);
      }
      
      // Register with input animation system
      const inputAnimationSystem = container.resolve(ServiceTokens.INPUT_ANIMATION_SYSTEM) as any;
      if (inputAnimationSystem && typeof inputAnimationSystem.addPlayerAnimationController === 'function') {
        inputAnimationSystem.addPlayerAnimationController(npcId, playerAnimationController, 3); // Low priority for NPCs
        Logger.info(LogCategory.PLAYER, `✅ Player animation controller registered with input system`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Input animation system not available`);
      }
      
      // Add components for NPC
      entity
        .addComponent<PositionComponent>({
          type: 'position',
          value: position
        })
        .addComponent<RotationComponent>({
          type: 'rotation',
          value: Rotation.fromRadians(0)
        })
        .addComponent<RenderComponent>({
          type: 'render',
          mesh: characterInstance.model,
          visible: true
        })
        .addComponent<AnimationComponent>({
          type: 'animation',
          controller: animationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 3
        })
        .addComponent<InputAnimationComponent>({
          type: 'input_animation',
          controller: playerAnimationController,
          isActive: true,
          lastUpdateTime: 0,
          updateInterval: 16,
          priority: 3
        });
      
      // Store character instance
      this.characterInstances.set(npcId, characterInstance);
      
      Logger.info(LogCategory.PLAYER, `✅ NPC entity created`);
      return entity;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create NPC ${npcId}:`, error);
      throw error;
    }
  }

  /**
   * Private method to create a character instance
   */
  private async createCharacterInstance(
    instanceId: string,
    characterType: string,
    config: CharacterConfig,
    position: Vector3,
    rotation: Rotation
  ): Promise<CharacterInstance> {
    Logger.info(LogCategory.PLAYER, `🔄 Loading character model for ${characterType}: ${config.lodPaths.lod0}`);
    
    // Load the appropriate LOD model (start with LOD0 for now)
    let gltf;
    try {
      gltf = await this.assetManager.loadModel(config.lodPaths.lod0);
      Logger.info(LogCategory.PLAYER, `✅ Model loaded successfully for ${characterType}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load character model: ${config.lodPaths.lod0}`, error);
      throw new Error(`Failed to load character model: ${config.lodPaths.lod0}`);
    }
    
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, `❌ Invalid GLTF data for character model: ${config.lodPaths.lod0}`);
      throw new Error(`Invalid GLTF data for character model: ${config.lodPaths.lod0}`);
    }
    
    Logger.info(LogCategory.PLAYER, `✅ Character model loaded successfully: ${config.name}`);
    
    // Get the actual model from the GLTF scene
    const model = gltf.scene.clone();
    Logger.info(LogCategory.PLAYER, `✅ Model cloned successfully for ${characterType}`);
    
    // Apply character-specific scaling
    model.scale.set(config.scale, config.scale, config.scale);
    model.traverse((child: THREE.Object3D) => {
      if (child !== model) {
        child.scale.set(config.scale, config.scale, config.scale);
      }
    });
    
    // Set position and rotation
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotation.y;
    
    // Setup animation mixer if animations are available
    let mixer: THREE.AnimationMixer | undefined;
    const actions = new Map<string, THREE.AnimationAction>();
    
    // Load animations from separate files
    await this.loadCharacterAnimations(model, config, mixer, actions);
    
    if (gltf.animations && gltf.animations.length > 0) {
      if (!mixer) {
        mixer = new THREE.AnimationMixer(model);
      }
      
      // Setup default animation actions from main model
      gltf.animations.forEach((clip: THREE.AnimationClip) => {
        const action = mixer!.clipAction(clip);
        actions.set(clip.name, action);
      });
    }
    
    // Start with idle animation if available
    if (mixer) {
      const idleAction = actions.get('idle_a') || actions.get('Idle_A') || actions.get('idle');
      if (idleAction) {
        idleAction.play();
      }
    }
    
    // Create character instance
    const characterInstance: CharacterInstance = {
      id: instanceId,
      characterType: characterType,
      config: config,
      model: model,
      mixer: mixer,
      actions: actions,
      currentLOD: 0,
      animationState: {
        currentAnimation: 'idle_a',
        previousAnimation: '',
        transitionTime: 0.2,
        loop: true,
        speed: 1.0,
        blendWeight: 1.0
      },
      isVisible: true,
      lastUpdate: performance.now()
    };
    
    return characterInstance;
  }

  /**
   * Load and attach animations to the character model
   */
  private async loadCharacterAnimations(
    model: THREE.Object3D, 
    config: CharacterConfig, 
    mixer: THREE.AnimationMixer | undefined,
    actions: Map<string, THREE.AnimationAction>
  ): Promise<void> {
    Logger.info(LogCategory.PLAYER, `🔄 Loading animations for ${config.name} (${Object.keys(config.animations).length} animations)`);
    
    // Create mixer if not provided
    if (!mixer) {
      mixer = new THREE.AnimationMixer(model);
      // Logger.debug(LogCategory.PLAYER, `✅ Created animation mixer for ${config.name}`);
    }
    
    const animationPromises: Promise<void>[] = [];
    const animationEntries = Object.entries(config.animations);
    
          // Logger.info(LogCategory.PLAYER, `📋 Animation files to load for ${config.name}:`);
      // animationEntries.forEach(([name, path]) => {
      //   Logger.debug(LogCategory.PLAYER, `  - ${name}: ${path}`);
      // });
    
    // Load each animation file
    for (const [animationName, animationPath] of animationEntries) {
      const promise = this.loadSingleAnimation(model, animationName, animationPath, mixer, actions);
      animationPromises.push(promise);
    }
    
    try {
      await Promise.all(animationPromises);
      Logger.info(LogCategory.PLAYER, `✅ Loaded ${animationPromises.length} animations for ${config.name}`);
      Logger.info(LogCategory.PLAYER, `📊 Final animation count for ${config.name}: ${model.animations.length} animations, ${actions.size} actions`);
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Some animations failed to load for ${config.name}:`, error);
    }
  }

  /**
   * Load a single animation and attach it to the model
   */
  private async loadSingleAnimation(
    model: THREE.Object3D, 
    animationName: string, 
    animationPath: string,
    mixer: THREE.AnimationMixer,
    actions: Map<string, THREE.AnimationAction>
  ): Promise<void> {
    try {
      // Logger.debug(LogCategory.PLAYER, `🔄 Loading animation ${animationName} from: ${animationPath}`);
      const gltf = await this.assetManager.loadModel(animationPath);
      
      if (!gltf) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Failed to load GLTF from: ${animationPath}`);
        return;
      }
      
      if (!gltf.animations) {
        Logger.warn(LogCategory.PLAYER, `⚠️ No animations array in GLTF from: ${animationPath}`);
        return;
      }
      
      if (gltf.animations.length === 0) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Empty animations array in GLTF from: ${animationPath}`);
        return;
      }
      
              // Logger.info(LogCategory.PLAYER, `✅ Found ${gltf.animations.length} animations in: ${animationPath}`);
      
      // Add animations to the model and create actions
              gltf.animations.forEach((clip: THREE.AnimationClip) => {
        // Logger.debug(LogCategory.PLAYER, `🔄 Processing animation clip ${index}: ${clip.name} (duration: ${clip.duration}s)`);
        
        // Rename the clip to match the expected name
        clip.name = animationName;
        model.animations.push(clip);
        
        // Create action for the animation
        const action = mixer.clipAction(clip);
        actions.set(animationName, action);
        
        // Logger.debug(LogCategory.PLAYER, `✅ Created action for animation: ${animationName}`);
      });
      
              // Logger.info(LogCategory.PLAYER, `✅ Successfully loaded animation: ${animationName}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load animation ${animationName} from ${animationPath}:`, error);
    }
  }

  /**
   * Get character instance by ID
   */
  getCharacterInstance(instanceId: string): CharacterInstance | undefined {
    return this.characterInstances.get(instanceId);
  }

  /**
   * Update character animation
   */
  updateCharacterAnimation(instanceId: string, animationName: string, loop: boolean = true, speed: number = 1.0): void {
    const instance = this.characterInstances.get(instanceId);
    if (!instance || !instance.mixer) {
      return;
    }
    
    const action = instance.actions.get(animationName);
    if (!action) {
      Logger.warn(LogCategory.PLAYER, `Animation ${animationName} not found for character ${instanceId}`);
      return;
    }
    
    // Fade out current animation
    const currentAction = instance.actions.get(instance.animationState.currentAnimation);
    if (currentAction && currentAction !== action) {
      currentAction.fadeOut(instance.animationState.transitionTime);
    }
    
    // Fade in new animation
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.fadeIn(instance.animationState.transitionTime);
    action.play();
    action.timeScale = speed;
    
    // Update animation state
    instance.animationState.previousAnimation = instance.animationState.currentAnimation;
    instance.animationState.currentAnimation = animationName;
    instance.animationState.loop = loop;
    instance.animationState.speed = speed;
    instance.lastUpdate = performance.now();
  }

  /**
   * Update all character animations (call in game loop)
   */
  updateAnimations(deltaTime: number): void {
    this.characterInstances.forEach((instance) => {
      if (instance.mixer) {
        instance.mixer.update(deltaTime);
      }
    });
  }

  /**
   * Remove character instance
   */
  removeCharacterInstance(instanceId: string): void {
    const instance = this.characterInstances.get(instanceId);
    if (instance) {
      // Remove from scene
      this.sceneManager.getScene().remove(instance.model);
      
      // Cleanup animations
      if (instance.mixer) {
        instance.mixer.stopAllAction();
      }
      
      // Remove from registry
      this.characterInstances.delete(instanceId);
      
      Logger.info(LogCategory.PLAYER, `🗑️ Character instance ${instanceId} removed`);
    }
  }
}