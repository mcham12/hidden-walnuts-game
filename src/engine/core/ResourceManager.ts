import { Logger } from './Logger';
import { EventSystem } from './EventSystem';
import { ObjectPool } from './ObjectPool';

interface Resource {
    id: string;
    type: string;
    data: any;
    lastUsed: number;
    refCount: number;
}

export interface ResourceConfig {
    maxCacheSize: number;      // Maximum number of resources to keep in cache
    cleanupInterval: number;   // Interval in ms to check for unused resources
    maxAge: number;           // Maximum age in ms before resource is considered for cleanup
}

export class ResourceManager {
    private static instance: ResourceManager;
    private resources: Map<string, Resource>;
    private pools: Map<string, ObjectPool<any>>;
    private logger: Logger;
    private eventSystem: EventSystem;
    private config: ResourceConfig;
    private cleanupTimer: number | null;

    private constructor(config: Partial<ResourceConfig> = {}) {
        this.resources = new Map();
        this.pools = new Map();
        this.logger = Logger.getInstance();
        this.eventSystem = new EventSystem();
        
        this.config = {
            maxCacheSize: config.maxCacheSize ?? 1000,
            cleanupInterval: config.cleanupInterval ?? 60000, // 1 minute
            maxAge: config.maxAge ?? 300000 // 5 minutes
        };

        this.cleanupTimer = null;
    }

    static getInstance(config?: Partial<ResourceConfig>): ResourceManager {
        if (!ResourceManager.instance) {
            ResourceManager.instance = new ResourceManager(config);
        }
        return ResourceManager.instance;
    }

    initialize(): void {
        this.startCleanupTimer();
        this.logger.info('Resource manager initialized');
    }

    private startCleanupTimer(): void {
        if (this.cleanupTimer !== null) {
            return;
        }

        this.cleanupTimer = window.setInterval(() => {
            this.cleanupUnusedResources();
        }, this.config.cleanupInterval);
    }

    async load<T>(id: string, type: string, loader: () => Promise<T>): Promise<T> {
        // Check if resource is already loaded
        const existing = this.resources.get(id);
        if (existing) {
            existing.lastUsed = Date.now();
            existing.refCount++;
            return existing.data as T;
        }

        try {
            // Load the resource
            const data = await loader();
            
            // Store in cache
            this.resources.set(id, {
                id,
                type,
                data,
                lastUsed: Date.now(),
                refCount: 1
            });

            this.eventSystem.emit('resourceLoaded', { id, type });
            return data;
        } catch (error) {
            this.logger.error(`Failed to load resource ${id}:`, error as Error);
            throw error;
        }
    }

    release(id: string): void {
        const resource = this.resources.get(id);
        if (!resource) {
            return;
        }

        resource.refCount--;
        if (resource.refCount <= 0) {
            this.unload(id);
        }
    }

    private unload(id: string): void {
        const resource = this.resources.get(id);
        if (!resource) {
            return;
        }

        // Dispose of the resource if it has a dispose method
        if (typeof resource.data.dispose === 'function') {
            resource.data.dispose();
        }

        this.resources.delete(id);
        this.eventSystem.emit('resourceUnloaded', { id, type: resource.type });
    }

    createPool<T>(
        type: string, 
        factory: () => T, 
        reset: (item: T) => void, 
        initialSize: number = 0
    ): ObjectPool<T> {
        if (this.pools.has(type)) {
            return this.pools.get(type)!;
        }

        const pool = new ObjectPool<T>(factory, reset, initialSize);
        this.pools.set(type, pool);
        return pool;
    }

    getPool<T>(type: string): ObjectPool<T> | undefined {
        return this.pools.get(type);
    }

    private cleanupUnusedResources(): void {
        const now = Date.now();
        let removed = 0;

        // Check if we're over the cache size limit
        if (this.resources.size > this.config.maxCacheSize) {
            // Sort resources by last used time
            const sortedResources = Array.from(this.resources.values())
                .sort((a, b) => a.lastUsed - b.lastUsed);

            // Remove oldest resources until we're under the limit
            while (this.resources.size > this.config.maxCacheSize) {
                const oldest = sortedResources.shift();
                if (oldest && oldest.refCount <= 0) {
                    this.unload(oldest.id);
                    removed++;
                }
            }
        }

        // Clean up old resources
        for (const [id, resource] of this.resources) {
            if (resource.refCount <= 0 && 
                now - resource.lastUsed > this.config.maxAge) {
                this.unload(id);
                removed++;
            }
        }

        if (removed > 0) {
            this.logger.debug(`Cleaned up ${removed} unused resources`);
        }
    }

    getStats(): { cached: number; pools: number } {
        return {
            cached: this.resources.size,
            pools: this.pools.size
        };
    }

    cleanup(): void {
        if (this.cleanupTimer !== null) {
            window.clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        // Clean up all resources
        for (const [id, resource] of this.resources) {
            this.unload(id);
        }

        // Clean up all pools
        for (const pool of this.pools.values()) {
            pool.clear();
        }
        this.pools.clear();

        this.logger.info('Resource manager cleaned up');
    }
} 