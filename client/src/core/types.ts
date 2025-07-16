// client/src/core/types.ts

import * as THREE from 'three';

export class Vector3 {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number
  ) {}
  static zero(): Vector3 {
    return new Vector3(0, 0, 0);
  }
  static fromRotationY(rotationY: number): Vector3 {
    return new Vector3(
      Math.sin(rotationY),
      0,
      Math.cos(rotationY)
    );
  }
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }
  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }
  distanceTo(other: Vector3): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dz = this.z - other.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  lerp(target: Vector3, alpha: number): Vector3 {
    return new Vector3(
      this.x + (target.x - this.x) * alpha,
      this.y + (target.y - this.y) * alpha,
      this.z + (target.z - this.z) * alpha
    );
  }
  toThreeVector3(): THREE.Vector3 {
    return new THREE.Vector3(this.x, this.y, this.z);
  }
}

export class Rotation {
  constructor(public readonly y: number) {}
  static fromRadians(radians: number): Rotation {
    return new Rotation(radians);
  }
  add(delta: number): Rotation {
    return new Rotation(this.y + delta);
  }
  getDirection(): Vector3 {
    return Vector3.fromRotationY(this.y);
  }
  lerpTowards(target: number, alpha: number): Rotation {
    let diff = target - this.y;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return new Rotation(this.y + diff * alpha);
  }
}

export class WorldBounds {
  constructor(
    public readonly minX: number,
    public readonly maxX: number,
    public readonly minY: number,
    public readonly maxY: number,
    public readonly minZ: number,
    public readonly maxZ: number
  ) {}
  static default(): WorldBounds {
    return new WorldBounds(-100, 100, 0, 50, -100, 100);
  }
  contains(position: Vector3): boolean {
    return position.x >= this.minX && position.x <= this.maxX &&
           position.y >= this.minY && position.y <= this.maxY &&
           position.z >= this.minZ && position.z <= this.maxZ;
  }
  clamp(position: Vector3): Vector3 {
    return new Vector3(
      Math.max(this.minX, Math.min(this.maxX, position.x)),
      Math.max(this.minY, Math.min(this.maxY, position.y)),
      Math.max(this.minZ, Math.min(this.maxZ, position.z))
    );
  }
}

export class MovementConfig {
  constructor(
    public readonly moveSpeed: number = 5,
    public readonly turnSpeed: number = Math.PI,
    public readonly interpolationSpeed: number = 5.0
  ) {}
  static default(): MovementConfig {
    return new MovementConfig();
  }
}

export class CameraConfig {
  constructor(
    public readonly offsetDistance: number = 5,
    public readonly offsetHeight: number = 3,
    public readonly lerpSpeed: number = 0.1
  ) {}
  static default(): CameraConfig {
    return new CameraConfig();
  }
}

export class EntityId {
  constructor(public readonly value: string) {}
  static generate(): EntityId {
    return new EntityId(crypto.randomUUID());
  }
  toString(): string {
    return this.value;
  }
  equals(other: EntityId): boolean {
    return this.value === other.value;
  }
}

// New for MVP 8b: Character types
export interface CharacterAnimationMap {
  idle: string;
  walk: string;
  run: string;
  jump: string;
  // Extensible: add more states as needed (e.g., attack, dig)
  [key: string]: string; // For future animations
}

export interface CharacterType {
  id: string; // Unique ID, e.g., 'squirrel', 'colobus'
  name: string; // Display name
  modelPath: string; // Base model GLB
  lodModels?: string[]; // Optional LOD paths from metadata
  animations: CharacterAnimationMap; // Animation paths from metadata
  scale: number; // Default scale
  stats: { // Extensible stats
    speed: number;
    jumpHeight: number;
    // Add more as needed
  };
  unlockCondition: 'always' | `level:${number}` | `achievement:${string}`; // Data-driven unlocking
  isNPCCompatible: boolean; // Can be used for NPCs
}