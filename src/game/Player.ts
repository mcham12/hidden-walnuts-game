import * as THREE from 'three';
import { Scene } from './Scene';

export class Player {
    private scene: Scene;
    private playerMesh: THREE.Mesh;
    private moveSpeed: number = 0.15;
    private velocity: THREE.Vector3;
    private keys: { [key: string]: boolean } = {};
    private bobTimer: number = 0;
    private isMoving: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
        this.velocity = new THREE.Vector3();

        // Create temporary player mesh (cube)
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const material = new THREE.MeshStandardMaterial({ color: 0x964B00 });
        this.playerMesh = new THREE.Mesh(geometry, material);
        this.playerMesh.position.y = 0.4;
        scene.getScene().add(this.playerMesh);

        // Setup input handlers
        window.addEventListener('keydown', (e) => {
            console.log('Key pressed:', e.key);
            this.handleKeyDown(e);
        });
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        console.log('Player initialized at position:', this.playerMesh.position);
    }

    private handleKeyDown(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        this.keys[key] = true;
        console.log('Active keys:', Object.entries(this.keys).filter(([_, v]) => v).map(([k]) => k));
    }

    private handleKeyUp(event: KeyboardEvent) {
        const key = event.key.toLowerCase();
        this.keys[key] = false;
    }

    public update() {
        // Reset velocity
        this.velocity.set(0, 0, 0);

        // Store initial position for comparison
        const initialPosition = this.playerMesh.position.clone();

        // Update velocity based on input
        if (this.keys['w']) {
            this.velocity.z -= this.moveSpeed;
        }
        if (this.keys['s']) {
            this.velocity.z += this.moveSpeed;
        }
        if (this.keys['a']) {
            this.velocity.x -= this.moveSpeed;
        }
        if (this.keys['d']) {
            this.velocity.x += this.moveSpeed;
        }

        // Normalize diagonal movement
        if (this.velocity.length() > this.moveSpeed) {
            this.velocity.normalize().multiplyScalar(this.moveSpeed);
        }

        // Check if moving
        this.isMoving = this.velocity.length() > 0;

        // Apply velocity to position
        if (this.isMoving) {
            this.playerMesh.position.add(this.velocity);
            
            // Add bobbing motion when moving
            this.bobTimer += 0.15;
            const bobHeight = Math.sin(this.bobTimer) * 0.05;
            this.playerMesh.position.y = 0.4 + bobHeight;

            // Add slight rotation in movement direction
            const angle = Math.atan2(this.velocity.x, this.velocity.z);
            this.playerMesh.rotation.y = angle;
        }

        // Update camera to follow player with slight lag
        const camera = this.scene.getCamera();
        const targetCameraX = this.playerMesh.position.x;
        const targetCameraZ = this.playerMesh.position.z + 10;
        
        camera.position.x += (targetCameraX - camera.position.x) * 0.1;
        camera.position.z += (targetCameraZ - camera.position.z) * 0.1;
        camera.lookAt(this.playerMesh.position);
    }

    public getPosition(): THREE.Vector3 {
        return this.playerMesh.position.clone();
    }
} 