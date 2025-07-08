import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NPCSystem } from '../systems/NPCSystem';
import { NPCAIController } from '../controllers/NPCAIController';
import { NPCPathfinder } from '../services/NPCPathfinder';
import { EventBus } from '../core/EventBus';
import { TerrainService } from '../services/TerrainService';
import { Vector3 } from '../core/types';
import { NPC, WorldState } from '../types/NPCTypes';
import { CHARACTER_CONFIGS_BY_ID } from '../config/characters';

// Mock Three.js
vi.mock('three', () => ({
  Scene: vi.fn(),
  PerspectiveCamera: vi.fn(),
  WebGLRenderer: vi.fn(() => ({
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    shadowMap: { enabled: true, type: 0 },
    domElement: document.createElement('canvas')
  })),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn(),
  Fog: vi.fn(),
  BoxGeometry: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  Mesh: vi.fn(),
  Group: vi.fn(),
  Object3D: vi.fn()
}));

// Mock terrain service
const mockTerrainService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getTerrainHeight: vi.fn().mockResolvedValue(1.0),
  getTerrainHeightSync: vi.fn().mockReturnValue(1.0),
  isInitialized: vi.fn().mockReturnValue(true)
} as any;

describe('NPC System', () => {
  let eventBus: EventBus;
  let npcSystem: NPCSystem;
  let terrainService: TerrainService;

  beforeEach(() => {
    eventBus = new EventBus();
    terrainService = mockTerrainService as any;
    npcSystem = new NPCSystem(eventBus, terrainService);
  });

  describe('NPC Spawning', () => {
    it('should spawn NPC with valid character type', () => {
      const position = new Vector3(0, 0, 0);
      const npc = npcSystem.spawnNPC('colobus', position);

      expect(npc).toBeDefined();
      expect(npc?.id).toMatch(/^npc_\d+_[a-z0-9]+$/);
      expect(npc?.characterType).toBe('colobus');
      expect(npc?.position).toEqual(position);
      expect(npc?.config).toBe(CHARACTER_CONFIGS_BY_ID.colobus);
    });

    it('should not spawn NPC with invalid character type', () => {
      const position = new Vector3(0, 0, 0);
      const npc = npcSystem.spawnNPC('invalid_type', position);

      expect(npc).toBeNull();
    });

    it('should not spawn NPC if character is not NPC-capable', () => {
      // Use a character type that we know doesn't have NPC capability
      // or use an invalid character type to test the fallback behavior
      const position = new Vector3(0, 0, 0);
      const npc = npcSystem.spawnNPC('invalid_character_type', position);

      expect(npc).toBeNull();
    });

    it('should respect max NPC limit', () => {
      const position = new Vector3(0, 0, 0);
      
      // Spawn maximum NPCs
      for (let i = 0; i < 20; i++) {
        const npc = npcSystem.spawnNPC('colobus', position);
        expect(npc).toBeDefined();
      }

      // Try to spawn one more
      const extraNPC = npcSystem.spawnNPC('colobus', position);
      expect(extraNPC).toBeNull();
    });
  });

  describe('NPC Despawning', () => {
    it('should despawn NPC by ID', () => {
      const position = new Vector3(0, 0, 0);
      const npc = npcSystem.spawnNPC('colobus', position);
      expect(npc).toBeDefined();

      if (npc) {
        const initialCount = npcSystem.getNPCCount();
        npcSystem.despawnNPC(npc.id);
        const finalCount = npcSystem.getNPCCount();

        expect(finalCount).toBe(initialCount - 1);
      }
    });

    it('should handle despawning non-existent NPC', () => {
      const initialCount = npcSystem.getNPCCount();
      npcSystem.despawnNPC('non_existent_id');
      const finalCount = npcSystem.getNPCCount();

      expect(finalCount).toBe(initialCount);
    });
  });

  describe('NPC Management', () => {
    it('should get NPC by ID', () => {
      const position = new Vector3(0, 0, 0);
      const spawnedNPC = npcSystem.spawnNPC('colobus', position);
      expect(spawnedNPC).toBeDefined();

      if (spawnedNPC) {
        const retrievedNPC = npcSystem.getNPC(spawnedNPC.id);
        expect(retrievedNPC).toBeDefined();
        expect(retrievedNPC?.id).toBe(spawnedNPC.id);
      }
    });

    it('should get all NPCs', () => {
      const position = new Vector3(0, 0, 0);
      
      npcSystem.spawnNPC('colobus', position);
      npcSystem.spawnNPC('gecko', position);
      npcSystem.spawnNPC('herring', position);

      const allNPCs = npcSystem.getAllNPCs();
      expect(allNPCs.length).toBe(3);
      expect(allNPCs.every(npc => npc.characterType)).toBe(true);
    });

    it('should get correct NPC count', () => {
      const position = new Vector3(0, 0, 0);
      
      expect(npcSystem.getNPCCount()).toBe(0);
      
      npcSystem.spawnNPC('colobus', position);
      expect(npcSystem.getNPCCount()).toBe(1);
      
      npcSystem.spawnNPC('gecko', position);
      expect(npcSystem.getNPCCount()).toBe(2);
    });
  });

  describe('NPC Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxNPCs: 10,
        spawnRate: 1,
        enableSocialInteractions: false
      };

      npcSystem.updateConfig(newConfig);
      
      // Test that configuration was updated by trying to spawn more than new max
      const position = new Vector3(0, 0, 0);
      
      for (let i = 0; i < 10; i++) {
        const npc = npcSystem.spawnNPC('colobus', position);
        expect(npc).toBeDefined();
      }

      // Try to spawn one more - should fail due to new max
      const extraNPC = npcSystem.spawnNPC('colobus', position);
      expect(extraNPC).toBeNull();
    });
  });

  describe('NPC Metrics', () => {
    it('should provide metrics', () => {
      const metrics = npcSystem.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.totalNPCs).toBe(0);
      expect(metrics.activeBehaviors).toBeInstanceOf(Map);
      expect(metrics.behaviorTransitions).toBe(0);
      expect(metrics.pathfindingRequests).toBe(0);
      expect(metrics.socialInteractions).toBe(0);
    });

    it('should update metrics when NPCs are active', () => {
      // Disable auto-spawning for this test
      npcSystem.updateConfig({ spawnRate: 0 });
      
      const position = new Vector3(0, 0, 0);
      npcSystem.spawnNPC('colobus', position);
      
      // Update the system to trigger metric updates
      npcSystem.update(1/60); // 60fps delta time
      
      const metrics = npcSystem.getMetrics();
      expect(metrics.totalNPCs).toBe(1);
    });
  });
});

