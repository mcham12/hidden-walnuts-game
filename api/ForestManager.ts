// Add type imports for Durable Object types
import { DurableObject, DurableObjectStorage, DurableObjectState, Request as CfRequest, Response as CfResponse } from '@cloudflare/workers-types';

// Add an empty export to make this file a module
export {};

// Define the ForestManager class
export class ForestManager implements DurableObject {
  private mapState: any[] = [];
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    this.storage = state.storage;
  }

  // Async initialization method to load mapState from storage
  private async initialize(): Promise<void> {
    const storedMapState = await this.storage.get('mapState');
    if (storedMapState) {
      this.mapState = Array.isArray(storedMapState) ? storedMapState : [];
      console.log('Loaded mapState from storage:', this.mapState);
    }
    if (this.mapState.length === 0) {
      // Seed test walnut if still empty (dev only)
      this.mapState.push({
        id: crypto.randomUUID(),
        ownerId: 'system',
        origin: 'game',
        hiddenIn: 'buried',
        location: { x: 0, y: 0, z: 0 },
        found: false,
        timestamp: Date.now()
      });
      // Persist mapState to storage immediately after seeding
      await this.storage.put('mapState', this.mapState);
    }
  }

  // Persist mapState after any update
  private async persistMapState(): Promise<void> {
    this.mapState = [...this.mapState];
    const serializedMapState = this.mapState.map(walnut => ({
      ...walnut,
      timestamp: walnut.timestamp instanceof Date ? walnut.timestamp.toISOString() : walnut.timestamp
    }));
    await this.storage.put('mapState', serializedMapState);
    console.log('Persisted mapState to storage:', serializedMapState);
  }

  // Example fetch handler
  async fetch(request: CfRequest): Promise<CfResponse> {
    await this.initialize();
    // ... existing fetch logic ...
    // After any update to mapState, call persistMapState
    await this.persistMapState();
    return new CfResponse('OK');
  }

  // Example WebSocket message handler
  async handleWebSocketMessage(message: any): Promise<void> {
    await this.initialize();
    // ... existing WebSocket message logic ...
    // After any update to mapState, call persistMapState
    await this.persistMapState();
  }
}

// ... existing code ... 