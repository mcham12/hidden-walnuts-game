import { AudioManager } from './AudioManager';
import { TipsManager } from './TipsManager'; // MVP 14: Tips system
import { getCurrentUser, isAuthenticated } from './services/AuthService'; // MVP 16: Account tab
import { CharacterRegistry } from './services/CharacterRegistry'; // MVP 16: Character count

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

  // Audio sliders
  private masterVolumeSlider: HTMLInputElement;
  private sfxVolumeSlider: HTMLInputElement;
  private ambientVolumeSlider: HTMLInputElement;
  private muteCheckbox: HTMLInputElement;

  // Mouse sensitivity removed (no longer in UI)

  // MVP 14: Tips tab elements
  private tipsContainer: HTMLElement | null = null;
  private resetTipsButton: HTMLElement | null = null;

  // MVP 16: Account tab elements
  private accountContainer: HTMLElement | null = null;
  private onSignUpClick?: () => void;
  private onLoginClick?: () => void;

  constructor(audioManager: AudioManager, options?: { onSignUpClick?: () => void; onLoginClick?: () => void }) {
    this.audioManager = audioManager;
    this.onSignUpClick = options?.onSignUpClick;
    this.onLoginClick = options?.onLoginClick;

    // Get DOM elements
    this.overlay = document.getElementById('settings-overlay')!;
    this.toggleButton = document.getElementById('settings-toggle')!;

    // Audio controls
    this.masterVolumeSlider = document.getElementById('master-volume') as HTMLInputElement;
    this.sfxVolumeSlider = document.getElementById('sfx-volume') as HTMLInputElement;
    this.ambientVolumeSlider = document.getElementById('ambient-volume') as HTMLInputElement;
    this.muteCheckbox = document.getElementById('mute-toggle') as HTMLInputElement;

    // Mouse sensitivity removed (no longer in UI)

    // MVP 14: Tips tab elements
    this.tipsContainer = document.getElementById('tips-container');
    this.resetTipsButton = document.getElementById('reset-tips-btn');

    // MVP 16: Account tab elements
    this.accountContainer = document.getElementById('account-container');

    this.setupEventListeners();
    this.loadSettings();
    this.populateTips(); // MVP 14: Populate tips on init
    this.populateAccountInfo(); // MVP 16: Populate account info on init
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Open settings
    this.toggleButton.addEventListener('click', () => this.open());

    // Note: Apply/Cancel buttons removed since sliders work instantly
    // Keeping references for backward compatibility but not adding listeners

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

    // Tab switching removed - all content shown at once

    // Overlay click-to-dismiss
    this.overlay.addEventListener('click', (e) => {
      // Only close if clicking the overlay itself, not its children
      if (e.target === this.overlay) {
        this.cancel();
      }
    });

    // Audio sliders with feedback
    this.masterVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.masterVolumeSlider.value) / 100;
      this.updateSliderDisplay('master-volume-value', value);
      this.audioManager.setVolume('master', value); // Apply immediately
      this.settings.masterVolume = value;
      this.saveSettings();
      this.playSliderFeedback();
    });

    this.sfxVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.sfxVolumeSlider.value) / 100;
      this.updateSliderDisplay('sfx-volume-value', value);
      this.audioManager.setVolume('sfx', value); // Apply immediately
      this.settings.sfxVolume = value;
      this.saveSettings();
      this.playSliderFeedback();
    });

    this.ambientVolumeSlider.addEventListener('input', () => {
      const value = parseInt(this.ambientVolumeSlider.value) / 100;
      this.updateSliderDisplay('ambient-volume-value', value);
      this.audioManager.setVolume('ambient', value); // Apply immediately
      this.settings.ambientVolume = value;
      this.saveSettings();
      // No feedback for ambient slider to avoid noise overlap
    });

    // Sensitivity slider removed (no longer in UI)

    // Mute checkbox
    this.muteCheckbox.addEventListener('change', () => {
      // Apply mute immediately for preview
      this.audioManager.setMute(this.muteCheckbox.checked);
      this.settings.isMuted = this.muteCheckbox.checked;
      this.saveSettings();
    });

    // MVP 14: Reset tips button
    if (this.resetTipsButton) {
      this.resetTipsButton.addEventListener('click', () => {
        this.tipsManager.resetSeenTips();
        this.populateTips(); // Refresh display
        this.audioManager.playSound('ui', 'button_click');
      });
    }

    // Close button (new)
    const closeBtn = document.getElementById('settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.cancel());
    }
  }

  /**
   * Play a subtle feedback sound when adjusting sliders
   * Throttled to prevent spamming
   */
  private lastFeedbackTime = 0;
  private playSliderFeedback(): void {
    const now = Date.now();
    if (now - this.lastFeedbackTime > 100) { // Max 10 times per second
      // Use a very short, subtle click or blip
      // Reusing 'ui' sound with low volume and high pitch if possible, or just standard click
      this.audioManager.playSound('ui', 'button_click');
      this.lastFeedbackTime = now;
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
   * Open settings menu
   */
  open(): void {
    this.isOpen = true;
    this.overlay.classList.remove('hidden');

    // MVP 9: Toggle mobile/desktop specific elements
    // We use a helper to check if we are on mobile (touch device)
    // Import dynamically to avoid circular dependency issues if any
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
      (typeof navigator.maxTouchPoints !== 'undefined' && navigator.maxTouchPoints > 0);

    if (isMobile) {
      document.body.classList.add('is-mobile');
    } else {
      document.body.classList.remove('is-mobile');
    }

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
    // Mouse sensitivity removed (no longer in UI)
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
    this.muteCheckbox.checked = this.settings.isMuted;

    // Update displays
    this.updateSliderDisplay('master-volume-value', this.settings.masterVolume);
    this.updateSliderDisplay('sfx-volume-value', this.settings.sfxVolume);
    this.updateSliderDisplay('ambient-volume-value', this.settings.ambientVolume);

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

  /**
   * MVP 16: Refresh account info (called after seamless signup/login)
   */
  public refreshAccountInfo(): void {
    this.populateAccountInfo();
  }

  /**
   * MVP 16: Populate Account tab with user info or guest CTA
   */
  private populateAccountInfo(): void {
    if (!this.accountContainer) return;

    // Clear existing content
    this.accountContainer.innerHTML = '';

    const user = getCurrentUser();
    const userIsAuthenticated = isAuthenticated();

    if (!userIsAuthenticated || !user) {
      // Show guest/no-auth view
      this.renderNoAuthAccountView();
    } else {
      // Show authenticated user view
      this.renderAuthenticatedAccountView(user);
    }
  }

  /**
   * MVP 16: Render account view for guest/no-auth users
   */
  private renderNoAuthAccountView(): void {
    if (!this.accountContainer) return;

    // Guest account header
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
    `;

    const guestIcon = document.createElement('div');
    guestIcon.style.cssText = `
      font-size: 48px;
      margin-bottom: 8px;
    `;
    guestIcon.textContent = '👤';

    const guestTitle = document.createElement('div');
    guestTitle.style.cssText = `
      font-size: 18px;
      font-weight: 700;
      color: #FFD700;
      margin-bottom: 4px;
    `;
    guestTitle.textContent = 'Guest Account';

    const guestUsername = document.createElement('div');
    guestUsername.style.cssText = `
      font-size: 14px;
      color: #ccc;
    `;
    guestUsername.textContent = `Playing as: ${localStorage.getItem('hw_username') || 'Guest'}`;

    header.appendChild(guestIcon);
    header.appendChild(guestTitle);
    header.appendChild(guestUsername);

    // Simplified Benefits section
    const benefitsTitle = document.createElement('div');
    benefitsTitle.style.cssText = `
      font-size: 16px;
      font-weight: 700;
      color: #FFD700;
      margin-bottom: 12px;
      text-align: center;
    `;
    benefitsTitle.textContent = '☁️ Save Your Progress';

    const benefitsList = document.createElement('div');
    benefitsList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
      text-align: center;
      color: #ccc;
      font-size: 14px;
    `;
    benefitsList.textContent = 'Create an account to sync your progress across devices and never lose your stats.';

    // CTA buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Sign up button
    const signupButton = document.createElement('button');
    signupButton.className = 'settings-button primary';
    signupButton.style.cssText = `
      width: 100%;
      height: 50px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      color: #2c5f2d;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
    `;
    signupButton.textContent = '🔐 Sign Up';
    signupButton.addEventListener('click', () => {
      this.close();
      this.onSignUpClick?.();
    });
    signupButton.addEventListener('mouseenter', () => {
      signupButton.style.transform = 'scale(1.02)';
      signupButton.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.6)';
    });
    signupButton.addEventListener('mouseleave', () => {
      signupButton.style.transform = 'scale(1)';
      signupButton.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.4)';
    });

    // Login link
    const loginContainer = document.createElement('div');
    loginContainer.style.cssText = `
      text-align: center;
      font-size: 14px;
      color: #ccc;
    `;
    loginContainer.innerHTML = `Already have an account? <span style="color: #FFD700; cursor: pointer; text-decoration: underline;">Log In</span>`;
    loginContainer.querySelector('span')?.addEventListener('click', () => {
      this.close();
      this.onLoginClick?.();
    });

    buttonsContainer.appendChild(signupButton);
    buttonsContainer.appendChild(loginContainer);

    // Assemble
    this.accountContainer.appendChild(header);
    this.accountContainer.appendChild(benefitsTitle);
    this.accountContainer.appendChild(benefitsList);
    this.accountContainer.appendChild(buttonsContainer);
  }

  /**
   * MVP 16: Render account view for authenticated users
   */
  private renderAuthenticatedAccountView(user: any): void {
    if (!this.accountContainer) return;

    // User header
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      margin-bottom: 20px;
    `;

    const avatar = document.createElement('div');
    avatar.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin: 0 auto 12px;
      border: 3px solid rgba(255, 215, 0, 0.6);
    `;
    avatar.textContent = user.username.charAt(0).toUpperCase();

    const username = document.createElement('div');
    username.style.cssText = `
      font-size: 20px;
      font-weight: 700;
      color: #FFD700;
      margin-bottom: 4px;
    `;
    username.textContent = user.username;

    const verificationBadge = document.createElement('div');
    verificationBadge.style.cssText = `
      font-size: 14px;
      color: ${user.emailVerified ? '#7FFF7F' : '#FFA500'};
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    `;
    verificationBadge.innerHTML = user.emailVerified
      ? '✅ Verified Account'
      : '⚠️ Email Not Verified';

    header.appendChild(avatar);
    header.appendChild(username);
    header.appendChild(verificationBadge);

    // Account info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    `;

    // Email field
    const emailField = this.createInfoField('📧 Email', user.email, user.emailVerified);

    // Password field
    const passwordField = this.createInfoField('🔒 Password', '••••••••', true);

    // Account dates - handle both timestamp and ISO string formats
    let createdDate = 'Unknown';
    if (user.createdAt) {
      const date = typeof user.createdAt === 'number' ? new Date(user.createdAt) : new Date(user.createdAt);
      createdDate = date.toLocaleDateString();
    }

    let lastLogin = 'Just now';
    if (user.lastLogin) {
      const date = typeof user.lastLogin === 'number' ? new Date(user.lastLogin) : new Date(user.lastLogin);
      lastLogin = date.toLocaleDateString();
    }
    const createdField = this.createInfoField('📅 Member Since', createdDate, true);
    const loginField = this.createInfoField('🕐 Last Login', lastLogin, true);

    // Characters unlocked
    const allCharacters = CharacterRegistry.getAllCharacters();
    const premiumCount = allCharacters.filter(c => c.tier === 'premium').length;
    const freeCount = allCharacters.filter(c => c.tier === 'free' || c.tier === 'no-auth').length;
    const unlockedCount = user.unlockedCharacters?.length || 0;

    const charactersField = this.createInfoField(
      '🐿️ Characters',
      `${unlockedCount} / ${freeCount + premiumCount} unlocked`,
      true
    );

    infoSection.appendChild(emailField);
    infoSection.appendChild(passwordField);
    infoSection.appendChild(createdField);
    infoSection.appendChild(loginField);
    infoSection.appendChild(charactersField);

    // Buttons section
    const buttonsSection = document.createElement('div');
    buttonsSection.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    // Log out button
    const logoutButton = document.createElement('button');
    logoutButton.className = 'settings-button primary';
    logoutButton.style.cssText = `
      width: 100%;
      height: 48px;
      background: linear-gradient(135deg, #FF6B6B 0%, #C92A2A 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
    `;
    logoutButton.textContent = '🚪 Log Out';
    logoutButton.addEventListener('click', () => this.handleLogout());
    logoutButton.addEventListener('mouseenter', () => {
      logoutButton.style.transform = 'scale(1.02)';
      logoutButton.style.boxShadow = '0 6px 16px rgba(255, 107, 107, 0.6)';
    });
    logoutButton.addEventListener('mouseleave', () => {
      logoutButton.style.transform = 'scale(1)';
      logoutButton.style.boxShadow = '0 4px 12px rgba(255, 107, 107, 0.4)';
    });

    // Change Password button
    const changePasswordButton = document.createElement('button');
    changePasswordButton.className = 'settings-button secondary';
    changePasswordButton.style.cssText = `
      width: 100%;
      height: 44px;
      background: rgba(0, 0, 0, 0.3);
      color: #efebe9;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    changePasswordButton.textContent = '🔑 Change Password';
    changePasswordButton.addEventListener('click', () => {
      alert('Password change feature coming soon! Please contact support if you need to reset your password.');
    });

    // Delete Account button
    const deleteAccountButton = document.createElement('button');
    deleteAccountButton.className = 'settings-button secondary';
    deleteAccountButton.style.cssText = `
      width: 100%;
      height: 44px;
      background: rgba(139, 0, 0, 0.3);
      color: #ff6b6b;
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    deleteAccountButton.textContent = '🗑️ Delete Account';
    deleteAccountButton.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete your account? This action cannot be undone. Please contact support to proceed.')) {
        alert('Please email support@hiddenwalnuts.com to request account deletion.');
      }
    });

    buttonsSection.appendChild(logoutButton);
    buttonsSection.appendChild(changePasswordButton);
    buttonsSection.appendChild(deleteAccountButton);

    // Assemble
    this.accountContainer.appendChild(header);
    this.accountContainer.appendChild(infoSection);
    this.accountContainer.appendChild(buttonsSection);
  }

  /**
   * MVP 16: Create info field for authenticated view
   */
  private createInfoField(label: string, value: string, verified: boolean): HTMLElement {
    const field = document.createElement('div');
    field.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      border: 1px solid rgba(255, 215, 0, 0.2);
    `;

    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
      font-size: 14px;
      color: #FFD700;
      font-weight: 600;
    `;
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.style.cssText = `
      font-size: 14px;
      color: ${verified ? '#fff' : '#FFA500'};
      font-weight: 500;
    `;
    valueEl.textContent = value;

    field.appendChild(labelEl);
    field.appendChild(valueEl);

    return field;
  }


  /**
   * MVP 16: Handle logout
   */
  private async handleLogout(): Promise<void> {
    if (!confirm('Are you sure you want to log out?')) {
      return;
    }

    try {
      // Import logout dynamically to avoid circular dependencies
      const { logout } = await import('./services/AuthService');

      // Call logout
      await logout();

      // Close settings
      this.close();

      // Reload page to reset state
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  }

  /**
   * MVP 16: Update account tab when tab is opened
   */
  openAccountTab(): void {
    this.open();
    // Tab switching removed - all content shown at once
    this.populateAccountInfo(); // Refresh account info when opening
  }
}
