// AI-Friendly Test Setup for Hidden Walnuts
// This file provides utilities that make testing multiplayer systems easy for AI

import { vi, describe, afterEach } from 'vitest';

// Mock WebSocket for multiplayer testing
class MockWebSocket {
  readyState = 1; // WebSocket.OPEN
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  constructor(url: string) {
    this.url = url;
    // Auto-connect for testing
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }
  
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    // Simulate network delay for realistic testing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }));
      }
    }, Math.random() * 10); // 0-10ms delay
  }
  
  close(): void {
    this.readyState = 3; // WebSocket.CLOSED
    this.onclose?.(new CloseEvent('close'));
  }
}

// Mock Three.js for 3D testing
const mockThree = {
  Vector3: class {
    constructor(public x: number = 0, public y: number = 0, public z: number = 0) {}
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v: any) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new mockThree.Vector3(this.x, this.y, this.z); }
    distanceTo(v: any) { 
      const dx = this.x - v.x; const dy = this.y - v.y; const dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  },
  Object3D: class {
    position: any;
    rotation = { y: 0 };
    visible = true;
    children: any[] = [];
    
    constructor() {
      this.position = new mockThree.Vector3();
    }
    
    add(child: any) { this.children.push(child); }
    remove(child: any) { this.children = this.children.filter(c => c !== child); }
  }
};

// AI-Friendly Test Utilities
export const TestUtils = {
  // Create mock player for testing
  createMockPlayer: (id: string, position = { x: 0, y: 0, z: 0 }) => ({
    id,
    position: { ...position },
    rotationY: 0,
    mesh: new mockThree.Object3D(),
    isVisible: true,
    lastUpdate: Date.now()
  }),
  
  // Create mock network message
  createMockMessage: (type: string, data: any) => ({
    type,
    data,
    timestamp: Date.now(),
    playerId: 'test-player'
  }),
  
  // Simulate network conditions
  simulateNetworkConditions: {
    latency: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    packetLoss: (probability: number) => Math.random() > probability,
    bandwidth: (bytesPerSecond: number) => {
      // Simulate bandwidth constraints
      return bytesPerSecond;
    }
  },
  
  // AI-friendly assertions
  assertPositionEquals: (actual: any, expected: any, tolerance = 0.01) => {
    const distance = new mockThree.Vector3(actual.x, actual.y, actual.z)
      .distanceTo(new mockThree.Vector3(expected.x, expected.y, expected.z));
    if (distance > tolerance) {
      throw new Error(`Position mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  
  // Wait for async operations (AI-friendly)
  waitFor: async (condition: () => boolean, timeout = 1000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!condition()) {
      throw new Error('Condition not met within timeout');
    }
  }
};

// Global test environment setup
(global as any).WebSocket = MockWebSocket;
(global as any).THREE = mockThree;

// AI-friendly test helpers
export const describeMultiplayer = (name: string, fn: () => void) => {
  describe(`🎮 Multiplayer: ${name}`, fn);
};

export const describeNetwork = (name: string, fn: () => void) => {
  describe(`🌐 Network: ${name}`, fn);
};

export const describePerformance = (name: string, fn: () => void) => {
  describe(`⚡ Performance: ${name}`, fn);
};

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
}); 