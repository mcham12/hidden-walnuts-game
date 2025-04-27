import { Entity } from './Entity'

export abstract class Component {
  protected entity: Entity | null = null

  constructor() {}

  public setEntity(entity: Entity | null): void {
    this.entity = entity
  }

  public getEntity(): Entity | null {
    return this.entity
  }

  public abstract update(delta: number): void
} 