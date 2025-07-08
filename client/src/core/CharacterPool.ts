import * as THREE from 'three';
import { Logger, LogCategory } from './Logger';
import { CharacterConfig } from '../types/CharacterTypes';
import { CharacterInstance } from '../types/CharacterTypes';

/**
 * Character Pool
 * FIXED: Object pooling and LOD management for performance optimization
 */
export class CharacterPool {
  private pools: Map<string, CharacterInstance[]> = new Map();
  private activeInstances: Map<string, CharacterInstance> = new Map();
  private maxPoolSize = 20; // Maximum instances per character type
  private lodDistances = [0, 10, 25, 50]; // LOD distance thresholds
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastCleanupTime = 0;
  private cleanupIntervalMs = 30000; // 30 seconds

  constructor() {
    this.startCleanupTimer();
    Logger.info(LogCategory.CORE, '[CharacterPool] Initialized');
  }

  /**
   * FIXED: Acquire character instance from pool
   */
  acquire(characterType: string, config: CharacterConfig): CharacterInstance | null {
    try {
      // Check if we have a pooled instance
      const pool = this.pools.get(characterType) || [];
      if (pool.length > 0) {
        const instance = pool.pop()!;
        this.activeInstances.set(instance.id, instance);
        
        Logger.debug(LogCategory.CORE, `[CharacterPool] Acquired ${characterType} from pool (${pool.length} remaining)`);
        return instance;
      }

      // Create new instance if pool is empty
      const newInstance = this.createCharacterInstance(characterType, config);
      if (newInstance) {
        this.activeInstances.set(newInstance.id, newInstance);
        Logger.debug(LogCategory.CORE, `[CharacterPool] Created new ${characterType} instance`);
      }

      return newInstance;
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterPool] Failed to acquire ${characterType}:`, error);
      return null;
    }
  }

  /**
   * FIXED: Release character instance back to pool
   */
  release(instance: CharacterInstance): void {
    try {
      // Remove from active instances
      this.activeInstances.delete(instance.id);

      // Reset instance state
      this.resetInstance(instance);

      // Add to pool
      const pool = this.pools.get(instance.characterType) || [];
      if (pool.length < this.maxPoolSize) {
        pool.push(instance);
        this.pools.set(instance.characterType, pool);
        
        Logger.debug(LogCategory.CORE, `[CharacterPool] Released ${instance.characterType} to pool (${pool.length} total)`);
      } else {
        // Pool is full, dispose the instance
        this.disposeInstance(instance);
        Logger.debug(LogCategory.CORE, `[CharacterPool] Pool full, disposed ${instance.characterType}`);
      }
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterPool] Failed to release instance:`, error);
    }
  }

  /**
   * FIXED: Update LOD levels based on camera distance
   */
  updateLOD(cameraPosition: THREE.Vector3): void {
    for (const [, instance] of this.activeInstances) {
      if (instance.model) {
        const distance = cameraPosition.distanceTo(instance.model.position);
        const newLOD = this.calculateLODLevel(distance);
        
        if (newLOD !== instance.currentLOD) {
          this.setLODLevel(instance, newLOD);
        }
      }
    }
  }

  /**
   * FIXED: Calculate LOD level based on distance
   */
  private calculateLODLevel(distance: number): number {
    for (let i = 0; i < this.lodDistances.length; i++) {
      if (distance <= this.lodDistances[i]) {
        return i;
      }
    }
    return this.lodDistances.length - 1;
  }

  /**
   * FIXED: Set LOD level for character instance
   */
  private setLODLevel(instance: CharacterInstance, lodLevel: number): void {
    if (instance.currentLOD === lodLevel) {
      return;
    }

    // FIXED: Implement LOD switching logic
    // This would typically involve swapping models or adjusting detail levels
    instance.currentLOD = lodLevel;
    
    Logger.debug(LogCategory.CORE, `[CharacterPool] Set LOD ${lodLevel} for ${instance.characterType} (distance: ${this.lodDistances[lodLevel]}m)`);
  }

  /**
   * FIXED: Create new character instance
   */
  private createCharacterInstance(characterType: string, config: CharacterConfig): CharacterInstance | null {
    try {
      const instanceId = `character_${characterType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
             // FIXED: Create placeholder instance (actual model loading would happen here)
       const instance: CharacterInstance = {
         id: instanceId,
         characterType: characterType,
         config: config,
         model: new THREE.Object3D(), // Placeholder - would be loaded from asset manager
         mixer: undefined,
         actions: new Map(),
         currentLOD: 0,
         animationState: {
           currentAnimation: 'idle_a',
           previousAnimation: '',
           transitionTime: 0.2,
           loop: true,
           speed: 1.0,
           blendWeight: 1.0
         },
         isVisible: true,
         lastUpdate: performance.now()
       };

      return instance;
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterPool] Failed to create instance for ${characterType}:`, error);
      return null;
    }
  }

  /**
   * FIXED: Reset instance state for reuse
   */
  private resetInstance(instance: CharacterInstance): void {
    // Reset animation state
    instance.animationState = {
      currentAnimation: 'idle_a',
      previousAnimation: '',
      transitionTime: 0.2,
      loop: true,
      speed: 1.0,
      blendWeight: 1.0
    };

    // Reset visibility and position
    instance.isVisible = true;
    instance.currentLOD = 0;
    instance.lastUpdate = performance.now();

    // Stop all animations
    if (instance.mixer) {
      instance.mixer.stopAllAction();
    }

    // Reset model position
    if (instance.model) {
      instance.model.position.set(0, 0, 0);
      instance.model.rotation.set(0, 0, 0);
      instance.model.scale.set(1, 1, 1);
    }
  }

  /**
   * FIXED: Dispose instance completely
   */
  private disposeInstance(instance: CharacterInstance): void {
    try {
      // Stop animations
      if (instance.mixer) {
        instance.mixer.stopAllAction();
      }

      // Dispose model
      if (instance.model) {
        this.disposeObject3D(instance.model);
      }

      // Clear actions
      instance.actions.clear();

      Logger.debug(LogCategory.CORE, `[CharacterPool] Disposed ${instance.characterType} instance`);
    } catch (error) {
      Logger.error(LogCategory.CORE, `[CharacterPool] Failed to dispose instance:`, error);
    }
  }

  /**
   * FIXED: Dispose Three.js object recursively
   */
  private disposeObject3D(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => material.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
  }

  /**
   * FIXED: Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * FIXED: Cleanup unused instances
   */
  private cleanup(): void {
    const now = performance.now();
    const timeSinceLastCleanup = now - this.lastCleanupTime;
    
    if (timeSinceLastCleanup < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanupTime = now;
    let disposedCount = 0;

         // Cleanup pools that are too large
     for (const [, pool] of this.pools) {
       if (pool.length > this.maxPoolSize / 2) {
         const excess = pool.length - this.maxPoolSize / 2;
         for (let i = 0; i < excess; i++) {
           const instance = pool.pop();
           if (instance) {
             this.disposeInstance(instance);
             disposedCount++;
           }
         }
       }
     }

    if (disposedCount > 0) {
      Logger.info(LogCategory.CORE, `[CharacterPool] Cleanup disposed ${disposedCount} instances`);
    }
  }

  /**
   * FIXED: Get pool statistics
   */
  getStats(): any {
    const stats: any = {
      totalActive: this.activeInstances.size,
      totalPooled: 0,
      pools: {}
    };

    for (const [characterType, pool] of this.pools) {
      stats.totalPooled += pool.length;
      stats.pools[characterType] = pool.length;
    }

    return stats;
  }

  /**
   * FIXED: Dispose all instances
   */
  dispose(): void {
    // Clear active instances
    for (const [, instance] of this.activeInstances) {
      this.disposeInstance(instance);
    }
    this.activeInstances.clear();

    // Clear pools
    for (const [, pool] of this.pools) {
      for (const instance of pool) {
        this.disposeInstance(instance);
      }
    }
    this.pools.clear();

    // Clear cleanup timer
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    Logger.info(LogCategory.CORE, '[CharacterPool] Disposed all instances');
  }
} 