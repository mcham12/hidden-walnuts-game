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
    try {
      if (!mesh) {
        console.error('ThreeJSRenderAdapter: Cannot update position - mesh is null/undefined');
        return;
      }
      
      if (!this.validatePosition(position)) {
        console.error('ThreeJSRenderAdapter: Invalid position provided:', position);
        return;
      }
      
      const threeMesh = mesh as import('three').Object3D;
      if (!threeMesh.position) {
        console.error('ThreeJSRenderAdapter: Mesh has no position property');
        return;
      }
      
      threeMesh.position.set(position.x, position.y, position.z);
    } catch (error) {
      console.error('ThreeJSRenderAdapter: Error updating position:', error);
    }
  }

  updateRotation(mesh: unknown, rotation: Rotation): void {
    try {
      if (!mesh) {
        console.error('ThreeJSRenderAdapter: Cannot update rotation - mesh is null/undefined');
        return;
      }
      
      if (isNaN(rotation.y)) {
        console.error('ThreeJSRenderAdapter: Invalid rotation Y value:', rotation.y);
        return;
      }
      
      const threeMesh = mesh as import('three').Object3D;
      if (!threeMesh.rotation) {
        console.error('ThreeJSRenderAdapter: Mesh has no rotation property');
        return;
      }
      
      threeMesh.rotation.y = rotation.y;
    } catch (error) {
      console.error('ThreeJSRenderAdapter: Error updating rotation:', error);
    }
  }

  setOpacity(mesh: unknown, opacity: number): void {
    try {
      if (!mesh) {
        console.error('ThreeJSRenderAdapter: Cannot set opacity - mesh is null/undefined');
        return;
      }
      
      if (isNaN(opacity) || opacity < 0 || opacity > 1) {
        console.error('ThreeJSRenderAdapter: Invalid opacity value (must be 0-1):', opacity);
        return;
      }
      
      const threeMesh = mesh as import('three').Object3D;
      
      threeMesh.traverse((child: any) => {
        if (child.material) {
          try {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat) {
                  mat.transparent = true;
                  mat.opacity = opacity;
                }
              });
            } else {
              child.material.transparent = true;
              child.material.opacity = opacity;
            }
          } catch (materialError) {
            console.error('ThreeJSRenderAdapter: Error setting material opacity:', materialError);
          }
        }
      });
    } catch (error) {
      console.error('ThreeJSRenderAdapter: Error setting opacity:', error);
    }
  }

  setVisibility(mesh: unknown, visible: boolean): void {
    try {
      if (!mesh) {
        console.error('ThreeJSRenderAdapter: Cannot set visibility - mesh is null/undefined');
        return;
      }
      
      if (typeof visible !== 'boolean') {
        console.error('ThreeJSRenderAdapter: Invalid visibility value (must be boolean):', visible);
        return;
      }
      
      const threeMesh = mesh as import('three').Object3D;
      if (threeMesh.visible === undefined) {
        console.error('ThreeJSRenderAdapter: Mesh has no visible property');
        return;
      }
      
      threeMesh.visible = visible;
    } catch (error) {
      console.error('ThreeJSRenderAdapter: Error setting visibility:', error);
    }
  }

  validatePosition(position: Vector3): boolean {
    if (!position) return false;
    return !isNaN(position.x) && !isNaN(position.y) && !isNaN(position.z) &&
           isFinite(position.x) && isFinite(position.y) && isFinite(position.z);
  }
} 