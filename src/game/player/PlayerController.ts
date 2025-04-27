/**
 * PlayerController handles keyboard input and updates the squirrel's position and animation.
 */
import { Object3D, Vector3 } from 'three';

export class PlayerController {
  private squirrel: Object3D;
  private moveSpeed = 0.2;
  private direction = new Vector3();
  private keys: Record<string, boolean> = {};

  constructor(squirrel: Object3D) {
    this.squirrel = squirrel;
    this.initInput();
  }

  private initInput() {
    window.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
  }

  update() {
    this.direction.set(0, 0, 0);
    if (this.keys['w'] || this.keys['arrowup']) this.direction.z -= 1;
    if (this.keys['s'] || this.keys['arrowdown']) this.direction.z += 1;
    if (this.keys['a'] || this.keys['arrowleft']) this.direction.x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) this.direction.x += 1;
    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      this.squirrel.position.add(this.direction.clone().multiplyScalar(this.moveSpeed));
      // Optionally: rotate squirrel to face movement direction
      const angle = Math.atan2(this.direction.x, this.direction.z);
      this.squirrel.rotation.y = angle;
      // TODO: handle animation state (walk/run)
    } else {
      // TODO: handle idle animation
    }
  }
} 