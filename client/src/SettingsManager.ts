import { AudioManager } from './AudioManager';

/**
 * SettingsManager - Handles game settings and UI controls
 */
export class SettingsManager {
  private audioManager: AudioManager;
  private isOpen: boolean = false;

  // Settings state
  private settings = {
    masterVolume: 1.0,
    sfxVolume: 0.7,
    ambientVolume: 0.5,
    mouseSensitivity: 1.0,
    isMuted: false,
  };

  // DOM elements
  private overlay: HTMLElement;
  private toggleButton: HTMLElement;
  private applyButton: HTMLElement;
  private cancelButton: HTMLElement;
  private tabs: NodeListOf<HTMLElement>;
  private tabContents: NodeListOf<HTMLElement>;

  // Audio sliders
  private masterVolumeSlider: HTMLInputElement;
  private sfxVolumeSlider: HTMLInputElement;
  private ambientVolumeSlider: HTMLInputElement;
  private muteCheckbox: HTMLInputElement;

  // Other controls
  private sensitivitySlider: HTMLInputElement;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;

    // Get DOM elements
    this.overlay = document.getElementById('settings-overlay')!;
    this.toggleButton = document.getElementById('settings-toggle')!;
    this.applyButton = document.getElementById('settings-apply')!;
    this.cancelButton = document.getElementById('settings-cancel')!;
    this.tabs = document.querySelectorAll('.settings-tab');
    this.tabContents = document.querySelectorAll('.settings-content');

    // Audio controls
    this.masterVolumeSlider = document.getElementById('master-volume') as HTMLInputElement;
    this.sfxVolumeSlider = document.getElementById('sfx-volume') as HTMLInputElement;
    this.ambientVolumeSlider = document.getElementById('ambient-volume') as HTMLInputElement;
    this.muteCheckbox = document.getElementById('mute-toggle') as HTMLInputElement;

    // Other controls
    this.sensitivitySlider = document.getElementById('mouse-sensitivity') as HTMLInputElement;

    this.setupEventListeners();
    this.loadSettings();
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Open settings
    this.toggleButton.addEventListener('click', () => this.open());

    // Close settings
    this.applyButton.addEventListener('click', () => this.applyAndClose());
    this.cancelButton.addEventListener('click', () => this.cancel());

    // ESC key to open/close settings
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isOpen) {
          this.cancel();
        } else {
          this.open();
        }
      }
    });

    // Tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName!);
      });
    });

    // Audio sliders
    this.masterVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.masterVolumeSlider.value) / 100;
      this.updateSliderDisplay('master-volume-value', value);
    });

    this.sfxVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.sfxVolumeSlider.value) / 100;
      this.updateSliderDisplay('sfx-volume-value', value);
    });

    this.ambientVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.ambientVolumeSlider.value) / 100;
      this.updateSliderDisplay('ambient-volume-value', value);
    });

    // Sensitivity slider
    this.sensitivitySlider.addEventListener('input', () => {
      const value = parseInt(this.sensitivitySlider.value) / 100;
      this.updateSliderDisplay('sensitivity-value', value);
    });

    // Mute checkbox
    this.muteCheckbox.addEventListener('change', () => {
      // Apply mute immediately for preview
      this.audioManager.setMute(this.muteCheckbox.checked);
    });
  }

  /**
   * Update slider display value
   */
  private updateSliderDisplay(elementId: string, value: number): void {
    const display = document.getElementById(elementId);
    if (display) {
      display.textContent = `${Math.round(value * 100)}%`;
    }
  }

  /**
   * Switch between tabs
   */
  private switchTab(tabName: string): void {
    // Update tab buttons
    this.tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update tab content
    this.tabContents.forEach(content => {
      if (content.id === `${tabName}-tab`) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  /**
   * Open settings menu
   */
  open(): void {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');

    // Play UI sound
    this.audioManager.playSound('ui', 'button_click');
  }

  /**
   * Apply settings and close
   */
  applyAndClose(): void {
    this.applySettings();
    this.close();

    // Play UI sound
    this.audioManager.playSound('ui', 'button_click');
  }

  /**
   * Cancel and revert changes
   */
  cancel(): void {
    this.loadSettings(); // Revert to saved values
    this.close();

    // Play UI sound
    this.audioManager.playSound('ui', 'button_click');
  }

  /**
   * Close settings menu
   */
  private close(): void {
    this.isOpen = false;
    this.overlay.classList.add('hidden');
  }

  /**
   * Apply current settings
   */
  private applySettings(): void {
    // Update settings state
    this.settings.masterVolume = parseInt(this.masterVolumeSlider.value) / 100;
    this.settings.sfxVolume = parseInt(this.sfxVolumeSlider.value) / 100;
    this.settings.ambientVolume = parseInt(this.ambientVolumeSlider.value) / 100;
    this.settings.mouseSensitivity = parseInt(this.sensitivitySlider.value) / 100;
    this.settings.isMuted = this.muteCheckbox.checked;

    // Apply to audio manager
    this.audioManager.setVolume('master', this.settings.masterVolume);
    this.audioManager.setVolume('sfx', this.settings.sfxVolume);
    this.audioManager.setVolume('ambient', this.settings.ambientVolume);
    this.audioManager.setMute(this.settings.isMuted);

    // Save to localStorage
    this.saveSettings();

    // Dispatch event for other systems (e.g., camera sensitivity)
    window.dispatchEvent(new CustomEvent('settingsChanged', {
      detail: this.settings
    }));
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('gameSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }

    // Apply to UI
    this.masterVolumeSlider.value = String(Math.round(this.settings.masterVolume * 100));
    this.sfxVolumeSlider.value = String(Math.round(this.settings.sfxVolume * 100));
    this.ambientVolumeSlider.value = String(Math.round(this.settings.ambientVolume * 100));
    this.sensitivitySlider.value = String(Math.round(this.settings.mouseSensitivity * 100));
    this.muteCheckbox.checked = this.settings.isMuted;

    // Update displays
    this.updateSliderDisplay('master-volume-value', this.settings.masterVolume);
    this.updateSliderDisplay('sfx-volume-value', this.settings.sfxVolume);
    this.updateSliderDisplay('ambient-volume-value', this.settings.ambientVolume);
    this.updateSliderDisplay('sensitivity-value', this.settings.mouseSensitivity);

    // Apply to audio manager
    this.audioManager.setVolume('master', this.settings.masterVolume);
    this.audioManager.setVolume('sfx', this.settings.sfxVolume);
    this.audioManager.setVolume('ambient', this.settings.ambientVolume);
    this.audioManager.setMute(this.settings.isMuted);
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    try {
      localStorage.setItem('gameSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Get current mouse sensitivity
   */
  getMouseSensitivity(): number {
    return this.settings.mouseSensitivity;
  }

  /**
   * Show settings toggle button (when game starts)
   */
  show(): void {
    this.toggleButton.classList.remove('hidden');
  }
}
