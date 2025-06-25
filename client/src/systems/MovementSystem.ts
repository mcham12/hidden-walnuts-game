// Movement System - Single Responsibility: Handle entity movement

import { System, Entity, PositionComponent, RotationComponent, InputComponent, VelocityComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { MovementConfig, WorldBounds } from '../core/types';

export class MovementSystem extends System {
  constructor(
    eventBus: EventBus,
    private config: MovementConfig,
    private worldBounds: WorldBounds
  ) {
    super(eventBus, ['position', 'rotation', 'input']);
  }

  update(deltaTime: number): void {
    for (const entity of this.entities.values()) {
      this.updateEntityMovement(entity, deltaTime);
    }
  }

  private updateEntityMovement(entity: Entity, deltaTime: number): void {
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

    // Update components if movement occurred
    if (moved) {
      // Update position component
      const positionComponent: PositionComponent = {
        type: 'position',
        value: newPosition
      };
      entity.addComponent(positionComponent);

      // Update rotation component
      const rotationComponent: RotationComponent = {
        type: 'rotation',
        value: newRotation
      };
      entity.addComponent(rotationComponent);

      // Calculate and store velocity for other systems
      const velocity = newPosition.add(position.value.multiply(-1)).multiply(1 / deltaTime);
      const velocityComponent: VelocityComponent = {
        type: 'velocity',
        value: velocity
      };
      entity.addComponent(velocityComponent);

      // Emit movement event for other systems
      this.eventBus.emit(GameEvents.PLAYER_MOVED, {
        entityId: entity.id,
        position: newPosition,
        rotation: newRotation,
        velocity: velocity
      });
    }
  }
} 