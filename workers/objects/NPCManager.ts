/**
 * MVP 7: NPC Manager
 * Server-side AI controller for NPC characters
 *
 * Features:
 * - Spawn/despawn ~10 NPCs based on player count
 * - AI behaviors: IDLE, WANDER, APPROACH, GATHER, THROW
 * - Perception system (vision radius)
 * - Personality traits (aggression levels)
 * - Walnut gathering and throwing
 */

// Import types from ForestManager (these will be available at runtime)
// We'll use 'any' types here since we can't easily import from ForestManager
type Vector3 = { x: number; y: number; z: number };
type Vector2 = { x: number; z: number };

enum NPCBehavior {
  IDLE = 'idle',
  WANDER = 'wander',
  APPROACH = 'approach',
  GATHER = 'gather',
  THROW = 'throw'
}

interface NPC {
  id: string;
  characterId: string;
  username: string;
  position: Vector3;
  rotationY: number;
  velocity: Vector2;
  currentBehavior: NPCBehavior;
  behaviorTimer: number;
  behaviorDuration: number;
  targetPosition?: Vector3;
  targetEntityId?: string;
  targetStartTime?: number; // MVP 8 FIX: Track when started targeting entity (for timeout)
  animation: string;
  walnutInventory: number;
  lastThrowTime: number;
  aggressionLevel: number;
}

interface PlayerConnection {
  squirrelId: string;
  position: Vector3;
  username: string;
  characterId: string;
}

interface Walnut {
  id: string;
  location: Vector3;
  found: boolean;
  origin: 'game' | 'player';
  immunePlayerId?: string; // MVP 8: Player who can't pick up this walnut (hit by projectile)
  immuneUntil?: number; // MVP 8: Timestamp when immunity expires (1.5 seconds after hit)
}

export class NPCManager {
  private npcs: Map<string, NPC> = new Map();
  private npcCounter: number = 0;

  // Configuration
  private readonly MAX_NPCS = 2; // Reduced for testing (per user request)
  private readonly DESPAWN_PLAYER_THRESHOLD = 15; // Despawn NPCs if >15 real players
  private readonly NPC_SPEED = 2.4; // 80% of player speed (3.0 units/sec)
  // MVP 7.1: Increased from 0.15 to 0.20 (150ms → 200ms) for 25% cost reduction
  private readonly UPDATE_DELTA = 0.20; // 200ms update interval (5 Hz for cost-optimized performance)

  // Perception radii
  private readonly ENTITY_VISION_RADIUS = 30;
  private readonly WALNUT_VISION_RADIUS = 20;

  // Throw configuration
  // MVP 8 FIX: Increased throw frequency and range
  private readonly THROW_MIN_RANGE = 3; // Reduced from 5 to allow close-range throws
  private readonly THROW_MAX_RANGE = 18; // Increased from 15 for longer range
  private readonly THROW_COOLDOWN = 800; // Reduced from 1200ms to 800ms for more frequent throws
  private readonly MAX_INVENTORY = 6; // Increased from 5 to carry more ammo

  // Character types (all 11 available from characters.json)
  private readonly CHARACTER_TYPES = [
    'squirrel', 'lynx', 'goat', 'hare', 'moose', 'bear',
    'skunk', 'badger', 'chipmunk', 'turkey', 'mallard'
  ];

  // Reference to ForestManager for accessing game state
  private forestManager: any;

  constructor(forestManager: any) {
    this.forestManager = forestManager;
  }

