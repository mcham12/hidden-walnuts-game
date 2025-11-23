// MVP 12: Predator Manager - AI predators that create PvE danger
// Industry-standard patterns: behavior trees, target selection, state machines
//
// MVP 12: Rank-Based Targeting System
// - Players: Ignore Rookie/Apprentice, start targeting Dabbler+ with weighted preference
// - NPCs: Target based on spawn time (older NPCs = higher priority)
// - Predators prefer higher-ranked players for increased challenge

import { getPlayerTitle } from '../shared/PlayerRanks';

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
  state: 'idle' | 'patrol' | 'targeting' | 'attacking' | 'returning' | 'distracted' | 'fleeing';
  targetId: string | null; // Player or NPC being targeted
  lastAttackTime: number;
  spawnTime: number;
  // MVP 12 Defense: No health - predators are driven away, not killed
  annoyanceLevel: number; // 0-4 for wildebeest (4 hits = flees), unused for aerial
  distractedUntil?: number; // Timestamp when distraction ends (aerial only)
  distractedByWalnut?: string; // Walnut ID that distracted this predator (aerial only)
  targetHeight: number; // Target height for smooth transitions (industry standard)
  currentHeight: number; // Current height for lerping (smooth transitions)
  bobbingOffset: number; // Sine wave bobbing phase offset (Zelda-style)
  lastDecisionTime: number; // Halo-style: Random decision timing
  nextDecisionDelay: number; // Halo-style: Randomized delay between decisions
}

interface PlayerData {
  position: Vector3;
  inventory: number; // Walnut count
  id: string;
  username: string;
  score?: number; // MVP 12: Player score (for rank-based targeting)
  spawnTime?: number; // MVP 12: NPC spawn time (for time-based targeting)
  isPlayer?: boolean; // MVP 12: Distinguish players from NPCs
}

export class PredatorManager {
  private predators: Map<string, Predator> = new Map();
  private nextPredatorId = 0;
  private lastSpawnCheck = 0;
  private onPredatorFlee?: () => void; // MVP 13: Callback for flee tracking

  // Configuration constants
  private readonly MAX_PREDATORS = 2; // 2 active predators max
  private readonly SPAWN_CHECK_INTERVAL = 15000; // Check every 15s (less frequent)
  private readonly MIN_SPAWN_INTERVAL = 90000; // At least 90s between spawns (increased)
  private readonly PREDATOR_SPAWN_CHANCE = 0.4; // 40% chance per check (reduced from 100%)

  // Aerial predators (Cardinal, Toucan) - Zelda/Monster Hunter style
  private readonly AERIAL_SPEED = 6.5; // Moderate speed (reduced from 8.0)
  private readonly AERIAL_ATTACK_COOLDOWN = 45000; // 45s between attacks (increased from 30s)
  private readonly AERIAL_STEAL_AMOUNT = 2; // Steal 1-2 walnuts
  private readonly AERIAL_CRUISE_HEIGHT = 2.5; // Base cruise height (low enough to hit - player priority)
  private readonly AERIAL_DIVE_HEIGHT = 1.8; // Attack dive height (very vulnerable during dives)
  private readonly AERIAL_BOBBING_AMPLITUDE = 0.4; // Sine wave bobbing range (minimal for easy targeting)
  private readonly AERIAL_BOBBING_SPEED = 2.0; // How fast they bob
  private readonly AERIAL_HEIGHT_LERP_SPEED = 2.0; // Smooth height transitions (industry standard)

  // Ground predators (Wildebeest)
  private readonly GROUND_SPEED = 5.5; // Slightly faster than players (5.0) - reduced from 6.0
  private readonly GROUND_ATTACK_COOLDOWN = 8000; // 8s between bites (increased from 5s)
  private readonly GROUND_DAMAGE = 30; // Damage per bite
  private readonly GROUND_ATTACK_RANGE = 1.5; // Close range attack

  // General behavior
  private readonly TARGET_RANGE = 30.0; // Detection range (reduced from 40.0)
  private readonly ATTACK_RANGE_AERIAL = 2.0; // Dive/grab range
  private readonly PATROL_RADIUS = 50.0; // Patrol area size
  // MVP 12: No health - predators are driven away, not killed (annoyance system)

