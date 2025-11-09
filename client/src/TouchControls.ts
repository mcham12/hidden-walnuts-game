/**
 * TouchControls - MVP 5.7: Mobile/Touch Controls
 *
 * Drag-to-Move System (like Brawl Stars, mobile MOBAs):
 * - Touch anywhere and drag in direction to move character
 * - Two-finger drag for camera rotation
 * - Tap to find walnuts
 * - Double-tap to hide walnuts
 */

import * as THREE from 'three';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  magnitude: number; // 0-1 for analog-style movement
}

export interface CameraInput {
  deltaX: number;
  deltaY: number;
}

export class TouchControls {
  private canvas: HTMLCanvasElement;
  private enabled: boolean = false;

  // Touch state
  private touches: Map<number, Touch> = new Map();
  private dragStartPos: THREE.Vector2 | null = null;
  private currentDragPos: THREE.Vector2 | null = null;
  private isDragging: boolean = false;

  // Movement state (WASD-style output)
  private movementInput: MovementInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    magnitude: 0
  };

  // Camera rotation state
  private cameraDragStart: THREE.Vector2 | null = null;

  // Tap detection
  private lastTapTime: number = 0;
  private lastTapPos: THREE.Vector2 | null = null;
  private readonly TAP_THRESHOLD = 10; // pixels
  private readonly DOUBLE_TAP_TIME = 300; // ms
  private readonly DRAG_THRESHOLD = 15; // pixels before drag starts

  // Callbacks
  private onTapCallback: ((x: number, y: number) => void) | null = null;
  private onDoubleTapCallback: (() => void) | null = null;
  private onCameraRotateCallback: ((deltaX: number, deltaY: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Only enable on mobile devices
    if (TouchControls.isMobile()) {
      this.enable();
    }
  }

  /**
   * Detect if running on mobile/touch device
   * Best Practice: Use multiple signals, prioritize touch capability over screen size
   */
  static isMobile(): boolean {
    // 1. Check for touch points (most reliable - works for all iPads, tablets, etc.)
    if (navigator.maxTouchPoints > 0) {
      return true;
    }

    // 2. Check for touch events
    if ('ontouchstart' in window) {
      return true;
    }

    // 3. Check pointer media query (coarse = touch, fine = mouse)
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return true;
    }

    // 4. Fallback: Check user agent for known mobile devices
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone', 'mobile'];
    if (mobileKeywords.some(keyword => userAgent.includes(keyword))) {
      return true;
    }

    // 5. Last resort: Small screen size (but don't use as primary signal)
    if (window.innerWidth < 768 && window.innerHeight < 1024) {
      return true;
    }

    return false;
  }

  /**
   * Enable touch controls
   */
  enable(): void {
    if (this.enabled) return;

    this.enabled = true;

    // Bind touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });

    // Prevent iOS Safari bounce and double-tap zoom
    document.body.style.overscrollBehavior = 'none';
    this.canvas.style.touchAction = 'none';

    console.log('✅ Touch controls enabled (drag-to-move)');
  }

  /**
   * Disable touch controls
   */
  disable(): void {
    if (!this.enabled) return;

    this.enabled = false;

    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);

    console.log('❌ Touch controls disabled');
  }

  /**
   * Touch start handler
   */
  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();

    // Store all touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }

    if (this.touches.size === 1) {
      // Single finger - start drag-to-move
      const touch = Array.from(this.touches.values())[0];
      this.dragStartPos = new THREE.Vector2(touch.clientX, touch.clientY);
      this.currentDragPos = this.dragStartPos.clone();
      this.isDragging = false; // Wait for threshold before dragging
    } else if (this.touches.size === 2) {
      // Two fingers - start camera rotation
      const touchArray = Array.from(this.touches.values());
      const centerX = (touchArray[0].clientX + touchArray[1].clientX) / 2;
      const centerY = (touchArray[0].clientY + touchArray[1].clientY) / 2;
      this.cameraDragStart = new THREE.Vector2(centerX, centerY);

      // Cancel movement drag
      this.isDragging = false;
      this.dragStartPos = null;
    }
  };

  /**
   * Touch move handler
   */
  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    // Update touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.set(touch.identifier, touch);
    }

    if (this.touches.size === 1 && this.dragStartPos) {
      // Single finger - drag to move
      const touch = Array.from(this.touches.values())[0];
      this.currentDragPos = new THREE.Vector2(touch.clientX, touch.clientY);

      // Check if drag threshold exceeded
      const dragDistance = this.currentDragPos.distanceTo(this.dragStartPos);
      if (!this.isDragging && dragDistance > this.DRAG_THRESHOLD) {
        this.isDragging = true;
      }

      // Update movement input if dragging
      if (this.isDragging) {
        this.updateMovementFromDrag();
      }
    } else if (this.touches.size === 2 && this.cameraDragStart) {
      // Two fingers - camera rotation
      const touchArray = Array.from(this.touches.values());
      const centerX = (touchArray[0].clientX + touchArray[1].clientX) / 2;
      const centerY = (touchArray[0].clientY + touchArray[1].clientY) / 2;
      const currentPos = new THREE.Vector2(centerX, centerY);

      const deltaX = currentPos.x - this.cameraDragStart.x;
      const deltaY = currentPos.y - this.cameraDragStart.y;

      // Trigger camera rotation callback
      if (this.onCameraRotateCallback) {
        this.onCameraRotateCallback(deltaX * 0.5, deltaY * 0.5);
      }

      this.cameraDragStart = currentPos;
    }
  };

  /**
   * Touch end handler
   */
  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();

    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      this.touches.delete(touch.identifier);
    }

    // Check for tap (not drag)
    if (this.dragStartPos && this.currentDragPos && !this.isDragging) {
      const dragDistance = this.currentDragPos.distanceTo(this.dragStartPos);
      if (dragDistance < this.TAP_THRESHOLD) {
        this.handleTap(this.currentDragPos.x, this.currentDragPos.y);
      }
    }

    // Stop movement
    if (this.touches.size === 0) {
      this.isDragging = false;
      this.dragStartPos = null;
      this.currentDragPos = null;
      this.cameraDragStart = null;
      this.clearMovementInput();
    } else if (this.touches.size === 1) {
      // Went from 2 fingers to 1 - restart single touch
      this.cameraDragStart = null;
      const touch = Array.from(this.touches.values())[0];
      this.dragStartPos = new THREE.Vector2(touch.clientX, touch.clientY);
      this.currentDragPos = this.dragStartPos.clone();
      this.isDragging = false;
    }
  };

  /**
   * Convert drag direction to WASD-style movement input
   */
  private updateMovementFromDrag(): void {
    if (!this.dragStartPos || !this.currentDragPos) return;

    // Calculate drag vector
    const dragVector = new THREE.Vector2(
      this.currentDragPos.x - this.dragStartPos.x,
      this.currentDragPos.y - this.dragStartPos.y
    );

    const dragLength = dragVector.length();
    if (dragLength < this.DRAG_THRESHOLD) {
      this.clearMovementInput();
      return;
    }

    // Normalize and calculate magnitude (0-1)
    dragVector.normalize();
    const magnitude = Math.min(dragLength / 100, 1); // Max at 100px drag

    // Convert to WASD input
    // X axis: left (-) / right (+)
    // Y axis: up (-) / down (+)

    // Forward/Backward (Y axis)
    if (dragVector.y < -0.3) {
      this.movementInput.forward = true;
      this.movementInput.backward = false;
    } else if (dragVector.y > 0.3) {
      this.movementInput.forward = false;
      this.movementInput.backward = true;
    } else {
      this.movementInput.forward = false;
      this.movementInput.backward = false;
    }

    // Left/Right (X axis)
    if (dragVector.x < -0.3) {
      this.movementInput.left = true;
      this.movementInput.right = false;
    } else if (dragVector.x > 0.3) {
      this.movementInput.left = false;
      this.movementInput.right = true;
    } else {
      this.movementInput.left = false;
      this.movementInput.right = false;
    }

    this.movementInput.magnitude = magnitude;
  }

  /**
   * Clear movement input (stop moving)
   */
  private clearMovementInput(): void {
    this.movementInput.forward = false;
    this.movementInput.backward = false;
    this.movementInput.left = false;
    this.movementInput.right = false;
    this.movementInput.magnitude = 0;
  }

  /**
   * Handle tap (single or double)
   */
  private handleTap(x: number, y: number): void {
    const now = Date.now();
    const tapPos = new THREE.Vector2(x, y);

    // Check for double tap
    if (
      this.lastTapPos &&
      tapPos.distanceTo(this.lastTapPos) < this.TAP_THRESHOLD &&
      now - this.lastTapTime < this.DOUBLE_TAP_TIME
    ) {
      // Double tap detected
      if (this.onDoubleTapCallback) {
        this.onDoubleTapCallback();
      }
      // Reset tap state
      this.lastTapTime = 0;
      this.lastTapPos = null;
    } else {
      // Single tap detected
      if (this.onTapCallback) {
        this.onTapCallback(x, y);
      }
      // Store for double tap detection
      this.lastTapTime = now;
      this.lastTapPos = tapPos;
    }
  }

  /**
   * Get current movement input (called every frame)
   */
  getMovementInput(): MovementInput {
    return this.movementInput;
  }

  /**
   * Set tap callback (for finding walnuts)
   */
  onTap(callback: (x: number, y: number) => void): void {
    this.onTapCallback = callback;
  }

  /**
   * Set double tap callback (for hiding walnuts)
   */
  onDoubleTap(callback: () => void): void {
    this.onDoubleTapCallback = callback;
  }

  /**
   * Set camera rotation callback
   */
  onCameraRotate(callback: (deltaX: number, deltaY: number) => void): void {
    this.onCameraRotateCallback = callback;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disable();
    this.touches.clear();
    this.onTapCallback = null;
    this.onDoubleTapCallback = null;
    this.onCameraRotateCallback = null;
  }
}
