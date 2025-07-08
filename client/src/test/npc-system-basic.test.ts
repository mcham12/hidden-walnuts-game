import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NPCSystem } from '../systems/NPCSystem';
import { EventBus } from '../core/EventBus';

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

describe('NPC System - Constructor Tests', () => {
  let eventBus: EventBus;
  let npcSystem: NPCSystem;

  beforeEach(() => {
    eventBus = new EventBus();
    npcSystem = new NPCSystem(eventBus, mockTerrainService as any);
  });

  it('should create NPC system instance', () => {
    expect(npcSystem).toBeDefined();
    expect(npcSystem).toBeInstanceOf(NPCSystem);
  });

  it('should have initial metrics', () => {
    const metrics = npcSystem.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalNPCs).toBe(0);
    expect(metrics.activeBehaviors).toBeInstanceOf(Map);
    expect(metrics.behaviorTransitions).toBe(0);
    expect(metrics.pathfindingRequests).toBe(0);
    expect(metrics.socialInteractions).toBe(0);
  });

  it('should have correct initial NPC count', () => {
    expect(npcSystem.getNPCCount()).toBe(0);
  });

  it('should return empty array for all NPCs initially', () => {
    const allNPCs = npcSystem.getAllNPCs();
    expect(allNPCs).toBeInstanceOf(Array);
    expect(allNPCs.length).toBe(0);
  });

  it('should return undefined for non-existent NPC', () => {
    const npc = npcSystem.getNPC('non_existent_id');
    expect(npc).toBeUndefined();
  });

  it('should update configuration', () => {
    const newConfig = {
      maxNPCs: 5,
      spawnRate: 1,
      enableSocialInteractions: false
    };

    expect(() => npcSystem.updateConfig(newConfig)).not.toThrow();
  });

  it('should handle system update without errors', () => {
    expect(() => npcSystem.update(1/60)).not.toThrow();
  });

  it('should handle multiple system updates', () => {
    for (let i = 0; i < 5; i++) {
      expect(() => npcSystem.update(1/60)).not.toThrow();
    }
  });
}); 