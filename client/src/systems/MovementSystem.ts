// client/src/systems/MovementSystem.ts

import { System, Entity, PositionComponent, RotationComponent, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { MovementConfig, Vector3 } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';
import { container, ServiceTokens } from '../core/Container';
import { CharacterRegistry } from '../core/CharacterRegistry'; // New import
import { CharacterComponent } from '../core/types'; // New import

export class MovementSystem extends System {
  private terrainService: any; 
  private registry: CharacterRegistry;
  
  constructor(
    eventBus: EventBus,
    private config: MovementConfig,
    terrainService?: any 
  ) {
    super(eventBus, ['position', 'rotation', 'input'], 'MovementSystem');
    this.terrainService = terrainService;
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
  }
  async update(deltaTime: number): Promise<void> {
    for (const entity of this.entities.values()) {
      await this.updateEntityMovement(entity, deltaTime);
    }
  }
  private async updateEntityMovement(entity: Entity, deltaTime: number): Promise<void> {
    const network = entity.getComponent<import('../ecs').NetworkComponent>('network');
    if (network?.isLocalPlayer) {
      return;
    }
    
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const input = entity.getComponent<InputComponent>('input')!;
    const characterComp = entity.getComponent<CharacterComponent>('character');
    
    const character = characterComp ? await this.registry.getCharacter(characterComp.characterId) : await this.registry.getDefaultCharacter();
    if (!character) {
      Logger.warn(LogCategory.PLAYER, 'No character found for movement, using default speed');
      return;
    }
    const moveSpeed = character.stats.speed * this.config.moveSpeed;
    const turnSpeed = this.config.turnSpeed;
    
    let newPosition = position.value;
    let newRotation = rotation.value;
    let moved = false;
    if (input.turnLeft) {
      newRotation = rotation.value.add(turnSpeed * deltaTime);
      moved = true;
    }
    if (input.turnRight) {
      newRotation = rotation.value.add(-turnSpeed * deltaTime);
      moved = true;
    }
    if (input.forward || input.backward) {
      const direction = newRotation.getDirection();
      const moveDistance = moveSpeed * deltaTime;
      
      if (input.forward) {
        newPosition = newPosition.add(direction.multiply(moveDistance));
        moved = true;
      }
      if (input.backward) {
        newPosition = newPosition.add(direction.multiply(-moveDistance));
        moved = true;
      }
    }
    if (moved && this.terrainService) {
      try {
        const terrainHeight = await this.terrainService.getTerrainHeight(newPosition.x, newPosition.z);
        newPosition = new Vector3(newPosition.x, terrainHeight + 0.1, newPosition.z);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, 'Failed to get terrain height for remote player, using minimum Y=1', error);
        newPosition = new Vector3(newPosition.x, Math.max(newPosition.y, 1), newPosition.z);
      }
    }
    if (moved) {
      entity.addComponent<PositionComponent>({
        type: 'position',
        value: newPosition
      });
      entity.addComponent<RotationComponent>({
        type: 'rotation',
        value: newRotation
      });
      const renderComponent = entity.getComponent<import('../ecs').RenderComponent>('render');
      if (renderComponent?.mesh) {
        renderComponent.mesh.position.set(newPosition.x, newPosition.y, newPosition.z);
        renderComponent.mesh.rotation.y = newRotation.y;
      }
      this.eventBus.emit('entity_moved', {
        entityId: entity.id,
        position: newPosition,
        rotation: newRotation
      });
    }
  }
}