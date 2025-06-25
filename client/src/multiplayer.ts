// multiplayer.ts - Industry Standard Multiplayer Client
// Manages other players, avatar rendering, and game integration

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { NetworkManager, type NetworkConfig, type AuthData } from './network';

interface RemotePlayer {
  squirrelId: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  mesh?: THREE.Object3D;
  lastUpdate: number;
  targetPosition: { x: number; y: number; z: number };
  targetRotationY: number;
  velocity?: { x: number; y: number; z: number };
}

interface MultiplayerConfig extends NetworkConfig {
  interpolationSpeed: number;
  updateThreshold: number;
  playerUpdateRate: number;
}

class MultiplayerManager {
  private network: NetworkManager;
  private config: MultiplayerConfig;
  private scene: THREE.Scene;
  private localPlayer: THREE.Object3D;
  private remotePlayers = new Map<string, RemotePlayer>();
  private squirrelModel?: THREE.Object3D;
  private lastPositionSent = { x: 0, y: 0, z: 0 };
  private lastRotationSent = 0;
  private updateTimer: any = null;
  private loader: GLTFLoader;

  constructor(config: MultiplayerConfig, scene: THREE.Scene, localPlayer: THREE.Object3D) {
    this.config = config;
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.network = new NetworkManager(config);
    this.loader = new GLTFLoader();
    
    this.setupNetworkHandlers();
  }

  // Industry Standard: Network event handling
  private setupNetworkHandlers(): void {
    // Connection events
    this.network.on('connected', () => {
      console.log('🎮 [Multiplayer] Connected to server');
      this.startPositionUpdates();
    });

    this.network.on('disconnected', () => {
      console.log('[Multiplayer] Disconnected from server');
      this.stopPositionUpdates();
      this.clearAllRemotePlayers();
    });

    this.network.on('error', (data) => {
      console.error('[Multiplayer] Network error:', data);
    });

    // Player events
    this.network.on('player_join', (data) => {
      this.handlePlayerJoin(data);
    });

    this.network.on('player_update', (data) => {
      this.handlePlayerUpdate(data);
    });

    this.network.on('player_leave', (data) => {
      this.handlePlayerLeave(data);
    });

    this.network.on('existing_players', (data) => {
      this.handleExistingPlayers(data);
    });

    this.network.on('world_state', (data) => {
      this.handleWorldState(data);
    });
  }

  // Industry Standard: Initialize multiplayer system
  async initialize(): Promise<AuthData> {
    try {
      console.log('[Multiplayer] Initializing...');
      
      // Load squirrel model for other players
      await this.loadSquirrelModel();
      
      // Authenticate and connect
      const authData = await this.network.authenticate();
      await this.network.connect();
      
      console.log('[Multiplayer] Initialized successfully');
      return authData;
      
    } catch (error) {
      console.error('[Multiplayer] Initialization failed:', error);
      throw error;
    }
  }

