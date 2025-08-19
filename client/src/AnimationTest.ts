// Simple animation test scene - isolated from game complexity
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class AnimationTest {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private gltfLoader = new GLTFLoader();
  private animationMixer?: THREE.AnimationMixer;
  private clock = new THREE.Clock();
  private availableAnimations: THREE.AnimationAction[] = [];
  private currentCharacter?: THREE.Object3D;

  async initialize(canvas: HTMLCanvasElement): Promise<void> {
    // Basic scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 2, 5);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;

    // Basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Simple ground plane
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x90EE90 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    console.log('🎬 Animation test scene initialized');
  }

  async loadCharacter(modelPath: string): Promise<void> {
    try {
      // Clear previous character
      if (this.currentCharacter) {
        this.scene.remove(this.currentCharacter);
      }
      this.availableAnimations = [];
      
      console.log(`📂 Loading: ${modelPath}`);
      const gltf = await this.loadGLTF(modelPath);
      console.log('✅ Model loaded');

      const character = gltf.scene.clone();
      this.currentCharacter = character;
      
      // Try different scales
      character.scale.set(0.5, 0.5, 0.5);
      
      // Keep original materials but ensure visibility
      character.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            // Don't replace the material, just ensure it's visible
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.wireframe = false;
              });
            } else {
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.wireframe = false;
            }
          }
          console.log(`🔴 Verified material for: ${child.name || 'unnamed mesh'}`);
        }
      });

      // Position at origin
      character.position.set(0, 0, 0);
      this.scene.add(character);

      // Check for skeleton and bones
      let skinnedMeshCount = 0;
      let boneCount = 0;
      character.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh) {
          skinnedMeshCount++;
          if (child.skeleton) {
            boneCount += child.skeleton.bones.length;
            console.log(`🦴 SkinnedMesh found: ${child.name || 'unnamed'}, bones: ${child.skeleton.bones.length}`);
            
            // Log actual bone names
            console.log(`🦴 Bone names:`, child.skeleton.bones.map(bone => bone.name));
          }
        }
      });
      console.log(`🦴 Total SkinnedMeshes: ${skinnedMeshCount}, Total bones: ${boneCount}`);

      // Setup animations if they exist
      if (gltf.animations && gltf.animations.length > 0) {
        // Find the SkinnedMesh and create mixer on that instead of the character group
        let skinnedMesh: THREE.SkinnedMesh | null = null;
        character.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh) {
            skinnedMesh = child;
          }
        });
        
        if (skinnedMesh) {
          console.log(`🎭 Creating AnimationMixer on SkinnedMesh: ${skinnedMesh.name}`);
          this.animationMixer = new THREE.AnimationMixer(skinnedMesh);
        } else {
          console.log(`🎭 Creating AnimationMixer on character group`);
          this.animationMixer = new THREE.AnimationMixer(character);
        }
        
        gltf.animations.forEach((clip, index) => {
          console.log(`🎭 Animation ${index}: ${clip.name} (${clip.duration}s)`);
          
          // Debug animation tracks
          console.log(`  📊 Tracks: ${clip.tracks.length}`);
          clip.tracks.forEach((track, trackIndex) => {
            console.log(`    Track ${trackIndex}: ${track.name} (${track.times.length} keyframes)`);
          });
          
          const action = this.animationMixer!.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          
          // Ensure proper interpolation
          action.setEffectiveWeight(1.0);
          action.setEffectiveTimeScale(1.0);
          
          this.availableAnimations.push(action);
        });
        
        // Create animation buttons
        this.createAnimationButtons(gltf.animations);
        
        console.log(`✅ Loaded ${gltf.animations.length} animations`);
      } else {
        console.log('⚠️ No animations found in model');
        this.hideAnimationControls();
      }

      console.log('🎯 Character added to scene');
      
    } catch (error) {
      console.error('❌ Failed to load character:', error);
      
      // Fallback test cube
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      this.scene.add(cube);
      console.log('🟢 Fallback cube added');
    }
  }

  private createAnimationButtons(animations: THREE.AnimationClip[]): void {
    const controlsDiv = document.getElementById('animationControls');
    const buttonsDiv = document.getElementById('animationButtons');
    
    if (controlsDiv && buttonsDiv) {
      // Show controls
      controlsDiv.style.display = 'block';
      
      // Clear existing buttons
      buttonsDiv.innerHTML = '';
      
      // Create button for each animation
      animations.forEach((clip, index) => {
        const button = document.createElement('button');
        button.textContent = `${clip.name} (${clip.duration.toFixed(1)}s)`;
        button.onclick = () => this.playAnimation(index);
        buttonsDiv.appendChild(button);
      });
      
      // Add stop button
      const stopButton = document.createElement('button');
      stopButton.textContent = 'Stop All';
      stopButton.style.background = '#660000';
      stopButton.onclick = () => this.stopAllAnimations();
      buttonsDiv.appendChild(stopButton);
      
      // Add manual bone test button
      const testBoneButton = document.createElement('button');
      testBoneButton.textContent = 'Test Manual Bone';
      testBoneButton.style.background = '#006600';
      testBoneButton.onclick = () => this.testManualBone();
      buttonsDiv.appendChild(testBoneButton);
    }
  }

  private hideAnimationControls(): void {
    const controlsDiv = document.getElementById('animationControls');
    if (controlsDiv) {
      controlsDiv.style.display = 'none';
    }
  }

  playAnimation(index: number): void {
    if (this.availableAnimations[index] && this.animationMixer) {
      // Stop all others
      this.availableAnimations.forEach(action => action.stop());
      
      // Play this one
      const action = this.availableAnimations[index];
      // Reset to start and slow down for visibility
      action.reset();
      action.setEffectiveWeight(1.0);
      action.setEffectiveTimeScale(0.5); // Slow down to half speed
      action.play();
      
      console.log(`▶️ Playing animation ${index}: ${action.getClip().name}`);
      console.log(`🔄 Animation mixer time: ${this.animationMixer.time}`);
      console.log(`⚡ Action enabled: ${action.enabled}, weight: ${action.getEffectiveWeight()}`);
      console.log(`⏱️ Action time: ${action.time}, clip duration: ${action.getClip().duration}`);
      
      // Force an immediate mixer update
      this.animationMixer.update(0.001);
      console.log(`🔄 After forced update - mixer time: ${this.animationMixer.time}, action time: ${action.time}`);
      
      // Debug: Check if bones are actually moving
      if (this.currentCharacter) {
        this.currentCharacter.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            const rootBone = child.skeleton.bones.find(bone => bone.name === 'root');
            if (rootBone) {
              console.log(`🦴 Root bone position: ${rootBone.position.x.toFixed(3)}, ${rootBone.position.y.toFixed(3)}, ${rootBone.position.z.toFixed(3)}`);
              console.log(`🦴 Root bone rotation: ${rootBone.rotation.x.toFixed(3)}, ${rootBone.rotation.y.toFixed(3)}, ${rootBone.rotation.z.toFixed(3)}`);
            }
          }
        });
      }
      
      // Check if character has SkinnedMesh
      if (this.currentCharacter) {
        let hasSkinnedMesh = false;
        this.currentCharacter.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh) {
            hasSkinnedMesh = true;
            console.log(`🦴 SkinnedMesh '${child.name}' - bone count: ${child.skeleton?.bones.length || 0}`);
          }
        });
        if (!hasSkinnedMesh) {
          console.warn('⚠️ No SkinnedMesh found - animations will not be visible');
        }
      }
    } else {
      console.error('❌ Animation or mixer not available');
    }
  }

  stopAllAnimations(): void {
    this.availableAnimations.forEach(action => action.stop());
    console.log('⏹️ Stopped all animations');
  }

  testManualBone(): void {
    if (this.currentCharacter) {
      this.currentCharacter.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          const rootBone = child.skeleton.bones.find(bone => bone.name === 'root');
          if (rootBone) {
            // Manually move the root bone
            rootBone.position.y += 0.5;
            rootBone.rotation.z += 0.2;
            console.log(`🔧 Manually moved root bone - pos: ${rootBone.position.y}, rot: ${rootBone.rotation.z}`);
            
            // Force updates - CRITICAL for SkinnedMesh
            rootBone.updateMatrixWorld(true);
            child.skeleton.update();
            
            // Force mesh to update its geometry
            if (child.geometry) {
              child.geometry.attributes.position.needsUpdate = true;
              child.geometry.attributes.normal.needsUpdate = true;
            }
            
            console.log(`🔧 Forced mesh updates`);
          }
        }
      });
    } else {
      console.error('❌ No character loaded');
    }
  }

  private loadGLTF(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(url, resolve, undefined, reject);
    });
  }

  start(): void {
    this.animate();
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    
    const deltaTime = this.clock.getDelta();
    
    // Update animations
    if (this.animationMixer) {
      this.animationMixer.update(deltaTime);
      
      // Force skeleton update for all skinned meshes - CRITICAL for SkinnedMesh
      if (this.currentCharacter) {
        this.currentCharacter.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Update all bone matrices
            child.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
            child.skeleton.update();
            
            // Force mesh geometry updates
            if (child.geometry) {
              child.geometry.attributes.position.needsUpdate = true;
              if (child.geometry.attributes.normal) {
                child.geometry.attributes.normal.needsUpdate = true;
              }
            }
          }
        });
      }
    }
    
    this.renderer.render(this.scene, this.camera);
  };
}