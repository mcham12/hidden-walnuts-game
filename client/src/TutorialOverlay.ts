/**
 * Tutorial Overlay - "How to Play" system for Hidden Walnuts
 *
 * Features:
 * - Platform-specific layouts (desktop keyboard vs mobile touch)
 * - Single-screen tutorial (all mechanics visible at once)
 * - Pauses game while reading
 * - localStorage tracking for first-time users
 * - Glowing button to attract new players
 * - F1 keyboard shortcut (desktop) and "?" button (mobile)
 *
 * Best Practices 2025:
 * - Launch directly into first action (<10 seconds)
 * - Progressive disclosure (not multi-screen click-through)
 * - Platform-specific UX
 */

export class TutorialOverlay {
  private overlay: HTMLDivElement;
  private contentDiv: HTMLDivElement;
  private buttonDiv: HTMLDivElement;
  private isDesktop: boolean;
  private isVisible: boolean = false;
  private onPause: (() => void) | null = null;
  private onResume: (() => void) | null = null;
  private styleElement!: HTMLStyleElement;

  private readonly STORAGE_KEY = 'hw_hasSeenTutorial';

  constructor() {
    this.isDesktop = this.detectPlatform();

    // Create style element with all CSS (including animations)
    this.createStyles();

    // Create overlay DOM structure
    this.overlay = this.createOverlay();
    this.contentDiv = this.createContent();
    this.buttonDiv = this.createButton();

    // Add to DOM
    this.overlay.appendChild(this.contentDiv);
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.buttonDiv);

    // Setup event listeners
    this.setupEventListeners();

