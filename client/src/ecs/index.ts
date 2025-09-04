// Entity-Component-System Architecture

import { EntityId, Vector3, Rotation } from '../core/types';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

// Component base interface
export interface Component {
  readonly type: string;
}

// Core Components
export interface PositionComponent extends Component {
  type: 'position';
  value: Vector3;
}

export interface RotationComponent extends Component {
  type: 'rotation';
  value: Rotation;
}

export interface VelocityComponent extends Component {
  type: 'velocity';
  value: Vector3;
}

export interface RenderComponent extends Component {
  type: 'render';
  mesh: import('three').Object3D;
  visible: boolean;
}

export interface InputComponent extends Component {
  type: 'input';
  forward: boolean;
  backward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export interface NetworkComponent extends Component {
  type: 'network';
  isLocalPlayer: boolean;
  squirrelId: string;
  lastUpdate: number;
}

export interface InterpolationComponent extends Component {
  type: 'interpolation';
  targetPosition: Vector3;
  targetRotation: Rotation;
  speed: number;
}

// Entity class
export class Entity {
  private components = new Map<string, Component>();

  constructor(public readonly id: EntityId) {}

  addComponent<T extends Component>(component: T): this {
    this.components.set(component.type, component);
    return this;
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  removeComponent(type: string): boolean {
    return this.components.delete(type);
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }
}

// System base class
export abstract class System {
  protected entities = new Map<string, Entity>();
  
  constructor(
    protected eventBus: EventBus,
    protected requiredComponents: string[],
    public readonly systemId: string
  ) {}

  addEntity(entity: Entity): void {
    if (this.canHandle(entity)) {
      this.entities.set(entity.id.value, entity);
      this.onEntityAdded(entity);
    }
  }

  removeEntity(entityId: EntityId): void {
    const entity = this.entities.get(entityId.value);
    if (entity) {
      this.entities.delete(entityId.value);
      this.onEntityRemoved(entity);
    }
  }

  protected canHandle(entity: Entity): boolean {
    return this.requiredComponents.every(type => entity.hasComponent(type));
  }

  protected onEntityAdded(_entity: Entity): void {
    // Override in subclasses
  }

  protected onEntityRemoved(_entity: Entity): void {
    // Override in subclasses
  }

  abstract update(deltaTime: number): void;

  getEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
}

// Entity Manager - Registry for all entities
export class EntityManager {
  private entities = new Map<string, Entity>();
  private systems: System[] = [];
  private systemExecutionOrder: string[] = [];
  // CHEN'S FIX: Indexed system lookup to avoid O(n²) performance
  private systemLookup = new Map<string, System>();

  constructor(private eventBus: EventBus) {
    // EventBus available for system coordination
    this.eventBus.subscribe('entity.cleanup', this.cleanup.bind(this));
  }

  private cleanup(): void {
    // Future: cleanup stale entities
  }

  createEntity(): Entity {
    const entity = new Entity(EntityId.generate());
    this.entities.set(entity.id.value, entity);
    return entity;
  }

  addEntity(entity: Entity): void {
    this.entities.set(entity.id.value, entity);
    
    // Notify all systems about the new entity
    for (const system of this.systems) {
      system.addEntity(entity);
    }
  }

  removeEntity(entityId: EntityId): void {
    const entity = this.entities.get(entityId.value);
    if (!entity) return;

    // Notify all systems about removal
    for (const system of this.systems) {
      system.removeEntity(entityId);
    }

    this.entities.delete(entityId.value);
  }

  getEntity(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId.value);
  }

  addSystem(system: System): void {
    this.systems.push(system);
    // CHEN'S FIX: Index system for O(1) lookup
    this.systemLookup.set(system.systemId, system);
    
    // Add existing entities to the new system
    for (const entity of this.entities.values()) {
      system.addEntity(entity);
    }
  }

  setSystemExecutionOrder(systemIds: string[]): void {
    this.systemExecutionOrder = systemIds;
    // Validate that all systems exist
    const missingSystemIds = systemIds.filter(id => !this.systemLookup.has(id));
    if (missingSystemIds.length > 0) {
      Logger.warn(LogCategory.ECS, 'Missing systems in execution order:', missingSystemIds);
    }
  }

  update(deltaTime: number): void {
    if (this.systemExecutionOrder.length > 0) {
      // CHEN'S FIX: O(1) system lookup instead of O(n) find
      for (const systemId of this.systemExecutionOrder) {
        const system = this.systemLookup.get(systemId);
        if (system) {
          system.update(deltaTime);
        } else {
          Logger.warn(LogCategory.ECS, `System ${systemId} not found for ordered execution`);
        }
      }
    } else {
      // Fallback to registration order
      for (const system of this.systems) {
        system.update(deltaTime);
      }
    }
  }

  getEntitiesWithComponent(componentType: string): Entity[] {
    return Array.from(this.entities.values())
      .filter(entity => entity.hasComponent(componentType));
  }

  clear(): void {
    this.entities.clear();
    this.systems = [];
  }
} 