// Player Manager System - Handles remote player lifecycle and rendering

import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { EntityId } from '../core/types';
import * as THREE from 'three';

interface RemotePlayer {
  entity: Entity;
  squirrelId: string;
  mesh: THREE.Mesh | null;
  lastPosition: THREE.Vector3;
  lastRotation: THREE.Quaternion;
  lastUpdate: number;
  isVisible: boolean;
}

export class PlayerManager extends System {
  private remotePlayers = new Map<string, RemotePlayer>();
  private scene: THREE.Scene | null = null;
  private assetManager: any = null;

  constructor(eventBus: EventBus) {
    super(eventBus, [], 'PlayerManager');
    
    this.eventBus.subscribe('remote_player_state', this.handleRemotePlayerState.bind(this));
    this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));
    this.eventBus.subscribe('player_entered_interest', this.handlePlayerEnteredInterest.bind(this));
    this.eventBus.subscribe('player_left_interest', this.handlePlayerLeftInterest.bind(this));
    this.eventBus.subscribe('player_culled', this.handlePlayerCulled.bind(this));
    
    // Listen for scene initialization
    this.eventBus.subscribe('scene.initialized', () => {
      this.initializeWithSceneAndAssets();
    });
  }

  private async initializeWithSceneAndAssets(): Promise<void> {
    try {
      // Get scene and asset manager from container
      const { container, ServiceTokens } = await import('../core/Container');
      this.scene = (container.resolve(ServiceTokens.SCENE_MANAGER) as any).getScene();
      this.assetManager = container.resolve(ServiceTokens.ASSET_MANAGER);
      
      Logger.info(LogCategory.PLAYER, '✅ PlayerManager initialized with scene and assets');
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to initialize PlayerManager with scene', error);
    }
  }

  update(_deltaTime: number): void {
    // Update all remote players
    for (const [_squirrelId, player] of this.remotePlayers) {
      if (player.isVisible && player.mesh) {
        // Smooth interpolation would go here
        this.updatePlayerMesh(player, _deltaTime);
      }
    }
  }

  private handleRemotePlayerState(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    velocity?: { x: number; y: number; z: number };
    timestamp: number;
  }): void {
    const existing = this.remotePlayers.get(data.squirrelId);
    
    if (existing) {
      // Update existing player
      existing.lastPosition.set(data.position.x, data.position.y, data.position.z);
      existing.lastRotation.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
      existing.lastUpdate = data.timestamp;
      
      Logger.debugExpensive(LogCategory.PLAYER, () => 
        `🔄 Updated remote player ${data.squirrelId} at (${data.position.x.toFixed(1)}, ${data.position.z.toFixed(1)})`
      );
    } else {
      // Create new remote player
      Logger.info(LogCategory.PLAYER, `🆕 Creating new remote player: ${data.squirrelId}`);
      this.createRemotePlayer(data);
    }
  }

  private async createRemotePlayer(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
  }): Promise<void> {
    Logger.info(LogCategory.PLAYER, `🎯 Creating remote player: ${data.squirrelId}`);
    
    // Create entity
    const entity = new Entity(EntityId.generate());
    
    // Create mesh if we have assets and scene
    let mesh: THREE.Mesh | null = null;
    if (this.assetManager && this.scene) {
      try {
        Logger.debug(LogCategory.PLAYER, `🎨 Loading squirrel model for ${data.squirrelId}`);
        const squirrelModel = await this.assetManager.loadSquirrelModel();
        
        if (squirrelModel) {
          // Clone the model for this player
          mesh = squirrelModel.clone() as THREE.Mesh;
          mesh.position.set(data.position.x, data.position.y, data.position.z);
          mesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
          mesh.scale.set(1, 1, 1);
          
          // Make it slightly different color to distinguish from local player
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const material = child.material.clone();
              if (material instanceof THREE.MeshStandardMaterial) {
                // Slightly darker for remote players
                material.color.multiplyScalar(0.8);
              }
              child.material = material;
            }
          });
          
          this.scene.add(mesh);
          Logger.info(LogCategory.PLAYER, `✅ Added mesh for remote player ${data.squirrelId}`);
        }
        
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to load squirrel model for ${data.squirrelId}`, error);
      }
    } else {
      Logger.warn(LogCategory.PLAYER, `⚠️ Scene or AssetManager not ready for ${data.squirrelId}, will retry later`);
    }
    
    const remotePlayer: RemotePlayer = {
      entity,
      squirrelId: data.squirrelId,
      mesh,
      lastPosition: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
      lastRotation: new THREE.Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w),
      lastUpdate: performance.now(),
      isVisible: true
    };
    
    this.remotePlayers.set(data.squirrelId, remotePlayer);
    Logger.info(LogCategory.PLAYER, `🎮 Remote player ${data.squirrelId} created successfully (${this.remotePlayers.size} total remote players)`);
  }

  private handlePlayerDisconnected(data: { squirrelId: string }): void {
    const player = this.remotePlayers.get(data.squirrelId);
    if (player) {
      // Remove mesh from scene
      if (player.mesh && this.scene) {
        this.scene.remove(player.mesh);
        Logger.debug(LogCategory.PLAYER, `🗑️ Removed mesh for disconnected player ${data.squirrelId}`);
      }
      
      // Remove from tracking
      this.remotePlayers.delete(data.squirrelId);
      Logger.info(LogCategory.PLAYER, `👋 Removed disconnected player: ${data.squirrelId} (${this.remotePlayers.size} remaining)`);
    }
  }

  private handlePlayerEnteredInterest(data: { squirrelId: string; distance: number }): void {
    const player = this.remotePlayers.get(data.squirrelId);
    if (player && !player.isVisible) {
      player.isVisible = true;
      if (player.mesh) {
        player.mesh.visible = true;
      }
      Logger.debug(LogCategory.PLAYER, `👁️ Player ${data.squirrelId} entered interest range (${data.distance.toFixed(1)}m)`);
    }
  }

  private handlePlayerLeftInterest(data: { squirrelId: string; distance: number }): void {
    const player = this.remotePlayers.get(data.squirrelId);
    if (player && player.isVisible) {
      player.isVisible = false;
      if (player.mesh) {
        player.mesh.visible = false;
      }
      Logger.debug(LogCategory.PLAYER, `🙈 Player ${data.squirrelId} left interest range (${data.distance.toFixed(1)}m)`);
    }
  }

  private handlePlayerCulled(data: { squirrelId: string; distance: number }): void {
    const player = this.remotePlayers.get(data.squirrelId);
    if (player) {
      // Temporarily remove from scene but keep in memory for quick restoration
      if (player.mesh && this.scene) {
        this.scene.remove(player.mesh);
      }
      player.isVisible = false;
      Logger.debug(LogCategory.PLAYER, `✂️ Player ${data.squirrelId} culled at distance ${data.distance.toFixed(1)}m`);
    }
  }

  private updatePlayerMesh(player: RemotePlayer, _deltaTime: number): void {
    if (!player.mesh) return;
    
    // Simple position update (interpolation would be more complex)
    player.mesh.position.copy(player.lastPosition);
    player.mesh.quaternion.copy(player.lastRotation);
  }

  // Cleanup
  destroy(): void {
    for (const [squirrelId, player] of this.remotePlayers) {
      if (player.mesh && this.scene) {
        this.scene.remove(player.mesh);
      }
    }
    this.remotePlayers.clear();
  }

  // Debug information
  getVisiblePlayerCount(): number {
    return Array.from(this.remotePlayers.values()).filter(p => p.isVisible).length;
  }

  getPlayerMesh(squirrelId: string): THREE.Mesh | null {
    return this.remotePlayers.get(squirrelId)?.mesh || null;
  }

  getAllPlayers(): Map<string, RemotePlayer> {
    return this.remotePlayers;
  }

  // Debug information
  getPlayerStats(): {
    total: number;
    visible: number;
    withMesh: number;
    averageAge: number;
  } {
    const players = Array.from(this.remotePlayers.values());
    const now = performance.now();
    
    return {
      total: players.length,
      visible: players.filter(p => p.isVisible).length,
      withMesh: players.filter(p => p.mesh !== null).length,
      averageAge: players.length > 0 
        ? players.reduce((sum, p) => sum + (now - p.lastUpdate), 0) / players.length 
        : 0
    };
  }
} 