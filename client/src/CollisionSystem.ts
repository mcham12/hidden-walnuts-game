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

export interface Collider {
  id: string;
  position: THREE.Vector3;
  radius: number;
  height: number;
  type: 'tree' | 'player' | 'npc';
  mesh?: THREE.Mesh; // Debug visualization
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
   * Returns the adjusted position (slides around obstacles)
   */
  checkCollision(
    playerId: string,
    from: THREE.Vector3,
    to: THREE.Vector3
  ): THREE.Vector3 {
    // Get nearby colliders for performance (don't check distant trees)
    const nearbyColliders = this.getNearbyColliders(from);

    // Check each nearby collider
    for (const collider of nearbyColliders) {
      // Skip self (don't collide with own collider)
      if (collider.id === playerId) continue;

      // Check 2D collision (ignore Y axis - just XZ plane)
      const distance = this.distance2D(to, collider.position);

      // Collision detected if too close
      if (distance < collider.radius) {
        // Calculate slide vector
        return this.resolveCollision(from, to, collider);
      }
    }

    // No collision - allow movement
    return to;
  }

  /**
   * Resolve collision by sliding around the obstacle
   */
  private resolveCollision(
    from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider
  ): THREE.Vector3 {
    // Different behavior based on collider type
    if (collider.type === 'tree') {
      // Trees are solid - slide around them
      return this.slideAroundObstacle(from, to, collider);
    } else {
      // Players/NPCs - soft collision (can push through slightly)
      return this.softCollision(from, to, collider);
    }
  }

  /**
   * Slide around a solid obstacle (trees)
   */
  private slideAroundObstacle(
    from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider
  ): THREE.Vector3 {
    // Vector from collider center to desired position
    const toCollider = new THREE.Vector3(
      to.x - collider.position.x,
      0,
      to.z - collider.position.z
    );

    // Push player away from collider center
    toCollider.normalize();
    toCollider.multiplyScalar(collider.radius + 0.1); // Small buffer

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
    from: THREE.Vector3,
    to: THREE.Vector3,
    collider: Collider
  ): THREE.Vector3 {
    // Allow overlapping but with resistance
    const pushDistance = collider.radius * 0.7; // Can get 70% close

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
      console.log('🔍 Collision debug mode: ON');
    } else {
      // Remove all debug meshes
      for (const collider of this.colliders.values()) {
        if (collider.mesh) {
          this.scene.remove(collider.mesh);
          collider.mesh = undefined;
        }
      }
      console.log('🔍 Collision debug mode: OFF');
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
