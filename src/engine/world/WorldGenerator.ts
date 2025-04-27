import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise';
import { LOD } from 'three';
import { WorldConfig, ObjectSpawnRule, PlacementConstraint, BiomeConfig, LODConfig, InstanceConfig } from './WorldConfig';
import { Logger } from '../core/Logger';
import { ResourceManager } from '../core/ResourceManager';
import { AssetManager } from '../assets/AssetManager';
import { InstancedMesh, Matrix4, AnimationMixer, AnimationClip } from 'three';
import { Chunk } from './Chunk';

interface SpawnPoint {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: THREE.Vector3;
    type: string;
    biome?: string;
    animations?: AnimationClip[];
}

interface ObjectPool<T> {
    get(): T;
    release(item: T): void;
    clear(): void;
}

class Vector3Pool implements ObjectPool<THREE.Vector3> {
    private pool: THREE.Vector3[] = [];

    get(): THREE.Vector3 {
        return this.pool.pop() || new THREE.Vector3();
    }

    release(vector: THREE.Vector3): void {
        vector.set(0, 0, 0);
        this.pool.push(vector);
    }

    clear(): void {
        this.pool = [];
    }
}

interface LODLevel {
    distance: number;
    geometryReduction: number;
    object?: THREE.Object3D;
}

interface InstancedObjectGroup {
    mesh: THREE.InstancedMesh;
    count: number;
    maxInstances: number;
    matrices: THREE.Matrix4[];
}

interface BiomeTransition {
    from: string;
    to: string;
    blendDistance: number;
    heightBlendFactor: number;
}

interface BiomeInfluence {
    biome: BiomeConfig;
    weight: number;
}

interface AnimatedObject {
    object: THREE.Object3D;
    mixer: THREE.AnimationMixer;
}

interface TerrainCache {
    heightMap: Float32Array;
    biomeMap: Map<string, THREE.Vector2[]>;
    lastAccessed: number;
}

export class WorldGenerator {
    private config: WorldConfig;
    private noise: SimplexNoise;
    private heightMap: Float32Array;
    private biomeMap: Map<string, THREE.Vector2[]>;
    private logger: Logger;
    private resourceManager: ResourceManager;
    private scene: THREE.Scene;
    private assetManager: AssetManager;
    private objects: THREE.Object3D[] = [];
    private animatedObjects: AnimatedObject[] = [];
    private disposed: boolean = false;
    private vectorPool: Vector3Pool;
    private lodGroups: Map<string, THREE.LOD>;
    private lodLevels: LODLevel[];
    private chunks: Map<string, Chunk> = new Map();
    private chunkSize: number = 100; // Size of each chunk
    private loadedChunks: Set<string> = new Set();
    private instancedGroups: Map<string, InstancedObjectGroup> = new Map();
    private matrixPool: ObjectPool<THREE.Matrix4>;
    private biomeTransitions: BiomeTransition[];
    private debugHelpers: THREE.Object3D[] = [];
    private chunkLoadQueue: Chunk[] = [];
    private isProcessingQueue: boolean = false;
    private clock: THREE.Clock;
    private terrainCache: Map<string, TerrainCache>;
    private readonly MAX_CACHE_SIZE = 100;
    private readonly CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

    constructor(scene: THREE.Scene, config: WorldConfig, assetManager: AssetManager) {
        Logger.info('World config at startup:', config);
        this.scene = scene;
        this.config = config;
        this.assetManager = assetManager;
        this.noise = new SimplexNoise();
        this.heightMap = new Float32Array(
            config.terrain.heightMapResolution * config.terrain.heightMapResolution
        );
        this.biomeMap = new Map();
        this.logger = Logger.getInstance();
        this.resourceManager = ResourceManager.getInstance();
        this.objects = [];
        this.animatedObjects = [];
        this.disposed = false;
        this.vectorPool = new Vector3Pool();
        this.lodGroups = new Map();
        this.lodLevels = [
            { distance: 0, geometryReduction: 1 },    // Full detail
            { distance: 50, geometryReduction: 0.5 }, // Half detail
            { distance: 100, geometryReduction: 0.25 }, // Quarter detail
            { distance: 200, geometryReduction: 0.1 }  // Low detail
        ];
        this.chunks = new Map();
        this.loadedChunks = new Set();
        this.instancedGroups = new Map();
        this.matrixPool = new MatrixPool();
        this.biomeTransitions = this.generateBiomeTransitions();
        this.clock = new THREE.Clock();
        this.terrainCache = new Map();

        // Initialize based on config
        this.chunkSize = config.performance.chunking.size;
        
        // Initialize debug helpers if enabled
        if (config.debug?.showChunkBoundaries || 
            config.debug?.showLODLevels || 
            config.debug?.showBiomeTransitions) {
            this.initializeDebugHelpers();
        }

        // Start performance logging if enabled
        if (config.debug?.logPerformanceMetrics) {
            this.startPerformanceLogging();
        }

        // Start animation loop
        this.animate = this.animate.bind(this);
        this.animate();
    }

    private animate(): void {
        if (this.disposed) return;

        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();

        // Update all animation mixers
        for (const { mixer } of this.animatedObjects) {
            mixer.update(delta);
        }
    }

    async generate(): Promise<void> {
        Logger.info('Starting world generation');
        
        await this.generateTerrain();
        Logger.info('Terrain generated');
        
        await this.generateBiomes();
        Logger.info('Biomes generated');
        
        if (this.config.globalObjects) {
            await this.placeGlobalObjects();
            Logger.info('Global objects placed');
        }

        // Load initial chunks around origin
        const initialChunks = [
            [0, 0], [1, 0], [0, 1], [1, 1],
            [-1, 0], [0, -1], [-1, -1],
            [1, -1], [-1, 1]
        ];

        for (const [x, z] of initialChunks) {
            await this.loadChunk(x, z);
        }

        Logger.info('Initial chunks loaded');
    }

