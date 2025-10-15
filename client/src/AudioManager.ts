import { Howl, Howler } from 'howler';

export type SoundType = 'hide' | 'find' | 'footstep' | 'ui' | 'ambient';
export type VolumeCategory = 'sfx' | 'ambient' | 'master';

interface SoundConfig {
  src: string[];
  volume: number;
  loop?: boolean;
  sprite?: { [key: string]: [number, number] };
}

/**
 * AudioManager handles all audio playback in the game
 * Uses Howler.js for cross-browser audio support
 */
export class AudioManager {
  private sounds: Map<string, Howl> = new Map();
  private volumes: Record<VolumeCategory, number> = {
    sfx: 0.7,
    ambient: 0.5,
    master: 1.0,
  };
  private isMuted: boolean = false;
  private ambientSound: Howl | null = null;
  private isUnlocked: boolean = false;
  private loadingPromises: Promise<void>[] = [];
  private isFullyLoaded: boolean = false;
  private isMobile: boolean = false;

  constructor() {
    // Detect mobile for iOS-specific audio handling
    this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                    (typeof navigator.maxTouchPoints !== 'undefined' && navigator.maxTouchPoints > 2);

    console.log('🎵 AudioManager: Mobile detected:', this.isMobile);
    this.initializeSounds();
  }

  /**
   * Wait for all sounds to finish loading
   * CRITICAL: Must be called before playing any sounds to ensure zero delay
   */
  async waitForLoad(): Promise<void> {
    if (this.isFullyLoaded) return;
    await Promise.all(this.loadingPromises);
    this.isFullyLoaded = true;
  }

  /**
   * Unlock audio context on first user interaction
   * iOS Safari requires ACTUAL audio playback on user gesture to unlock
   * This is the most critical method for iOS Safari audio support
   */
  async unlock(): Promise<void> {
    if (this.isUnlocked) {
      console.log('🎵 AudioManager: Already unlocked');
      return;
    }

    console.log('🎵 AudioManager: Unlocking audio context...');

    try {
      // CRITICAL iOS FIX: Play a real sound (not just play+stop) to unlock
      // iOS requires actual audio playback on first user gesture
      const unlockSound = this.sounds.get('button_click');
      if (unlockSound) {
        // Play at very low volume so it's barely audible (iOS unlock primer)
        const originalVolume = unlockSound.volume();
        unlockSound.volume(0.01);

        // Play and let it actually play (don't stop immediately!)
        const soundId = unlockSound.play();

        // Wait a tiny bit for the sound to actually start playing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Stop after unlock
        unlockSound.stop(soundId);
        unlockSound.volume(originalVolume);

        console.log('🎵 AudioManager: Unlock sound played');
      }

      // Ensure Howler context is created
      if (!Howler.ctx) {
        console.warn('🎵 AudioManager: No audio context after unlock attempt');
      }

      // Resume AudioContext if suspended (iOS Safari requirement)
      if (Howler.ctx && Howler.ctx.state === 'suspended') {
        console.log('🎵 AudioManager: Resuming suspended context...');
        await Howler.ctx.resume();
        console.log('🎵 AudioManager: Context state:', Howler.ctx.state);
      }

      // Verify context is running
      if (Howler.ctx && Howler.ctx.state === 'running') {
        this.isUnlocked = true;
        console.log('✅ AudioManager: Successfully unlocked!');
      } else {
        console.warn('⚠️ AudioManager: Context not running after unlock');
        // Mark as unlocked anyway - user has interacted, so subsequent plays should work
        this.isUnlocked = true;
      }
    } catch (error) {
      console.error('❌ AudioManager: Unlock failed:', error);
      // Mark as unlocked anyway to allow subsequent attempts
      this.isUnlocked = true;
    }
  }

