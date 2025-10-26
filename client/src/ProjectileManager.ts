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
  bounces: number; // Track bounce count for settling
  restTimer: number; // Time (seconds) spent below rest velocity threshold
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

  // Ground physics constants (INDUSTRY STANDARD: time-based, not frame-based)
  private readonly WALNUT_RADIUS = 0.06; // units
  private readonly MAX_BOUNCES = 2;
  private readonly BOUNCE_DAMPING = 0.25;
  private readonly BOUNCE_THRESHOLD = 0.3; // m/s - minimum Y velocity to bounce
  private readonly FRICTION_COEFFICIENT = 0.85; // Exponential decay per second (time-based)
  private readonly ROLLING_FRICTION = 0.15; // Resistance to downhill rolling
  private readonly MIN_SLOPE_ANGLE = 0.05; // radians (~3 degrees) - minimum slope to roll
  private readonly REST_VELOCITY_THRESHOLD = 0.1; // m/s - speed below which object can rest
  private readonly REST_TIME_REQUIRED = 0.3; // seconds - how long to be slow before settling
  private readonly GROUND_EPSILON = 0.01; // units - tolerance for ground detection

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
      hasHit: false,
      bounces: 0, // Start with zero bounces
      restTimer: 0 // Start with zero rest time
    };

    this.projectiles.set(id, projectile);

    // Play throw sound (using existing 'whoosh' sound from audio manager)
    // TODO Phase 2: Add dedicated throw sound
    // this.audioManager.playSound('whoosh');

    return id;
  }

  /**
   * MVP 9: Spawn falling walnut (tree drop) with zero initial velocity
   * Gravity pulls it straight down, then bounces/rolls on ground
   */
  spawnFallingWalnut(position: THREE.Vector3, ownerId: string): string {
    if (!this.walnutModel) {
      console.warn('Walnut model not loaded yet, skipping falling walnut spawn');
      return '';
    }

    const id = `projectile-${this.nextProjectileId++}`;
    const mesh = this.walnutModel.clone();
    mesh.position.copy(position);
    this.scene.add(mesh);

    // Start with zero velocity - gravity will pull down
    const projectile: Projectile = {
      id,
      mesh,
      position: position.clone(),
      velocity: new THREE.Vector3(0, 0, 0), // Straight down via gravity only
      ownerId,
      targetId: undefined,
      spawnTime: Date.now(),
      hasHit: false,
      bounces: 0,
      restTimer: 0
    };

    this.projectiles.set(id, projectile);
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

      // ========================================
      // INDUSTRY-STANDARD SPHERE-TERRAIN PHYSICS
      // ========================================

      // Sample terrain height at CURRENT position (before any updates)
      const terrainHeight = getTerrainHeight(projectile.position.x, projectile.position.z);
      const groundY = terrainHeight + this.WALNUT_RADIUS;
      const isAboveGround = projectile.position.y > groundY + this.GROUND_EPSILON;

      if (isAboveGround) {
        // ===== FLYING STATE =====
        // Apply gravity to Y velocity
        projectile.velocity.y += this.GRAVITY * delta;

        // Update position with full 3D velocity
        projectile.position.add(
          projectile.velocity.clone().multiplyScalar(delta)
        );

        // Reset rest timer (object is moving through air)
        projectile.restTimer = 0;

      } else {
        // ===== GROUNDED STATE =====
        // Correct any terrain penetration
        projectile.position.y = Math.max(projectile.position.y, groundY);

        // --- BOUNCE PHYSICS ---
        // If Y velocity is significant and haven't bounced too much, bounce
        if (Math.abs(projectile.velocity.y) > this.BOUNCE_THRESHOLD && projectile.bounces < this.MAX_BOUNCES) {
          projectile.velocity.y = -projectile.velocity.y * this.BOUNCE_DAMPING;
          projectile.bounces++;
          projectile.restTimer = 0; // Reset rest timer on bounce
        } else {
          // Stop vertical bouncing
          projectile.velocity.y = 0;
        }

        // --- SLOPE-BASED ROLLING PHYSICS (SIMPLIFIED) ---
        // Calculate terrain slope at current position
        const sampleDist = 0.3;
        const hX_pos = getTerrainHeight(projectile.position.x + sampleDist, projectile.position.z);
        const hX_neg = getTerrainHeight(projectile.position.x - sampleDist, projectile.position.z);
        const hZ_pos = getTerrainHeight(projectile.position.x, projectile.position.z + sampleDist);
        const hZ_neg = getTerrainHeight(projectile.position.x, projectile.position.z - sampleDist);

        // Gradient components (negative = downhill in that direction)
        const slopeX = (hX_neg - hX_pos) / (2 * sampleDist);
        const slopeZ = (hZ_neg - hZ_pos) / (2 * sampleDist);
        const slopeAngle = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);

        // Apply rolling acceleration if slope is significant
        if (slopeAngle > this.MIN_SLOPE_ANGLE) {
          // Normalize slope direction
          const slopeDirX = slopeX / slopeAngle;
          const slopeDirZ = slopeZ / slopeAngle;

          // Rolling acceleration = g * sin(angle) * (1 - friction)
          // For small angles: sin(angle) ≈ angle
          const rollAccel = Math.abs(this.GRAVITY) * slopeAngle * (1 - this.ROLLING_FRICTION);

          // Apply acceleration in downhill direction
          projectile.velocity.x += slopeDirX * rollAccel * delta;
          projectile.velocity.z += slopeDirZ * rollAccel * delta;
        }

        // --- FRICTION (TIME-BASED, NOT FRAME-BASED) ---
        // Exponential decay: v(t) = v(0) * friction^t
        const frictionFactor = Math.pow(this.FRICTION_COEFFICIENT, delta);
        projectile.velocity.x *= frictionFactor;
        projectile.velocity.z *= frictionFactor;

        // --- UPDATE POSITION WITH HORIZONTAL VELOCITY ---
        const oldPosX = projectile.position.x;
        const oldPosZ = projectile.position.z;
        projectile.position.x += projectile.velocity.x * delta;
        projectile.position.z += projectile.velocity.z * delta;

        // --- CRITICAL: RE-SAMPLE TERRAIN AT NEW XZ POSITION ---
        // This prevents float/sink when rolling across slopes
        const newTerrainHeight = getTerrainHeight(projectile.position.x, projectile.position.z);
        const newGroundY = newTerrainHeight + this.WALNUT_RADIUS;
        projectile.position.y = newGroundY;

        // DEBUG: Log terrain resampling for tree-dropped walnuts
        if (projectile.ownerId === 'game' && (Math.abs(oldPosX - projectile.position.x) > 0.01 || Math.abs(oldPosZ - projectile.position.z) > 0.01)) {
          console.log(`🌰 Walnut rolled: XZ=(${oldPosX.toFixed(2)},${oldPosZ.toFixed(2)}) → (${projectile.position.x.toFixed(2)},${projectile.position.z.toFixed(2)}), terrainH=${terrainHeight.toFixed(3)} → ${newTerrainHeight.toFixed(3)}, Y=${projectile.position.y.toFixed(3)}`);
        }

        // --- REST DETECTION (3D velocity + sleep timer) ---
        const speed3D = Math.sqrt(
          projectile.velocity.x * projectile.velocity.x +
          projectile.velocity.y * projectile.velocity.y +
          projectile.velocity.z * projectile.velocity.z
        );

        if (speed3D < this.REST_VELOCITY_THRESHOLD) {
          projectile.restTimer += delta;

          if (projectile.restTimer >= this.REST_TIME_REQUIRED) {
            // Object has come to rest - mark as settled
            projectile.velocity.set(0, 0, 0);
            projectile.hasHit = true;

            // DEBUG: Log final settled position
            if (projectile.ownerId === 'game') {
              console.log(`✅ Walnut SETTLED at (${projectile.position.x.toFixed(2)}, ${projectile.position.y.toFixed(2)}, ${projectile.position.z.toFixed(2)}), terrainH=${newTerrainHeight.toFixed(3)}, restTime=${projectile.restTimer.toFixed(2)}s`);
            }

            this.onProjectileMiss(projectile);
            toRemove.push(id);
            return;
          }
        } else {
          // Object is still moving, reset rest timer
          projectile.restTimer = 0;
        }
      }

      // Spin walnut for visual effect (applies to both flying and grounded)
      projectile.mesh.rotation.x += delta * 10;
      projectile.mesh.rotation.y += delta * 15;

      // Update mesh position
      projectile.mesh.position.copy(projectile.position);

      // MVP 8: Near-miss detection (check early for responsive feedback)
      this.checkNearMissDetection(projectile, entities, now);

      // MVP 8: Check hit detection (must happen while projectile is flying, before settling)
      const hitEntityId = this.checkHitDetection(projectile, entities);
      if (hitEntityId) {
        projectile.hasHit = true;
        this.onProjectileHit(projectile, hitEntityId);
        toRemove.push(id);
        return;
      }

      // MVP 8: Check collision with trees/rocks (skip for tree-dropped walnuts)
      if (this.collisionSystem && projectile.ownerId !== 'game') {
        // Calculate next position for raycast collision check
        const nextPos = projectile.position.clone().add(
          projectile.velocity.clone().multiplyScalar(delta)
        );

        // Pass ownerId so collision system skips thrower's capsule
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
