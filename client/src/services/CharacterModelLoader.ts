// Character Model Loader - Loads and manages character models and animations

import { CharacterRegistry, CharacterDefinition } from './CharacterRegistry';

export interface LoadedCharacter {
  id: string;
  model: any; // Three.js Group
  animations: Map<string, any>; // Three.js AnimationClip
  mixer: any; // Three.js AnimationMixer
  currentAction?: any; // Three.js AnimationAction
  isLoaded: boolean;
}

export class CharacterModelLoader {
  private loadedCharacters = new Map<string, LoadedCharacter>();
  private modelCache = new Map<string, any>();
  private animationCache = new Map<string, any>();
  private loadingPromises = new Map<string, Promise<LoadedCharacter>>();

  // Load character model and animations
  async loadCharacter(characterId: string): Promise<LoadedCharacter> {
    // Return if already loaded
    if (this.loadedCharacters.has(characterId)) {
      return this.loadedCharacters.get(characterId)!;
    }

    // Return existing loading promise if in progress
    if (this.loadingPromises.has(characterId)) {
      return this.loadingPromises.get(characterId)!;
    }

    // Start loading
    const loadingPromise = this.loadCharacterInternal(characterId);
    this.loadingPromises.set(characterId, loadingPromise);

    try {
      const loadedCharacter = await loadingPromise;
      this.loadedCharacters.set(characterId, loadedCharacter);
      this.loadingPromises.delete(characterId);
      return loadedCharacter;
    } catch (error) {
      this.loadingPromises.delete(characterId);
      throw error;
    }
  }

  // Internal loading implementation
  private async loadCharacterInternal(characterId: string): Promise<LoadedCharacter> {
    const characterDef = CharacterRegistry.getCharacterById(characterId);
    if (!characterDef) {
      throw new Error(`Character not found: ${characterId}`);
    }

    console.log(`Loading character: ${characterDef.name}`);

    try {
      // Load the main character model
      const model = await this.loadModel(characterDef.modelPath);
      if (!model) {
        throw new Error(`Failed to load model for character: ${characterId}`);
      }

      // Clone the model for this instance
      const characterModel = model.clone();
      characterModel.scale.setScalar(characterDef.scale);

      // Set up shadows
      characterModel.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Load animations
      const animations = new Map<string, any>();
      const animationPromises = Object.entries(characterDef.animations).map(
        async ([actionName, animationPath]) => {
          try {
            const animationClip = await this.loadAnimation(animationPath);
            if (animationClip) {
              animations.set(actionName, animationClip);
            }
          } catch (error) {
            console.warn(`Failed to load animation ${actionName} for ${characterId}:`, error);
          }
        }
      );

      await Promise.all(animationPromises);

      // Create animation mixer
      const THREE = await import('three');
      const mixer = new THREE.AnimationMixer(characterModel);

      // Create the loaded character object
      const loadedCharacter: LoadedCharacter = {
        id: characterId,
        model: characterModel,
        animations,
        mixer,
        isLoaded: true
      };

      console.log(`✅ Character loaded: ${characterDef.name} with ${animations.size} animations`);
      return loadedCharacter;

    } catch (error) {
      console.error(`Failed to load character ${characterId}:`, error);
      
      // Create a fallback character (simple colored cube)
      const fallbackCharacter = await this.createFallbackCharacter(characterId, characterDef);
      return fallbackCharacter;
    }
  }