  /**
   * Initialize sound library with actual WAV files
   */
  private initializeSounds(): void {
    // Walnut action sounds
    this.loadSound('hide', {
      src: ['/sounds/mixkit-mechanical-crate-pick-up-3154.wav'],
      volume: 0.7,
    });

    this.loadSound('find', {
      src: ['/sounds/mixkit-video-game-treasure-2066.wav'],
      volume: 0.8,
    });

    this.loadSound('find_big', {
      src: ['/sounds/mixkit-final-level-bonus-2061.wav'],
      volume: 0.9,
    });

    // Movement sounds
    this.loadSound('footstep_grass', {
      src: ['/sounds/mixkit-game-ball-tap-2073.wav'],
      volume: 0.2,
    });

    this.loadSound('footstep_dirt', {
      src: ['/sounds/mixkit-game-ball-tap-2073.wav'],
      volume: 0.2,
    });

    this.loadSound('footstep_leaves', {
      src: ['/sounds/mixkit-game-ball-tap-2073.wav'],
      volume: 0.2,
    });

    // UI sounds
    this.loadSound('button_click', {
      src: ['/sounds/mixkit-game-ball-tap-2073.wav'],
      volume: 0.5,
    });

    this.loadSound('score_pop', {
      src: ['/sounds/mixkit-arcade-mechanical-bling-210.wav'],
      volume: 0.6,
    });

    // Jump sound
    this.loadSound('jump', {
      src: ['/sounds/mixkit-player-jumping-in-a-video-game-2043.wav'],
      volume: 0.5,
    });

    // MVP 5: Chat and emote sounds
    this.loadSound('chat_send', {
      src: ['/sounds/mixkit-game-ball-tap-2073.wav'],
      volume: 0.4,
    });

    this.loadSound('chat_receive', {
      src: ['/sounds/mixkit-quick-positive-video-game-notification-interface-265.wav'],
      volume: 0.5,
    });

    this.loadSound('emote_send', {
      src: ['/sounds/mixkit-unlock-new-item-game-notification-254.wav'],
      volume: 0.6,
    });

    this.loadSound('emote_receive', {
      src: ['/sounds/mixkit-explainer-video-game-alert-sweep-236.wav'],
      volume: 0.5,
    });

    // Ambient forest sounds (placeholder - none available yet)
    // TODO: Uncomment when we have a real ambient sound file
    // this.loadSound('ambient_forest', {
    //   src: ['/sounds/forest_ambient.mp3'],
    //   volume: 0.3,
    //   loop: true,
    // });
  }

  /**
   * Load a sound into the manager
   * iOS Safari best practice: Use HTML5 Audio for mobile, Web Audio for desktop
   */
  private loadSound(id: string, config: SoundConfig): void {
    try {
      // Create a Promise that resolves when the sound finishes loading
      const loadPromise = new Promise<void>((resolve) => {
        const sound = new Howl({
          src: config.src,
          volume: config.volume,
          loop: config.loop || false,
          sprite: config.sprite,
          preload: true,
          // CRITICAL iOS FIX: Use HTML5 Audio on mobile for better compatibility
          // Web Audio API has stricter restrictions on iOS Safari
          html5: this.isMobile,
          // iOS-specific optimization: Smaller pool on mobile (iOS limits concurrent audio)
          pool: this.isMobile ? 3 : 5,
          onloaderror: (_soundId, error) => {
            console.warn(`🎵 AudioManager: Failed to load sound "${id}":`, error);
            // Don't reject - allow game to continue without this sound
            resolve();
          },
          onplayerror: (_soundId, error) => {
            console.warn(`🎵 AudioManager: Failed to play sound "${id}":`, error);
            // Try to unlock and resume context on play error (iOS Safari quirk)
            if (Howler.ctx && Howler.ctx.state === 'suspended') {
              Howler.ctx.resume().then(() => {
                console.log('🎵 AudioManager: Resumed context after play error');
              });
            }
          },
          onload: () => {
            console.log(`🎵 AudioManager: Loaded sound "${id}"`);
            resolve();
          },
        });

        this.sounds.set(id, sound);
      });

      // Track this loading promise
      this.loadingPromises.push(loadPromise);
    } catch (error) {
      console.error(`❌ AudioManager: Error creating sound "${id}":`, error);
    }
  }

