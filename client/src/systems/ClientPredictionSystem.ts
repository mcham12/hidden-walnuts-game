// Client Prediction System - Immediate local input response with server reconciliation

import { System, Entity, PositionComponent, RotationComponent, InputComponent, VelocityComponent, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, MovementConfig, WorldBounds } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';
import { InputManager } from '../GameComposition';

interface InputSnapshot {
  sequenceNumber: number;
  timestamp: number;
  input: {
    forward: boolean;
    backward: boolean;
    turnLeft: boolean;
    turnRight: boolean;
  };
}

export class ClientPredictionSystem extends System {
  private static readonly INPUT_BUFFER_SIZE = 60; // 6 seconds at 10Hz
  
  private localPlayerEntity: Entity | null = null;
  private inputHistory: InputSnapshot[] = [];
  private sequenceNumber = 0;
  private lastProcessedSequence = 0;
  private inputManager?: InputManager;
  private movementConfig!: MovementConfig;
  private worldBounds!: WorldBounds;
  private terrainService: any; // TerrainService for height checks
  
  // Prediction and rollback state
  
  constructor(
    eventBus: EventBus,
    inputManager: InputManager,
    movementConfig: MovementConfig,
    worldBounds: WorldBounds,
    terrainService: any // Add terrain service
  ) {
    super(eventBus, ['position', 'rotation', 'input', 'network'], 'ClientPredictionSystem');
    this.inputManager = inputManager;
    this.movementConfig = movementConfig;
    this.worldBounds = worldBounds;
    this.terrainService = terrainService; // Store terrain service
    
    // Listen for server reconciliation
    this.eventBus.subscribe('network.player_update_ack', this.handleServerReconciliation.bind(this));
    
    // CHEN'S FIX: Listen for server acknowledgments
    this.eventBus.subscribe('network.server_acknowledged', this.handleServerAcknowledgment.bind(this));
  }

  update(deltaTime: number): void {
    // Find local player
    if (!this.localPlayerEntity) {
      this.findLocalPlayer();
    }
    
    if (this.localPlayerEntity) {
      this.processLocalPlayerInput(deltaTime);
      this.cleanupInputHistory();
    }
  }

  private findLocalPlayer(): void {
    for (const entity of this.entities.values()) {
      const networkComponent = entity.getComponent<NetworkComponent>('network');
      if (networkComponent?.isLocalPlayer) {
        this.localPlayerEntity = entity;
        break;
      }
    }
  }

  private processLocalPlayerInput(deltaTime: number): void {
    if (!this.inputManager || !this.localPlayerEntity) return;

    const inputState = this.inputManager.getInputState();
    
    // Create input component
    const input: InputComponent = {
      type: 'input',
      forward: inputState.forward,
      backward: inputState.backward,
      turnLeft: inputState.turnLeft,
      turnRight: inputState.turnRight
    };

    // Store input snapshot for potential rollback
    this.sequenceNumber++;
    const inputSnapshot: InputSnapshot = {
      sequenceNumber: this.sequenceNumber,
      timestamp: performance.now(),
      input: inputState
    };
    
    this.inputHistory.push(inputSnapshot);
    
    // Apply movement immediately (client-side prediction)
    this.applyMovement(this.localPlayerEntity, input, deltaTime).then((moved) => {
      if (moved) {
        // Emit movement event for network system
        const position = this.localPlayerEntity!.getComponent<PositionComponent>('position')!;
        const rotation = this.localPlayerEntity!.getComponent<RotationComponent>('rotation')!;
        
        this.eventBus.emit(GameEvents.PLAYER_MOVED, {
          entityId: this.localPlayerEntity!.id.value,
          position: position.value,
          rotation: rotation.value,
          sequenceNumber: this.sequenceNumber,
          predicted: true // Mark as client prediction
        });
        
        Logger.debugExpensive(LogCategory.INPUT, () => 
          `📤 Applied local input ${this.sequenceNumber} at (${position.value.x.toFixed(1)}, ${position.value.z.toFixed(1)})`
        );
      }
    });
  }

