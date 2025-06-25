// Client Prediction System - Immediate local input response with server reconciliation

import { System, Entity, PositionComponent, RotationComponent, InputComponent, VelocityComponent, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, MovementConfig, WorldBounds } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';

interface InputSnapshot {
  sequenceNumber: number;
  timestamp: number;
  input: {
    forward: boolean;
    backward: boolean;
    turnLeft: boolean;
    turnRight: boolean;
  };
  deltaTime: number;
}

export class ClientPredictionSystem extends System {
  private static readonly INPUT_BUFFER_SIZE = 60; // 6 seconds at 10Hz
  
  private localPlayerEntity: Entity | null = null;
  private inputHistory: InputSnapshot[] = [];
  private sequenceNumber = 0;
  private lastProcessedSequence = 0;
  
  constructor(
    eventBus: EventBus,
    private movementConfig: MovementConfig,
    private worldBounds: WorldBounds
  ) {
    super(eventBus, ['position', 'rotation', 'input', 'network'], 'ClientPredictionSystem');
    
    // Listen for server reconciliation
    this.eventBus.subscribe('network.position_corrected', this.handleServerReconciliation.bind(this));
    
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
    if (!this.localPlayerEntity) return;
    
    const input = this.localPlayerEntity.getComponent<InputComponent>('input');
    if (!input) return;
    
    // Record input for potential replay
    this.sequenceNumber++;
    const inputSnapshot: InputSnapshot = {
      sequenceNumber: this.sequenceNumber,
      timestamp: performance.now(),
      input: {
        forward: input.forward,
        backward: input.backward,
        turnLeft: input.turnLeft,
        turnRight: input.turnRight
      },
      deltaTime: deltaTime
    };
    
    this.inputHistory.push(inputSnapshot);
    
    // Apply movement immediately (client-side prediction)
    const moved = this.applyMovement(this.localPlayerEntity, input, deltaTime);
    
    if (moved) {
      // Emit for other systems (network, rendering, etc.)
      const position = this.localPlayerEntity.getComponent<PositionComponent>('position')!;
      const rotation = this.localPlayerEntity.getComponent<RotationComponent>('rotation')!;
      const velocity = this.localPlayerEntity.getComponent<VelocityComponent>('velocity')!;
      
      this.eventBus.emit(GameEvents.PLAYER_MOVED, {
        entityId: this.localPlayerEntity.id,
        position: position.value,
        rotation: rotation.value,
        velocity: velocity.value,
        sequenceNumber: this.sequenceNumber,
        predicted: true // Mark as client prediction
      });
      
      Logger.debug(LogCategory.INPUT, `Applied input ${this.sequenceNumber} locally`);
    }
  }

  private applyMovement(entity: Entity, input: InputComponent, deltaTime: number): boolean {
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
        
      this.applyMovement(this.localPlayerEntity, inputComponent, inputSnapshot.deltaTime);
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