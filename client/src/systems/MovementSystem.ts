// client/src/systems/MovementSystem.ts

import { System, Entity, PositionComponent, RotationComponent, InputComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
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
    
    // CRITICAL FIX: Only process LOCAL player, skip remote players
    if (!network?.isLocalPlayer) {
      return; // Skip remote players - they should be handled by InterpolationSystem
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
      // Removed direct mesh manipulation - RenderSystem has sole authority over mesh positioning
      // Emit both events for compatibility
      this.eventBus.emit('entity_moved', {
        entityId: entity.id,
        position: newPosition,
        rotation: newRotation
      });
      
      // CRITICAL FIX: Also emit PLAYER_MOVED so NetworkSystem receives the event
      this.eventBus.emit(GameEvents.PLAYER_MOVED, {
        entityId: entity.id.value,
        position: newPosition,
        rotation: newRotation,
        characterId: characterComp?.characterId || 'squirrel'
      });
    }
  }
}