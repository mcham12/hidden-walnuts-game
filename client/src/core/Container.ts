// Dependency Injection Container - No more 'new' everywhere!

export type Constructor<T = {}> = new (...args: any[]) => T;
export type Factory<T> = () => T;

export interface ServiceDescriptor<T = any> {
  token: string | Constructor<T>;
  factory: Factory<T>;
  singleton?: boolean;
  instance?: T;
}

export class Container {
  private services = new Map<string | Constructor<any>, ServiceDescriptor>();
  private instances = new Map<string | Constructor<any>, any>();

  // Register a singleton service
  registerSingleton<T>(
    token: string | Constructor<T>,
    factory: Factory<T>
  ): this {
    this.services.set(token, {
      token,
      factory,
      singleton: true
    });
    return this;
  }

  // Register a transient service (new instance each time)
  registerTransient<T>(
    token: string | Constructor<T>,
    factory: Factory<T>
  ): this {
    this.services.set(token, {
      token,
      factory,
      singleton: false
    });
    return this;
  }

  // Register an existing instance
  registerInstance<T>(
    token: string | Constructor<T>,
    instance: T
  ): this {
    this.instances.set(token, instance);
    return this;
  }

  // Resolve a service
  resolve<T>(token: string | Constructor<T>): T {
    // Check if we have a direct instance
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    // Check if we have a service descriptor
    const descriptor = this.services.get(token);
    if (!descriptor) {
      throw new Error(`Service not registered: ${this.getTokenName(token)}`);
    }

    // For singletons, check if we already have an instance
    if (descriptor.singleton && descriptor.instance) {
      return descriptor.instance;
    }

    // Create new instance
    const instance = descriptor.factory();

    // Store singleton instances
    if (descriptor.singleton) {
      descriptor.instance = instance;
    }

    return instance;
  }

  // Check if a service is registered
  has(token: string | Constructor<any>): boolean {
    return this.services.has(token) || this.instances.has(token);
  }

  // Clear all services (useful for testing)
  clear(): void {
    this.services.clear();
    this.instances.clear();
  }

  private getTokenName(token: string | Constructor<any>): string {
    return typeof token === 'string' ? token : token.name;
  }
}

// Service tokens for type safety
export const ServiceTokens = {
  EVENT_BUS: 'EventBus',
  ENTITY_MANAGER: 'EntityManager',
  SCENE_MANAGER: 'SceneManager',
  RENDER_MANAGER: 'RenderManager',
  ASSET_MANAGER: 'AssetManager',
  INPUT_MANAGER: 'InputManager',
  NETWORK_MANAGER: 'NetworkManager',
  MOVEMENT_SYSTEM: 'MovementSystem',
  INTERPOLATION_SYSTEM: 'InterpolationSystem',
  RENDER_SYSTEM: 'RenderSystem',
  NETWORK_SYSTEM: 'NetworkSystem',
  NETWORK_TICK_SYSTEM: 'NetworkTickSystem',
  CLIENT_PREDICTION_SYSTEM: 'ClientPredictionSystem',
  AREA_OF_INTEREST_SYSTEM: 'AreaOfInterestSystem',
  NETWORK_COMPRESSION_SYSTEM: 'NetworkCompressionSystem',
  INPUT_SYSTEM: 'InputSystem',
  PLAYER_MANAGER: 'PlayerManager',
  TERRAIN_SERVICE: 'TerrainService',
  RENDER_ADAPTER: 'RenderAdapter',
  PLAYER_FACTORY: 'PlayerFactory',
  CAMERA_SYSTEM: 'CameraSystem',
  INPUT_ANIMATION_SYSTEM: 'InputAnimationSystem',
  ANIMATION_SYSTEM: 'AnimationSystem'
} as const;

// Global container instance
export const container = new Container(); 