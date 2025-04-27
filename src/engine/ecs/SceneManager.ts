/**
 * Manages the Three.js scene and provides methods to add or remove entities.
 */
import { Scene } from 'three';
import { Entity } from './Entity';

export class SceneManager {
  /** The Three.js scene managed by this class */
  public readonly scene: Scene;

  constructor() {
    this.scene = new Scene();
  }

  /**
   * Add an entity to the scene.
   */
  addEntity(entity: Entity) {
    this.scene.add(entity);
  }

  /**
   * Remove an entity from the scene.
   */
  removeEntity(entity: Entity) {
    this.scene.remove(entity);
  }
} 