// Network Tick System - Controls network update frequency and implements proper multiplayer patterns

import { System, Entity, PositionComponent, RotationComponent, VelocityComponent, NetworkComponent } from '../ecs';
import { EventBus, GameEvents } from '../core/EventBus';
import { Vector3, Rotation } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';

interface NetworkTick {
  sequenceNumber: number;
  timestamp: number;
  playerStates: Map<string, PlayerSnapshot>;
}

interface PlayerSnapshot {
  position: Vector3;
  rotation: Rotation;
  velocity: Vector3;
  timestamp: number;
}

interface PendingUpdate {
  sequenceNumber: number;
  timestamp: number;
  position: Vector3;
  rotation: Rotation;
  velocity: Vector3;
}

export class NetworkTickSystem extends System {
  // Network constants based on multiplayer research
  private static readonly TICK_RATE = 5; // TASK URGENTA.10: Reduced from 10Hz to 5Hz
  private static readonly TICK_INTERVAL = 1000 / NetworkTickSystem.TICK_RATE; // 200ms
  private static readonly MAX_PREDICTION_TIME = 150; // Max client prediction ahead
  // CHEN'S FIX: Professional lag compensation threshold (1-2cm like real games)
  private static readonly RECONCILIATION_THRESHOLD = 0.02; // 2cm threshold like CS:GO/Valorant
  
  private sequenceNumber = 0;
  // Removed: now using independent timer instead of accumulator
  
  // Client-side prediction state
  private localPlayerEntity: Entity | null = null;
  private pendingUpdates: PendingUpdate[] = [];
  private lastAcknowledgedUpdate = 0;
  
  // State history for lag compensation  
  private stateHistory: NetworkTick[] = [];
  private readonly MAX_HISTORY_SIZE = 100; // 10 seconds at 10Hz
  
  constructor(
    eventBus: EventBus,
    private websocket: WebSocket | null = null
  ) {
    super(eventBus, ['position', 'rotation', 'network'], 'NetworkTickSystem');
    
    // Listen for movement to queue for next tick
    this.eventBus.subscribe(GameEvents.PLAYER_MOVED, this.queueLocalMovement.bind(this));
    this.eventBus.subscribe(GameEvents.SERVER_STATE_UPDATE, this.handleServerUpdate.bind(this));
  }

  setWebSocket(websocket: WebSocket): void {
    this.websocket = websocket;
  }

  // ZERO'S CHEN-INSPIRED FIX: Separate network timing from render timing
  private networkTimer: number | null = null;

  startNetworkTimer(): void {
    if (this.networkTimer) return;
    
    // Run on SEPARATE timer - like Source Engine
    this.networkTimer = window.setInterval(() => {
      this.networkTick();
    }, NetworkTickSystem.TICK_INTERVAL);
    
    // Timer started
    Logger.info(LogCategory.NETWORK, 'Started independent 5Hz network timer'); // TASK URGENTA.10: Updated to reflect new rate
  }

  stopNetworkTimer(): void {
    if (this.networkTimer) {
      clearInterval(this.networkTimer);
      this.networkTimer = null;
      Logger.info(LogCategory.NETWORK, 'Stopped network timer');
    }
  }

  update(_deltaTime: number): void {
    // Only cleanup on render updates, network runs independently
    this.cleanupStateHistory();
    this.cleanupPendingUpdates();
  }

