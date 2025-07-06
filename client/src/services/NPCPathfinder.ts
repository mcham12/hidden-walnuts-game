import { Vector3 } from '../core/types';
import { PathfindingGrid } from '../types/NPCTypes';
import { ITerrainService } from './TerrainService';
import { Logger, LogCategory } from '../core/Logger';

/**
 * Pathfinding Node for A* algorithm
 */
interface PathfindingNode {
  x: number;
  z: number;
  g: number; // Cost from start to current node
  h: number; // Heuristic cost from current to target
  f: number; // Total cost (g + h)
  parent: PathfindingNode | null;
}

/**
 * NPC Pathfinding Service
 * Provides A* pathfinding with terrain awareness
 */
export class NPCPathfinder {
  private pathfindingGrid: PathfindingGrid;
  private terrainService: ITerrainService;
  private gridSize: number = 200; // 200x200 world
  private cellSize: number = 2; // 2 unit cells
  private gridWidth: number;
  private gridHeight: number;
  private maxPathfindingTime: number = 50; // 50ms max pathfinding time

  constructor(terrainService: ITerrainService) {
    this.terrainService = terrainService;
    this.gridWidth = Math.ceil(this.gridSize / this.cellSize);
    this.gridHeight = Math.ceil(this.gridSize / this.cellSize);
    this.pathfindingGrid = this.buildPathfindingGrid();
    
    Logger.info(LogCategory.CORE, `[NPCPathfinder] Initialized with ${this.gridWidth}x${this.gridHeight} grid`);
  }

  /**
   * Find path from start to end position
   */
  async findPath(start: Vector3, end: Vector3): Promise<Vector3[]> {
    const startTime = Date.now();
    
    try {
      // Convert world coordinates to grid coordinates
      const startGrid = this.worldToGrid(start);
      const endGrid = this.worldToGrid(end);

      // Validate grid coordinates
      if (!this.isValidGridPosition(startGrid) || !this.isValidGridPosition(endGrid)) {
        Logger.warn(LogCategory.CORE, `[NPCPathfinder] Invalid grid position: start=${startGrid}, end=${endGrid}`);
        return [start, end]; // Direct path as fallback
      }

      // Check if start or end is blocked
      if (!this.isWalkable(startGrid) || !this.isWalkable(endGrid)) {
        Logger.warn(LogCategory.CORE, `[NPCPathfinder] Start or end position is not walkable`);
        return [start, end]; // Direct path as fallback
      }

      // Use A* algorithm to find path
      const path = this.aStarSearch(startGrid, endGrid, startTime);
      
      if (path.length === 0) {
        Logger.warn(LogCategory.CORE, `[NPCPathfinder] No path found from ${start} to ${end}`);
        return [start, end]; // Direct path as fallback
      }

      // Convert grid path back to world coordinates
      const worldPath = path.map(gridPos => this.gridToWorld(gridPos));
      
      // Smooth the path
      const smoothedPath = this.smoothPath(worldPath);
      
      Logger.debug(LogCategory.CORE, `[NPCPathfinder] Found path with ${smoothedPath.length} waypoints`);
      return smoothedPath;

    } catch (error) {
      Logger.error(LogCategory.CORE, `[NPCPathfinder] Pathfinding error:`, error);
      return [start, end]; // Direct path as fallback
    }
  }

  /**
   * Check if a world position is valid for NPCs
   */
  async isValidPosition(position: Vector3): Promise<boolean> {
    try {
      const gridPos = this.worldToGrid(position);
      return this.isValidGridPosition(gridPos) && this.isWalkable(gridPos);
    } catch (error) {
      Logger.warn(LogCategory.CORE, `[NPCPathfinder] Error checking position validity:`, error);
      return false;
    }
  }

  /**
   * Get a random valid position within radius of center
   */
  async getRandomPosition(center: Vector3, radius: number): Promise<Vector3> {
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const randomPos = new Vector3(
        center.x + Math.cos(angle) * distance,
        center.y,
        center.z + Math.sin(angle) * distance
      );

      if (await this.isValidPosition(randomPos)) {
        return randomPos;
      }

      attempts++;
    }

