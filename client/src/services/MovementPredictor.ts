// Movement Predictor - Client-side prediction for responsive local player movement

export interface Position3D {
  x: number;
  y: number; 
  z: number;
}

export interface MovementState {
  position: Position3D;
  rotationY: number;
  velocity: { x: number; z: number };
  timestamp: number;
}

export interface MovementConfig {
  walkSpeed: number;
  runSpeed: number;
  rotationSpeed: number;
  acceleration: number;
  deceleration: number;
  groundHeight: number;
}

export class MovementPredictor {
  private currentState: MovementState;
  private serverState: MovementState | null = null;
  private stateHistory: MovementState[] = [];
  private config: MovementConfig;
  
  // Reconciliation settings
  private reconciliationThreshold = 0.1; // 10cm difference triggers reconciliation
  private maxHistorySize = 60; // Keep 1 second of history at 60fps
  
  constructor(initialPosition: Position3D, config: MovementConfig) {
    this.config = config;
    this.currentState = {
      position: { ...initialPosition },
      rotationY: 0,
      velocity: { x: 0, z: 0 },
      timestamp: performance.now()
    };
  }

  // Update movement based on input (called every frame)
  updateMovement(
    inputDirection: { x: number; z: number },
    mouseMovementX: number,
    isRunning: boolean,
    deltaTime: number
  ): MovementState {
    const now = performance.now();
    
    // Store current state in history for reconciliation
    this.addStateToHistory(this.currentState);
    
    // Update rotation based on mouse movement
    this.currentState.rotationY += mouseMovementX * this.config.rotationSpeed * deltaTime;
    
    // Normalize rotation to 0-2π range
    this.currentState.rotationY = this.currentState.rotationY % (Math.PI * 2);
    if (this.currentState.rotationY < 0) {
      this.currentState.rotationY += Math.PI * 2;
    }
    
    // Calculate target speed based on input and running state
    const targetSpeed = isRunning ? this.config.runSpeed : this.config.walkSpeed;
    const targetVelocity = {
      x: inputDirection.x * targetSpeed,
      z: inputDirection.z * targetSpeed
    };
    
    // Apply acceleration/deceleration
    const accel = (inputDirection.x !== 0 || inputDirection.z !== 0) ? 
      this.config.acceleration : this.config.deceleration;
    
    this.currentState.velocity.x = this.lerpVelocity(
      this.currentState.velocity.x, 
      targetVelocity.x, 
      accel * deltaTime
    );
    
    this.currentState.velocity.z = this.lerpVelocity(
      this.currentState.velocity.z,
      targetVelocity.z,
      accel * deltaTime
    );
    
    // Transform velocity based on player rotation
    const rotatedVelocity = this.rotateVelocity(
      this.currentState.velocity,
      this.currentState.rotationY
    );
    
    // Update position based on velocity
    this.currentState.position.x += rotatedVelocity.x * deltaTime;
    this.currentState.position.z += rotatedVelocity.z * deltaTime;
    
    // Keep player on ground
    this.currentState.position.y = this.config.groundHeight;
    
    // Update timestamp
    this.currentState.timestamp = now;
    
    return { ...this.currentState };
  }

  // Apply server reconciliation
  reconcileWithServer(serverState: MovementState): boolean {
    this.serverState = { ...serverState };
    
    // Find the client state that corresponds to the server timestamp
    const clientStateIndex = this.findStateByTimestamp(serverState.timestamp);
    
    if (clientStateIndex === -1) {
      // No matching client state found, trust the server
      this.currentState = { ...serverState };
      this.stateHistory = [];
      return true; // Position was corrected
    }
    
    const clientState = this.stateHistory[clientStateIndex];
    const positionDifference = this.calculateDistance(clientState.position, serverState.position);
    
    // Check if reconciliation is needed
    if (positionDifference > this.reconciliationThreshold) {
      console.log(`Reconciliation needed: ${positionDifference.toFixed(3)}m difference`);
      
      // Apply server correction
      this.currentState.position = { ...serverState.position };
      this.currentState.rotationY = serverState.rotationY;
      
      // Remove states older than server state to prevent re-prediction of old states
      this.stateHistory = this.stateHistory.slice(clientStateIndex + 1);
      
      return true; // Position was corrected
    }
    
    return false; // No correction needed
  }

  // Get current predicted state
  getCurrentState(): MovementState {
    return { ...this.currentState };
  }

  // Get server state (for debugging)
  getServerState(): MovementState | null {
    return this.serverState ? { ...this.serverState } : null;
  }

  // Get prediction accuracy metrics
  getPredictionMetrics(): { accuracy: number; averageError: number } {
    if (!this.serverState || this.stateHistory.length === 0) {
      return { accuracy: 100, averageError: 0 };
    }
    
    // Calculate average prediction error over recent history
    let totalError = 0;
    let samples = 0;
    
    for (let i = Math.max(0, this.stateHistory.length - 10); i < this.stateHistory.length; i++) {
      const state = this.stateHistory[i];
      const error = this.calculateDistance(state.position, this.serverState.position);
      totalError += error;
      samples++;
    }
    
    const averageError = samples > 0 ? totalError / samples : 0;
    const accuracy = Math.max(0, 100 - (averageError * 1000)); // Convert to percentage
    
    return { accuracy, averageError };
  }

  // Helper methods
  private addStateToHistory(state: MovementState): void {
    this.stateHistory.push({ ...state });
    
    // Keep history size manageable
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  private findStateByTimestamp(timestamp: number): number {
    // Find the state with the closest timestamp
    let closestIndex = -1;
    let closestDifference = Infinity;
    
    for (let i = 0; i < this.stateHistory.length; i++) {
      const difference = Math.abs(this.stateHistory[i].timestamp - timestamp);
      if (difference < closestDifference) {
        closestDifference = difference;
        closestIndex = i;
      }
    }
    
    // Only return if within reasonable time window (500ms)
    return closestDifference < 500 ? closestIndex : -1;
  }

  private calculateDistance(pos1: Position3D, pos2: Position3D): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private lerpVelocity(current: number, target: number, factor: number): number {
    const difference = target - current;
    if (Math.abs(difference) < 0.01) {
      return target;
    }
    return current + difference * Math.min(factor, 1.0);
  }

  private rotateVelocity(velocity: { x: number; z: number }, rotationY: number): { x: number; z: number } {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    
    return {
      x: velocity.x * cos - velocity.z * sin,
      z: velocity.x * sin + velocity.z * cos
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<MovementConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Reset predictor state
  reset(newPosition: Position3D): void {
    this.currentState = {
      position: { ...newPosition },
      rotationY: 0,
      velocity: { x: 0, z: 0 },
      timestamp: performance.now()
    };
    this.stateHistory = [];
    this.serverState = null;
  }
}