// Movement System - Single Responsibility: Handle entity movement

import { System, Entity, PositionComponent, RotationComponent, InputComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { MovementConfig, WorldBounds, Vector3 } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';

export class MovementSystem extends System {
  private terrainService: any; // TerrainService for collision

  constructor(
    eventBus: EventBus,
    private config: MovementConfig,
    private worldBounds: WorldBounds,
    terrainService?: any // Add terrain service
  ) {
    super(eventBus, ['position', 'rotation', 'input'], 'MovementSystem');
    this.terrainService = terrainService;
  }

  update(deltaTime: number): void {
    for (const entity of this.entities.values()) {
      this.updateEntityMovement(entity, deltaTime);
    }
  }

  private async updateEntityMovement(entity: Entity, deltaTime: number): Promise<void> {
    // Skip local players - they're handled by ClientPredictionSystem
    const network = entity.getComponent<import('../ecs').NetworkComponent>('network');
    if (network?.isLocalPlayer) {
      return;
    }
    
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const input = entity.getComponent<InputComponent>('input')!;
    
    let newPosition = position.value;
    let newRotation = rotation.value;
    let moved = false;

    // Handle rotation (A/D keys)
    if (input.turnLeft) {
      newRotation = rotation.value.add(this.config.turnSpeed * deltaTime);
      moved = true;
    }
    if (input.turnRight) {
      newRotation = rotation.value.add(-this.config.turnSpeed * deltaTime);
      moved = true;
    }

    // Handle translation (W/S keys)
    if (input.forward || input.backward) {
      const direction = newRotation.getDirection();
      const moveDistance = this.config.moveSpeed * deltaTime;
      
      if (input.forward) {
        newPosition = newPosition.add(direction.multiply(moveDistance));
        moved = true;
      }
      if (input.backward) {
        newPosition = newPosition.add(direction.multiply(-moveDistance));
        moved = true;
      }
    }

    // Apply world bounds
    newPosition = this.worldBounds.clamp(newPosition);

    // TERRAIN COLLISION: Ensure remote players stay on terrain surface
    if (moved && this.terrainService) {
      try {
        const terrainHeight = await this.terrainService.getTerrainHeight(newPosition.x, newPosition.z);
        // FIX: Always set Y to terrain height + offset to prevent floating
        newPosition = new Vector3(newPosition.x, terrainHeight + 0.1, newPosition.z);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, 'Failed to get terrain height for remote player, using minimum Y=1', error);
        newPosition = new Vector3(newPosition.x, Math.max(newPosition.y, 1), newPosition.z);
      }
    }

    // Update components
    if (moved) {
      entity.addComponent<PositionComponent>({
        type: 'position',
        value: newPosition
      });

      entity.addComponent<RotationComponent>({
        type: 'rotation',
        value: newRotation
      });

      // Update render mesh position immediately
      const renderComponent = entity.getComponent<RenderComponent>('render');
      if (renderComponent?.mesh) {
        renderComponent.mesh.position.set(newPosition.x, newPosition.y, newPosition.z);
        renderComponent.mesh.rotation.y = newRotation.y;
      }

      // Notify movement
      this.eventBus.emit('entity_moved', {
        entityId: entity.id,
        position: newPosition,
        rotation: newRotation
      });
    }
  }
} 