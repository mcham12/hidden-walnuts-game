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
  mesh: THREE.Object3D | null;
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
      Logger.info(LogCategory.PLAYER, `🎨 Loading model for ${character.name} from path: ${character.modelPath}`);
      
      // Validate asset path exists
      try {
        const response = await fetch(character.modelPath);
        if (!response.ok) {
          throw new Error(`Asset not found: ${character.modelPath} (${response.status})`);
        }
        Logger.info(LogCategory.PLAYER, `✅ Asset path validated: ${character.modelPath}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Asset path validation failed: ${character.modelPath}`, error);
        throw error;
      }
      
      const gltf = await this.assetManager.loadModel(character.modelPath);
      if (!gltf || !gltf.scene) {
        throw new Error('Model loaded but scene is null');
      }
      const model = gltf.scene;
      
      // Comprehensive model validation
      Logger.info(LogCategory.PLAYER, `🔍 Model validation for ${character.name}:`);
      Logger.info(LogCategory.PLAYER, `  - Model type: ${model.type}`);
      Logger.info(LogCategory.PLAYER, `  - Children count: ${model.children.length}`);
      Logger.info(LogCategory.PLAYER, `  - Visible: ${model.visible}`);
      Logger.info(LogCategory.PLAYER, `  - Position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Scale: (${model.scale.x.toFixed(2)}, ${model.scale.y.toFixed(2)}, ${model.scale.z.toFixed(2)})`);
      
      // Validate model structure
      let meshCount = 0;
      let skinnedMeshCount = 0;
      let materialCount = 0;
      model.traverse((child: THREE.Object3D) => {
        const isMesh = child instanceof THREE.Mesh || child.type === 'Mesh';
        const isSkinnedMesh = child instanceof THREE.SkinnedMesh || child.type === 'SkinnedMesh';
        
        if (isMesh) {
          meshCount++;
          const meshMaterial = (child as THREE.Mesh).material;
          if (meshMaterial) {
            materialCount++;
            const materialType = Array.isArray(meshMaterial) ? 'Material[]' : meshMaterial.type;
            Logger.debug(LogCategory.PLAYER, `    - Mesh material: ${materialType}`);
          }
        } else if (isSkinnedMesh) {
          skinnedMeshCount++;
          const skinnedMaterial = (child as THREE.SkinnedMesh).material;
          if (skinnedMaterial) {
            materialCount++;
            const materialType = Array.isArray(skinnedMaterial) ? 'Material[]' : skinnedMaterial.type;
            Logger.debug(LogCategory.PLAYER, `    - SkinnedMesh material: ${materialType}`);
          }
        }
      });
      Logger.info(LogCategory.PLAYER, `  - Mesh count: ${meshCount}`);
      Logger.info(LogCategory.PLAYER, `  - SkinnedMesh count: ${skinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Total renderable objects: ${meshCount + skinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Material count: ${materialCount}`);
      
      // Test that the model can be cloned
      const testClone = model.clone();
      Logger.info(LogCategory.PLAYER, `🎨 Model cloning test for ${character.name}: original=${!!model}, clone=${!!testClone}`);
      
      // Validate clone structure
      let cloneMeshCount = 0;
      let cloneSkinnedMeshCount = 0;
      testClone.traverse((child: THREE.Object3D) => {
        const isMesh = child instanceof THREE.Mesh || child.type === 'Mesh';
        const isSkinnedMesh = child instanceof THREE.SkinnedMesh || child.type === 'SkinnedMesh';
        
        if (isMesh) {
          cloneMeshCount++;
        } else if (isSkinnedMesh) {
          cloneSkinnedMeshCount++;
        }
      });
      Logger.info(LogCategory.PLAYER, `  - Clone mesh count: ${cloneMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Clone skinned mesh count: ${cloneSkinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Clone total renderable objects: ${cloneMeshCount + cloneSkinnedMeshCount}`);
      
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
    Logger.info(LogCategory.PLAYER, `🎯 PLAYER MANAGER RECEIVED remote_player_state event for: ${data.squirrelId}`);
    
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
          Logger.debugExpensive(LogCategory.PLAYER, () => 
            `🎯 Updated existing player ${data.squirrelId} mesh position to (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`
          );
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
    const character = await this.registry.getCharacter(data.characterId);
    if (!character) {
      Logger.error(LogCategory.PLAYER, `❌ No character found for ${data.characterId}`);
      return;
    }

    Logger.info(LogCategory.PLAYER, `🌐 Creating remote player ${data.squirrelId} as ${character.name} at (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)}, ${data.position.z.toFixed(1)})`);

    // Calculate adjusted position (same as local player)
    const adjustedPosition = {
      x: data.position.x,
      y: data.position.y,
      z: data.position.z
    };

    let mesh: THREE.Object3D | null = null;

    try {
      Logger.debug(LogCategory.PLAYER, `🎨 Creating mesh for ${data.squirrelId} as ${character.name}`);
      
      // Use the cached model (or load if not cached)
      if (this.cachedModels.has(character.id)) {
        Logger.debug(LogCategory.PLAYER, `🎨 Using cached model for ${character.name}`);
        mesh = this.cachedModels.get(character.id)!.clone(); // Clone the cached model
      } else if (this.modelLoadingPromises.has(character.id)) {
        Logger.debug(LogCategory.PLAYER, `🎨 Waiting for existing model load for ${character.name}`);
        const loadedModel = await this.modelLoadingPromises.get(character.id)!;
        mesh = loadedModel.clone(); // Clone the loaded model
      } else {
        Logger.debug(LogCategory.PLAYER, `🎨 Starting new model load for ${character.name}`);
        this.modelLoadingPromises.set(character.id, this.loadModelFor(character));
        const loadedModel = await this.modelLoadingPromises.get(character.id)!;
        mesh = loadedModel.clone(); // Clone the loaded model
      }
      
      Logger.info(LogCategory.PLAYER, `🎨 Model loaded for ${data.squirrelId}: ${!!mesh}`);
      
      if (!mesh) {
        throw new Error(`Failed to load model for ${character.name}`);
      }
      
      // Comprehensive mesh validation
      Logger.info(LogCategory.PLAYER, `🔍 Remote player mesh validation for ${data.squirrelId}:`);
      Logger.info(LogCategory.PLAYER, `  - Mesh type: ${mesh.type}`);
      Logger.info(LogCategory.PLAYER, `  - Children count: ${mesh.children.length}`);
      Logger.info(LogCategory.PLAYER, `  - Visible: ${mesh.visible}`);
      Logger.info(LogCategory.PLAYER, `  - Position before: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Scale before: (${mesh.scale.x.toFixed(2)}, ${mesh.scale.y.toFixed(2)}, ${mesh.scale.z.toFixed(2)})`);
      
      // Count meshes and materials
      let meshCount = 0;
      let skinnedMeshCount = 0;
      let materialCount = 0;
      mesh.traverse((child: THREE.Object3D) => {
        const isMesh = child instanceof THREE.Mesh || child.type === 'Mesh';
        const isSkinnedMesh = child instanceof THREE.SkinnedMesh || child.type === 'SkinnedMesh';
        
        if (isMesh) {
          meshCount++;
          if ((child as THREE.Mesh).material) {
            materialCount++;
          }
        } else if (isSkinnedMesh) {
          skinnedMeshCount++;
          if ((child as THREE.SkinnedMesh).material) {
            materialCount++;
          }
        }
      });
      Logger.info(LogCategory.PLAYER, `  - Mesh count: ${meshCount}`);
      Logger.info(LogCategory.PLAYER, `  - SkinnedMesh count: ${skinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Total renderable objects: ${meshCount + skinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `  - Material count: ${materialCount}`);
      
      // Configure mesh properties
      mesh.position.set(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
      mesh.quaternion.set(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w);
      
      // Apply scale (simplified - no recursive scaling)
      mesh.scale.set(character.scale, character.scale, character.scale);
      
      // Apply shadow settings
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.traverse((child: THREE.Object3D) => {
        const isMesh = child instanceof THREE.Mesh || child.type === 'Mesh';
        const isSkinnedMesh = child instanceof THREE.SkinnedMesh || child.type === 'SkinnedMesh';
        
        if (isMesh || isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      
      // Post-configuration validation
      Logger.info(LogCategory.PLAYER, `  - Position after: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Scale after: (${mesh.scale.x.toFixed(2)}, ${mesh.scale.y.toFixed(2)}, ${mesh.scale.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Visible after config: ${mesh.visible}`);
      
      // Validate scale
      const actualScale = mesh.scale;
      if (Math.abs(actualScale.x - character.scale) > 0.01 || 
          Math.abs(actualScale.y - character.scale) > 0.01 || 
          Math.abs(actualScale.z - character.scale) > 0.01) {
        Logger.warn(LogCategory.PLAYER, `⚠️ Scale validation failed for ${data.squirrelId}: expected=${character.scale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
        mesh.scale.set(character.scale, character.scale, character.scale);
      } else {
        Logger.debug(LogCategory.PLAYER, `✅ Scale validation passed for ${data.squirrelId}: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
      }
      
      // REMOVED: Material modifications that were causing visibility issues
      // Remote players now use the same material approach as local players
      
      // Add mesh to scene with validation
      Logger.info(LogCategory.PLAYER, `🎭 Adding mesh to scene for ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
      Logger.info(LogCategory.PLAYER, `🎭 Mesh visible before scene add: ${mesh?.visible}`);
      Logger.info(LogCategory.PLAYER, `🎭 Scene children count before add: ${this.scene?.children.length || 0}`);
      
      // Validate scene state before adding
      if (!this.scene) {
        throw new Error(`Scene is null when trying to add mesh for ${data.squirrelId}`);
      }
      
      if (!mesh) {
        throw new Error(`Mesh is null when trying to add to scene for ${data.squirrelId}`);
      }
      
      this.scene.add(mesh);
      
      Logger.info(LogCategory.PLAYER, `✅ Added mesh for remote player ${data.squirrelId} at (${adjustedPosition.x.toFixed(1)}, ${adjustedPosition.y.toFixed(1)}, ${adjustedPosition.z.toFixed(1)})`);
      Logger.info(LogCategory.PLAYER, `🎭 Mesh visible after scene add: ${mesh.visible}`);
      Logger.info(LogCategory.PLAYER, `🎭 Scene children count after add: ${this.scene.children.length}`);
      Logger.info(LogCategory.PLAYER, `🎭 Mesh in scene: ${this.scene.children.includes(mesh)}`);
      
      // Comprehensive scene validation
      let sceneMeshCount = 0;
      let sceneSkinnedMeshCount = 0;
      this.scene.traverse((child: THREE.Object3D) => {
        const isMesh = child instanceof THREE.Mesh || child.type === 'Mesh';
        const isSkinnedMesh = child instanceof THREE.SkinnedMesh || child.type === 'SkinnedMesh';
        
        if (isMesh) {
          sceneMeshCount++;
        } else if (isSkinnedMesh) {
          sceneSkinnedMeshCount++;
        }
      });
      Logger.info(LogCategory.PLAYER, `🎭 Total meshes in scene: ${sceneMeshCount}`);
      Logger.info(LogCategory.PLAYER, `🎭 Total skinned meshes in scene: ${sceneSkinnedMeshCount}`);
      Logger.info(LogCategory.PLAYER, `🎭 Total renderable objects in scene: ${sceneMeshCount + sceneSkinnedMeshCount}`);
      
      // Verify mesh is properly added to scene
      if (!this.scene.children.includes(mesh)) {
        throw new Error(`Mesh for ${data.squirrelId} was NOT added to scene!`);
      } else {
        Logger.info(LogCategory.PLAYER, `✅ Mesh for ${data.squirrelId} successfully added to scene`);
      }
      
      // Final visibility check
      Logger.info(LogCategory.PLAYER, `🔍 Final mesh state for ${data.squirrelId}:`);
      Logger.info(LogCategory.PLAYER, `  - In scene: ${this.scene.children.includes(mesh)}`);
      Logger.info(LogCategory.PLAYER, `  - Visible: ${mesh.visible}`);
      Logger.info(LogCategory.PLAYER, `  - Position: (${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Scale: (${mesh.scale.x.toFixed(2)}, ${mesh.scale.y.toFixed(2)}, ${mesh.scale.z.toFixed(2)})`);
      Logger.info(LogCategory.PLAYER, `  - Children: ${mesh.children.length}`);
      
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create mesh for ${data.squirrelId}:`, error);
      mesh = null;
    }
    
    Logger.info(LogCategory.PLAYER, `🎯 Final mesh for ${data.squirrelId}: ${!!mesh}`);
    
    if (mesh) {
      const player: RemotePlayer = {
        entity: new Entity(EntityId.generate()),
        squirrelId: data.squirrelId,
        mesh,
        isVisible: true,
        lastPosition: new THREE.Vector3(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z),
        lastRotation: new THREE.Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w),
        lastUpdate: performance.now(),
        characterId: data.characterId
      };
      
      this.remotePlayers.set(data.squirrelId, player);
      this.entityToSquirrelId.set(player.entity.id.toString(), data.squirrelId);
      
      Logger.info(LogCategory.PLAYER, `✅ Remote player ${data.squirrelId} created successfully`);
      Logger.info(LogCategory.PLAYER, `👥 Total remote players: ${this.remotePlayers.size}`);
    } else {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player ${data.squirrelId} - no mesh created`);
    }
  }

  private handlePlayerLeftInterest(data: { squirrelId: string; distance: number }): void {
    if (!data || !data.squirrelId) {
      Logger.error(LogCategory.PLAYER, `❌ Invalid data in handlePlayerLeftInterest:`, data);
      return;
    }
    
    Logger.info(LogCategory.PLAYER, `🙈 PLAYER LEFT INTEREST: ${data.squirrelId} at distance ${data.distance.toFixed(1)}m`);
    const player = this.remotePlayers.get(data.squirrelId);
    
    if (!player) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Player ${data.squirrelId} left interest but not found in remotePlayers`);
      return;
    }
    
    if (player.isVisible) {
      player.isVisible = false;
      
      if (player.mesh) {
        player.mesh.visible = false;
        Logger.info(LogCategory.PLAYER, `✅ Made player ${data.squirrelId} invisible (mesh.visible = false)`);
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Player ${data.squirrelId} left interest but has no mesh`);
      }
      
      Logger.debug(LogCategory.PLAYER, `🙈 Player ${data.squirrelId} left interest range (${data.distance.toFixed(1)}m)`);
    } else {
      Logger.debug(LogCategory.PLAYER, `🔄 Player ${data.squirrelId} already invisible, no change needed`);
    }
  }

  private handlePlayerCulled(data: { squirrelId: string; distance: number }): void {
    if (!data || !data.squirrelId) {
      Logger.error(LogCategory.PLAYER, `❌ Invalid data in handlePlayerCulled:`, data);
      return;
    }
    
    Logger.info(LogCategory.PLAYER, `✂️ PLAYER CULLED: ${data.squirrelId} at distance ${data.distance.toFixed(1)}m`);
    const player = this.remotePlayers.get(data.squirrelId);
    
    if (!player) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Attempted to cull non-existent player: ${data.squirrelId}`);
      return;
    }
    
    // Remove mesh from scene and dispose resources
    if (player.mesh && this.scene) {
      Logger.info(LogCategory.PLAYER, `🗑️ Removing mesh from scene for culled player ${data.squirrelId}`);
      this.scene.remove(player.mesh);
      
      // Dispose of geometry and materials in the Object3D hierarchy
      try {
        player.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        
        Logger.info(LogCategory.PLAYER, `🗑️ Removed and disposed mesh for culled player ${data.squirrelId}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Error disposing mesh for ${data.squirrelId}:`, error);
      }
    }
    
    player.isVisible = false;
    Logger.debug(LogCategory.PLAYER, `✂️ Player ${data.squirrelId} culled at distance ${data.distance.toFixed(1)}m`);
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

  getPlayerMesh(squirrelId: string): THREE.Object3D | null {
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

  /**
   * DEPRECATED: No longer needed - using unified fresh model approach
   * Keeping for reference but not used in production
   */
  private async createRobustClone(model: THREE.Object3D, characterName: string): Promise<THREE.Object3D> {
    Logger.debug(LogCategory.PLAYER, `🔧 DEPRECATED: createRobustClone called for ${characterName}`);
    // Fallback to fresh model loading
    const character = await this.registry.getCharacter(characterName.toLowerCase().replace(' ', ''));
    if (character) {
      return this.createFreshModelInstance(character);
    }
    return model.clone(); // Last resort
  }

  /**
   * INDUSTRY-STANDARD: Create fresh model instance (same approach as local players)
   * This is the most reliable approach for SkinnedMesh objects and unifies local/remote creation
   */
  private async createFreshModelInstance(character: CharacterType): Promise<THREE.Object3D> {
    try {
      Logger.debug(LogCategory.PLAYER, `🔄 Loading fresh model instance for ${character.name}`);
      
      // Load fresh model using the same approach as local players
      const gltf = await this.assetManager.loadModel(character.modelPath);
      if (!gltf || !gltf.scene) {
        throw new Error(`Failed to load fresh model for ${character.name}`);
      }
      
      const freshModel = gltf.scene;
      Logger.debug(LogCategory.PLAYER, `✅ Fresh model instance loaded for ${character.name}`);
      
      return freshModel;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create fresh model instance for ${character.name}:`, error);
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Load a fresh model instance instead of cloning
   * This is the most reliable approach for SkinnedMesh objects
   */
  private async createFreshModelClone(characterName: string): Promise<THREE.Object3D | null> {
    try {
      Logger.debug(LogCategory.PLAYER, `🔄 Loading fresh model for ${characterName}`);
      
      // Get character info
      const character = await this.registry.getCharacter(characterName.toLowerCase().replace(' ', ''));
      if (!character) {
        Logger.error(LogCategory.PLAYER, `❌ No character found for ${characterName}`);
        throw new Error(`No character found for ${characterName}`);
      }
      
      // Load fresh model
      const gltf = await this.assetManager.loadModel(character.modelPath);
      if (!gltf || !gltf.scene) {
        throw new Error(`Failed to load fresh model for ${characterName}`);
      }
      
      const freshModel = gltf.scene;
      Logger.debug(LogCategory.PLAYER, `✅ Fresh model loaded for ${characterName}`);
      
      return freshModel;
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create fresh model for ${characterName}:`, error);
      
      // Fallback: return null and let caller handle it
      Logger.warn(LogCategory.PLAYER, `⚠️ Failed to create fresh model for ${characterName}`);
      return null;
    }
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
        
        // Dispose of geometry and materials in the Object3D hierarchy
        player.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: THREE.Material) => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        
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
    if (!data || !data.squirrelId) {
      Logger.error(LogCategory.PLAYER, `❌ Invalid data in handlePlayerEnteredInterest:`, data);
      return;
    }
    
    Logger.info(LogCategory.PLAYER, `👁️ PLAYER ENTERED INTEREST: ${data.squirrelId} at distance ${data.distance.toFixed(1)}m`);
    const player = this.remotePlayers.get(data.squirrelId);
    
    if (!player) {
      Logger.warn(LogCategory.PLAYER, `⚠️ Player ${data.squirrelId} entered interest but not found in remotePlayers`);
      return;
    }
    
    if (!player.isVisible) {
      player.isVisible = true;
      
      if (player.mesh) {
        player.mesh.visible = true;
        Logger.info(LogCategory.PLAYER, `✅ Made player ${data.squirrelId} visible (mesh.visible = true)`);
        Logger.info(LogCategory.PLAYER, `🎭 Player ${data.squirrelId} mesh position: (${player.mesh.position.x.toFixed(1)}, ${player.mesh.position.y.toFixed(1)}, ${player.mesh.position.z.toFixed(1)})`);
        
        if (this.scene) {
          Logger.info(LogCategory.PLAYER, `🎭 Player ${data.squirrelId} mesh in scene: ${this.scene.children.includes(player.mesh)}`);
          
          // Ensure mesh is in scene
          if (!this.scene.children.includes(player.mesh)) {
            Logger.warn(LogCategory.PLAYER, `⚠️ Player ${data.squirrelId} mesh not in scene, adding it`);
            this.scene.add(player.mesh);
          }
        }
      } else {
        Logger.warn(LogCategory.PLAYER, `⚠️ Player ${data.squirrelId} entered interest but has no mesh`);
      }
      
      Logger.info(LogCategory.PLAYER, `👁️ Player ${data.squirrelId} entered interest range (${data.distance.toFixed(1)}m)`);
    } else {
      Logger.info(LogCategory.PLAYER, `🔄 Player ${data.squirrelId} already visible, no change needed`);
    }
  }
}