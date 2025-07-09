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
    Logger.warn(LogCategory.RENDER, `🔄 RenderSystem update - processing ${this.entities.size} entities`);
    
    if (this.entities.size === 0) {
      Logger.warn(LogCategory.RENDER, `⚠️ RenderSystem: No entities to process`);
      return;
    }
    
    for (const entity of this.entities.values()) {
      const renderComponent = entity.getComponent<RenderComponent>('render');
      const positionComponent = entity.getComponent<PositionComponent>('position');
      const networkComponent = entity.getComponent<NetworkComponent>('network');
      
      if (!renderComponent) {
        Logger.warn(LogCategory.RENDER, `⚠️ Entity ${entity.id.value} has no render component`);
        continue;
      }
      
      if (!renderComponent.mesh) {
        Logger.warn(LogCategory.RENDER, `⚠️ Entity ${entity.id.value} render component has no mesh`);
        continue;
      }
      
      // Log entity details for debugging
      const entityType = networkComponent?.isLocalPlayer ? 'LOCAL_PLAYER' : networkComponent ? 'REMOTE_PLAYER' : 'OTHER';
      Logger.warn(LogCategory.RENDER, `🎨 Processing ${entityType} entity ${entity.id.value} at position ${positionComponent ? `(${positionComponent.value.x.toFixed(1)}, ${positionComponent.value.y.toFixed(1)}, ${positionComponent.value.z.toFixed(1)})` : 'NO_POSITION'}`);
      
      // Update mesh position if position component exists
      if (positionComponent) {
        renderComponent.mesh.position.set(
          positionComponent.value.x,
          positionComponent.value.y,
          positionComponent.value.z
        );
        Logger.warn(LogCategory.RENDER, `📍 Updated mesh position for entity ${entity.id.value} to (${positionComponent.value.x.toFixed(1)}, ${positionComponent.value.y.toFixed(1)}, ${positionComponent.value.z.toFixed(1)})`);
      }
      
      // Update mesh rotation if rotation component exists
      const rotationComponent = entity.getComponent<RotationComponent>('rotation');
      if (rotationComponent) {
        renderComponent.mesh.rotation.y = rotationComponent.value.y;
        Logger.warn(LogCategory.RENDER, `🔄 Updated mesh rotation for entity ${entity.id.value} to ${rotationComponent.value.y.toFixed(2)}`);
      }
      
      // Check mesh visibility
      if (renderComponent.visible !== renderComponent.mesh.visible) {
        renderComponent.mesh.visible = renderComponent.visible;
        Logger.warn(LogCategory.RENDER, `👁️ Updated mesh visibility for entity ${entity.id.value}: ${renderComponent.visible}`);
      }
      
      // Log mesh details
      Logger.warn(LogCategory.RENDER, `📊 Entity ${entity.id.value} mesh: visible=${renderComponent.mesh.visible}, position=(${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)}), scale=(${renderComponent.mesh.scale.x.toFixed(2)}, ${renderComponent.mesh.scale.y.toFixed(2)}, ${renderComponent.mesh.scale.z.toFixed(2)})`);
    }
    
    Logger.warn(LogCategory.RENDER, `✅ RenderSystem update complete - processed ${this.entities.size} entities`);
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