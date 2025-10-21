// Input Handler - Manages keyboard and mouse input for player movement

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  running: boolean; // Shift key for running
  mouseX: number;
  mouseY: number;
  mouseMovementX: number;
  mouseMovementY: number;
}

export class InputHandler {
  private keys = new Set<string>();
  private mousePosition = { x: 0, y: 0 };
  private mouseMovement = { x: 0, y: 0 };
  private canvas: HTMLCanvasElement | null = null;
  private isPointerLocked = false;

  // Callbacks for input events
  public onMovementChanged?: (inputState: InputState) => void;
  public onMouseMove?: (movementX: number, movementY: number) => void;

  constructor(canvas?: HTMLCanvasElement) {
    if (canvas) {
      this.setCanvas(canvas);
    }
  }

  // Set the canvas for pointer lock
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.setupPointerLock();
  }

  // Start listening for input events
  startListening(): void {
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    
    if (this.canvas) {
      this.canvas.addEventListener('click', this.requestPointerLock);
    }

    console.log('Input handler started listening for WASD + mouse input');
  }

  // Stop listening for input events
  stopListening(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.requestPointerLock);
    }

    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    
    console.log('Input handler stopped listening');
  }

  // Get current input state
  getInputState(): InputState {
    return {
      forward: this.keys.has('w') || this.keys.has('arrowup'),
      backward: this.keys.has('s') || this.keys.has('arrowdown'),
      left: this.keys.has('a') || this.keys.has('arrowleft'),
      right: this.keys.has('d') || this.keys.has('arrowright'),
      running: this.keys.has('shift'),
      mouseX: this.mousePosition.x,
      mouseY: this.mousePosition.y,
      mouseMovementX: this.mouseMovement.x,
      mouseMovementY: this.mouseMovement.y
    };
  }

  // Check if any movement keys are pressed
  hasMovementInput(): boolean {
    return this.keys.has('w') || this.keys.has('s') || 
           this.keys.has('a') || this.keys.has('d') ||
           this.keys.has('arrowup') || this.keys.has('arrowdown') ||
           this.keys.has('arrowleft') || this.keys.has('arrowright');
  }

  // Setup pointer lock for mouse look
  private setupPointerLock(): void {
    if (!this.canvas) return;

    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
  }

  private requestPointerLock = (): void => {
    if (this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  private handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;
    console.log('Pointer lock changed:', this.isPointerLocked ? 'locked' : 'unlocked');
  };

  private handlePointerLockError = (event: Event): void => {
    console.error('Pointer lock error:', event);
  };

  // Handle keyboard input
  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    
    // Prevent default behavior for movement keys
    if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      event.preventDefault();
    }

    const wasMoving = this.hasMovementInput();
    this.keys.add(key);
    const isMoving = this.hasMovementInput();

    // Notify if movement state changed
    if (wasMoving !== isMoving) {
      this.onMovementChanged?.(this.getInputState());
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    
    const wasMoving = this.hasMovementInput();
    this.keys.delete(key);
    const isMoving = this.hasMovementInput();

    // Notify if movement state changed
    if (wasMoving !== isMoving) {
      this.onMovementChanged?.(this.getInputState());
    }
  };

  // Handle mouse movement
  private handleMouseMove = (event: MouseEvent): void => {
    if (this.isPointerLocked) {
      // Use movement deltas when pointer is locked
      this.mouseMovement.x = event.movementX;
      this.mouseMovement.y = event.movementY;
      
      this.onMouseMove?.(event.movementX, event.movementY);
    } else {
      // Use absolute position when pointer is not locked
      this.mousePosition.x = event.clientX;
      this.mousePosition.y = event.clientY;
      
      // Calculate movement from previous position
      this.mouseMovement.x = event.movementX || 0;
      this.mouseMovement.y = event.movementY || 0;
    }
  };

  // Get movement direction as normalized vector
  getMovementDirection(): { x: number, z: number } {
    let x = 0;
    let z = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) z -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) z += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;

    // Normalize diagonal movement
    if (x !== 0 && z !== 0) {
      const length = Math.sqrt(x * x + z * z);
      x /= length;
      z /= length;
    }

    return { x, z };
  }

  // Get mouse sensitivity multiplier
  getMouseSensitivity(): number {
    return 0.002; // Adjust this value to change mouse sensitivity
  }

  // Check if running modifier is pressed
  isRunning(): boolean {
    return this.keys.has('shift');
  }

  // Reset mouse movement (call this each frame after processing)
  resetMouseMovement(): void {
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }

  // Check if pointer is locked (useful for UI states)
  isPointerLockActive(): boolean {
    return this.isPointerLocked;
  }

  // Release pointer lock
  exitPointerLock(): void {
    document.exitPointerLock();
  }
}