  /**
   * Spawn NPCs based on player count
   */
  spawnNPCs(): void {
    const playerCount = this.forestManager.activePlayers.size;

    console.log(`🤖 NPC Spawn Check: ${this.npcs.size} NPCs exist, ${playerCount} players, MAX=${this.MAX_NPCS}`);

    // Don't spawn if too many players
    if (playerCount >= this.DESPAWN_PLAYER_THRESHOLD) {
      console.log(`⚠️ Too many players (${playerCount} >= ${this.DESPAWN_PLAYER_THRESHOLD}), skipping NPC spawn`);
      return;
    }

    // Spawn NPCs up to MAX_NPCS
    const npcsToSpawn = this.MAX_NPCS - this.npcs.size;
    console.log(`🤖 Spawning ${npcsToSpawn} NPCs...`);

    for (let i = 0; i < npcsToSpawn; i++) {
      const npc = this.createNPC();
      this.npcs.set(npc.id, npc);

      console.log(`✅ Created NPC: ${npc.id} (${npc.username})`);

      // Broadcast NPC spawn to all players
      this.broadcastNPCSpawn(npc);
    }

    console.log(`🎯 NPC spawn complete: ${this.npcs.size} total NPCs`);
  }

  /**
   * Despawn NPCs if player count exceeds threshold
   */
  despawnNPCsIfNeeded(): void {
    const playerCount = this.forestManager.activePlayers.size;

    // MVP 7.1: Removed logging to reduce DO CPU usage
    if (playerCount >= this.DESPAWN_PLAYER_THRESHOLD && this.npcs.size > 0) {
      for (const [npcId, npc] of this.npcs.entries()) {
        this.broadcastNPCDespawn(npcId);
        this.npcs.delete(npcId);
      }
    }
  }

  /**
   * Despawn all NPCs (called when last player leaves)
   * MVP 7.1: Cost optimization - stop idle processing when no players
   */
  despawnAllNPCs(): void {
    if (this.npcs.size === 0) return;

    console.log(`🧹 Despawning all ${this.npcs.size} NPCs (no players remaining)`);

    for (const [npcId, npc] of this.npcs.entries()) {
      this.broadcastNPCDespawn(npcId);
    }

    this.npcs.clear();
  }

  /**
   * Create a new NPC with random properties
   */
  private createNPC(): NPC {
    this.npcCounter++;
    const id = `npc-${String(this.npcCounter).padStart(3, '0')}`;

    // Random character type
    const characterId = this.CHARACTER_TYPES[Math.floor(Math.random() * this.CHARACTER_TYPES.length)];

    // Generate username from character type
    const username = this.generateNPCUsername(characterId);

    // Random spawn position (avoid center, spread out)
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 40; // 20-60 units from center
    const position: Vector3 = {
      x: Math.cos(angle) * distance,
      y: 2,
      z: Math.sin(angle) * distance
    };

    // Random aggression level
    // MVP 8: Increased aggression for very active combat
    // 20% neutral (0.5-0.7), 30% aggressive (0.7-0.85), 50% very aggressive (0.85-1.0)
    const rand = Math.random();
    let aggressionLevel: number;
    if (rand < 0.2) {
      aggressionLevel = 0.5 + Math.random() * 0.2; // Neutral (minimum 0.5)
    } else if (rand < 0.5) {
      aggressionLevel = 0.7 + Math.random() * 0.15; // Aggressive
    } else {
      aggressionLevel = 0.85 + Math.random() * 0.15; // Very Aggressive - MOST NPCs
    }

    return {
      id,
      characterId,
      username,
      position,
      rotationY: Math.random() * Math.PI * 2,
      velocity: { x: 0, z: 0 },
      currentBehavior: NPCBehavior.IDLE,
      behaviorTimer: 0,
      behaviorDuration: this.getRandomBehaviorDuration(NPCBehavior.IDLE),
      animation: 'idle',
      walnutInventory: 0,
      lastThrowTime: 0,
      aggressionLevel
    };
  }

  /**
   * Generate NPC username from character type
   */
  private generateNPCUsername(characterId: string): string {
    const nameMap: Record<string, string> = {
      'squirrel': 'Squirrel',
      'lynx': 'Lynx',
      'goat': 'Goat',
      'hare': 'Hare',
      'moose': 'Moose',
      'bear': 'Bear',
      'skunk': 'Skunk',
      'badger': 'Badger',
      'chipmunk': 'Chipmunk',
      'turkey': 'Turkey',
      'mallard': 'Mallard'
    };

    const baseName = nameMap[characterId] || 'Critter';
    return baseName; // Just the character type, no "NPC - " prefix
  }

