import { System, Entity, PositionComponent, RotationComponent, RenderComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import { Vector3, EntityId, Rotation } from '../core/types';
import { 
  NPC, 
  WorldState, 
  NPCPersonality, 
  NPCMemory, 
  NPCSpawnPoint, 
  NPCSocialInteraction,
  NPCBehaviorMetrics,
  NPCSystemConfig,
  PlayerState
} from '../types/NPCTypes';
import { CHARACTER_CONFIGS_BY_ID } from '../config/characters';
import { NPCAIController } from '../controllers/NPCAIController';
import { NPCPathfinder } from '../services/NPCPathfinder';
import { ITerrainService } from '../services/TerrainService';

/**
 * NPC Component
 * ECS component to track NPC entities
 */
export interface NPCComponent {
  type: 'npc';
  npc: NPC;
  aiController: NPCAIController;
  lastPathfindingUpdate: number;
  lastBehaviorUpdate: number;
  isVisible: boolean;
  performanceLevel: 'high' | 'medium' | 'low';
}

/**
 * NPC System
 * Manages all NPCs in the game world
 */
export class NPCSystem extends System {
  private npcs = new Map<string, NPC>();
  private aiControllers = new Map<string, NPCAIController>();
  private spawnPoints: NPCSpawnPoint[] = [];
  private socialInteractions: NPCSocialInteraction[] = []; // Used for tracking social interactions - will be used in future
  private worldState: WorldState;
  private pathfinder: NPCPathfinder;
  private terrainService: ITerrainService;
  
  // Configuration
  private config: NPCSystemConfig = {
    maxNPCs: 20,
    spawnRate: 2, // NPCs per minute
    behaviorUpdateRate: 10, // Hz
    pathfindingUpdateRate: 5, // Hz
    socialInteractionRange: 15,
    playerDetectionRange: 25,
    performanceMode: 'high',
    enableSocialInteractions: true,
    enablePathfinding: true,
    enableCharacterSpecificBehaviors: true
  };

  // Performance tracking
  private metrics: NPCBehaviorMetrics = {
    totalNPCs: 0,
    activeBehaviors: new Map(),
    averageBehaviorDuration: 0,
    behaviorTransitions: 0,
    pathfindingRequests: 0,
    socialInteractions: 0,
    performanceImpact: 0
  };

  // Timing
  private lastBehaviorUpdate = 0;
  private lastPathfindingUpdate = 0;
  private lastMetricsUpdate = 0;

  constructor(
    eventBus: EventBus,
    terrainService: ITerrainService,
    config?: Partial<NPCSystemConfig>
  ) {
    super(eventBus, ['npc'], 'NPCSystem');
    
    this.terrainService = terrainService;
    this.pathfinder = new NPCPathfinder(terrainService);
    this.worldState = this.createWorldState();
    
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.initializeSpawnPoints();
    this.setupEventListeners();
    
    Logger.info(LogCategory.CORE, `[NPCSystem] Initialized with max ${this.config.maxNPCs} NPCs`);
  }

  /**
   * Update system (called by ECS)
   */
  update(deltaTime: number): void {
    const currentTime = Date.now();

    // Update world state
    this.updateWorldState();

    // Update NPC behaviors
    if (currentTime - this.lastBehaviorUpdate > 1000 / this.config.behaviorUpdateRate) {
      this.updateNPCBehaviors(deltaTime);
      this.lastBehaviorUpdate = currentTime;
    }

    // Update pathfinding
    if (currentTime - this.lastPathfindingUpdate > 1000 / this.config.pathfindingUpdateRate) {
      this.updateNPCPathfinding(deltaTime);
      this.lastPathfindingUpdate = currentTime;
    }

    // Handle social interactions
    if (this.config.enableSocialInteractions) {
      this.handleNPCSocialInteractions();
      // Track social interactions for metrics
      this.metrics.socialInteractions = this.socialInteractions.length;
    }

    // Spawn new NPCs
    this.handleNPCSpawning(currentTime);

    // Update metrics
    if (currentTime - this.lastMetricsUpdate > 5000) { // Every 5 seconds
      this.updateMetrics();
      this.lastMetricsUpdate = currentTime;
    }

    // Update ECS entities
    this.updateECSEntities();
  }

  /**
   * Spawn a new NPC
   */
  spawnNPC(characterType: string, position: Vector3): NPC | null {
    if (this.npcs.size >= this.config.maxNPCs) {
      Logger.warn(LogCategory.CORE, `[NPCSystem] Max NPCs reached (${this.config.maxNPCs})`);
      return null;
    }

    const characterConfig = CHARACTER_CONFIGS_BY_ID[characterType as keyof typeof CHARACTER_CONFIGS_BY_ID];
    if (!characterConfig) {
      Logger.error(LogCategory.CORE, `[NPCSystem] Unknown character type: ${characterType}`);
      return null;
    }

    if (!characterConfig.behaviors.isNPC) {
      Logger.warn(LogCategory.CORE, `[NPCSystem] Character type ${characterType} is not NPC-capable`);
      return null;
    }

    const npcId = `npc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create NPC personality
    const personality: NPCPersonality = {
      sociability: 30 + Math.random() * 40, // 30-70
      curiosity: 20 + Math.random() * 60, // 20-80
      aggression: 10 + Math.random() * 50, // 10-60
      fearfulness: 20 + Math.random() * 40, // 20-60
      territoriality: 10 + Math.random() * 60, // 10-70
      energyLevel: 40 + Math.random() * 40 // 40-80
    };

    // Create NPC memory
    const memory: NPCMemory = {
      knownPlayers: new Map(),
      knownNPCs: new Map(),
      favoriteLocations: [],
      dangerousAreas: [],
      lastSeenPlayers: new Map(),
      lastSeenNPCs: new Map(),
      positiveExperiences: 0,
      negativeExperiences: 0
    };

    // Create NPC
    const npc: NPC = {
      id: npcId,
      characterType,
      config: characterConfig,
      position,
      rotation: new Vector3(0, Math.random() * Math.PI * 2, 0),
      velocity: new Vector3(0, 0, 0),
      health: 100,
      energy: 80 + Math.random() * 20, // 80-100
      mood: -20 + Math.random() * 40, // -20 to 20
      lastBehaviorChange: Date.now(),
      currentBehavior: null,
      behaviorTimer: 0,
      targetPosition: null,
      path: [],
      socialGroup: null,
      personality,
      memory,
      isVisible: true,
      lastUpdate: Date.now()
    };

    // Create AI controller
    const aiController = new NPCAIController(npc, characterType, this.eventBus, this.worldState);
    
    // Store NPC and controller
    this.npcs.set(npcId, npc);
    this.aiControllers.set(npcId, aiController);
    
    // Update world state
    this.worldState.npcs.set(npcId, npc);
    
    // Create ECS entity
    this.createNPCEntity(npc, aiController);
    
    Logger.info(LogCategory.CORE, `[NPCSystem] Spawned NPC ${npcId} (${characterType}) at ${position}`);
    
    // Emit spawn event
    this.eventBus.emit('npc.spawned', {
      npcId,
      characterType,
      position,
      timestamp: Date.now()
    });

    return npc;
  }

  /**
   * Despawn an NPC
   */
  despawnNPC(npcId: string): void {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      Logger.warn(LogCategory.CORE, `[NPCSystem] NPC ${npcId} not found for despawning`);
      return;
    }

    // Remove from collections
    this.npcs.delete(npcId);
    this.aiControllers.delete(npcId);
    this.worldState.npcs.delete(npcId);

    // Remove ECS entity
    const entity = this.getEntityWithNPC(npcId);
    if (entity) {
      this.removeEntity(entity.id);
    }

    Logger.info(LogCategory.CORE, `[NPCSystem] Despawned NPC ${npcId}`);
    
    // Emit despawn event
    this.eventBus.emit('npc.despawned', {
      npcId,
      timestamp: Date.now()
    });
  }

  /**
   * Get NPC by ID
   */
  getNPC(npcId: string): NPC | undefined {
    return this.npcs.get(npcId);
  }

  /**
   * Get all NPCs
   */
  getAllNPCs(): NPC[] {
    return Array.from(this.npcs.values());
  }

  /**
   * Get NPC count
   */
  getNPCCount(): number {
    return this.npcs.size;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): NPCBehaviorMetrics {
    return { ...this.metrics };
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig: Partial<NPCSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    Logger.info(LogCategory.CORE, `[NPCSystem] Configuration updated`);
  }

  // Private Methods

  private createWorldState(): WorldState {
    return {
      players: new Map(),
      npcs: new Map(),
      timeOfDay: 12, // Noon
      weather: 'clear',
      temperature: 20,
      visibility: 100,
      dangerLevel: 0
    };
  }

  private initializeSpawnPoints(): void {
    // Create spawn points around the world
    const spawnPoints: NPCSpawnPoint[] = [
      {
        position: new Vector3(-50, 0, -50),
        characterTypes: ['colobus', 'gecko', 'muskrat', 'pudu'],
        spawnRadius: 20,
        maxNPCs: 5,
        spawnRate: 0.5,
        lastSpawn: 0
      },
      {
        position: new Vector3(50, 0, -50),
        characterTypes: ['sparrow', 'gecko'],
        spawnRadius: 15,
        maxNPCs: 3,
        spawnRate: 0.3,
        lastSpawn: 0
      },
      {
        position: new Vector3(0, 0, 50),
        characterTypes: ['herring', 'inkfish'],
        spawnRadius: 25,
        maxNPCs: 4,
        spawnRate: 0.4,
        lastSpawn: 0
      },
      {
        position: new Vector3(-30, 0, 30),
        characterTypes: ['taipan', 'muskrat'],
        spawnRadius: 18,
        maxNPCs: 3,
        spawnRate: 0.2,
        lastSpawn: 0
      }
    ];

    this.spawnPoints = spawnPoints;
    Logger.info(LogCategory.CORE, `[NPCSystem] Initialized ${spawnPoints.length} spawn points`);
  }

  private setupEventListeners(): void {
    this.eventBus.subscribe('player.joined', this.handlePlayerJoined.bind(this));
    this.eventBus.subscribe('player.left', this.handlePlayerLeft.bind(this));
    this.eventBus.subscribe('player.moved', this.handlePlayerMoved.bind(this));
    this.eventBus.subscribe('terrain.changed', this.handleTerrainChanged.bind(this));
  }

  private updateWorldState(): void {
    // Update time of day (simplified)
    const now = new Date();
    this.worldState.timeOfDay = now.getHours() + now.getMinutes() / 60;
    
    // Update danger level based on nearby players
    this.worldState.dangerLevel = this.calculateDangerLevel();
    
    // Update weather (simplified - could be more complex)
    this.worldState.weather = this.worldState.timeOfDay > 6 && this.worldState.timeOfDay < 18 ? 'clear' : 'clear';
  }

  private updateNPCBehaviors(deltaTime: number): void {
    for (const [npcId, aiController] of this.aiControllers) {
      try {
        aiController.update(deltaTime);
        
        // Update NPC position based on AI controller
        const npc = this.npcs.get(npcId);
        if (npc) {
          // Update terrain height
          this.updateNPCTerrainHeight(npc);
          
          // Update ECS entity position
          this.updateNPCEntityPosition(npc);
        }
      } catch (error) {
        Logger.error(LogCategory.CORE, `[NPCSystem] Error updating NPC ${npcId}:`, error);
      }
    }
  }

  private updateNPCPathfinding(_deltaTime: number): void {
    if (!this.config.enablePathfinding) return;

    for (const npc of this.npcs.values()) {
      if (npc.targetPosition && npc.path.length === 0) {
        // Request new path
        this.pathfinder.findPath(npc.position, npc.targetPosition)
          .then(path => {
            npc.path = path;
            this.metrics.pathfindingRequests++;
          })
          .catch(error => {
            Logger.warn(LogCategory.CORE, `[NPCSystem] Pathfinding failed for NPC ${npc.id}:`, error);
          });
      }
    }
  }

  private handleNPCSocialInteractions(): void {
    const interactions: NPCSocialInteraction[] = [];

    for (const npc1 of this.npcs.values()) {
      for (const npc2 of this.npcs.values()) {
        if (npc1.id === npc2.id) continue;

        const distance = this.getDistance(npc1.position, npc2.position);
        if (distance < this.config.socialInteractionRange) {
          // Check if they should interact
          if (this.shouldNPCsInteract(npc1, npc2)) {
            const interaction: NPCSocialInteraction = {
              npc1Id: npc1.id,
              npc2Id: npc2.id,
              type: this.determineInteractionType(npc1, npc2),
              duration: 5 + Math.random() * 10, // 5-15 seconds
              startTime: Date.now(),
              intensity: 30 + Math.random() * 40 // 30-70
            };
            interactions.push(interaction);
          }
        }
      }
    }

    this.socialInteractions = interactions;
    this.metrics.socialInteractions = interactions.length;
  }

  private handleNPCSpawning(currentTime: number): void {
    if (this.npcs.size >= this.config.maxNPCs) return;
    if (this.config.spawnRate === 0) return; // Disable all spawning when global rate is 0

    for (const spawnPoint of this.spawnPoints) {
      const timeSinceLastSpawn = currentTime - spawnPoint.lastSpawn;
      const effectiveSpawnRate = this.config.spawnRate * spawnPoint.spawnRate; // Combine global and local rates
      const spawnInterval = 60000 / effectiveSpawnRate; // Convert to milliseconds

      if (timeSinceLastSpawn > spawnInterval) {
        // Count NPCs near this spawn point
        const nearbyNPCs = this.getNPCsNearPosition(spawnPoint.position, spawnPoint.spawnRadius);
        
        if (nearbyNPCs.length < spawnPoint.maxNPCs) {
          // Select random character type for this spawn point
          const characterType = spawnPoint.characterTypes[
            Math.floor(Math.random() * spawnPoint.characterTypes.length)
          ];

          // Generate spawn position within radius
          const spawnPosition = this.getRandomPositionInRadius(
            spawnPoint.position, 
            spawnPoint.spawnRadius
          );

          // Spawn NPC
          const npc = this.spawnNPC(characterType, spawnPosition);
          if (npc) {
            spawnPoint.lastSpawn = currentTime;
            Logger.debug(LogCategory.CORE, `[NPCSystem] Spawned NPC at ${spawnPoint.position}`);
          }
        }
      }
    }
  }

  private updateMetrics(): void {
    this.metrics.totalNPCs = this.npcs.size;
    this.metrics.activeBehaviors.clear();
    
    let totalBehaviorDuration = 0;
    let behaviorCount = 0;

    for (const aiController of this.aiControllers.values()) {
      const currentBehavior = aiController.getCurrentBehavior();
      if (currentBehavior) {
        const count = this.metrics.activeBehaviors.get(currentBehavior.type) || 0;
        this.metrics.activeBehaviors.set(currentBehavior.type, count + 1);
        
        totalBehaviorDuration += currentBehavior.duration;
        behaviorCount++;
      }
    }

    this.metrics.averageBehaviorDuration = behaviorCount > 0 ? totalBehaviorDuration / behaviorCount : 0;
    
    // Calculate performance impact
    this.metrics.performanceImpact = Math.min(100, this.npcs.size * 5); // 5% per NPC
  }

  private createNPCEntity(npc: NPC, aiController: NPCAIController): void {
    // Create entity through ECS system
    const entity = new Entity(EntityId.generate());
    
    // Add NPC component
    const npcComponent: NPCComponent = {
      type: 'npc',
      npc,
      aiController,
      lastPathfindingUpdate: Date.now(),
      lastBehaviorUpdate: Date.now(),
      isVisible: true,
      performanceLevel: 'high'
    };
    
    entity.addComponent(npcComponent);
    
    // Add position component
    const positionComponent: PositionComponent = {
      type: 'position',
      value: npc.position
    };
    entity.addComponent(positionComponent);
    
    // Add rotation component
    const rotationComponent: RotationComponent = {
      type: 'rotation',
      value: new Rotation(npc.rotation.y)
    };
    entity.addComponent(rotationComponent);
    
    // Add to system
    this.addEntity(entity);
  }

  private updateNPCEntityPosition(npc: NPC): void {
    const entity = this.getEntityWithNPC(npc.id);
    if (entity) {
      // Update position component
      const positionComponent: PositionComponent = {
        type: 'position',
        value: npc.position
      };
      entity.addComponent(positionComponent);
      
      // Update rotation component
      const rotationComponent: RotationComponent = {
        type: 'rotation',
        value: new Rotation(npc.rotation.y)
      };
      entity.addComponent(rotationComponent);
    }
  }

  private getEntityWithNPC(npcId: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      const npcComponent = entity.getComponent<NPCComponent>('npc');
      if (npcComponent?.npc.id === npcId) {
        return entity;
      }
    }
    return undefined;
  }

  private updateECSEntities(): void {
    // Update ECS entities to match NPC state
    for (const entity of this.entities.values()) {
      const npcComponent = entity.getComponent<NPCComponent>('npc');
      if (npcComponent) {
        const npc = npcComponent.npc;
        
        // Update position and rotation
        this.updateNPCEntityPosition(npc);
        
        // Update visibility
        const renderComponent = entity.getComponent<RenderComponent>('render');
        if (renderComponent) {
          renderComponent.visible = npc.isVisible;
        }
      }
    }
  }

  private updateNPCTerrainHeight(npc: NPC): void {
    try {
      const height = this.terrainService.getTerrainHeightSync(npc.position.x, npc.position.z);
      if (height !== null) {
        npc.position = new Vector3(npc.position.x, height + 0.1, npc.position.z);
      }
    } catch (error) {
      // Keep current height if terrain service fails
    }
  }

  private getDistance(pos1: Vector3, pos2: Vector3): number {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) + 
      Math.pow(pos1.y - pos2.y, 2) + 
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  private getRandomPositionInRadius(center: Vector3, radius: number): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return new Vector3(
      center.x + Math.cos(angle) * distance,
      center.y,
      center.z + Math.sin(angle) * distance
    );
  }

  private getNPCsNearPosition(position: Vector3, radius: number): NPC[] {
    return Array.from(this.npcs.values()).filter(npc => 
      this.getDistance(npc.position, position) < radius
    );
  }

  private calculateDangerLevel(): number {
    // Simplified danger calculation based on nearby players
    let dangerLevel = 0;
    
    for (const player of this.worldState.players.values()) {
      for (const npc of this.npcs.values()) {
        const distance = this.getDistance(npc.position, player.position);
        if (distance < this.config.playerDetectionRange) {
          dangerLevel = Math.max(dangerLevel, 100 - distance);
        }
      }
    }
    
    return Math.min(100, dangerLevel);
  }

  private shouldNPCsInteract(npc1: NPC, npc2: NPC): boolean {
    // Check if NPCs are compatible for interaction
    if (npc1.characterType === npc2.characterType) {
      // Same species - more likely to interact
      return Math.random() < 0.3;
    } else {
      // Different species - less likely to interact
      return Math.random() < 0.1;
    }
  }

  private determineInteractionType(npc1: NPC, npc2: NPC): NPCSocialInteraction['type'] {
    if (npc1.characterType === npc2.characterType) {
      // Same species interactions
      const rand = Math.random();
      if (rand < 0.4) return 'greeting';
      if (rand < 0.7) return 'play';
      if (rand < 0.9) return 'mating';
      return 'territorial';
    } else {
      // Different species interactions
      const rand = Math.random();
      if (rand < 0.6) return 'greeting';
      if (rand < 0.8) return 'play';
      return 'fight';
    }
  }

  // Event Handlers

  private handlePlayerJoined(event: any): void {
    const playerState: PlayerState = {
      playerId: event.playerId,
      position: event.position,
      rotation: event.rotation,
      characterType: event.characterType,
      isLocalPlayer: event.isLocalPlayer,
      lastUpdate: Date.now()
    };
    
    this.worldState.players.set(event.playerId, playerState);
  }

  private handlePlayerLeft(event: any): void {
    this.worldState.players.delete(event.playerId);
  }

  private handlePlayerMoved(event: any): void {
    const player = this.worldState.players.get(event.playerId);
    if (player) {
      player.position = event.position;
      player.rotation = event.rotation;
      player.lastUpdate = Date.now();
    }
  }

  private handleTerrainChanged(_event: any): void {
    // Update pathfinding grid when terrain changes
    this.pathfinder.updatePathfindingGrid();
  }
} 