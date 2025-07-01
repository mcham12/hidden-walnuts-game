// Player Manager System - Handles remote player lifecycle and rendering

import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { EntityId } from '../core/types';
import * as THREE from 'three';

// Import TerrainService for height adjustment
import { TerrainService } from '../services/TerrainService';

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
  private terrainService: TerrainService | null = null; // Add terrain service

  constructor(eventBus: EventBus, terrainService: TerrainService) {
    super(eventBus, ['player'], 'PlayerManager');
    
    // Store terrain service directly
    this.terrainService = terrainService;
    
    // Subscribe to remote player events
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
    if (this.scene && this.assetManager) {
      return; // Already initialized
    }

    try {
      // Get scene and asset manager from container
      const { container, ServiceTokens } = await import('../core/Container');
      const sceneManager = container.resolve(ServiceTokens.SCENE_MANAGER) as any;
      
      // Wait for scene to be ready if it's not yet initialized
      let attempts = 0;
      while ((!this.scene || !this.assetManager) && attempts < 50) {
        try {
          this.scene = sceneManager.getScene();
          this.assetManager = container.resolve(ServiceTokens.ASSET_MANAGER);
          
          if (this.scene && this.assetManager) {
            break;
          }
        } catch (e) {
          // Scene might not be ready yet
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!this.scene || !this.assetManager) {
        throw new Error(`Failed to initialize after ${attempts} attempts`);
      }
      
      Logger.info(LogCategory.PLAYER, '✅ PlayerManager initialized with scene, assets, and terrain service');
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to initialize PlayerManager with scene and assets', error);
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

  private handleRemotePlayerState = async (data: any) => {
    Logger.info(LogCategory.PLAYER, '🎯 PLAYER MANAGER RECEIVED remote_player_state event for:', data.squirrelId);
    Logger.info(LogCategory.PLAYER, '📍 Player position:', data.position);
    Logger.info(LogCategory.PLAYER, '👥 Current remote players count BEFORE processing:', this.remotePlayers.size);
    Logger.info(LogCategory.PLAYER, '📊 Full event data:', JSON.stringify(data, null, 2));
    
    const existingPlayer = this.remotePlayers.get(data.squirrelId);
    if (existingPlayer) {
      Logger.debug(LogCategory.PLAYER, '🔄 UPDATING existing remote player:', data.squirrelId);
      // Update existing player
      if (data.position) {
        // FIXED: Adjust Y position to terrain height for updates
        let adjustedPosition = { ...data.position };
        if (this.terrainService) {
          try {
            const terrainHeight = await this.terrainService.getTerrainHeight(data.position.x, data.position.z);
            // Keep player 0.5 units above terrain (squirrel height)
            adjustedPosition.y = Math.max(data.position.y, terrainHeight + 0.5);
            Logger.debug(LogCategory.PLAYER, `📏 Adjusted remote player ${data.squirrelId} update height from ${data.position.y.toFixed(2)} to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`);
          } catch (error) {
            Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player update ${data.squirrelId}, using original Y position`, error);
            // Fallback: ensure player is at least 0.5 units above ground
            adjustedPosition.y = Math.max(data.position.y, 0.5);
          }
        } else {
          // No terrain service available, ensure minimum height
          adjustedPosition.y = Math.max(data.position.y, 0.5);
        }
        
        existingPlayer.lastPosition.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
        if (existingPlayer.mesh) {
          existingPlayer.mesh.position.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
        }
      }
      if (typeof data.rotationY === 'number') {
        existingPlayer.lastRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), data.rotationY);
        if (existingPlayer.mesh) {
          existingPlayer.mesh.rotation.y = data.rotationY;
        }
      }
      existingPlayer.lastUpdate = performance.now();
    } else {
      Logger.info(LogCategory.PLAYER, '🆕 CREATING new remote player:', data.squirrelId);
      // Create new remote player
      await this.createRemotePlayer({
        squirrelId: data.squirrelId,
        position: data.position,
        rotation: {
          x: 0,
          y: data.rotationY || 0,
          z: 0,
          w: 1
        }
      });
    }
    
    Logger.info(LogCategory.PLAYER, '👥 Current remote players count AFTER processing:', this.remotePlayers.size);
  };

  private async createRemotePlayer(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
  }): Promise<void> {
    Logger.info(LogCategory.PLAYER, `🎯 Creating remote player: ${data.squirrelId}`);
    
    // FIXED: Adjust Y position to terrain height
    let adjustedPosition = { ...data.position };
    if (this.terrainService) {
      try {
        const terrainHeight = await this.terrainService.getTerrainHeight(data.position.x, data.position.z);
        // Keep player 0.5 units above terrain (squirrel height)
        adjustedPosition.y = Math.max(data.position.y, terrainHeight + 0.5);
        Logger.debug(LogCategory.PLAYER, `📏 Adjusted remote player ${data.squirrelId} height from ${data.position.y.toFixed(2)} to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player ${data.squirrelId}, using original Y position`, error);
        // Fallback: ensure player is at least 0.5 units above ground
        adjustedPosition.y = Math.max(data.position.y, 0.5);
      }
    } else {
      // No terrain service available, ensure minimum height
      adjustedPosition.y = Math.max(data.position.y, 0.5);
    }
    
    // Create entity
    const entity = new Entity(EntityId.generate());
    
    // Wait for scene and assets to be ready
    if (!this.scene || !this.assetManager) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Scene or AssetManager not ready for ${data.squirrelId}, initializing...`);
      await this.initializeWithSceneAndAssets();
    }

    // Create mesh if we have assets and scene
    let mesh: THREE.Mesh | null = null;
    if (this.assetManager && this.scene) {
      try {
        Logger.debug(LogCategory.PLAYER, `🎨 Loading squirrel model for ${data.squirrelId}`);
        const squirrelModel = await this.assetManager.loadSquirrelModel();
        
        if (squirrelModel) {
          // Clone the model for this player
          mesh = squirrelModel.clone() as THREE.Mesh;
          mesh.position.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
          mesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
          // FIXED: Set smaller scale to prevent huge flat squirrels
          mesh.scale.set(0.3, 0.3, 0.3);
          
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
          Logger.info(LogCategory.PLAYER, `✅ Added mesh for remote player ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
        } else {
          Logger.error(LogCategory.PLAYER, `❌ Failed to load squirrel model for ${data.squirrelId}: model was null`);
        }
        
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to load squirrel model for ${data.squirrelId}`, error);
      }
    } else {
      Logger.error(LogCategory.PLAYER, `❌ Scene (${!!this.scene}) or AssetManager (${!!this.assetManager}) not available for ${data.squirrelId}`);
    }
    
    const remotePlayer: RemotePlayer = {
      entity,
      squirrelId: data.squirrelId,
      mesh,
      lastPosition: new THREE.Vector3(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z),
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
    for (const [, player] of this.remotePlayers) {
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