  constructor() {
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
      // Check if predator should despawn (too old or fled far enough)
      const lifetime = now - predator.spawnTime;
      if (lifetime > 300000) { // 5 min max lifetime
        toRemove.push(id);
        return;
      }

      // Check if fleeing predator has reached edge
      if (predator.state === 'fleeing') {
        const distanceFromCenter = Math.sqrt(predator.position.x ** 2 + predator.position.z ** 2);
        if (distanceFromCenter > 100) { // Far enough from center
          toRemove.push(id);
          return;
        }
      }

      // Update predator AI
      this.updatePredator(predator, delta, players, npcs, getTerrainHeight, now);
    });

    // Remove dead/old predators
    toRemove.forEach(id => {
      this.predators.delete(id);
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

    // Check if wildebeest already exists
    const hasWildebeest = Array.from(this.predators.values()).some(p => p.type === 'wildebeest');

    let type: Predator['type'];

    if (!hasWildebeest) {
      // No wildebeest exists - always spawn one first (for testing annoyance bar)
      type = 'wildebeest';
    } else {
      // Wildebeest exists - weighted random (favor wildebeest: 50%, cardinal: 25%, toucan: 25%)
      const rand = Math.random();
      if (rand < 0.5) {
        type = 'wildebeest';
      } else if (rand < 0.75) {
        type = 'cardinal';
      } else {
        type = 'toucan';
      }
    }

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
      ? this.AERIAL_CRUISE_HEIGHT
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
      annoyanceLevel: 0, // MVP 12: 0-4 for wildebeest, unused for aerial
      targetHeight: y, // Initialize at spawn height
      currentHeight: y, // Initialize at spawn height
      bobbingOffset: Math.random() * Math.PI * 2, // Random phase offset for natural variation
      lastDecisionTime: Date.now(),
      nextDecisionDelay: 2000 + Math.random() * 3000, // Halo-style: 2-5 second random delay
    };

    this.predators.set(id, predator);

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

      case 'distracted':
        this.updateDistracted(predator, delta, now, isAerial);
        break;

      case 'fleeing':
        this.updateFleeing(predator, delta, isAerial);
        break;
    }

    // Update position based on velocity with collision detection
    if (isAerial) {
      // Aerial predators: No collision, fly freely
      predator.position.x += predator.velocity.x * delta;
      predator.position.z += predator.velocity.z * delta;
    } else {
      // Ground predators (wildebeest): Apply collision detection
      this.updateGroundPredatorMovement(predator, delta, getTerrainHeight);
    }

    // Industry-standard aerial/ground movement patterns
    if (isAerial) {
      // Zelda-style: Set target height based on behavior state
      if (predator.state === 'targeting' || predator.state === 'attacking') {
        predator.targetHeight = this.AERIAL_DIVE_HEIGHT; // Dive for attack
      } else {
        predator.targetHeight = this.AERIAL_CRUISE_HEIGHT; // Cruise height
      }

      // Smooth height lerp (Monster Hunter style - no instant teleports)
      const heightDiff = predator.targetHeight - predator.currentHeight;
      predator.currentHeight += heightDiff * this.AERIAL_HEIGHT_LERP_SPEED * delta;

      // Add sine wave bobbing (Zelda Keese style - makes them visible and dynamic)
      predator.bobbingOffset += this.AERIAL_BOBBING_SPEED * delta;
      const bobbing = Math.sin(predator.bobbingOffset) * this.AERIAL_BOBBING_AMPLITUDE;

      // Final height = lerped height + bobbing
      predator.position.y = predator.currentHeight + bobbing;
    } else {
      // Ground predators follow terrain height (standard 3D game practice)
      const terrainY = getTerrainHeight(predator.position.x, predator.position.z);
      predator.position.y = terrainY + 1.0; // 1 unit above terrain
    }

    // Update rotation to face movement direction (standard for all games)
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
    // Look for targets with walnuts (excluding targets already being attacked)
    const target = this.findBestTarget(predator, targets, this.predators);

    if (target) {
      predator.targetId = target.id;
      predator.state = 'targeting';
      return;
    }

    const speed = isAerial ? this.AERIAL_SPEED : this.GROUND_SPEED;
    const now = Date.now();

    if (isAerial) {
      // AERIAL: Smooth wandering behavior (Craig Reynolds steering)
      // Birds fly in smooth arcs, not sharp turns
      if (now - predator.lastDecisionTime >= predator.nextDecisionDelay) {
        // Calculate current direction
        const currentAngle = Math.atan2(predator.velocity.z, predator.velocity.x);

        // Add small random steering offset (-30° to +30°)
        const steeringAngle = (Math.random() - 0.5) * Math.PI / 3;
        const newAngle = currentAngle + steeringAngle;

        // Apply new velocity (smooth wandering)
        predator.velocity.x = Math.cos(newAngle) * speed;
        predator.velocity.z = Math.sin(newAngle) * speed;

        // Longer delays for smooth flight paths (3-5 seconds)
        predator.lastDecisionTime = now;
        predator.nextDecisionDelay = 3000 + Math.random() * 2000;
      }
    } else {
      // GROUND: Natural idle/roam behavior (like animals in nature)
      if (now - predator.lastDecisionTime >= predator.nextDecisionDelay) {
        // Decide whether to idle or move (60% move, 40% idle)
        const shouldMove = Math.random() < 0.6;

        if (shouldMove) {
          // Pick a random direction and move smoothly
          const angle = Math.random() * Math.PI * 2;
          predator.velocity.x = Math.cos(angle) * speed;
          predator.velocity.z = Math.sin(angle) * speed;

          // Move for 3-6 seconds
          predator.nextDecisionDelay = 3000 + Math.random() * 3000;
        } else {
          // Idle (stop moving)
          predator.velocity.x = 0;
          predator.velocity.z = 0;

          // Idle for 2-4 seconds
          predator.nextDecisionDelay = 2000 + Math.random() * 2000;
        }

        predator.lastDecisionTime = now;
      }
    }

    // Boundary handling
    const maxDist = this.PATROL_RADIUS;
    if (Math.abs(predator.position.x) > maxDist || Math.abs(predator.position.z) > maxDist) {
      if (isAerial) {
        // AERIAL: Smooth turn back toward center (natural bird behavior)
        const angleToCenter = Math.atan2(-predator.position.z, -predator.position.x);
        predator.velocity.x = Math.cos(angleToCenter) * speed;
        predator.velocity.z = Math.sin(angleToCenter) * speed;
      } else {
        // GROUND: Turn back toward center naturally (like real animals)
        // Only change direction if we're not already heading inward
        const angleToCenter = Math.atan2(-predator.position.z, -predator.position.x);
        predator.velocity.x = Math.cos(angleToCenter) * speed;
        predator.velocity.z = Math.sin(angleToCenter) * speed;

        // Reset decision timer so we pick a new direction after moving inward
        predator.lastDecisionTime = now;
        predator.nextDecisionDelay = 2000 + Math.random() * 2000;
      }
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
    const speed = isAerial ? this.AERIAL_SPEED : this.GROUND_SPEED;
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
      // Note: Actual inventory decrement happens in ForestManager
    } else {
      // Ground: Deal damage
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
   * MVP 12: Distracted behavior (aerial only)
   * Bird chases thrown walnut, returns to patrol after distraction ends
   */
  private updateDistracted(
    predator: Predator,
    delta: number,
    now: number,
    isAerial: boolean
  ): void {
    if (!isAerial) {
      // Should never happen, but safety check
      predator.state = 'patrol';
      return;
    }

    // Check if distraction has ended
    if (predator.distractedUntil && now >= predator.distractedUntil) {
      predator.state = 'patrol';
      predator.distractedByWalnut = undefined;
      predator.distractedUntil = undefined;
      return;
    }

    // While distracted: Fly in random direction (chasing the walnut)
    // Simplified: Just fly away from original position
    const speed = this.AERIAL_SPEED * 1.2; // Fly faster when chasing
    predator.velocity.x = Math.cos(predator.rotationY) * speed;
    predator.velocity.z = Math.sin(predator.rotationY) * speed;
  }

  /**
   * MVP 12: Fleeing behavior (wildebeest only)
   * Runs away from players toward map edge, despawns when far enough
   */
  private updateFleeing(
    predator: Predator,
    delta: number,
    isAerial: boolean
  ): void {
    if (isAerial) {
      // Should never happen, but safety check
      predator.state = 'patrol';
      return;
    }

    // Run away from center (toward map edge)
    const angle = Math.atan2(predator.position.z, predator.position.x);
    const fleeSpeed = this.GROUND_SPEED * 1.5; // Run faster when fleeing

    predator.velocity.x = Math.cos(angle) * fleeSpeed;
    predator.velocity.z = Math.sin(angle) * fleeSpeed;

    // Note: Despawn logic is in the main update() loop (checks distance > 100)
  }

  /**
   * Find best target: Prefer players with most walnuts
   */
  /**
   * MVP 12: Find best target with rank-based weighting and multi-targeting prevention
   *
   * Targeting Rules:
   * - Players: Ignore Rookie/Apprentice (0-100 score), start at Dabbler (101+)
   * - Players: Weight by rank (Dabbler=0.5x, Slick=1.0x, Maestro+=1.3-2.0x)
   * - NPCs: Constant 0.3 weight (less attractive than Dabbler players)
   * - Exclusion: Skip targets already being attacked by other predators
   * - Base score: walnuts * distance * rank_weight
   */
  private findBestTarget(
    predator: Predator,
    targets: Map<string, PlayerData>,
    allPredators: Map<string, Predator>
  ): PlayerData | null {
    let bestTarget: PlayerData | null = null;
    let bestScore = 0;
    const now = Date.now();

    // Build set of target IDs that are already being attacked by other predators
    const targetedIds = new Set<string>();
    allPredators.forEach((otherPredator, otherId) => {
      // Skip self
      if (otherId === predator.id) return;

      // If another predator is targeting/attacking someone, mark them as taken
      if ((otherPredator.state === 'targeting' || otherPredator.state === 'attacking')
        && otherPredator.targetId) {
        targetedIds.add(otherPredator.targetId);
      }
    });

    targets.forEach(target => {
      // Skip targets already being attacked by another predator
      if (targetedIds.has(target.id)) return;

      // Calculate distance
      const dx = target.position.x - predator.position.x;
      const dz = target.position.z - predator.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Too far? Skip
      if (distance > this.TARGET_RANGE) return;

      // MVP 12: Calculate rank-based targeting weight
      let rankWeight = 1.0;

      if (target.isPlayer && target.score !== undefined) {
        // PLAYERS: Use rank-based weighting
        const playerTitle = getPlayerTitle(target.score);
        rankWeight = playerTitle.predatorTargetingWeight;

        // Skip Rookie/Apprentice players (weight = 0.0)
        if (rankWeight === 0.0) return;

        // Dabbler+ get progressively higher targeting weight
        // Dabbler (0.5) < Slick (1.0) < Maestro (1.3) < Ninja (1.6) < Legend (2.0)
      } else if (!target.isPlayer) {
        // NPCs: Constant lower weight (less attractive than Dabbler players)
        // Simplified from time-based scaling for more predictable behavior
        // 0.3 weight makes NPCs less appealing than Dabbler (0.5) but not ignored like Rookies (0.0)
        rankWeight = 0.3;
      }

      // Base scoring: walnuts * distance * rank weight
      // Prefer targets with more walnuts that are closer and higher-ranked
      const walnutScore = Math.max(1, target.inventory); // Minimum 1 to always have some value
      const distanceScore = 1 - (distance / this.TARGET_RANGE);
      const score = walnutScore * distanceScore * rankWeight;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    });

    return bestTarget;
  }

  /**
   * MVP 12: Handle walnut hit on wildebeest (annoyance system)
   * Aerial predators are NOT hit directly - they're distracted instead
   */
  handleWalnutHit(predatorId: string): { hit: boolean; annoyanceLevel: number; fleeing: boolean } {
    const predator = this.predators.get(predatorId);

    // Invalid predator or aerial (aerial use distraction, not hits)
    if (!predator || predator.type !== 'wildebeest') {
      return { hit: false, annoyanceLevel: 0, fleeing: false };
    }

    // Increment annoyance
    predator.annoyanceLevel++;

    // Check if wildebeest should flee (at 4 hits)
    if (predator.annoyanceLevel >= 4) {
      predator.state = 'fleeing';
      predator.targetId = null; // Stop targeting

      // MVP 13: Notify of flee event
      if (this.onPredatorFlee) {
        this.onPredatorFlee();
      }

      return { hit: true, annoyanceLevel: 4, fleeing: true };
    }

    return { hit: true, annoyanceLevel: predator.annoyanceLevel, fleeing: false };
  }

  /**
   * MVP 12: Distract aerial predator with thrown walnut
   * Bird must be visible to player when throw is made
   */
  distractPredator(predatorId: string, walnutId: string): boolean {
    const predator = this.predators.get(predatorId);

    // Only aerial predators can be distracted
    if (!predator || predator.type === 'wildebeest') {
      return false;
    }

    // Enter distracted state
    predator.state = 'distracted';
    predator.distractedByWalnut = walnutId;
    // Generous distraction duration (5-8 seconds) - makes defense mechanic very rewarding
    predator.distractedUntil = Date.now() + 5000 + Math.random() * 3000;
    predator.targetId = null; // Stop targeting player

    return true;
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
  }

  /**
   * Update ground predator movement with collision detection
   * Copied from NPCManager.updateMovement() - uses same collision system as NPCs
   */
  private updateGroundPredatorMovement(
    predator: Predator,
    delta: number,
    getTerrainHeight: (x: number, z: number) => number
  ): void {
    // Calculate proposed new position
    const newX = predator.position.x + predator.velocity.x * delta;
    const newZ = predator.position.z + predator.velocity.z * delta;

    // Check for collisions with solid obstacles (trees, rocks)
    const PREDATOR_RADIUS = 1.0; // Wildebeest are larger than NPCs
    let closestObstacle: { x: number; z: number } | null = null;
    let closestDistSq = Infinity;

    // Check landmark trees (same coordinates as NPCs use)
    // IMPORTANT: These coordinates MUST match client/src/Game.ts createLandmark() calls
    const landmarks = [
      { x: 0, z: 0 },     // Origin
      { x: 0, z: -80 },   // North
      { x: 0, z: 80 },    // South
      { x: 80, z: 0 },    // East
      { x: -80, z: 0 }    // West
    ];
    const LANDMARK_RADIUS = 0.8; // Landmark trees are larger
    const LANDMARK_COLLISION_DISTANCE = LANDMARK_RADIUS + PREDATOR_RADIUS;

    for (const landmark of landmarks) {
      const dx = newX - landmark.x;
      const dz = newZ - landmark.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < LANDMARK_COLLISION_DISTANCE * LANDMARK_COLLISION_DISTANCE && distSq < closestDistSq) {
        closestDistSq = distSq;
        closestObstacle = landmark;
      }
    }

    // Apply collision avoidance (same sliding logic as NPCs)
    if (closestObstacle) {
      // Calculate vector from obstacle to predator (push away)
      const pushX = newX - closestObstacle.x;
      const pushZ = newZ - closestObstacle.z;
      const pushDist = Math.sqrt(pushX * pushX + pushZ * pushZ);

      if (pushDist > 0.01) {
        // Normalize push vector
        const pushDirX = pushX / pushDist;
        const pushDirZ = pushZ / pushDist;

        // Calculate sliding direction (perpendicular to push direction)
        // This allows predators to slide around obstacles smoothly
        const slideX = -pushDirZ; // Perpendicular vector
        const slideZ = pushDirX;

        // Project original velocity onto slide direction
        const velocityDot = predator.velocity.x * slideX + predator.velocity.z * slideZ;

        // Try sliding along obstacle
        const slideAmount = Math.abs(velocityDot) * delta;
        const slideDirX = Math.sign(velocityDot) * slideX;
        const slideDirZ = Math.sign(velocityDot) * slideZ;

        // Apply slide movement (50% of original speed when sliding)
        predator.position.x += slideDirX * slideAmount * 0.5;
        predator.position.z += slideDirZ * slideAmount * 0.5;

        // Also push slightly away from obstacle to prevent getting stuck
        predator.position.x += pushDirX * 0.1;
        predator.position.z += pushDirZ * 0.1;
      }
    } else {
      // No collision - apply movement normally
      predator.position.x = newX;
      predator.position.z = newZ;
    }

    // Update Y position (terrain following)
    const terrainY = getTerrainHeight(predator.position.x, predator.position.z);
    predator.position.y = terrainY + 1.0; // 1 unit above terrain
  }
}