  // Load squirrel model for remote players
  private async loadSquirrelModel(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        '/assets/models/squirrel.glb',
        (gltf) => {
          this.squirrelModel = gltf.scene.clone();
          // Squirrel model loaded
          resolve();
        },
        (_progress) => {
          // Loading progress
        },
        (error) => {
          console.error('[Multiplayer] Failed to load squirrel model:', error);
          reject(error);
        }
      );
    });
  }

  // Handle new player joining
  private handlePlayerJoin(data: any): void {
    const { squirrelId, position, rotationY } = data;
    
    if (this.remotePlayers.has(squirrelId)) {
      console.warn(`[Multiplayer] Player ${squirrelId} already exists`);
      return;
    }

          console.log(`👥 [Multiplayer] Player joined: ${squirrelId.substring(0, 8)}`);
      this.createRemotePlayer(squirrelId, position, rotationY);
  }

  // Handle player position updates
  private handlePlayerUpdate(data: any): void {
    const { squirrelId, position, rotationY } = data;
    
    const player = this.remotePlayers.get(squirrelId);
    if (!player) {
      console.warn(`[Multiplayer] Update for unknown player: ${squirrelId}`);
      return;
    }

    // Update target position for interpolation
    player.targetPosition = { ...position };
    player.targetRotationY = rotationY;
    player.lastUpdate = Date.now();
  }

  // Handle player leaving
  private handlePlayerLeave(data: any): void {
    const { squirrelId } = data;
    console.log(`👋 [Multiplayer] Player left: ${squirrelId.substring(0, 8)}`);
    this.removeRemotePlayer(squirrelId);
  }

  // Handle existing players on connection
  private handleExistingPlayers(data: any): void {
    const { players } = data;
    console.log(`[Multiplayer] Received ${players.length} existing players`);
    
    players.forEach((playerData: any) => {
      this.createRemotePlayer(playerData.squirrelId, playerData.position, playerData.rotationY);
    });
  }

  // Handle world state
  private handleWorldState(_data: any): void {
    console.log('🌍 [Multiplayer] World state received');
    // Handle terrain seed, map objects, walnuts, etc.
    // This would integrate with the terrain and forest systems
  }

  // Industry Standard: Create remote player avatar
  private createRemotePlayer(squirrelId: string, position: { x: number; y: number; z: number }, rotationY: number): void {
    if (!this.squirrelModel) {
      console.error('[Multiplayer] Cannot create player - squirrel model not loaded');
      return;
    }

    // Clone the squirrel model
    const playerMesh = this.squirrelModel.clone();
    playerMesh.position.set(position.x, position.y, position.z);
    playerMesh.rotation.y = rotationY;
    
    // Add name tag
    this.addNameTag(playerMesh, squirrelId);
    
    // Add to scene
    this.scene.add(playerMesh);

    // Create player record
    const remotePlayer: RemotePlayer = {
      squirrelId,
      position: { ...position },
      rotationY,
      mesh: playerMesh,
      lastUpdate: Date.now(),
      targetPosition: { ...position },
      targetRotationY: rotationY
    };

    this.remotePlayers.set(squirrelId, remotePlayer);
    // Remote player created
  }

  // Add name tag to player avatar
  private addNameTag(playerMesh: THREE.Object3D, squirrelId: string): void {
    // Create text sprite for name tag
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = 'white';
    context.font = '20px Arial';
    context.textAlign = 'center';
    context.fillText(squirrelId.substring(0, 8), canvas.width / 2, canvas.height / 2 + 7);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.position.set(0, 3, 0); // Above the player
    sprite.scale.set(2, 0.5, 1);
    
    playerMesh.add(sprite);
  }

  // Remove remote player
  private removeRemotePlayer(squirrelId: string): void {
    const player = this.remotePlayers.get(squirrelId);
    if (!player) return;

    if (player.mesh) {
      this.scene.remove(player.mesh);
    }

    this.remotePlayers.delete(squirrelId);
    // Remote player removed
  }

  // Clear all remote players
  private clearAllRemotePlayers(): void {
    for (const [_squirrelId, player] of this.remotePlayers) {
      if (player.mesh) {
        this.scene.remove(player.mesh);
      }
    }
    this.remotePlayers.clear();
    console.log('[Multiplayer] Cleared all remote players');
  }

  // A++ Standard: Smooth interpolation with prediction and cleanup
  update(deltaTime: number): void {
    const now = Date.now();
    const INTERPOLATION_SPEED = this.config.interpolationSpeed;
    const PREDICTION_TIME = 100; // ms ahead prediction
    const STALE_THRESHOLD = 30000; // 30 seconds
    const DISCONNECT_THRESHOLD = 60000; // 1 minute

    for (const [squirrelId, player] of this.remotePlayers) {
      if (!player.mesh) continue;

      const timeSinceUpdate = now - player.lastUpdate;

      // Smooth interpolation with adaptive speed based on distance
      const distanceToTarget = Math.sqrt(
        Math.pow(player.targetPosition.x - player.position.x, 2) +
        Math.pow(player.targetPosition.z - player.position.z, 2)
      );

      // Adaptive interpolation speed - faster for larger distances
      const adaptiveSpeed = Math.min(
        INTERPOLATION_SPEED * deltaTime * (1 + distanceToTarget * 0.1),
        0.3 // Cap at 30% per frame
      );

      // Position interpolation with prediction for recent updates
      if (timeSinceUpdate < PREDICTION_TIME) {
        // Predict slightly ahead for smooth movement
        const predictionFactor = timeSinceUpdate / PREDICTION_TIME;
        const predictedX = player.targetPosition.x + (player.velocity?.x || 0) * predictionFactor;
        const predictedZ = player.targetPosition.z + (player.velocity?.z || 0) * predictionFactor;
        
        player.position.x = THREE.MathUtils.lerp(player.position.x, predictedX, adaptiveSpeed);
        player.position.z = THREE.MathUtils.lerp(player.position.z, predictedZ, adaptiveSpeed);
      } else {
        // Standard interpolation for older updates
        player.position.x = THREE.MathUtils.lerp(player.position.x, player.targetPosition.x, adaptiveSpeed);
        player.position.z = THREE.MathUtils.lerp(player.position.z, player.targetPosition.z, adaptiveSpeed);
      }

      // Always interpolate Y smoothly (terrain following)
      player.position.y = THREE.MathUtils.lerp(player.position.y, player.targetPosition.y, adaptiveSpeed);

      // Smooth rotation interpolation
      let angleDiff = player.targetRotationY - player.rotationY;
      // Normalize to shortest rotation path
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      player.rotationY += angleDiff * adaptiveSpeed;

      // Apply interpolated values to mesh
      player.mesh.position.set(player.position.x, player.position.y, player.position.z);
      player.mesh.rotation.y = player.rotationY;

      // Progressive cleanup based on time since update
      if (timeSinceUpdate > DISCONNECT_THRESHOLD) {
        console.warn(`[Multiplayer] Removing disconnected player: ${squirrelId}`);
        this.removeRemotePlayer(squirrelId);
             } else if (timeSinceUpdate > STALE_THRESHOLD) {
         // Fade out stale players
         const fadeAmount = Math.min((timeSinceUpdate - STALE_THRESHOLD) / (DISCONNECT_THRESHOLD - STALE_THRESHOLD), 1);
         
         // Apply fade to all meshes in the player object
         player.mesh.traverse((child) => {
           if (child instanceof THREE.Mesh && child.material) {
             if (Array.isArray(child.material)) {
               child.material.forEach(mat => {
                 mat.opacity = 1 - fadeAmount * 0.5;
                 mat.transparent = true;
               });
             } else {
               child.material.opacity = 1 - fadeAmount * 0.5;
               child.material.transparent = true;
             }
           }
         });
       }
    }
  }

  // Industry Standard: Send position updates at controlled rate
  private startPositionUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.sendPositionUpdate();
    }, 1000 / this.config.playerUpdateRate); // Convert rate to interval
  }

  private stopPositionUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  // Send position update if movement threshold exceeded
  private sendPositionUpdate(): void {
    if (!this.network.isConnected()) return;

    const currentPosition = this.localPlayer.position;
    const currentRotation = this.localPlayer.rotation.y;

    // Check if position changed significantly
    const positionChange = currentPosition.distanceTo(new THREE.Vector3(
      this.lastPositionSent.x,
      this.lastPositionSent.y,
      this.lastPositionSent.z
    ));

    const rotationChange = Math.abs(currentRotation - this.lastRotationSent);

    if (positionChange > this.config.updateThreshold || rotationChange > 0.1) {
      // Send update
      const success = this.network.sendPlayerUpdate(
        {
          x: currentPosition.x,
          y: currentPosition.y,
          z: currentPosition.z
        },
        currentRotation
      );

      if (success) {
        this.lastPositionSent = {
          x: currentPosition.x,
          y: currentPosition.y,
          z: currentPosition.z
        };
        this.lastRotationSent = currentRotation;
      }
    }
  }

  // Get connection status
  getConnectionState(): string {
    return this.network.getConnectionState();
  }

  // Get player count
  getPlayerCount(): number {
    return this.remotePlayers.size + 1; // +1 for local player
  }

  // Get auth data
  getAuthData(): AuthData | null {
    return this.network.getAuthData();
  }

  // Clean shutdown
  shutdown(): void {
    console.log('[Multiplayer] Shutting down...');
    this.stopPositionUpdates();
    this.clearAllRemotePlayers();
    this.network.disconnect();
  }

  // Check if connected
  isConnected(): boolean {
    return this.network.isConnected();
  }
}

export { MultiplayerManager, type MultiplayerConfig, type RemotePlayer }; 