  /**
   * Main update loop - called every 200ms (5 Hz) from ForestManager
   * MVP 7.1: Batch all NPC updates into single broadcast for efficiency
   * MVP 7.1: Reduced from 150ms to 200ms for 25% cost reduction
   */
  update(): void {
    const delta = this.UPDATE_DELTA;
    const npcUpdates: any[] = [];

    for (const [npcId, npc] of this.npcs.entries()) {
      // Update behavior timer
      npc.behaviorTimer += delta;

      // Perception: find nearby entities and walnuts
      const nearbyPlayers = this.findNearbyPlayers(npc, this.ENTITY_VISION_RADIUS);
      const nearbyNPCs = this.findNearbyNPCs(npc, this.ENTITY_VISION_RADIUS);
      const nearbyWalnuts = this.findNearbyWalnuts(npc, this.WALNUT_VISION_RADIUS);

      // Behavior selection and execution
      this.updateBehavior(npc, nearbyPlayers, nearbyNPCs, nearbyWalnuts, delta);

      // Movement
      this.updateMovement(npc, delta);

      // Collect NPC state for batched broadcast
      npcUpdates.push({
        npcId: npc.id,
        position: npc.position,
        rotationY: npc.rotationY,
        velocity: npc.velocity,
        animation: npc.animation,
        behavior: npc.currentBehavior
      });
    }

    // MVP 7.1: Batch broadcast all NPC updates in single message
    // Reduces broadcasts from N messages to 1 message (~90% reduction)
    if (npcUpdates.length > 0) {
      this.forestManager.broadcastToAll({
        type: 'npc_updates_batch',
        npcs: npcUpdates
      });
    }

    // Check if we need to despawn NPCs (player count check)
    this.despawnNPCsIfNeeded();
  }

  /**
   * Find nearby players within radius
   */
  private findNearbyPlayers(npc: NPC, radius: number): PlayerConnection[] {
    const nearby: PlayerConnection[] = [];

    for (const player of this.forestManager.activePlayers.values()) {
      const distance = this.getDistance2D(npc.position, player.position);
      if (distance <= radius) {
        nearby.push(player);
      }
    }

    return nearby;
  }

  /**
   * Find nearby NPCs within radius
   */
  private findNearbyNPCs(npc: NPC, radius: number): NPC[] {
    const nearby: NPC[] = [];

    for (const otherNPC of this.npcs.values()) {
      if (otherNPC.id === npc.id) continue; // Skip self

      const distance = this.getDistance2D(npc.position, otherNPC.position);
      if (distance <= radius) {
        nearby.push(otherNPC);
      }
    }

    return nearby;
  }

  /**
   * Find nearby walnuts within radius (only unfound walnuts)
   * MVP 8: NPCs respect immunity when THEY are the immune entity
   */
  private findNearbyWalnuts(npc: NPC, radius: number): Walnut[] {
    const nearby: Walnut[] = [];
    const now = Date.now();

    for (const walnut of this.forestManager.mapState) {
      if (walnut.found) continue; // Skip already found walnuts

      // MVP 8: Check if THIS NPC is immune to this specific walnut (was hit by it)
      if (walnut.immunePlayerId === npc.id && walnut.immuneUntil) {
        if (now < walnut.immuneUntil) {
          continue; // This NPC is still immune to this walnut
        }
      }

      const distance = this.getDistance2D(npc.position, walnut.location);
      if (distance <= radius) {
        nearby.push(walnut);
      }
    }

    return nearby;
  }

