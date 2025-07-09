// Render System - Single Responsibility: Sync ECS data with render adapter (abstracted)

import { System, Entity, PositionComponent, RotationComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IRenderAdapter } from '../rendering/IRenderAdapter';
import { Logger, LogCategory } from '../core/Logger';
import { NetworkComponent } from '../ecs';

export class RenderSystem extends System {
  constructor(
    eventBus: EventBus,
    private renderAdapter: IRenderAdapter
  ) {
    super(eventBus, ['position', 'rotation', 'render'], 'RenderSystem');
    Logger.info(LogCategory.RENDER, '[RenderSystem] Initialized');
  }

  update(_deltaTime: number): void {
    // ===========================================
    // 🚨 TEMPORARY DEBUG CODE - REMOVE AFTER FIXING PLAYER VISIBILITY ISSUE
    // ===========================================
    // This extensive logging is added to debug why players aren't visible
    // despite being properly created and registered with the ECS system.
    // TODO: Remove all debug logging once issue is resolved.
    
    // Only log every 120 frames (every 2 seconds at 60fps) to avoid console spam
    const shouldLog = Math.floor(performance.now() / 1000) % 2 === 0 && performance.now() % 100 < 16;
    
    if (shouldLog) {
      Logger.warn(LogCategory.RENDER, `[RenderSystem] Update called with ${this.entities.size} entities`);
    }
    
    if (this.entities.size === 0) {
      if (shouldLog) {
        Logger.warn(LogCategory.RENDER, `[RenderSystem] No entities to render, skipping update`);
      }
      return;
    }
    
    let processedEntities = 0;
    let entitiesWithMesh = 0;
    let entitiesWithPosition = 0;
    let entitiesWithRotation = 0;
    
    for (const entity of this.entities.values()) {
      processedEntities++;
      const renderComponent = entity.getComponent<RenderComponent>('render');
      const positionComponent = entity.getComponent<PositionComponent>('position');
      const rotationComponent = entity.getComponent<RotationComponent>('rotation');
      
      // Only log detailed entity info occasionally to avoid spam
      if (shouldLog) {
        Logger.warn(LogCategory.RENDER, `[RenderSystem] Processing entity ${entity.id.value}: render=${!!renderComponent}, position=${!!positionComponent}, rotation=${!!rotationComponent}`);
      }
      
      if (!renderComponent || !renderComponent.mesh) {
        if (shouldLog) {
          Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} missing render component or mesh, skipping`);
        }
        continue;
      }
      
      entitiesWithMesh++;
      
      // Update mesh position if position component exists
      if (positionComponent) {
        entitiesWithPosition++;
        renderComponent.mesh.position.set(
          positionComponent.value.x,
          positionComponent.value.y,
          positionComponent.value.z
        );
        if (shouldLog) {
          Logger.warn(LogCategory.RENDER, `[RenderSystem] Updated entity ${entity.id.value} position to (${positionComponent.value.x.toFixed(1)}, ${positionComponent.value.y.toFixed(1)}, ${positionComponent.value.z.toFixed(1)})`);
        }
      }
      
      // Update mesh rotation if rotation component exists
      if (rotationComponent) {
        entitiesWithRotation++;
        renderComponent.mesh.rotation.y = rotationComponent.value.y;
        if (shouldLog) {
          Logger.warn(LogCategory.RENDER, `[RenderSystem] Updated entity ${entity.id.value} rotation to ${rotationComponent.value.y.toFixed(2)}`);
        }
      }
      
      // Check mesh visibility
      if (renderComponent.visible !== renderComponent.mesh.visible) {
        renderComponent.mesh.visible = renderComponent.visible;
        if (shouldLog) {
          Logger.warn(LogCategory.RENDER, `[RenderSystem] Updated entity ${entity.id.value} visibility to ${renderComponent.visible}`);
        }
      }
      
      // Additional debugging for mesh state
      if (shouldLog) {
        Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} mesh state: position=(${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)}), visible=${renderComponent.mesh.visible}, scale=(${renderComponent.mesh.scale.x.toFixed(2)}, ${renderComponent.mesh.scale.y.toFixed(2)}, ${renderComponent.mesh.scale.z.toFixed(2)})`);
      }
    }
    
    if (shouldLog) {
      Logger.warn(LogCategory.RENDER, `[RenderSystem] Update complete: processed=${processedEntities}, withMesh=${entitiesWithMesh}, withPosition=${entitiesWithPosition}, withRotation=${entitiesWithRotation}`);
    }
    // ===========================================
    // 🚨 END TEMPORARY DEBUG CODE
    // ===========================================
  }

  // Handle visual effects through abstraction
  setEntityOpacity(entityId: string, opacity: number): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const render = entity.getComponent<RenderComponent>('render');
    if (!render?.mesh) return;

    // Use adapter for opacity changes
    this.renderAdapter.setOpacity(render.mesh, opacity);
  }

  protected onEntityAdded(entity: Entity): void {
    Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} added with components: ${entity.getComponents().map(c => c.type).join(', ')}`);
    
    // Check if entity has required components
    const renderComponent = entity.getComponent<RenderComponent>('render');
    const positionComponent = entity.getComponent<PositionComponent>('position');
    const networkComponent = entity.getComponent<NetworkComponent>('network');
    
    if (renderComponent) {
      Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} has render component with mesh: ${renderComponent.mesh ? 'YES' : 'NO'}, visible: ${renderComponent.visible}`);
      if (renderComponent.mesh) {
        Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} mesh details: position=(${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)}), scale=(${renderComponent.mesh.scale.x.toFixed(2)}, ${renderComponent.mesh.scale.y.toFixed(2)}, ${renderComponent.mesh.scale.z.toFixed(2)}), visible=${renderComponent.mesh.visible}`);
      }
    }
    
    if (positionComponent) {
      Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} has position component: (${positionComponent.value.x.toFixed(1)}, ${positionComponent.value.y.toFixed(1)}, ${positionComponent.value.z.toFixed(1)})`);
    }
    
    if (networkComponent) {
      const entityType = networkComponent.isLocalPlayer ? 'LOCAL_PLAYER' : 'REMOTE_PLAYER';
      Logger.warn(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} is ${entityType} with squirrelId: ${networkComponent.squirrelId}`);
    }
    
    // Subscribe to fade events for this entity
    this.eventBus.subscribe('render.fade', (data: { entityId: string, opacity: number }) => {
      if (data.entityId === entity.id.value) {
        this.setEntityOpacity(data.entityId, data.opacity);
      }
    });
  }
} 