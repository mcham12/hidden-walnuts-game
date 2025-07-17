// client/src/systems/PlayerManager.ts

import { System, Entity } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { EntityId, CharacterType } from '../core/types';
import * as THREE from 'three';
import { TerrainService } from '../services/TerrainService';
import { container, ServiceTokens } from '../core/Container';
import { CharacterRegistry } from '../core/CharacterRegistry'; // New import


interface RemotePlayer {
  entity: Entity;
  squirrelId: string;
  mesh: THREE.Mesh | null;
  lastPosition: THREE.Vector3;
  lastRotation: THREE.Quaternion;
  lastUpdate: number;
  isVisible: boolean;
  characterId: string; // New: track character type
}

function setMeshScaleRecursive(object: THREE.Object3D, scale: number) {
  object.scale.set(scale, scale, scale);
  
  object.traverse(child => {
    if (child !== object) {
      child.scale.set(scale, scale, scale);
    }
  });
  
  const actualScale = object.scale;
  if (Math.abs(actualScale.x - scale) > 0.01 || 
      Math.abs(actualScale.y - scale) > 0.01 || 
      Math.abs(actualScale.z - scale) > 0.01) {
    Logger.warn(LogCategory.PLAYER, `⚠️ Scale validation failed: expected=${scale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
    object.scale.set(scale, scale, scale);
  }
}

export class PlayerManager extends System {
  private remotePlayers = new Map<string, RemotePlayer>();
  private scene: THREE.Scene | null = null;
  private assetManager: any = null;
  private terrainService: TerrainService | null = null; 
  private lastDebugTime: number | null = null;
  
  private trackedSquirrelIds = new Set<string>();
  private entityToSquirrelId = new Map<string, string>(); 
  
  private cachedModels: Map<string, THREE.Object3D> = new Map(); // Cache by characterId
  private modelLoadingPromises: Map<string, Promise<THREE.Object3D>> = new Map();
  private registry: CharacterRegistry;

  constructor(eventBus: EventBus, terrainService: TerrainService) {
    super(eventBus, ['player'], 'PlayerManager');
    
    this.terrainService = terrainService;
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
    
    this.eventBus.subscribe('remote_player_state', this.handleRemotePlayerState.bind(this));
    this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));
    this.eventBus.subscribe('player_entered_interest', this.handlePlayerEnteredInterest.bind(this));
    this.eventBus.subscribe('player_left_interest', this.handlePlayerLeftInterest.bind(this));
    this.eventBus.subscribe('player_culled', this.handlePlayerCulled.bind(this));
    
    this.eventBus.subscribe('scene.initialized', () => {
      this.initializeWithSceneAndAssets();
    });
  }

  private async initializeWithSceneAndAssets(): Promise<void> {
    if (this.scene && this.assetManager) {
      return; 
    }
    try {
      const { container, ServiceTokens } = await import('../core/Container');
      const sceneManager = container.resolve(ServiceTokens.SCENE_MANAGER) as any;
      
      let attempts = 0;
      while ((!this.scene || !this.assetManager) && attempts < 50) {
        try {
          this.scene = sceneManager.getScene();
          this.assetManager = container.resolve(ServiceTokens.ASSET_MANAGER);
          
          if (this.scene && this.assetManager) {
            break;
          }
        } catch (e) {
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!this.scene || !this.assetManager) {
        throw new Error(`Failed to initialize after ${attempts} attempts`);
      }
      
      Logger.info(LogCategory.PLAYER, '✅ PlayerManager initialized with scene, assets, and terrain service');
      
      await this.preloadModels();
    } catch (error) {
      Logger.error(LogCategory.PLAYER, '❌ Failed to initialize PlayerManager with scene and assets', error);
    }
  }

  private async preloadModels(): Promise<void> {
    const characters = await this.registry.getAllCharacters();
    for (const char of characters) {
      if (!this.cachedModels.has(char.id) && !this.modelLoadingPromises.has(char.id)) {
        this.modelLoadingPromises.set(char.id, this.loadModelFor(char));
      }
    }
    await Promise.all(this.modelLoadingPromises.values());
    this.modelLoadingPromises.clear();
  }

  private async loadModelFor(character: CharacterType): Promise<THREE.Object3D> {
    try {
      const gltf = await this.assetManager.loadModel(character.modelPath);
      if (!gltf || !gltf.scene) {
        throw new Error('Model loaded but scene is null');
      }
      const model = gltf.scene;
      this.cachedModels.set(character.id, model);
      Logger.debug(LogCategory.PLAYER, `✅ Preloaded model for ${character.name}`);
      return model;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to preload model for ${character.name}`, error);
      throw error;
    }
  }

  async update(_deltaTime: number): Promise<void> {
    for (const [_squirrelId, player] of this.remotePlayers) {
      if (player.isVisible && player.mesh) {
        this.updatePlayerMesh(player, _deltaTime);
        
        const character = await this.registry.getCharacter(player.characterId);
        if (character) {
          const targetScale = character.scale;
          const actualScale = player.mesh.scale;
          if (Math.abs(actualScale.x - targetScale) > 0.01 || 
              Math.abs(actualScale.y - targetScale) > 0.01 || 
              Math.abs(actualScale.z - targetScale) > 0.01) {
            Logger.warn(LogCategory.PLAYER, `⚠️ Runtime scale correction for ${_squirrelId}: expected=${targetScale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
            setMeshScaleRecursive(player.mesh, targetScale);
          }
        }
      }
    }
    
    const now = performance.now();
    if (!this.lastDebugTime || now - this.lastDebugTime > 60000) {
      this.debugSceneContents();
      this.lastDebugTime = now;
    }
  }

  private handleRemotePlayerState = async (data: any) => {
    Logger.debugExpensive(LogCategory.PLAYER, () => `🎯 PLAYER MANAGER RECEIVED remote_player_state event for: ${data.squirrelId}`);
    
    if (!this.scene || !this.assetManager) {
      Logger.warn(LogCategory.PLAYER, `⚠️ PlayerManager not ready for ${data.squirrelId}, initializing...`);
      await this.initializeWithSceneAndAssets();
    }
    
    if (!data.squirrelId || typeof data.squirrelId !== 'string') {
      Logger.error(LogCategory.PLAYER, '❌ Invalid squirrelId in remote_player_state:', data.squirrelId);
      return;
    }
    
    const localSquirrelId = this.getLocalPlayerSquirrelId();
    if (localSquirrelId && data.squirrelId === localSquirrelId) {
      Logger.debug(LogCategory.PLAYER, `🎯 Skipping remote player creation for local player: ${data.squirrelId}`);
      return;
    }
    
    const characterId = data.characterId || 'colobus'; // Default to colobus to match local player
    
    const existingPlayer = this.remotePlayers.get(data.squirrelId);
    if (existingPlayer) {
      Logger.debug(LogCategory.PLAYER, '🔄 UPDATING existing remote player:', data.squirrelId);
      
      if (existingPlayer.mesh) {
        const character = await this.registry.getCharacter(characterId);
        if (character) {
          setMeshScaleRecursive(existingPlayer.mesh, character.scale);
        }
      }
      
      if (data.position) {
        let adjustedPosition = { ...data.position };
        if (this.terrainService) {
          try {
            const terrainHeight = await Promise.race([
              this.terrainService.getTerrainHeight(data.position.x, data.position.z),
              new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 100)) 
            ]);
            adjustedPosition.y = terrainHeight + 0.1; 
            
            Logger.debugExpensive(LogCategory.PLAYER, () => 
              `📏 Adjusted remote player ${data.squirrelId} height to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`
            );
          } catch (error) {
            Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player update ${data.squirrelId}, using fallback`, error);
            adjustedPosition.y = Math.max(data.position.y, 0.1);
          }
        } else {
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
      existingPlayer.characterId = characterId;
    } else {
      Logger.debug(LogCategory.PLAYER, '🆕 CREATING new remote player:', data.squirrelId);
      
      if (this.trackedSquirrelIds.has(data.squirrelId)) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Duplicate remote player state for ${data.squirrelId}, skipping creation`);
        Logger.info(LogCategory.PLAYER, `🔍 Currently tracked players: ${Array.from(this.trackedSquirrelIds).join(', ')}`);
        Logger.info(LogCategory.PLAYER, `🔍 Currently rendered players: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
        return;
      }
      
      if (!data.position || typeof data.position.x !== 'number' || typeof data.position.y !== 'number' || typeof data.position.z !== 'number') {
        Logger.error(LogCategory.PLAYER, '❌ Invalid position data for new remote player:', data.squirrelId, data.position);
        return;
      }
      
      if (this.remotePlayers.has(data.squirrelId)) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Attempted to create duplicate player ${data.squirrelId}, skipping`);
        Logger.info(LogCategory.PLAYER, `🔍 Already rendered: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
        return;
      }
      
      this.trackedSquirrelIds.add(data.squirrelId);
      
      Logger.info(LogCategory.PLAYER, `🔍 Creating player ${data.squirrelId} - Current players: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
      
      try {
        Logger.info(LogCategory.PLAYER, `🚀 Starting creation of remote player: ${data.squirrelId}`);
        await this.createRemotePlayer({
          squirrelId: data.squirrelId,
          position: data.position,
          rotation: {
            x: 0,
            y: data.rotationY || 0,
            z: 0,
            w: 1
          },
          characterId
        });
        Logger.info(LogCategory.PLAYER, `✅ Successfully created remote player: ${data.squirrelId}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player ${data.squirrelId}:`, error);
        this.trackedSquirrelIds.delete(data.squirrelId);
      }
    }
    
    Logger.debugExpensive(LogCategory.PLAYER, () => `👥 Current remote players count AFTER processing: ${this.remotePlayers.size}`);
    Logger.debugExpensive(LogCategory.PLAYER, () => `🔍 All players after processing: ${Array.from(this.remotePlayers.keys()).join(', ')}`);
  };

  private async createRemotePlayer(data: {
    squirrelId: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
    characterId: string;
  }): Promise<void> {
    const character = await this.registry.getCharacter(data.characterId) || await this.registry.getDefaultCharacter();
    if (!character) {
      Logger.error(LogCategory.PLAYER, `❌ No character found for ${data.characterId}, using default`);
      return;
    }
    Logger.debug(LogCategory.PLAYER, `🎯 Creating remote player: ${data.squirrelId} as ${character.name}`);
    
    let adjustedPosition = { ...data.position };
    if (this.terrainService) {
      try {
        const terrainHeight = await Promise.race([
          this.terrainService.getTerrainHeight(data.position.x, data.position.z),
          new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 100)) 
        ]);
        adjustedPosition.y = terrainHeight + 0.1; 
        
        Logger.debug(LogCategory.PLAYER, `📏 Adjusted remote player ${data.squirrelId} height to ${adjustedPosition.y.toFixed(2)} (terrain: ${terrainHeight.toFixed(2)})`);
      } catch (error) {
        Logger.warn(LogCategory.PLAYER, `Failed to get terrain height for remote player ${data.squirrelId}, using fallback`, error);
        adjustedPosition.y = Math.max(data.position.y, 0.1);
      }
    } else {
      adjustedPosition.y = Math.max(data.position.y, 0.1);
    }
    
    const entity = new Entity(EntityId.generate());
    
    if (!this.scene || !this.assetManager) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Scene or AssetManager not ready for ${data.squirrelId}, initializing...`);
      await this.initializeWithSceneAndAssets();
    }
    let mesh: THREE.Mesh | null = null;
    if (this.assetManager && this.scene) {
      try {
        Logger.debug(LogCategory.PLAYER, `🎨 Creating mesh for ${data.squirrelId} as ${character.name}`);
        
        let model: THREE.Object3D;
        if (this.cachedModels.has(character.id)) {
          model = this.cachedModels.get(character.id)!;
        } else if (this.modelLoadingPromises.has(character.id)) {
          model = await this.modelLoadingPromises.get(character.id)!;
        } else {
          this.modelLoadingPromises.set(character.id, this.loadModelFor(character));
          model = await this.modelLoadingPromises.get(character.id)!;
        }
        
        if (model) {
          mesh = model.clone() as THREE.Mesh;
          mesh.position.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
          mesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
          setMeshScaleRecursive(mesh, character.scale);
          
          const actualScale = mesh.scale;
          if (Math.abs(actualScale.x - character.scale) > 0.01 || Math.abs(actualScale.y - character.scale) > 0.01 || Math.abs(actualScale.z - character.scale) > 0.01) {
            Logger.warn(LogCategory.PLAYER, `⚠️ Scale validation failed for ${data.squirrelId}: expected=${character.scale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
            mesh.scale.set(character.scale, character.scale, character.scale);
          } else {
            Logger.debug(LogCategory.PLAYER, `✅ Scale validation passed for ${data.squirrelId}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
          }
          
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const material = child.material.clone();
              if (material instanceof THREE.MeshStandardMaterial) {
                material.color.multiplyScalar(0.8);
              }
              child.material = material;
            }
          });
          
          Logger.debug(LogCategory.PLAYER, `🎭 Adding mesh to scene for ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
          this.scene.add(mesh);
          Logger.debug(LogCategory.PLAYER, `✅ Added mesh for remote player ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
        } else {
          Logger.error(LogCategory.PLAYER, `❌ Failed to load model for ${character.name} (${data.squirrelId}): model was null`);
        }
        
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to load model for ${character.name} (${data.squirrelId})`, error);
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
      isVisible: true,
      characterId: character.id
    };
    
    this.entityToSquirrelId.set(entity.id.toString(), data.squirrelId);
    
    this.remotePlayers.set(data.squirrelId, remotePlayer);
    Logger.debug(LogCategory.PLAYER, `🎮 Remote player ${data.squirrelId} created successfully (${this.remotePlayers.size} total remote players)`);
  }

  private handlePlayerDisconnected(data: { squirrelId: string }): void {
    if (!data.squirrelId || typeof data.squirrelId !== 'string') {
      Logger.error(LogCategory.PLAYER, '❌ Invalid squirrelId in player_disconnected:', data.squirrelId);
      return;
    }
    
    const player = this.remotePlayers.get(data.squirrelId);
    if (player) {
      Logger.debug(LogCategory.PLAYER, `🗑️ Cleaning up disconnected player: ${data.squirrelId}`);
      
      if (player.mesh && this.scene) {
        Logger.debug(LogCategory.PLAYER, `🎭 Removing mesh from scene for ${data.squirrelId}`);
        this.scene.remove(player.mesh);
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
      
      this.trackedSquirrelIds.delete(data.squirrelId);
      this.entityToSquirrelId.delete(player.entity.id.toString());
      
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
      if (player.mesh && this.scene) {
        this.scene.remove(player.mesh);
      }
      player.isVisible = false;
      Logger.debug(LogCategory.PLAYER, `✂️ Player ${data.squirrelId} culled at distance ${data.distance.toFixed(1)}m`);
    }
  }

  private updatePlayerMesh(player: RemotePlayer, _deltaTime: number): void {
    if (!player.mesh) return;
    
    player.mesh.position.copy(player.lastPosition);
    player.mesh.quaternion.copy(player.lastRotation);
  }

  destroy(): void {
    for (const [, player] of this.remotePlayers) {
      if (player.mesh && this.scene) {
        this.scene.remove(player.mesh);
      }
    }
    this.remotePlayers.clear();
  }

  getVisiblePlayerCount(): number {
    return Array.from(this.remotePlayers.values()).filter(p => p.isVisible).length;
  }

  getPlayerMesh(squirrelId: string): THREE.Mesh | null {
    return this.remotePlayers.get(squirrelId)?.mesh || null;
  }

  getAllPlayers(): Map<string, RemotePlayer> {
    return this.remotePlayers;
  }

  private getLocalPlayerSquirrelId(): string | null {
    return sessionStorage.getItem('squirrelId');
  }

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

  debugSceneContents(): void {
    if (!this.scene) {
      Logger.warn(LogCategory.PLAYER, '⚠️ No scene available for debugging');
      return;
    }
    Logger.debug(LogCategory.PLAYER, '🔍 === SCENE DEBUG ===');
    Logger.debug(LogCategory.PLAYER, `📊 Scene children count: ${this.scene.children.length}`);
    
    const objectTypes = new Map<string, number>();
    this.scene.traverse((child: any) => {
      const type = child.type || 'unknown';
      objectTypes.set(type, (objectTypes.get(type) || 0) + 1);
    });
    
    Logger.debug(LogCategory.PLAYER, `📊 Scene object types: ${JSON.stringify(Object.fromEntries(objectTypes))}`);
    
    Logger.debug(LogCategory.PLAYER, `👥 Remote players tracked: ${this.remotePlayers.size}`);
    for (const [squirrelId, player] of this.remotePlayers) {
      Logger.debug(LogCategory.PLAYER, `  - ${squirrelId}: mesh=${!!player.mesh}, visible=${player.isVisible}, inScene=${player.mesh ? this.scene.children.includes(player.mesh) : false}, character=${player.characterId}`);
    }
    
    Logger.debug(LogCategory.PLAYER, '🔍 === END SCENE DEBUG ===');
  }
}