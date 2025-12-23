import { Howl, Howler } from 'howler';

export type SoundType = 'hide' | 'find' | 'footstep' | 'ui' | 'ambient' | 'combat' | 'player' | 'music';
export type VolumeCategory = 'sfx' | 'ambient' | 'music' | 'master';

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
    music: 0.4,
    master: 1.0,
  };
  private isMuted: boolean = false;
  private ambientSound: Howl | null = null;
  private musicSound: Howl | null = null;
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

    // MVP 16: Game start sound (reuse score pop for positive feedback)
    this.loadSound('game_start', {
      src: ['/sounds/mixkit-arcade-mechanical-bling-210.wav'],
      volume: 0.7,
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

    // MVP 11: Combat sounds
    this.loadSound('throw_walnut', {
      src: ['/sounds/thrown_walnut.mp3'],
      volume: 0.6,
    });

    this.loadSound('walnut_hit', {
      src: ['/sounds/walnut_hit_player.mp3'],
      volume: 0.7,
    });

    this.loadSound('walnut_miss', {
      src: ['/sounds/walnut_miss_player_and_drop_from_tree.mp3'],
      volume: 0.5,
    });

    // MVP 11: Player sounds
    this.loadSound('walnut_found', {
      src: ['/sounds/Walnut_found.mp3'],
      volume: 0.7,
    });

    this.loadSound('walnut_eat', {
      src: ['/sounds/walnut_eat.mp3'],
      volume: 0.6,
    });

    this.loadSound('health_boost', {
      src: ['/sounds/healthboost-localplayer.mp3'],
      volume: 0.7,
    });

    this.loadSound('player_death', {
      src: ['/sounds/death_sound_localplayer.mp3'],
      volume: 0.8,
    });

    this.loadSound('player_eliminated', {
      src: ['/sounds/Eliminate_remoteplayer_or_NPC.mp3'],
      volume: 0.7,
    });

    this.loadSound('walking', {
      src: ['/sounds/walking_localplayer.mp3'],
      volume: 0.4,
      loop: true,
    });

    this.loadSound('player_collision', {
      src: ['/sounds/player_collision.mp3'],
      volume: 0.25,
    });

    this.loadSound('tree_growth', {
      src: ['/sounds/tree_growth.mp3'],
      volume: 0.7,
    });

    // MVP 12: Predator sounds
    this.loadSound('flying_predator_nearby', {
      src: ['/sounds/flying_predator_nearby.mp3'],
      volume: 0.6,
    });

    this.loadSound('flying_predator_attack', {
      src: ['/sounds/flying_predator_attack.mp3'],
      volume: 0.8,
    });

    this.loadSound('ground_predator_nearby', {
      src: ['/sounds/ground_predator_nearby.mp3'],
      volume: 0.6,
    });

    this.loadSound('ground_predator_attack', {
      src: ['/sounds/ground_predator_attack.mp3'],
      volume: 0.8,
    });

    // MVP 11: Ambient forest sounds
    this.loadSound('ambient_forest', {
      src: ['/sounds/forest-ambience.mp3'],
      volume: 0.3,
      loop: true,
    });

    // MVP 11: Background music
    this.loadSound('game_music', {
      src: ['/sounds/game-music-loop.mp3'],
      volume: 0.35,
      loop: true,
    });
  }

  /**
   * Load a sound into the manager
   * iOS Safari best practice: Use HTML5 Audio for mobile, Web Audio for desktop
   */
  private loadSound(id: string, config: SoundConfig): void {
    try {
      // Create a Promise that resolves when the sound finishes loading
      const loadPromise = new Promise<void>((resolve) => {
        // STRATEGY CHANGE: On mobile, only use HTML5 Audio for long tracks (music/ambient)
        // Short SFX should use Web Audio to avoid the iOS limit on concurrent HTML5 audio elements
        const isLongTrack = id === 'game_music' || id === 'ambient_forest';
        const useHtml5 = this.isMobile && isLongTrack;

        const sound = new Howl({
          src: config.src,
          volume: config.volume,
          loop: config.loop || false,
          sprite: config.sprite,
          preload: true,
          // CRITICAL iOS FIX: Use HTML5 Audio ONLY for long tracks on mobile
          // Web Audio API is better for SFX (low latency, high concurrency)
          html5: useHtml5,
          // iOS-specific optimization: Smaller pool on mobile (iOS limits concurrent audio)
          pool: this.isMobile ? (useHtml5 ? 1 : 5) : 5,
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
            console.log(`🎵 AudioManager: Loaded sound "${id}" (${useHtml5 ? 'HTML5' : 'Web Audio'})`);
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
        soundId = variant || 'walnut_found'; // MVP 11: Use new walnut_found sound
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
      case 'music':
        this.playMusic();
        return;
      case 'combat':
        // MVP 11: Combat sounds (throw, hit, miss)
        soundId = variant || 'throw_walnut';
        break;
      case 'player':
        // MVP 11: Player event sounds (eat, death, health_boost, eliminated)
        soundId = variant || 'walnut_eat';
        break;
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
   * MVP 11: Play background music
   * NOTE: unlock() must be called ONCE before using this
   * Strategy: Use ambient sounds primarily, layer music quietly for atmosphere
   */
  playMusic(): void {
    if (this.isMuted) return;

    const music = this.sounds.get('game_music');
    if (music && !music.playing()) {
      const effectiveVolume = this.calculateEffectiveVolume('music');
      music.volume(effectiveVolume);
      music.play();
      this.musicSound = music;
    }
  }

  /**
   * Stop background music
   */
  stopMusic(): void {
    if (this.musicSound) {
      this.musicSound.stop();
    }
  }

  /**
   * MVP 11: Start both ambient sounds and music (layered approach)
   * Ambient provides nature sounds, music adds emotional atmosphere
   */
  startBackgroundAudio(): void {
    // Play ambient forest sounds at normal volume
    this.playAmbient();

    // Layer music quietly underneath for emotional depth
    this.playMusic();
  }

  /**
   * Stop all background audio
   */
  stopBackgroundAudio(): void {
    this.stopAmbient();
    this.stopMusic();
  }

  /**
   * Set volume for a category (sfx, ambient, music, or master)
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
  private calculateEffectiveVolume(category: 'sfx' | 'ambient' | 'music'): number {
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

    // Update music if playing
    if (this.musicSound && this.musicSound.playing()) {
      const effectiveVolume = this.calculateEffectiveVolume('music');
      this.musicSound.volume(effectiveVolume);
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
