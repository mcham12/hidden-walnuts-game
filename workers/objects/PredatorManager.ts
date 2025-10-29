// MVP 12: Predator Manager - AI predators that create PvE danger
// Industry-standard patterns: behavior trees, target selection, state machines

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Predator {
  id: string;
  type: 'cardinal' | 'toucan' | 'wildebeest';
  position: Vector3;
  velocity: Vector3;
  rotationY: number;
  state: 'idle' | 'patrol' | 'targeting' | 'attacking' | 'returning';
  targetId: string | null; // Player or NPC being targeted
  lastAttackTime: number;
  spawnTime: number;
  health: number; // Predators can be killed by players
}

interface PlayerData {
  position: Vector3;
  inventory: number; // Walnut count
  id: string;
  username: string;
}

export class PredatorManager {
  private predators: Map<string, Predator> = new Map();
  private nextPredatorId = 0;
  private lastSpawnCheck = 0;

  // Configuration constants
  private readonly MAX_PREDATORS = 3; // 3 active predators max
  private readonly SPAWN_CHECK_INTERVAL = 30000; // Check every 30s
  private readonly MIN_SPAWN_INTERVAL = 60000; // At least 60s between spawns
  private readonly PREDATOR_SPAWN_CHANCE = 0.3; // 30% chance per check

  // Aerial predators (Cardinal, Toucan)
  private readonly AERIAL_SPEED = 8.0; // Fast movement
  private readonly AERIAL_ATTACK_COOLDOWN = 30000; // 30s between attacks
  private readonly AERIAL_STEAL_AMOUNT = 2; // Steal 1-2 walnuts
  private readonly AERIAL_FLIGHT_HEIGHT = 15.0; // Fly at this height
  private readonly AERIAL_DIVE_SPEED = 12.0; // Faster when diving

  // Ground predators (Wildebeest)
  private readonly GROUND_SPEED = 6.0; // Faster than players (5.0)
  private readonly GROUND_ATTACK_COOLDOWN = 5000; // 5s between bites
  private readonly GROUND_DAMAGE = 30; // Damage per bite
  private readonly GROUND_ATTACK_RANGE = 1.5; // Close range attack

  // General behavior
  private readonly TARGET_RANGE = 40.0; // Detection range
  private readonly ATTACK_RANGE_AERIAL = 2.0; // Dive/grab range
  private readonly PATROL_RADIUS = 50.0; // Patrol area size
  private readonly PREDATOR_HEALTH = 100; // Can be killed

  constructor() {
    console.log('🦅 PredatorManager initialized');
  }

  /**
   * Update all predators - called from ForestManager update loop
   */
  update(
    delta: number,
    players: Map<string, PlayerData>,
    npcs: Map<string, PlayerData>,
    getTerrainHeight: (x: number, z: number) => number
  ): void {
    const now = Date.now();

    // Check if we should spawn new predators
    if (now - this.lastSpawnCheck > this.SPAWN_CHECK_INTERVAL) {
      this.checkSpawnPredator(getTerrainHeight);
      this.lastSpawnCheck = now;
    }

    // Update each predator
    const toRemove: string[] = [];
    this.predators.forEach((predator, id) => {
      // Check if predator should despawn (too old or dead)
      const lifetime = now - predator.spawnTime;
      if (predator.health <= 0 || lifetime > 300000) { // 5 min max lifetime or dead
        toRemove.push(id);
        return;
      }

      // Update predator AI
      this.updatePredator(predator, delta, players, npcs, getTerrainHeight, now);
    });

    // Remove dead/old predators
    toRemove.forEach(id => {
      this.predators.delete(id);
      console.log(`🦅 Predator ${id} despawned`);
    });
  }

  /**
   * Check if we should spawn a new predator
   */
  private checkSpawnPredator(getTerrainHeight: (x: number, z: number) => number): void {
    // Don't spawn if at max capacity
    if (this.predators.size >= this.MAX_PREDATORS) return;

    // Random chance to spawn
    if (Math.random() > this.PREDATOR_SPAWN_CHANCE) return;

    // Randomly choose predator type
    const types: Predator['type'][] = ['cardinal', 'toucan', 'wildebeest'];
    const type = types[Math.floor(Math.random() * types.length)];

    this.spawnPredator(type, getTerrainHeight);
  }