  private async applyMovement(entity: Entity, input: InputComponent, deltaTime: number): Promise<boolean> {
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    
    let newPosition = position.value;
    let newRotation = rotation.value;
    let moved = false;

    // Handle rotation (A/D keys) - IMMEDIATE response
    if (input.turnLeft) {
      newRotation = rotation.value.add(this.movementConfig.turnSpeed * deltaTime);
      moved = true;
    }
    if (input.turnRight) {
      newRotation = rotation.value.add(-this.movementConfig.turnSpeed * deltaTime);
      moved = true;
    }

    // Handle translation (W/S keys) - IMMEDIATE response
    if (input.forward || input.backward) {
      const direction = newRotation.getDirection();
      const moveDistance = this.movementConfig.moveSpeed * deltaTime;
      
      if (input.forward) {
        newPosition = newPosition.add(direction.multiply(moveDistance));
        moved = true;
      }
      if (input.backward) {
        newPosition = newPosition.add(direction.multiply(-moveDistance));
        moved = true;
      }
    }

    // Apply world bounds (client-side validation)
    newPosition = this.worldBounds.clamp(newPosition);

    // TERRAIN COLLISION: Ensure player stays on terrain surface
    if (moved && this.terrainService) {
      try {
        const terrainHeight = await this.terrainService.getTerrainHeight(newPosition.x, newPosition.z);
        // Keep player 0.5 units above terrain (squirrel height)
        newPosition = new Vector3(newPosition.x, Math.max(newPosition.y, terrainHeight + 0.5), newPosition.z);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, 'Failed to get terrain height for collision, using minimum Y=1', error);
        newPosition = new Vector3(newPosition.x, Math.max(newPosition.y, 1), newPosition.z);
      }
    }

    // Update components immediately
    if (moved) {
      entity.addComponent<PositionComponent>({
        type: 'position',
        value: newPosition
      });

      entity.addComponent<RotationComponent>({
        type: 'rotation',
        value: newRotation
      });

      // Calculate velocity
      const velocity = newPosition.add(position.value.multiply(-1)).multiply(1 / deltaTime);
      entity.addComponent<VelocityComponent>({
        type: 'velocity',
        value: velocity
      });
      
      // Update render mesh position immediately for responsiveness
      const renderComponent = entity.getComponent<import('../ecs').RenderComponent>('render');
      if (renderComponent?.mesh) {
        renderComponent.mesh.position.set(newPosition.x, newPosition.y, newPosition.z);
        renderComponent.mesh.rotation.y = newRotation.y;
      }
    }

    return moved;
  }

  private handleServerReconciliation(data: {
    entityId: string;
    serverPosition: Vector3;
    clientPosition: Vector3;
    difference: number;
  }): void {
    if (!this.localPlayerEntity || this.localPlayerEntity.id.value !== data.entityId) {
      return;
    }
    
    Logger.warn(LogCategory.NETWORK, `Server reconciliation - diff: ${data.difference.toFixed(3)}m`);
    
    // Find the point where we diverged from server
    // In a full implementation, this would find the exact input sequence
    // For now, we'll replay the last few inputs
    
    this.replayInputsFromPosition(data.serverPosition);
  }

  private replayInputsFromPosition(serverPosition: Vector3): void {
    if (!this.localPlayerEntity) return;
    
    // Set position to server authoritative state
    this.localPlayerEntity.addComponent<PositionComponent>({
      type: 'position',
      value: serverPosition
    });
    
    // CHEN'S FIX: Replay inputs AFTER the acknowledged sequence, not last N inputs
    const inputsToReplay = this.inputHistory.filter(input => 
      input.sequenceNumber > this.lastProcessedSequence
    );
    
    Logger.debug(LogCategory.NETWORK, `Replaying ${inputsToReplay.length} inputs after sequence ${this.lastProcessedSequence}`);
    
    for (const inputSnapshot of inputsToReplay) {
      // Re-apply this input with exact timing
      const inputComponent: InputComponent = {
        type: 'input',
        ...inputSnapshot.input
      };
        
              this.applyMovement(this.localPlayerEntity, inputComponent, 1/60); // Use fixed timestep for replay
    }
    
    Logger.debug(LogCategory.NETWORK, `Replayed ${inputsToReplay.length} inputs after reconciliation`);
  }

  private cleanupInputHistory(): void {
    // Keep only recent inputs
    if (this.inputHistory.length > ClientPredictionSystem.INPUT_BUFFER_SIZE) {
      this.inputHistory = this.inputHistory.slice(-ClientPredictionSystem.INPUT_BUFFER_SIZE);
    }
  }

  // Public method for external systems
  getLastInputSequence(): number {
    return this.sequenceNumber;
  }

  // CHEN'S FIX: Proper server acknowledgment handler
  private handleServerAcknowledgment(data: { sequence: number; timestamp: number }): void {
    this.lastProcessedSequence = Math.max(this.lastProcessedSequence, data.sequence);
    
    // Clean up acknowledged inputs from history
    this.inputHistory = this.inputHistory.filter(input => 
      input.sequenceNumber > data.sequence
    );
    
    Logger.debugExpensive(LogCategory.NETWORK, () => `Acknowledged sequence ${data.sequence}, cleaned input history`);
  }

  acknowledgeServerInput(sequenceNumber: number): void {
    this.lastProcessedSequence = Math.max(this.lastProcessedSequence, sequenceNumber);
  }
} 