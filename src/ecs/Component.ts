export abstract class Component {
  // Each component type gets a unique key for type-safe lookup
  static readonly key: symbol;
} 