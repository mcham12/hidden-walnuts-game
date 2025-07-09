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
  // TASK 8 ENHANCEMENT: Improved reconciliation precision (1cm like modern competitive games)
  private static readonly RECONCILIATION_THRESHOLD = 0.01; // 1cm threshold for better precision
  
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
    Logger.debug(LogCategory.NETWORK, 'Started independent 5Hz network timer'); // TASK URGENTA.10: Updated to reflect new rate
  }

  stopNetworkTimer(): void {
    if (this.networkTimer) {
      clearInterval(this.networkTimer);
      this.networkTimer = null;
      Logger.debug(LogCategory.NETWORK, 'Stopped network timer');
    }
  }

  update(_deltaTime: number): void {
    // Only cleanup on render updates, network runs independently
    this.cleanupStateHistory();
    this.cleanupPendingUpdates();
  }

  private networkTick(): void {
    const now = performance.now();
    
    // TASK 8 PHASE 3: Track tick performance
    this.trackNetworkPerformance('tick');
    
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
    
    // TASK 8 PHASE 3: Track update performance
    this.trackNetworkPerformance('update');
    
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

  // TASK 8 ENHANCEMENT: Enhanced reconciliation with velocity-based prediction and interpolation
  private performServerReconciliation(acknowledgedSequence: number, serverPosition: Vector3, serverRotation: Rotation): void {
    if (!this.localPlayerEntity) return;
    
    // Find the acknowledged update
    const acknowledgedUpdate = this.pendingUpdates.find(u => u.sequenceNumber === acknowledgedSequence);
    if (!acknowledgedUpdate) return;
    
    this.lastAcknowledgedUpdate = acknowledgedSequence;
    
    // TASK 8 ENHANCEMENT: Enhanced position difference calculation with velocity consideration
    const positionDiff = acknowledgedUpdate.position.distanceTo(serverPosition);
    const velocityDiff = acknowledgedUpdate.velocity.distanceTo(new Vector3(0, 0, 0)); // Compare with zero velocity
    
    // TASK 8 ENHANCEMENT: Dynamic threshold based on velocity and movement state
    const dynamicThreshold = this.calculateDynamicThreshold(velocityDiff, positionDiff);
    
    if (positionDiff > dynamicThreshold) {
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `Server reconciliation needed. Diff: ${positionDiff.toFixed(3)}m, Velocity: ${velocityDiff.toFixed(3)}m/s, Threshold: ${dynamicThreshold.toFixed(3)}m`
      );
      
      // TASK 8 PHASE 3: Track reconciliation performance
      this.trackNetworkPerformance('reconciliation');
      
      // TASK 8 ENHANCEMENT: Smooth interpolation instead of snapping
      this.interpolateToServerPosition(serverPosition, serverRotation, acknowledgedUpdate.position);
      
      // Re-apply all inputs after the acknowledged update
      this.replayInputsAfterReconciliation(acknowledgedSequence);
      
      // Emit correction event for visual systems
      this.eventBus.emit('network.position_corrected', {
        entityId: this.localPlayerEntity.id.value,
        serverPosition,
        clientPosition: acknowledgedUpdate.position,
        difference: positionDiff,
        velocityDiff: velocityDiff,
        threshold: dynamicThreshold
      });
    } else {
      // TASK 8 ENHANCEMENT: Log when reconciliation is avoided due to improved precision
      Logger.debugExpensive(LogCategory.NETWORK, () => 
        `Reconciliation avoided. Diff: ${positionDiff.toFixed(3)}m < Threshold: ${dynamicThreshold.toFixed(3)}m`
      );
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

  // TASK 8 ENHANCEMENT: Calculate dynamic threshold based on velocity and movement state
  private calculateDynamicThreshold(velocityDiff: number, positionDiff: number): number {
    // Base threshold from static value
    let threshold = NetworkTickSystem.RECONCILIATION_THRESHOLD;
    
    // TASK 8 ENHANCEMENT: Adjust threshold based on velocity
    // Higher velocity = more lenient threshold (movement is expected)
    if (velocityDiff > 0.1) { // Moving
      threshold *= 1.5; // 50% more lenient when moving
    } else if (velocityDiff < 0.01) { // Stationary
      threshold *= 0.5; // 50% stricter when stationary
    }
    
    // TASK 8 ENHANCEMENT: Adjust threshold based on position difference magnitude
    // Large differences might indicate network issues, be more lenient
    if (positionDiff > 0.1) { // Large difference
      threshold *= 2.0; // More lenient for large corrections
    }
    
    return Math.max(0.005, Math.min(0.05, threshold)); // Clamp between 5mm and 5cm
  }

  // TASK 8 ENHANCEMENT: Smooth interpolation to server position
  private interpolateToServerPosition(serverPosition: Vector3, serverRotation: Rotation, clientPosition: Vector3): void {
    if (!this.localPlayerEntity) return;
    
    // TASK 8 ENHANCEMENT: Use lerp for smooth transition instead of snapping
    const interpolationFactor = 0.8; // 80% towards server position
    
    const interpolatedPosition = clientPosition.lerp(serverPosition, interpolationFactor);
    
    // Apply interpolated position
    this.localPlayerEntity.addComponent<PositionComponent>({
      type: 'position',
      value: interpolatedPosition
    });
    
    this.localPlayerEntity.addComponent<RotationComponent>({
      type: 'rotation', 
      value: serverRotation // Keep rotation as-is for now
    });
    
    Logger.debugExpensive(LogCategory.NETWORK, () => 
      `Interpolated position: ${clientPosition.toString()} -> ${interpolatedPosition.toString()} (${interpolationFactor * 100}% towards server)`
    );
  }

  // TASK 8 ENHANCEMENT: Position validation for replay
  private isValidPosition(position: Vector3): boolean {
    // Basic bounds checking
    const maxDistance = 1000;
    return Math.abs(position.x) < maxDistance && 
           Math.abs(position.y) < maxDistance && 
           Math.abs(position.z) < maxDistance &&
           !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z);
  }

  // TASK 8 PHASE 2: Enhanced input validation for replay
  private isValidInputReplay(update: PendingUpdate): boolean {
    // Validate sequence number
    if (update.sequenceNumber <= this.lastAcknowledgedUpdate) {
      Logger.warn(LogCategory.NETWORK, `Invalid replay: sequence ${update.sequenceNumber} already acknowledged`);
      return false;
    }
    
    // Validate timestamp
    const now = performance.now();
    const age = now - update.timestamp;
    if (age > NetworkTickSystem.MAX_PREDICTION_TIME) {
      Logger.warn(LogCategory.NETWORK, `Invalid replay: update too old (${age.toFixed(0)}ms)`);
      return false;
    }
    
    // Validate position
    if (!this.isValidPosition(update.position)) {
      Logger.warn(LogCategory.NETWORK, `Invalid replay: invalid position ${update.position.toString()}`);
      return false;
    }
    
    // TASK 8 PHASE 2: Validate velocity consistency
    const velocityMagnitude = update.velocity.distanceTo(new Vector3(0, 0, 0));
    if (velocityMagnitude > 20) { // Max reasonable velocity
      Logger.warn(LogCategory.NETWORK, `Invalid replay: excessive velocity ${velocityMagnitude.toFixed(1)}`);
      return false;
    }
    
    return true;
  }

  private replayInputsAfterReconciliation(fromSequence: number): void {
    // TASK 8 ENHANCEMENT: Improved input replay with better timing
    Logger.debug(LogCategory.NETWORK, `Replaying inputs from sequence ${fromSequence}`);
    
    // Find all pending updates after the acknowledged sequence
    const unacknowledgedUpdates = this.pendingUpdates.filter(update => 
      update.sequenceNumber > fromSequence
    );
    
    // TASK 8 PHASE 2: Enhanced replay with validation
    let validReplays = 0;
    for (const update of unacknowledgedUpdates) {
      if (this.isValidInputReplay(update)) {
        if (this.localPlayerEntity) {
          this.localPlayerEntity.addComponent<PositionComponent>({
            type: 'position',
            value: update.position
          });
          this.localPlayerEntity.addComponent<RotationComponent>({
            type: 'rotation',
            value: update.rotation
          });
          validReplays++;
        }
      } else {
        Logger.warn(LogCategory.NETWORK, `Skipping invalid replay: sequence ${update.sequenceNumber}`);
      }
    }
    
    Logger.debug(LogCategory.NETWORK, `Replayed ${validReplays}/${unacknowledgedUpdates.length} valid inputs after reconciliation`);
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

  // TASK 8 PHASE 3: Performance metrics tracking
  private performanceMetrics = {
    totalTicks: 0,
    totalUpdates: 0,
    totalReconciliations: 0,
    averageTickTime: 0,
    lastTickTime: 0,
    memoryUsage: 0
  };

  // TASK 8 PHASE 3: Track network performance
  private trackNetworkPerformance(operation: 'tick' | 'update' | 'reconciliation'): void {
    const now = performance.now();
    
    switch (operation) {
      case 'tick':
        this.performanceMetrics.totalTicks++;
        this.performanceMetrics.lastTickTime = now;
        // Calculate average tick time
        this.performanceMetrics.averageTickTime = 
          (this.performanceMetrics.averageTickTime * (this.performanceMetrics.totalTicks - 1) + now) / 
          this.performanceMetrics.totalTicks;
        break;
      case 'update':
        this.performanceMetrics.totalUpdates++;
        break;
      case 'reconciliation':
        this.performanceMetrics.totalReconciliations++;
        break;
    }
    
    // Log performance metrics periodically (reduced frequency to reduce spam)
    if (this.performanceMetrics.totalTicks % 250 === 0) {
      Logger.debug(LogCategory.NETWORK, `Network performance: ${JSON.stringify(this.performanceMetrics)}`);
    }
  }

  // TASK 8 PHASE 3: Get network performance stats
  getNetworkPerformanceStats(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }
} 