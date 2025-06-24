import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MOVEMENT_SPEED } from './constants'
import { getTerrainHeightSync } from './terrain'

// Industry Standard: Client-Side Prediction with Input State
interface InputState {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  mouseX: number
  mouseY: number
  timestamp: number
}

interface PlayerState {
  position: THREE.Vector3
  velocity: THREE.Vector3
  rotation: number
  timestamp: number
  inputSequence: number
}

interface Avatar {
  mesh: THREE.Object3D | null
  mixer: THREE.AnimationMixer | null
  actions: Map<string, THREE.AnimationAction>
  isLoaded: boolean
}

class AvatarSystem {
  private avatar: Avatar = {
    mesh: null,
    mixer: null,
    actions: new Map(),
    isLoaded: false
  }

  // Industry Standard: Input prediction state
  private currentInput: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    mouseX: 0,
    mouseY: 0,
    timestamp: 0
  }

  // Industry Standard: Client-side prediction
  private predictedState: PlayerState = {
    position: new THREE.Vector3(50, 2, 50), // Spawn position
    velocity: new THREE.Vector3(),
    rotation: 0,
    timestamp: 0,
    inputSequence: 0
  }

  private serverState: PlayerState = {
    position: new THREE.Vector3(50, 2, 50),
    velocity: new THREE.Vector3(),
    rotation: 0,
    timestamp: 0,
    inputSequence: 0
  }

  // Industry Standard: Input history for reconciliation
  private inputHistory: Array<{ input: InputState, state: PlayerState }> = []
  private maxHistorySize = 60 // 1 second at 60fps



  // Physics constants
  private readonly ACCELERATION = 50
  private readonly FRICTION = 15
  private readonly MAX_SPEED = MOVEMENT_SPEED

  constructor() {
    this.setupInputHandlers()
  }

  // Industry Standard: Proper input handling
  private setupInputHandlers() {
    // Simple WASD detection that actually works
    const keys: Record<string, boolean> = {}
    
    document.addEventListener('keydown', (event) => {
      keys[event.code] = true
      this.updateInputState(keys)
      console.log(`[Avatar] Key down: ${event.code}`)
    })

    document.addEventListener('keyup', (event) => {
      keys[event.code] = false
      this.updateInputState(keys)
      console.log(`[Avatar] Key up: ${event.code}`)
    })

    // Simple mouse look without pointer lock for now
    document.addEventListener('mousemove', (event) => {
      this.currentInput.mouseX += event.movementX * 0.002
    })

    console.log('[Avatar] ✅ Input handlers configured')
  }

  private updateInputState(keys: Record<string, boolean>) {
    const oldInput = { ...this.currentInput }
    
    this.currentInput.forward = keys['KeyW'] || keys['ArrowUp'] || false
    this.currentInput.backward = keys['KeyS'] || keys['ArrowDown'] || false
    this.currentInput.left = keys['KeyA'] || keys['ArrowLeft'] || false
    this.currentInput.right = keys['KeyD'] || keys['ArrowRight'] || false
    this.currentInput.timestamp = performance.now()
    
    // Log when input changes
    if (oldInput.forward !== this.currentInput.forward || 
        oldInput.backward !== this.currentInput.backward ||
        oldInput.left !== this.currentInput.left || 
        oldInput.right !== this.currentInput.right) {
      console.log(`[Avatar] Input changed: W:${this.currentInput.forward} A:${this.currentInput.left} S:${this.currentInput.backward} D:${this.currentInput.right}`)
    }
  }

  // Industry Standard: Load avatar with proper error handling
  async loadAvatar(): Promise<void> {
    if (this.avatar.isLoaded) return

    try {
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync('/assets/models/squirrel.glb')
      
      this.avatar.mesh = gltf.scene
      this.avatar.mesh.scale.set(0.5, 0.5, 0.5)
      this.avatar.mesh.position.copy(this.predictedState.position)
      this.avatar.mesh.rotation.y = this.predictedState.rotation
      
      // Setup animations if available
      if (gltf.animations.length > 0) {
        this.avatar.mixer = new THREE.AnimationMixer(this.avatar.mesh)
        
        gltf.animations.forEach((clip) => {
          const action = this.avatar.mixer!.clipAction(clip)
          this.avatar.actions.set(clip.name, action)
        })

        // Play idle animation by default
        if (this.avatar.actions.has('Idle')) {
          this.avatar.actions.get('Idle')!.play()
        }
      }

      // Setup shadows
      this.avatar.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })

      this.avatar.isLoaded = true
      console.log('[Avatar] ✅ Avatar loaded successfully')
      
    } catch (error) {
      console.error('[Avatar] ❌ Failed to load avatar:', error)
      // Create fallback avatar
      this.createFallbackAvatar()
    }
  }

  private createFallbackAvatar() {
    const geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8)
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, // Brown color for squirrel
      roughness: 0.7,
      metalness: 0.1
    })
    
    this.avatar.mesh = new THREE.Mesh(geometry, material)
    this.avatar.mesh.position.copy(this.predictedState.position)
    this.avatar.mesh.rotation.y = this.predictedState.rotation
    this.avatar.mesh.castShadow = true
    this.avatar.mesh.receiveShadow = true
    this.avatar.isLoaded = true
    
    console.log('[Avatar] ⚠️ Using fallback avatar')
  }

  // Industry Standard: Physics-based movement with prediction
  updateMovement(deltaTime: number): void {
    if (!this.avatar.isLoaded || !this.avatar.mesh) {
      console.log(`[Movement] Early return: loaded=${this.avatar.isLoaded}, mesh=${!!this.avatar.mesh}`);
      return;
    }

    // Log current state before movement
    const beforePos = this.predictedState.position.clone();
    const beforeVel = this.predictedState.velocity.clone();
    
    // Industry Standard: Apply input to predicted state
    this.applyInputToState(this.predictedState, this.currentInput, deltaTime);
    
    // Log what changed
    const afterPos = this.predictedState.position.clone();
    const afterVel = this.predictedState.velocity.clone();
    
    const posChanged = !beforePos.equals(afterPos);
    const velChanged = !beforeVel.equals(afterVel);
    
    if (posChanged || velChanged || this.currentInput.forward || this.currentInput.backward || this.currentInput.left || this.currentInput.right) {
      console.log(`[Movement] Input: W:${this.currentInput.forward} A:${this.currentInput.left} S:${this.currentInput.backward} D:${this.currentInput.right}`);
      console.log(`[Movement] Pos: (${beforePos.x.toFixed(1)},${beforePos.z.toFixed(1)}) → (${afterPos.x.toFixed(1)},${afterPos.z.toFixed(1)}) Changed:${posChanged}`);
      console.log(`[Movement] Vel: (${beforeVel.x.toFixed(2)},${beforeVel.z.toFixed(2)}) → (${afterVel.x.toFixed(2)},${afterVel.z.toFixed(2)}) Changed:${velChanged}`);
    }
    
    // Store input history for reconciliation
    this.inputHistory.push({
      input: { ...this.currentInput },
      state: { ...this.predictedState, position: this.predictedState.position.clone() }
    });

    // Limit history size
    if (this.inputHistory.length > this.maxHistorySize) {
      this.inputHistory.shift();
    }

    // Update avatar mesh position
    this.avatar.mesh.position.copy(this.predictedState.position);
    this.avatar.mesh.rotation.y = this.predictedState.rotation;

    // Update animations
    this.updateAnimations(deltaTime);
  }

  // Industry Standard: Apply input with proper physics and terrain collision
  private applyInputToState(state: PlayerState, input: InputState, deltaTime: number): void {
    // Rotation from mouse
    state.rotation = input.mouseX;

    // Movement input
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), state.rotation);

    const inputDir = new THREE.Vector3();
    if (input.forward) inputDir.add(forward);
    if (input.backward) inputDir.sub(forward);  
    if (input.right) inputDir.add(right);
    if (input.left) inputDir.sub(right);

    // DEBUG: Log input processing
    const hasInput = input.forward || input.backward || input.left || input.right;
    if (hasInput) {
      console.log(`[Physics] Input detected, direction length: ${inputDir.length().toFixed(3)}, deltaTime: ${deltaTime.toFixed(4)}`);
    }

    if (inputDir.length() > 0) {
      inputDir.normalize();
      // Apply acceleration
      const acceleration = inputDir.multiplyScalar(this.ACCELERATION * deltaTime);
      state.velocity.add(acceleration);
      
      if (hasInput) {
        console.log(`[Physics] Acceleration applied: (${acceleration.x.toFixed(3)}, ${acceleration.z.toFixed(3)})`);
        console.log(`[Physics] New velocity: (${state.velocity.x.toFixed(3)}, ${state.velocity.z.toFixed(3)})`);
      }
    }

    // Apply friction
    state.velocity.multiplyScalar(Math.max(0, 1 - this.FRICTION * deltaTime));

    // Limit max speed
    if (state.velocity.length() > this.MAX_SPEED) {
      state.velocity.normalize().multiplyScalar(this.MAX_SPEED);
    }

    // Update position
    const deltaPos = state.velocity.clone().multiplyScalar(deltaTime);
    state.position.add(deltaPos);
    
    if (hasInput || deltaPos.length() > 0.001) {
      console.log(`[Physics] Delta position: (${deltaPos.x.toFixed(3)}, ${deltaPos.z.toFixed(3)})`);
      console.log(`[Physics] New position: (${state.position.x.toFixed(3)}, ${state.position.z.toFixed(3)})`);
    }
    
    // Simple bounds checking
    state.position.x = Math.max(-100, Math.min(100, state.position.x));
    state.position.z = Math.max(-100, Math.min(100, state.position.z));

    // Industry Standard: Terrain collision detection
    this.applyTerrainCollision(state);

    state.timestamp = performance.now();
    state.inputSequence++;
  }

  // Industry Standard: Terrain collision system
  private applyTerrainCollision(state: PlayerState): void {
    try {
      // Get terrain height at player position using imported function
      const terrainHeight = getTerrainHeightSync(state.position.x, state.position.z)
      
      // Industry Standard: Player height offset (1.0 unit above terrain)
      const targetY = terrainHeight + 1.0
      
      // Industry Standard: Smooth terrain following instead of instant snapping
      if (Math.abs(state.position.y - targetY) > 0.1) {
        // Use linear interpolation for smooth terrain following
        const lerpFactor = 0.15 // Slightly more responsive for better feel
        state.position.y = THREE.MathUtils.lerp(state.position.y, targetY, lerpFactor)
      } else {
        // Snap to terrain if very close to avoid jitter
        state.position.y = targetY
      }
      
    } catch (error) {
      // Fallback: Use a reasonable default height if terrain lookup fails
      console.warn('[Avatar] Terrain height lookup failed, using fallback:', error)
      state.position.y = Math.max(state.position.y, 2.0) // Minimum height
    }
  }



  // Industry Standard: Server reconciliation
  reconcileWithServer(serverPosition: THREE.Vector3, serverRotation: number, serverTimestamp: number) {
    // Find the input that corresponds to the server state
    const serverInputIndex = this.inputHistory.findIndex(
      entry => Math.abs(entry.state.timestamp - serverTimestamp) < 50 // 50ms tolerance
    )

    if (serverInputIndex === -1) return // Too old or not found

    // Check if prediction was correct
    const predictedPos = this.inputHistory[serverInputIndex].state.position
    const error = predictedPos.distanceTo(serverPosition)

    // Industry Standard: Only correct if error is significant (>10cm)
    if (error > 0.1) {
      console.log(`[Avatar] 🔄 Correcting prediction error: ${error.toFixed(3)}m`)
      
      // Correct the server state
      this.serverState.position.copy(serverPosition)
      this.serverState.rotation = serverRotation
      this.serverState.timestamp = serverTimestamp

      // Re-apply inputs since server state
      let correctedState = { ...this.serverState, position: serverPosition.clone() }
      
      for (let i = serverInputIndex + 1; i < this.inputHistory.length; i++) {
        const entry = this.inputHistory[i]
        const deltaTime = i > 0 ? 
          (this.inputHistory[i].state.timestamp - this.inputHistory[i-1].state.timestamp) / 1000 : 0.016
        
        this.applyInputToState(correctedState, entry.input, deltaTime)
      }

      // Update predicted state
      this.predictedState = correctedState
      
      // Smooth correction to avoid jarring
      if (this.avatar.mesh) {
        this.avatar.mesh.position.lerp(this.predictedState.position, 0.2)
        this.avatar.mesh.rotation.y = this.predictedState.rotation
      }
    }

    // Clean old history
    this.inputHistory = this.inputHistory.slice(serverInputIndex)
  }

  private updateAnimations(deltaTime: number) {
    if (!this.avatar.mixer) return

    this.avatar.mixer.update(deltaTime)

    // Industry Standard: State-based animation
    const isMoving = this.predictedState.velocity.length() > 0.1
    const isRunning = this.predictedState.velocity.length() > this.MAX_SPEED * 0.5

    // Stop all actions first
    this.avatar.actions.forEach(action => action.stop())

    // Play appropriate animation
    if (isRunning && this.avatar.actions.has('Run')) {
      this.avatar.actions.get('Run')!.play()
    } else if (isMoving && this.avatar.actions.has('Walk')) {
      this.avatar.actions.get('Walk')!.play()
    } else if (this.avatar.actions.has('Idle')) {
      this.avatar.actions.get('Idle')!.play()
    }
  }

  // Industry Standard: Camera follow with smooth tracking (third-person style)
  async updateCamera(camera: THREE.Camera) {
    if (!this.avatar.mesh) return

    // Industry Standard: Third-person camera positioning
    const playerPosition = this.avatar.mesh.position.clone();
    const cameraOffset = new THREE.Vector3(0, 8, 12); // Behind and above player
    
    // Rotate offset based on player rotation for proper following
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.predictedState.rotation);
    
    const targetCameraPos = playerPosition.clone().add(cameraOffset);
    
    // Industry Standard: Smooth camera follow with configurable speed
    const followSpeed = 0.1;
    camera.position.lerp(targetCameraPos, followSpeed);
    
    // Look at player with slight upward offset
    const lookTarget = playerPosition.clone();
    lookTarget.y += 1.5; // Look slightly above player center
    camera.lookAt(lookTarget);
  }

  // Getters for external access
  getAvatar(): Avatar {
    return this.avatar
  }

  getCurrentInput(): InputState {
    return { ...this.currentInput }
  }

  getPredictedState(): PlayerState {
    return { ...this.predictedState, position: this.predictedState.position.clone() }
  }

  // Set position (for spawning/teleporting)
  setPosition(position: THREE.Vector3) {
    this.predictedState.position.copy(position)
    this.serverState.position.copy(position)
    if (this.avatar.mesh) {
      this.avatar.mesh.position.copy(position)
    }
  }
}

// Create the singleton instance properly
const avatarSystem = new AvatarSystem()

export async function loadSquirrelAvatar(): Promise<void> {
  return avatarSystem.loadAvatar()
}

export function updateSquirrelMovement(deltaTime: number): void {
  return avatarSystem.updateMovement(deltaTime)
}

export async function updateSquirrelCamera(camera: THREE.Camera): Promise<void> {
  return avatarSystem.updateCamera(camera)
}

export function getSquirrelAvatar(): Avatar {
  return avatarSystem.getAvatar()
}

export function getCurrentInput(): InputState {
  return avatarSystem.getCurrentInput()
}

export function getPredictedState(): PlayerState {
  return avatarSystem.getPredictedState()
}

export function reconcileWithServer(position: THREE.Vector3, rotation: number, timestamp: number): void {
  avatarSystem.reconcileWithServer(position, rotation, timestamp)
}

export function setPlayerPosition(position: THREE.Vector3): void {
  avatarSystem.setPosition(position)
} 