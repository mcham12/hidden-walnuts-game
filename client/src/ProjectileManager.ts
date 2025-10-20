import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VFXManager } from './VFXManager';
import { AudioManager } from './AudioManager';
import { CollisionSystem } from './CollisionSystem';
import { getTerrainHeight } from './terrain.js';

/**
 * MVP 8: ProjectileManager
 * Manages flying walnut projectiles (throws from players and NPCs)
 *
 * Features:
 * - Arc physics with gravity
 * - Hit detection (raycast)
 * - Visual effects (spinning walnut, impact particles)
 * - Audio feedback (whoosh, bonk)
 */

interface Projectile {
  id: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ownerId: string; // Who threw it (player/NPC id)
  targetId?: string; // Who it's aimed at (for tracking)
  spawnTime: number;
  hasHit: boolean;
}

export class ProjectileManager {
  private projectiles: Map<string, Projectile> = new Map();
  private walnutModel: THREE.Group | null = null;
  private loader: GLTFLoader;
  private scene: THREE.Scene;
  private vfxManager: VFXManager;
  // @ts-ignore - Will be used in Phase 2 for throw/hit sounds
  private audioManager: AudioManager;
  private collisionSystem: CollisionSystem | null = null;

  // Physics constants
  private readonly GRAVITY = -9.8; // m/s²
  private readonly FLIGHT_TIME = 0.5; // seconds (faster = flatter trajectory for easier hits)
  private readonly MAX_LIFETIME = 5.0; // seconds (cleanup timeout)
  private readonly HIT_RADIUS = 0.8; // units (collision detection radius - increased for easier hits)
  private readonly NEAR_MISS_RADIUS = 2.0; // units (radius for near-miss detection)

  // Track entities that have had near misses (prevent spam)
  private nearMissCooldowns: Map<string, number> = new Map();

  // Projectile ID counter
  private nextProjectileId = 0;

  constructor(
    scene: THREE.Scene,
    vfxManager: VFXManager,
    audioManager: AudioManager,
    collisionSystem: CollisionSystem | null
  ) {
    this.scene = scene;
    this.vfxManager = vfxManager;
    this.audioManager = audioManager;
    this.collisionSystem = collisionSystem;
    this.loader = new GLTFLoader();

    // Preload walnut model
    this.loadWalnutModel();
  }

  /**
   * Load the walnut model for projectiles
   */
  private async loadWalnutModel(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/assets/models/environment/walnut_free_download.glb');
      this.walnutModel = gltf.scene.clone();

      // Scale down for projectile use (match ground walnut size for consistency)
      const box = new THREE.Box3().setFromObject(this.walnutModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      // MVP 8 FIX: Match ground walnut size (0.06 radius) for visual consistency
      const scale = 0.06 / maxDim; // Reduced from 0.08 to match ground walnut
      this.walnutModel.scale.setScalar(scale);
    } catch (error) {
      console.error('Failed to load walnut model for projectiles:', error);
      // Fallback: Create simple sphere
      this.createFallbackWalnut();
    }
  }