    // Fallback: return center position
    Logger.warn(LogCategory.CORE, `[NPCPathfinder] Could not find valid random position, using center`);
    return center;
  }

  /**
   * Build the pathfinding grid
   */
  private buildPathfindingGrid(): PathfindingGrid {
    const grid: PathfindingGrid = {
      width: this.gridWidth,
      height: this.gridHeight,
      cellSize: this.cellSize,
      walkable: Array(this.gridHeight).fill(null).map(() => Array(this.gridWidth).fill(true)),
      heightMap: Array(this.gridHeight).fill(null).map(() => Array(this.gridWidth).fill(0))
    };

    // Initialize height map and mark obstacles
    for (let z = 0; z < this.gridHeight; z++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const worldPos = this.gridToWorld({ x, z });
        
        // Get terrain height
        try {
          const height = this.terrainService.getTerrainHeightSync(worldPos.x, worldPos.z);
          if (height !== null) {
            grid.heightMap[z][x] = height;
            
            // Mark steep slopes as unwalkable
            if (height > 5 || height < 0.5) {
              grid.walkable[z][x] = false;
            }
          }
        } catch (error) {
          // Mark as walkable if terrain service fails
          grid.walkable[z][x] = true;
          grid.heightMap[z][x] = 1;
        }
      }
    }

    // Mark world boundaries as unwalkable
    for (let x = 0; x < this.gridWidth; x++) {
      grid.walkable[0][x] = false; // North boundary
      grid.walkable[this.gridHeight - 1][x] = false; // South boundary
    }
    for (let z = 0; z < this.gridHeight; z++) {
      grid.walkable[z][0] = false; // West boundary
      grid.walkable[z][this.gridWidth - 1] = false; // East boundary
    }

    return grid;
  }

  /**
   * A* pathfinding algorithm
   */
  private aStarSearch(start: { x: number; z: number }, end: { x: number; z: number }, startTime: number): { x: number; z: number }[] {
    const openSet: PathfindingNode[] = [];
    const closedSet = new Set<string>();
    
    // Initialize start node
    const startNode: PathfindingNode = {
      x: start.x,
      z: start.z,
      g: 0,
      h: this.heuristic(start, end),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
      // Check time limit
      if (Date.now() - startTime > this.maxPathfindingTime) {
        Logger.warn(LogCategory.CORE, `[NPCPathfinder] Pathfinding timeout, returning partial path`);
        break;
      }

      // Find node with lowest f cost
      let currentNodeIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentNodeIndex].f) {
          currentNodeIndex = i;
        }
      }

      const currentNode = openSet[currentNodeIndex];

      // Check if we reached the target
      if (currentNode.x === end.x && currentNode.z === end.z) {
        return this.reconstructPath(currentNode);
      }

      // Move current node from open to closed set
      openSet.splice(currentNodeIndex, 1);
      closedSet.add(`${currentNode.x},${currentNode.z}`);

      // Check neighbors
      const neighbors = this.getNeighbors(currentNode);
      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.z}`;
        
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = currentNode.g + this.getDistance(currentNode, neighbor);

        let neighborInOpenSet = false;
        for (const openNode of openSet) {
          if (openNode.x === neighbor.x && openNode.z === neighbor.z) {
            neighborInOpenSet = true;
            if (tentativeG < openNode.g) {
              openNode.g = tentativeG;
              openNode.f = tentativeG + openNode.h;
              openNode.parent = currentNode;
            }
            break;
          }
        }

        if (!neighborInOpenSet) {
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, end);
          neighbor.f = tentativeG + neighbor.h;
          neighbor.parent = currentNode;
          openSet.push(neighbor);
        }
      }
    }

    // No path found
    return [];
  }

  /**
   * Get valid neighbors for a node
   */
  private getNeighbors(node: PathfindingNode): PathfindingNode[] {
    const neighbors: PathfindingNode[] = [];
    const directions = [
      { x: -1, z: 0 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: 0, z: 1 }, // Cardinal directions
      { x: -1, z: -1 }, { x: -1, z: 1 }, { x: 1, z: -1 }, { x: 1, z: 1 } // Diagonal directions
    ];

    for (const dir of directions) {
      const newX = node.x + dir.x;
      const newZ = node.z + dir.z;

      if (this.isValidGridPosition({ x: newX, z: newZ }) && this.isWalkable({ x: newX, z: newZ })) {
        neighbors.push({
          x: newX,
          z: newZ,
          g: 0,
          h: 0,
          f: 0,
          parent: null
        });
      }
    }

    return neighbors;
  }

  /**
   * Calculate heuristic (Manhattan distance)
   */
  private heuristic(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
  }

  /**
   * Calculate distance between two nodes
   */
  private getDistance(a: PathfindingNode, b: PathfindingNode): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Reconstruct path from A* result
   */
  private reconstructPath(endNode: PathfindingNode): { x: number; z: number }[] {
    const path: { x: number; z: number }[] = [];
    let currentNode: PathfindingNode | null = endNode;

    while (currentNode !== null) {
      path.unshift({ x: currentNode.x, z: currentNode.z });
      currentNode = currentNode.parent;
    }

    return path;
  }

  /**
   * Convert world coordinates to grid coordinates
   */
  private worldToGrid(worldPos: Vector3): { x: number; z: number } {
    return {
      x: Math.floor((worldPos.x + this.gridSize / 2) / this.cellSize),
      z: Math.floor((worldPos.z + this.gridSize / 2) / this.cellSize)
    };
  }

  /**
   * Convert grid coordinates to world coordinates
   */
  private gridToWorld(gridPos: { x: number; z: number }): Vector3 {
    return new Vector3(
      (gridPos.x * this.cellSize) - this.gridSize / 2 + this.cellSize / 2,
      0, // Height will be set by terrain service
      (gridPos.z * this.cellSize) - this.gridSize / 2 + this.cellSize / 2
    );
  }

  /**
   * Check if grid position is valid
   */
  private isValidGridPosition(pos: { x: number; z: number }): boolean {
    return pos.x >= 0 && pos.x < this.gridWidth && pos.z >= 0 && pos.z < this.gridHeight;
  }

  /**
   * Check if grid position is walkable
   */
  private isWalkable(pos: { x: number; z: number }): boolean {
    return this.pathfindingGrid.walkable[pos.z][pos.x];
  }

  /**
   * Smooth the path for more natural movement
   */
  private smoothPath(path: Vector3[]): Vector3[] {
    if (path.length <= 2) {
      return path;
    }

    const smoothedPath: Vector3[] = [path[0]];
    
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const current = path[i];
      const next = path[i + 1];

      // Calculate smoothed position
      const smoothedX = (prev.x + current.x + next.x) / 3;
      const smoothedZ = (prev.z + current.z + next.z) / 3;
      
      // Get terrain height for smoothed position
      try {
        const height = this.terrainService.getTerrainHeightSync(smoothedX, smoothedZ);
        const smoothedY = height !== null ? height : current.y;
        smoothedPath.push(new Vector3(smoothedX, smoothedY, smoothedZ));
      } catch (error) {
        smoothedPath.push(new Vector3(smoothedX, current.y, smoothedZ));
      }
    }

    smoothedPath.push(path[path.length - 1]);
    return smoothedPath;
  }

  /**
   * Update pathfinding grid (called when terrain changes)
   */
  async updatePathfindingGrid(): Promise<void> {
    Logger.info(LogCategory.CORE, `[NPCPathfinder] Updating pathfinding grid...`);
    this.pathfindingGrid = this.buildPathfindingGrid();
    Logger.info(LogCategory.CORE, `[NPCPathfinder] Pathfinding grid updated`);
  }

  /**
   * Get pathfinding statistics
   */
  getPathfindingStats(): { gridWidth: number; gridHeight: number; walkableCells: number; totalCells: number } {
    let walkableCells = 0;
    const totalCells = this.gridWidth * this.gridHeight;

    for (let z = 0; z < this.gridHeight; z++) {
      for (let x = 0; x < this.gridWidth; x++) {
        if (this.pathfindingGrid.walkable[z][x]) {
          walkableCells++;
        }
      }
    }

    return {
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      walkableCells,
      totalCells
    };
  }
} 