  private networkTick(): void {
    const now = performance.now();
    
    // Find local player
    if (!this.localPlayerEntity) {
      this.findLocalPlayer();
    }
    
    if (this.localPlayerEntity && this.websocket?.readyState === WebSocket.OPEN) {
      this.sendLocalPlayerState(now);
    }
    
    // Record current state in history
    this.recordStateSnapshot(now);
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

  private sendLocalPlayerState(timestamp: number): void {
    if (!this.localPlayerEntity) return;
    
    const position = this.localPlayerEntity.getComponent<PositionComponent>('position');
    const rotation = this.localPlayerEntity.getComponent<RotationComponent>('rotation');
    const velocity = this.localPlayerEntity.getComponent<VelocityComponent>('velocity');
    const network = this.localPlayerEntity.getComponent<NetworkComponent>('network');
    
    if (!position || !rotation || !network) return;
    
    this.sequenceNumber++;
    
    const updateData = {
      type: 'player_state',
      sequenceNumber: this.sequenceNumber,
      timestamp: timestamp,
      squirrelId: network.squirrelId,
      position: {
        x: position.value.x,
        y: position.value.y, 
        z: position.value.z
      },
      rotation: {
        y: rotation.value.y
      },
      velocity: velocity ? {
        x: velocity.value.x,
        y: velocity.value.y,
        z: velocity.value.z
      } : { x: 0, y: 0, z: 0 }
    };
    
    // Store pending update for reconciliation
    this.pendingUpdates.push({
      sequenceNumber: this.sequenceNumber,
      timestamp: timestamp,
      position: position.value,
      rotation: rotation.value,
      velocity: velocity?.value || new Vector3(0, 0, 0)
    });
    
    // Use compression system instead of direct send
    this.eventBus.emit('network.queue_message', {
      type: 'player_state',
      data: updateData,
      priority: 'medium'
    });
    
    // CHEN'S FIX: Use conditional logging for frequent operations
    Logger.debugExpensive(LogCategory.NETWORK, () => `Queued update ${this.sequenceNumber} for compression`);
  }

  private queueLocalMovement(_data: any): void {
    // Movement is queued and will be sent on next network tick
    // This prevents spam and ensures fixed rate
    Logger.debugExpensive(LogCategory.INPUT, () => `Movement queued for next tick`);
  }

  private handleServerUpdate(data: {
    acknowledgedSequence?: number;
    serverTimestamp: number;
    position?: Vector3;
    rotation?: Rotation;
    otherPlayers?: any[];
  }): void {
    Logger.debugExpensive(LogCategory.NETWORK, () => `Server update received with ack: ${data.acknowledgedSequence}`);
    
    // CHEN'S FIX: Properly acknowledge server input sequences
    if (data.acknowledgedSequence) {
      this.acknowledgeServerSequence(data.acknowledgedSequence);
    }
    
    // Handle server reconciliation
    if (data.acknowledgedSequence && data.position) {
      this.performServerReconciliation(data.acknowledgedSequence, data.position, data.rotation!);
    }
    
    // Update other players (handled by existing systems)
    if (data.otherPlayers) {
      for (const player of data.otherPlayers) {
        this.eventBus.emit(GameEvents.REMOTE_PLAYER_UPDATED, {
          entityId: player.squirrelId,
          position: new Vector3(player.position.x, player.position.y, player.position.z),
          rotation: Rotation.fromRadians(player.rotation.y)
        });
      }
    }
  }

  private performServerReconciliation(acknowledgedSequence: number, serverPosition: Vector3, serverRotation: Rotation): void {
    if (!this.localPlayerEntity) return;
    
    // Find the acknowledged update
    const acknowledgedUpdate = this.pendingUpdates.find(u => u.sequenceNumber === acknowledgedSequence);
    if (!acknowledgedUpdate) return;
    
    this.lastAcknowledgedUpdate = acknowledgedSequence;
    
    // Check if server position differs significantly from predicted position
    const positionDiff = acknowledgedUpdate.position.distanceTo(serverPosition);
    
    if (positionDiff > NetworkTickSystem.RECONCILIATION_THRESHOLD) {
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `Server reconciliation needed. Diff: ${positionDiff.toFixed(3)}m`
      );
      
      // Snap to server position
      this.localPlayerEntity.addComponent<PositionComponent>({
        type: 'position',
        value: serverPosition
      });
      
      this.localPlayerEntity.addComponent<RotationComponent>({
        type: 'rotation', 
        value: serverRotation
      });
      
      // Re-apply all inputs after the acknowledged update
      this.replayInputsAfterReconciliation(acknowledgedSequence);
      
      // Emit correction event for visual systems
      this.eventBus.emit('network.position_corrected', {
        entityId: this.localPlayerEntity.id.value,
        serverPosition,
        clientPosition: acknowledgedUpdate.position,
        difference: positionDiff
      });
    }
  }