  /**
   * Update NPC behavior based on perception and current state
   */
  private updateBehavior(
    npc: NPC,
    nearbyPlayers: PlayerConnection[],
    nearbyNPCs: NPC[],
    nearbyWalnuts: Walnut[],
    delta: number
  ): void {
    // Check if it's time to change behavior
    const shouldChangeBehavior = npc.behaviorTimer >= npc.behaviorDuration;

    if (shouldChangeBehavior) {
      const newBehavior = this.selectNewBehavior(npc, nearbyPlayers, nearbyNPCs, nearbyWalnuts);

      // MVP 7.1: Removed behavior logging to reduce DO CPU usage
      if (newBehavior !== npc.currentBehavior) {
        npc.currentBehavior = newBehavior;
        npc.behaviorTimer = 0;
        npc.behaviorDuration = this.getRandomBehaviorDuration(newBehavior);

        // Clear target when changing behavior (MVP 8 FIX: also clear target start time)
        npc.targetPosition = undefined;
        npc.targetEntityId = undefined;
        npc.targetStartTime = undefined;
      }
    }

    // Execute current behavior
    switch (npc.currentBehavior) {
      case NPCBehavior.IDLE:
        this.executeBehaviorIdle(npc);
        break;
      case NPCBehavior.WANDER:
        this.executeBehaviorWander(npc);
        break;
      case NPCBehavior.APPROACH:
        this.executeBehaviorApproach(npc, nearbyPlayers, nearbyNPCs);
        break;
      case NPCBehavior.GATHER:
        this.executeBehaviorGather(npc, nearbyWalnuts);
        break;
      case NPCBehavior.THROW:
        this.executeBehaviorThrow(npc, nearbyPlayers, nearbyNPCs);
        break;
    }
  }

  /**
   * Select new behavior based on weighted random + current state
   * MVP 8: Increased NPC aggression/throwing frequency
   */
  private selectNewBehavior(
    npc: NPC,
    nearbyPlayers: PlayerConnection[],
    nearbyNPCs: NPC[],
    nearbyWalnuts: Walnut[]
  ): NPCBehavior {
    const now = Date.now();
    const TARGET_TIMEOUT = 8000; // 8 seconds max targeting same entity

    // MVP 8 FIX: Time-based escape - give up on target after timeout
    if (npc.targetEntityId && npc.targetStartTime) {
      const targetDuration = now - npc.targetStartTime;
      if (targetDuration > TARGET_TIMEOUT) {
        console.log(`⏱️ NPC ${npc.id} giving up on target ${npc.targetEntityId} after ${(targetDuration / 1000).toFixed(1)}s`);
        npc.targetEntityId = undefined;
        npc.targetStartTime = undefined;
        return NPCBehavior.WANDER; // Break free and wander
      }
    }

    // MVP 8 FIX: Check if too close to current target - back off to prevent harassment loops
    if (npc.targetEntityId) {
      const target = this.forestManager.activePlayers.get(npc.targetEntityId) ||
                     this.npcs.get(npc.targetEntityId);
      if (target) {
        const distanceToTarget = this.getDistance2D(npc.position, target.position);
        // If within 3 units of target, switch to WANDER to create separation
        if (distanceToTarget < 3) {
          npc.targetEntityId = undefined;
          npc.targetStartTime = undefined;
          return NPCBehavior.WANDER;
        }
      }
    }

    // MVP 8: PRIORITY - Approach players if has walnuts (reduced aggression)
    // Players are high-value targets for combat
    const nearbyEntities = [...nearbyPlayers, ...nearbyNPCs];
    if (nearbyPlayers.length > 0 && npc.walnutInventory > 0 && npc.aggressionLevel > 0.3) {
      // MVP 8 FIX: Reduced from 2.0 to 1.2 (less aggressive, more natural)
      if (Math.random() < Math.min(0.7, npc.aggressionLevel * 1.2)) {
        return NPCBehavior.APPROACH;
      }
    }

    // MVP 8 FIX: Gather walnuts if inventory is low (very high priority for combat)
    if (npc.walnutInventory < 4 && nearbyWalnuts.length > 0) {
      if (Math.random() < 0.7) { // Increased from 50% to 70% (NPCs need ammo!)
        return NPCBehavior.GATHER;
      }
    }

    // Default behavior distribution (MVP 8: Very active NPCs with minimal idle time)
    const rand = Math.random();

    if (rand < 0.25) {
      return NPCBehavior.IDLE; // MVP 8: Reduced from 40% to 25% idle
    } else if (rand < 0.60) {
      return NPCBehavior.WANDER; // MVP 8: Increased from 35% to 35% wander
    } else {
      // 40% split between gather/approach (increased from 25%)
      if (nearbyWalnuts.length > 0 && npc.walnutInventory < 4) {
        return NPCBehavior.GATHER;
      } else if (nearbyEntities.length > 0 && npc.walnutInventory > 0) {
        return NPCBehavior.APPROACH;
      } else {
        return NPCBehavior.WANDER; // More wandering when no targets
      }
    }
  }

