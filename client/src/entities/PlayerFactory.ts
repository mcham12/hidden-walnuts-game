// Player Entity Factory - Clean entity creation with all components

import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent } from '../ecs';
import { Vector3, Rotation } from '../core/types';
import { ISceneManager, IAssetManager } from '../GameComposition';
import { ITerrainService } from '../services/TerrainService';
import { Logger, LogCategory } from '../core/Logger';

export class PlayerFactory {
  constructor(
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,  
    private entityManager: import('../ecs').EntityManager,
    private terrainService: ITerrainService
  ) {}

  async createLocalPlayer(playerId: string): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🐿️ Creating local player: ${playerId}`);
    
    // Get terrain height at spawn point  
    const spawnX = Math.random() * 20 - 10; // Random spawn between -10 and 10
    const spawnZ = Math.random() * 20 - 10;
    
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
    
    // Load squirrel model
    const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to load squirrel model');
      throw new Error('Failed to load squirrel model');
    }
    
    Logger.info(LogCategory.PLAYER, '✅ Squirrel model loaded successfully');
    
    // Get the actual model from the GLTF scene
    const model = gltf.scene.clone();
    
    // Scale the model to appropriate size
    model.scale.setScalar(0.3); // TASK 3 FIX: Match remote player scale for consistency
    model.position.set(spawnX, spawnY, spawnZ);
    
    // Add to scene
    this.sceneManager.getScene().add(model);
    Logger.info(LogCategory.PLAYER, `✅ Local player added to scene at position (${spawnX.toFixed(1)}, ${spawnY.toFixed(1)}, ${spawnZ.toFixed(1)})`);
    
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

  async createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation): Promise<Entity> {
    Logger.info(LogCategory.PLAYER, `🌐 Creating remote player: ${squirrelId}`);
    
    // Create entity first
    const entity = this.entityManager.createEntity();
    
    // Load squirrel model for remote player
    const gltf = await this.assetManager.loadModel('/assets/models/squirrel.glb');
    if (!gltf || !gltf.scene) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to load squirrel model for remote player');
      throw new Error('Failed to load squirrel model for remote player');
    }
    
    // Get the actual model from the GLTF scene
    const model = gltf.scene.clone();
    
    // Scale and position the model
    model.scale.setScalar(0.3); // TASK 3 FIX: Match local player scale for consistency
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
    Logger.info(LogCategory.PLAYER, `✅ Remote player added to scene at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
    
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
        lastUpdate: performance.now()
      });
    
    Logger.info(LogCategory.PLAYER, `✅ Remote player entity created`);
    return entity;
  }


} 