// Input System - Single Responsibility: Update InputComponents from keyboard state

import { System, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IInputManager } from '../GameComposition';
// import { Logger, LogCategory } from '../core/Logger';

export class InputSystem extends System {


  constructor(
    eventBus: EventBus,
    private inputManager: IInputManager
  ) {
    super(eventBus, ['input'], 'InputSystem');
    // Logger.info(LogCategory.INPUT, '[InputSystem] Initialized');
  }

  update(_deltaTime: number): void {
    const inputState = this.inputManager.getInputState();
    
    for (const entity of this.entities.values()) {
      const inputComponent = entity.getComponent<InputComponent>('input');
      const networkComponent = entity.getComponent<import('../ecs').NetworkComponent>('network');
      
      if (!inputComponent) {
        continue;
      }
      
      // Only update local player input
      if (!networkComponent?.isLocalPlayer) {
        continue;
      }
      
      // Update input component with current state
      inputComponent.forward = inputState.forward;
      inputComponent.backward = inputState.backward;
      inputComponent.turnLeft = inputState.turnLeft;
      inputComponent.turnRight = inputState.turnRight;
      
      // Emit input event for other systems
      this.eventBus.emit('input.state_changed', {
        entityId: entity.id.value,
        inputState: inputState,
        timestamp: Date.now()
      });
    }
  }
} 