  /**
   * Get random behavior duration (increased idle time for more natural NPCs)
   */
  private getRandomBehaviorDuration(behavior: NPCBehavior): number {
    switch (behavior) {
      case NPCBehavior.IDLE:
        return 5 + Math.random() * 10; // 5-15 seconds - NPCs rest longer
      case NPCBehavior.WANDER:
        return 4 + Math.random() * 6; // 4-10 seconds - longer walks
      case NPCBehavior.APPROACH:
        return 2 + Math.random() * 3; // 2-5 seconds
      case NPCBehavior.GATHER:
        return 5 + Math.random() * 5; // 5-10 seconds
      case NPCBehavior.THROW:
        return 1.5; // Throw animation duration
      default:
        return 5;
    }
  }

  /**
   * Execute IDLE behavior
   */
  private executeBehaviorIdle(npc: NPC): void {
    npc.velocity = { x: 0, z: 0 };
    npc.animation = 'idle';
  }

  /**
   * Execute WANDER behavior
   */
  private executeBehaviorWander(npc: NPC): void {
    // Set random target position if we don't have one
    if (!npc.targetPosition) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 10 + Math.random() * 20; // 10-30 units away

      npc.targetPosition = {
        x: npc.position.x + Math.cos(angle) * distance,
        y: npc.position.y,
        z: npc.position.z + Math.sin(angle) * distance
      };

      // Clamp to world bounds
      npc.targetPosition = this.clampToWorldBounds(npc.targetPosition);
    }

    // Move toward target
    this.moveTowardTarget(npc, npc.targetPosition);
    npc.animation = 'walk';

