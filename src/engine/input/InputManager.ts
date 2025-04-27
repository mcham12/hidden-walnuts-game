import { EventSystem } from '../core/EventSystem';
import { Logger } from '../core/Logger';

export enum InputEventType {
    KEY_DOWN = 'keydown',
    KEY_UP = 'keyup',
    MOUSE_MOVE = 'mousemove',
    MOUSE_DOWN = 'mousedown',
    MOUSE_UP = 'mouseup',
    WHEEL = 'wheel'
}

interface InputState {
    keys: Map<string, boolean>;
    mousePosition: { x: number; y: number };
    mouseButtons: Map<number, boolean>;
    wheel: { deltaX: number; deltaY: number };
}

export class InputManager {
    private keys: Map<string, boolean>;
    private mousePosition: { x: number; y: number };
    private mouseButtons: Map<number, boolean>;
    private eventSystem: EventSystem;
    private state: InputState;
    private previousState: InputState;
    private isInitialized: boolean;

    constructor(eventSystem: EventSystem) {
        this.keys = new Map();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseButtons = new Map();
        this.eventSystem = eventSystem;
        this.isInitialized = false;

        this.state = {
            keys: new Map(),
            mousePosition: { x: 0, y: 0 },
            mouseButtons: new Map(),
            wheel: { deltaX: 0, deltaY: 0 }
        };

        this.previousState = {
            keys: new Map(),
            mousePosition: { x: 0, y: 0 },
            mouseButtons: new Map(),
            wheel: { deltaX: 0, deltaY: 0 }
        };
    }

    initialize(): void {
        if (this.isInitialized) {
            console.warn('InputManager already initialized');
            return;
        }

        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this));
        window.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        window.addEventListener('wheel', this.handleWheel.bind(this));

        this.isInitialized = true;
        Logger.info('InputManager initialized');
    }

    private onKeyDown(event: KeyboardEvent): void {
        this.keys.set(event.key.toLowerCase(), true);
        this.eventSystem.emit('keyDown', { key: event.key.toLowerCase() });
    }

    private onKeyUp(event: KeyboardEvent): void {
        this.keys.set(event.key.toLowerCase(), false);
        this.eventSystem.emit('keyUp', { key: event.key.toLowerCase() });
    }

    private onMouseMove(event: MouseEvent): void {
        this.mousePosition.x = event.clientX;
        this.mousePosition.y = event.clientY;
        this.eventSystem.emit('mouseMove', { x: event.clientX, y: event.clientY });
    }

    private onMouseDown(event: MouseEvent): void {
        this.mouseButtons.set(event.button, true);
        this.eventSystem.emit('mouseDown', { button: event.button });
    }

    private onMouseUp(event: MouseEvent): void {
        this.mouseButtons.set(event.button, false);
        this.eventSystem.emit('mouseUp', { button: event.button });
    }

    private handleWheel(event: WheelEvent): void {
        this.state.wheel.deltaX = event.deltaX;
        this.state.wheel.deltaY = event.deltaY;
        this.eventSystem.emit(InputEventType.WHEEL, {
            deltaX: event.deltaX,
            deltaY: event.deltaY
        });
    }

    update(): void {
        // Update previous state
        this.previousState.keys = new Map(this.state.keys);
        this.previousState.mouseButtons = new Map(this.state.mouseButtons);
        this.previousState.mousePosition = { ...this.state.mousePosition };
        this.previousState.wheel = { ...this.state.wheel };

        // Reset wheel delta
        this.state.wheel.deltaX = 0;
        this.state.wheel.deltaY = 0;
    }

    isKeyPressed(key: string): boolean {
        return this.keys.get(key) ?? false;
    }

    isKeyReleased(key: string): boolean {
        return !this.keys.get(key) && this.previousState.keys.get(key);
    }

    isMouseButtonPressed(button: number): boolean {
        return this.mouseButtons.get(button) ?? false;
    }

    isMouseButtonReleased(button: number): boolean {
        return !this.mouseButtons.get(button) && this.previousState.mouseButtons.get(button);
    }

    getMousePosition(): { x: number; y: number } {
        return { ...this.mousePosition };
    }

    getMouseDelta(): { x: number; y: number } {
        return {
            x: this.mousePosition.x - this.previousState.mousePosition.x,
            y: this.mousePosition.y - this.previousState.mousePosition.y
        };
    }

    getWheelDelta(): { deltaX: number; deltaY: number } {
        return { ...this.state.wheel };
    }

    cleanup(): void {
        if (!this.isInitialized) return;

        window.removeEventListener('keydown', this.onKeyDown.bind(this));
        window.removeEventListener('keyup', this.onKeyUp.bind(this));
        window.removeEventListener('mousemove', this.onMouseMove.bind(this));
        window.removeEventListener('mousedown', this.onMouseDown.bind(this));
        window.removeEventListener('mouseup', this.onMouseUp.bind(this));
        window.removeEventListener('wheel', this.handleWheel.bind(this));

        this.keys.clear();
        this.mouseButtons.clear();
        this.previousState.keys.clear();
        this.previousState.mouseButtons.clear();

        this.isInitialized = false;
    }
} 