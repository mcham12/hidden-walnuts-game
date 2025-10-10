// Movement Interpolator - Smooth interpolation for remote player movements

export interface InterpolationTarget {
  position: { x: number; y: number; z: number };
  rotationY: number;
  timestamp: number;
}

export interface InterpolationState {
  current: InterpolationTarget;
  target: InterpolationTarget;
  velocity: { x: number; z: number };
  isInterpolating: boolean;
}

export class MovementInterpolator {
  private states = new Map<string, InterpolationState>();
  private interpolationSpeed = 8.0; // Higher = faster catch-up
  private maxInterpolationDistance = 5.0; // Max distance to interpolate smoothly
  private snapThreshold = 0.1; // Distance below which we snap to target
  private staleThreshold = 2000; // Threshold for considering data stale (2 seconds)

  // Add or update a player's interpolation target
  setTarget(playerId: string, newTarget: InterpolationTarget): void {
    
    if (!this.states.has(playerId)) {
      // First time seeing this player - initialize state
      this.states.set(playerId, {
        current: { ...newTarget },
        target: { ...newTarget },
        velocity: { x: 0, z: 0 },
        isInterpolating: false
      });
      console.log(`Initialized interpolation for player: ${playerId}`);
      return;
    }

    const state = this.states.get(playerId)!;
    
    // Calculate distance to new target
    const distance = this.calculateDistance(state.current.position, newTarget.position);
    
    // If too far, teleport instead of interpolating
    if (distance > this.maxInterpolationDistance) {
      console.log(`Teleporting player ${playerId}: distance ${distance.toFixed(2)}`);
      state.current = { ...newTarget };
      state.target = { ...newTarget };
      state.velocity = { x: 0, z: 0 };
      state.isInterpolating = false;
      return;
    }

    // Calculate velocity based on time difference
    const timeDelta = (newTarget.timestamp - state.target.timestamp) / 1000; // Convert to seconds
    if (timeDelta > 0) {
      state.velocity = {
        x: (newTarget.position.x - state.target.position.x) / timeDelta,
        z: (newTarget.position.z - state.target.position.z) / timeDelta
      };
    }

    // Update target
    state.target = { ...newTarget };
    state.isInterpolating = distance > this.snapThreshold;
    
    if (!state.isInterpolating) {
      // Snap to target if very close
      state.current = { ...newTarget };
    }
  }

  // Update interpolation for all players (call every frame)
  update(deltaTime: number): Map<string, InterpolationTarget> {
    const currentTime = performance.now();
    const updatedPositions = new Map<string, InterpolationTarget>();

    for (const [playerId, state] of this.states) {
      // Check if data is stale
      if (currentTime - state.target.timestamp > this.staleThreshold) {
        // Stop interpolating stale players
        state.isInterpolating = false;
        state.velocity = { x: 0, z: 0 };
        continue;
      }

      if (state.isInterpolating) {
        const updated = this.updatePlayerInterpolation(state, deltaTime);
        if (updated) {
          updatedPositions.set(playerId, state.current);
        }
      }
    }

    return updatedPositions;
  }

  // Update a single player's interpolation
  private updatePlayerInterpolation(state: InterpolationState, deltaTime: number): boolean {
    const current = state.current;
    const target = state.target;

    // Calculate distance to target
    const distance = this.calculateDistance(current.position, target.position);
    
    // Snap if very close
    if (distance < this.snapThreshold) {
      current.position = { ...target.position };
      current.rotationY = target.rotationY;
      state.isInterpolating = false;
      return true;
    }

    // Interpolate position
    const interpolationFactor = Math.min(1.0, this.interpolationSpeed * deltaTime);
    
    current.position.x = this.lerp(current.position.x, target.position.x, interpolationFactor);
    current.position.y = this.lerp(current.position.y, target.position.y, interpolationFactor);
    current.position.z = this.lerp(current.position.z, target.position.z, interpolationFactor);

    // Interpolate rotation (handle wrapping around 2π)
    current.rotationY = this.lerpAngle(current.rotationY, target.rotationY, interpolationFactor);

    // Update timestamp
    current.timestamp = performance.now();

    return true;
  }

  // Get current interpolated position for a player
  getCurrentPosition(playerId: string): InterpolationTarget | null {
    const state = this.states.get(playerId);
    return state ? { ...state.current } : null;
  }

  // Get velocity for a player (useful for animation states)
  getVelocity(playerId: string): { x: number; z: number } | null {
    const state = this.states.get(playerId);
    return state ? { ...state.velocity } : null;
  }

  // Check if player is currently interpolating
  isInterpolating(playerId: string): boolean {
    const state = this.states.get(playerId);
    return state ? state.isInterpolating : false;
  }

  // Remove a player from interpolation
  removePlayer(playerId: string): void {
    this.states.delete(playerId);
    console.log(`Removed interpolation for player: ${playerId}`);
  }

  // Get all players currently being interpolated
  getActivePlayers(): string[] {
    return Array.from(this.states.keys());
  }

  // Get interpolation debug info
  getDebugInfo(playerId: string): {
    current: InterpolationTarget;
    target: InterpolationTarget;
    velocity: { x: number; z: number };
    distance: number;
    isInterpolating: boolean;
    isStale: boolean;
  } | null {
    const state = this.states.get(playerId);
    if (!state) return null;

    const currentTime = performance.now();
    const distance = this.calculateDistance(state.current.position, state.target.position);
    const isStale = (currentTime - state.target.timestamp) > this.staleThreshold;

    return {
      current: { ...state.current },
      target: { ...state.target },
      velocity: { ...state.velocity },
      distance,
      isInterpolating: state.isInterpolating,
      isStale
    };
  }

  // Update interpolation settings
  updateSettings(settings: {
    interpolationSpeed?: number;
    maxInterpolationDistance?: number;
    snapThreshold?: number;
    staleThreshold?: number;
  }): void {
    if (settings.interpolationSpeed !== undefined) {
      this.interpolationSpeed = settings.interpolationSpeed;
    }
    if (settings.maxInterpolationDistance !== undefined) {
      this.maxInterpolationDistance = settings.maxInterpolationDistance;
    }
    if (settings.snapThreshold !== undefined) {
      this.snapThreshold = settings.snapThreshold;
    }
    if (settings.staleThreshold !== undefined) {
      this.staleThreshold = settings.staleThreshold;
    }
  }

  // Helper methods
  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  private lerpAngle(start: number, end: number, factor: number): number {
    // Handle angle wrapping for smooth rotation
    let diff = end - start;
    
    // Wrap to [-π, π]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    
    return start + diff * factor;
  }

  // Predict where a player will be based on current velocity
  predictPosition(playerId: string, timeAhead: number): InterpolationTarget | null {
    const state = this.states.get(playerId);
    if (!state) return null;

    const predicted: InterpolationTarget = {
      position: {
        x: state.current.position.x + state.velocity.x * timeAhead,
        y: state.current.position.y,
        z: state.current.position.z + state.velocity.z * timeAhead
      },
      rotationY: state.current.rotationY,
      timestamp: state.current.timestamp + timeAhead * 1000
    };

    return predicted;
  }

  // Clear all interpolation states
  clear(): void {
    this.states.clear();
  }
}