    // Clear target if reached
    const distanceToTarget = this.getDistance2D(npc.position, npc.targetPosition);
    if (distanceToTarget < 2) {
      npc.targetPosition = undefined;
      npc.currentBehavior = NPCBehavior.IDLE;
      npc.behaviorTimer = 0;
    }
  }

  /**
   * Execute APPROACH behavior
   */
  private executeBehaviorApproach(npc: NPC, nearbyPlayers: PlayerConnection[], nearbyNPCs: NPC[]): void {
    const allEntities = [...nearbyPlayers, ...nearbyNPCs];

    if (allEntities.length === 0) {
      // No entities nearby, switch to wander
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Find closest entity
    let closestEntity: any = null;
    let closestDistance = Infinity;

    for (const entity of allEntities) {
      const distance = this.getDistance2D(npc.position, entity.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    }

    if (!closestEntity) {
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // MVP 8 FIX: Track target entity and start time (for timeout escape mechanism)
    const newTargetId = 'squirrelId' in closestEntity ? closestEntity.squirrelId : closestEntity.id;
    if (npc.targetEntityId !== newTargetId) {
      // Target changed - reset timer
      npc.targetEntityId = newTargetId;
      npc.targetStartTime = Date.now();
    } else if (!npc.targetStartTime) {
      // Same target but no start time set - initialize it
      npc.targetStartTime = Date.now();
    }

    // Check if in throw range
    if (closestDistance >= this.THROW_MIN_RANGE && closestDistance <= this.THROW_MAX_RANGE) {
      // Check throw cooldown and inventory
      const timeSinceLastThrow = Date.now() - npc.lastThrowTime;
      if (npc.walnutInventory > 0 && timeSinceLastThrow >= this.THROW_COOLDOWN) {
        npc.currentBehavior = NPCBehavior.THROW;
        npc.behaviorTimer = 0;
        return;
      }
    }

    // Move toward entity
    this.moveTowardTarget(npc, closestEntity.position);
    npc.animation = 'walk';
  }

  /**
   * Execute GATHER behavior
   */
  private executeBehaviorGather(npc: NPC, nearbyWalnuts: Walnut[]): void {
    if (nearbyWalnuts.length === 0 || npc.walnutInventory >= this.MAX_INVENTORY) {
      // No walnuts or inventory full
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Find closest walnut
    let closestWalnut: Walnut | null = null;
    let closestDistance = Infinity;

    for (const walnut of nearbyWalnuts) {
      const distance = this.getDistance2D(npc.position, walnut.location);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestWalnut = walnut;
      }
    }

    if (!closestWalnut) {
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Check if close enough to collect
    if (closestDistance < 2) {
      // Collect walnut
      this.collectWalnut(npc, closestWalnut);
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Move toward walnut
    this.moveTowardTarget(npc, closestWalnut.location);
    npc.animation = 'walk';
  }

  /**
   * Execute THROW behavior
   */
  private executeBehaviorThrow(npc: NPC, nearbyPlayers: PlayerConnection[], nearbyNPCs: NPC[]): void {
    if (npc.walnutInventory === 0) {
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Find target entity
    const allEntities = [...nearbyPlayers, ...nearbyNPCs];
    let targetEntity: any = null;

    for (const entity of allEntities) {
      const entityId = 'squirrelId' in entity ? entity.squirrelId : entity.id;
      if (entityId === npc.targetEntityId) {
        targetEntity = entity;
        break;
      }
    }

    if (!targetEntity) {
      npc.currentBehavior = NPCBehavior.IDLE;
      return;
    }

    // Execute throw
    this.throwWalnutAtTarget(npc, targetEntity);

    // Return to idle after throw
    npc.currentBehavior = NPCBehavior.IDLE;
    npc.behaviorTimer = 0;
    npc.targetEntityId = undefined;
  }

  /**
   * Move NPC toward target position
   */
  private moveTowardTarget(npc: NPC, target: Vector3): void {
    const dx = target.x - npc.position.x;
    const dz = target.z - npc.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > 0.1) {
      // Normalize direction
      const dirX = dx / distance;
      const dirZ = dz / distance;

      // Set velocity
      npc.velocity = { x: dirX * this.NPC_SPEED, z: dirZ * this.NPC_SPEED };

      // Update rotation to face movement direction
      npc.rotationY = Math.atan2(dirX, dirZ);
    } else {
      npc.velocity = { x: 0, z: 0 };
    }
  }

  /**
   * Update NPC movement based on velocity
   */
  private updateMovement(npc: NPC, delta: number): void {
    // Apply velocity to position
    npc.position.x += npc.velocity.x * delta;
    npc.position.z += npc.velocity.z * delta;

    // Clamp to world bounds
    npc.position = this.clampToWorldBounds(npc.position);

    // Set Y position (ground level for now, terrain matching in future)
    npc.position.y = 2;
  }

  /**
   * Collect walnut (add to inventory, mark as found)
   */
  private collectWalnut(npc: NPC, walnut: Walnut): void {
    if (npc.walnutInventory >= this.MAX_INVENTORY) {
      return;
    }

    // Add to inventory
    npc.walnutInventory++;

    // Mark walnut as found in mapState
    const walnutIndex = this.forestManager.mapState.findIndex((w: Walnut) => w.id === walnut.id);
    if (walnutIndex !== -1) {
      this.forestManager.mapState[walnutIndex].found = true;

      // Persist to storage
      this.forestManager.storage.put('mapState', this.forestManager.mapState);

      // Broadcast walnut found
      // MVP 7.1: Removed logging to reduce DO CPU usage
      this.forestManager.broadcastToAll({
        type: 'walnut_found',
        walnutId: walnut.id,
        finderId: npc.id,
        finderName: npc.username,
        points: walnut.origin === 'game' ? 5 : 1,
        isNPC: true
      });
    }
  }

  /**
   * Throw walnut at target entity
   * MVP 8: Added aim prediction to lead moving targets for better accuracy
   */
  private throwWalnutAtTarget(npc: NPC, target: any): void {
    if (npc.walnutInventory === 0) {
      return;
    }

    // Decrement inventory
    npc.walnutInventory--;
    npc.lastThrowTime = Date.now();

    // MVP 8: Predict target position based on velocity
    // Projectile flight time is 0.5s (from ProjectileManager.ts line 39)
    const FLIGHT_TIME = 0.5;

    // Get target velocity (players have velocity property, NPCs use npc.velocity)
    let targetVelocity = { x: 0, z: 0 };
    if ('velocity' in target && target.velocity) {
      targetVelocity = target.velocity;
    }

    // Predict where target will be after flight time
    const predictedPosition = {
      x: target.position.x + targetVelocity.x * FLIGHT_TIME,
      y: target.position.y,
      z: target.position.z + targetVelocity.z * FLIGHT_TIME
    };

    // Broadcast throw message with predicted position
    // MVP 7.1: Removed logging to reduce DO CPU usage
    this.forestManager.broadcastToAll({
      type: 'npc_throw',
      npcId: npc.id,
      npcName: npc.username,
      fromPosition: { ...npc.position },
      toPosition: predictedPosition, // MVP 8: Use predicted position instead of current
      targetId: 'squirrelId' in target ? target.squirrelId : target.id,
      timestamp: Date.now()
    });
  }

  /**
   * Clamp position to world bounds
   */
  private clampToWorldBounds(position: Vector3): Vector3 {
    const WORLD_HALF = 100; // 200x200 world
    return {
      x: Math.max(-WORLD_HALF, Math.min(WORLD_HALF, position.x)),
      y: position.y,
      z: Math.max(-WORLD_HALF, Math.min(WORLD_HALF, position.z))
    };
  }

  /**
   * Calculate 2D distance between two positions
   */
  private getDistance2D(a: Vector3, b: Vector3): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Broadcast NPC spawn to all players
   */
  private broadcastNPCSpawn(npc: NPC): void {
    this.forestManager.broadcastToAll({
      type: 'npc_spawned',
      npc: {
        id: npc.id,
        characterId: npc.characterId,
        username: npc.username,
        position: npc.position,
        rotationY: npc.rotationY,
        animation: npc.animation
      }
    });
  }

  /**
   * Broadcast NPC update to all players
   */
  private broadcastNPCUpdate(npc: NPC): void {
    this.forestManager.broadcastToAll({
      type: 'npc_update',
      npcId: npc.id,
      position: npc.position,
      rotationY: npc.rotationY,
      velocity: npc.velocity,
      animation: npc.animation,
      behavior: npc.currentBehavior
    });
  }

  /**
   * Broadcast NPC despawn to all players
   */
  private broadcastNPCDespawn(npcId: string): void {
    this.forestManager.broadcastToAll({
      type: 'npc_despawned',
      npcId
    });
  }

  /**
   * Get all active NPCs (for debugging/admin)
   */
  getNPCs(): NPC[] {
    return Array.from(this.npcs.values());
  }

  /**
   * Get NPC count
   */
  getNPCCount(): number {
    return this.npcs.size;
  }
}
