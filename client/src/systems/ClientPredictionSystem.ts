// Client Prediction System - Immediate local input response with server reconciliation

import { System, Entity, PositionComponent, RotationComponent, InputComponent, VelocityComponent, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, MovementConfig } from '../core/types';
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

  private terrainService: any; // TerrainService for height checks
  
  // Prediction and rollback state
  
  constructor(
    eventBus: EventBus,
    inputManager: InputManager,
    movementConfig: MovementConfig,
    terrainService: any // Add terrain service
  ) {
    super(eventBus, ['position', 'rotation', 'input', 'network'], 'ClientPredictionSystem');
    this.inputManager = inputManager;
    this.movementConfig = movementConfig;

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
      if (this.localPlayerEntity) {
        Logger.info(LogCategory.INPUT, '✅ ClientPredictionSystem found local player');
      } else {
        Logger.warn(LogCategory.INPUT, '⚠️ ClientPredictionSystem: No local player found yet. Total entities:', this.entities.size);
      }
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
        
        Logger.debugExpensive(LogCategory.INPUT, () => `🚀 EMITTED PLAYER_MOVED event - Seq: ${this.sequenceNumber} Pos: (${position.value.x.toFixed(1)}, ${position.value.z.toFixed(1)})`);
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



    // TERRAIN COLLISION: Ensure player stays on terrain surface
    if (moved && this.terrainService) {
      try {
        const terrainHeight = await this.terrainService.getTerrainHeight(newPosition.x, newPosition.z);
        // FIX: Always set Y to terrain height + offset to prevent floating
        newPosition = new Vector3(newPosition.x, terrainHeight + 0.1, newPosition.z);
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

  // TASK 8 ENHANCEMENT: Enhanced server reconciliation with better input replay
  private handleServerReconciliation(data: {
    entityId: string;
    serverPosition: Vector3;
    clientPosition: Vector3;
    difference: number;
    velocityDiff?: number;
    threshold?: number;
  }): void {
    if (!this.localPlayerEntity || this.localPlayerEntity.id.value !== data.entityId) {
      return;
    }
    
    Logger.debug(LogCategory.NETWORK, `🔄 Server reconciliation: Client (${data.clientPosition.x.toFixed(2)}, ${data.clientPosition.z.toFixed(2)}) -> Server (${data.serverPosition.x.toFixed(2)}, ${data.serverPosition.z.toFixed(2)}) Diff: ${data.difference.toFixed(3)}m`);
    
    // TASK 8 ENHANCEMENT: Use smooth interpolation instead of snapping
    this.interpolateToServerPosition(data.serverPosition, data.clientPosition);
    
    // TASK 8 ENHANCEMENT: Enhanced input replay with validation
    this.replayInputsFromPosition(data.serverPosition);
    
    // TASK 8 ENHANCEMENT: Emit detailed reconciliation event
    this.eventBus.emit('prediction.reconciliation_performed', {
      entityId: data.entityId,
      serverPosition: data.serverPosition,
      clientPosition: data.clientPosition,
      difference: data.difference,
      velocityDiff: data.velocityDiff || 0,
      threshold: data.threshold || 0.01,
      timestamp: performance.now()
    });
  }

  // TASK 8 ENHANCEMENT: Smooth interpolation to server position
  private interpolateToServerPosition(serverPosition: Vector3, clientPosition: Vector3): void {
    if (!this.localPlayerEntity) return;
    
    // TASK 8 ENHANCEMENT: Use lerp for smooth transition instead of snapping
    const interpolationFactor = 0.7; // 70% towards server position for smoother transition
    
    const interpolatedPosition = clientPosition.lerp(serverPosition, interpolationFactor);
    
    // Apply interpolated position
    this.localPlayerEntity.addComponent<PositionComponent>({
      type: 'position',
      value: interpolatedPosition
    });
    
    Logger.debugExpensive(LogCategory.NETWORK, () => 
      `Interpolated position: ${clientPosition.toString()} -> ${interpolatedPosition.toString()} (${interpolationFactor * 100}% towards server)`
    );
  }

  // TASK 8 ENHANCEMENT: Enhanced input replay with better timing and validation
  private replayInputsFromPosition(serverPosition: Vector3): void {
    if (!this.localPlayerEntity) return;
    
    // TASK 8 ENHANCEMENT: Set position directly to server position for replay (no double interpolation)
    this.localPlayerEntity.addComponent<PositionComponent>({
      type: 'position',
      value: serverPosition
    });
    
    // TASK 8 ENHANCEMENT: Replay inputs AFTER the acknowledged sequence with validation
    const inputsToReplay = this.inputHistory.filter(input => 
      input.sequenceNumber > this.lastProcessedSequence
    );
    
    Logger.debug(LogCategory.NETWORK, `Replaying ${inputsToReplay.length} inputs after sequence ${this.lastProcessedSequence}`);
    
    // TASK 8 ENHANCEMENT: Replay with proper timing and validation
    for (const inputSnapshot of inputsToReplay) {
      // Validate input before replaying
      if (this.isValidInput(inputSnapshot.input)) {
        const inputComponent: InputComponent = {
          type: 'input',
          ...inputSnapshot.input
        };
        
        // TASK 8 ENHANCEMENT: Use exact timing from snapshot
        const timeSinceSnapshot = (performance.now() - inputSnapshot.timestamp) / 1000;
        const replayDeltaTime = Math.max(0.001, Math.min(0.1, timeSinceSnapshot)); // Clamp between 1ms and 100ms
        
        this.applyMovement(this.localPlayerEntity, inputComponent, replayDeltaTime);
      } else {
        Logger.warn(LogCategory.NETWORK, `Invalid input in replay: ${JSON.stringify(inputSnapshot.input)}`);
      }
    }
    
    Logger.debug(LogCategory.NETWORK, `Replayed ${inputsToReplay.length} inputs after reconciliation`);
  }

  // TASK 8 ENHANCEMENT: Input validation for replay
  private isValidInput(input: any): boolean {
    return input && 
           typeof input.forward === 'boolean' &&
           typeof input.backward === 'boolean' &&
           typeof input.turnLeft === 'boolean' &&
           typeof input.turnRight === 'boolean';
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