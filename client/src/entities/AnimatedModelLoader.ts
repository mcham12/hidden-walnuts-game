import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Logger, LogCategory } from '../core/Logger';
import { CharacterRegistry } from '../core/CharacterRegistry';
import { CharacterConfig } from '../types/CharacterTypes';
import { 
  AnimatedModel, 
  AnimationLoadingOptions, 
  AnimationValidationResult, 
  AnimationCacheEntry 
} from '../types/AnimationTypes';

/**
 * AnimatedModelLoader
 * Specialized loader for animated GLB models with character support
 */
export class AnimatedModelLoader {
  private cache = new Map<string, AnimationCacheEntry>();
  private gltfLoader: GLTFLoader;
  private characterRegistry: CharacterRegistry;
  private maxCacheSize: number = 50; // Maximum number of cached models
  private totalCacheMemory: number = 0;
  private maxCacheMemory: number = 100 * 1024 * 1024; // 100MB max cache

  constructor(characterRegistry: CharacterRegistry) {
    this.characterRegistry = characterRegistry;
    this.gltfLoader = new GLTFLoader();
    
    Logger.info(LogCategory.CORE, '[AnimatedModelLoader] Initialized with character registry');
  }

  /**
   * Load a model with animations for a specific character type
   */
  async loadCharacterModel(
    characterType: string, 
    options: Partial<AnimationLoadingOptions> = {}
  ): Promise<AnimatedModel> {
    const characterConfig = this.characterRegistry.getCharacter(characterType);
    if (!characterConfig) {
      throw new Error(`Character type '${characterType}' not found in registry`);
    }

    const lodLevel = options.lodLevel ?? 0;
    const modelPath = this.getModelPath(characterConfig, lodLevel);
    
    return this.loadModel(modelPath, characterType, {
      ...options,
      lodLevel,
      characterType
    });
  }

