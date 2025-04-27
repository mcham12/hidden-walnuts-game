import { Object3D } from 'three'
import { Component } from './Component'

export class Entity extends Object3D {
  private components: Map<string, Component> = new Map()
  private isActive: boolean = true

  constructor() {
    super()
  }

  public addComponent<T extends Component>(component: T): T {
    const componentName = component.constructor.name
    this.components.set(componentName, component)
    component.setEntity(this)
    return component
  }

  public getComponent<T extends Component>(componentType: new () => T): T | undefined {
    return this.components.get(componentType.name) as T
  }

  public removeComponent<T extends Component>(componentType: new () => T): void {
    const component = this.getComponent(componentType)
    if (component) {
      component.setEntity(null)
      this.components.delete(componentType.name)
    }
  }

  public update(delta: number): void {
    if (!this.isActive) return

    for (const component of this.components.values()) {
      component.update(delta)
    }
  }

  public setActive(active: boolean): void {
    this.isActive = active
    this.visible = active
  }

  public isEntityActive(): boolean {
    return this.isActive
  }
} 