// Input System - Single Responsibility: Update InputComponents from keyboard state

import { System, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IInputManager } from '../GameComposition';
import { Logger, LogCategory } from '../core/Logger';

export class InputSystem extends System {


  constructor(
    eventBus: EventBus,
    private inputManager: IInputManager
  ) {
    super(eventBus, ['input'], 'InputSystem');
    Logger.info(LogCategory.INPUT, '[InputSystem] Initialized');
  }

  update(_deltaTime: number): void {
    Logger.warn(LogCategory.INPUT, `🔄 InputSystem update - processing ${this.entities.size} input entities`);
    
    const inputState = this.inputManager.getInputState();
    Logger.warn(LogCategory.INPUT, `🎮 Input state: W=${inputState.forward}, S=${inputState.backward}, A=${inputState.turnLeft}, D=${inputState.turnRight}`);
    
    for (const entity of this.entities.values()) {
      const inputComponent = entity.getComponent<InputComponent>('input');
      const networkComponent = entity.getComponent<import('../ecs').NetworkComponent>('network');
      
      if (!inputComponent) {
        Logger.warn(LogCategory.INPUT, `⚠️ Entity ${entity.id.value} has no input component`);
        continue;
      }
      
      // Only update local player input
      if (!networkComponent?.isLocalPlayer) {
        Logger.warn(LogCategory.INPUT, `⏭️ Skipping remote player ${entity.id.value} for input processing`);
        continue;
      }
      
      Logger.warn(LogCategory.INPUT, `🎮 Processing local player ${entity.id.value} input`);
      
      // Update input component with current state
      const oldInput = { ...inputComponent };
      inputComponent.forward = inputState.forward;
      inputComponent.backward = inputState.backward;
      inputComponent.turnLeft = inputState.turnLeft;
      inputComponent.turnRight = inputState.turnRight;
      
      // Log if input changed
      if (oldInput.forward !== inputState.forward || oldInput.backward !== inputState.backward || 
          oldInput.turnLeft !== inputState.turnLeft || oldInput.turnRight !== inputState.turnRight) {
        Logger.warn(LogCategory.INPUT, `🎮 Input changed for local player ${entity.id.value}: W=${inputState.forward}, S=${inputState.backward}, A=${inputState.turnLeft}, D=${inputState.turnRight}`);
      }
      
      // Emit input event for other systems
      this.eventBus.emit('input.state_changed', {
        entityId: entity.id.value,
        inputState: inputState,
        timestamp: Date.now()
      });
    }
    
    Logger.warn(LogCategory.INPUT, `✅ InputSystem update complete`);
  }
} 