    private async generateTerrain(): Promise<void> {
        const { width, height: worldHeight } = this.config.size;
        const resolution = this.config.terrain.heightMapResolution;
        
        // Initialize heightmap with proper size
        this.heightMap = new Float32Array(resolution * resolution);
        
        // Force the heightmap to a constant value for a flat ground
        for (let i = 0; i < this.heightMap.length; i++) {
            this.heightMap[i] = 0.5; // Flat ground at y = 0.5 * heightScale
        }

        // Log min/max of heightMap
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < this.heightMap.length; i++) {
            if (this.heightMap[i] < min) min = this.heightMap[i];
            if (this.heightMap[i] > max) max = this.heightMap[i];
        }
        Logger.info('HeightMap min/max after generation:', { min, max });

        // Smooth the height map if configured
        for (let i = 0; i < this.config.terrain.smoothingPasses; i++) {
            this.smoothHeightMap();
        }

        // Create geometry with proper resolution
        const geometry = new THREE.PlaneGeometry(
            width,
            worldHeight,
            resolution - 1,
            resolution - 1
        );

        // Apply height map to geometry
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            const x = Math.floor(i / 3) % resolution;
            const y = Math.floor(i / (3 * resolution));
            
            // Get height from heightmap and scale it properly
            const height = this.heightMap[y * resolution + x];
            vertices[i + 1] = height * this.config.heightScale; // Y is up
        }

        // Update geometry and compute normals
        geometry.computeVertexNormals();
        geometry.attributes.position.needsUpdate = true;

        // Create terrain mesh
        const terrain = new THREE.Mesh(geometry, this.config.terrain.material);
        terrain.receiveShadow = true;

        // Add terrain to scene
        this.scene.add(terrain);

        // Add terrain to physics system as a heightfield
        const physicsSystem = this.scene.userData.physicsSystem;
        Logger.info('Physics system present:', !!physicsSystem);
        if (physicsSystem) {
            // Create a copy of heightmap scaled to actual world units
            const physicsHeightData = new Float32Array(this.heightMap.length);
            for (let i = 0; i < this.heightMap.length; i++) {
                physicsHeightData[i] = this.heightMap[i] * this.config.heightScale;
            }

            Logger.info('Calling addHeightfieldTerrain with:', {
                width,
                worldHeight,
                resolution,
                minHeight: 0,
                maxHeight: this.config.heightScale,
                position: terrain.position,
                heightDataSample: Array.from(physicsHeightData.slice(0, 10))
            });

            physicsSystem.addHeightfieldTerrain({
                heightData: physicsHeightData,
                width: width,
                height: worldHeight,
                resolution: resolution,
                minHeight: 0,
                maxHeight: this.config.heightScale,
                position: terrain.position
            });

            Logger.info('Added terrain heightfield to physics system:', {
                dimensions: { width, height: worldHeight },
                resolution,
                heightScale: this.config.heightScale,
                minMaxHeight: { min: 0, max: this.config.heightScale }
            });
        }
    }

    private smoothHeightMap(): void {
        const resolution = this.config.terrain.heightMapResolution;
        const smoothed = new Float32Array(this.heightMap.length);
        const kernel = [
            [1, 2, 1],
            [2, 4, 2],
            [1, 2, 1]
        ];
        const kernelSum = 16; // Sum of kernel values

        // First pass: apply Gaussian-like kernel
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                let sum = 0;
                let count = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const nx = x + kx;
                        const ny = y + ky;
                        if (nx >= 0 && nx < resolution && ny >= 0 && ny < resolution) {
                            const weight = kernel[ky + 1][kx + 1];
                            sum += this.heightMap[ny * resolution + nx] * weight;
                            count += weight;
                        }
                    }
                }

                smoothed[y * resolution + x] = sum / count;
            }
        }

        // Second pass: edge preservation
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const current = smoothed[y * resolution + x];
                let maxDiff = 0;

                // Check surrounding pixels for edges
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx >= 0 && nx < resolution && ny >= 0 && ny < resolution) {
                            const diff = Math.abs(current - smoothed[ny * resolution + nx]);
                            maxDiff = Math.max(maxDiff, diff);
                        }
                    }
                }

                // If this is an edge, preserve more of the original value
                if (maxDiff > 0.1) {
                    const original = this.heightMap[y * resolution + x];
                    smoothed[y * resolution + x] = original * 0.7 + current * 0.3;
                }
            }
        }

        this.heightMap = smoothed;
    }

    private async generateBiomes(): Promise<void> {
        for (const biome of this.config.biomes) {
            const biomePoints = this.generateBiomePoints(biome);
            this.biomeMap.set(biome.id, biomePoints);

            // Place biome-specific objects
            for (const objectRule of biome.objects) {
                Logger.info(`Processing biome object: ${objectRule.type}`);
                const spawnPoints = this.generateSpawnPoints(objectRule, biome);
                Logger.info(`Spawn points for ${objectRule.type}:`, spawnPoints);
                await this.placeObjects(spawnPoints, biome);
            }
        }
    }

    private generateBiomePoints(biome: BiomeConfig): THREE.Vector2[] {
        // Use Poisson disk sampling to generate biome regions
        // This is a simplified version - you might want to use a more sophisticated algorithm
        const points: THREE.Vector2[] = [];
        const { width, height } = this.config.size;
        const minDistance = Math.min(biome.size.width, biome.size.height) / 2;

        for (let i = 0; i < 100; i++) { // Max attempts
            const x = Math.random() * width - width / 2;
            const y = Math.random() * height - height / 2;
            const point = new THREE.Vector2(x, y);

            let valid = true;
            for (const existing of points) {
                if (existing.distanceTo(point) < minDistance) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                points.push(point);
            }
        }

        return points;
    }

    private generateSpawnPoints(rule: ObjectSpawnRule, biome?: BiomeConfig): SpawnPoint[] {
        // Test biome: always spawn at origin
        if (import.meta.env.VITE_USE_TEST_SCENE === 'true') {
            if (biome && biome.id === 'test') {
                return [{
                    position: new THREE.Vector3(0, 0, 0),
                    rotation: new THREE.Euler(0, 0, 0),
                    scale: new THREE.Vector3(1, 1, 1),
                    type: rule.type,
                    biome: biome.id
                }];
            }
            // For globalObjects, place squirrel at origin
            if (!biome && rule.type === 'squirrel.glb') {
                return [{
                    position: new THREE.Vector3(0, 0, 0),
                    rotation: new THREE.Euler(0, 0, 0),
                    scale: new THREE.Vector3(1, 1, 1),
                    type: rule.type
                }];
            }
        }

        const spawnPoints: SpawnPoint[] = [];
        const count = Math.floor(Math.random() * (rule.maxCount - rule.minCount + 1)) + rule.minCount;

        const attempts = count * 10;
        let placed = 0;

        for (let i = 0; i < attempts && placed < count; i++) {
            const point = this.generateRandomPoint(rule, biome);
            
            // Check biome influence at spawn point
            const influences = this.getBiomeInfluences(point.position);
            
            // Only place object if primary influence matches target biome
            const primaryInfluence = influences[0];
            if (!biome || (primaryInfluence && primaryInfluence.biome.id === biome.id)) {
                if (this.validateSpawnPoint(point, rule, spawnPoints)) {
                    spawnPoints.push(point);
                    placed++;
                }
            }
        }

        return spawnPoints;
    }

    private generateRandomPoint(rule: ObjectSpawnRule, biome?: BiomeConfig): SpawnPoint {
        const { width, height } = this.config.size;
        let x, y, z;

        // Test biome override: always place at origin for visibility
        if (biome && biome.id === 'test') {
            return {
                position: new THREE.Vector3(0, 0, 0),
                rotation: new THREE.Euler(0, 0, 0),
                scale: new THREE.Vector3(1, 1, 1),
                type: rule.type,
                biome: biome.id
            };
        }

        if (biome) {
            // Place within biome boundaries
            const biomeCenter = this.biomeMap.get(biome.id)?.[0] ?? new THREE.Vector2();
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (biome.size.width / 2);
            x = biomeCenter.x + Math.cos(angle) * distance;
            y = biomeCenter.y + Math.sin(angle) * distance;
        } else {
            // Place anywhere in world
            x = Math.random() * width - width / 2;
            y = Math.random() * height - height / 2;
        }

        // Get height from heightmap
        z = this.getHeightAt(x, y);

        // Apply height range if specified
        if (rule.heightRange) {
            z = Math.max(rule.heightRange.min, Math.min(rule.heightRange.max, z));
        }

        // Generate rotation
        const rotation = new THREE.Euler(
            0,
            rule.rotationRange ? 
                Math.random() * (rule.rotationRange.max - rule.rotationRange.min) + rule.rotationRange.min :
                Math.random() * Math.PI * 2,
            0
        );

        // Generate scale
        const scale = rule.scaleRange ?
            new THREE.Vector3(
                Math.random() * (rule.scaleRange.max - rule.scaleRange.min) + rule.scaleRange.min,
                Math.random() * (rule.scaleRange.max - rule.scaleRange.min) + rule.scaleRange.min,
                Math.random() * (rule.scaleRange.max - rule.scaleRange.min) + rule.scaleRange.min
            ) :
            new THREE.Vector3(1, 1, 1);

        return {
            position: new THREE.Vector3(x, z, y),
            rotation,
            scale,
            type: rule.type,
            biome: biome?.id
        };
    }

    private validateSpawnPoint(
        point: SpawnPoint,
        rule: ObjectSpawnRule,
        existingPoints: SpawnPoint[]
    ): boolean {
        // Check minimum distance from other objects of the same type
        for (const existing of existingPoints) {
            if (existing.type === point.type) {
                const distance = point.position.distanceTo(existing.position);
                if (distance < rule.minDistance) {
                    return false;
                }
            }
        }

        // Check constraints
        if (rule.constraints) {
            for (const constraint of rule.constraints) {
                if (!this.checkConstraint(point, constraint, existingPoints)) {
                    return false;
                }
            }
        }

        // Check spawn probability
        if (rule.spawnProbability && Math.random() > rule.spawnProbability) {
            return false;
        }

        return true;
    }

    private checkConstraint(
        point: SpawnPoint,
        constraint: PlacementConstraint,
        existingPoints: SpawnPoint[]
    ): boolean {
        switch (constraint.type) {
            case 'distance':
                if (constraint.target) {
                    // Check distance from target object type
                    const targetPoints = existingPoints.filter(p => p.type === constraint.target);
                    for (const target of targetPoints) {
                        const distance = point.position.distanceTo(target.position);
                        if (!this.compareValue(distance, constraint)) {
                            return false;
                        }
                    }
                }
                break;

            case 'height':
                // Check height constraints
                const height = point.position.y;
                if (!this.compareValue(height, constraint)) {
                    return false;
                }
                break;

            case 'slope':
                // Check terrain slope
                const slope = this.getSlope(point.position.x, point.position.z);
                if (!this.compareValue(slope, constraint)) {
                    return false;
                }
                break;

            case 'density':
                // Check object density in area
                const radius = 100; // Default radius for density check
                const nearbyObjects = existingPoints.filter(p => 
                    p.type === point.type && 
                    p.position.distanceTo(point.position) < radius
                );
                if (!this.compareValue(nearbyObjects.length, constraint)) {
                    return false;
                }
                break;
        }

        return true;
    }

    private compareValue(value: number, constraint: PlacementConstraint): boolean {
        const constraintValue = constraint.value as number;
        
        switch (constraint.comparison) {
            case 'less':
                return value < constraintValue;
            case 'greater':
                return value > constraintValue;
            case 'equal':
                return value === constraintValue;
            case 'between':
                const range = constraint.range!;
                return value >= range.min && value <= range.max;
            default:
                return false;
        }
    }

    private getHeightAt(x: number, z: number): number {
        const resolution = this.config.terrain.heightMapResolution;
        const { width, height } = this.config.size;

        // Convert world coordinates to heightmap coordinates
        const hx = Math.floor(((x + width / 2) / width) * (resolution - 1));
        const hz = Math.floor(((z + height / 2) / height) * (resolution - 1));

        // Clamp to valid indices
        const ix = Math.max(0, Math.min(resolution - 1, hx));
        const iz = Math.max(0, Math.min(resolution - 1, hz));

        // Get height and scale it
        const rawHeight = this.heightMap[iz * resolution + ix];
        const scaledHeight = rawHeight * this.config.heightScale;

        return scaledHeight;
    }

    private getSlope(x: number, z: number): number {
        const resolution = this.config.terrain.heightMapResolution;
        const { width, height } = this.config.size;
        const step = 1;

        const h1 = this.getHeightAt(x - step, z);
        const h2 = this.getHeightAt(x + step, z);
        const h3 = this.getHeightAt(x, z - step);
        const h4 = this.getHeightAt(x, z + step);

        const dx = (h2 - h1) / (2 * step);
        const dz = (h4 - h3) / (2 * step);

        return Math.atan(Math.sqrt(dx * dx + dz * dz)) * (180 / Math.PI);
    }

    private async createLODModel(model: THREE.Object3D, type: string): Promise<THREE.LOD | THREE.Object3D> {
        const config = this.findSpawnRule(type)?.lod || this.config.performance.lod;
        
        if (!config?.enabled) return model;

        const lod = new THREE.LOD();
        
        // Sort levels by distance to ensure proper LOD transitions
        const sortedLevels = [...config.levels].sort((a, b) => a.distance - b.distance);
        
        for (const level of sortedLevels) {
            const levelModel = model.clone();
            
            if (levelModel instanceof THREE.Mesh && level.geometryReduction < 1) {
                const originalGeometry = levelModel.geometry;
                if (originalGeometry instanceof THREE.BufferGeometry) {
                    const simplifiedGeometry = this.simplifyGeometry(originalGeometry, level.geometryReduction);
                    levelModel.geometry = simplifiedGeometry;
                }
            }
            
            lod.addLevel(levelModel, level.distance);

            if (this.config.debug?.showLODLevels) {
                this.addLODHelper(levelModel, level.distance);
            }
        }
        
        return lod;
    }

    private simplifyGeometry(geometry: THREE.BufferGeometry, reduction: number): THREE.BufferGeometry {
        // Simple geometry simplification by reducing vertex count
        const positions = geometry.getAttribute('position');
        const indices = geometry.getIndex();
        
        if (!positions || !indices) return geometry;
        
        const newPositions = new Float32Array(Math.floor(positions.array.length * reduction));
        const newIndices = new Uint16Array(Math.floor(indices.array.length * reduction));
        
        for (let i = 0; i < newPositions.length; i++) {
            newPositions[i] = positions.array[i];
        }
        
        for (let i = 0; i < newIndices.length; i++) {
            newIndices[i] = indices.array[i];
        }
        
        const simplified = new THREE.BufferGeometry();
        simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        simplified.setIndex(new THREE.BufferAttribute(newIndices, 1));
        simplified.computeVertexNormals();
        
        return simplified;
    }

    private addLODHelper(model: THREE.Object3D, distance: number): void {
        const boundingBox = new THREE.Box3().setFromObject(model);
        const size = boundingBox.getSize(new THREE.Vector3());
        const helper = new THREE.Box3Helper(boundingBox, new THREE.Color(0x00ff00));
        helper.position.copy(model.position);
        helper.scale.multiplyScalar(distance / 100); // Scale based on LOD distance
        this.debugHelpers.push(helper);
        this.scene.add(helper);
    }

    private getCollisionRadius(object: THREE.Object3D): number {
        // Calculate bounding box for the object
        const boundingBox = new THREE.Box3().setFromObject(object);
        const size = boundingBox.getSize(new THREE.Vector3());
        
        // Use the largest dimension (x, y, or z) as the radius
        // This ensures the collision sphere fully contains the object
        const maxDimension = Math.max(size.x, size.y, size.z);
        
        // Return half the max dimension as the radius
        // We use half because the bounding box gives us the full width/height/depth
        return maxDimension / 2;
    }

    private async placeObjects(spawnPoints: SpawnPoint[], biome?: BiomeConfig): Promise<void> {
        if (this.disposed) return;

        let placedCount = 0;
        for (const point of spawnPoints) {
            try {
                const gltf = await this.assetManager.loadModel(`/assets/models/${point.type}`);
                if (!gltf) continue;

                let instance: THREE.Object3D;
                
                // Use LOD if available, otherwise clone the model
                const existingLOD = this.lodGroups.get(point.type);
                if (existingLOD) {
                    instance = existingLOD.clone();
                } else {
                    const lodModel = await this.createLODModel(gltf, point.type);
                    instance = lodModel.clone();
                }

                // Ensure Y is set using getHeightAt(x, z)
                const y = this.getHeightAt(point.position.x, point.position.z);
                instance.position.set(point.position.x, y, point.position.z);
                instance.rotation.copy(point.rotation);
                instance.scale.copy(point.scale);

                // Calculate collision radius (linter fix: declare before use)
                const collisionRadius = this.getCollisionRadius(instance);

                // Add physics object for collision detection
                const physicsSystem = this.scene.userData.physicsSystem;
                if (physicsSystem) {
                    physicsSystem.addObject(instance, {
                        isStatic: true,
                        radius: collisionRadius
                    });
                }

                // Handle animations if present
                if (gltf.animations && gltf.animations.length > 0) {
                    const mixer = new THREE.AnimationMixer(instance);
                    gltf.animations.forEach(clip => {
                        const action = mixer.clipAction(clip);
                        action.time = Math.random() * clip.duration;
                        action.setLoop(THREE.LoopRepeat, Infinity);
                        action.setEffectiveTimeScale(0.8 + Math.random() * 0.4);
                        action.play();
                    });
                    this.animatedObjects.push({ object: instance, mixer });
                }

                this.scene.add(instance);
                this.objects.push(instance);
                placedCount++;
            } catch (error) {
                Logger.error(`Failed to place object ${point.type}:`, error as Error);
            }
        }
        if (placedCount > 0) {
            Logger.info(`Placed ${placedCount} objects.`);
        }
    }

    private async placeGlobalObjects(): Promise<void> {
        if (!this.config.globalObjects) return;
        
        for (const object of this.config.globalObjects) {
            if (object) {
                const spawnPoints = this.generateSpawnPoints(object);
                await this.placeObjects(spawnPoints, undefined);
            }
        }
    }

    private getChunkKey(x: number, z: number): string {
        return `${Math.floor(x / this.chunkSize)},${Math.floor(z / this.chunkSize)}`;
    }

    private getOrCreateChunk(x: number, z: number): Chunk {
        const key = this.getChunkKey(x, z);
        let chunk = this.chunks.get(key);
        
        if (!chunk) {
            const chunkX = Math.floor(x / this.chunkSize) * this.chunkSize;
            const chunkZ = Math.floor(z / this.chunkSize) * this.chunkSize;
            
            chunk = {
                x: chunkX,
                z: chunkZ,
                size: this.chunkSize,
                group: null,
                objects: [],
                instancedGroups: new Map(),
                isLoaded: false,
                bounds: new THREE.Box3(
                    new THREE.Vector3(chunkX, -Infinity, chunkZ),
                    new THREE.Vector3(chunkX + this.chunkSize, Infinity, chunkZ + this.chunkSize)
                )
            };
            this.chunks.set(key, chunk);
        }
        
        return chunk;
    }

    private async loadChunk(x: number, z: number): Promise<void> {
        const { size } = this.config.performance.chunking;
        const key = `${x},${z}`;

        if (this.chunks.has(key) || this.loadedChunks.has(key)) {
            return;
        }

        this.loadedChunks.add(key);
        const chunk = new Chunk(x * size, z * size, size);
        this.chunks.set(key, chunk);

        // Add chunk to load queue
        this.chunkLoadQueue.push(chunk);
        if (!this.isProcessingQueue) {
            await this.processChunkQueue();
        }
    }

    private async processChunkQueue(): Promise<void> {
        if (this.isProcessingQueue || this.chunkLoadQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.chunkLoadQueue.length > 0) {
            const chunk = this.chunkLoadQueue.shift();
            if (!chunk) continue;

            try {
                await this.generateChunkContent(chunk);
            } catch (error) {
                Logger.error(`Failed to generate chunk at (${chunk.x}, ${chunk.z}):`, error instanceof Error ? error : new Error(String(error)));
            }
        }

        this.isProcessingQueue = false;
    }

    private async generateChunkContent(chunk: Chunk): Promise<void> {
        const { size } = this.config.performance.chunking;
        const chunkGroup = new THREE.Group();
        chunkGroup.position.set(chunk.x, 0, chunk.z);

        // Generate terrain for chunk
        const terrain = await this.generateChunkTerrain(chunk);
        chunkGroup.add(terrain);

        // Place objects in chunk
        await this.placeChunkObjects(chunk, chunkGroup);

        this.scene.add(chunkGroup);
        chunk.group = chunkGroup;
    }

    private async generateChunkTerrain(chunk: Chunk): Promise<THREE.Mesh> {
        try {
            const { width, height: worldHeight } = this.config.size;
            const resolution = this.config.terrain.heightMapResolution;
            
            // Validate resolution
            if (resolution < 2) {
                throw new Error('Invalid heightmap resolution');
            }

            // Try to load from cache first
            let heightMap: Float32Array;
            let biomeMap: Map<string, THREE.Vector2[]>;
            
            try {
                const cached = await this.loadCachedTerrain(chunk.x, chunk.z);
                if (cached) {
                    heightMap = cached.heightMap;
                    biomeMap = cached.biomeMap;
                } else {
                    // Generate new terrain data
                    heightMap = new Float32Array(resolution * resolution);
                    biomeMap = new Map();

                    // Generate height map for chunk
                    for (let y = 0; y < resolution; y++) {
                        for (let x = 0; x < resolution; x++) {
                            const worldX = chunk.x + (x / resolution) * width;
                            const worldZ = chunk.z + (y / resolution) * worldHeight;
                            const position = new THREE.Vector3(worldX, 0, worldZ);
                            
                            // Get biome influences and calculate height
                            const influences = this.getBiomeInfluences(position);
                            const terrainHeight = this.getBlendedHeight(position, influences);
                            heightMap[y * resolution + x] = terrainHeight;
                        }
                    }

                    // Save to cache with error handling
                    try {
                        await this.saveTerrainToCache(chunk.x, chunk.z, heightMap, biomeMap);
                    } catch (error) {
                        Logger.warn('Failed to cache terrain:', error);
                    }
                }
            } catch (error) {
                Logger.error('Failed to generate terrain:', error);
                throw error;
            }

            // Create chunk geometry with proper error handling
            let geometry: THREE.PlaneGeometry;
            try {
                geometry = new THREE.PlaneGeometry(
                    width,
                    worldHeight,
                    resolution - 1,
                    resolution - 1
                );
            } catch (error) {
                Logger.error('Failed to create terrain geometry:', error);
                throw error;
            }

            // Apply height map to geometry
            const vertices = geometry.attributes.position.array;
            for (let i = 0; i < vertices.length; i += 3) {
                const x = Math.floor(i / 3) % resolution;
                const y = Math.floor(i / (3 * resolution));
                vertices[i + 1] = heightMap[y * resolution + x] * this.config.heightScale;
            }

            geometry.computeVertexNormals();
            geometry.attributes.position.needsUpdate = true;

            // Create chunk mesh
            const terrain = new THREE.Mesh(geometry, this.config.terrain.material);
            terrain.position.set(chunk.x, 0, chunk.z);
            terrain.receiveShadow = true;

            // Add chunk to physics system with error handling
            const physicsSystem = this.scene.userData.physicsSystem;
            if (physicsSystem) {
                try {
                    // Convert heightmap to 2D array for physics
                    const heightData: number[][] = [];
                    for (let y = 0; y < resolution; y++) {
                        const row: number[] = [];
                        for (let x = 0; x < resolution; x++) {
                            row.push(heightMap[y * resolution + x]);
                        }
                        heightData.push(row);
                    }

                    physicsSystem.addHeightfieldTerrain({
                        heightData,
                        width: width,
                        height: worldHeight,
                        resolution: resolution,
                        minHeight: 0,
                        maxHeight: this.config.heightScale,
                        position: terrain.position
                    });
                } catch (error) {
                    Logger.error('Failed to add terrain to physics system:', error);
                    // Continue without physics, but log the error
                }
            }

            return terrain;
        } catch (error) {
            Logger.error('Failed to generate chunk terrain:', error);
            throw error;
        }
    }

    private async placeChunkObjects(chunk: Chunk, chunkGroup: THREE.Group): Promise<void> {
        const { instancing } = this.config.performance;
        if (!instancing.enabled) {
            await this.placeObjects(this.generateChunkSpawnPoints(chunk), undefined);
            return;
        }

        const groupedPoints = new Map<string, SpawnPoint[]>();
        
        for (const point of this.generateChunkSpawnPoints(chunk)) {
            const points = groupedPoints.get(point.type) || [];
            points.push(point);
            groupedPoints.set(point.type, points);
        }

        for (const [type, points] of groupedPoints) {
            const instancingConfig = this.findSpawnRule(type)?.instancing || this.config.performance.instancing;
            if (instancingConfig?.enabled && points.length >= (instancingConfig as InstanceConfig).threshold) {
                await this.createInstancedGroup(chunk, type, points);
            } else {
                await this.placeObjects(points, undefined);
            }
        }
    }

    private findSpawnRule(type: string): ObjectSpawnRule | undefined {
        for (const biome of this.config.biomes) {
            const rule = biome.objects.find(obj => obj.type === type);
            if (rule) return rule;
        }
        return this.config.globalObjects?.find(obj => obj.type === type);
    }

    private async createInstancedGroup(chunk: Chunk, type: string, points: SpawnPoint[]): Promise<void> {
        const instancingConfig = this.findSpawnRule(type)?.instancing || this.config.performance.instancing;
        if (!instancingConfig?.enabled) {
            await this.placeObjects(points, undefined);
            return;
        }

        const model = await this.assetManager.loadModel(type);
        if (!model || !(model instanceof THREE.Mesh)) {
            Logger.error(`Failed to load model for instancing: ${type}`);
            return;
        }

        const instancedMesh = new THREE.InstancedMesh(
            model.geometry,
            model.material,
            points.length
        );

        const matrix = new THREE.Matrix4();
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const quaternion = new THREE.Quaternion().setFromEuler(point.rotation);
            matrix.compose(point.position, quaternion, point.scale);
            instancedMesh.setMatrixAt(i, matrix);
        }

        chunk.instancedGroups.set(type, instancedMesh);
        if (chunk.group) {
            chunk.group.add(instancedMesh);
        }
    }

    public updateChunks(cameraPosition: THREE.Vector3): void {
        const { size, viewDistance, unloadDistance } = this.config.performance.chunking;
        const chunkX = Math.floor(cameraPosition.x / size);
        const chunkZ = Math.floor(cameraPosition.z / size);

        // Unload distant chunks
        for (const [key, chunk] of this.chunks) {
            const [x, z] = key.split(',').map(Number);
            const distance = Math.max(
                Math.abs(x - chunkX),
                Math.abs(z - chunkZ)
            );

            if (distance > unloadDistance) {
                this.unloadChunk(key);
            }
        }

        // Load nearby chunks
        for (let x = chunkX - viewDistance; x <= chunkX + viewDistance; x++) {
            for (let z = chunkZ - viewDistance; z <= chunkZ + viewDistance; z++) {
                const key = `${x},${z}`;
                if (!this.chunks.has(key)) {
                    this.loadChunk(x, z);
                }
            }
        }

        this.updateDebugHelpers(cameraPosition);
    }

    private unloadChunk(key: string): void {
        const chunk = this.chunks.get(key);
        if (!chunk) return;

        // Remove and dispose regular objects
        for (const object of chunk.objects) {
            if (chunk.group) {
                chunk.group.remove(object);
            }
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
        chunk.objects = [];

        // Remove and dispose instanced objects
        for (const [type, instancedGroup] of chunk.instancedGroups) {
            if (chunk.group) {
                chunk.group.remove(instancedGroup);
            }
            instancedGroup.geometry.dispose();
            if (Array.isArray(instancedGroup.material)) {
                instancedGroup.material.forEach(m => m.dispose());
            } else {
                instancedGroup.material.dispose();
            }
        }
        chunk.instancedGroups.clear();

        // Remove chunk group
        if (chunk.group) {
            this.scene.remove(chunk.group);
            chunk.group = null;
        }

        chunk.isLoaded = false;
        this.loadedChunks.delete(key);
        this.chunks.delete(key);
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        // Clean up animations
        this.animatedObjects.forEach(({ mixer }) => mixer.stopAllAction());
        this.animatedObjects = [];

        // Clean up objects
        this.objects.forEach(object => {
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            this.scene.remove(object);
        });
        this.objects = [];

        // Clean up other resources
        this.vectorPool.clear();
        this.matrixPool.clear();
        this.lodGroups.clear();
        this.chunks.clear();
        this.loadedChunks.clear();
        this.instancedGroups.clear();
        this.debugHelpers.forEach(helper => this.scene.remove(helper));
        this.debugHelpers = [];
    }

    private generateBiomeTransitions(): BiomeTransition[] {
        const transitions: BiomeTransition[] = [];
        const biomes = this.config.biomes;

        // Generate transitions between all biome pairs
        for (let i = 0; i < biomes.length; i++) {
            for (let j = i + 1; j < biomes.length; j++) {
                transitions.push({
                    from: biomes[i].id,
                    to: biomes[j].id,
                    blendDistance: Math.min(biomes[i].size.width, biomes[j].size.width) * 0.2, // 20% of smaller biome size
                    heightBlendFactor: 0.5 // Equal blend by default
                });
            }
        }

        return transitions;
    }

    private getBiomeInfluences(position: THREE.Vector3): BiomeInfluence[] {
        const influences: BiomeInfluence[] = [];
        const biomePoints = Array.from(this.biomeMap.entries());

        // Calculate distances to all biome centers
        for (const [biomeId, points] of biomePoints) {
            const biome = this.config.biomes.find(b => b.id === biomeId);
            if (!biome) continue;

            // Find closest point for this biome
            let minDistance = Infinity;
            for (const point of points) {
                const distance = new THREE.Vector2(position.x, position.z).distanceTo(point);
                minDistance = Math.min(minDistance, distance);
            }

            // Calculate influence based on distance
            if (minDistance < biome.size.width) {
                const influence = 1 - (minDistance / biome.size.width);
                influences.push({
                    biome,
                    weight: Math.max(0, influence)
                });
            }
        }

        // Normalize weights
        const totalWeight = influences.reduce((sum, inf) => sum + inf.weight, 0);
        if (totalWeight > 0) {
            influences.forEach(inf => inf.weight /= totalWeight);
        }

        return influences;
    }

    private getBlendedHeight(position: THREE.Vector3, influences: BiomeInfluence[]): number {
        const { enabled, heightBlendFactor, noiseLevels } = this.config.biomeBlending;
        
        // Validate inputs
        if (!position || !influences) {
            Logger.warn('Invalid inputs to getBlendedHeight');
            return 0;
        }

        if (!enabled || influences.length === 0) {
            return influences.length === 0 ? 0 : this.calculateBiomeHeight(position, influences[0].biome);
        }

        // Validate and normalize weights
        let totalWeight = 0;
        for (const influence of influences) {
            if (!influence.biome || influence.weight < 0) {
                Logger.warn('Invalid biome influence');
                continue;
            }
            totalWeight += influence.weight;
        }

        if (totalWeight <= 0) {
            Logger.warn('No valid biome influences');
            return 0;
        }

        // Normalize weights
        for (const influence of influences) {
            influence.weight /= totalWeight;
        }

        let blendedHeight = 0;
        totalWeight = 0;

        // Calculate height for each influencing biome
        for (const influence of influences) {
            const biomeHeight = this.calculateBiomeHeight(position, influence.biome);
            const weight = influence.weight * (influence.biome.blendSettings?.heightBlendFactor ?? heightBlendFactor);
            
            // Apply smoothstep interpolation for better blending
            const smoothWeight = weight * weight * (3 - 2 * weight);
            blendedHeight += biomeHeight * smoothWeight;
            totalWeight += smoothWeight;
        }

        // Apply noise-based variation to the blend
        const nx = position.x * this.config.noiseScale;
        const nz = position.z * this.config.noiseScale;
        
        // Clamp noise values to prevent extreme variations
        const blendNoise = Math.max(-0.1, Math.min(0.1, this.noise.noise(nx, nz))) * 0.1;
        const finalHeight = totalWeight > 0 ? blendedHeight / totalWeight : 0;

        return finalHeight + blendNoise;
    }

    private calculateBiomeHeight(position: THREE.Vector3, biome: BiomeConfig): number {
        if (!position || !biome) {
            Logger.warn('Invalid inputs to calculateBiomeHeight');
            return 0;
        }

        const { noiseLevels } = this.config.biomeBlending;
        
        // Scale coordinates using noiseScale for proper terrain variation
        const nx = position.x * this.config.noiseScale;
        const nz = position.z * this.config.noiseScale;

        // Start with normalized base height (0 to 1 range)
        let height = biome.baseHeight / this.config.heightScale;
        
        // Validate biome height range
        if (height < 0 || height > 1) {
            Logger.warn('Invalid biome base height');
            height = Math.max(0, Math.min(1, height));
        }
        
        // Apply each noise level with proper scaling
        for (const level of noiseLevels) {
            if (!level || level.scale <= 0 || level.weight <= 0) {
                Logger.warn('Invalid noise level configuration');
                continue;
            }

            // Get noise value in range [-1, 1]
            const noiseValue = this.noise.noise(nx * level.scale, nz * level.scale);
            
            // Scale noise to [0, 1] range and apply height variation
            const heightContribution = ((noiseValue + 1) * 0.5) * 
                (biome.heightVariation / this.config.heightScale) * 
                level.weight;
            
            height += heightContribution;
        }

        // Ensure height stays within biome's range (normalized 0 to 1)
        const minHeight = (biome.baseHeight - biome.heightVariation) / this.config.heightScale;
        const maxHeight = (biome.baseHeight + biome.heightVariation) / this.config.heightScale;
        height = Math.max(minHeight, Math.min(maxHeight, height));

        return height;
    }

    private initializeDebugHelpers(): void {
        // Add debug visualization helpers
        const chunkMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const lodMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const biomeMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
        
        // ... create debug geometries and add to debugHelpers array
    }

    private updateDebugHelpers(cameraPosition: THREE.Vector3): void {
        if (!this.config.debug) return;

        this.debugHelpers.forEach(helper => {
            if (helper instanceof THREE.Box3Helper) {
                // Update LOD visualization
                if (this.config.debug?.showLODLevels) {
                    const distance = helper.position.distanceTo(cameraPosition);
                    const material = helper.material as THREE.LineBasicMaterial;
                    material.opacity = 1 - (distance / 200);
                    material.transparent = true;
                }
            }
        });

        // Update biome transition visualization
        if (this.config.debug?.showBiomeTransitions) {
            this.updateBiomeTransitionHelpers(cameraPosition);
        }
    }

    private updateBiomeTransitionHelpers(cameraPosition: THREE.Vector3): void {
        // Remove old transition helpers
        this.debugHelpers = this.debugHelpers.filter(helper => {
            if (helper.userData.isTransitionHelper) {
                this.scene.remove(helper);
                return false;
            }
            return true;
        });

        // Add new transition helpers
        const influences = this.getBiomeInfluences(cameraPosition);
        influences.forEach(influence => {
            const color = new THREE.Color(Math.random(), Math.random(), Math.random());
            const geometry = new THREE.CircleGeometry(
                influence.biome.size.width * influence.weight,
                32
            );
            const material = new THREE.LineBasicMaterial({ color });
            const circle = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                material
            );
            circle.rotation.x = -Math.PI / 2;
            circle.position.set(cameraPosition.x, 0, cameraPosition.z);
            circle.userData.isTransitionHelper = true;
            this.debugHelpers.push(circle);
            this.scene.add(circle);
        });
    }

    private startPerformanceLogging(): void {
        const logInterval = 1000; // Log every second
        setInterval(() => {
            const metrics = {
                activeChunks: this.loadedChunks.size,
                totalObjects: this.objects.length,
                instancedGroups: this.instancedGroups.size,
                memoryUsage: (performance as any).memory?.usedJSHeapSize || 'N/A'
            };
            Logger.info('Performance Metrics:', metrics);
        }, logInterval);
    }

    private generateChunkSpawnPoints(chunk: Chunk): SpawnPoint[] {
        const spawnPoints: SpawnPoint[] = [];

        // Generate spawn points only within chunk boundaries
        for (const biome of this.config.biomes) {
            for (const rule of biome.objects) {
                const chunkSpawnPoints = this.generateSpawnPoints(rule, biome).filter(point => 
                    chunk.bounds.containsPoint(point.position)
                );
                spawnPoints.push(...chunkSpawnPoints);
            }
        }

        return spawnPoints;
    }

    private getCacheKey(x: number, z: number): string {
        return `${Math.floor(x / this.chunkSize)},${Math.floor(z / this.chunkSize)}`;
    }

    private async loadCachedTerrain(x: number, z: number): Promise<TerrainCache | null> {
        const key = this.getCacheKey(x, z);
        const cached = this.terrainCache.get(key);

        if (cached) {
            cached.lastAccessed = Date.now();
            return cached;
        }

        return null;
    }

    private async saveTerrainToCache(x: number, z: number, heightMap: Float32Array, biomeMap: Map<string, THREE.Vector2[]>): Promise<void> {
        const key = this.getCacheKey(x, z);
        
        // Remove oldest cache entry if we're at capacity
        if (this.terrainCache.size >= this.MAX_CACHE_SIZE) {
            let oldestKey = '';
            let oldestTime = Date.now();
            
            for (const [cacheKey, cache] of this.terrainCache.entries()) {
                if (cache.lastAccessed < oldestTime) {
                    oldestTime = cache.lastAccessed;
                    oldestKey = cacheKey;
                }
            }
            
            if (oldestKey) {
                this.terrainCache.delete(oldestKey);
            }
        }

        this.terrainCache.set(key, {
            heightMap,
            biomeMap,
            lastAccessed: Date.now()
        });
    }

    private cleanupCache(): void {
        const now = Date.now();
        let totalSize = 0;

        // Remove expired entries
        for (const [key, cache] of this.terrainCache.entries()) {
            if (now - cache.lastAccessed > this.CACHE_EXPIRY_TIME) {
                this.terrainCache.delete(key);
            } else {
                totalSize += cache.heightMap.byteLength;
            }
        }

        // If still over size limit, remove oldest entries
        if (this.terrainCache.size > this.MAX_CACHE_SIZE) {
            const entries = Array.from(this.terrainCache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            while (this.terrainCache.size > this.MAX_CACHE_SIZE) {
                const [key] = entries.shift()!;
                this.terrainCache.delete(key);
            }
        }
    }

    public update(): void {
        this.cleanupCache();
    }
}

class MatrixPool implements ObjectPool<THREE.Matrix4> {
    private pool: THREE.Matrix4[] = [];

    get(): THREE.Matrix4 {
        return this.pool.pop() || new THREE.Matrix4();
    }

    release(matrix: THREE.Matrix4): void {
        matrix.identity();
        this.pool.push(matrix);
    }

    clear(): void {
        this.pool = [];
    }
} 