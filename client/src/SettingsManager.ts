import { AudioManager } from './AudioManager';
import { TipsManager } from './TipsManager'; // MVP 14: Tips system

/**
 * SettingsManager - Handles game settings and UI controls
 */
export class SettingsManager {
  private audioManager: AudioManager;
  private tipsManager: TipsManager = new TipsManager(); // MVP 14
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

  // MVP 14: Tips tab elements
  private tipsContainer: HTMLElement | null = null;
  private resetTipsButton: HTMLElement | null = null;

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

    // MVP 14: Tips tab elements
    this.tipsContainer = document.getElementById('tips-container');
    this.resetTipsButton = document.getElementById('reset-tips-btn');

    this.setupEventListeners();
    this.loadSettings();
    this.populateTips(); // MVP 14: Populate tips on init
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

    // MVP 14: Reset tips button
    if (this.resetTipsButton) {
      this.resetTipsButton.addEventListener('click', () => {
        this.tipsManager.resetSeenTips();
        this.populateTips(); // Refresh display
        this.audioManager.playSound('ui', 'button_click');
      });
    }
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

  /**
   * MVP 14: Populate tips in the Tips tab
   */
  private populateTips(): void {
    if (!this.tipsContainer) return;

    const container = this.tipsContainer; // Local variable for TypeScript narrowing

    // Clear existing tips
    container.innerHTML = '';

    // Get all tips grouped by category
    const categories = ['combat', 'trees', 'strategy', 'basics'] as const;
    const categoryNames = {
      combat: '⚔️ Combat & Survival',
      trees: '🌳 Tree Growing',
      strategy: '⭐ Strategy & Resources',
      basics: '🎮 Basics'
    };

    categories.forEach(category => {
      const tips = this.tipsManager.getTipsByCategory(category);
      if (tips.length === 0) return;

      // Create category header
      const header = document.createElement('div');
      header.style.fontWeight = 'bold';
      header.style.fontSize = '14px';
      header.style.color = '#FFD700';
      header.style.marginBottom = '8px';
      header.style.paddingBottom = '4px';
      header.style.borderBottom = '1px solid rgba(255, 215, 0, 0.3)';
      header.textContent = categoryNames[category];
      container.appendChild(header);

      // Create tips list for this category
      tips.forEach(tip => {
        const tipElement = document.createElement('div');
        tipElement.style.padding = '8px';
        tipElement.style.background = 'rgba(0, 0, 0, 0.2)';
        tipElement.style.borderRadius = '4px';
        tipElement.style.fontSize = '13px';
        tipElement.style.lineHeight = '1.4';
        tipElement.style.marginBottom = '6px';

        // Check if tip has been seen
        const hasSeen = this.tipsManager.hasSeen(tip.id);
        if (hasSeen) {
          tipElement.style.opacity = '0.6';
        }

        const emoji = tip.emoji ? `${tip.emoji} ` : '';
        tipElement.textContent = `${emoji}${tip.text}`;

        container.appendChild(tipElement);
      });
    });

    // Show unseen count
    const unseenCount = this.tipsManager.getUnseenCount();
    if (unseenCount > 0) {
      const unseenInfo = document.createElement('div');
      unseenInfo.style.marginTop = '12px';
      unseenInfo.style.padding = '8px';
      unseenInfo.style.background = 'rgba(255, 215, 0, 0.2)';
      unseenInfo.style.borderRadius = '4px';
      unseenInfo.style.fontSize = '12px';
      unseenInfo.style.textAlign = 'center';
      unseenInfo.style.color = '#FFE4B5';
      unseenInfo.textContent = `💡 ${unseenCount} new tip${unseenCount > 1 ? 's' : ''} to discover!`;
      container.appendChild(unseenInfo);
    }
  }
}
