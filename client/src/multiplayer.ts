import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Industry Standard: Area of Interest (AOI) system
interface PlayerData {
  id: string
  position: THREE.Vector3
  rotation: number
  velocity: THREE.Vector3
  lastUpdate: number
  isVisible: boolean
  mesh?: THREE.Object3D
}

interface NetworkState {
  timestamp: number
  position: THREE.Vector3
  rotation: number
}

class MultiplayerSystem {
  private players = new Map<string, PlayerData>()
  private loader = new GLTFLoader()
  private scene: THREE.Scene
  
  // Industry Standard: Area of Interest settings
  private readonly AOI_RADIUS = 100 // Only sync players within 100 units
  private readonly CULLING_RADIUS = 150 // Remove from memory beyond 150 units
  private readonly INTERPOLATION_TIME = 100 // 100ms interpolation buffer
  
  // Industry Standard: Network interpolation
  private networkStates = new Map<string, NetworkState[]>()
  
  // FIX: Store local player position reference
  private localPlayerPosition: THREE.Vector3 = new THREE.Vector3(50, 2, 50) // Default spawn
  
  constructor(scene: THREE.Scene) {
    this.scene = scene
  }
  
  // Industry Standard: Update local player position for distance calculations
  updateLocalPlayerPosition(position: THREE.Vector3): void {
    const oldPos = this.localPlayerPosition.clone()
    this.localPlayerPosition.copy(position)
    
    // Debug position updates
    if (oldPos.distanceTo(position) > 0.1) {
      console.log(`[Multiplayer] 📍 Local player position updated: (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`)
    }
  }

  // Industry Standard: Add player with visibility culling
  async addPlayer(playerId: string, position: THREE.Vector3, rotation: number): Promise<void> {
    if (this.players.has(playerId)) {
      // Update existing player
      this.updatePlayer(playerId, position, rotation)
      return
    }

    const playerData: PlayerData = {
      id: playerId,
      position: position.clone(),
      rotation,
      velocity: new THREE.Vector3(),
      lastUpdate: performance.now(),
      isVisible: false,
      mesh: undefined
    }

    this.players.set(playerId, playerData)
    
    // Debug player addition with distance calculation
    const distance = this.getDistanceToLocalPlayer(position)
    console.log(`[Multiplayer] ➕ Added player ${playerId} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`)
    console.log(`[Multiplayer] 📏 Distance to local player: ${distance.toFixed(1)}m (local at ${this.localPlayerPosition.x.toFixed(1)}, ${this.localPlayerPosition.y.toFixed(1)}, ${this.localPlayerPosition.z.toFixed(1)})`)
    console.log(`[Multiplayer] 🎯 AOI_RADIUS: ${this.AOI_RADIUS}m, should be visible: ${distance <= this.AOI_RADIUS}`)

    // Trigger immediate visibility check
    this.handleVisibilityCulling(playerData, distance)
  }

  // Industry Standard: Efficient player mesh loading
  private async loadPlayerMesh(playerData: PlayerData): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync('/assets/models/squirrel.glb')
      playerData.mesh = gltf.scene.clone()
      playerData.mesh.scale.set(0.5, 0.5, 0.5)
      playerData.mesh.position.copy(playerData.position)
      playerData.mesh.rotation.y = playerData.rotation
      
      // Differentiate from local player (darker color)
      playerData.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
          
