import { NPC, NPCBehavior, WorldState } from '../types/NPCTypes';
import { Vector3 } from '../core/types';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

/**
 * NPC AI Controller
 * Manages behavior selection and execution for individual NPCs
 */
export class NPCAIController {
  private npc: NPC;
  private behaviors: NPCBehavior[];
  private currentBehavior: NPCBehavior | null = null;
  private behaviorTimer: number = 0;
  private lastBehaviorChange: number = 0;
  private behaviorHistory: string[] = [];
  private performanceMetrics = {
    behaviorTransitions: 0,
    averageBehaviorDuration: 0,
    totalBehaviorsExecuted: 0
  };

  constructor(
    npc: NPC,
    characterType: string,
    private eventBus: EventBus,
    private worldState: WorldState
  ) {
    this.npc = npc;
    this.behaviors = this.createBehaviors(characterType);
    this.lastBehaviorChange = Date.now();
    
    Logger.debug(LogCategory.CORE, `[NPCAIController] Created for NPC ${npc.id} (${characterType})`);
  }

  /**
   * Update NPC AI
   */
  update(deltaTime: number): void {
    // Update behavior timer
    this.behaviorTimer += deltaTime;

    // Check if current behavior should end
    if (this.currentBehavior && this.behaviorTimer >= this.currentBehavior.duration) {
      this.endCurrentBehavior();
    }

    // Select new behavior if needed
    if (!this.currentBehavior) {
      const newBehavior = this.selectBehavior();
      if (newBehavior) {
        this.transitionToBehavior(newBehavior);
      }
    }

    // Execute current behavior
    if (this.currentBehavior) {
      this.executeBehavior(this.currentBehavior, deltaTime);
    }

    // Update NPC state
    this.updateNPCState(deltaTime);
  }

  /**
   * Create behaviors based on character type
   */
  private createBehaviors(characterType: string): NPCBehavior[] {
    const behaviors: NPCBehavior[] = [];

    // Add character-specific behaviors
    switch (characterType) {
      case 'colobus':
        behaviors.push(
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createSocializeBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createCuriousBehavior()
        );
        break;
      case 'gecko':
        behaviors.push(
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createSocializeBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createTerritorialBehavior()
        );
        break;
      case 'herring':
        behaviors.push(
          this.createSwimBehavior(),
          this.createForageBehavior(),
          this.createSchoolBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior()
        );
        break;
      case 'inkfish':
        behaviors.push(
          this.createSwimBehavior(),
          this.createHuntBehavior(),
          this.createForageBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createCuriousBehavior()
        );
        break;
      case 'muskrat':
        behaviors.push(
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createSocializeBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createTerritorialBehavior()
        );
        break;
      case 'pudu':
        behaviors.push(
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createSocializeBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createCuriousBehavior()
        );
        break;
      case 'sparrow':
        behaviors.push(
          this.createFlyBehavior(),
          this.createForageBehavior(),
          this.createSocializeBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createTerritorialBehavior()
        );
        break;
      case 'taipan':
        behaviors.push(
          this.createHuntBehavior(),
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createFleeBehavior(),
          this.createIdleBehavior(),
          this.createTerritorialBehavior()
        );
        break;
      default:
        // Default behaviors for unknown character types
        behaviors.push(
          this.createPatrolBehavior(),
          this.createForageBehavior(),
          this.createIdleBehavior(),
          this.createFleeBehavior()
        );
    }

    return behaviors;
  }

  /**
   * Select the most appropriate behavior based on conditions
   */
  private selectBehavior(): NPCBehavior | null {
    const availableBehaviors = this.behaviors.filter(behavior => 
      behavior.conditions(this.npc, this.worldState)
    );

    if (availableBehaviors.length === 0) {
      return null;
    }

    // Sort by priority (highest first)
    availableBehaviors.sort((a, b) => b.priority - a.priority);

    // Consider personality and mood for final selection
    const personality = this.npc.personality;
    const mood = this.npc.mood;

    // Adjust behavior selection based on personality
    for (const behavior of availableBehaviors) {
      switch (behavior.type) {
        case 'socialize':
          if (personality.sociability > 50) return behavior;
          break;
        case 'curious':
          if (personality.curiosity > 50) return behavior;
          break;
        case 'territorial':
          if (personality.territoriality > 50) return behavior;
          break;
        case 'flee':
          if (personality.fearfulness > 50 || mood < -30) return behavior;
          break;
        case 'hunt':
          if (personality.aggression > 50) return behavior;
          break;
        default:
          return behavior;
      }
    }

    return availableBehaviors[0];
  }

