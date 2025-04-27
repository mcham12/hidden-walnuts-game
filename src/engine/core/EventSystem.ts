type EventCallback = (...args: any[]) => void;

export class EventSystem {
    private events: Map<string, Set<EventCallback>>;

    constructor() {
        this.events = new Map();
    }

    on(eventName: string, callback: EventCallback): void {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, new Set());
        }
        this.events.get(eventName)!.add(callback);
    }

    off(eventName: string, callback: EventCallback): void {
        const callbacks = this.events.get(eventName);
        if (callbacks) {
            callbacks.delete(callback);
            if (callbacks.size === 0) {
                this.events.delete(eventName);
            }
        }
    }

    emit(eventName: string, ...args: any[]): void {
        const callbacks = this.events.get(eventName);
        if (callbacks) {
            callbacks.forEach(callback => callback(...args));
        }
    }

    clear(): void {
        this.events.clear();
    }
} 