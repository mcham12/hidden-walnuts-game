import { Entity } from '../../engine/ecs/Entity';
import { WalnutComponent, WalnutType } from '../components/WalnutComponent';
import { AssetManager } from '../../engine/assets/AssetManager';
import { Vector3 } from 'three';

export class WalnutEntity extends Entity {
  public component: WalnutComponent;
  public model: any;

  constructor(ownerId: string, type: WalnutType, position: Vector3, assetManager: AssetManager) {
    super();
    this.component = new WalnutComponent(ownerId, type, position);
    this.addComponent(this.component);
    this.loadModel(assetManager, position);
  }

  private async loadModel(assetManager: AssetManager, position: Vector3) {
    const model = await assetManager.loadModel('/assets/models/Mushroom_01.glb'); // Placeholder, replace with walnut model if available
    model.position.copy(position);
    model.scale.set(0.7, 0.7, 0.7);
    this.model = model;
    this.add(model);
  }
} 