  // Load a 3D model with caching
  private async loadModel(modelPath: string): Promise<any> {
    if (this.modelCache.has(modelPath)) {
      return this.modelCache.get(modelPath);
    }

    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          modelPath,
          (gltf) => {
            this.modelCache.set(modelPath, gltf.scene);
            resolve(gltf.scene);
          },
          undefined,
          (error) => {
            console.error(`Failed to load model ${modelPath}:`, error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error(`Error setting up model loader for ${modelPath}:`, error);
      throw error;
    }
  }

  // Load an animation with caching
  private async loadAnimation(animationPath: string): Promise<any> {
    if (this.animationCache.has(animationPath)) {
      return this.animationCache.get(animationPath);
    }

    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          animationPath,
          (gltf) => {
            if (gltf.animations && gltf.animations.length > 0) {
              const animation = gltf.animations[0];
              this.animationCache.set(animationPath, animation);
              resolve(animation);
            } else {
              console.warn(`No animations found in ${animationPath}`);
              resolve(null);
            }
          },
          undefined,
          (error) => {
            console.error(`Failed to load animation ${animationPath}:`, error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error(`Error setting up animation loader for ${animationPath}:`, error);
      throw error;
    }
  }

  // Create a fallback character (colored cube) when model loading fails
  private async createFallbackCharacter(characterId: string, characterDef: CharacterDefinition): Promise<LoadedCharacter> {
    const THREE = await import('three');
    
    // Get a unique color for this character
    const color = CharacterRegistry.getCharacterColorVariant(characterId, characterId);
    
    // Create a simple colored cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color });
    const model = new THREE.Mesh(geometry, material);
    
    model.scale.setScalar(characterDef.scale);
    model.castShadow = true;
    model.receiveShadow = true;

    console.warn(`Using fallback cube for character: ${characterDef.name}`);

    return {
      id: characterId,
      model,
      animations: new Map(),
      mixer: null,
      isLoaded: true
    };
  }

  // Create a clone of a loaded character for use in the scene
  createCharacterInstance(characterId: string): LoadedCharacter | null {
    const loadedCharacter = this.loadedCharacters.get(characterId);
    if (!loadedCharacter) {
      return null;
    }

    // Clone the model and create new mixer
    const clonedModel = loadedCharacter.model.clone();
    
    let clonedMixer = null;
    if (loadedCharacter.mixer) {
      const THREE = require('three');
      clonedMixer = new THREE.AnimationMixer(clonedModel);
    }

    return {
      id: characterId,
      model: clonedModel,
      animations: loadedCharacter.animations,
      mixer: clonedMixer,
      isLoaded: true
    };
  }

  // Play animation on character
  playAnimation(character: LoadedCharacter, animationName: string, loop: boolean = true): boolean {
    if (!character.mixer || !character.animations.has(animationName)) {
      console.warn(`Cannot play animation ${animationName} for character ${character.id}`);
      return false;
    }

    // Stop current action
    if (character.currentAction) {
      character.currentAction.stop();
    }

    // Start new action
    const animationClip = character.animations.get(animationName);
    const action = character.mixer.clipAction(animationClip);
    
    if (loop) {
      const THREE = require('three');
      action.setLoop(THREE.LoopRepeat);
    }
    
    action.reset().play();
    character.currentAction = action;

    console.log(`Playing animation ${animationName} for character ${character.id}`);
    return true;
  }

  // Update all character animations (call every frame)
  updateAnimations(deltaTime: number): void {
    for (const character of this.loadedCharacters.values()) {
      if (character.mixer) {
        character.mixer.update(deltaTime);
      }
    }
  }

  // Check if character is loaded
  isCharacterLoaded(characterId: string): boolean {
    return this.loadedCharacters.has(characterId);
  }

  // Get all loaded characters
  getLoadedCharacters(): string[] {
    return Array.from(this.loadedCharacters.keys());
  }

  // Preload multiple characters
  async preloadCharacters(characterIds: string[]): Promise<void> {
    console.log(`Preloading ${characterIds.length} characters...`);
    
    const loadingPromises = characterIds.map(id => 
      this.loadCharacter(id).catch(error => {
        console.warn(`Failed to preload character ${id}:`, error);
        return null;
      })
    );
    
    await Promise.allSettled(loadingPromises);
    console.log(`Preloading complete. ${this.loadedCharacters.size} characters loaded.`);
  }

  // Dispose of character resources
  dispose(characterId?: string): void {
    if (characterId) {
      const character = this.loadedCharacters.get(characterId);
      if (character && character.mixer) {
        character.mixer.stopAllAction();
      }
      this.loadedCharacters.delete(characterId);
    } else {
      // Dispose all
      for (const character of this.loadedCharacters.values()) {
        if (character.mixer) {
          character.mixer.stopAllAction();
        }
      }
      this.loadedCharacters.clear();
    }
  }
}