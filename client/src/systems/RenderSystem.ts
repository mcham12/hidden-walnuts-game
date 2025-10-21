// Render System - Single Responsibility: Sync ECS data with render adapter (abstracted)

import { System, Entity, PositionComponent, RotationComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { IRenderAdapter } from '../rendering/IRenderAdapter';
import { Vector3 } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';

export class RenderSystem extends System {
  constructor(
    eventBus: EventBus,
    private renderAdapter: IRenderAdapter
  ) {
    super(eventBus, ['position', 'rotation', 'render'], 'RenderSystem');
  }

  update(_deltaTime: number): void {
    for (const entity of this.entities.values()) {
      this.updateEntityVisuals(entity);
    }
  }

  private updateEntityVisuals(entity: Entity): void {
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const render = entity.getComponent<RenderComponent>('render')!;

    if (!render.mesh || !render.visible) return;

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
    // Subscribe to fade events for this entity
    this.eventBus.subscribe('render.fade', (data: { entityId: string, opacity: number }) => {
      if (data.entityId === entity.id.value) {
        this.setEntityOpacity(data.entityId, data.opacity);
      }
    });
  }
} 