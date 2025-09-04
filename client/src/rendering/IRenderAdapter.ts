// Render Abstraction - No more Three.js leakage!

import { Vector3, Rotation } from '../core/types';

export interface IRenderAdapter {
  updatePosition(mesh: unknown, position: Vector3): void;
  updateRotation(mesh: unknown, rotation: Rotation): void;
  setOpacity(mesh: unknown, opacity: number): void;
  setVisibility(mesh: unknown, visible: boolean): void;
  validatePosition(position: Vector3): boolean;
}

export class ThreeJSRenderAdapter implements IRenderAdapter {
  updatePosition(mesh: unknown, position: Vector3): void {
    const threeMesh = mesh as import('three').Object3D;
    threeMesh.position.set(position.x, position.y, position.z);
  }

  updateRotation(mesh: unknown, rotation: Rotation): void {
    const threeMesh = mesh as import('three').Object3D;
    threeMesh.rotation.y = rotation.y;
  }

  setOpacity(mesh: unknown, opacity: number): void {
    const threeMesh = mesh as import('three').Object3D;
    
    threeMesh.traverse((child: any) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat: any) => {
            mat.transparent = true;
            mat.opacity = opacity;
          });
        } else {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      }
    });
  }

  setVisibility(mesh: unknown, visible: boolean): void {
    const threeMesh = mesh as import('three').Object3D;
    threeMesh.visible = visible;
  }

  validatePosition(position: Vector3): boolean {
    return !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z);
  }
} 