  /**
   * Spawn a new predator at random location
   */
  spawnPredator(type: Predator['type'], getTerrainHeight: (x: number, z: number) => number): string {
    const id = `predator-${this.nextPredatorId++}`;

    // Random spawn position at edge of map
    const angle = Math.random() * Math.PI * 2;
    const spawnRadius = 80; // Spawn outside main play area
    const x = Math.cos(angle) * spawnRadius;
    const z = Math.sin(angle) * spawnRadius;

    // Aerial predators start high, ground predators on terrain
    const isAerial = type === 'cardinal' || type === 'toucan';
    const y = isAerial
      ? this.AERIAL_FLIGHT_HEIGHT
      : getTerrainHeight(x, z) + 1.0;

    const predator: Predator = {
      id,
      type,
      position: { x, y, z },
      velocity: { x: 0, y: 0, z: 0 },
      rotationY: angle,
      state: 'patrol',
      targetId: null,
      lastAttackTime: 0,
      spawnTime: Date.now(),
      health: this.PREDATOR_HEALTH,
    };

    this.predators.set(id, predator);
    console.log(`🦅 Spawned ${type} predator at (${x.toFixed(1)}, ${z.toFixed(1)})`);

    return id;
  }

  /**
   * Update single predator AI
   */
  private updatePredator(
    predator: Predator,
    delta: number,
    players: Map<string, PlayerData>,
    npcs: Map<string, PlayerData>,
    getTerrainHeight: (x: number, z: number) => number,
    now: number
  ): void {
    const isAerial = predator.type === 'cardinal' || predator.type === 'toucan';

    // Combine players and NPCs into single target list
    const allTargets = new Map<string, PlayerData>([...players, ...npcs]);

    switch (predator.state) {
      case 'idle':
      case 'patrol':
        this.updatePatrol(predator, delta, allTargets, getTerrainHeight, isAerial);
        break;

      case 'targeting':
        this.updateTargeting(predator, delta, allTargets, getTerrainHeight, isAerial);
        break;

      case 'attacking':
        this.updateAttacking(predator, delta, allTargets, now, isAerial);
        break;

      case 'returning':
        this.updateReturning(predator, delta, getTerrainHeight, isAerial);
        break;
    }

    // Update position based on velocity
    predator.position.x += predator.velocity.x * delta;
    predator.position.y += predator.velocity.y * delta;
    predator.position.z += predator.velocity.z * delta;

    // Keep aerial predators at flight height, ground predators on terrain
    if (isAerial) {
      predator.position.y = this.AERIAL_FLIGHT_HEIGHT;
    } else {
      predator.position.y = getTerrainHeight(predator.position.x, predator.position.z) + 1.0;
    }

    // Update rotation to face movement direction
    if (predator.velocity.x !== 0 || predator.velocity.z !== 0) {
      predator.rotationY = Math.atan2(predator.velocity.x, predator.velocity.z);
    }
  }

  /**
   * Patrol behavior: Look for targets, wander randomly
   */
  private updatePatrol(
    predator: Predator,
    delta: number,
    targets: Map<string, PlayerData>,
    getTerrainHeight: (x: number, z: number) => number,
    isAerial: boolean
  ): void {
    // Look for targets with walnuts
    const target = this.findBestTarget(predator, targets);

    if (target) {
      predator.targetId = target.id;
      predator.state = 'targeting';
      console.log(`🎯 ${predator.type} targeting ${target.username}`);
      return;
    }

    // Random patrol movement
    const speed = isAerial ? this.AERIAL_SPEED : this.GROUND_SPEED;
    const wanderChance = 0.02; // 2% chance per frame to change direction

    if (Math.random() < wanderChance) {
      const angle = Math.random() * Math.PI * 2;
      predator.velocity.x = Math.cos(angle) * speed;
      predator.velocity.z = Math.sin(angle) * speed;
    }

    // Bounce off world boundaries
    const maxDist = this.PATROL_RADIUS;
    if (Math.abs(predator.position.x) > maxDist || Math.abs(predator.position.z) > maxDist) {
      // Turn around
      predator.velocity.x *= -1;
      predator.velocity.z *= -1;
    }
  }

  /**
   * Targeting behavior: Chase target until in attack range
   */
  private updateTargeting(
    predator: Predator,
    delta: number,
    targets: Map<string, PlayerData>,
    getTerrainHeight: (x: number, z: number) => number,
    isAerial: boolean
  ): void {
    if (!predator.targetId) {
      predator.state = 'patrol';
      return;
    }

    const target = targets.get(predator.targetId);
    if (!target) {
      // Target disappeared
      predator.targetId = null;
      predator.state = 'patrol';
      return;
    }

    // Calculate direction to target
    const dx = target.position.x - predator.position.x;
    const dz = target.position.z - predator.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    // Target too far? Give up
    if (distance > this.TARGET_RANGE * 1.5) {
      console.log(`🦅 ${predator.type} lost target (too far)`);
      predator.targetId = null;
      predator.state = 'returning';
      return;
    }

    // In attack range?
    const attackRange = isAerial ? this.ATTACK_RANGE_AERIAL : this.GROUND_ATTACK_RANGE;
    if (distance < attackRange) {
      predator.state = 'attacking';
      return;
    }

    // Chase target
    const speed = isAerial ? this.AERIAL_DIVE_SPEED : this.GROUND_SPEED;
    const dirX = dx / distance;
    const dirZ = dz / distance;

    predator.velocity.x = dirX * speed;
    predator.velocity.z = dirZ * speed;
  }

