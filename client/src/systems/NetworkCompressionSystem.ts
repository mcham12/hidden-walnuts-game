// Network Compression System - Batching and compressing network messages for performance

import { System } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';

interface QueuedMessage {
  type: string;
  data: any;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

interface BatchedUpdate {
  timestamp: number;
  sequence: number;
  updates: {
    type: string;
    data: any;
  }[];
}

export class NetworkCompressionSystem extends System {
  private static readonly BATCH_INTERVAL = 50; // 20Hz batching (faster than 10Hz ticks)
  private static readonly MAX_BATCH_SIZE = 10; // Max messages per batch
  private static readonly COMPRESSION_THRESHOLD = 100; // Compress if JSON > 100 bytes
  
  private messageQueue: QueuedMessage[] = [];
  private lastBatchTime = 0;
  private batchSequence = 0;
  private websocket: WebSocket | null = null;
  
  // Message deduplication
  private lastSentStates = new Map<string, any>();
  
  constructor(eventBus: EventBus) {
    super(eventBus, [], 'NetworkCompressionSystem');
    
    // Listen for all outgoing network messages
    this.eventBus.subscribe('network.queue_message', this.queueMessage.bind(this));
  }

  setWebSocket(websocket: WebSocket): void {
    this.websocket = websocket;
  }

  update(_deltaTime: number): void {
    const now = performance.now();
    
    // Batch and send messages at fixed intervals
    if (now - this.lastBatchTime >= NetworkCompressionSystem.BATCH_INTERVAL) {
      this.processBatch();
      this.lastBatchTime = now;
    }
  }

  private queueMessage(message: {
    type: string;
    data: any;
    priority?: 'high' | 'medium' | 'low';
  }): void {
    // Check for redundancy (don't send identical states)
    if (this.isDuplicateState(message.type, message.data)) {
      Logger.debugExpensive(LogCategory.COMPRESSION, () => `Skipped duplicate ${message.type}`);
      return;
    }
    
    this.messageQueue.push({
      type: message.type,
      data: message.data,
      timestamp: performance.now(),
      priority: message.priority || 'medium'
    });
    
    // Update last sent state for deduplication
    this.lastSentStates.set(message.type, this.createStateFingerprint(message.data));
    
    // Send immediately if high priority or queue is full
    if (message.priority === 'high' || this.messageQueue.length >= NetworkCompressionSystem.MAX_BATCH_SIZE) {
      this.processBatch();
    }
  }

  private isDuplicateState(type: string, data: any): boolean {
    if (type !== 'player_state') return false; // Only deduplicate movement
    
    const lastState = this.lastSentStates.get(type);
    const currentState = this.createStateFingerprint(data);
    
    return lastState === currentState;
  }

  private createStateFingerprint(data: any): string {
    // Create a simplified fingerprint for state comparison
    if (data.position && data.rotation) {
      // Round to reduce precision for comparison (0.1 meter precision)
      const x = Math.round(data.position.x * 10) / 10;
      const y = Math.round(data.position.y * 10) / 10;
      const z = Math.round(data.position.z * 10) / 10;
      const rot = Math.round(data.rotation.y * 100) / 100; // 0.01 radian precision
      
      return `${x},${y},${z},${rot}`;
    }
    
    return JSON.stringify(data);
  }

