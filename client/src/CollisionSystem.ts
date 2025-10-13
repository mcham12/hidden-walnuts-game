/**
 * CollisionSystem - MVP 5.5: Physics & Collision Detection
 *
 * Prevents players from walking through:
 * - Landmark trees (N/S/E/W/O)
 * - Regular forest trees
 * - Other players
 * - NPCs
 *
 * Uses Three.js raycasting with cylinder colliders for performance
 */

import * as THREE from 'three';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';

export interface Collider {
  id: string;
  position: THREE.Vector3;
  radius: number;
  height: number;
  type: 'tree' | 'player' | 'npc';
  mesh?: THREE.Mesh; // Debug visualization
  actualMesh?: THREE.Object3D; // Actual tree mesh for precise collision (standard practice)
  octree?: Octree; // Standard Three.js Octree for mesh collision (like FPS example)
}

export class CollisionSystem {
  private colliders: Map<string, Collider> = new Map();
  private debugMode: boolean = false;
  private scene: THREE.Scene;
  private readonly COLLISION_CHECK_RADIUS = 30; // Only check nearby colliders

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Add a tree collider (landmark or regular forest tree)
   */
  addTreeCollider(id: string, position: THREE.Vector3, radius: number, height: number = 5): void {
    const collider: Collider = {
      id,
      position: position.clone(),
      radius,
      height,
      type: 'tree'
    };

    this.colliders.set(id, collider);

    // Create debug visualization if enabled
    if (this.debugMode) {
      this.createDebugMesh(collider);
    }
  }

  /**
   * Add tree collider using Three.js Octree (standard approach from FPS example)
   * https://threejs.org/examples/#games_fps
   */
  addTreeMeshCollider(id: string, treeMesh: THREE.Object3D, position: THREE.Vector3): void {
    treeMesh.updateMatrixWorld(true);

    // Standard Three.js: Build Octree from mesh (like FPS example)
    const octree = new Octree();
    octree.fromGraphNode(treeMesh);

    const collider: Collider = {
      id,
      position: position.clone(),
      radius: 0,
      height: 0,
      type: 'tree',
      actualMesh: treeMesh,
      octree: octree
    };

    this.colliders.set(id, collider);

    if (this.debugMode) {
      this.createMeshDebugVisualization(treeMesh, position);
    }
  }

  /**
   * Create debug visualization for mesh colliders
   */
  private createMeshDebugVisualization(treeMesh: THREE.Object3D, position: THREE.Vector3): void {
    // Create a helper to visualize the actual mesh bounds at player height
    const bbox = new THREE.Box3().setFromObject(treeMesh);

    // Clamp to player height
    const playerMin = position.y;
    const playerMax = position.y + 2;
    bbox.min.y = Math.max(bbox.min.y, playerMin);
    bbox.max.y = Math.min(bbox.max.y, playerMax);

    const helper = new THREE.Box3Helper(bbox, 0xff0000);
    this.scene.add(helper);
  }

  /**
   * Add a player collider (moves with player)
   */
  addPlayerCollider(id: string, position: THREE.Vector3, radius: number = 0.5): void {
    const collider: Collider = {
      id,
      position: position.clone(),
      radius,
      height: 2, // Player height
      type: 'player'
    };

    this.colliders.set(id, collider);

    if (this.debugMode) {
      this.createDebugMesh(collider);
    }
  }

  /**
   * Add an NPC collider
   */
  addNPCCollider(id: string, position: THREE.Vector3, radius: number = 0.5): void {
    const collider: Collider = {
      id,
      position: position.clone(),
      radius,
      height: 2,
      type: 'npc'
    };

    this.colliders.set(id, collider);

    if (this.debugMode) {
      this.createDebugMesh(collider);
    }
  }

  /**
   * Update a collider's position (for players/NPCs that move)
   */
  updateColliderPosition(id: string, newPosition: THREE.Vector3): void {
    const collider = this.colliders.get(id);
    if (collider) {
      collider.position.copy(newPosition);

      // Update debug mesh position
      if (collider.mesh) {
        collider.mesh.position.copy(newPosition);
        collider.mesh.position.y += collider.height / 2; // Center on Y axis
      }
    }
  }