          if (child.material) {
            const material = child.material.clone()
            if (Array.isArray(material)) {
              material.forEach(mat => {
                if ('color' in mat) mat.color.setHex(0x666666)
              })
            } else if ('color' in material) {
              material.color.setHex(0x666666)
            }
            child.material = material
          }
        }
      })
      
      this.scene.add(playerData.mesh)
      playerData.isVisible = true
      
    } catch (error) {
      console.warn(`[Multiplayer] Failed to load mesh for ${playerData.id}, using fallback`)
      this.createFallbackMesh(playerData)
    }
  }

  private createFallbackMesh(playerData: PlayerData): void {
    const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8)
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.1
    })
    
    playerData.mesh = new THREE.Mesh(geometry, material)
    playerData.mesh.position.copy(playerData.position)
    playerData.mesh.rotation.y = playerData.rotation
    playerData.mesh.castShadow = true
    playerData.mesh.receiveShadow = true
    
    this.scene.add(playerData.mesh)
    playerData.isVisible = true
  }

  // Industry Standard: Update with network interpolation
  updatePlayer(playerId: string, position: THREE.Vector3, rotation: number): void {
    const player = this.players.get(playerId)
    if (!player) return

    const now = performance.now()
    
    // Add network state for interpolation
    const states = this.networkStates.get(playerId) || []
    states.push({
      timestamp: now,
      position: position.clone(),
      rotation
    })
    
    // Keep only recent states (1 second worth)
    const cutoff = now - 1000
    this.networkStates.set(playerId, states.filter(state => state.timestamp > cutoff))
    
    // Update player data
    player.lastUpdate = now
    
    // Industry Standard: Area of Interest culling
    const distance = this.getDistanceToLocalPlayer(position)
    this.handleVisibilityCulling(player, distance)
  }

  // Industry Standard: Dynamic visibility culling
  private handleVisibilityCulling(player: PlayerData, distance: number): void {
    const shouldBeVisible = distance <= this.AOI_RADIUS
    const shouldBeLoaded = distance <= this.CULLING_RADIUS

    if (shouldBeVisible && !player.isVisible && !player.mesh) {
      // Load player mesh
      this.loadPlayerMesh(player)
    } else if (!shouldBeVisible && player.isVisible && player.mesh) {
      // Hide player but keep in memory
      player.mesh.visible = false
      player.isVisible = false
      console.log(`[Multiplayer] 👻 Hidden player ${player.id} (distance: ${distance.toFixed(1)}m)`)
    } else if (shouldBeVisible && !player.isVisible && player.mesh) {
      // Show hidden player
      player.mesh.visible = true
      player.isVisible = true
      console.log(`[Multiplayer] 👁️ Showed player ${player.id} (distance: ${distance.toFixed(1)}m)`)
    } else if (!shouldBeLoaded && player.mesh) {
      // Remove from memory entirely
      this.scene.remove(player.mesh)
      player.mesh = undefined
      player.isVisible = false
      console.log(`[Multiplayer] 🗑️ Unloaded player ${player.id} (distance: ${distance.toFixed(1)}m)`)
    }
  }

  // Industry Standard: Smooth interpolation update
  update(): void {
    const now = performance.now()
    const interpolationTarget = now - this.INTERPOLATION_TIME

    for (const [playerId, player] of this.players.entries()) {
      if (!player.mesh || !player.isVisible) continue

      // Get interpolated position using network states
      const states = this.networkStates.get(playerId) || []
      if (states.length < 2) continue

      // Find states to interpolate between
      let fromState: NetworkState | null = null
      let toState: NetworkState | null = null

      for (let i = 0; i < states.length - 1; i++) {
        if (states[i].timestamp <= interpolationTarget && states[i + 1].timestamp >= interpolationTarget) {
          fromState = states[i]
          toState = states[i + 1]
          break
        }
      }

      if (!fromState || !toState) {
        // Use latest state if no interpolation possible
        const latestState = states[states.length - 1]
        if (latestState) {
          player.position.copy(latestState.position)
          player.rotation = latestState.rotation
        }
      } else {
        // Industry Standard: Time-based interpolation
        const timeDiff = toState.timestamp - fromState.timestamp
        const factor = timeDiff > 0 ? (interpolationTarget - fromState.timestamp) / timeDiff : 0
        const clampedFactor = Math.max(0, Math.min(1, factor))

        // Interpolate position
        player.position.lerpVectors(fromState.position, toState.position, clampedFactor)
        
        // Interpolate rotation (handle wrapping)
        let rotDiff = toState.rotation - fromState.rotation
        if (rotDiff > Math.PI) rotDiff -= 2 * Math.PI
        if (rotDiff < -Math.PI) rotDiff += 2 * Math.PI
        player.rotation = fromState.rotation + rotDiff * clampedFactor
      }

      // Update mesh position
      player.mesh.position.copy(player.position)
      player.mesh.rotation.y = player.rotation

      // Industry Standard: Update visibility culling each frame
      const distance = this.getDistanceToLocalPlayer(player.position)
      this.handleVisibilityCulling(player, distance)
    }

    // Industry Standard: Clean up old players (timeout after 10 seconds)
    const timeout = now - 10000
    for (const [playerId, player] of this.players.entries()) {
      if (player.lastUpdate < timeout) {
        this.removePlayer(playerId)
      }
    }
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId)
    if (!player) return

    if (player.mesh) {
      this.scene.remove(player.mesh)
    }

    this.players.delete(playerId)
    this.networkStates.delete(playerId)
    
    console.log(`[Multiplayer] 🔴 Removed player ${playerId}`)
  }

  // FIX: Proper distance calculation using actual local player position
  private getDistanceToLocalPlayer(position: THREE.Vector3): number {
    return position.distanceTo(this.localPlayerPosition)
  }

  // Industry Standard: Get visible players for UI/minimap
  getVisiblePlayers(): PlayerData[] {
    return Array.from(this.players.values()).filter(player => player.isVisible)
  }

  // FIX: Get nearby players with proper local position
  getNearbyPlayers(maxDistance: number = 10): PlayerData[] {
    return Array.from(this.players.values()).filter(player => 
      player.position.distanceTo(this.localPlayerPosition) <= maxDistance
    )
  }

  // Performance monitoring
  getStats(): { total: number, visible: number, loaded: number } {
    let visible = 0
    let loaded = 0
    
    for (const player of this.players.values()) {
      if (player.mesh) loaded++
      if (player.isVisible) visible++
    }
    
    return {
      total: this.players.size,
      visible,
      loaded
    }
  }
}

export { MultiplayerSystem, type PlayerData } 