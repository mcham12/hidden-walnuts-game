import { Component } from '../core/Component'
import { Vector3 } from 'three'
import { TransformComponent } from './TransformComponent'

export class PhysicsComponent extends Component {
  private velocity: Vector3
  private acceleration: Vector3
  private mass: number
  private isGrounded: boolean
  private gravity: number

  constructor(mass: number = 1) {
    super()
    this.velocity = new Vector3()
    this.acceleration = new Vector3()
    this.mass = mass
    this.isGrounded = false
    this.gravity = 9.8
  }

  public applyForce(force: Vector3): void {
    // F = ma, so a = F/m
    const acceleration = force.clone().divideScalar(this.mass)
    this.acceleration.add(acceleration)
  }

  public applyGravity(): void {
    if (!this.isGrounded) {
      const gravityForce = new Vector3(0, -this.gravity, 0)
      this.applyForce(gravityForce)
    }
  }

  public update(delta: number): void {
    // Update velocity based on acceleration
    this.velocity.add(this.acceleration.multiplyScalar(delta))
    
    // Update position based on velocity
    if (this.entity) {
      const transform = this.entity.getComponent(TransformComponent)
      if (transform) {
        const position = transform.getPosition()
        position.add(this.velocity.clone().multiplyScalar(delta))
        transform.setPosition(position.x, position.y, position.z)
      }
    }

    // Reset acceleration for next frame
    this.acceleration.set(0, 0, 0)
  }

  public setGrounded(grounded: boolean): void {
    this.isGrounded = grounded
  }

  public getVelocity(): Vector3 {
    return this.velocity.clone()
  }

  public setVelocity(velocity: Vector3): void {
    this.velocity.copy(velocity)
  }
} 