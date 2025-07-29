// Area of Interest System - Optimizes network traffic by managing player visibility

import { System } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { GameEvents } from '../core/EventBus';

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
  private isInitialized = false;

  constructor(eventBus: EventBus) {
    super(eventBus, [], 'AreaOfInterestSystem');
    
    // Validate eventBus
    if (!eventBus) {
      throw new Error('AreaOfInterestSystem requires a valid EventBus');
    }
    
    // BEST PRACTICE: Remove complex event chains - PlayerManager now handles visibility directly
    // REMOVED: this.eventBus.subscribe('remote_player_state', this.handlePlayerStateUpdate.bind(this));
    // REMOVED: this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));  
    // REMOVED: this.eventBus.subscribe('remote_player_created', this.handleRemotePlayerCreated.bind(this));
    
    // Only keep local player movement for position tracking
    try {
      this.eventBus.subscribe(GameEvents.PLAYER_MOVED, this.handleLocalPlayerMove.bind(this));
      
      this.isInitialized = true;
      Logger.info(LogCategory.SPATIAL, `🎯 AreaOfInterestSystem initialized - Tracking local player position only`);
      Logger.info(LogCategory.SPATIAL, `🔧 Complex event chains removed - PlayerManager handles visibility directly`);
    } catch (error) {
      Logger.error(LogCategory.SPATIAL, `❌ Failed to initialize AreaOfInterestSystem:`, error);
      throw error;
    }
  }

  setLocalPlayer(squirrelId: string, position: { x: number; y: number; z: number }): void {
    if (!squirrelId || !position) {
      Logger.error(LogCategory.SPATIAL, `❌ Invalid parameters for setLocalPlayer: squirrelId=${squirrelId}, position=`, position);
      return;
    }
    
    this.localPlayerId = squirrelId;
    this.localPosition = { ...position };
    Logger.info(LogCategory.SPATIAL, `🎯 Set local player: ${squirrelId} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }

  update(_deltaTime: number): void {
    if (!this.isInitialized) {
      Logger.warn(LogCategory.SPATIAL, `⚠️ AreaOfInterestSystem not initialized, skipping update`);
      return;
    }
    
    const now = performance.now();
    
    if (now - this.lastUpdateTime < AreaOfInterestSystem.UPDATE_INTERVAL) {
      return;
    }
    
    // Test log to verify system is being called
    Logger.debugExpensive(LogCategory.SPATIAL, () => `🔄 AreaOfInterestSystem update called - localPlayerId: ${this.localPlayerId}, remotePlayers: ${this.remotePlayers.size}`);
    
    try {
      this.updateAreaOfInterest();
      this.lastUpdateTime = now;
    } catch (error) {
      Logger.error(LogCategory.SPATIAL, `❌ Error in AreaOfInterestSystem update:`, error);
    }
  }

  // REMOVED: handlePlayerStateUpdate - PlayerManager now handles visibility directly
  // BEST PRACTICE: Eliminates complex event chains and async timing dependencies

  private handleLocalPlayerMove(data: {
    entityId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    characterId: string;
    sequenceNumber: number;
    predicted: boolean;
  }): void {
    if (!this.isInitialized) {
      Logger.warn(LogCategory.SPATIAL, `⚠️ AreaOfInterestSystem not initialized, ignoring local player move`);
      return;
    }
    
    Logger.debugExpensive(LogCategory.SPATIAL, () => `🎯 Local player moved to (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)}, ${data.position.z.toFixed(1)})`);
    this.localPosition = { ...data.position };
  }

  // REMOVED: handleRemotePlayerCreated, handlePlayerDisconnected
  // BEST PRACTICE: PlayerManager now handles all remote player lifecycle and visibility directly

  // BEST PRACTICE: Simplified - only track local player position now
  // PlayerManager handles all visibility directly, eliminating complex event chains
  private updateAreaOfInterest(): void {
    // AreaOfInterestSystem now only tracks local player position
    // All visibility determination moved to PlayerManager for direct, synchronous processing
    
    // Future optimization: Could provide distance-based update frequency hints to NetworkSystem
    // But no longer controls visibility through events
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