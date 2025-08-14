// Simple network integration for multiplayer visibility
import { SimpleMultiplayerManager } from './SimpleMultiplayerManager';
import { EventBus } from '../core/EventBus';
import { Logger, LogCategory } from '../core/Logger';
import * as THREE from 'three';

export class NetworkIntegration {
  constructor(
    private multiplayerManager: SimpleMultiplayerManager,
    private eventBus: EventBus
  ) {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    // Handle remote player joins
    this.eventBus.subscribe('remote_player_state', this.handleRemotePlayerUpdate.bind(this));
    this.eventBus.subscribe('player_disconnected', this.handlePlayerDisconnected.bind(this));
  }
  
  private async handleRemotePlayerUpdate(data: any) {
    if (!data.squirrelId || !data.position) return;
    
    // Check if player already exists
    let player = this.multiplayerManager.getPlayer(data.squirrelId);
    
    if (!player) {
      // Create new remote player
      Logger.info(LogCategory.PLAYER, `🆕 Creating remote player: ${data.squirrelId}`);
      player = await this.multiplayerManager.createPlayer(data.squirrelId, false); // false = remote
    }
    
    // Update position and rotation
    const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    const rotation = data.rotationY || 0;
    
    this.multiplayerManager.updatePlayer(data.squirrelId, position, rotation);
  }
  
  private handlePlayerDisconnected(data: { squirrelId: string }) {
    Logger.info(LogCategory.PLAYER, `👋 Removing remote player: ${data.squirrelId}`);
    this.multiplayerManager.removePlayer(data.squirrelId);
  }
}