/**
 * Sky Manager - Atmospheric sky elements for Hidden Walnuts
 *
 * Manages sun and cloud sprites using billboard technique (always face camera).
 * Lightweight, performant approach suitable for casual games.
 *
 * Features:
 * - Fixed sun position (warm, friendly atmosphere)
 * - 1-2 drifting clouds with random respawn
 * - Industry-standard THREE.Sprite billboard rendering
 */

import * as THREE from 'three';

interface CloudData {
  sprite: THREE.Sprite;
  speed: number;           // Horizontal drift speed (units/sec)
  respawnTimer: number;    // Time until respawn (ms)
  isActive: boolean;       // Currently visible and moving
}

export class SkyManager {
  private scene: THREE.Scene;
  private textureLoader: THREE.TextureLoader;

  // Sky elements
  private sun: THREE.Sprite | null = null;
  private clouds: CloudData[] = [];

  // Configuration
  private readonly MAX_CLOUDS = 2;
  private readonly CLOUD_SPEED_MIN = 0.5;
  private readonly CLOUD_SPEED_MAX = 1.5;
  private readonly CLOUD_SPAWN_X = -100;
  private readonly CLOUD_DESPAWN_X = 100;
  private readonly RESPAWN_DELAY_MIN = 30000; // 30 seconds
  private readonly RESPAWN_DELAY_MAX = 60000; // 60 seconds
  private readonly CLOUD_Y_MIN = 25;
  private readonly CLOUD_Y_MAX = 45;
  // Industry standard: Far Z positions for skybox elements (always behind game objects)
  private readonly CLOUD_Z_MIN = -550;
  private readonly CLOUD_Z_MAX = -450;
  private readonly CLOUD_SCALE_MIN = 10;
  private readonly CLOUD_SCALE_MAX = 18;

  constructor(scene: THREE.Scene, textureLoader: THREE.TextureLoader) {
    this.scene = scene;
    this.textureLoader = textureLoader;
  }

  /**
   * Initialize sky elements (call after scene is ready)
   */
  async init(): Promise<void> {
    try {
      await this.createSun();
      await this.initializeClouds();
      console.log('✅ Sky system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize sky system:', error);
    }
  }

  /**
   * Create sun sprite (fixed position, always visible)
   */
  private async createSun(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        '/assets/models/environment/sun.png',
        (texture) => {
          // Create sprite material with texture
          // Industry standard: Skybox elements use depthTest:false + far Z position
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthTest: false, // Don't test depth - always behind objects
            depthWrite: false, // Don't write to depth buffer - prevents z-fighting
          });

          // Create sprite
          this.sun = new THREE.Sprite(material);

          // Position sun very far back (industry standard for skybox elements)
          // Far Z position ensures it's always behind all game objects
          this.sun.position.set(50, 30, -500);

          // Scale to 15 units diameter (75% of original 20)
          this.sun.scale.set(15, 15, 1);

          // Render order: behind everything else (negative = render first)
          this.sun.renderOrder = -2000;

          // Add to scene
          this.scene.add(this.sun);

          console.log('☀️ Sun created at position (50, 30, -500), scale 15 units');
          resolve();
        },
        undefined,
        (error) => {
          console.error('❌ Failed to load sun texture:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Initialize cloud system (1-2 clouds with staggered spawns)
   */
  private async initializeClouds(): Promise<void> {
    // Load cloud texture once
    const cloudTexture = await new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        '/assets/models/environment/cloud.png',
        resolve,
        undefined,
        reject
      );
    });

    // Create cloud data structures
    for (let i = 0; i < this.MAX_CLOUDS; i++) {
      const material = new THREE.SpriteMaterial({
        map: cloudTexture.clone(),
        transparent: true,
        opacity: 0.7,
        depthTest: false, // Don't test depth - always behind objects
        depthWrite: false, // Don't write to depth buffer - industry standard
      });

      const sprite = new THREE.Sprite(material);
      sprite.renderOrder = -1500; // Behind sun (-2000) but still background

      // Start with random respawn timer (stagger initial spawns)
      const initialDelay = Math.random() * 30000; // 0-30s

      this.clouds.push({
        sprite,
        speed: 0,
        respawnTimer: initialDelay,
        isActive: false,
      });
    }

    console.log(`☁️ Cloud system initialized (${this.MAX_CLOUDS} clouds)`);
  }

  /**
   * Update sky elements (call every frame)
   */
  update(delta: number): void {
    const deltaMs = delta * 1000;

    // Update each cloud
    for (const cloud of this.clouds) {
      if (cloud.isActive) {
        // Move cloud horizontally
        cloud.sprite.position.x += cloud.speed * delta;

        // Check if cloud has drifted off-screen
        if (cloud.sprite.position.x > this.CLOUD_DESPAWN_X) {
          this.despawnCloud(cloud);
        }
      } else {
        // Cloud is waiting to respawn
        cloud.respawnTimer -= deltaMs;

        if (cloud.respawnTimer <= 0) {
          this.spawnCloud(cloud);
        }
      }
    }
  }

  /**
   * Spawn a cloud at the left edge with random properties
   */
  private spawnCloud(cloud: CloudData): void {
    // Random Y position (height in sky)
    const y = this.CLOUD_Y_MIN + Math.random() * (this.CLOUD_Y_MAX - this.CLOUD_Y_MIN);

    // Random Z position (depth)
    const z = this.CLOUD_Z_MIN + Math.random() * (this.CLOUD_Z_MAX - this.CLOUD_Z_MIN);

    // Random scale (size variation)
    const scale = this.CLOUD_SCALE_MIN + Math.random() * (this.CLOUD_SCALE_MAX - this.CLOUD_SCALE_MIN);

    // Random speed
    cloud.speed = this.CLOUD_SPEED_MIN + Math.random() * (this.CLOUD_SPEED_MAX - this.CLOUD_SPEED_MIN);

    // Position at spawn point
    cloud.sprite.position.set(this.CLOUD_SPAWN_X, y, z);
    cloud.sprite.scale.set(scale, scale, 1);

    // Add to scene and activate
    if (!cloud.sprite.parent) {
      this.scene.add(cloud.sprite);
    }
    cloud.isActive = true;

    console.log(`☁️ Cloud spawned at y=${y.toFixed(1)}, z=${z.toFixed(1)}, speed=${cloud.speed.toFixed(2)}`);
  }

  /**
   * Despawn a cloud and set respawn timer
   */
  private despawnCloud(cloud: CloudData): void {
    cloud.isActive = false;

    // Set random respawn delay
    cloud.respawnTimer = this.RESPAWN_DELAY_MIN +
      Math.random() * (this.RESPAWN_DELAY_MAX - this.RESPAWN_DELAY_MIN);

    // Note: Keep sprite in scene to avoid memory thrashing (just mark inactive)
    console.log(`☁️ Cloud despawned, respawn in ${(cloud.respawnTimer / 1000).toFixed(1)}s`);
  }

  /**
   * Cleanup sky resources
   */
  dispose(): void {
    // Dispose sun
    if (this.sun) {
      if (this.sun.material.map) {
        this.sun.material.map.dispose();
      }
      this.sun.material.dispose();
      this.scene.remove(this.sun);
      this.sun = null;
    }

    // Dispose clouds
    for (const cloud of this.clouds) {
      if (cloud.sprite.material.map) {
        cloud.sprite.material.map.dispose();
      }
      cloud.sprite.material.dispose();
      this.scene.remove(cloud.sprite);
    }
    this.clouds = [];

    console.log('🌤️ Sky system disposed');
  }
}
