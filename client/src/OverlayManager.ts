/**
 * OverlayManager - Industry-standard overlay queue system
 *
 * Prevents overlapping full-screen overlays by queueing them with priorities.
 * Based on MMO best practices (WoW, FFXIV, Guild Wars 2).
 *
 * Priority Levels:
 * - HIGH (3): Critical messages (death, combat alerts) - block everything
 * - MEDIUM (2): Important events (rank ups, bonuses) - sequential display
 * - LOW (1): Tips, hints - can be skipped if queue is busy
 */

export enum OverlayPriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3
}

interface OverlayRequest {
  id: string;
  priority: OverlayPriority;
  show: () => void;
  duration: number; // milliseconds
  timestamp: number; // when queued
}

export class OverlayManager {
  private queue: OverlayRequest[] = [];
  private isShowing: boolean = false;
  private readonly DELAY_BETWEEN_OVERLAYS = 300; // 300ms industry standard

  /**
   * Enqueue an overlay for display
   * @param id Unique identifier for this overlay
   * @param priority Priority level (HIGH, MEDIUM, LOW)
   * @param show Function to call to show the overlay
   * @param duration How long the overlay shows (ms)
   */
  enqueue(id: string, priority: OverlayPriority, show: () => void, duration: number): void {
    // Skip LOW priority if queue is busy (industry standard)
    if (priority === OverlayPriority.LOW && this.queue.length > 2) {
      return;
    }

    // Create request
    const request: OverlayRequest = {
      id,
      priority,
      show,
      duration,
      timestamp: Date.now()
    };

    // Add to queue based on priority (higher priority = earlier in queue)
    // For same priority, FIFO order (maintain timestamp order)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < priority) {
        this.queue.splice(i, 0, request);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.queue.push(request);
    }

    // Start processing if not already showing
    if (!this.isShowing) {
      this.processQueue();
    }
  }

  /**
   * Process the overlay queue sequentially
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      // Mark as showing
      this.isShowing = true;

      // Show the overlay
      request.show();

      // Wait for overlay duration + delay
      await this.sleep(request.duration + this.DELAY_BETWEEN_OVERLAYS);
    }

    // Queue empty
    this.isShowing = false;
  }

  /**
   * Clear the queue (emergency use only)
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Check if currently showing an overlay
   */
  isActive(): boolean {
    return this.isShowing;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Helper: Sleep for specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