  /**
   * Load a model from a specific path
   */
  async loadModel(
    path: string, 
    characterType: string, 
    options: Partial<AnimationLoadingOptions> = {}
  ): Promise<AnimatedModel> {
    const cacheKey = this.getCacheKey(path, characterType, options.lodLevel ?? 0);
    
    // Check cache first
    if (options.enableCaching !== false && this.cache.has(cacheKey)) {
      const cacheEntry = this.cache.get(cacheKey)!;
      cacheEntry.lastAccessed = Date.now();
      cacheEntry.accessCount++;
      
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading from cache: ${cacheKey}`);
      return cacheEntry.animatedModel;
    }

    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading model: ${path}`);
    
    try {
      // Load the GLTF model
      const gltf = await this.loadGLTF(path);
      
      // Get character configuration
      const characterConfig = this.characterRegistry.getCharacter(characterType);
      if (!characterConfig) {
        throw new Error(`Character type '${characterType}' not found`);
      }

      // Create animated model
      const animatedModel = await this.createAnimatedModel(
        gltf, 
        characterConfig, 
        options.lodLevel ?? 0
      );

      // Validate model if requested
      if (options.validateModel !== false) {
        const validation = this.validateAnimatedModel(animatedModel);
        if (!validation.isValid) {
          Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Model validation failed for ${path}:`, validation.errors);
        }
      }

      // Cache the model
      if (options.enableCaching !== false) {
        this.cacheModel(cacheKey, path, characterType, animatedModel, options.lodLevel ?? 0);
      }

      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Successfully loaded model: ${path}`);
      return animatedModel;
      
    } catch (error) {
      Logger.error(LogCategory.CORE, `[AnimatedModelLoader] Failed to load model: ${path}`, error);
      throw error;
    }
  }

  /**
   * Load LOD model for a character
   */
  async loadLODModel(characterType: string, lodLevel: number): Promise<AnimatedModel> {
    const characterConfig = this.characterRegistry.getCharacter(characterType);
    if (!characterConfig) {
      throw new Error(`Character type '${characterType}' not found in registry`);
    }

    const modelPath = this.getModelPath(characterConfig, lodLevel);
    return this.loadModel(modelPath, characterType, { lodLevel });
  }

  /**
   * Preload models for a character (all LOD levels)
   */
  async preloadCharacterModels(characterType: string): Promise<AnimatedModel[]> {
    const characterConfig = this.characterRegistry.getCharacter(characterType);
    if (!characterConfig) {
      throw new Error(`Character type '${characterType}' not found in registry`);
    }

    const models: AnimatedModel[] = [];
    
    // Load all LOD levels
    const lodLevels = [0, 1, 2, 3];
    for (const lodLevel of lodLevels) {
      try {
        const model = await this.loadLODModel(characterType, lodLevel);
        models.push(model);
      } catch (error) {
        Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Failed to preload LOD${lodLevel} for ${characterType}`, error);
      }
    }

    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Preloaded ${models.length} models for ${characterType}`);
    return models;
  }

  /**
   * Get cached model if available
   */
  getCachedModel(characterType: string, lodLevel: number = 0): AnimatedModel | null {
    const characterConfig = this.characterRegistry.getCharacter(characterType);
    if (!characterConfig) return null;

    const modelPath = this.getModelPath(characterConfig, lodLevel);
    const cacheKey = this.getCacheKey(modelPath, characterType, lodLevel);
    
    const cacheEntry = this.cache.get(cacheKey);
    if (cacheEntry) {
      cacheEntry.lastAccessed = Date.now();
      cacheEntry.accessCount++;
      return cacheEntry.animatedModel;
    }

    return null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.totalCacheMemory = 0;
    Logger.info(LogCategory.CORE, '[AnimatedModelLoader] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    entries: number;
    memoryUsed: number;
    hitRate: number;
  } {
    let totalAccesses = 0;
    let totalHits = 0;

    this.cache.forEach(entry => {
      totalAccesses += entry.accessCount;
      if (entry.accessCount > 1) {
        totalHits += entry.accessCount - 1; // First access is always a miss
      }
    });

    return {
      entries: this.cache.size,
      memoryUsed: this.totalCacheMemory,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0
    };
  }

  /**
   * Private methods
   */
  /**
   * Load GLTF model from path
   */
  private async loadGLTF(path: string): Promise<any> {
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading GLTF from: ${path}`);
    
    try {
      const gltf = await new Promise<any>((resolve, reject) => {
        this.gltfLoader.load(
          path,
          (gltf) => {
            Logger.info(LogCategory.CORE, `[AnimatedModelLoader] GLTF loaded successfully: ${path}`);
            Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Scene children: ${gltf.scene?.children?.length || 0}`);
            Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Animations: ${gltf.animations?.length || 0}`);
            resolve(gltf);
          },
          (progress) => {
            Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading progress: ${(progress.loaded / progress.total * 100).toFixed(1)}%`);
          },
          (error) => {
            Logger.error(LogCategory.CORE, `[AnimatedModelLoader] Failed to load GLTF: ${path}`, error);
            reject(error);
          }
        );
      });
      
      if (!gltf || !gltf.scene) {
        throw new Error(`Invalid GLTF data: ${path}`);
      }
      
      return gltf;
    } catch (error) {
      Logger.error(LogCategory.CORE, `[AnimatedModelLoader] GLTF loading failed: ${path}`, error);
      throw error;
    }
  }

  private async loadGLTFWithAnimations(path: string): Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          resolve({
            scene: gltf.scene,
            animations: gltf.animations || []
          });
        },
        (progress) => {
          // Reduced logging frequency to prevent spam
          if (progress.loaded === progress.total) {
            Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading progress: ${path}`, progress);
          }
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private async createAnimatedModel(
    gltf: any, 
    characterConfig: CharacterConfig, 
    lodLevel: number
  ): Promise<AnimatedModel> {
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Creating animated model for ${characterConfig.name}`);
    
    // Get the model from the GLTF scene
    const model = gltf.scene.clone();
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Model cloned successfully`);
    
    // Apply character scaling
    this.applyCharacterScale(model, characterConfig.scale);
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Scale applied: ${characterConfig.scale}`);

    // Extract animation data from main model
    const animations = this.extractAnimationData(model);
    const blendshapes = this.extractBlendshapeData(model);
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Extracted ${animations.size} animations and ${blendshapes.size} blendshapes`);

    // Create animation mixer
    const mixer = this.createAnimationMixer(model);
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Animation mixer created`);

    // Load animations from separate files
    await this.loadCharacterAnimations(model, characterConfig, animations);
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Character animations loaded`);

    // Create animated model
    const animatedModel: AnimatedModel = {
      model: model,
      mixer: mixer,
      animations: animations,
      blendshapes: blendshapes,
      characterType: characterConfig.id,
      config: characterConfig,
      lodLevel: lodLevel,
      isLoaded: true,
      isValid: true
    };

    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Animated model created successfully for ${characterConfig.name}`);
    return animatedModel;
  }

  private extractAnimationData(model: THREE.Object3D): Map<string, THREE.AnimationClip> {
    const animations = new Map<string, THREE.AnimationClip>();
    
    if (model.animations && model.animations.length > 0) {
      model.animations.forEach((clip: THREE.AnimationClip) => {
        animations.set(clip.name, clip);
      });
    }

    return animations;
  }

  /**
   * Load and attach animations to the character model
   */
  private async loadCharacterAnimations(
    model: THREE.Object3D, 
    characterConfig: CharacterConfig, 
    animations: Map<string, THREE.AnimationClip>
  ): Promise<void> {
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading animations for ${characterConfig.name} (${Object.keys(characterConfig.animations).length} animations)`);
    
    const animationPromises: Promise<void>[] = [];
    const animationEntries = Object.entries(characterConfig.animations);
    
    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Animation files to load for ${characterConfig.name}:`);
    animationEntries.forEach(([name, path]) => {
      Logger.info(LogCategory.CORE, `  - ${name}: ${path}`);
    });
    
    // Load each animation file
    for (const [animationName, animationPath] of animationEntries) {
      const promise = this.loadSingleAnimation(model, animationName, animationPath, animations);
      animationPromises.push(promise);
    }
    
    try {
      await Promise.all(animationPromises);
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loaded ${animationPromises.length} animations for ${characterConfig.name}`);
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Final animation count for ${characterConfig.name}: ${model.animations.length} animations, ${animations.size} actions`);
    } catch (error) {
      Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Some animations failed to load for ${characterConfig.name}:`, error);
    }
  }

  /**
   * Load a single animation and attach it to the model
   */
  private async loadSingleAnimation(
    model: THREE.Object3D, 
    animationName: string, 
    animationPath: string,
    animations: Map<string, THREE.AnimationClip>
  ): Promise<void> {
    try {
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Loading animation ${animationName} from: ${animationPath}`);
      const gltfData = await this.loadGLTFWithAnimations(animationPath);
      
      if (!gltfData) {
        Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Failed to load GLTF from: ${animationPath}`);
        return;
      }
      
      if (!gltfData.animations) {
        Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] No animations array in GLTF from: ${animationPath}`);
        return;
      }
      
      if (gltfData.animations.length === 0) {
        Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Empty animations array in GLTF from: ${animationPath}`);
        return;
      }
      
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Found ${gltfData.animations.length} animations in: ${animationPath}`);
      
      // Add animations to the model and create actions
      gltfData.animations.forEach((clip: THREE.AnimationClip, index: number) => {
        // Rename the clip to match the expected name
        clip.name = animationName;
        model.animations.push(clip);
        
        // Add to animations map
        animations.set(animationName, clip);
        
      });
      
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Successfully loaded animation: ${animationName}`);
    } catch (error) {
      Logger.error(LogCategory.CORE, `[AnimatedModelLoader] Failed to load animation ${animationName} from ${animationPath}:`, error);
    }
  }

  private extractBlendshapeData(model: THREE.Object3D): Map<string, THREE.MorphTarget> {
    const blendshapes = new Map<string, THREE.MorphTarget>();
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        Object.keys(child.morphTargetDictionary).forEach((name) => {
          // Create a reference to the morph target
          const morphTarget = {
            name: name,
            vertices: child.geometry.morphAttributes.position || []
          };
          blendshapes.set(name, morphTarget as THREE.MorphTarget);
        });
      }
    });

    return blendshapes;
  }

  private createAnimationMixer(model: THREE.Object3D): THREE.AnimationMixer {
    return new THREE.AnimationMixer(model);
  }

  private applyCharacterScale(model: THREE.Object3D, scale: number): void {
    // Apply scale to the main model
    model.scale.set(scale, scale, scale);
    
    // Also apply scale to all children to ensure consistency
    model.traverse((child) => {
      if (child !== model) {
        child.scale.set(scale, scale, scale);
      }
    });
    
    // Validate scale was applied correctly
    const actualScale = model.scale;
    if (Math.abs(actualScale.x - scale) > 0.01 || 
        Math.abs(actualScale.y - scale) > 0.01 || 
        Math.abs(actualScale.z - scale) > 0.01) {
      Logger.warn(LogCategory.CORE, `[AnimatedModelLoader] Scale validation failed: expected=${scale}, actual=${actualScale.x.toFixed(2)},${actualScale.y.toFixed(2)},${actualScale.z.toFixed(2)}`);
      // Force correct scale
      model.scale.set(scale, scale, scale);
    } else {
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Scale applied correctly: ${actualScale.x.toFixed(2)}, ${actualScale.y.toFixed(2)}, ${actualScale.z.toFixed(2)}`);
    }
  }

  private getModelPath(characterConfig: CharacterConfig, lodLevel: number): string {
    const lodPaths = characterConfig.lodPaths;
    
    switch (lodLevel) {
      case 0:
        return lodPaths.lod0;
      case 1:
        return lodPaths.lod1;
      case 2:
        return lodPaths.lod2;
      case 3:
        return lodPaths.lod3;
      default:
        throw new Error(`LOD level ${lodLevel} not supported for character ${characterConfig.id}`);
    }
  }

  private getCacheKey(path: string, characterType: string, lodLevel: number): string {
    return `${characterType}_${lodLevel}_${path}`;
  }

  private cacheModel(
    cacheKey: string, 
    path: string, 
    characterType: string, 
    animatedModel: AnimatedModel, 
    lodLevel: number
  ): void {
    // Estimate memory usage
    const memorySize = this.estimateModelMemorySize(animatedModel);
    
    // Check if adding this model would exceed cache limits
    if (this.cache.size >= this.maxCacheSize || 
        this.totalCacheMemory + memorySize > this.maxCacheMemory) {
      this.evictOldestCacheEntry();
    }

    // Create cache entry
    const cacheEntry: AnimationCacheEntry = {
      path: path,
      characterType: characterType,
      lodLevel: lodLevel,
      animatedModel: animatedModel,
      lastAccessed: Date.now(),
      accessCount: 1,
      memorySize: memorySize
    };

    this.cache.set(cacheKey, cacheEntry);
    this.totalCacheMemory += memorySize;

    Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Cached model: ${cacheKey} (${memorySize} bytes)`);
  }

  private evictOldestCacheEntry(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    this.cache.forEach((entry, key) => {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    });

    if (oldestKey) {
      const entry = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.totalCacheMemory -= entry.memorySize;
      
      Logger.info(LogCategory.CORE, `[AnimatedModelLoader] Evicted cache entry: ${oldestKey}`);
    }
  }

  private estimateModelMemorySize(animatedModel: AnimatedModel): number {
    // Rough estimation - in a real app you'd calculate this more precisely
    let size = 0;
    
    // Model geometry estimation
    animatedModel.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geometry = child.geometry;
        if (geometry.attributes.position) {
          size += geometry.attributes.position.count * 3 * 4; // 3 floats per vertex
        }
        if (geometry.attributes.normal) {
          size += geometry.attributes.normal.count * 3 * 4;
        }
        if (geometry.attributes.uv) {
          size += geometry.attributes.uv.count * 2 * 4;
        }
      }
    });

    // Animation data estimation
    animatedModel.animations.forEach((clip) => {
      clip.tracks.forEach((track) => {
        size += track.times.length * 4; // Time array
        size += track.values.length * 4; // Value array
      });
    });

    return size;
  }

  private validateAnimatedModel(animatedModel: AnimatedModel): AnimationValidationResult {
    const result: AnimationValidationResult = {
      isValid: true,
      hasRequiredAnimations: false,
      hasValidBones: false,
      hasValidMixer: false,
      missingAnimations: [],
      warnings: [],
      errors: []
    };

    // Check if model has animations
    if (animatedModel.animations.size === 0) {
      result.warnings.push('No animations found in model');
    } else {
      result.hasRequiredAnimations = true;
    }

    // Check if mixer is valid
    if (animatedModel.mixer) {
      result.hasValidMixer = true;
    } else {
      result.errors.push('Animation mixer is not valid');
      result.isValid = false;
    }

    // Check for bones/skeleton
    let hasBones = false;
    animatedModel.model.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        hasBones = true;
      }
    });

    if (hasBones) {
      result.hasValidBones = true;
    } else {
      result.warnings.push('No bones/skeleton found in model');
    }

    // Check for required animations based on character config
    const requiredAnimations = ['idle_a', 'walk', 'run'];
    const availableAnimations = Array.from(animatedModel.animations.keys());
    
    requiredAnimations.forEach(animName => {
      if (!availableAnimations.some(available => available.toLowerCase().includes(animName))) {
        result.missingAnimations.push(animName);
      }
    });

    if (result.missingAnimations.length > 0) {
      result.warnings.push(`Missing some recommended animations: ${result.missingAnimations.join(', ')}`);
    }

    return result;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clearCache();
    Logger.info(LogCategory.CORE, '[AnimatedModelLoader] Disposed');
  }
} 