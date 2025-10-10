// Interpolation System - Single Responsibility: Smooth remote player movement

import { System, Entity, PositionComponent, RotationComponent, InterpolationComponent, NetworkComponent } from '../ecs';
import { EventBus } from '../core/EventBus';
import { Vector3, Rotation } from '../core/types';

export class InterpolationSystem extends System {
  // private static readonly INTERPOLATION_DELAY = 100; // Future: Render 100ms behind for smoothness
  private static readonly EXTRAPOLATION_LIMIT = 50; // Max 50ms extrapolation
  private static readonly STALE_THRESHOLD = 5000; // 5 seconds (not 30!)
  private static readonly MAX_INTERPOLATION_SPEED = 0.15; // Slower for smoothness

  constructor(eventBus: EventBus) {
    super(eventBus, ['position', 'rotation', 'interpolation', 'network'], 'InterpolationSystem');
  }

  update(deltaTime: number): void {
    const now = performance.now();

    for (const entity of this.entities.values()) {
      this.interpolateEntity(entity, deltaTime, now);
    }
  }

  private interpolateEntity(entity: Entity, deltaTime: number, now: number): void {
    const position = entity.getComponent<PositionComponent>('position')!;
    const rotation = entity.getComponent<RotationComponent>('rotation')!;
    const interpolation = entity.getComponent<InterpolationComponent>('interpolation')!;
    const network = entity.getComponent<NetworkComponent>('network')!;

    // Skip local player
    if (network.isLocalPlayer) return;

    const timeSinceUpdate = now - network.lastUpdate;
    
    // Calculate adaptive interpolation speed based on distance
    const distanceToTarget = position.value.distanceTo(interpolation.targetPosition);
    const adaptiveSpeed = Math.min(
      interpolation.speed * deltaTime * (1 + distanceToTarget * 0.1),
      InterpolationSystem.MAX_INTERPOLATION_SPEED
    );

    let newPosition: Vector3;

    // Use extrapolation for very recent updates, interpolation for delayed rendering
    if (timeSinceUpdate < InterpolationSystem.EXTRAPOLATION_LIMIT) {
      newPosition = this.extrapolatePosition(
        position.value,
        interpolation.targetPosition,
        timeSinceUpdate,
        adaptiveSpeed
      );
    } else {
      // Standard interpolation for lag-compensated rendering
      newPosition = position.value.lerp(interpolation.targetPosition, adaptiveSpeed);
    }

    // Smooth rotation interpolation
    const newRotation = rotation.value.lerpTowards(
      interpolation.targetRotation.y,
      adaptiveSpeed
    );

    // Update components
    entity.addComponent<PositionComponent>({
      type: 'position',
      value: newPosition
    });

    entity.addComponent<RotationComponent>({
      type: 'rotation',
      value: newRotation
    });

    // Handle stale players (visual feedback)
    if (timeSinceUpdate > InterpolationSystem.STALE_THRESHOLD) {
      this.applyStaleEffect(entity, timeSinceUpdate);
    }
  }

  private extrapolatePosition(
    currentPosition: Vector3,
    targetPosition: Vector3,
    timeSinceUpdate: number,
    adaptiveSpeed: number
  ): Vector3 {
    // Extrapolate forward based on recent movement
    const extrapolationFactor = timeSinceUpdate / InterpolationSystem.EXTRAPOLATION_LIMIT;
    const direction = targetPosition.add(currentPosition.multiply(-1));
    const extrapolatedTarget = targetPosition.add(direction.multiply(extrapolationFactor * 0.2));
    
    return currentPosition.lerp(extrapolatedTarget, adaptiveSpeed);
  }

  private applyStaleEffect(entity: Entity, timeSinceUpdate: number): void {
    // This would update visual components to show fading
    // In a full implementation, you'd emit an event for the RenderSystem
    const fadeAmount = Math.min(
      (timeSinceUpdate - InterpolationSystem.STALE_THRESHOLD) / 30000,
      0.5
    );
    
    // Emit event for render system to handle visual effects
    this.eventBus.emit('render.fade', {
      entityId: entity.id,
      opacity: 1 - fadeAmount
    });
  }

  // Called when receiving network updates
  updateTargets(entityId: string, targetPosition: Vector3, targetRotation: Rotation): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    const interpolationComponent: InterpolationComponent = {
      type: 'interpolation',
      targetPosition,
      targetRotation,
      speed: 5.0 // Could be made configurable
    };

    entity.addComponent(interpolationComponent);

    // Update network component timestamp
    const networkComponent = entity.getComponent<NetworkComponent>('network');
    if (networkComponent) {
      entity.addComponent<NetworkComponent>({
        ...networkComponent,
        lastUpdate: performance.now()
      });
    }
  }
} 