    // Auto-show for new players
    this.checkFirstTimeUser();
  }

  /**
   * Detect if desktop or mobile platform
   */
  private detectPlatform(): boolean {
    // Check if touch device
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // Also check screen size (tablets with keyboards exist)
    const isLargeScreen = window.innerWidth > 768;

    // Desktop if no touch OR large screen with keyboard-friendly input
    return !hasTouch || isLargeScreen;
  }

  /**
   * Create CSS styles (including glow animation)
   */
  private createStyles(): void {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      /* Tutorial overlay */
      .hw-tutorial-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(20, 60, 30, 0.95);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10001;
        padding: 20px;
        box-sizing: border-box;
        overflow-y: auto;
      }

      .hw-tutorial-overlay.visible {
        display: flex;
      }

      .hw-tutorial-content {
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid rgba(255, 215, 0, 0.5);
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        width: 100%;
        color: white;
        font-family: Arial, sans-serif;
        position: relative;
      }

      .hw-tutorial-title {
        font-size: 28px;
        font-weight: bold;
        color: #FFD700;
        margin: 0 0 20px 0;
        text-align: center;
      }

      .hw-tutorial-close {
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 28px;
        cursor: pointer;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
        transition: color 0.2s;
      }

      .hw-tutorial-close:hover {
        color: #FFD700;
      }

      .hw-tutorial-item {
        margin: 20px 0;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .hw-tutorial-icon {
        font-size: 24px;
        min-width: 30px;
        text-align: center;
      }

      .hw-tutorial-text {
        flex: 1;
      }

      .hw-tutorial-label {
        font-size: 18px;
        font-weight: bold;
        color: #FFD700;
        margin: 0 0 4px 0;
      }

      .hw-tutorial-desc {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
        margin: 0;
        line-height: 1.4;
      }

      .hw-tutorial-key {
        display: inline-block;
        padding: 4px 8px;
        background: rgba(255, 255, 255, 0.2);
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 4px;
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        margin: 0 2px;
      }

      .hw-tutorial-button-container {
        text-align: center;
        margin-top: 30px;
      }

      .hw-tutorial-got-it {
        background: linear-gradient(135deg, #44cc44, #66ff66);
        border: none;
        border-radius: 8px;
        padding: 12px 40px;
        font-size: 18px;
        font-weight: bold;
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        transition: transform 0.1s, box-shadow 0.1s;
      }

      .hw-tutorial-got-it:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 8px rgba(0,0,0,0.4);
      }

      .hw-tutorial-got-it:active {
        transform: translateY(0);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      /* Tutorial button (glowing) */
      .hw-tutorial-button {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: rgba(255, 215, 0, 0.9);
        border: 2px solid #FFD700;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: #333;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        transition: transform 0.2s;
        animation: tutorial-glow 2s ease-in-out infinite;
      }

      .hw-tutorial-button:hover {
        transform: scale(1.1);
      }

      .hw-tutorial-button.seen {
        animation: none;
        background: rgba(255, 215, 0, 0.6);
      }

      @keyframes tutorial-glow {
        0%, 100% {
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 20px rgba(255, 215, 0, 0.5);
        }
        50% {
          box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 30px rgba(255, 215, 0, 0.9);
        }
      }

      /* Mobile-specific adjustments */
      @media (max-width: 768px) {
        .hw-tutorial-content {
          padding: 20px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .hw-tutorial-title {
          font-size: 24px;
        }

        .hw-tutorial-label {
          font-size: 16px;
        }

        .hw-tutorial-desc {
          font-size: 13px;
        }

        .hw-tutorial-button {
          width: 45px;
          height: 45px;
          font-size: 20px;
        }
      }
    `;
    document.head.appendChild(this.styleElement);
  }

  /**
   * Create overlay container
   */
  private createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.className = 'hw-tutorial-overlay';
    return overlay;
  }

  /**
   * Create content based on platform
   */
  private createContent(): HTMLDivElement {
    const content = document.createElement('div');
    content.className = 'hw-tutorial-content';

    if (this.isDesktop) {
      content.innerHTML = this.getDesktopContent();
    } else {
      content.innerHTML = this.getMobileContent();
    }

    return content;
  }

  /**
   * Desktop tutorial content (keyboard-focused)
   */
  private getDesktopContent(): string {
    return `
      <button class="hw-tutorial-close" aria-label="Close">×</button>
      <h2 class="hw-tutorial-title">How to Play - Hidden Walnuts</h2>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🚶</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">MOVE</p>
          <p class="hw-tutorial-desc">
            <span class="hw-tutorial-key">W</span>
            <span class="hw-tutorial-key">A</span>
            <span class="hw-tutorial-key">S</span>
            <span class="hw-tutorial-key">D</span>
            or Arrow Keys
          </p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🥜</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">GET WALNUT</p>
          <p class="hw-tutorial-desc">Walk near walnut to collect</p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🎯</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">THROW WALNUT</p>
          <p class="hw-tutorial-desc">
            <span class="hw-tutorial-key">SPACE</span>
            Hit players & wildebeest • Distract aerial predators 🐦
          </p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🌳</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">HIDE WALNUT</p>
          <p class="hw-tutorial-desc">
            <span class="hw-tutorial-key">H</span>
            Bury or hide in bush • Might grow into tree!
          </p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">❤️</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">EAT WALNUT</p>
          <p class="hw-tutorial-desc">
            <span class="hw-tutorial-key">E</span>
            Heal 20 HP
          </p>
        </div>
      </div>

      <div class="hw-tutorial-button-container">
        <button class="hw-tutorial-got-it">GOT IT!</button>
      </div>

      <p style="text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); margin: 20px 0 0 0;">
        Press <span class="hw-tutorial-key">F1</span> to reopen this guide
      </p>
    `;
  }

  /**
   * Mobile tutorial content (touch-focused)
   */
  private getMobileContent(): string {
    return `
      <button class="hw-tutorial-close" aria-label="Close">×</button>
      <h2 class="hw-tutorial-title">How to Play</h2>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">👆</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">MOVE</p>
          <p class="hw-tutorial-desc">Drag anywhere on screen</p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🥜</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">GET WALNUT</p>
          <p class="hw-tutorial-desc">Walk near to collect</p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🎯</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">THROW</p>
          <p class="hw-tutorial-desc">
            Tap <strong>🎯</strong> button • Hit players & beasts • Distract birds! 🐦
          </p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🌳</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">HIDE</p>
          <p class="hw-tutorial-desc">
            Tap <strong>🌳</strong> button • Walnut may grow to tree!
          </p>
        </div>
      </div>

      <div class="hw-tutorial-item">
        <div class="hw-tutorial-icon">🍴</div>
        <div class="hw-tutorial-text">
          <p class="hw-tutorial-label">EAT</p>
          <p class="hw-tutorial-desc">
            Tap <strong>🍴</strong> button • Heal 20 HP
          </p>
        </div>
      </div>

      <div class="hw-tutorial-button-container">
        <button class="hw-tutorial-got-it">GOT IT!</button>
      </div>

      <p style="text-align: center; font-size: 12px; color: rgba(255,255,255,0.5); margin: 20px 0 0 0;">
        Tap <strong>?</strong> button to reopen
      </p>
    `;
  }

  /**
   * Create floating tutorial button
   */
  private createButton(): HTMLDivElement {
    const button = document.createElement('div');
    button.className = 'hw-tutorial-button';
    button.textContent = this.isDesktop ? '💡' : '?';
    button.setAttribute('aria-label', 'How to Play');
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    // Check if user has seen tutorial
    if (this.hasSeenTutorial()) {
      button.classList.add('seen');
    }

    return button;
  }

  /**
   * Setup all event listeners
   */
  private setupEventListeners(): void {
    // Close button
    const closeBtn = this.contentDiv.querySelector('.hw-tutorial-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Got It button
    const gotItBtn = this.contentDiv.querySelector('.hw-tutorial-got-it');
    if (gotItBtn) {
      gotItBtn.addEventListener('click', () => this.hide());
    }

    // Floating button
    this.buttonDiv.addEventListener('click', () => this.show());

    // Keyboard shortcuts
    if (this.isDesktop) {
      window.addEventListener('keydown', (e) => {
        if (e.key === 'F1') {
          e.preventDefault();
          this.toggle();
        } else if (e.key === 'Escape' && this.isVisible) {
          this.hide();
        }
      });
    }

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.hide();
      }
    });
  }

  /**
   * Check if this is first-time user
   */
  private checkFirstTimeUser(): void {
    if (!this.hasSeenTutorial()) {
      // Auto-show for new players after short delay
      setTimeout(() => {
        this.show();
      }, 1000); // 1 second delay
    }
  }

  /**
   * Check localStorage for tutorial status
   */
  private hasSeenTutorial(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) === 'true';
  }

  /**
   * Mark tutorial as seen
   */
  private markAsSeen(): void {
    localStorage.setItem(this.STORAGE_KEY, 'true');
    this.buttonDiv.classList.add('seen');
  }

  /**
   * Show tutorial (pause game)
   */
  show(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.overlay.classList.add('visible');

    // Pause game
    if (this.onPause) {
      this.onPause();
    }

    console.log('📖 Tutorial overlay shown');
  }

  /**
   * Hide tutorial (resume game)
   */
  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.overlay.classList.remove('visible');

    // Mark as seen
    this.markAsSeen();

    // Resume game
    if (this.onResume) {
      this.onResume();
    }

    console.log('📖 Tutorial overlay hidden');
  }

  /**
   * Toggle tutorial visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Set pause callback (called when tutorial opens)
   */
  setPauseCallback(callback: () => void): void {
    this.onPause = callback;
  }

  /**
   * Set resume callback (called when tutorial closes)
   */
  setResumeCallback(callback: () => void): void {
    this.onResume = callback;
  }

  /**
   * Cleanup (alias for dispose)
   */
  destroy(): void {
    this.dispose();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    if (this.buttonDiv.parentElement) {
      this.buttonDiv.parentElement.removeChild(this.buttonDiv);
    }
    if (this.styleElement.parentElement) {
      this.styleElement.parentElement.removeChild(this.styleElement);
    }
  }
}