  // CHEN'S FIX: Proper server acknowledgment system
  private acknowledgeServerSequence(acknowledgedSequence: number): void {
    this.lastAcknowledgedUpdate = Math.max(this.lastAcknowledgedUpdate, acknowledgedSequence);
    
    // Clean up acknowledged updates from pending list
    this.pendingUpdates = this.pendingUpdates.filter(update => 
      update.sequenceNumber > acknowledgedSequence
    );
    
    // Notify client prediction system
    this.eventBus.emit('network.server_acknowledged', {
      sequence: acknowledgedSequence,
      timestamp: performance.now()
    });
  }

  private replayInputsAfterReconciliation(fromSequence: number): void {
    // CHEN'S FIX: Actually implement input replay instead of just logging
    Logger.debug(LogCategory.NETWORK, `Replaying inputs from sequence ${fromSequence}`);
    
    // Find all pending updates after the acknowledged sequence
    const unacknowledgedUpdates = this.pendingUpdates.filter(update => 
      update.sequenceNumber > fromSequence
    );
    
    // Re-apply these updates in order
    for (const update of unacknowledgedUpdates) {
      if (this.localPlayerEntity) {
        this.localPlayerEntity.addComponent<PositionComponent>({
          type: 'position',
          value: update.position
        });
        this.localPlayerEntity.addComponent<RotationComponent>({
          type: 'rotation',
          value: update.rotation
        });
      }
    }
  }

  private recordStateSnapshot(timestamp: number): void {
    const snapshot: NetworkTick = {
      sequenceNumber: this.sequenceNumber,
      timestamp: timestamp,
      playerStates: new Map()
    };
    
    // Record all player states for lag compensation
    for (const entity of this.entities.values()) {
      const position = entity.getComponent<PositionComponent>('position');
      const rotation = entity.getComponent<RotationComponent>('rotation');
      const velocity = entity.getComponent<VelocityComponent>('velocity');
      const network = entity.getComponent<NetworkComponent>('network');
      
      if (position && rotation && network) {
        snapshot.playerStates.set(network.squirrelId, {
          position: position.value,
          rotation: rotation.value,
          velocity: velocity?.value || new Vector3(0, 0, 0),
          timestamp: timestamp
        });
      }
    }
    
    this.stateHistory.push(snapshot);
  }

  // CHEN'S FIX: Proper memory management - combine time AND size limits
  private cleanupStateHistory(): void {
    // First, remove by time (keep last 10 seconds)
    const cutoffTime = performance.now() - 10000; // 10 seconds
    this.stateHistory = this.stateHistory.filter(tick => tick.timestamp > cutoffTime);
    
    // Then, enforce size limit as backup (prevent unbounded growth)
    if (this.stateHistory.length > this.MAX_HISTORY_SIZE) {
      this.stateHistory = this.stateHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private cleanupPendingUpdates(): void {
    // Remove updates older than max prediction time
    const cutoffTime = performance.now() - NetworkTickSystem.MAX_PREDICTION_TIME;
    this.pendingUpdates = this.pendingUpdates.filter(update => update.timestamp > cutoffTime);
  }

  // Public methods for debugging and monitoring
  getNetworkStats(): {
    tickRate: number;
    pendingUpdates: number;
    historySize: number;
    lastAcknowledged: number;
  } {
    return {
      tickRate: NetworkTickSystem.TICK_RATE,
      pendingUpdates: this.pendingUpdates.length,
      historySize: this.stateHistory.length,
      lastAcknowledged: this.lastAcknowledgedUpdate
    };
  }
} 