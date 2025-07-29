// client/src/systems/RenderSystem.ts

import { System, Entity, PositionComponent, RotationComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IRenderAdapter } from '../rendering/IRenderAdapter';
import { Vector3 } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';
import { CharacterComponent } from '../core/types'; // New import
import { container, ServiceTokens } from '../core/Container';
import { CharacterRegistry } from '../core/CharacterRegistry'; // New import

export class RenderSystem extends System {
  private registry: CharacterRegistry;
  private scene: import('three').Scene | null = null;
  
  constructor(
    eventBus: EventBus,
    private renderAdapter: IRenderAdapter
  ) {
    super(eventBus, ['position', 'rotation', 'render'], 'RenderSystem');
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
    this.scene = null; // Will be resolved when needed
  }
  
  private ensureSceneAccess(): void {
    if (!this.scene) {
      try {
        const sceneManager = container.resolve<import('../GameComposition').ISceneManager>(ServiceTokens.SCENE_MANAGER);
        this.scene = sceneManager.getScene();
        Logger.debug(LogCategory.PLAYER, '✅ RenderSystem lazy-initialized scene successfully');
      } catch (error) {
        // Scene not ready yet - this is normal during startup
        Logger.debug(LogCategory.PLAYER, '⚠️ Scene not ready yet in RenderSystem');
        // Don't throw - scene might become available later
      }
    }
  }

  // DEBUGGING: Track entities waiting for scene access
  private pendingMeshes = new Map<string, { entity: Entity, render: RenderComponent, network: any }>();
  private lastRetryLogTime = 0;

  private retryPendingMeshes(): void {
    if (this.pendingMeshes.size === 0) return;

    this.ensureSceneAccess();
    if (!this.scene) {
      // Only log retry attempts every 5 seconds to avoid spam
      const now = performance.now();
      if (now - this.lastRetryLogTime > 5000) {
        Logger.warn(LogCategory.PLAYER, `⏳ Still waiting for scene access, ${this.pendingMeshes.size} meshes queued`);
        this.lastRetryLogTime = now;
      }
      return;
    }

    const successCount = this.pendingMeshes.size;
    for (const [entityId, data] of this.pendingMeshes.entries()) {
      const { entity, render, network } = data;
      
      if (render.mesh && !render.mesh.parent) {
        this.scene.add(render.mesh);
        this.pendingMeshes.delete(entityId);
      }
    }

    // Only log success summary, not individual mesh additions
    if (successCount > this.pendingMeshes.size) {
      Logger.info(LogCategory.PLAYER, `✅ RETRY SUCCESS: Added ${successCount - this.pendingMeshes.size} pending meshes to scene`);
    }
  }
  