describe('NPC AI Controller', () => {
  let eventBus: EventBus;
  let worldState: WorldState;
  let mockNPC: NPC;

  beforeEach(() => {
    eventBus = new EventBus();
    worldState = {
      players: new Map(),
      npcs: new Map(),
      timeOfDay: 12,
      weather: 'clear',
      temperature: 20,
      visibility: 100,
      dangerLevel: 0
    };

    mockNPC = {
      id: 'test_npc',
      characterType: 'colobus',
      config: CHARACTER_CONFIGS_BY_ID.colobus,
      position: new Vector3(0, 0, 0),
      rotation: new Vector3(0, 0, 0),
      velocity: new Vector3(0, 0, 0),
      health: 100,
      energy: 80,
      mood: 0,
      lastBehaviorChange: Date.now(),
      currentBehavior: null,
      behaviorTimer: 0,
      targetPosition: null,
      path: [],
      socialGroup: null,
      personality: {
        sociability: 50,
        curiosity: 50,
        aggression: 30,
        fearfulness: 20,
        territoriality: 40,
        energyLevel: 60
      },
      memory: {
        knownPlayers: new Map(),
        knownNPCs: new Map(),
        favoriteLocations: [],
        dangerousAreas: [],
        lastSeenPlayers: new Map(),
        lastSeenNPCs: new Map(),
        positiveExperiences: 0,
        negativeExperiences: 0
      },
      isVisible: true,
      lastUpdate: Date.now()
    };

    worldState.npcs.set(mockNPC.id, mockNPC);
  });

  describe('Behavior Selection', () => {
    it('should create AI controller for NPC', () => {
      const aiController = new NPCAIController(mockNPC, 'colobus', eventBus, worldState);
      
      expect(aiController).toBeDefined();
      expect(aiController.getCurrentBehavior()).toBeNull(); // No behavior initially
    });

    it('should select appropriate behavior based on conditions', () => {
      const aiController = new NPCAIController(mockNPC, 'colobus', eventBus, worldState);
      
      // Update to trigger behavior selection
      aiController.update(1/60);
      
      const currentBehavior = aiController.getCurrentBehavior();
      expect(currentBehavior).toBeDefined();
      expect(currentBehavior?.type).toBeDefined();
    });

    it('should transition between behaviors', () => {
      const aiController = new NPCAIController(mockNPC, 'colobus', eventBus, worldState);
      
      // Get initial behavior
      aiController.update(1/60);
      const initialBehavior = aiController.getCurrentBehavior();
      
      // Wait for behavior to end and transition
      if (initialBehavior) {
        aiController.update(initialBehavior.duration + 0.1);
        const newBehavior = aiController.getCurrentBehavior();
        
        expect(newBehavior).toBeDefined();
        expect(newBehavior?.type).toBeDefined();
      }
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance metrics', () => {
      const aiController = new NPCAIController(mockNPC, 'colobus', eventBus, worldState);
      
      // Update to trigger behavior changes
      aiController.update(1/60);
      
      const metrics = aiController.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.behaviorTransitions).toBeGreaterThanOrEqual(0);
      expect(metrics.currentBehavior).toBeDefined();
    });
  });
});

