import { Entity } from './Entity';

export abstract class Component {
    protected entity: Entity | null = null;

    onAdd(entity: Entity): void {
        this.entity = entity;
    }

    onRemove(): void {
        this.entity = null;
    }

    abstract update(deltaTime: number): void;

    cleanup(): void {
        this.onCleanup();
        this.entity = null;
    }

    protected abstract onCleanup(): void;
} 