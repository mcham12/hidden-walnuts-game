// Terrain Service - Handles terrain height calculations without circular dependencies

import { Logger, LogCategory } from '../core/Logger';

export interface ITerrainService {
  getTerrainHeight(x: number, z: number): Promise<number>;
  isInitialized(): boolean;
}

export class TerrainService implements ITerrainService {
  private heightMap: Float32Array | null = null;
  private mapSize = 100;
  private isReady = false;

  constructor(private apiBase: string) {}

  async initialize(): Promise<void> {
    try {
      Logger.info(LogCategory.TERRAIN, 'Initializing terrain height map...');
      Logger.info(LogCategory.TERRAIN, `API Base URL: ${this.apiBase}`);
      
      // ZERO'S FIX: Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      // Get terrain seed from API
      const fetchUrl = `${this.apiBase}/terrain-seed`;
      Logger.info(LogCategory.TERRAIN, `Fetching from: ${fetchUrl}`);
      
      const response = await fetch(fetchUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      Logger.info(LogCategory.TERRAIN, `Response status: ${response.status}`);
      Logger.info(LogCategory.TERRAIN, `Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(LogCategory.TERRAIN, `HTTP ${response.status}: ${errorText}`);
        throw new Error(`Failed to fetch terrain seed: ${response.status}`);
      }
      
      // Debug: Log the raw response text first
      const responseText = await response.text();
      Logger.info(LogCategory.TERRAIN, `Raw response: ${responseText}`);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        Logger.debug(LogCategory.TERRAIN, `Terrain seed: ${data.seed}`);
      } catch (parseError) {
        Logger.error(LogCategory.TERRAIN, `JSON Parse Error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
        Logger.error(LogCategory.TERRAIN, `Response that failed to parse: ${responseText.substring(0, 500)}`);
        throw parseError;
      }
      
      // Generate height map based on seed (simplified implementation)
      this.generateHeightMap(data.seed);
      this.isReady = true;
      
      Logger.info(LogCategory.TERRAIN, 'Terrain service ready with server data');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(LogCategory.TERRAIN, `TerrainService initialization failed: ${errorMessage}`);
      Logger.warn(LogCategory.TERRAIN, `Server unavailable, using offline terrain: ${errorMessage}`);
      // ZERO'S FIX: Better fallback with procedural terrain
      this.generateProceduralHeightMap();
      this.isReady = true;
    }
  }

  async getTerrainHeight(x: number, z: number): Promise<number> {
    if (!this.isReady || !this.heightMap) {
      Logger.warn(LogCategory.TERRAIN, 'Not initialized, returning default height');
      return 0;
    }

    // Convert world coordinates to heightmap coordinates
    const mapX = Math.floor((x + this.mapSize / 2) * (this.heightMap.length / this.mapSize));
    const mapZ = Math.floor((z + this.mapSize / 2) * (this.heightMap.length / this.mapSize));
    
    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(this.heightMap.length - 1, mapX));
    const clampedZ = Math.max(0, Math.min(this.heightMap.length - 1, mapZ));
    
    const index = clampedZ * Math.sqrt(this.heightMap.length) + clampedX;
    return this.heightMap[index] || 0;
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  private generateHeightMap(seed: number): void {
    // Simple height map generation using seed
    const size = 256; // 256x256 height map
    this.heightMap = new Float32Array(size * size);
    
    // Use seed for deterministic random generation
    let random = this.seededRandom(seed);
    
    for (let i = 0; i < this.heightMap.length; i++) {
      // Generate height between -2 and 3
      this.heightMap[i] = (random() - 0.5) * 5;
    }
    
    Logger.debug(LogCategory.TERRAIN, `Generated ${size}x${size} height map`);
  }

  private generateProceduralHeightMap(): void {
    // ZERO'S FIX: Better offline terrain with hills and valleys
    const size = 256;
    this.heightMap = new Float32Array(size * size);
    
    // Generate procedural terrain using deterministic math
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const index = z * size + x;
        
        // Normalize coordinates to 0-1 range
        const nx = x / size;
        const nz = z / size;
        
        // Multiple octaves of noise for natural terrain
        const height1 = Math.sin(nx * 4 * Math.PI) * Math.cos(nz * 4 * Math.PI) * 1.0;
        const height2 = Math.sin(nx * 8 * Math.PI) * Math.cos(nz * 8 * Math.PI) * 0.5;
        const height3 = Math.sin(nx * 16 * Math.PI) * Math.cos(nz * 16 * Math.PI) * 0.25;
        
        // Combine octaves and ensure reasonable height range (0-4)
        this.heightMap[index] = Math.max(0, 2 + height1 + height2 + height3);
      }
    }
    
    Logger.debug(LogCategory.TERRAIN, 'Generated procedural terrain with hills');
  }

  private seededRandom(seed: number): () => number {
    let currentSeed = seed;
    return function() {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      return currentSeed / 233280;
    };
  }
} 