  /**
   * Execute the current behavior
   */
  private executeBehavior(behavior: NPCBehavior, deltaTime: number): void {
    try {
      behavior.execute(this.npc, deltaTime);
    } catch (error) {
      Logger.error(LogCategory.CORE, `[NPCAIController] Error executing behavior ${behavior.type}:`, error);
      // Fall back to idle behavior
      this.transitionToBehavior(this.createIdleBehavior());
    }
  }

  /**
   * Transition to a new behavior
   */
  private transitionToBehavior(behavior: NPCBehavior): void {
    // End current behavior
    if (this.currentBehavior?.onEnd) {
      this.currentBehavior.onEnd(this.npc);
    }

    // Start new behavior
    this.currentBehavior = behavior;
    this.behaviorTimer = 0;
    this.lastBehaviorChange = Date.now();
    this.behaviorHistory.push(behavior.type);

    if (behavior.onStart) {
      behavior.onStart(this.npc);
    }

    this.performanceMetrics.behaviorTransitions++;
    
    Logger.debug(LogCategory.CORE, `[NPCAIController] NPC ${this.npc.id} transitioned to ${behavior.type}`);
    
    // Emit behavior change event
    this.eventBus.emit('npc.behavior_changed', {
      npcId: this.npc.id,
      behaviorType: behavior.type,
      timestamp: Date.now()
    });
  }

  /**
   * End the current behavior
   */
  private endCurrentBehavior(): void {
    if (this.currentBehavior?.onEnd) {
      this.currentBehavior.onEnd(this.npc);
    }
    
    this.currentBehavior = null;
    this.behaviorTimer = 0;
  }

  /**
   * Update NPC state based on behavior and environment
   */
  private updateNPCState(deltaTime: number): void {
    // Update energy (decreases over time)
    this.npc.energy = Math.max(0, this.npc.energy - deltaTime * 0.1);

    // Update mood based on experiences
    if (this.npc.memory.positiveExperiences > this.npc.memory.negativeExperiences) {
      this.npc.mood = Math.min(100, this.npc.mood + deltaTime * 0.5);
    } else {
      this.npc.mood = Math.max(-100, this.npc.mood - deltaTime * 0.3);
    }

    // Update last update time
    this.npc.lastUpdate = Date.now();
  }

