import { describe, it, expect, vi } from 'vitest';

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

describe('NPC System - Minimal Tests', () => {
  it('should import NPCSystem without errors', async () => {
    const { NPCSystem } = await import('../systems/NPCSystem');
    expect(NPCSystem).toBeDefined();
  });

  it('should import EventBus without errors', async () => {
    const { EventBus } = await import('../core/EventBus');
    expect(EventBus).toBeDefined();
  });

  it('should import TerrainService without errors', async () => {
    const { TerrainService } = await import('../services/TerrainService');
    expect(TerrainService).toBeDefined();
  });

  it('should create NPCSystem instance', async () => {
    const { NPCSystem } = await import('../systems/NPCSystem');
    const { EventBus } = await import('../core/EventBus');
    const { TerrainService } = await import('../services/TerrainService');
    
    const eventBus = new EventBus();
    const terrainService = new TerrainService();
    const npcSystem = new NPCSystem(eventBus, terrainService);
    
    expect(npcSystem).toBeDefined();
    expect(typeof npcSystem.getMetrics).toBe('function');
    expect(typeof npcSystem.getNPCCount).toBe('function');
  });

  it('should return initial metrics', async () => {
    const { NPCSystem } = await import('../systems/NPCSystem');
    const { EventBus } = await import('../core/EventBus');
    const { TerrainService } = await import('../services/TerrainService');
    
    const eventBus = new EventBus();
    const terrainService = new TerrainService();
    const npcSystem = new NPCSystem(eventBus, terrainService);
    
    const metrics = npcSystem.getMetrics();
    expect(metrics.totalNPCs).toBe(0);
    expect(metrics.activeBehaviors).toBeInstanceOf(Map);
  });

  it('should return initial NPC count', async () => {
    const { NPCSystem } = await import('../systems/NPCSystem');
    const { EventBus } = await import('../core/EventBus');
    const { TerrainService } = await import('../services/TerrainService');
    
    const eventBus = new EventBus();
    const terrainService = new TerrainService();
    const npcSystem = new NPCSystem(eventBus, terrainService);
    
    expect(npcSystem.getNPCCount()).toBe(0);
  });
}); 