  /**
   * Play a sound effect
   * iOS Safari: This will only work after unlock() has been called
   */
  playSound(type: SoundType, variant?: string): void {
    if (this.isMuted) return;

    // iOS Safari warning: Audio won't play until unlock() is called
    if (!this.isUnlocked && this.isMobile) {
      console.warn('🎵 AudioManager: Audio not unlocked yet (iOS requires user interaction)');
    }

    let soundId: string;

    switch (type) {
      case 'hide':
        soundId = 'hide';
        break;
      case 'find':
        soundId = 'find';
        break;
      case 'footstep':
        soundId = variant ? `footstep_${variant}` : 'footstep_grass';
        break;
      case 'ui':
        soundId = variant || 'button_click';
        break;
      case 'ambient':
        this.playAmbient();
        return;
      default:
        console.warn(`🎵 AudioManager: Unknown sound type "${type}"`);
        return;
    }

    const sound = this.sounds.get(soundId);
    if (sound) {
      try {
        const effectiveVolume = this.calculateEffectiveVolume('sfx');
        sound.volume(effectiveVolume);
        sound.play();
      } catch (error) {
        console.warn(`🎵 AudioManager: Error playing sound "${soundId}":`, error);
        // iOS Safari: Try to auto-resume context on play error
        if (this.isMobile && Howler.ctx && Howler.ctx.state !== 'running') {
          console.log('🎵 AudioManager: Attempting to resume context...');
          Howler.ctx.resume();
        }
      }
    } else {
      console.warn(`🎵 AudioManager: Sound "${soundId}" not found`);
    }
  }

  /**
   * Play ambient background sounds
   * NOTE: unlock() must be called ONCE before using this
   */
  playAmbient(): void {
    if (this.isMuted) return;

    const ambient = this.sounds.get('ambient_forest');
    if (ambient && !ambient.playing()) {
      const effectiveVolume = this.calculateEffectiveVolume('ambient');
      ambient.volume(effectiveVolume);
      ambient.play();
      this.ambientSound = ambient;
    } else if (!ambient) {
      // Ambient sound not loaded yet (waiting for actual audio file)
      console.log('AudioManager: Ambient sound not available yet');
    }
  }

  /**
   * Stop ambient sounds
   */
  stopAmbient(): void {
    if (this.ambientSound) {
      this.ambientSound.stop();
    }
  }

  /**
   * Set volume for a category (sfx, ambient, or master)
   */
  setVolume(category: VolumeCategory, level: number): void {
    // Clamp level between 0 and 1
    level = Math.max(0, Math.min(1, level));
    this.volumes[category] = level;

    // Update all playing sounds
    this.updateAllVolumes();

    console.log(`AudioManager: ${category} volume set to ${level}`);
  }

  /**
   * Get volume for a category
   */
  getVolume(category: VolumeCategory): number {
    return this.volumes[category];
  }

  /**
   * Calculate effective volume considering category and master volume
   */
  private calculateEffectiveVolume(category: 'sfx' | 'ambient'): number {
    return this.volumes[category] * this.volumes.master;
  }

  /**
   * Update volumes for all sounds
   */
  private updateAllVolumes(): void {
    // Update ambient sound if playing
    if (this.ambientSound && this.ambientSound.playing()) {
      const effectiveVolume = this.calculateEffectiveVolume('ambient');
      this.ambientSound.volume(effectiveVolume);
    }

    // Note: Individual SFX volumes are updated when played
  }

  /**
   * Toggle mute on/off
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    Howler.mute(this.isMuted);
    console.log(`AudioManager: ${this.isMuted ? 'Muted' : 'Unmuted'}`);
    return this.isMuted;
  }

  /**
   * Get current mute state
   */
  isMutedState(): boolean {
    return this.isMuted;
  }

  /**
   * Set mute state
   */
  setMute(muted: boolean): void {
    this.isMuted = muted;
    Howler.mute(muted);
  }

  /**
   * Cleanup - stop all sounds
   */
  dispose(): void {
    this.sounds.forEach(sound => sound.unload());
    this.sounds.clear();
    Howler.unload();
  }
}