  private processBatch(): void {
    if (this.messageQueue.length === 0 || !this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Sort by priority (high first)
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    // Create batch
    const batch: BatchedUpdate = {
      timestamp: performance.now(),
      sequence: ++this.batchSequence,
      updates: this.messageQueue.map(msg => ({
        type: msg.type,
        data: this.compressData(msg.data)
      }))
    };
    
    // Apply delta compression for movement updates
    this.applyDeltaCompression(batch);
    
    // Serialize and potentially compress
    const serialized = JSON.stringify(batch);
    const finalPayload = this.shouldCompress(serialized) ? 
      this.compressString(serialized) : serialized;
    
    this.websocket.send(finalPayload);
    
    Logger.debugExpensive(LogCategory.COMPRESSION, () => 
      `Sent batch ${batch.sequence} with ${batch.updates.length} messages (${serialized.length} bytes)`
    );
    
    // Clear queue
    this.messageQueue = [];
  }

  private compressData(data: any): any {
    // Remove redundant fields and apply data compression
    if (data.position && data.rotation && data.velocity) {
      // Round movement data to reduce precision
      return {
        p: [
          Math.round(data.position.x * 100) / 100,
          Math.round(data.position.y * 100) / 100,
          Math.round(data.position.z * 100) / 100
        ],
        r: Math.round(data.rotation.y * 1000) / 1000,
        // Only include velocity if significant
        ...(this.isSignificantVelocity(data.velocity) && {
          v: [
            Math.round(data.velocity.x * 100) / 100,
            Math.round(data.velocity.z * 100) / 100
          ]
        }),
        ts: data.timestamp || performance.now()
      };
    }
    
    return data;
  }

  private isSignificantVelocity(velocity: any): boolean {
    if (!velocity) return false;
    const magnitude = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    return magnitude > 0.01; // Only send if moving faster than 1cm/s
  }

  private applyDeltaCompression(batch: BatchedUpdate): void {
    // Group movement updates by player
    const playerMovements = new Map<string, any[]>();
    
    batch.updates.forEach((update, index) => {
      if (update.type === 'player_state' && update.data.squirrelId) {
        const playerId = update.data.squirrelId;
        if (!playerMovements.has(playerId)) {
          playerMovements.set(playerId, []);
        }
        playerMovements.get(playerId)!.push({ update, index });
      }
    });
    
    // Apply delta compression - only send the latest position per player
    for (const [playerId, movements] of playerMovements) {
      if (movements.length > 1) {
        // Keep only the latest movement, mark others for removal
        for (let i = 0; i < movements.length - 1; i++) {
          batch.updates[movements[i].index] = null as any; // Mark for removal
        }
        
        Logger.debugExpensive(LogCategory.COMPRESSION, () => 
          `Delta compressed ${movements.length} movements for ${playerId} to 1`
        );
      }
    }
    
    // Remove null entries
    batch.updates = batch.updates.filter(update => update !== null);
  }

  private shouldCompress(data: string): boolean {
    return data.length > NetworkCompressionSystem.COMPRESSION_THRESHOLD;
  }

  // CHEN'S FIX: Real compression using built-in browser APIs
  private compressString(data: string): string {
    // Use browser's built-in compression where available
    try {
      // Convert to Uint8Array for compression
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      
      // Simple run-length encoding for repetitive data
      const compressed = this.runLengthEncode(bytes);
      
      const compressionRatio = Math.round((1 - compressed.length / bytes.length) * 100);
      Logger.debugExpensive(LogCategory.COMPRESSION, () => 
        `Real compression: ${bytes.length} → ${compressed.length} bytes (${compressionRatio}% saved)`
      );
      
      // Convert back to string with compression marker
      return `BINARY:${btoa(String.fromCharCode(...compressed))}`;
    } catch (error) {
      Logger.warn(LogCategory.COMPRESSION, 'Compression failed, sending uncompressed', error);
      return data;
    }
  }

  private runLengthEncode(data: Uint8Array): Uint8Array {
    // Simple RLE compression for game data
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const current = data[i];
      let count = 1;
      
      // Count consecutive identical bytes (max 255)
      while (i + 1 < data.length && data[i + 1] === current && count < 255) {
        count++;
        i++;
      }
      
      if (count > 3 || current === 0) {
        // Use RLE for repeated sequences or nulls
        result.push(0xFF, current, count);
      } else {
        // Store raw data for short sequences
        for (let j = 0; j < count; j++) {
          result.push(current);
        }
      }
    }
    
    return new Uint8Array(result);
  }

  // Public API for other systems
  queueNetworkMessage(type: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    this.eventBus.emit('network.queue_message', { type, data, priority });
  }

  getQueueStats(): { 
    queueSize: number; 
    batchesSent: number; 
    lastBatchSize: number;
  } {
    return {
      queueSize: this.messageQueue.length,
      batchesSent: this.batchSequence,
      lastBatchSize: 0 // Would track in real implementation
    };
  }

  forceFlush(): void {
    this.processBatch();
  }
} 