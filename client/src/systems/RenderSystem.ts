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
  
  constructor(
    eventBus: EventBus,
    private renderAdapter: IRenderAdapter
  ) {
    super(eventBus, ['position', 'rotation', 'render'], 'RenderSystem');
    this.registry = container.resolve<CharacterRegistry>(ServiceTokens.CHARACTER_REGISTRY);
  }
  async update(_deltaTime: number): Promise<void> {
    Logger.debug(LogCategory.RENDER, `🎨 RenderSystem processing ${this.entities.size} entities`);
    
    let localPlayerFound = false;
    for (const entity of this.entities.values()) {
      const position = entity.getComponent<PositionComponent>('position');
      const render = entity.getComponent<RenderComponent>('render');
      const network = entity.getComponent<any>('network');
      
      if (network?.isLocalPlayer) {
        localPlayerFound = true;
        Logger.debug(LogCategory.RENDER, `🎮 Processing LOCAL player entity ${entity.id.value} at (${position?.value.x.toFixed(1)}, ${position?.value.y.toFixed(1)}, ${position?.value.z.toFixed(1)})`);
        Logger.debug(LogCategory.RENDER, `🎮 Local player render component - mesh: ${!!render?.mesh}, visible: ${render?.visible}`);
      }
      
      await this.updateEntityVisuals(entity);
    }
    
    if (!localPlayerFound) {
      Logger.warn(LogCategory.RENDER, '⚠️ No local player entity found in RenderSystem');
    }
  }
  private async updateEntityVisuals(entity: Entity): Promise<void> {
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const render = entity.getComponent<RenderComponent>('render')!;
    const characterComp = entity.getComponent<CharacterComponent>('character');
    const network = entity.getComponent<any>('network');
    
    if (!render.mesh || !render.visible) {
      if (network?.isLocalPlayer) {
        Logger.warn(LogCategory.RENDER, `⚠️ Local player mesh issue - mesh: ${!!render.mesh}, visible: ${render.visible}`);
      }
      return;
    }
    
    let validPosition = position.value;
    
    if (isNaN(position.value.x) || isNaN(position.value.y) || isNaN(position.value.z)) {
      Logger.error(LogCategory.RENDER, 'Invalid position detected', position.value);
      
      validPosition = new Vector3(50, 2, 50);
      
      entity.addComponent<PositionComponent>({
        type: 'position',
        value: validPosition
      });
    }
    
    if (network?.isLocalPlayer) {
      Logger.debug(LogCategory.RENDER, `🎮 Updating local player mesh position to (${validPosition.x.toFixed(1)}, ${validPosition.y.toFixed(1)}, ${validPosition.z.toFixed(1)})`);
      Logger.debug(LogCategory.RENDER, `🎮 Local player mesh visible: ${render.mesh.visible}, position: (${render.mesh.position.x.toFixed(1)}, ${render.mesh.position.y.toFixed(1)}, ${render.mesh.position.z.toFixed(1)})`);
    }
    
    this.renderAdapter.updatePosition(render.mesh, validPosition);
    this.renderAdapter.updateRotation(render.mesh, rotation.value);
    this.renderAdapter.setVisibility(render.mesh, render.visible);
    
    if (characterComp) {
      const character = await this.registry.getCharacter(characterComp.characterId);
      if (character && render.mesh) {
        render.mesh.scale.set(character.scale, character.scale, character.scale);
      }
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
    this.eventBus.subscribe('render.fade', (data: { entityId: string, opacity: number }) => {
      if (data.entityId === entity.id.value) {
        this.setEntityOpacity(data.entityId, data.opacity);
      }
    });
  }
}