  /**
   * Create fallback walnut mesh if model fails to load
   */
  private createFallbackWalnut(): void {
    // MVP 8 FIX: Match ground walnut size (0.06 radius)
    const geometry = new THREE.SphereGeometry(0.06, 16, 16); // Increased from 0.05 to match ground walnut
    const material = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // Brown
      roughness: 0.8,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geometry, material);
    this.walnutModel = new THREE.Group();
    this.walnutModel.add(mesh);
  }

  /**
   * Spawn a projectile from one position to another
   *
   * @param fromPos - Starting position
   * @param toPos - Target position (aimed at)
   * @param ownerId - ID of entity who threw it
   * @param targetId - ID of entity being targeted (optional)
   * @returns Projectile ID
   */
  spawnProjectile(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    ownerId: string,
    targetId?: string
  ): string {
    if (!this.walnutModel) {
      console.warn('Walnut model not loaded yet, skipping projectile spawn');
      return '';
    }

    // Generate unique ID
    const id = `projectile-${this.nextProjectileId++}`;

    // Clone walnut model
    const mesh = this.walnutModel.clone();
    mesh.position.copy(fromPos);

    // Add to scene
    this.scene.add(mesh);

    // Calculate initial velocity for arc trajectory
    const velocity = this.calculateArcVelocity(fromPos, toPos, this.FLIGHT_TIME);

    // Create projectile data
    const projectile: Projectile = {
      id,
      mesh,
      position: fromPos.clone(),
      velocity,
      ownerId,
      targetId,
      spawnTime: Date.now(),
      hasHit: false
    };

    this.projectiles.set(id, projectile);

    // Play throw sound (using existing 'whoosh' sound from audio manager)
    // TODO Phase 2: Add dedicated throw sound
    // this.audioManager.playSound('whoosh');

    return id;
  }

  /**
   * Calculate initial velocity to hit target with arc trajectory
   * Based on projectile motion physics
   *
   * @param from - Starting position
   * @param to - Target position
   * @param flightTime - Desired flight duration
   * @returns Initial velocity vector
   */
  private calculateArcVelocity(
    from: THREE.Vector3,
    to: THREE.Vector3,
    flightTime: number
  ): THREE.Vector3 {
    // Calculate horizontal displacement
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dy = to.y - from.y;

    // Horizontal velocity (constant)
    const vx = dx / flightTime;
    const vz = dz / flightTime;

    // Vertical velocity (accounting for gravity)
    // vy = (dy - 0.5 * g * t²) / t
    const vy = (dy - 0.5 * this.GRAVITY * flightTime * flightTime) / flightTime;

    return new THREE.Vector3(vx, vy, vz);
  }

  /**
   * Update all active projectiles
   * Called every frame from Game.ts
   *
   * @param delta - Time since last frame (seconds)
   * @param entities - Map of all entities (for hit detection)
   */
  update(delta: number, entities: Map<string, { position: THREE.Vector3, isInvulnerable?: boolean }>): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.projectiles.forEach((projectile, id) => {
      // Check timeout
      const lifetime = (now - projectile.spawnTime) / 1000;
      if (lifetime > this.MAX_LIFETIME || projectile.hasHit) {
        toRemove.push(id);
        return;
      }

      // Update physics
      projectile.velocity.y += this.GRAVITY * delta;
      projectile.position.add(
        projectile.velocity.clone().multiplyScalar(delta)
      );
      projectile.mesh.position.copy(projectile.position);

      // Spin walnut for visual effect
      projectile.mesh.rotation.x += delta * 10;
      projectile.mesh.rotation.y += delta * 15;

      // MVP 8: Near-miss detection (check early for responsive feedback)
      this.checkNearMissDetection(projectile, entities, now);

      // MVP 8 FIX: Check hit detection BEFORE ground check (prevents close-range misses)
      // At close range, high velocity can cause projectile to pass through hit radius
      // and hit ground in same frame. Hit detection must take priority.
      const hitEntityId = this.checkHitDetection(projectile, entities);
      if (hitEntityId) {
        projectile.hasHit = true;
        this.onProjectileHit(projectile, hitEntityId);
        toRemove.push(id);
        return;
      }

      // MVP 8: Check collision with trees/rocks (must be after entity check, before ground check)
      if (this.collisionSystem) {
        // Calculate next position for raycast collision check
        const nextPos = projectile.position.clone().add(
          projectile.velocity.clone().multiplyScalar(delta)
        );

        // CRITICAL FIX: Pass ownerId (not projectile ID) so collision system skips thrower's capsule
        // CollisionSystem has logic: "if (collider.id === playerId) continue"
        // This prevents projectile from immediately hitting thrower's collision and being auto-eaten
        const collisionResult = this.collisionSystem.checkCollision(
          projectile.ownerId,  // Use thrower ID to skip their collider
          projectile.position,
          nextPos
        );

        if (collisionResult.collided) {
          // Projectile hit a tree/rock - treat as miss
          projectile.hasHit = true;
          this.onProjectileMiss(projectile);
          toRemove.push(id);
          return;
        }
      }

      // Check if hit ground (only if no entity/barrier hit detected)
      const terrainAtProjectile = getTerrainHeight(projectile.position.x, projectile.position.z);
      const groundBuffer = 0.1; // Small buffer to trigger slightly before visual ground contact
      if (projectile.position.y <= terrainAtProjectile + groundBuffer) {
        projectile.hasHit = true;
        this.onProjectileMiss(projectile);
        toRemove.push(id);
        return;
      }
    });

    // BEST PRACTICE: Cleanup projectiles from tracking (mesh stays in scene, converted to pickup)
    toRemove.forEach(id => {
      const projectile = this.projectiles.get(id);
      if (projectile) {
        // DON'T remove mesh from scene - Game.ts will convert it to pickup
        // Just stop tracking it as an active projectile (stops physics updates)
        this.projectiles.delete(id);
      }
    });
  }

  /**
   * Check if projectile hit any entity
   *
   * @param projectile - Projectile to check
   * @param entities - Map of all entities in world
   * @returns ID of hit entity, or null
   */
  private checkHitDetection(
    projectile: Projectile,
    entities: Map<string, { position: THREE.Vector3, isInvulnerable?: boolean }>
  ): string | null {
    for (const [entityId, entity] of entities) {
      // Don't hit self
      if (entityId === projectile.ownerId) {
        continue;
      }

      // Don't hit invulnerable entities
      if (entity.isInvulnerable) {
        continue;
      }

      // Check distance
      const distance = projectile.position.distanceTo(entity.position);
      if (distance <= this.HIT_RADIUS) {
        return entityId;
      }
    }

    return null;
  }

  /**
   * MVP 8: Check for near-miss (projectile passing close to entity)
   * Triggers fear reaction animation
   *
   * @param projectile - Projectile to check
   * @param entities - Map of all entities in world
   * @param now - Current timestamp (milliseconds)
   */
  private checkNearMissDetection(
    projectile: Projectile,
    entities: Map<string, { position: THREE.Vector3, isInvulnerable?: boolean }>,
    now: number
  ): void {
    const NEAR_MISS_COOLDOWN = 2000; // 2 seconds cooldown per entity

    for (const [entityId, entity] of entities) {
      // Don't detect near-miss for self
      if (entityId === projectile.ownerId) {
        continue;
      }

      // Don't detect near-miss for invulnerable entities
      if (entity.isInvulnerable) {
        continue;
      }

      // Check cooldown for this entity
      const lastNearMiss = this.nearMissCooldowns.get(entityId) || 0;
      if (now - lastNearMiss < NEAR_MISS_COOLDOWN) {
        continue; // Still on cooldown
      }

      // Check distance
      const distance = projectile.position.distanceTo(entity.position);
      if (distance > this.HIT_RADIUS && distance <= this.NEAR_MISS_RADIUS) {
        // Near miss detected! Dispatch event
        const nearMissEvent = new CustomEvent('projectile-near-miss', {
          detail: {
            projectileId: projectile.id,
            ownerId: projectile.ownerId,
            entityId: entityId,
            position: entity.position.clone()
          }
        });
        window.dispatchEvent(nearMissEvent);

        // Update cooldown
        this.nearMissCooldowns.set(entityId, now);
      }
    }
  }

  /**
   * Handle projectile hitting an entity
   * BEST PRACTICE: Transform projectile mesh into pickup (no destroy/recreate)
   *
   * @param projectile - Projectile that hit
   * @param targetId - ID of entity that was hit
   */
  private onProjectileHit(projectile: Projectile, targetId: string): void {
    // Spawn impact particles (golden sparkles for hit effect)
    this.vfxManager.spawnParticles(
      'sparkle',
      projectile.position,
      20 // particle count
    );

    // Play hit sound
    // TODO Phase 2: Add dedicated hit sound
    // this.audioManager.playSound('hit');

    // BEST PRACTICE: Pass mesh reference so Game.ts can convert to pickup (no destroy/recreate)
    const hitEvent = new CustomEvent('projectile-hit', {
      detail: {
        projectileId: projectile.id,
        ownerId: projectile.ownerId,
        targetId: targetId,
        position: projectile.position.clone(),
        mesh: projectile.mesh // Pass mesh to reuse as pickup
      }
    });
    window.dispatchEvent(hitEvent);
  }

  /**
   * Handle projectile missing (hit ground)
   * BEST PRACTICE: Transform projectile mesh into pickup (no destroy/recreate)
   *
   * @param projectile - Projectile that missed
   */
  private onProjectileMiss(projectile: Projectile): void {
    // Small impact particles (dirt puff for ground hit)
    this.vfxManager.spawnParticles(
      'dirt',
      projectile.position,
      5 // fewer particles
    );

    // No sound on miss (keeps it subtle)

    // BEST PRACTICE: Pass mesh reference so Game.ts can convert to pickup (no destroy/recreate)
    const missEvent = new CustomEvent('projectile-miss', {
      detail: {
        projectileId: projectile.id,
        ownerId: projectile.ownerId,
        position: projectile.position.clone(),
        mesh: projectile.mesh // Pass mesh to reuse as pickup
      }
    });
    window.dispatchEvent(missEvent);
  }

  /**
   * Remove a specific projectile
   *
   * @param id - Projectile ID to remove
   */
  removeProjectile(id: string): void {
    const projectile = this.projectiles.get(id);
    if (projectile) {
      this.scene.remove(projectile.mesh);
      this.projectiles.delete(id);
    }
  }

  /**
   * Clear all projectiles
   */
  clear(): void {
    this.projectiles.forEach(projectile => {
      this.scene.remove(projectile.mesh);
    });
    this.projectiles.clear();
  }

  /**
   * Get count of active projectiles (for debugging)
   */
  getActiveCount(): number {
    return this.projectiles.size;
  }
}
