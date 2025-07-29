// client/src/systems/PlayerManager.ts

import { System, Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent, EntityManager } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { EntityId, CharacterType, Vector3, Rotation } from '../core/types';
import * as THREE from 'three';
import { TerrainService } from '../services/TerrainService';
import { container, ServiceTokens } from '../core/Container';
import { CharacterRegistry } from '../core/CharacterRegistry'; // New import
import { CharacterComponent } from '../core/types';
import { InterpolationComponent } from '../ecs';


export class PlayerManager extends System {
  private scene: THREE.Scene | null = null;
  private assetManager: any = null;
  private terrainService: TerrainService | null = null; 
  private lastDebugTime: number | null = null;
  
  private registry: CharacterRegistry;
  private entityManager: EntityManager;
  private networkSystem: any = null; // Reference to NetworkSystem for queue access
  private lastValidationTime = 0; // For continuous state validation

  constructor(
    eventBus: EventBus, 
    terrainService: TerrainService,
    private sceneManager: import('../GameComposition').ISceneManager,
    assetManager: any
  ) {
    super(eventBus, ['player'], 'PlayerManager');
    
    // BEST PRACTICE: Guaranteed initialization through proper dependency injection order
    if (!assetManager) {
      throw new Error('PlayerManager requires a valid AssetManager');
    }
    
    // Scene is guaranteed to be initialized when PlayerManager is created
    this.scene = this.sceneManager.getScene();
    this.assetManager = assetManager;
    this.terrainService = terrainService;
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
    this.entityManager = container.resolve<EntityManager>(ServiceTokens.ENTITY_MANAGER);
    
    // BEST PRACTICE: Remove async event subscriptions, use synchronous queue processing instead
    // OLD: this.eventBus.subscribe('remote_player_state', this.handleRemotePlayerState.bind(this));
    // OLD: this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));
    
    // BEST PRACTICE: Direct visibility determination - no need for interest events
    // REMOVED: this.eventBus.subscribe('player_entered_interest', this.handlePlayerEnteredInterest.bind(this));
    // REMOVED: this.eventBus.subscribe('player_left_interest', this.handlePlayerLeftInterest.bind(this));
    // REMOVED: this.eventBus.subscribe('player_culled', this.handlePlayerCulled.bind(this));
    
    Logger.info(LogCategory.PLAYER, '✅ PlayerManager initialized with guaranteed dependencies');
  }

  // REMOVED: ensureSceneInitialized - scene is now guaranteed through proper initialization order
  
  private determinePlayerVisibility(squirrelId: string, position: { x: number; y: number; z: number }): boolean {
    // BEST PRACTICE: Direct visibility calculation instead of event-driven ping-pong
    const localPlayerPosition = this.getLocalPlayerPosition();
    if (!localPlayerPosition) {
      // If no local player yet, assume visible (will be corrected when local player exists)
      return true;
    }
    
    const distance = Math.sqrt(
      Math.pow(position.x - localPlayerPosition.x, 2) +
      Math.pow(position.y - localPlayerPosition.y, 2) +
      Math.pow(position.z - localPlayerPosition.z, 2)
    );
    
    const INTEREST_RADIUS = 50; // Match AreaOfInterestSystem radius
    const isVisible = distance <= INTEREST_RADIUS;
    
    Logger.debug(LogCategory.PLAYER, `📏 Distance to ${squirrelId}: ${distance.toFixed(1)}m, visible: ${isVisible}`);
    return isVisible;
  }
  
  private getLocalPlayerPosition(): { x: number; y: number; z: number } | null {
    const localSquirrelId = this.getLocalPlayerSquirrelId();
    if (!localSquirrelId) return null;
    
    // Find local player entity in the entity manager
    for (const entity of this.entityManager['entities'].values()) {
      const network = entity.getComponent<any>('network');
      if (network?.isLocalPlayer && network.squirrelId === localSquirrelId) {
        const position = entity.getComponent<PositionComponent>('position');
        if (position) {
          return {
            x: position.value.x,
            y: position.value.y,
            z: position.value.z
          };
        }
      }
    }
    return null;
  }

