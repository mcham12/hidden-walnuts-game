// AI NOTE: This service wraps terrain.ts functions for dependency injection
// It provides terrain height calculations for collision detection

import { initializeTerrain, getTerrainHeight, isTerrainInitialized } from '../terrain';
import { Logger, LogCategory } from '../core/Logger';

export interface ITerrainService {
  initialize(): Promise<void>;
  getTerrainHeight(x: number, z: number): Promise<number>;
  isInitialized(): boolean;
  getTerrainHeightSync(x: number, z: number): number | null;
}

export class TerrainService implements ITerrainService {
  private initialized = false;

  constructor() {
    Logger.info(LogCategory.TERRAIN, '🌍 TerrainService created');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.debug(LogCategory.TERRAIN, '⚠️ TerrainService already initialized');
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      Logger.info(LogCategory.TERRAIN, `🌍 Initializing terrain with API: ${apiBase}`);
      
      await initializeTerrain(apiBase);
      this.initialized = true;
      
      Logger.info(LogCategory.TERRAIN, '✅ TerrainService initialized successfully');
    } catch (error) {
      Logger.error(LogCategory.TERRAIN, '❌ TerrainService initialization failed', error);
      // Set as initialized anyway to prevent blocking, use fallback heights
      this.initialized = true;
    }
  }

  async getTerrainHeight(x: number, z: number): Promise<number> {
    if (!this.initialized) {
      Logger.warn(LogCategory.TERRAIN, '⚠️ Getting terrain height before initialization, auto-initializing...');
      await this.initialize();
    }

    try {
      const height = getTerrainHeight(x, z);
      
      if (isNaN(height) || !isFinite(height)) {
        Logger.warn(LogCategory.TERRAIN, `⚠️ Invalid terrain height at (${x}, ${z}): ${height}, using fallback`);
        return 0.5;
      }
      
      const clampedHeight = Math.max(0.5, Math.min(10, height));
      if (clampedHeight !== height) {
        Logger.warn(LogCategory.TERRAIN, `⚠️ Terrain height at (${x}, ${z}) clamped from ${height.toFixed(2)} to ${clampedHeight.toFixed(2)}`);
      }
      
      Logger.debugExpensive(LogCategory.TERRAIN, () => 
        `📏 Terrain height at (${x.toFixed(1)}, ${z.toFixed(1)}): ${clampedHeight.toFixed(2)}`
      );
      return clampedHeight;
    } catch (error) {
      Logger.warn(LogCategory.TERRAIN, `⚠️ Failed to get terrain height at (${x}, ${z}), using fallback`, error);
      return 0.5;
    }
  }

  isInitialized(): boolean {
    return this.initialized && isTerrainInitialized();
  }

  // TASK 4: Add synchronous terrain height method for camera system
  getTerrainHeightSync(x: number, z: number): number | null {
    try {
      if (!this.initialized || !isTerrainInitialized()) {
        return null;
      }

      // Use the existing getTerrainHeight function from terrain.ts
      const height = getTerrainHeight(x, z);
      
      if (isNaN(height) || !isFinite(height)) {
        return null;
      }
      
      // Return clamped height similar to async version
      return Math.max(0.5, Math.min(10, height));
    } catch (error) {
      Logger.warn(LogCategory.TERRAIN, 'Synchronous terrain height calculation failed:', error);
      return null;
    }
  }
} 