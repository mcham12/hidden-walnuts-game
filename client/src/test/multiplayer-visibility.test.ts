// Integration test for multiplayer visibility system
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EntityManager, Entity, PositionComponent, RenderComponent, NetworkComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { RenderSystem } from '../systems/RenderSystem';
import { PlayerManager } from '../systems/PlayerManager';
import { ThreeJSRenderAdapter } from '../rendering/IRenderAdapter';
import { Vector3, EntityId } from '../core/types';
import { Logger, LogCategory } from '../core/Logger';

// Mock Three.js objects
const mockMesh = {
  position: { set: () => {}, x: 0, y: 0, z: 0 },
  rotation: { y: 0 },
  visible: true,
  scale: { set: () => {} },
  parent: null,
  traverse: () => {}
};

const mockScene = {
  add: () => {},
  remove: () => {},
  children: []
};

describe('Multiplayer Visibility Integration Test', () => {
  let eventBus: EventBus;
  let entityManager: EntityManager;
  let renderSystem: RenderSystem;
  let playerManager: PlayerManager;

  beforeEach(() => {
    eventBus = new EventBus();
    entityManager = new EntityManager(eventBus);
    
    const renderAdapter = new ThreeJSRenderAdapter();
    renderSystem = new RenderSystem(eventBus, renderAdapter);
    
    // Mock PlayerManager setup
    playerManager = new (class extends PlayerManager {
      constructor() {
        super(eventBus, null as any);
        (this as any).scene = mockScene;
        (this as any).assetManager = {
          loadModel: () => Promise.resolve({ scene: mockMesh })
        };
      }
    })();

    entityManager.addSystem(renderSystem);
    entityManager.addSystem(playerManager);
  });

  afterEach(() => {
    entityManager.clear();
  });

  it('should isolate mesh positions between multiple players', async () => {
    // Create two player entities with different positions
    const localPlayer = createPlayerEntity('local-player-1', new Vector3(10, 2, 5), true);
    const remotePlayer = createPlayerEntity('remote-player-1', new Vector3(20, 2, 15), false);

    entityManager.addEntity(localPlayer);
    entityManager.addEntity(remotePlayer);

    // Run one update cycle
    entityManager.update(0.016); // 60fps

    // Validate entities were added to systems
    expect(renderSystem.getEntities()).toHaveLength(2);
    
    // Validate components maintain correct positions
    const localPos = localPlayer.getComponent<PositionComponent>('position');
    const remotePos = remotePlayer.getComponent<PositionComponent>('position');
    
    expect(localPos?.value.x).toBe(10);
    expect(localPos?.value.z).toBe(5);
    expect(remotePos?.value.x).toBe(20);
    expect(remotePos?.value.z).toBe(15);

    // Validate no position corruption between entities
    expect(localPos?.value.x).not.toBe(remotePos?.value.x);
    expect(localPos?.value.z).not.toBe(remotePos?.value.z);
  });

  it('should handle entity removal without orphaned components', () => {
    const player = createPlayerEntity('test-player', new Vector3(0, 2, 0), false);
    entityManager.addEntity(player);

    // Verify entity is in systems
    expect(renderSystem.getEntities()).toHaveLength(1);

    // Remove entity
    entityManager.removeEntity(player.id);

    // Verify entity is removed from all systems
    expect(renderSystem.getEntities()).toHaveLength(0);
    expect(entityManager.getEntity(player.id)).toBeUndefined();

    // Validate no orphaned entities
    const integrity = entityManager.validateEntityIntegrity();
    expect(integrity.orphanedEntities).toHaveLength(0);
    expect(integrity.systemMismatches).toHaveLength(0);
  });

  it('should maintain component isolation across entities', () => {
    const player1 = createPlayerEntity('player-1', new Vector3(1, 1, 1), false);
    const player2 = createPlayerEntity('player-2', new Vector3(2, 2, 2), false);

    entityManager.addEntity(player1);
    entityManager.addEntity(player2);

    // Modify player1 position
    player1.addComponent<PositionComponent>({
      type: 'position',
      value: new Vector3(99, 99, 99)
    });

    // Verify player2 position is unchanged
    const player2Pos = player2.getComponent<PositionComponent>('position');
    expect(player2Pos?.value.x).toBe(2);
    expect(player2Pos?.value.y).toBe(2);
    expect(player2Pos?.value.z).toBe(2);

    // Verify components are not shared
    const player1Pos = player1.getComponent<PositionComponent>('position');
    expect(player1Pos?.value.x).toBe(99);
    expect(player1Pos !== player2Pos).toBe(true);
  });

  it('should handle invalid position data gracefully', () => {
    const player = createPlayerEntity('invalid-player', new Vector3(NaN, NaN, NaN), false);
    entityManager.addEntity(player);

    // Run update cycle - should not crash
    expect(() => {
      entityManager.update(0.016);
    }).not.toThrow();

         // Verify position was corrected to safe fallback
     const position = player.getComponent<PositionComponent>('position');
     expect(position).toBeDefined();
     if (position) {
       expect(isNaN(position.value.x)).toBe(false);
       expect(isNaN(position.value.y)).toBe(false);
       expect(isNaN(position.value.z)).toBe(false);
     }
  });

  function createPlayerEntity(squirrelId: string, position: Vector3, isLocal: boolean): Entity {
    const entity = new Entity(EntityId.generate());
    
    entity.addComponent<PositionComponent>({
      type: 'position',
      value: position
    });
    
    entity.addComponent<RenderComponent>({
      type: 'render',
      mesh: { ...mockMesh } as any,
      visible: true
    });
    
    entity.addComponent<NetworkComponent>({
      type: 'network',
      isLocalPlayer: isLocal,
      squirrelId,
      lastUpdate: performance.now()
    });

    if (isLocal) {
      entity.addComponent({ type: 'input', forward: false, backward: false, turnLeft: false, turnRight: false });
    }

    entity.addComponent({ type: 'player' });
    entity.addComponent({ type: 'rotation', value: { y: 0 } });

    return entity;
  }
}); 