  async update(_deltaTime: number): Promise<void> {
    // Ensure scene is available for rendering
    this.ensureSceneAccess();
    
    // DEBUGGING: Retry pending mesh additions
    if (this.pendingMeshes.size > 0) {
      this.retryPendingMeshes();
    }
    
    // Don't log every frame - only when needed
    
    let localPlayerFound = false;
    let remotePlayerCount = 0;
    for (const entity of this.entities.values()) {
      const position = entity.getComponent<PositionComponent>('position');
      const render = entity.getComponent<RenderComponent>('render');
      const network = entity.getComponent<any>('network');
      
      if (network?.isLocalPlayer) {
        localPlayerFound = true;
      } else if (network && !network.isLocalPlayer) {
        remotePlayerCount++;
        
        // Position corruption debugging temporarily removed to stop console spam
      }
      
      await this.updateEntityVisuals(entity);
    }
    
    // Only log when no local player is found (rare case)
    if (!localPlayerFound && !this._localPlayerWarningShown) {
      Logger.warn(LogCategory.PLAYER, '⚠️ No local player entity found in RenderSystem');
      this._localPlayerWarningShown = true;
    }
    
    // Only log remote player count changes
    if (this._lastRemotePlayerCount !== remotePlayerCount) {
      Logger.info(LogCategory.PLAYER, `📊 RenderSystem processing ${remotePlayerCount} remote players`);
      this._lastRemotePlayerCount = remotePlayerCount;
    }
  }
  private async updateEntityVisuals(entity: Entity): Promise<void> {
    try {
      // Validate entity has required components
      const position = entity.getComponent<PositionComponent>('position');
      const rotation = entity.getComponent<RotationComponent>('rotation');
      const render = entity.getComponent<RenderComponent>('render');
      const characterComp = entity.getComponent<CharacterComponent>('character');
      const network = entity.getComponent<any>('network');
      
      if (!position || !rotation || !render) {
        Logger.error(LogCategory.PLAYER, `⚠️ Entity ${entity.id.value} missing required components - position: ${!!position}, rotation: ${!!rotation}, render: ${!!render}`);
        return;
      }
      
      if (!render.mesh || !render.visible) {
        if (network?.isLocalPlayer) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Local player mesh issue - mesh: ${!!render.mesh}, visible: ${render.visible}`);
        }
        return;
      }

      let validPosition = position.value;
      
      // Enhanced position validation
      if (!this.renderAdapter.validatePosition(position.value)) {
        Logger.error(LogCategory.PLAYER, `Invalid position detected for entity ${entity.id.value}:`, position.value);
        
        // Fallback to safe position
        validPosition = new Vector3(0, 2, 0);
        
        entity.addComponent<PositionComponent>({
          type: 'position',
          value: validPosition
        });
      }

      // Validate rotation
      if (isNaN(rotation.value.y) || !isFinite(rotation.value.y)) {
        Logger.error(LogCategory.PLAYER, `Invalid rotation detected for entity ${entity.id.value}:`, rotation.value);
        entity.addComponent<RotationComponent>({
          type: 'rotation',
          value: { y: 0 } as any
        });
      }

      // Apply render operations with error boundaries
      this.renderAdapter.updatePosition(render.mesh, validPosition);
      this.renderAdapter.updateRotation(render.mesh, rotation.value);
      this.renderAdapter.setVisibility(render.mesh, render.visible);
      
      // Character scaling with error handling
      if (characterComp) {
        try {
          const character = await this.registry.getCharacter(characterComp.characterId);
          if (character && render.mesh && character.scale) {
            if (isNaN(character.scale) || !isFinite(character.scale) || character.scale <= 0) {
              Logger.error(LogCategory.PLAYER, `Invalid character scale: ${character.scale}, using default 1.0`);
              (render.mesh as any).scale.set(1.0, 1.0, 1.0);
            } else {
              (render.mesh as any).scale.set(character.scale, character.scale, character.scale);
            }
          }
        } catch (error) {
          Logger.error(LogCategory.PLAYER, `Error applying character scaling for entity ${entity.id.value}:`, error);
        }
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `Critical error in updateEntityVisuals for entity ${entity.id.value}:`, error);
    }
  }
  setEntityOpacity(entityId: string, opacity: number): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;
    const render = entity.getComponent<RenderComponent>('render');
    if (!render?.mesh) return;
    this.renderAdapter.setOpacity(render.mesh, opacity);
  }
  protected onEntityAdded(entity: Entity): void {
    // BEST PRACTICE: RenderSystem has sole authority over scene operations
    const render = entity.getComponent<RenderComponent>('render');
    const network = entity.getComponent<any>('network');
    
    if (render?.mesh) {
      // Add mesh to scene when entity is added to RenderSystem (scene may not be ready yet)
      this.ensureSceneAccess();
      
      if (this.scene && !render.mesh.parent) {
        this.scene.add(render.mesh);
        // Only log remote player successes since local players work fine
        if (network && !network.isLocalPlayer) {
          Logger.info(LogCategory.PLAYER, `🎬 RenderSystem added REMOTE player ${network.squirrelId} mesh to scene`);
        }
      } else {
        // Log problems that need attention
        if (!this.scene) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Scene not available for ${network?.isLocalPlayer ? 'LOCAL' : 'REMOTE'} player ${network?.squirrelId} - QUEUING FOR RETRY`);
          this.pendingMeshes.set(entity.id.value, { entity, render, network });
        }
        if (render.mesh.parent) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Mesh already has parent for ${network?.isLocalPlayer ? 'LOCAL' : 'REMOTE'} player ${network?.squirrelId}`);
        }
      }
    } else {
      Logger.warn(LogCategory.PLAYER, `⚠️ No render component or mesh for entity ${entity.id.value}`);
    }
    
    this.eventBus.subscribe('render.fade', (data: { entityId: string, opacity: number }) => {
      if (data.entityId === entity.id.value) {
        this.setEntityOpacity(data.entityId, data.opacity);
      }
    });
  }

  protected onEntityRemoved(entity: Entity): void {
    this.ensureSceneAccess();
    try {
      const render = entity.getComponent<RenderComponent>('render');
      const network = entity.getComponent<any>('network');
      
      // DEBUGGING: Clean up any pending mesh entries
      if (this.pendingMeshes.has(entity.id.value)) {
        Logger.info(LogCategory.PLAYER, `🧹 Removing ${network?.isLocalPlayer ? 'LOCAL' : 'REMOTE'} player from pending meshes queue`);
        this.pendingMeshes.delete(entity.id.value);
      }
      
      if (render?.mesh) {
        Logger.info(LogCategory.PLAYER, `🧹 RenderSystem cleaning up entity ${entity.id.value} (${network?.isLocalPlayer ? 'LOCAL' : 'REMOTE'} player)`);
        
        // Note: Mesh removal from scene should be handled by PlayerManager
        // RenderSystem just logs for verification
        if (render.mesh.parent) {
          Logger.warn(LogCategory.PLAYER, `⚠️ Entity ${entity.id.value} mesh still has parent after removal - possible memory leak`);
        }
      }
    } catch (error) {
      Logger.error(LogCategory.PLAYER, `Error cleaning up entity ${entity.id.value}:`, error);
    }
  }

  private _localPlayerWarningShown = false;
  private _lastRemotePlayerCount = 0;
}