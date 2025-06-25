export interface MovementState {
  forward: boolean;
  backward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export class InputManager {
  private moveState: MovementState = {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false
  };

  private listeners: Array<(state: MovementState) => void> = [];

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    console.log('🎮 [Input] Setting up WASD event listeners...');

    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      console.log('⌨️ [Input] Keydown:', key);
      
      switch (key) {
        case 'w': 
          this.moveState.forward = true; 
          console.log('🏃 [Input] Moving forward');
          break;
        case 's': 
          this.moveState.backward = true; 
          console.log('🔙 [Input] Moving backward');
          break;
        case 'a': 
          this.moveState.turnLeft = true; 
          console.log('↩️ [Input] Turning left');
          break;
        case 'd': 
          this.moveState.turnRight = true; 
          console.log('↪️ [Input] Turning right');
          break;
      }

      this.notifyListeners();
    });

    document.addEventListener('keyup', (event) => {
      const key = event.key.toLowerCase();
      console.log('⌨️ [Input] Keyup:', key);
      
      switch (key) {
        case 'w': this.moveState.forward = false; break;
        case 's': this.moveState.backward = false; break;
        case 'a': this.moveState.turnLeft = false; break;
        case 'd': this.moveState.turnRight = false; break;
      }

      this.notifyListeners();
    });

    // Test if focus is on the page
    console.log('🎯 [Input] Document focus test - activeElement:', document.activeElement?.tagName);
  }

  public getMoveState(): MovementState {
    return { ...this.moveState };
  }

  public onMovementChange(callback: (state: MovementState) => void): void {
    this.listeners.push(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.getMoveState()));
  }

  public destroy(): void {
    // Clean up event listeners if needed
    this.listeners = [];
  }
} 