import { describe, it, expect } from 'vitest';
import { Entity } from '../../../src/engine/ecs/Entity';
import { Component } from '../../../src/engine/ecs/Component';

class DummyComponent extends Component {
  static readonly key = Symbol('DummyComponent');
  value = 42;
}

describe('Entity', () => {
  it('can add and retrieve a component', () => {
    const entity = new Entity();
    const comp = new DummyComponent();
    entity.addComponent(comp);
    const retrieved = entity.getComponent(DummyComponent);
    expect(retrieved).toBe(comp);
    expect(retrieved?.value).toBe(42);
  });

  it('can remove a component', () => {
    const entity = new Entity();
    const comp = new DummyComponent();
    entity.addComponent(comp);
    entity.removeComponent(DummyComponent);
    expect(entity.getComponent(DummyComponent)).toBeUndefined();
  });
}); 