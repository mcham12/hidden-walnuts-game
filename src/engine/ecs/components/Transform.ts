/**
 * Transform component for position in 3D space.
 */
import { Component } from '../Component';

export class Transform extends Component {
  static readonly key = Symbol('Transform');
  x = 0;
  y = 0;
  z = 0;
} 