  /**
   * Get current behavior
   */
  getCurrentBehavior(): NPCBehavior | null {
    return this.currentBehavior;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      currentBehavior: this.currentBehavior?.type || 'none',
      behaviorTimer: this.behaviorTimer,
      lastBehaviorChange: this.lastBehaviorChange,
      behaviorHistory: this.behaviorHistory.slice(-10) // Last 10 behaviors
    };
  }

  // Behavior Creation Methods

  private createPatrolBehavior(): NPCBehavior {
    return {
      type: 'patrol',
      priority: 30,
      duration: 10 + Math.random() * 20, // 10-30 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Simple patrol: move to random position
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 2) {
          npc.targetPosition = this.getRandomPosition(npc.position, 20);
        }
        this.moveTowardsTarget(npc, deltaTime);
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getRandomPosition(npc.position, 20);
      }
    };
  }

  private createForageBehavior(): NPCBehavior {
    return {
      type: 'forage',
      priority: 40,
      duration: 15 + Math.random() * 25, // 15-40 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Simulate foraging: slow movement, occasional stops
        if (Math.random() < 0.1) { // 10% chance to stop
          return;
        }
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 1) {
          npc.targetPosition = this.getRandomPosition(npc.position, 10);
        }
        this.moveTowardsTarget(npc, deltaTime * 0.5); // Slower movement
        npc.energy = Math.min(100, npc.energy + deltaTime * 0.2); // Regain energy
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getRandomPosition(npc.position, 10);
      }
    };
  }

  private createSocializeBehavior(): NPCBehavior {
    return {
      type: 'socialize',
      priority: 50,
      duration: 8 + Math.random() * 12, // 8-20 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        const nearbyNPCs = this.findNearbyNPCs(npc, 15);
        if (nearbyNPCs.length > 0) {
          const targetNPC = nearbyNPCs[0];
          npc.targetPosition = targetNPC.position;
          this.moveTowardsTarget(npc, deltaTime * 0.3); // Very slow movement
          
          // Increase mood when socializing
          npc.mood = Math.min(100, npc.mood + deltaTime * 0.5);
        }
      }
    };
  }

  private createFleeBehavior(): NPCBehavior {
    return {
      type: 'flee',
      priority: 90, // Very high priority
      duration: 5 + Math.random() * 10, // 5-15 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return false; // Only when danger detected
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Move away from danger
        const dangerDirection = this.getDangerDirection(npc);
        if (dangerDirection) {
          const fleePosition = npc.position.add(dangerDirection.multiply(30));
          npc.targetPosition = fleePosition;
          this.moveTowardsTarget(npc, deltaTime * 2); // Fast movement
        }
      },
      onStart: (npc: NPC) => {
        const dangerDirection = this.getDangerDirection(npc);
        if (dangerDirection) {
          const fleePosition = npc.position.add(dangerDirection.multiply(30));
          npc.targetPosition = fleePosition;
        }
      }
    };
  }

  private createIdleBehavior(): NPCBehavior {
    return {
      type: 'idle',
      priority: 10, // Low priority
      duration: 5 + Math.random() * 15, // 5-20 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available as fallback
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Do nothing, just rest
        npc.energy = Math.min(100, npc.energy + deltaTime * 0.1);
      }
    };
  }

  private createCuriousBehavior(): NPCBehavior {
    return {
      type: 'curious',
      priority: 35,
      duration: 12 + Math.random() * 18, // 12-30 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Explore interesting areas
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 2) {
          npc.targetPosition = this.getRandomPosition(npc.position, 25);
        }
        this.moveTowardsTarget(npc, deltaTime * 0.7);
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getRandomPosition(npc.position, 25);
      }
    };
  }

  private createTerritorialBehavior(): NPCBehavior {
    return {
      type: 'territorial',
      priority: 60,
      duration: 10 + Math.random() * 15, // 10-25 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Patrol territory boundaries
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 3) {
          npc.targetPosition = this.getTerritoryBoundaryPosition(npc);
        }
        this.moveTowardsTarget(npc, deltaTime);
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getTerritoryBoundaryPosition(npc);
      }
    };
  }

  private createHuntBehavior(): NPCBehavior {
    return {
      type: 'hunt',
      priority: 70,
      duration: 20 + Math.random() * 30, // 20-50 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Hunt for prey (simplified)
        const prey = this.findNearbyPrey(npc, 25);
        if (prey) {
          npc.targetPosition = prey.position;
          this.moveTowardsTarget(npc, deltaTime * 1.5); // Fast movement
        } else {
          // Search for prey
          if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 2) {
            npc.targetPosition = this.getRandomPosition(npc.position, 30);
          }
          this.moveTowardsTarget(npc, deltaTime);
        }
      },
      onStart: (npc: NPC) => {
        const prey = this.findNearbyPrey(npc, 25);
        if (prey) {
          npc.targetPosition = prey.position;
        } else {
          npc.targetPosition = this.getRandomPosition(npc.position, 30);
        }
      }
    };
  }

  private createSwimBehavior(): NPCBehavior {
    return {
      type: 'patrol', // Use patrol type for swimming
      priority: 35,
      duration: 15 + Math.random() * 25, // 15-40 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Swim in water areas
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 3) {
          npc.targetPosition = this.getWaterPosition(npc.position, 20);
        }
        this.moveTowardsTarget(npc, deltaTime * 0.8);
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getWaterPosition(npc.position, 20);
      }
    };
  }

  private createFlyBehavior(): NPCBehavior {
    return {
      type: 'patrol', // Use patrol type for flying
      priority: 35,
      duration: 20 + Math.random() * 30, // 20-50 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // Fly in air
        if (!npc.targetPosition || this.getDistance(npc.position, npc.targetPosition) < 5) {
          npc.targetPosition = this.getAirPosition(npc.position, 30);
        }
        this.moveTowardsTarget(npc, deltaTime * 1.2);
        npc.energy = Math.max(0, npc.energy - deltaTime * 0.3); // Flying uses energy
      },
      onStart: (npc: NPC) => {
        npc.targetPosition = this.getAirPosition(npc.position, 30);
      }
    };
  }

  private createSchoolBehavior(): NPCBehavior {
    return {
      type: 'socialize', // Use socialize type for schooling
      priority: 45,
      duration: 25 + Math.random() * 35, // 25-60 seconds
      conditions: (_npc: NPC, _world: WorldState) => {
        return true; // Always available
      },
      execute: (npc: NPC, deltaTime: number) => {
        // School with other fish
        const nearbyNPCs = this.findNearbyNPCs(npc, 20);
        if (nearbyNPCs.length > 0) {
          const centerPosition = this.getAveragePosition(nearbyNPCs);
          npc.targetPosition = centerPosition;
          this.moveTowardsTarget(npc, deltaTime * 0.6);
        }
      }
    };
  }

  // Helper Methods

  private getDistance(pos1: Vector3, pos2: Vector3): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2) + 
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  private getRandomPosition(center: Vector3, radius: number): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return new Vector3(
      center.x + Math.cos(angle) * distance,
      center.y,
      center.z + Math.sin(angle) * distance
    );
  }

  private moveTowardsTarget(npc: NPC, deltaTime: number): void {
    if (!npc.targetPosition) return;

    // Calculate direction vector
    const dx = npc.targetPosition.x - npc.position.x;
    const dz = npc.targetPosition.z - npc.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < 0.1) return; // Already at target
    
    // Normalize direction
    const normalizedDx = dx / distance;
    const normalizedDz = dz / distance;
    
    const speed = npc.config.behaviors.movementSpeed;
    const movement = new Vector3(
      normalizedDx * speed * deltaTime,
      0,
      normalizedDz * speed * deltaTime
    );
    
    npc.position = npc.position.add(movement);
    npc.velocity = movement;
    
    // Update rotation to face movement direction
    npc.rotation = new Vector3(0, Math.atan2(normalizedDx, normalizedDz), 0);
  }

  private findNearbyNPCs(npc: NPC, radius: number): NPC[] {
    return Array.from(this.worldState.npcs.values()).filter(otherNPC => 
      otherNPC.id !== npc.id && this.getDistance(npc.position, otherNPC.position) < radius
    );
  }

  private findNearbyPrey(npc: NPC, radius: number): NPC | null {
    // Simplified: find any NPC that's not the same type
    const nearbyNPCs = this.findNearbyNPCs(npc, radius);
    const prey = nearbyNPCs.find(otherNPC => otherNPC.characterType !== npc.characterType);
    return prey || null;
  }

  private getDangerDirection(npc: NPC): Vector3 | null {
    // Simplified: move away from center (0,0,0)
    const center = new Vector3(0, 0, 0);
    const dx = npc.position.x - center.x;
    const dz = npc.position.z - center.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    if (distance < 0.1) return null;
    
    return new Vector3(dx / distance, 0, dz / distance);
  }

  private getTerritoryBoundaryPosition(npc: NPC): Vector3 {
    // Simplified: patrol around a territory center
    const territoryCenter = new Vector3(
      Math.floor(npc.position.x / 50) * 50 + 25,
      0,
      Math.floor(npc.position.z / 50) * 50 + 25
    );
    return this.getRandomPosition(territoryCenter, 20);
  }

  private getWaterPosition(center: Vector3, radius: number): Vector3 {
    // Simplified: assume water is at lower elevations
    const pos = this.getRandomPosition(center, radius);
    return new Vector3(pos.x, Math.max(0, pos.y - 2), pos.z);
  }

  private getAirPosition(center: Vector3, radius: number): Vector3 {
    // Simplified: assume air is at higher elevations
    const pos = this.getRandomPosition(center, radius);
    return new Vector3(pos.x, Math.max(5, pos.y + 3), pos.z);
  }

  private getAveragePosition(npcs: NPC[]): Vector3 {
    if (npcs.length === 0) return new Vector3(0, 0, 0);
    
    const sum = npcs.reduce((acc, npc) => acc.add(npc.position), new Vector3(0, 0, 0));
    return new Vector3(
      sum.x / npcs.length,
      sum.y / npcs.length,
      sum.z / npcs.length
    );
  }
} 