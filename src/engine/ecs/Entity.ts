/**
 * Represents a game entity in the ECS, extending Object3D for scene graph integration.
 */
import { Object3D } from 'three';
import { Component } from './Component';

export class Entity extends Object3D {
  private components: Map<symbol, Component> = new Map();

  constructor() {
    super();
  }

  /**
   * Add a component to this entity.
   */
  addComponent<T extends Component>(component: T): void {
    this.components.set((component.constructor as typeof Component).key, component);
  }

  /**
   * Get a component of a specific type from this entity.
   */
  getComponent<T extends Component>(componentClass: { key: symbol }): T | undefined {
    return this.components.get(componentClass.key) as T | undefined;
  }

  /**
   * Remove a component of a specific type from this entity.
   */
  removeComponent(componentClass: { key: symbol }): void {
    this.components.delete(componentClass.key);
  }
} 