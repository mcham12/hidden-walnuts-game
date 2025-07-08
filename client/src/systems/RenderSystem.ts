// Render System - Single Responsibility: Sync ECS data with render adapter (abstracted)

import { System, Entity, PositionComponent, RotationComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IRenderAdapter } from '../rendering/IRenderAdapter';
import { Vector3 } from '../core/types';
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
    Logger.debug(LogCategory.RENDER, `🔄 RenderSystem update - processing ${this.entities.size} entities`);
    
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
      Logger.debug(LogCategory.RENDER, `🎨 Processing ${entityType} entity ${entity.id.value} at position ${positionComponent ? `(${positionComponent.value.x.toFixed(1)}, ${positionComponent.value.y.toFixed(1)}, ${positionComponent.value.z.toFixed(1)})` : 'NO_POSITION'}`);
      
      // Update mesh position if position component exists
      if (positionComponent) {
        renderComponent.mesh.position.set(
          positionComponent.value.x,
          positionComponent.value.y,
          positionComponent.value.z
        );
        Logger.debug(LogCategory.RENDER, `📍 Updated mesh position for entity ${entity.id.value}`);
      }
      
      // Update mesh rotation if rotation component exists
      const rotationComponent = entity.getComponent<RotationComponent>('rotation');
      if (rotationComponent) {
        renderComponent.mesh.rotation.y = rotationComponent.value.y;
        Logger.debug(LogCategory.RENDER, `🔄 Updated mesh rotation for entity ${entity.id.value}`);
      }
      
      // Check mesh visibility
      if (renderComponent.visible !== renderComponent.mesh.visible) {
        renderComponent.mesh.visible = renderComponent.visible;
        Logger.debug(LogCategory.RENDER, `👁️ Updated mesh visibility for entity ${entity.id.value}: ${renderComponent.visible}`);
      }
      
      // Log mesh details
      Logger.debug(LogCategory.RENDER, `📊 Entity ${entity.id.value} mesh: visible=${renderComponent.mesh.visible}, position=(${renderComponent.mesh.position.x.toFixed(1)}, ${renderComponent.mesh.position.y.toFixed(1)}, ${renderComponent.mesh.position.z.toFixed(1)})`);
    }
    
    Logger.debug(LogCategory.RENDER, `✅ RenderSystem update complete - processed ${this.entities.size} entities`);
  }

  private updateEntityVisuals(entity: Entity): void {
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const render = entity.getComponent<RenderComponent>('render')!;

    Logger.debug(LogCategory.RENDER, `[RenderSystem] Updating entity ${entity.id.value}: position=(${position.value.x.toFixed(1)}, ${position.value.y.toFixed(1)}, ${position.value.z.toFixed(1)}), visible=${render.visible}`);

    if (!render.mesh || !render.visible) {
      Logger.debug(LogCategory.RENDER, `[RenderSystem] Skipping entity ${entity.id.value}: no mesh or not visible`);
      return;
    }

    Logger.debug(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} mesh: type=${render.mesh.type}, name=${render.mesh.name}, visible=${render.mesh.visible}, position=(${render.mesh.position.x.toFixed(1)}, ${render.mesh.position.y.toFixed(1)}, ${render.mesh.position.z.toFixed(1)})`);

    // Handle position with validation but don't skip other updates
    let validPosition = position.value;
    
    if (isNaN(position.value.x) || isNaN(position.value.y) || isNaN(position.value.z)) {
      Logger.error(LogCategory.RENDER, 'Invalid position detected', position.value);
      
      // Reset to safe position
      validPosition = new Vector3(50, 2, 50);
      
      // Fix the component
      entity.addComponent<PositionComponent>({
        type: 'position',
        value: validPosition
      });
    }

    // Always sync ALL visual properties through abstraction
    this.renderAdapter.updatePosition(render.mesh, validPosition);
    this.renderAdapter.updateRotation(render.mesh, rotation.value);
    this.renderAdapter.setVisibility(render.mesh, render.visible);
    
    Logger.debug(LogCategory.RENDER, `[RenderSystem] Updated entity ${entity.id.value} mesh position to (${validPosition.x.toFixed(1)}, ${validPosition.y.toFixed(1)}, ${validPosition.z.toFixed(1)})`);
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
    Logger.info(LogCategory.RENDER, `[RenderSystem] Entity ${entity.id.value} added with components: ${entity.getComponents().map(c => c.type).join(', ')}`);
    
    // Subscribe to fade events for this entity
    this.eventBus.subscribe('render.fade', (data: { entityId: string, opacity: number }) => {
      if (data.entityId === entity.id.value) {
        this.setEntityOpacity(data.entityId, data.opacity);
      }
    });
  }
} 