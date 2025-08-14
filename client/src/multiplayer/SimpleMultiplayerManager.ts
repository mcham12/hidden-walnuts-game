// Simple, expandable multiplayer visibility system
import * as THREE from 'three';
import { Entity, PositionComponent, RotationComponent, RenderComponent, NetworkComponent, InputComponent, EntityId } from '../ecs';
import { CharacterComponent } from '../core/types';
import { Vector3, Rotation } from '../core/types';

export class MultiplayerPlayer {
  public mesh: THREE.Object3D;
  public entity: Entity;
  
  constructor(
    public id: string,
    public isLocal: boolean,
    mesh: THREE.Object3D,
    entity: Entity
  ) {
    this.mesh = mesh;
    this.entity = entity;
  }
  
  get position(): THREE.Vector3 {
    return this.mesh.position;
  }
  
  update(position: THREE.Vector3, rotation: number) {
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;
    
    // Update ECS components
    this.entity.addComponent<PositionComponent>({
      type: 'position',
      value: new Vector3(position.x, position.y, position.z)
    });
    
    this.entity.addComponent<RotationComponent>({
      type: 'rotation',
      value: Rotation.fromRadians(rotation)
    });
  }
}

export class SimpleMultiplayerManager {
  private players = new Map<string, MultiplayerPlayer>();
  
  constructor(
    private scene: THREE.Scene,
    private entityManager: any
  ) {}
  
  async createPlayer(id: string, isLocal: boolean): Promise<MultiplayerPlayer> {
    // Phase 1: Simple geometry (will expand to GLTF later)
    const geometry = new THREE.CapsuleGeometry(0.3, 1.2);
    const material = new THREE.MeshStandardMaterial({ 
      color: isLocal ? 0x00ff00 : 0xff0000  // Green=local, Red=remote
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Scale to match expected character size
    mesh.scale.set(0.3, 0.3, 0.3);
    
    // Create ECS entity
    const entity = new Entity(EntityId.generate());
    
    // Add ECS components
    entity.addComponent<PositionComponent>({
      type: 'position',
      value: new Vector3(0, 0, 0)
    });
    
    entity.addComponent<RotationComponent>({
      type: 'rotation', 
      value: Rotation.fromRadians(0)
    });
    
    entity.addComponent<RenderComponent>({
      type: 'render',
      mesh: mesh,
      visible: true
    });
    
    entity.addComponent<NetworkComponent>({
      type: 'network',
      squirrelId: id,
      isLocalPlayer: isLocal,
      lastUpdate: performance.now()
    });
    
    // Add input component for local players only
    if (isLocal) {
      entity.addComponent<InputComponent>({
        type: 'input',
        forward: false,
        backward: false,
        turnLeft: false,
        turnRight: false
      });
      
      // Add character component for movement stats
      entity.addComponent<CharacterComponent>({
        type: 'character',
        characterId: 'colobus' // Default character for now
      });
    }
    
    // Register entity with ECS
    this.entityManager.addEntity(entity);
    
    const player = new MultiplayerPlayer(id, isLocal, mesh, entity);
    this.scene.add(mesh);
    this.players.set(id, player);
    
    return player;
  }
  
  updatePlayer(id: string, position: THREE.Vector3, rotation: number) {
    const player = this.players.get(id);
    if (player) {
      player.update(position, rotation);
    }
  }
  
  removePlayer(id: string) {
    const player = this.players.get(id);
    if (player) {
      this.scene.remove(player.mesh);
      this.players.delete(id);
    }
  }
  
  getPlayer(id: string): MultiplayerPlayer | undefined {
    return this.players.get(id);
  }
  
  getAllPlayers(): MultiplayerPlayer[] {
    return Array.from(this.players.values());
  }
  
  getRemotePlayers(): MultiplayerPlayer[] {
    return this.getAllPlayers().filter(p => !p.isLocal);
  }
  
  getLocalPlayer(): MultiplayerPlayer | undefined {
    return this.getAllPlayers().find(p => p.isLocal);
  }
}