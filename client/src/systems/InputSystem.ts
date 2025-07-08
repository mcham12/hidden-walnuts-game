// Input System - Single Responsibility: Update InputComponents from keyboard state

import { System, Entity, InputComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IInputManager } from '../GameComposition';
import { Logger, LogCategory } from '../core/Logger';

export class InputSystem extends System {
  private inputState: { forward: boolean; backward: boolean; turnLeft: boolean; turnRight: boolean } = {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false
  };

  constructor(
    eventBus: EventBus,
    private inputManager: IInputManager
  ) {
    super(eventBus, ['input'], 'InputSystem');
    Logger.info(LogCategory.INPUT, '[InputSystem] Initialized');
  }

  update(_deltaTime: number): void {
    // Update input state
    this.updateInputState();
    
    // Update all entities with input components
    for (const entity of this.entities.values()) {
      this.updateEntityInput(entity);
    }
  }

  private updateInputState(): void {
    const newInputState = this.inputManager.getInputState();
    this.inputState = newInputState;
  }

  private updateEntityInput(entity: Entity): void {
    const network = entity.getComponent<import('../ecs').NetworkComponent>('network');
    
    // Only update local player input
    if (network?.isLocalPlayer) {
      Logger.debug(LogCategory.INPUT, `[InputSystem] Local player input: forward=${this.inputState.forward}, backward=${this.inputState.backward}, turnLeft=${this.inputState.turnLeft}, turnRight=${this.inputState.turnRight}`);
      
      // Update input component
      entity.addComponent<InputComponent>({
        type: 'input',
        forward: this.inputState.forward,
        backward: this.inputState.backward,
        turnLeft: this.inputState.turnLeft,
        turnRight: this.inputState.turnRight
      });
    }
  }
} 