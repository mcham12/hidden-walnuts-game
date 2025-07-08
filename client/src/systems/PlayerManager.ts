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

// Utility: Recursively set scale on all mesh children with validation
function setMeshScaleRecursive(object: THREE.Object3D, scale: number) {
  // Set scale on the main object
  object.scale.set(scale, scale, scale);
  
  // Recursively set scale on all children
  object.traverse(child => {
    if (child !== object) {
      child.scale.set(scale, scale, scale);
    }
  });
  
  // Validate scale was applied correctly
  const actualScale = object.scale;
  if (Math.abs(actualScale.x - scale) > 0.01 || 
      Math.abs(actualScale.y - scale) > 0.01 || 
      Math.abs(actualScale.z - scale) > 0.01) {
    Logger.warn(LogCategory.PLAYER, `⚠️ Scale validation failed: expected=${scale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
    // Force correct scale
    object.scale.set(scale, scale, scale);
  }
}

export class PlayerManager extends System {
  private remotePlayers = new Map<string, RemotePlayer>();
  private scene: THREE.Scene | null = null;
  private assetManager: any = null;
  private terrainService: TerrainService | null = null; // Add terrain service
  private lastDebugTime: number | null = null;
  
  // TASK 3.2: Duplicate Player Prevention - Add tracking
  private trackedSquirrelIds = new Set<string>();
  private entityToSquirrelId = new Map<string, string>(); // entityId -> squirrelId mapping
  
  // TASK 3 FIX: Model caching for faster remote player creation
  private cachedSquirrelModel: THREE.Object3D | null = null;
  private modelLoadingPromise: Promise<THREE.Object3D> | null = null;

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
      
      // TASK 3 FIX: Preload squirrel model for faster remote player creation
      await this.preloadSquirrelModel();
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to initialize PlayerManager with scene and assets', error);
    }
  }

  // TASK 3 FIX: Model caching for faster remote player creation
  private async preloadSquirrelModel(): Promise<void> {
    if (this.cachedSquirrelModel || this.modelLoadingPromise) {
      return; // Already loading or loaded
    }

    if (!this.assetManager) {
      Logger.warn(LogCategory.PLAYER, '⚠️ AssetManager not ready for model preloading');
      return;
    }

    this.modelLoadingPromise = this.loadSquirrelModel();
    try {
      this.cachedSquirrelModel = await this.modelLoadingPromise;
      Logger.debug(LogCategory.PLAYER, '✅ Squirrel model preloaded for remote players');
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to preload squirrel model', error);
    } finally {
      this.modelLoadingPromise = null;
    }
  }

  private async loadSquirrelModel(): Promise<THREE.Object3D> {
    if (!this.assetManager) {
      throw new Error('AssetManager not available');
    }

    try {
      const squirrelModel = await this.assetManager.loadSquirrelModel();
      if (!squirrelModel) {
        throw new Error('Failed to load squirrel model - model is null');
      }

      return squirrelModel;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to load squirrel model:', error);
      throw new Error(`Squirrel model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  update(_deltaTime: number): void {
    // Update all remote players
    for (const [_squirrelId, player] of this.remotePlayers) {
      if (player.isVisible && player.mesh) {
        // Smooth interpolation would go here
        this.updatePlayerMesh(player, _deltaTime);
        
        // TASK 8 FIX: Runtime scale validation to catch any scaling issues
        const targetScale = 0.3;
        const actualScale = player.mesh.scale;
        if (Math.abs(actualScale.x - targetScale) > 0.01 || 
            Math.abs(actualScale.y - targetScale) > 0.01 || 
            Math.abs(actualScale.z - targetScale) > 0.01) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Runtime scale correction for ${_squirrelId}: expected=${targetScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
          setMeshScaleRecursive(player.mesh, targetScale);
        }
      }
    }
    
    // TASK URGENTA.9: Reduced debug frequency from 10 to 60 seconds
    const now = performance.now();
    if (!this.lastDebugTime || now - this.lastDebugTime > 60000) {
      this.debugSceneContents();
      this.lastDebugTime = now;
    }
  }

  private handleRemotePlayerState = async (data: any) => {
    Logger.debugExpensive(LogCategory.PLAYER, () => `🎯 PLAYER MANAGER RECEIVED remote_player_state event for: ${data.squirrelId}`);
    
    // TASK 3 FIX: Check if PlayerManager is ready
    if (!this.scene || !this.assetManager) {
      Logger.warn(LogCategory.PLAYER, `⚠️ PlayerManager not ready for ${data.squirrelId}, initializing...`);
      await this.initializeWithSceneAndAssets();
    }
    
    // TASK 3 FIX: Enhanced duplicate detection and validation
    if (!data.squirrelId || typeof data.squirrelId !== 'string') {
      Logger.error(LogCategory.PLAYER, '❌ Invalid squirrelId in remote_player_state:', data.squirrelId);
      return;
    }
    
    // TASK 3.2: Check if this is the local player (should not create remote player for local player)
    const localSquirrelId = this.getLocalPlayerSquirrelId();
    if (localSquirrelId && data.squirrelId === localSquirrelId) {
      Logger.debug(LogCategory.PLAYER, `🎯 Skipping remote player creation for local player: ${data.squirrelId}`);
      return;
    }
    
    const existingPlayer = this.remotePlayers.get(data.squirrelId);
    if (existingPlayer) {
      Logger.debug(LogCategory.PLAYER, '🔄 UPDATING existing remote player:', data.squirrelId);
      
      // TASK 3 FIX: Additional validation for existing player
      if (existingPlayer.mesh) {
        // Check if mesh has correct scale
        const targetScale = 0.3;
        setMeshScaleRecursive(existingPlayer.mesh, targetScale);
      }
      
      // Update existing player
      if (data.position) {
        // TASK 3.1: Terrain Height Fixes - Enhanced height calculation for updates
        let adjustedPosition = { ...data.position };
        if (this.terrainService) {
          try {
            const terrainHeight = await this.terrainService.getTerrainHeight(data.position.x, data.position.z);
            // TASK 3.1: Use terrain height directly to prevent floating
            adjustedPosition.y = terrainHeight + 0.1; // Minimal offset for ground contact
            
            Logger.debugExpensive(LogCategory.PLAYER, () => 
              `📏 Adjusted remote player ${data.squirrelId} height to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`
            );
          } catch (error) {
            Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player update ${data.squirrelId}, using fallback`, error);
            // TASK 3.1: Improved fallback height calculation
            adjustedPosition.y = Math.max(data.position.y, 0.1);
          }
        } else {
          // TASK 3.1: Improved fallback when no terrain service
          adjustedPosition.y = Math.max(data.position.y, 0.1);
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
      Logger.debug(LogCategory.PLAYER, '🆕 CREATING new remote player:', data.squirrelId);
      
      // TASK 3.2: Duplicate Player Prevention - Check if already tracked
      if (this.trackedSquirrelIds.has(data.squirrelId)) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Duplicate remote player state for ${data.squirrelId}, skipping creation`);
        Logger.info(LogCategory.PLAYER, `🔍 Currently tracked players: ${Array.from(this.trackedSquirrelIds).join(', ')}`);
        Logger.info(LogCategory.PLAYER, `🔍 Currently rendered players: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
        return;
      }
      
      // TASK 3 FIX: Add validation before creating new player
      if (!data.position || typeof data.position.x !== 'number' || typeof data.position.y !== 'number' || typeof data.position.z !== 'number') {
        Logger.error(LogCategory.PLAYER, '❌ Invalid position data for new remote player:', data.squirrelId, data.position);
        return;
      }
      
      // TASK 3 FIX: Double-check we don't already have this player
      if (this.remotePlayers.has(data.squirrelId)) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Attempted to create duplicate player ${data.squirrelId}, skipping`);
        Logger.info(LogCategory.PLAYER, `🔍 Already rendered: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
        return;
      }
      
      // TASK 3.2: Duplicate Player Prevention - Mark as tracked before creation
      this.trackedSquirrelIds.add(data.squirrelId);
      
      // TASK 3 FIX: Log all existing players for debugging
      Logger.info(LogCategory.PLAYER, `🔍 Creating player ${data.squirrelId} - Current players: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
      
          // Create new remote player with error handling
    try {
      Logger.info(LogCategory.PLAYER, `🚀 Starting creation of remote player: ${data.squirrelId} as ${data.characterType || 'colobus'}`);
      await this.createRemotePlayer({
        squirrelId: data.squirrelId,
        position: data.position,
        rotation: {
          x: 0,
          y: data.rotationY || 0,
          z: 0,
          w: 1
        },
        characterType: data.characterType || 'colobus' // Use character type from network or default to colobus
      });
      Logger.info(LogCategory.PLAYER, `✅ Successfully created remote player: ${data.squirrelId} as ${data.characterType || 'colobus'}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player ${data.squirrelId}:`, error);
      // Clean up tracking on failure
      this.trackedSquirrelIds.delete(data.squirrelId);
      // Don't re-throw to prevent critical errors
    }
    }
    
    Logger.debugExpensive(LogCategory.PLAYER, () => `👥 Current remote players count AFTER processing: ${this.remotePlayers.size}`);
    Logger.debugExpensive(LogCategory.PLAYER, () => `🔍 All players after processing: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
  };

  private async createRemotePlayer(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    characterType?: string; // Optional character type from network
  }): Promise<void> {
    Logger.debug(LogCategory.PLAYER, `🎯 Creating remote player: ${data.squirrelId}`);
    
    // TASK 3.1: Terrain Height Fixes - Enhanced height calculation with performance optimization
    let adjustedPosition = { ...data.position };
    if (this.terrainService) {
      try {
        // Use a timeout to prevent blocking for too long
        const terrainHeight = await Promise.race([
          this.terrainService.getTerrainHeight(data.position.x, data.position.z),
          new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 100)) // 100ms timeout
        ]);
        // TASK 3.1: Use terrain height directly to prevent floating
        adjustedPosition.y = terrainHeight + 0.1; // Minimal offset for ground contact
        
        Logger.debug(LogCategory.PLAYER, `📏 Adjusted remote player ${data.squirrelId} height to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player ${data.squirrelId}, using fallback`, error);
        // TASK 3.1: Improved fallback height calculation
        adjustedPosition.y = Math.max(data.position.y, 0.1);
      }
    } else {
      // TASK 3.1: Improved fallback when no terrain service
      adjustedPosition.y = Math.max(data.position.y, 0.1);
    }
    
    // Create entity
    const entity = new Entity(EntityId.generate());
    
    // Wait for scene and assets to be ready
    if (!this.scene || !this.assetManager) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Scene or AssetManager not ready for ${data.squirrelId}, initializing...`);
      await this.initializeWithSceneAndAssets();
    }

    // Create mesh using PlayerFactory for proper character support
    let mesh: THREE.Mesh | null = null;
    if (this.scene) {
      try {
        Logger.debug(LogCategory.PLAYER, `🎨 Creating mesh for ${data.squirrelId} with character type: ${data.characterType || 'squirrel'}`);
        
        // Use PlayerFactory to create remote player with proper character support
        const { container, ServiceTokens } = await import('../core/Container');
        const playerFactory = container.resolve(ServiceTokens.PLAYER_FACTORY) as any;
        
        if (playerFactory && typeof playerFactory.createRemotePlayer === 'function') {
          // Create remote player using PlayerFactory
          const remoteEntity = await playerFactory.createRemotePlayer(
            data.squirrelId, 
            { x: adjustedPosition.x, y: adjustedPosition.y, z: adjustedPosition.z },
            { x: data.rotation.x, y: data.rotation.y, z: data.rotation.z, w: data.rotation.w },
            data.characterType || 'squirrel' // Use provided character type or default to squirrel
          );
          
                     // Get the mesh from the created entity
           const renderComponent = remoteEntity.getComponent('render');
           if (renderComponent && renderComponent.value.mesh) {
             const playerMesh = renderComponent.value.mesh;
             mesh = playerMesh;
             
             // Position the mesh
             playerMesh.position.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
             playerMesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
             
             // TASK 3.4: Player Scaling Consistency - Standardized scale values
             const targetScale = 0.3;
             setMeshScaleRecursive(playerMesh, targetScale);
             
             // TASK 3.4: Verify scale was set correctly with validation
             const actualScale = playerMesh.scale;
             if (Math.abs(actualScale.x - targetScale) > 0.01 || Math.abs(actualScale.y - targetScale) > 0.01 || Math.abs(actualScale.z - targetScale) > 0.01) {
               Logger.warn(LogCategory.PLAYER, `⚠️ Scale validation failed for ${data.squirrelId}: expected=${targetScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
               // Force correct scale
               playerMesh.scale.set(targetScale, targetScale, targetScale);
             } else {
               Logger.debug(LogCategory.PLAYER, `✅ Scale validation passed for ${data.squirrelId}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
             }
             
             // Make it slightly different color to distinguish from local player
             playerMesh.traverse((child: THREE.Object3D) => {
               if (child instanceof THREE.Mesh && child.material) {
                 const material = child.material.clone();
                 if (material instanceof THREE.MeshStandardMaterial) {
                   // Slightly darker for remote players
                   material.color.multiplyScalar(0.8);
                 }
                 child.material = material;
               }
             });
             
             // TASK 3 FIX: Log scene operation
             Logger.debug(LogCategory.PLAYER, `🎭 Adding mesh to scene for ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
             this.scene.add(playerMesh);
             Logger.debug(LogCategory.PLAYER, `✅ Added mesh for remote player ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
           } else {
             Logger.error(LogCategory.PLAYER, `❌ Failed to get mesh from PlayerFactory for ${data.squirrelId}`);
             mesh = null; // Ensure mesh is null if we couldn't get it
           }
        } else {
          Logger.error(LogCategory.PLAYER, `❌ PlayerFactory not available for ${data.squirrelId}`);
        }
        
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player for ${data.squirrelId}`, error);
      }
    } else {
      Logger.error(LogCategory.PLAYER, `❌ Scene not available for ${data.squirrelId}`);
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
    
    // TASK 3.2: Duplicate Player Prevention - Track entity mapping
    this.entityToSquirrelId.set(entity.id.toString(), data.squirrelId);
    
    this.remotePlayers.set(data.squirrelId, remotePlayer);
    Logger.debug(LogCategory.PLAYER, `🎮 Remote player ${data.squirrelId} created successfully (${this.remotePlayers.size} total remote players)`);
  }

  private handlePlayerDisconnected(data: { squirrelId: string }): void {
    // TASK 3 FIX: Enhanced player cleanup with validation
    if (!data.squirrelId || typeof data.squirrelId !== 'string') {
      Logger.error(LogCategory.PLAYER, '❌ Invalid squirrelId in player_disconnected:', data.squirrelId);
      return;
    }
    
    const player = this.remotePlayers.get(data.squirrelId);
    if (player) {
      Logger.debug(LogCategory.PLAYER, `🗑️ Cleaning up disconnected player: ${data.squirrelId}`);
      
      // Remove mesh from scene
      if (player.mesh && this.scene) {
        // TASK 3 FIX: Log scene removal operation
        Logger.debug(LogCategory.PLAYER, `🎭 Removing mesh from scene for ${data.squirrelId}`);
        this.scene.remove(player.mesh);
        // Dispose of geometry and materials to prevent memory leaks
        if (player.mesh.geometry) {
          player.mesh.geometry.dispose();
        }
        if (player.mesh.material) {
          if (Array.isArray(player.mesh.material)) {
            player.mesh.material.forEach(mat => mat.dispose());
          } else {
            player.mesh.material.dispose();
          }
        }
        Logger.debug(LogCategory.PLAYER, `🗑️ Removed and disposed mesh for disconnected player ${data.squirrelId}`);
      }
      
      // TASK 3.2: Duplicate Player Prevention - Clean up tracking
      this.trackedSquirrelIds.delete(data.squirrelId);
      this.entityToSquirrelId.delete(player.entity.id.toString());
      
      // Remove from tracking
      this.remotePlayers.delete(data.squirrelId);
      Logger.debug(LogCategory.PLAYER, `👋 Removed disconnected player: ${data.squirrelId} (${this.remotePlayers.size} remaining)`);
      Logger.debugExpensive(LogCategory.PLAYER, () => `🔍 Remaining players: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
    } else {
      Logger.warn(LogCategory.PLAYER, `⚠️ Attempted to disconnect non-existent player: ${data.squirrelId}`);
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

  // TASK 3.2: Helper method to get local player squirrel ID
  private getLocalPlayerSquirrelId(): string | null {
    // This should be provided by the NetworkSystem or stored locally
    // For now, we'll use sessionStorage as a fallback
    return sessionStorage.getItem('squirrelId');
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

  // TASK 3 FIX: Debug method to inspect scene contents
  debugSceneContents(): void {
    if (!this.scene) {
      Logger.warn(LogCategory.PLAYER, '⚠️ No scene available for debugging');
      return;
    }

    Logger.debug(LogCategory.PLAYER, '🔍 === SCENE DEBUG ===');
    Logger.debug(LogCategory.PLAYER, `📊 Scene children count: ${this.scene.children.length}`);
    
    // Count different types of objects in scene
    const objectTypes = new Map<string, number>();
    this.scene.traverse((child) => {
      const type = child.type || 'unknown';
      objectTypes.set(type, (objectTypes.get(type) || 0) + 1);
    });
    
    Logger.debug(LogCategory.PLAYER, `📊 Scene object types: ${JSON.stringify(Object.fromEntries(objectTypes))}`);
    
    // List all remote players
    Logger.debug(LogCategory.PLAYER, `👥 Remote players tracked: ${this.remotePlayers.size}`);
    for (const [squirrelId, player] of this.remotePlayers) {
      Logger.debug(LogCategory.PLAYER, `  - ${squirrelId}: mesh=${!!player.mesh}, visible=${player.isVisible}, inScene=${player.mesh ? this.scene.children.includes(player.mesh) : false}`);
    }
    
    Logger.debug(LogCategory.PLAYER, '🔍 === END SCENE DEBUG ===');
  }
} 