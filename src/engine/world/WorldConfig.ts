import * as THREE from 'three';

export interface Size {
    width: number;
    height: number;
}

export interface ScaleRange {
    min: number;
    max: number;
}

export interface RotationRange {
    min: number;
    max: number;
}

export interface HeightRange {
    min: number;
    max: number;
}

export interface LODConfig {
    enabled: boolean;
    levels: {
        distance: number;
        geometryReduction: number;
    }[];
}

export interface ChunkConfig {
    enabled: boolean;
    size: number;
    viewDistance: number;  // Number of chunks to load in each direction
    loadingStrategy: 'immediate' | 'progressive';  // Progressive loading for better performance
    unloadDistance: number;  // Distance in chunks before unloading
}

export interface InstanceConfig {
    enabled: boolean;
    threshold: number;
    maxInstancesPerBatch: number;
    batchByMaterial: boolean;
    batchSize?: number;
}

export interface BiomeBlendConfig {
    enabled: boolean;
    transitionDistance: number;  // Distance over which biomes blend
    heightBlendFactor: number;  // How strongly height differences are blended (0-1)
    vegetationBlending: boolean;  // Whether to blend vegetation between biomes
    noiseLevels: {  // Different noise levels for terrain generation
        scale: number;
        weight: number;
    }[];
}

export interface ObjectSpawnRule {
    type: string;
    minCount: number;
    maxCount: number;
    minDistance: number;
    scaleRange: ScaleRange;
    rotationRange?: RotationRange;
    spawnProbability?: number;
    heightRange?: HeightRange;
    constraints?: PlacementConstraint[];
    lod?: LODConfig;  // Optional per-object LOD settings
    instancing?: {    // Optional per-object instancing settings
        enabled: boolean;
        batchSize?: number;
    };
}

export interface PlacementConstraint {
    type: 'height' | 'slope' | 'distance' | 'density';
    comparison: 'less' | 'greater' | 'equal' | 'between';
    value?: number;
    range?: HeightRange;
    target?: string;
}

export interface BiomeConfig {
    id: string;
    size: Size;
    baseHeight: number;
    heightVariation: number;
    objects: ObjectSpawnRule[];
    blendSettings?: {  // Optional per-biome blend settings
        transitionDistance?: number;
        heightBlendFactor?: number;
    };
}

export interface WorldConfig {
    size: Size;
    resolution: number;
    heightScale: number;
    noiseScale: number;
    biomes: BiomeConfig[];
    globalObjects?: ObjectSpawnRule[];
    terrain: {
        material: THREE.Material;
        heightOffset?: number;
        heightMapResolution: number;
        minHeight: number;
        maxHeight: number;
        smoothingPasses: number;
    };
    performance: {
        lod: LODConfig;
        chunking: ChunkConfig;
        instancing: InstanceConfig;
    };
    biomeBlending: BiomeBlendConfig;
    lighting: {
        ambient: { color: number, intensity: number },
        directional: { color: number, intensity: number, position: [number, number, number] }
    };
    debug?: {
        showChunkBoundaries: boolean;
        showLODLevels: boolean;
        showBiomeTransitions: boolean;
        logPerformanceMetrics: boolean;
    };
}

// ... existing code ...