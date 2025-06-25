// Input System - Single Responsibility: Update InputComponents from keyboard state

import { System, Entity, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
// Removed unused container import - using pure DI now
import { IInputManager } from '../GameComposition';

export class InputSystem extends System {
  constructor(
    eventBus: EventBus,
    private inputManager: IInputManager
  ) {
    super(eventBus, ['input'], 'InputSystem');
  }

  update(_deltaTime: number): void {
    const inputState = this.inputManager.getInputState();
    
    // Update all entities with input components (typically just the local player)
    for (const entity of this.entities.values()) {
      this.updateEntityInput(entity, inputState);
    }
  }

  private updateEntityInput(
    entity: Entity, 
    inputState: { forward: boolean; backward: boolean; turnLeft: boolean; turnRight: boolean }
  ): void {
    const inputComponent: InputComponent = {
      type: 'input',
      forward: inputState.forward,
      backward: inputState.backward,
      turnLeft: inputState.turnLeft,
      turnRight: inputState.turnRight
    };

    entity.addComponent(inputComponent);
  }
} 