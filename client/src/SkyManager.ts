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
  private readonly CLOUD_Y_MIN = 100;
  private readonly CLOUD_Y_MAX = 200;
  // Position within camera frustum (far=1000), near the far plane
  private readonly CLOUD_Z_MIN = -920;
  private readonly CLOUD_Z_MAX = -900;
  private readonly CLOUD_SCALE_MIN = 60;
  private readonly CLOUD_SCALE_MAX = 100;

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
          // Enable BOTH depthTest and depthWrite so depth buffer handles occlusion correctly
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthTest: true,  // Test against depth buffer
            depthWrite: true, // Write to depth buffer (normal behavior)
          });

          // Create sprite
          this.sun = new THREE.Sprite(material);

          // Position near camera far plane to ensure behind all game objects
          // Camera far=1000, game objects typically within -100 to +100
          // Higher Y position to place sun higher in sky
          this.sun.position.set(50, 250, -950);

          // Scale for visibility at distance
          this.sun.scale.set(80, 80, 1);

          // Default renderOrder (0) is fine with proper depth testing
          // Depth buffer will handle occlusion

          // Add to scene
          this.scene.add(this.sun);

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
        depthTest: true,  // Test against depth buffer
        depthWrite: true, // Write to depth buffer (normal behavior)
      });

      const sprite = new THREE.Sprite(material);
      // Default renderOrder (0) - depth buffer handles occlusion

      // Start with random respawn timer (stagger initial spawns)
      const initialDelay = Math.random() * 30000; // 0-30s

      this.clouds.push({
        sprite,
        speed: 0,
        respawnTimer: initialDelay,
        isActive: false,
      });
    }
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
  }
}
