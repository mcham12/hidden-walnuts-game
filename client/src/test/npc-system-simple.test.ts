import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NPCSystem } from '../systems/NPCSystem';
import { EventBus } from '../core/EventBus';
import { Vector3 } from '../core/types';
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

describe('NPC System - Basic Tests', () => {
  let eventBus: EventBus;
  let npcSystem: NPCSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    npcSystem = new NPCSystem(eventBus, mockTerrainService as any);
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
        maxNPCs: 5,
        spawnRate: 1,
        enableSocialInteractions: false
      };

      npcSystem.updateConfig(newConfig);
      
      // Test that configuration was updated by trying to spawn more than new max
      const position = new Vector3(0, 0, 0);
      
      for (let i = 0; i < 5; i++) {
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
      for (let i = 0; i < 5; i++) {
        expect(() => npcSystem.update(1/60)).not.toThrow();
      }
      
      const metrics = npcSystem.getMetrics();
      expect(metrics.totalNPCs).toBe(2);
    });
  });
}); 