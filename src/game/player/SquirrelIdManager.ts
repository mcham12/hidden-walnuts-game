/**
 * SquirrelIdManager handles generating, fetching, and persisting a unique Squirrel ID for the player.
 */
export class SquirrelIdManager {
  private static readonly STORAGE_KEY = 'squirrel_id';
  private squirrelId: string;

  constructor() {
    this.squirrelId = this.loadOrCreateId();
  }

  private loadOrCreateId(): string {
    // Try to load from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(SquirrelIdManager.STORAGE_KEY);
      if (stored) return stored;
    }
    // Generate a new UUID (simple version)
    const newId = SquirrelIdManager.generateUUID();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(SquirrelIdManager.STORAGE_KEY, newId);
    }
    return newId;
  }

  public getId(): string {
    return this.squirrelId;
  }

  // Simple UUID v4 generator
  private static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
} 