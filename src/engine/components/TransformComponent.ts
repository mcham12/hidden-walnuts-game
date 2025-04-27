import { Component } from '../core/Component'
import { Vector3, Euler } from 'three'

export class TransformComponent extends Component {
  private position: Vector3
  private rotation: Euler
  private scale: Vector3

  constructor() {
    super()
    this.position = new Vector3()
    this.rotation = new Euler()
    this.scale = new Vector3(1, 1, 1)
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z)
    this.updateEntityTransform()
  }

  public setRotation(x: number, y: number, z: number): void {
    this.rotation.set(x, y, z)
    this.updateEntityTransform()
  }

  public setScale(x: number, y: number, z: number): void {
    this.scale.set(x, y, z)
    this.updateEntityTransform()
  }

  public getPosition(): Vector3 {
    return this.position.clone()
  }

  public getRotation(): Euler {
    return this.rotation.clone()
  }

  public getScale(): Vector3 {
    return this.scale.clone()
  }

  private updateEntityTransform(): void {
    if (this.entity) {
      (this.entity as any).position.copy(this.position)
      (this.entity as any).rotation.copy(this.rotation)
      (this.entity as any).scale.copy(this.scale)
    }
  }

  public update(delta: number): void {
    // Transform updates are handled through setters
  }
} 