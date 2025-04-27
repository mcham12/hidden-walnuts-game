import { Component } from '../core/Component'
import { Vector3 } from 'three'
import { PhysicsComponent } from './PhysicsComponent'

export class InputComponent extends Component {
  private moveSpeed: number
  private keys: Set<string>
  private moveDirection: Vector3

  constructor(moveSpeed: number = 5) {
    super()
    this.moveSpeed = moveSpeed
    this.keys = new Set()
    this.moveDirection = new Vector3()

    // Set up event listeners
    window.addEventListener('keydown', this.handleKeyDown.bind(this))
    window.addEventListener('keyup', this.handleKeyUp.bind(this))
  }

  private handleKeyDown(event: KeyboardEvent): void {
    this.keys.add(event.key.toLowerCase())
  }

  private handleKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key.toLowerCase())
  }

  public update(delta: number): void {
    this.moveDirection.set(0, 0, 0)

    // Handle movement
    if (this.keys.has('w')) this.moveDirection.z -= 1
    if (this.keys.has('s')) this.moveDirection.z += 1
    if (this.keys.has('a')) this.moveDirection.x -= 1
    if (this.keys.has('d')) this.moveDirection.x += 1

    // Normalize movement vector
    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize()
    }

    // Apply movement to physics
    const physics = this.entity?.getComponent(PhysicsComponent)
    if (physics) {
      const moveForce = this.moveDirection.multiplyScalar(this.moveSpeed)
      physics.applyForce(moveForce)
    }

    // Handle hiding action
    if (this.keys.has('h')) {
      // TODO: Implement hiding mechanic
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this))
    window.removeEventListener('keyup', this.handleKeyUp.bind(this))
  }
} 