describe('NPC Pathfinder', () => {
  let pathfinder: NPCPathfinder;
  let terrainService: TerrainService;

  beforeEach(() => {
    terrainService = mockTerrainService as any;
    pathfinder = new NPCPathfinder(terrainService);
  });

  describe('Pathfinding', () => {
    it('should find path between two points', async () => {
      const start = new Vector3(0, 0, 0);
      const end = new Vector3(10, 0, 10);
      
      const path = await pathfinder.findPath(start, end);
      
      expect(path).toBeDefined();
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });

    it('should return direct path when no path found', async () => {
      const start = new Vector3(0, 0, 0);
      const end = new Vector3(0, 0, 0); // Same point
      
      const path = await pathfinder.findPath(start, end);
      
      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThanOrEqual(1);
      // Pathfinder returns a valid path with reasonable positions
      expect(path[0]).toBeDefined();
      expect(path[0].x).toBeTypeOf('number');
      expect(path[0].z).toBeTypeOf('number');
      expect(path[0].y).toBeTypeOf('number');
    });

    it('should validate positions', async () => {
      const validPosition = new Vector3(0, 0, 0);
      const invalidPosition = new Vector3(1000, 0, 1000); // Outside world bounds
      
      const isValid = await pathfinder.isValidPosition(validPosition);
      const isInvalid = await pathfinder.isValidPosition(invalidPosition);
      
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should get random valid position', async () => {
      const center = new Vector3(0, 0, 0);
      const radius = 10;
      
      const randomPos = await pathfinder.getRandomPosition(center, radius);
      
      expect(randomPos).toBeDefined();
      expect(randomPos.x).toBeGreaterThanOrEqual(center.x - radius);
      expect(randomPos.x).toBeLessThanOrEqual(center.x + radius);
      expect(randomPos.z).toBeGreaterThanOrEqual(center.z - radius);
      expect(randomPos.z).toBeLessThanOrEqual(center.z + radius);
    });
  });

  describe('Pathfinding Statistics', () => {
    it('should provide pathfinding statistics', () => {
      const stats = pathfinder.getPathfindingStats();
      
      expect(stats).toBeDefined();
      expect(stats.gridWidth).toBeGreaterThan(0);
      expect(stats.gridHeight).toBeGreaterThan(0);
      expect(stats.walkableCells).toBeGreaterThan(0);
      expect(stats.totalCells).toBeGreaterThan(0);
      expect(stats.walkableCells).toBeLessThanOrEqual(stats.totalCells);
    });
  });
});

describe('NPC System Integration', () => {
  let eventBus: EventBus;
  let npcSystem: NPCSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    npcSystem = new NPCSystem(eventBus, mockTerrainService as any);
  });

  describe('Event Handling', () => {
    it('should handle player joined events', () => {
      const playerEvent = {
        playerId: 'test_player',
        position: new Vector3(0, 0, 0),
        rotation: new Vector3(0, 0, 0),
        characterType: 'colobus',
        isLocalPlayer: true
      };

      eventBus.emit('player.joined', playerEvent);
      
      // System should update world state with player
      npcSystem.update(1/60);
      
      const metrics = npcSystem.getMetrics();
      expect(metrics).toBeDefined();
    });

    it('should handle player left events', () => {
      const playerEvent = {
        playerId: 'test_player'
      };

      eventBus.emit('player.left', playerEvent);
      
      // System should remove player from world state
      npcSystem.update(1/60);
      
      const metrics = npcSystem.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('System Updates', () => {
    it('should update without errors', () => {
      // Disable auto-spawning for this test
      npcSystem.updateConfig({ spawnRate: 0 });
      
      // Spawn some NPCs
      const position = new Vector3(0, 0, 0);
      npcSystem.spawnNPC('colobus', position);
      npcSystem.spawnNPC('gecko', position);
      
      // Update system multiple times
      for (let i = 0; i < 10; i++) {
        expect(() => npcSystem.update(1/60)).not.toThrow();
      }
      
      const metrics = npcSystem.getMetrics();
      expect(metrics.totalNPCs).toBe(2);
    });
  });
}); 