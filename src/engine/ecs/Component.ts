/**
 * Base class for all components in the ECS.
 * Each component type should have a unique static key.
 */
export abstract class Component {
  // Each component type gets a unique key for type-safe lookup
  static readonly key: symbol;
} 