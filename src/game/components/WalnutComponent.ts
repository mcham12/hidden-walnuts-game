import { Component } from "../../engine/ecs/Component";
import { Vector3 } from 'three';

export type WalnutType = 'bury' | 'bush';

export class WalnutComponent extends Component {
  static readonly key = Symbol('WalnutComponent');
  ownerId: string;
  type: WalnutType;
  position: Vector3;

  constructor(ownerId: string, type: WalnutType, position: Vector3) {
    super();
    this.ownerId = ownerId;
    this.type = type;
    this.position = position.clone();
  }
} 