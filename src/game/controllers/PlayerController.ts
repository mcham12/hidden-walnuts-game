import * as THREE from 'three';
import { PlayerEntity } from '../entities/PlayerEntity';
import { PhysicsSystem } from '../../engine/physics/PhysicsSystem';

export class PlayerController {
    player: PlayerEntity;
    camera: THREE.Camera;
    domElement: HTMLElement;
    moveSpeed: number = 10;
    turnSpeed: number = 2.5;
    playerFacingAngle: number = 0; // Player facing angle (yaw, radians)
    cameraDistance: number = 0.25;
    cameraHeight: number = 0.18;
    cameraLookHeight: number = 0.12;
    keys: Record<string, boolean> = {};
    isMouseDown: boolean = false;
    lastMouseX: number = 0;
    physicsSystem: PhysicsSystem;

    constructor(player: PlayerEntity, camera: THREE.Camera, domElement: HTMLElement, physicsSystem: PhysicsSystem) {
        this.player = player;
        this.camera = camera;
        this.domElement = domElement;
        this.physicsSystem = physicsSystem;
        this.initInput();
        
        // Mark player model for special handling
        player.model.userData.isPlayer = true;
        
        // Add player to physics system with proper collision setup
        this.physicsSystem.addObject(player.model, {
            mass: 1,
            isStatic: false,
            shape: 'sphere',
            radius: 0.5,
            friction: 0.5,
            restitution: 0.2,
            fixedRotation: true // Prevent physics from rotating the player
        });

        // Initialize player at starting position
        this.player.position.set(0, 0.5, 0);
        this.player.model.position.copy(this.player.position);
    }

    initInput() {
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        this.domElement.addEventListener('mousedown', (e) => {
            this.isMouseDown = true;
            this.lastMouseX = e.clientX;
        });
        window.addEventListener('mouseup', () => this.isMouseDown = false);
        this.domElement.addEventListener('mousemove', (e) => {
            if (this.isMouseDown) {
                const dx = e.clientX - this.lastMouseX;
                this.playerFacingAngle -= dx * 0.01;
                this.lastMouseX = e.clientX;
            }
        });
    }

    update(delta: number) {
        // 1. Handle rotation input
        let rotate = 0;
        if (this.keys['a'] || this.keys['arrowleft']) rotate += 1;
        if (this.keys['d'] || this.keys['arrowright']) rotate -= 1;
        if (rotate !== 0) {
            this.playerFacingAngle += rotate * this.turnSpeed * delta;
        }

        // 2. Handle movement input
        let move = 0;
        if (this.keys['w'] || this.keys['arrowup']) move += 1;
        if (this.keys['s'] || this.keys['arrowdown']) move -= 1;
        
        if (move !== 0) {
            const dir = new THREE.Vector3(Math.sin(this.playerFacingAngle), 0, Math.cos(this.playerFacingAngle));
            const force = dir.multiplyScalar(move * this.moveSpeed);
            
            // Apply velocity to physics body
            const body = this.physicsSystem.getBody(this.player.model);
            if (body) {
                // Only modify horizontal velocity
                body.velocity.x = force.x;
                body.velocity.z = force.z;
                // Keep vertical velocity for gravity
                body.velocity.y = Math.max(-20, Math.min(20, body.velocity.y));
            }
        }

        // 3. Update player model rotation (physics won't handle this)
        this.player.model.rotation.y = this.playerFacingAngle;

        // 4. Update camera position
        const camTarget = this.player.position.clone();
        const camOffset = new THREE.Vector3(
            -Math.sin(this.playerFacingAngle) * this.cameraDistance,
            this.cameraHeight,
            -Math.cos(this.playerFacingAngle) * this.cameraDistance
        );
        this.camera.position.copy(camTarget.clone().add(camOffset));
        this.camera.lookAt(camTarget.x, camTarget.y + this.cameraLookHeight, camTarget.z);

        // 5. Update player position from physics
        this.player.position.copy(this.player.model.position);
        
        // 6. Ensure player stays above ground
        if (this.player.position.y < 0.1) {
            this.player.position.y = 0.1;
            this.player.model.position.y = 0.1;
            const body = this.physicsSystem.getBody(this.player.model);
            if (body) {
                body.position.y = 0.1;
                body.velocity.y = 0;
            }
        }

        // 7. Send position update to backend
        this.player.sendUpdateToBackend();
    }
} 