  /**
   * Remove a collider (when player/NPC leaves)
   */
  removeCollider(id: string): void {
    const collider = this.colliders.get(id);
    if (collider) {
      // Remove debug mesh
      if (collider.mesh) {
        this.scene.remove(collider.mesh);
      }
      this.colliders.delete(id);
    }
  }

  /**
   * Check if movement from 'from' to 'to' would cause a collision
   * Returns { position: adjusted position, collided: whether collision occurred }
   */
  checkCollision(
    playerId: string,
    from: THREE.Vector3,
    to: THREE.Vector3
  ): { position: THREE.Vector3; collided: boolean } {
    // Get player's collider to determine its radius (standard collision practice)
    const playerCollider = this.colliders.get(playerId);
    const playerRadius = playerCollider ? playerCollider.radius : 0.5;

    // Get nearby colliders for performance (don't check distant trees)
    const nearbyColliders = this.getNearbyColliders(from);

    // Check each nearby collider
    for (const collider of nearbyColliders) {
      // Skip self (don't collide with own collider)
      if (collider.id === playerId) continue;

      // If collider has actual mesh, use mesh-based collision (standard practice)
      if (collider.actualMesh) {
        if (this.checkMeshCollision(to, playerRadius, collider, from.y)) {
          return {
            position: this.resolveMeshCollision(from, to, collider, playerRadius),
            collided: true
          };
        }
      } else {
        // Fallback: cylinder collision for simple colliders
        const distance = this.distance2D(to, collider.position);
        const combinedRadius = collider.radius + playerRadius;
        if (distance < combinedRadius) {
          return {
            position: this.resolveCollision(from, to, collider, playerRadius),
            collided: true
          };
        }
      }
    }

    // No collision - allow movement
    return { position: to, collided: false };
  }

  /**
   * Check collision using standard Three.js Octree (like FPS example)
   * https://threejs.org/examples/#games_fps
   */
  private checkMeshCollision(
    playerPos: THREE.Vector3,
    playerRadius: number,
    collider: Collider,
    playerY: number
  ): boolean {
    if (!collider.octree) return false;

    // Standard Three.js: Create player capsule (cylinder) at player height
    const start = new THREE.Vector3(playerPos.x, playerY, playerPos.z);
    const end = new THREE.Vector3(playerPos.x, playerY + 2, playerPos.z);
    const playerCapsule = new Capsule(start, end, playerRadius);

    // Standard Octree collision test (like FPS example)
    const result = collider.octree.capsuleIntersect(playerCapsule);
    return result !== false;
  }

  /**
   * Resolve mesh collision using Octree result (standard FPS example approach)
   */
  private resolveMeshCollision(
    from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider,
    playerRadius: number
  ): THREE.Vector3 {
    if (!collider.octree) return from;

    // Standard Three.js: Create player capsule and get collision result
    const start = new THREE.Vector3(to.x, from.y, to.z);
    const end = new THREE.Vector3(to.x, from.y + 2, to.z);
    const playerCapsule = new Capsule(start, end, playerRadius);

    const result = collider.octree.capsuleIntersect(playerCapsule);

    if (result) {
      // Push player out of collision using normal (standard FPS example)
      playerCapsule.translate(result.normal.multiplyScalar(result.depth));

      // Return adjusted position
      return new THREE.Vector3(
        playerCapsule.start.x,
        to.y,
        playerCapsule.start.z
      );
    }

    return to;
  }

  /**
   * Resolve collision by sliding around the obstacle
   */
  private resolveCollision(
    from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider,
    playerRadius: number
  ): THREE.Vector3 {
    // Different behavior based on collider type
    if (collider.type === 'tree') {
      // Trees are solid - slide around them
      return this.slideAroundObstacle(from, to, collider, playerRadius);
    } else {
      // Players/NPCs - soft collision (can push through slightly)
      return this.softCollision(from, to, collider, playerRadius);
    }
  }

