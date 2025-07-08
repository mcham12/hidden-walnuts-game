// Player Entity Factory - Clean entity creation with all components

import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent } from '../ecs';
import { Vector3, Rotation } from '../core/types';
import { ISceneManager, IAssetManager } from '../GameComposition';
import { ITerrainService } from '../services/TerrainService';
import { Logger, LogCategory } from '../core/Logger';
import { CharacterSelectionManager } from '../core/CharacterSelectionManager';
import { AnimatedModelLoader } from './AnimatedModelLoader';
import * as THREE from 'three';
import { CharacterRegistry } from '../core/CharacterRegistry';

export class PlayerFactory {
  constructor(
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,  
    private entityManager: import('../ecs').EntityManager,
    private terrainService: ITerrainService,
    private characterSelectionManager: CharacterSelectionManager,
    private animatedModelLoader: AnimatedModelLoader,
    private characterRegistry: CharacterRegistry
  ) {}

  async createLocalPlayer(playerId: string): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player: ${playerId}`);
    
    // Get the selected character type
    const selectedCharacterType = this.characterSelectionManager.getSelectedCharacterOrDefault();
    Logger.info(LogCategory.PLAYER, `🎭 Using selected character: ${selectedCharacterType}`);
    
    // TASK 8 FIX: Spawn players very close to origin for easier multiplayer testing
    const spawnX = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    const spawnZ = Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    
    let terrainHeight = 0;
    try {
      terrainHeight = await this.terrainService.getTerrainHeight(spawnX, spawnZ);
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, '⚠️ Failed to get terrain height during spawn, using default height', error);
      terrainHeight = 0;
    }
    
    const spawnY = terrainHeight + 0.1; // TASK 3 FIX: Match remote player height for consistency
    
    Logger.info(LogCategory.PLAYER, `🎯 Player spawn position: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load the selected character model with proper error handling
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
    
    // Apply proper scaling - use character config scale, not hardcoded value
    model.scale.set(characterScale, characterScale, characterScale);
    // Don't apply recursive scaling to children - this causes double scaling
    model.position.set(spawnX, spawnY, spawnZ);
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}) with scale ${characterScale}`);
    
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
        mesh: model,
        visible: true
      })
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: true,
        squirrelId: playerId,
        lastUpdate: performance.now()
      })
      .addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Local player entity created with ${entity.getComponents().length} components`);
    Logger.info(LogCategory.PLAYER, `🎮 WASD controls should now work for local player!`);
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
    
    // Apply proper scaling - use character config scale, not hardcoded value
    model.scale.set(characterScale, characterScale, characterScale);
    // Don't apply recursive scaling to children - this causes double scaling
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotation.y; // Use the y rotation value
    
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
        characterType: characterType // Store the character type
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Remote player entity created`);
    return entity;
  }

  async createLocalPlayerWithPosition(playerId: string, savedPosition: { x: number; y: number; z: number }, savedRotationY: number): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player with saved position: ${playerId}`);
    Logger.info(LogCategory.PLAYER, `📍 Using saved position: (${savedPosition.x.toFixed(1)}, ${savedPosition.y.toFixed(1)}, ${savedPosition.z.toFixed(1)})`);
    
    // Get the selected character type
    const selectedCharacterType = this.characterSelectionManager.getSelectedCharacterOrDefault();
    Logger.info(LogCategory.PLAYER, `🎭 Using selected character: ${selectedCharacterType}`);
    
    // Use saved position instead of random spawn
    const spawnX = savedPosition.x;
    const spawnY = savedPosition.y;
    const spawnZ = savedPosition.z;
    const spawnRotationY = savedRotationY;
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load the selected character model
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
    
    // Apply proper scaling - use character config scale, not hardcoded value
    model.scale.set(characterScale, characterScale, characterScale);
    // Don't apply recursive scaling to children - this causes double scaling
    model.position.set(spawnX, spawnY, spawnZ);
    model.rotation.y = spawnRotationY;
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at SAVED position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)}) with scale ${characterScale}`);
    
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
        lastUpdate: performance.now()
      })
      .addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Local player entity created with SAVED position and ${entity.getComponents().length} components`);
    Logger.info(LogCategory.PLAYER, `🎮 WASD controls should now work for local player!`);
    return entity;
  }
} 