import * as THREE from 'three';

export type ParticleType = 'dirt' | 'sparkle' | 'dust' | 'confetti';

interface ScorePopup {
  element: HTMLElement;
  startTime: number;
  duration: number;
}

/**
 * VFXManager handles all visual effects in the game
 * - Particle systems (dirt, sparkles, dust, confetti)
 * - Score pop-ups
 * - Screen shake
 * - Player glow effects
 */
export class VFXManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private particleSystems: Map<string, THREE.Points> = new Map();
  private scorePopups: ScorePopup[] = [];
  private popupContainer: HTMLElement | null = null;
  private shakeOffset = new THREE.Vector3();
  private isShaking: boolean = false;
  private shakeStartTime: number = 0;
  private shakeDuration: number = 0;
  private shakeIntensity: number = 0;

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;

    // Create popup container if it doesn't exist
    this.popupContainer = document.getElementById('score-popups');
    if (!this.popupContainer) {
      this.popupContainer = document.createElement('div');
      this.popupContainer.id = 'score-popups';
      this.popupContainer.style.position = 'absolute';
      this.popupContainer.style.top = '0';
      this.popupContainer.style.left = '0';
      this.popupContainer.style.width = '100%';
      this.popupContainer.style.height = '100%';
      this.popupContainer.style.pointerEvents = 'none';
      this.popupContainer.style.zIndex = '100';
      document.body.appendChild(this.popupContainer);
    }
  }

  /**
   * Spawn particle effect at a position
   */
  spawnParticles(type: ParticleType, position: THREE.Vector3, count: number = 20): void {
    const particles = this.createParticleSystem(type, position, count);
    const particleId = `${type}-${Date.now()}-${Math.random()}`;
    this.particleSystems.set(particleId, particles);
    this.scene.add(particles);

    // Remove after animation completes
    setTimeout(() => {
      this.scene.remove(particles);
      particles.geometry.dispose();
      (particles.material as THREE.Material).dispose();
      this.particleSystems.delete(particleId);
    }, 2000); // 2 second lifetime
  }

  /**
   * Create a particle system based on type
   */
  private createParticleSystem(type: ParticleType, position: THREE.Vector3, count: number): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const velocities: number[] = [];
    const colors: number[] = [];

    let color: THREE.Color;
    let spread: number;

    switch (type) {
      case 'dirt':
        color = new THREE.Color(0x8B4513); // Brown
        spread = 0.5;
        break;
      case 'sparkle':
        color = new THREE.Color(0xFFD700); // Gold
        spread = 1.0;
        break;
      case 'dust':
        color = new THREE.Color(0xD2B48C); // Tan
        spread = 0.3;
        break;
      case 'confetti':
        color = new THREE.Color(0xFFFFFF); // Will randomize per particle
        spread = 1.5;
        break;
    }

    for (let i = 0; i < count; i++) {
      // Random position around spawn point
      positions.push(
        position.x + (Math.random() - 0.5) * spread,
        position.y + Math.random() * 0.2,
        position.z + (Math.random() - 0.5) * spread
      );

      // Random velocity (upward bias)
      velocities.push(
        (Math.random() - 0.5) * 2,
        Math.random() * 3 + 1, // Upward
        (Math.random() - 0.5) * 2
      );

      // Color variation
      if (type === 'confetti') {
        // Random bright colors for confetti
        const randomColor = new THREE.Color().setHSL(Math.random(), 1.0, 0.5);
        colors.push(randomColor.r, randomColor.g, randomColor.b);
      } else {
        colors.push(color.r, color.g, color.b);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Store velocities for animation
    (geometry.userData as any).velocities = velocities;
    (geometry.userData as any).startTime = Date.now();

    const material = new THREE.PointsMaterial({
      size: type === 'confetti' ? 0.2 : (type === 'dust' ? 0.03 : 0.1),
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Update particle systems (call in animation loop)
   */
  updateParticles(delta: number): void {
    this.particleSystems.forEach((particles) => {
      const geometry = particles.geometry;
      const positions = geometry.attributes.position.array as Float32Array;
      const velocities = (geometry.userData as any).velocities;
      const startTime = (geometry.userData as any).startTime;
      const elapsed = (Date.now() - startTime) / 1000;

      if (!velocities) return;

      // Update positions based on velocities and gravity
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += velocities[i] * delta;
        positions[i + 1] += velocities[i + 1] * delta;
        positions[i + 2] += velocities[i + 2] * delta;

        // Apply gravity
        velocities[i + 1] -= 9.8 * delta;
      }

      geometry.attributes.position.needsUpdate = true;

      // Fade out over time
      const material = particles.material as THREE.PointsMaterial;
      material.opacity = Math.max(0, 1 - elapsed / 2);
    });
  }

  /**
   * Show animated score pop-up (+X points!)
   */
  showScorePopup(points: number, position: THREE.Vector3): void {
    if (!this.popupContainer) return;

    // Create score element
    const element = document.createElement('div');
    element.textContent = `+${points}`;
    element.style.position = 'absolute';
    element.style.fontSize = points >= 3 ? '32px' : '24px';
    element.style.fontWeight = 'bold';
    element.style.color = points >= 3 ? '#FFD700' : '#90EE90';
    element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
    element.style.pointerEvents = 'none';
    element.style.transition = 'all 1s ease-out';
    element.style.zIndex = '101';

    // Convert 3D position to screen position
    const vector = position.clone();
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.transform = 'translate(-50%, -50%)';

    this.popupContainer.appendChild(element);

    // Animate upward and fade
    requestAnimationFrame(() => {
      element.style.transform = 'translate(-50%, -150%)';
      element.style.opacity = '0';
    });

    // Track for cleanup
    this.scorePopups.push({
      element,
      startTime: Date.now(),
      duration: 1000
    });

    // Remove after animation
    setTimeout(() => {
      if (this.popupContainer && element.parentNode) {
        this.popupContainer.removeChild(element);
      }
      this.scorePopups = this.scorePopups.filter(p => p.element !== element);
    }, 1000);
  }

  /**
   * MVP 8: Show animated damage floater (-X health!)
   * Displays red damage numbers that float up and fade
   */
  showDamageFloater(damage: number, position: THREE.Vector3): void {
    console.log(`💥 showDamageFloater called: damage=${damage}, position=`, position);

    if (!this.popupContainer) {
      console.error('❌ DAMAGE FLOATER: popupContainer is null!');
      return;
    }

    console.log('✅ DAMAGE FLOATER: popupContainer exists:', this.popupContainer);

    // Create damage element
    const element = document.createElement('div');
    element.textContent = `-${damage}`;
    element.style.position = 'absolute';
    element.style.fontSize = '28px';
    element.style.fontWeight = 'bold';
    element.style.color = '#FF4444'; // Red for damage
    element.style.textShadow = '2px 2px 4px rgba(0,0,0,0.9)';
    element.style.pointerEvents = 'none';
    element.style.transition = 'all 1s ease-out';
    element.style.zIndex = '101';

    // Convert 3D position to screen position
    const vector = position.clone();
    vector.project(this.camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    console.log(`📍 DAMAGE FLOATER: Screen position: x=${x.toFixed(0)}, y=${y.toFixed(0)} (window: ${window.innerWidth}x${window.innerHeight})`);

    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.transform = 'translate(-50%, -50%)';
    element.style.opacity = '1'; // Explicitly set initial opacity

    this.popupContainer.appendChild(element);
    console.log('✅ DAMAGE FLOATER: Element appended to container');

    // Animate upward and fade
    requestAnimationFrame(() => {
      element.style.transform = 'translate(-50%, -150%)';
      element.style.opacity = '0';
      console.log('🎬 DAMAGE FLOATER: Animation started');
    });

    // Track for cleanup
    this.scorePopups.push({
      element,
      startTime: Date.now(),
      duration: 1000
    });

    // Remove after animation
    setTimeout(() => {
      if (this.popupContainer && element.parentNode) {
        this.popupContainer.removeChild(element);
        console.log('🗑️ DAMAGE FLOATER: Element removed after animation');
      }
      this.scorePopups = this.scorePopups.filter(p => p.element !== element);
    }, 1000);
  }

  /**
   * Trigger screen shake effect
   */
  screenShake(intensity: number = 0.1, duration: number = 0.3): void {
    this.isShaking = true;
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeStartTime = Date.now();
  }

  /**
   * Update screen shake (call in animation loop)
   */
  updateScreenShake(): THREE.Vector3 {
    if (!this.isShaking) {
      return new THREE.Vector3(0, 0, 0);
    }

    const elapsed = (Date.now() - this.shakeStartTime) / 1000;

    if (elapsed >= this.shakeDuration) {
      this.isShaking = false;
      return new THREE.Vector3(0, 0, 0);
    }

    // Decay intensity over time
    const decay = 1 - (elapsed / this.shakeDuration);
    const currentIntensity = this.shakeIntensity * decay;

    // Random offset
    this.shakeOffset.set(
      (Math.random() - 0.5) * currentIntensity,
      (Math.random() - 0.5) * currentIntensity,
      (Math.random() - 0.5) * currentIntensity
    );

    return this.shakeOffset;
  }

  /**
   * Add glow effect to player
   */
  playerGlow(playerMesh: THREE.Object3D, duration: number = 0.5, color: THREE.Color = new THREE.Color(0xFFD700)): void {
    // Create glow sphere around player
    const glowGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    glowSphere.position.copy(playerMesh.position);
    glowSphere.position.y += 1; // Center on player
    this.scene.add(glowSphere);

    // Animate glow
    const startTime = Date.now();
    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      if (elapsed >= duration) {
        this.scene.remove(glowSphere);
        glowGeometry.dispose();
        glowMaterial.dispose();
        return;
      }

      // Pulse and fade
      const progress = elapsed / duration;
      glowMaterial.opacity = 0.5 * (1 - progress);
      glowSphere.scale.set(1 + progress * 0.5, 1 + progress * 0.5, 1 + progress * 0.5);

      requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Update all VFX systems (call once per frame)
   */
  update(delta: number): void {
    this.updateParticles(delta);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    // Remove all particle systems
    this.particleSystems.forEach((particles) => {
      this.scene.remove(particles);
      particles.geometry.dispose();
      (particles.material as THREE.Material).dispose();
    });
    this.particleSystems.clear();

    // Remove all score popups
    if (this.popupContainer) {
      this.scorePopups.forEach(popup => {
        if (popup.element.parentNode) {
          this.popupContainer!.removeChild(popup.element);
        }
      });
      this.scorePopups = [];
    }
  }
}
