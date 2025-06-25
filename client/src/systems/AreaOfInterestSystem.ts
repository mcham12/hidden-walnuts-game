// Area of Interest System - Optimizes network traffic by managing player visibility

import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

interface PlayerEntry {
  squirrelId: string;
  position: { x: number; y: number; z: number };
  lastUpdate: number;
  isInRange: boolean;
  distance: number;
}

export class AreaOfInterestSystem extends System {
  private static readonly INTEREST_RADIUS = 50; // 50 meters visibility range
  private static readonly CULLING_RADIUS = 100; // 100 meters complete culling
  private static readonly UPDATE_INTERVAL = 250; // Check every 250ms

  private localPlayerId: string | null = null;
  private localPosition: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private remotePlayers = new Map<string, PlayerEntry>();
  private lastUpdateTime = 0;

  constructor(eventBus: EventBus) {
    super(eventBus, [], 'AreaOfInterestSystem');
    
    // Listen for player state updates
    this.eventBus.subscribe('network.player_state_received', this.handlePlayerStateUpdate.bind(this));
    this.eventBus.subscribe('local_player_moved', this.handleLocalPlayerMove.bind(this));
    this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));
  }

  setLocalPlayer(squirrelId: string, position: { x: number; y: number; z: number }): void {
    this.localPlayerId = squirrelId;
    this.localPosition = { ...position };
  }

  update(_deltaTime: number): void {
    const now = performance.now();
    
    if (now - this.lastUpdateTime < AreaOfInterestSystem.UPDATE_INTERVAL) {
      return;
    }
    
    this.updateAreaOfInterest();
    this.lastUpdateTime = now;
  }

  private handlePlayerStateUpdate(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    velocity?: { x: number; y: number; z: number };
    timestamp: number;
  }): void {
    if (data.squirrelId === this.localPlayerId) {
      return; // Skip local player
    }

    const distance = this.calculateDistance(this.localPosition, data.position);
    
    // Update or create player entry
    const player: PlayerEntry = {
      squirrelId: data.squirrelId,
      position: data.position,
      lastUpdate: data.timestamp,
      isInRange: distance <= AreaOfInterestSystem.INTEREST_RADIUS,
      distance
    };
    
    const wasInRange = this.remotePlayers.get(data.squirrelId)?.isInRange || false;
    this.remotePlayers.set(data.squirrelId, player);
    
    // Handle entering/leaving interest area
    if (player.isInRange && !wasInRange) {
      Logger.debug(LogCategory.SPATIAL, `Player ${data.squirrelId} entered interest range (${distance.toFixed(1)}m)`);
      this.eventBus.emit('player_entered_interest', { squirrelId: data.squirrelId, distance });
    } else if (!player.isInRange && wasInRange) {
      Logger.debug(LogCategory.SPATIAL, `Player ${data.squirrelId} left interest range (${distance.toFixed(1)}m)`);
      this.eventBus.emit('player_left_interest', { squirrelId: data.squirrelId, distance });
    }

    // Cull if beyond maximum range
    if (distance > AreaOfInterestSystem.CULLING_RADIUS) {
      Logger.debugExpensive(LogCategory.SPATIAL, () => `Culling distant player ${data.squirrelId} (${distance.toFixed(1)}m)`);
      this.remotePlayers.delete(data.squirrelId);
      this.eventBus.emit('player_culled', { squirrelId: data.squirrelId, distance });
    }
  }

  private handleLocalPlayerMove(data: {
    position: { x: number; y: number; z: number };
  }): void {
    this.localPosition = { ...data.position };
  }

  private handlePlayerDisconnected(data: { squirrelId: string }): void {
    if (this.remotePlayers.has(data.squirrelId)) {
      Logger.debug(LogCategory.SPATIAL, `Removed disconnected player ${data.squirrelId} from area tracking`);
      this.remotePlayers.delete(data.squirrelId);
    }
  }

  private updateAreaOfInterest(): void {
    if (!this.localPlayerId) return;

    let playersInRange = 0;
    let playersCulled = 0;

    for (const [squirrelId, player] of this.remotePlayers) {
      const distance = this.calculateDistance(this.localPosition, player.position);
      const wasInRange = player.isInRange;
      
      player.distance = distance;
      player.isInRange = distance <= AreaOfInterestSystem.INTEREST_RADIUS;
      
      if (player.isInRange) {
        playersInRange++;
        
        // Calculate update frequency based on distance
        const updateFrequency = this.calculateUpdateFrequency(distance);
        this.eventBus.emit('set_player_update_frequency', {
          squirrelId,
          frequency: updateFrequency
        });
      }
      
      // Handle range transitions
      if (player.isInRange && !wasInRange) {
        this.eventBus.emit('player_entered_interest', { squirrelId, distance });
      } else if (!player.isInRange && wasInRange) {
        this.eventBus.emit('player_left_interest', { squirrelId, distance });
      }
      
      // Cull distant players
      if (distance > AreaOfInterestSystem.CULLING_RADIUS) {
        this.remotePlayers.delete(squirrelId);
        this.eventBus.emit('player_culled', { squirrelId, distance });
        playersCulled++;
      }
    }

    // Performance logging (only when significant activity)
    if (playersInRange > 0 || playersCulled > 0) {
      Logger.debugExpensive(LogCategory.SPATIAL, () => 
        `AOI Update: ${playersInRange} in range, ${playersCulled} culled, ${this.remotePlayers.size} total tracked`
      );
    }
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private calculateUpdateFrequency(distance: number): number {
    // Closer players get higher frequency updates
    if (distance <= 10) return 20; // 20Hz for very close players
    if (distance <= 25) return 10; // 10Hz for medium distance
    if (distance <= 40) return 5;  // 5Hz for far players
    return 2; // 2Hz for edge of range
  }

  // Public API for debugging and monitoring
  getAreaStats(): {
    totalTracked: number;
    inRange: number;
    averageDistance: number;
    cullingRadius: number;
    interestRadius: number;
  } {
    const inRangePlayers = Array.from(this.remotePlayers.values()).filter(p => p.isInRange);
    const totalDistance = inRangePlayers.reduce((sum, p) => sum + p.distance, 0);
    
    return {
      totalTracked: this.remotePlayers.size,
      inRange: inRangePlayers.length,
      averageDistance: inRangePlayers.length > 0 ? totalDistance / inRangePlayers.length : 0,
      cullingRadius: AreaOfInterestSystem.CULLING_RADIUS,
      interestRadius: AreaOfInterestSystem.INTEREST_RADIUS
    };
  }

  getPlayersInRange(): string[] {
    return Array.from(this.remotePlayers.values())
      .filter(p => p.isInRange)
      .map(p => p.squirrelId);
  }

  isPlayerInRange(squirrelId: string): boolean {
    return this.remotePlayers.get(squirrelId)?.isInRange || false;
  }

  getPlayerDistance(squirrelId: string): number | null {
    return this.remotePlayers.get(squirrelId)?.distance || null;
  }
} 