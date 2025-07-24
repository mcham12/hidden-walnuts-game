// client/src/entities/PlayerFactory.ts

import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent } from '../ecs';
import { Vector3, Rotation } from '../core/types';
import { ISceneManager, IAssetManager } from '../GameComposition';
import { ITerrainService } from '../services/TerrainService';
import { Logger, LogCategory } from '../core/Logger';
import * as THREE from 'three';
import { container, ServiceTokens } from '../core/Container';
import { CharacterRegistry } from '../core/CharacterRegistry'; // New import

import { CharacterComponent } from '../core/types'; // New import

export class PlayerFactory {
  private registry: CharacterRegistry;
  
  constructor(
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,  
    private entityManager: import('../ecs').EntityManager,
    private terrainService: ITerrainService
  ) {
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
  }

  async createLocalPlayer(playerId: string, characterId: string = 'squirrel'): Promise<Entity> {
    const character = await this.registry.getCharacter(characterId) || await this.registry.getDefaultCharacter();
    if (!character) {
      throw new Error(`No character found for ${characterId}`);
    }
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player: ${playerId} as ${character.name}`);
    
    // TEMPORARY: Use fixed spawn position for debugging
    const spawnX = 0; // Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    const spawnZ = 0; // Math.random() * 10 - 5; // Random spawn between -5 and 5 (closer to origin)
    
    let terrainHeight = 0;
    try {
      terrainHeight = await this.terrainService.getTerrainHeight(spawnX, spawnZ);
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, '⚠️ Failed to get terrain height during spawn, using default height', error);
      terrainHeight = 0;
    }
    
    const spawnY = terrainHeight + 0.1; // Match remote player height for consistency
    
    Logger.info(LogCategory.PLAYER, `🎯 Player spawn position: (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    const entity = this.entityManager.createEntity();
    Logger.info(LogCategory.PLAYER, `✅ Entity created with ID: ${entity.id.value}`);
    
    const gltf = await this.assetManager.loadModel(character.modelPath);
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load model for ${character.name}`);
      throw new Error(`Failed to load model for ${character.name}`);
    }
    
    Logger.info(LogCategory.PLAYER, `✅ Model loaded successfully for ${character.name}`);
    
    // INDUSTRY-STANDARD: Fresh model instance (no cloning for SkinnedMesh)
    const model = gltf.scene;
    Logger.info(LogCategory.PLAYER, `✅ Fresh model instance loaded (no cloning)`);
    
    // Apply shadow settings like the squirrel model
    model.castShadow = true;
    model.receiveShadow = true;
    
    // Apply shadow settings to child meshes (like forest objects do)
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    const targetScale = character.scale;
    model.scale.set(targetScale, targetScale, targetScale);
    model.position.set(spawnX, spawnY, spawnZ);
    Logger.info(LogCategory.PLAYER, `✅ Model positioned at (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    const scene = this.sceneManager.getScene();
    Logger.info(LogCategory.PLAYER, `✅ Got scene, adding model to scene`);
    scene.add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
    // Verify the model is actually in the scene
    Logger.info(LogCategory.PLAYER, `🔍 Scene children count: ${scene.children.length}`);
    Logger.info(LogCategory.PLAYER, `🔍 Model visible: ${model.visible}`);
    Logger.info(LogCategory.PLAYER, `🔍 Model position: (${model.position.x.toFixed(1)}, ${model.position.y.toFixed(1)}, ${model.position.z.toFixed(1)})`);
    
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
      })
      .addComponent<CharacterComponent>({
        type: 'character',
        characterId: character.id
      })
      .addComponent({
        type: 'player'
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Local player entity created with ${entity.getComponents().length} components`);
    Logger.info(LogCategory.PLAYER, `🎮 WASD controls should now work for local player!`);
    
    // Final verification
    const renderComponent = entity.getComponent<RenderComponent>('render');
    if (renderComponent?.mesh) {
      Logger.info(LogCategory.PLAYER, `🔍 Final mesh position: (${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)})`);
      Logger.info(LogCategory.PLAYER, `🔍 Final mesh visible: ${renderComponent.mesh.visible}`);
    }
    
    return entity;
  }

  async createLocalPlayerWithPosition(playerId: string, savedPosition: { x: number; y: number; z: number }, savedRotationY: number, characterId: string = 'squirrel'): Promise<Entity> {
    const character = await this.registry.getCharacter(characterId) || await this.registry.getDefaultCharacter();
    if (!character) {
      throw new Error(`No character found for ${characterId}`);
    }
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player with saved position: ${playerId} as ${character.name}`);
    Logger.info(LogCategory.PLAYER, `📍 Using saved position: (${savedPosition.x.toFixed(1)}, ${savedPosition.y.toFixed(1)}, ${savedPosition.z.toFixed(1)})`);
    
    const spawnX = savedPosition.x;
    const spawnY = savedPosition.y;
    const spawnZ = savedPosition.z;
    const spawnRotationY = savedRotationY;
    
    const entity = this.entityManager.createEntity();
    
    const gltf = await this.assetManager.loadModel(character.modelPath);
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load model for ${character.name}`);
      throw new Error(`Failed to load model for ${character.name}`);
    }
    
    Logger.info(LogCategory.PLAYER, `✅ Model loaded successfully for ${character.name}`);
    
    // INDUSTRY-STANDARD: Fresh model instance (no cloning for SkinnedMesh)
    const model = gltf.scene;
    
    // Apply shadow settings like the squirrel model
    model.castShadow = true;
    model.receiveShadow = true;
    
    // Apply shadow settings to child meshes (like forest objects do)
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    const targetScale = character.scale;
    model.scale.set(targetScale, targetScale, targetScale);
    model.position.set(spawnX, spawnY, spawnZ);
    model.rotation.y = spawnRotationY;
    
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at SAVED position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
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
      })
      .addComponent<CharacterComponent>({
        type: 'character',
        characterId: character.id
      })
      .addComponent({
        type: 'player'
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Local player entity created with SAVED position and ${entity.getComponents().length} components`);
    Logger.info(LogCategory.PLAYER, `🎮 WASD controls should now work for local player!`);
    return entity;
  }

  async createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation, characterId: string = 'squirrel'): Promise<Entity> {
    const character = await this.registry.getCharacter(characterId) || await this.registry.getDefaultCharacter();
    if (!character) {
      throw new Error(`No character found for ${characterId}`);
    }
    Logger.info(LogCategory.PLAYER, `🌐 Creating remote player: ${squirrelId} as ${character.name}`);
    
    const entity = this.entityManager.createEntity();
    
    const gltf = await this.assetManager.loadModel(character.modelPath);
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to load model for ${character.name}`);
      throw new Error(`Failed to load model for ${character.name}`);
    }
    
    // INDUSTRY-STANDARD: Fresh model instance (no cloning for SkinnedMesh)
    const model = gltf.scene;
    
    model.scale.set(character.scale, character.scale, character.scale);
    model.traverse((child: THREE.Object3D) => {
      if (child !== model) {
        child.scale.set(character.scale, character.scale, character.scale);
      }
    });
    model.position.set(position.x, position.y, position.z);
    model.rotation.y = rotation.y; 
    
    model.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const material = child.material.clone();
        material.color.multiplyScalar(0.8); 
        child.material = material;
      }
    });
    
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Remote player added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
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
        lastUpdate: performance.now()
      })
      .addComponent<CharacterComponent>({
        type: 'character',
        characterId: character.id
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Remote player entity created`);
    return entity;
  }
}