  /**
   * Slide around a solid obstacle (trees)
   */
  private slideAroundObstacle(
    _from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider,
    playerRadius: number
  ): THREE.Vector3 {
    // Vector from collider center to desired position
    const toCollider = new THREE.Vector3(
      to.x - collider.position.x,
      0,
      to.z - collider.position.z
    );

    // Push player away from collider center
    // Standard collision: maintain distance = tree.radius + player.radius + buffer
    toCollider.normalize();
    toCollider.multiplyScalar(collider.radius + playerRadius + 0.1); // Small buffer

    // New position just outside the collider
    const adjusted = new THREE.Vector3(
      collider.position.x + toCollider.x,
      to.y, // Keep Y position (terrain height)
      collider.position.z + toCollider.z
    );

    return adjusted;
  }

  /**
   * Soft collision for players/NPCs (can push through slightly)
   */
  private softCollision(
    _from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider,
    playerRadius: number
  ): THREE.Vector3 {
    // Allow overlapping but with resistance (70% of combined radii)
    const combinedRadius = collider.radius + playerRadius;
    const pushDistance = combinedRadius * 0.7; // Can get 70% close

    const toCollider = new THREE.Vector3(
      to.x - collider.position.x,
      0,
      to.z - collider.position.z
    );

    const distance = toCollider.length();

    if (distance < pushDistance) {
      // Push away but allow some overlap
      toCollider.normalize();
      toCollider.multiplyScalar(pushDistance);

      return new THREE.Vector3(
        collider.position.x + toCollider.x,
        to.y,
        collider.position.z + toCollider.z
      );
    }

    return to;
  }

  /**
   * Get colliders within check radius (performance optimization)
   */
  private getNearbyColliders(position: THREE.Vector3): Collider[] {
    const nearby: Collider[] = [];

    for (const collider of this.colliders.values()) {
      const distance = this.distance2D(position, collider.position);
      if (distance < this.COLLISION_CHECK_RADIUS) {
        nearby.push(collider);
      }
    }

    return nearby;
  }

  /**
   * Calculate 2D distance (XZ plane only, ignore Y)
   */
  private distance2D(pos1: THREE.Vector3, pos2: THREE.Vector3): number {
    const dx = pos1.x - pos2.x;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Create debug visualization mesh (wireframe cylinder)
   */
  private createDebugMesh(collider: Collider): void {
    const geometry = new THREE.CylinderGeometry(
      collider.radius,
      collider.radius,
      collider.height,
      16
    );

    // Color based on type
    let color = 0x00ff00;
    if (collider.type === 'tree') color = 0xff0000;
    else if (collider.type === 'player') color = 0x00ff00;
    else if (collider.type === 'npc') color = 0xffff00;

    const material = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(collider.position);
    mesh.position.y += collider.height / 2; // Center on Y axis

    collider.mesh = mesh;
    this.scene.add(mesh);
  }

  /**
   * Toggle debug visualization (F key)
   */
  toggleDebug(): void {
    this.debugMode = !this.debugMode;

    if (this.debugMode) {
      // Create debug meshes for all colliders
      for (const collider of this.colliders.values()) {
        if (!collider.mesh) {
          this.createDebugMesh(collider);
        }
      }
    } else {
      // Remove all debug meshes
      for (const collider of this.colliders.values()) {
        if (collider.mesh) {
          this.scene.remove(collider.mesh);
          collider.mesh = undefined;
        }
      }
    }
  }

  /**
   * Get collision statistics (for debug overlay)
   */
  getStats(): { total: number; trees: number; players: number; npcs: number } {
    let trees = 0;
    let players = 0;
    let npcs = 0;

    for (const collider of this.colliders.values()) {
      if (collider.type === 'tree') trees++;
      else if (collider.type === 'player') players++;
      else if (collider.type === 'npc') npcs++;
    }

    return {
      total: this.colliders.size,
      trees,
      players,
      npcs
    };
  }
}
