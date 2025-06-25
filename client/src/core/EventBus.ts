// Event-Driven Architecture - No more tight coupling!

export interface GameEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly data: any;
}

export interface EventHandler<T = any> {
  (event: T): void | Promise<void>;
}

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private isProcessing = false;
  private eventQueue: GameEvent[] = [];

  subscribe<T = any>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  emit(eventType: string, data?: any): void {
    const event: GameEvent = {
      type: eventType,
      timestamp: performance.now(),
      data
    };

    if (this.isProcessing) {
      // Queue events to prevent recursion
      this.eventQueue.push(event);
      return;
    }

    this.processEvent(event);
    this.processQueue();
  }

  private processEvent(event: GameEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    this.isProcessing = true;
    
    for (const handler of handlers) {
      try {
        handler(event.data);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    }
    
    this.isProcessing = false;
  }

  private processQueue(): void {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      this.processEvent(event);
    }
  }

  clear(): void {
    this.handlers.clear();
    this.eventQueue = [];
  }

  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Game-specific events
export const GameEvents = {
  // Input events
  INPUT_MOVEMENT: 'input.movement',
  INPUT_CAMERA: 'input.camera',
  
  // Player events  
  PLAYER_SPAWNED: 'player.spawned',
  PLAYER_MOVED: 'player.moved',
  PLAYER_ROTATED: 'player.rotated',
  
  // Scene events
  SCENE_LOADED: 'scene.loaded',
  ASSETS_LOADED: 'assets.loaded',
  TERRAIN_LOADED: 'terrain.loaded',
  
  // Multiplayer events
  MULTIPLAYER_CONNECTED: 'multiplayer.connected',
  MULTIPLAYER_DISCONNECTED: 'multiplayer.disconnected',
  REMOTE_PLAYER_JOINED: 'multiplayer.player_joined',
  REMOTE_PLAYER_LEFT: 'multiplayer.player_left',
  REMOTE_PLAYER_UPDATED: 'multiplayer.player_updated',
  
  // System events
  SYSTEM_ERROR: 'system.error',
  SYSTEM_READY: 'system.ready',
  FRAME_UPDATE: 'system.frame_update'
} as const; 