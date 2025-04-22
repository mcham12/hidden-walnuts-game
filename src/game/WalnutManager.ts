import * as THREE from 'three';
import { Scene } from './Scene';

interface Walnut {
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    hidden: boolean;
    points: number;
}

export class WalnutManager {
    private scene: Scene;
    private walnuts: Walnut[] = [];
    private walnutGeometry: THREE.SphereGeometry;
    private walnutMaterial: THREE.MeshStandardMaterial;

    constructor(scene: Scene) {
        this.scene = scene;
        this.walnutGeometry = new THREE.SphereGeometry(0.3);
        this.walnutMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    }

    public hideWalnut(position: THREE.Vector3) {
        const walnut: Walnut = {
            mesh: new THREE.Mesh(this.walnutGeometry, this.walnutMaterial),
            position: position.clone(),
            hidden: true,
            points: 2 // Default points for player-hidden walnuts
        };

        walnut.mesh.position.copy(position);
        this.scene.getScene().add(walnut.mesh);
        this.walnuts.push(walnut);

        // Send walnut data to server
        this.sendWalnutToServer(walnut);
    }

    private async sendWalnutToServer(walnut: Walnut) {
        try {
            const response = await fetch('/api/walnut', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    position: {
                        x: walnut.position.x,
                        y: walnut.position.y,
                        z: walnut.position.z
                    },
                    points: walnut.points
                })
            });

            if (!response.ok) {
                console.error('Failed to send walnut data to server');
            }
        } catch (error) {
            console.error('Error sending walnut data:', error);
        }
    }
} 