// Player Entity Factory - Clean entity creation with all components

import { Entity, EntityManager, PositionComponent, RotationComponent, RenderComponent, InputComponent, NetworkComponent } from '../ecs';
import { Vector3, Rotation, EntityId, MovementConfig } from '../core/types';
// Removed unused container import - using pure DI now
import { IAssetManager, ISceneManager } from '../GameComposition';
import { ITerrainService } from '../services/TerrainService';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

export class PlayerFactory {
  constructor(
    private eventBus: EventBus,
    private sceneManager: ISceneManager,
    private assetManager: IAssetManager,
    private entityManager: EntityManager,
    private terrainService: ITerrainService
  ) {}

  async createLocalPlayer(spawnPosition?: Vector3): Promise<Entity> {
    // Calculate terrain-aware spawn position
    const finalSpawnPosition = await this.calculateSafeSpawnPosition();
    
    const entity = this.entityManager.createEntity();

    // Load squirrel model
    const squirrelMesh = await this.assetManager.loadSquirrelModel();
    squirrelMesh.position.set(finalSpawnPosition.x, finalSpawnPosition.y, finalSpawnPosition.z);

    // Add to scene
    this.sceneManager.getScene().add(squirrelMesh);

    // Add all required components
    entity
      .addComponent<PositionComponent>({
        type: 'position',
        value: finalSpawnPosition
      })
      .addComponent<RotationComponent>({
        type: 'rotation',
        value: Rotation.fromRadians(0)
      })
      .addComponent<RenderComponent>({
        type: 'render',
        mesh: squirrelMesh,
        visible: true
      })
      .addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      })
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: true,
        squirrelId: EntityId.generate().value,
        lastUpdate: performance.now()
      });

    this.entityManager.addEntity(entity);
    Logger.debug(LogCategory.PLAYER, `🐿️ Local player entity created: ${entity.id.value}`);
    
    return entity;
  }

  createRemotePlayer(squirrelId: string, position: Vector3, rotation: Rotation): Entity {
    const entity = this.entityManager.createEntity();

    // Note: We'll load the mesh asynchronously and update the render component
    this.loadRemotePlayerMesh(entity, position);

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
      .addComponent<NetworkComponent>({
        type: 'network',
        isLocalPlayer: false,
        squirrelId: squirrelId,
        lastUpdate: performance.now()
      });

    this.entityManager.addEntity(entity);
    Logger.debug(LogCategory.PLAYER, `🌐 Remote player entity created: ${squirrelId}`);
    
    return entity;
  }

  private async loadRemotePlayerMesh(entity: Entity, position: Vector3): Promise<void> {
    try {
      const squirrelMesh = await this.assetManager.loadSquirrelModel();
      squirrelMesh.position.set(position.x, position.y, position.z);
      
      // Add to scene
      this.sceneManager.getScene().add(squirrelMesh);

      // Update entity with render component
      entity.addComponent<RenderComponent>({
        type: 'render',
        mesh: squirrelMesh,
        visible: true
      });
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `Failed to load remote player mesh: ${error}`);
    }
  }

  private async calculateSafeSpawnPosition(): Promise<Vector3> {
    try {
      // Find a safe spawn position using terrain height
      const spawnX = (Math.random() - 0.5) * 20; // Random X between -10 and 10
      const spawnZ = (Math.random() - 0.5) * 20; // Random Z between -10 and 10
      
      // Get terrain height at this position
      const terrainHeight = await this.terrainService.getTerrainHeight(spawnX, spawnZ);
      const safeY = terrainHeight + 0.5; // Spawn 0.5 units above terrain
      
      Logger.debug(LogCategory.PLAYER, `Safe spawn calculated: (${spawnX}, ${safeY}, ${spawnZ})`);
      return new Vector3(spawnX, safeY, spawnZ);
      
    } catch (error) {
      Logger.warn(LogCategory.PLAYER, `Could not calculate terrain height, using default Y=2: ${error}`);
      return new Vector3(0, 2, 0); // Fallback position
    }
  }
} 