  private async handleRemotePlayerUpdate(data: any): Promise<void> {
    // BEST PRACTICE: Scene guaranteed through proper initialization order
    if (!this.scene || !this.assetManager) {
      throw new Error('CRITICAL: PlayerManager dependencies missing despite guaranteed initialization order');
    }
    
    if (!data.squirrelId || typeof data.squirrelId !== 'string') {
      Logger.error(LogCategory.PLAYER, '❌ Invalid squirrelId in remote_player_state:', data.squirrelId);
      return;
    }
    
    const localSquirrelId = this.getLocalPlayerSquirrelId();
    if (localSquirrelId && data.squirrelId === localSquirrelId) {
      return; // Skip local player silently
    }
    
    const characterId = data.characterId || 'colobus';
    
    // Find existing entity
    const entity = this.getEntityBySquirrelId(data.squirrelId);
    
    if (entity) {
      // Update existing - no logging for position updates
      const positionComp = entity.getComponent<PositionComponent>('position');
      const rotationComp = entity.getComponent<RotationComponent>('rotation');
      const characterComp = entity.getComponent<CharacterComponent>('character');
      const interpolationComp = entity.getComponent<InterpolationComponent>('interpolation');
      
      let newPosition = positionComp?.value;
      let newRotation = rotationComp?.value;

      if (data.position) {
        let adjustedPosition = { ...data.position };
        if (this.terrainService) {
          try {
            const terrainHeight = await Promise.race([
              this.terrainService.getTerrainHeight(data.position.x, data.position.z),
              new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 100)) 
            ]);
            adjustedPosition.y = terrainHeight + 0.1;
          } catch (error) {
            adjustedPosition.y = Math.max(data.position.y, 0.1);
          }
        } else {
          adjustedPosition.y = Math.max(data.position.y, 0.1);
        }
        
        newPosition = new Vector3(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
        entity.addComponent<PositionComponent>({ type: 'position', value: newPosition });
      }
      
      if (typeof data.rotationY === 'number') {
        newRotation = Rotation.fromRadians(data.rotationY);
        entity.addComponent<RotationComponent>({ type: 'rotation', value: newRotation });
      }

      // CRITICAL FIX: Use event-based approach to update interpolation targets
      if (interpolationComp && (newPosition || newRotation)) {
        const targetPos = newPosition || interpolationComp.targetPosition;
        const targetRot = newRotation || interpolationComp.targetRotation;
        
        // Emit event for InterpolationSystem to handle
        this.eventBus.emit('interpolation.update_targets', {
          entityId: entity.id.value,
          targetPosition: targetPos,
          targetRotation: targetRot
        });
      }
      
      if (characterComp && characterComp.characterId !== characterId) {
        entity.addComponent<CharacterComponent>({ type: 'character', characterId });
      }
      
      const network = entity.getComponent<NetworkComponent>('network');
      if (network) {
        network.lastUpdate = performance.now();
      }
      
      // BEST PRACTICE: Direct visibility determination for position updates
      if (newPosition) {
        const render = entity.getComponent<RenderComponent>('render');
        if (render) {
          const isVisible = this.determinePlayerVisibility(data.squirrelId, {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z
          });
          render.visible = isVisible;
          Logger.debug(LogCategory.PLAYER, `👁️ Updated visibility=${isVisible} for ${data.squirrelId}`);
        }
      }
      
    } else {
      // Create new - ONLY log this important event
      Logger.info(LogCategory.PLAYER, `🆕 Creating new remote player entity for: ${data.squirrelId}`);
      try {
        await this.createRemotePlayerEntity(data.squirrelId, data.position, data.rotationY || 0, characterId);
        Logger.info(LogCategory.PLAYER, `✅ Remote player entity created successfully for: ${data.squirrelId}`);
      } catch (error) {
        Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player entity for ${data.squirrelId}:`, error);
      }
    }
  }

  private async handleRemotePlayerJoin(data: any): Promise<void> {
    // Same logic as update, but guaranteed to be a new player
    Logger.info(LogCategory.PLAYER, `🆕 Creating new remote player entity for: ${data.squirrelId}`);
    try {
      await this.createRemotePlayerEntity(data.squirrelId, data.position, data.rotationY || 0, data.characterId || 'colobus');
      Logger.info(LogCategory.PLAYER, `✅ Remote player entity created successfully for: ${data.squirrelId}`);
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `❌ Failed to create remote player entity for ${data.squirrelId}:`, error);
    }
  }

  private async createRemotePlayerEntity(squirrelId: string, positionData: { x: number; y: number; z: number }, rotationY: number, characterId: string): Promise<void> {
    const character = await this.registry.getCharacter(characterId);
    if (!character) {
      Logger.error(LogCategory.PLAYER, `❌ No character found for ${characterId}`);
      return;
    }

    let adjustedPosition = { ...positionData };
    if (this.terrainService) {
      try {
        const terrainHeight = await Promise.race([
          this.terrainService.getTerrainHeight(positionData.x, positionData.z),
          new Promise<number>((resolve) => setTimeout(() => resolve(0.5), 100)) 
        ]);
        adjustedPosition.y = terrainHeight + 0.1;
      } catch (error) {
        adjustedPosition.y = Math.max(positionData.y, 0.1);
      }
    } else {
      adjustedPosition.y = Math.max(positionData.y, 0.1);
    }

    const pos = new Vector3(adjustedPosition.x, adjustedPosition.y, adjustedPosition.z);
    const rot = Rotation.fromRadians(rotationY);

    // Load model
    const gltf = await this.assetManager.loadModel(character.modelPath);
    if (!gltf || !gltf.scene) {
      throw new Error(`Failed to load model for ${character.name}`);
    }
    // AssetManager now provides cloned scenes, no need to clone again
    const model = gltf.scene;
    
    // CRITICAL FIX: Do NOT set mesh position directly - RenderSystem has sole authority
    // model.position.set(pos.x, pos.y, pos.z);  // REMOVED - causes position corruption
    // model.rotation.y = rot.y;  // REMOVED - RenderSystem handles this
    model.scale.set(character.scale, character.scale, character.scale);
    
    model.castShadow = true;
    model.receiveShadow = true;
    model.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    // BEST PRACTICE: RenderSystem has sole authority over scene operations
    // Do NOT add to scene here - RenderSystem will handle scene.add when entity is added
    Logger.info(LogCategory.PLAYER, `✅ Remote player mesh prepared for RenderSystem scene management`);
    
    const entity = new Entity(EntityId.generate());
    
    entity
      .addComponent<PositionComponent>({ type: 'position', value: pos })
      .addComponent<RotationComponent>({ type: 'rotation', value: rot })
      .addComponent<RenderComponent>({ type: 'render', mesh: model, visible: true }) // BEST PRACTICE: RenderSystem controls actual visibility
      .addComponent<NetworkComponent>({ type: 'network', isLocalPlayer: false, squirrelId, lastUpdate: performance.now() })
      .addComponent<CharacterComponent>({ type: 'character', characterId: character.id })
      .addComponent<InterpolationComponent>({ type: 'interpolation', targetPosition: pos, targetRotation: rot, speed: 0.1 })
      .addComponent({ type: 'player' }); // Add player component for system management
    
    // DEBUGGING: Verify remote player component state
    const networkComp = entity.getComponent<NetworkComponent>('network');
    const inputComp = entity.getComponent<InputComponent>('input');
    const interpolationComp = entity.getComponent<InterpolationComponent>('interpolation');
    
    Logger.info(LogCategory.PLAYER, `🔍 Remote player ${squirrelId} - isLocalPlayer: ${networkComp?.isLocalPlayer}, hasInput: ${!!inputComp}, targetPos: (${interpolationComp?.targetPosition.x.toFixed(1)}, ${interpolationComp?.targetPosition.y.toFixed(1)}, ${interpolationComp?.targetPosition.z.toFixed(1)})`);
    
    // CRITICAL CHECK: Are mesh objects being shared between players?
    Logger.info(LogCategory.PLAYER, `🎭 Remote player mesh object ID: ${(model as any).__squirrelId || 'undefined'} - setting to: ${squirrelId}`);
    (model as any).__squirrelId = squirrelId;
    
    // CRITICAL FIX: Set initial mesh position to ensure remote players are visible
    // This serves as a fallback in case RenderSystem positioning fails
    model.position.set(pos.x, pos.y, pos.z);
    model.rotation.y = rot.y;
    Logger.info(LogCategory.PLAYER, `🎯 Set initial mesh position for remote player: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`);
    
    Logger.info(LogCategory.PLAYER, `📦 Adding remote player entity ${entity.id.value} to EntityManager`);
    this.entityManager.addEntity(entity);
    Logger.info(LogCategory.PLAYER, `✅ Remote player ${squirrelId} entity added to EntityManager successfully`);

    // BEST PRACTICE: Direct visibility determination instead of event ping-pong
    const isVisible = this.determinePlayerVisibility(squirrelId, adjustedPosition);
    entity.getComponent<RenderComponent>('render')!.visible = isVisible;
    Logger.info(LogCategory.PLAYER, `👁️ Set direct visibility=${isVisible} for new remote player ${squirrelId}`);
  }

  // REMOVED: handlePlayerEnteredInterest, handlePlayerLeftInterest, handlePlayerCulled
  // BEST PRACTICE: Direct visibility determination instead of event-driven ping-pong
  
  private validateMultiplayerState(): void {
    // BEST PRACTICE: Continuous validation to catch architectural violations early
    // Scene guaranteed to be initialized
    if (!this.scene) {
      throw new Error('CRITICAL: Scene missing despite guaranteed initialization order');
    }
    
    const issues: string[] = [];
    let totalEntities = 0;
    let entitiesInScene = 0;
    let visibilityMismatches = 0;
    
    for (const entity of this.entities.values()) {
      totalEntities++;
      const render = entity.getComponent<RenderComponent>('render');
      const network = entity.getComponent<any>('network');
      
      if (render?.mesh) {
        // 1. Validate scene-entity synchronization
        if (render.mesh.parent === this.scene) {
          entitiesInScene++;
        } else if (!network?.isLocalPlayer) {
          // Remote players should be in scene
          issues.push(`Remote player ${network?.squirrelId} mesh not in scene`);
        }
        
        // 2. Validate visibility state integrity
        if (render.mesh.visible !== render.visible) {
          visibilityMismatches++;
          issues.push(`Visibility mismatch for ${network?.squirrelId}: ECS=${render.visible}, Mesh=${render.mesh.visible}`);
        }
        
        // 3. Validate position synchronization (basic check)
        const position = entity.getComponent<PositionComponent>('position');
        if (position) {
          const meshPos = render.mesh.position;
          const distance = Math.sqrt(
            Math.pow(position.value.x - meshPos.x, 2) +
            Math.pow(position.value.y - meshPos.y, 2) +
            Math.pow(position.value.z - meshPos.z, 2)
          );
          if (distance > 1.0) { // Allow 1 unit tolerance
            issues.push(`Position desync for ${network?.squirrelId}: distance=${distance.toFixed(2)}`);
          }
        }
      }
    }
    
    // Log validation results (only when issues found to avoid spam)
    if (issues.length > 0) {
      Logger.warn(LogCategory.PLAYER, `🔍 Multiplayer validation found ${issues.length} issues:`);
      issues.forEach(issue => Logger.warn(LogCategory.PLAYER, `  ❌ ${issue}`));
    }
    
    // Log summary stats periodically (every 30 seconds)
    if (this.lastDebugTime === null || performance.now() - this.lastDebugTime > 30000) {
      Logger.info(LogCategory.PLAYER, `📊 Multiplayer State: ${totalEntities} entities, ${entitiesInScene} in scene, ${visibilityMismatches} visibility mismatches`);
      this.lastDebugTime = performance.now();
    }
  }

  private handlePlayerDisconnected(data: { squirrelId: string }): void {
    this.removePlayerEntity(data.squirrelId);
  }

  private removePlayerEntity(squirrelId: string): void {
    // Scene guaranteed to be initialized
    const entity = this.getEntityBySquirrelId(squirrelId);
    if (entity) {
      const render = entity.getComponent<RenderComponent>('render');
      if (render && render.mesh && this.scene) {
        this.scene.remove(render.mesh);
        render.mesh?.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
      this.entityManager.removeEntity(entity.id);
    }
  }

  async update(_deltaTime: number): Promise<void> {
    // BEST PRACTICE: Synchronous queue processing instead of async events
    if (!this.networkSystem) {
      // Get NetworkSystem reference for queue access
      for (const system of this.entityManager['systems']) {
        if (system.systemId === 'NetworkSystem') {
          this.networkSystem = system;
          break;
        }
      }
    }
    
    if (this.networkSystem) {
      // Process pending player updates
      const pendingUpdates = this.networkSystem.getPendingPlayerUpdates();
      for (const update of pendingUpdates) {
        await this.handleRemotePlayerUpdate(update);
      }
      
      // Process pending player joins
      const pendingJoins = this.networkSystem.getPendingPlayerJoins();
      for (const join of pendingJoins) {
        await this.handleRemotePlayerJoin(join);
      }
      
      // Process pending player leaves
      const pendingLeaves = this.networkSystem.getPendingPlayerLeaves();
      for (const leave of pendingLeaves) {
        this.handlePlayerDisconnected(leave);
      }
      
      // BEST PRACTICE: Continuous state validation (run every 60 frames = ~1 second)
      if (performance.now() - this.lastValidationTime > 1000) {
        this.validateMultiplayerState();
        this.lastValidationTime = performance.now();
      }
    }
  }

  destroy(): void {
    // Scene guaranteed to be initialized
    for (const entity of this.entities.values()) {
      const render = entity.getComponent<RenderComponent>('render');
      if (render && render.mesh && this.scene) {
        this.scene.remove(render.mesh);
        // Dispose resources to prevent memory leaks
        render.mesh.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material?.dispose();
            }
          }
        });
      }
    }
    this.entities.clear();
  }

  getVisiblePlayerCount(): number {
    let count = 0;
    for (const entity of this.entities.values()) {
      const render = entity.getComponent<RenderComponent>('render');
      const network = entity.getComponent<NetworkComponent>('network');
      if (render?.visible && !network?.isLocalPlayer) count++;
    }
    return count;
  }

  getPlayerMesh(squirrelId: string): THREE.Object3D | null {
    const entity = this.getEntityBySquirrelId(squirrelId);
    return entity?.getComponent<RenderComponent>('render')?.mesh || null;
  }

  getAllPlayers(): Map<string, Entity> {
    const map = new Map();
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<NetworkComponent>('network');
      if (network && network.squirrelId && !network.isLocalPlayer) {
        map.set(network.squirrelId, entity);
      }
    }
    return map;
  }

  private getLocalPlayerSquirrelId(): string | null {
    return sessionStorage.getItem('squirrelId');
  }

  getPlayerStats(): { total: number; visible: number; withMesh: number; averageAge: number } {
    const now = performance.now();
    let total = 0;
    let visible = 0;
    let withMesh = 0;
    let totalAge = 0;
    
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<NetworkComponent>('network');
      if (network && !network.isLocalPlayer) {
        total++;
        const render = entity.getComponent<RenderComponent>('render');
        if (render?.visible) visible++;
        if (render?.mesh) withMesh++;
        totalAge += now - network.lastUpdate;
      }
    }
    
    return {
      total,
      visible,
      withMesh,
      averageAge: total > 0 ? totalAge / total : 0
    };
  }

  debugSceneContents(): void {
    // Scene guaranteed to be initialized
    if (!this.scene) {
      throw new Error('CRITICAL: Scene missing despite guaranteed initialization order');
    }
    Logger.debug(LogCategory.PLAYER, '🔍 === SCENE DEBUG ===');
    Logger.debug(LogCategory.PLAYER, `📊 Scene children count: ${this.scene.children.length}`);
    
    const objectTypes = new Map<string, number>();
    this.scene.traverse((child: any) => {
      const type = child.type || 'unknown';
      objectTypes.set(type, (objectTypes.get(type) || 0) + 1);
    });
    
    Logger.debug(LogCategory.PLAYER, `📊 Scene object types: ${JSON.stringify(Object.fromEntries(objectTypes))}`);
    
    Logger.debug(LogCategory.PLAYER, `👥 Remote players tracked: ${this.entities.size}`);
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<NetworkComponent>('network');
      const render = entity.getComponent<RenderComponent>('render');
      const character = entity.getComponent<CharacterComponent>('character');
      Logger.debug(LogCategory.PLAYER, `  - ${network?.squirrelId}: mesh=${!!render?.mesh}, visible=${render?.visible}, inScene=${render?.mesh ? this.scene.children.includes(render.mesh) : false}, character=${character?.characterId}`);
    }
    
    Logger.debug(LogCategory.PLAYER, '🔍 === END SCENE DEBUG ===');
  }

  private getEntityBySquirrelId(squirrelId: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      const network = entity.getComponent<NetworkComponent>('network');
      if (network && network.squirrelId === squirrelId) {
        return entity;
      }
    }
    return undefined;
  }
}