  /**
   * Attacking behavior: Perform attack, return to patrol
   */
  private updateAttacking(
    predator: Predator,
    delta: number,
    targets: Map<string, PlayerData>,
    now: number,
    isAerial: boolean
  ): void {
    const cooldown = isAerial ? this.AERIAL_ATTACK_COOLDOWN : this.GROUND_ATTACK_COOLDOWN;

    // Check cooldown
    if (now - predator.lastAttackTime < cooldown) {
      predator.state = 'returning';
      return;
    }

    if (!predator.targetId) {
      predator.state = 'patrol';
      return;
    }

    const target = targets.get(predator.targetId);
    if (!target) {
      predator.targetId = null;
      predator.state = 'patrol';
      return;
    }

    // Execute attack
    predator.lastAttackTime = now;

    if (isAerial) {
      // Aerial: Steal walnuts
      const stealAmount = Math.min(
        target.inventory,
        Math.floor(Math.random() * this.AERIAL_STEAL_AMOUNT) + 1
      );
      console.log(`🦅 ${predator.type} stole ${stealAmount} walnuts from ${target.username}`);
      // Note: Actual inventory decrement happens in ForestManager
    } else {
      // Ground: Deal damage
      console.log(`🐃 ${predator.type} bit ${target.username} for ${this.GROUND_DAMAGE} damage`);
      // Note: Actual damage happens in ForestManager
    }

    // After attack, return to patrol
    predator.state = 'returning';
    predator.targetId = null;
  }

  /**
   * Returning behavior: Move away from players after attack
   */
  private updateReturning(
    predator: Predator,
    delta: number,
    getTerrainHeight: (x: number, z: number) => number,
    isAerial: boolean
  ): void {
    // Move toward edge of map
    const angle = Math.atan2(predator.position.z, predator.position.x);
    const speed = isAerial ? this.AERIAL_SPEED : this.GROUND_SPEED;

    predator.velocity.x = Math.cos(angle) * speed;
    predator.velocity.z = Math.sin(angle) * speed;

    // When far enough, return to patrol
    const distanceFromCenter = Math.sqrt(
      predator.position.x * predator.position.x +
      predator.position.z * predator.position.z
    );

    if (distanceFromCenter > this.PATROL_RADIUS * 0.7) {
      predator.state = 'patrol';
    }
  }

  /**
   * Find best target: Prefer players with most walnuts
   */
  private findBestTarget(
    predator: Predator,
    targets: Map<string, PlayerData>
  ): PlayerData | null {
    let bestTarget: PlayerData | null = null;
    let bestScore = 0;

    targets.forEach(target => {
      // Calculate distance
      const dx = target.position.x - predator.position.x;
      const dz = target.position.z - predator.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Too far? Skip
      if (distance > this.TARGET_RANGE) return;

      // Score = walnuts * (1 - distance/maxRange)
      // Prefer targets with more walnuts that are closer
      const walnutScore = target.inventory;
      const distanceScore = 1 - (distance / this.TARGET_RANGE);
      const score = walnutScore * distanceScore;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    });

    return bestTarget;
  }

  /**
   * Damage a predator (players can fight back)
   */
  damagePredator(predatorId: string, damage: number): boolean {
    const predator = this.predators.get(predatorId);
    if (!predator) return false;

    predator.health -= damage;
    console.log(`🎯 ${predator.type} took ${damage} damage (${predator.health} HP remaining)`);

    if (predator.health <= 0) {
      console.log(`💀 ${predator.type} was killed!`);
      this.predators.delete(predatorId);
      return true; // Predator killed
    }

    return false;
  }

  /**
   * Get all predators for client sync
   */
  getPredators(): Predator[] {
    return Array.from(this.predators.values());
  }

  /**
   * Get predator count
   */
  getCount(): number {
    return this.predators.size;
  }

  /**
   * Force spawn predator (admin command)
   */
  forceSpawn(type: Predator['type'], getTerrainHeight: (x: number, z: number) => number): string {
    return this.spawnPredator(type, getTerrainHeight);
  }

  /**
   * Remove predator (admin command)
   */
  removePredator(predatorId: string): boolean {
    return this.predators.delete(predatorId);
  }

  /**
   * Clear all predators (admin command)
   */
  clearAll(): void {
    this.predators.clear();
    console.log('🦅 All predators cleared');
  }
}
