/**
 * Tutorial Overlay - "How to Play" system for Hidden Walnuts
 *
 * Features:
 * - Platform-specific layouts (desktop keyboard vs mobile touch)
 * - Single-screen tutorial (all mechanics visible at once)
 * - Non-blocking (game continues - multiplayer standard)
 * - localStorage tracking for first-time users
 * - Glowing "?" button to attract new players
 * - F1 keyboard shortcut (hidden power-user feature)
 *
 * Best Practices 2025:
 * - Launch directly into first action (<10 seconds)
 * - Progressive disclosure (not multi-screen click-through)
 * - Platform-specific UX
 * - Don't pause multiplayer games (overlay is enough)
 */

export class TutorialOverlay {
  private overlay: HTMLDivElement;
  private contentDiv: HTMLDivElement;
  private buttonDiv: HTMLDivElement;
  private isDesktop: boolean;
  private isVisible: boolean = false;
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

    // REMOVED: Auto-show for new players - tutorial is now only shown via "?" button
    // Controls are already explained in ModeSelectionOverlay at game startup
  }

  /**
   * Detect if desktop or mobile platform
   */
  private detectPlatform(): boolean {
    // Check if touch device (iPad, iPhone, Android tablets/phones all have touch)
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Mobile includes tablets/iPads - they use touch controls
    // Desktop is keyboard/mouse only (no touch support)
    return !hasTouch;
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
        top: 10px;
        right: 220px; /* Left of minimap (minimap at right: 10px, width: 200px) */
        z-index: 1001; /* MVP 14 Phase 9: Below toasts (10000) and tips */
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

      /* iPad - Left of minimap like desktop */
      @media (max-width: 1024px) and (min-width: 768px) {
        .hw-tutorial-button {
          top: 10px;
          right: 135px; /* Left of smaller minimap on tablet */
        }
      }

      /* iPhone Portrait - Slightly right of center to avoid HUD */
      @media (max-width: 430px) {
        .hw-tutorial-button {
          top: 10px;
          left: 55%; /* Shifted right from center to avoid HUD overlap */
          right: auto;
          transform: translateX(-50%);
        }

        .hw-tutorial-button:hover {
          transform: translateX(-50%) scale(1.1);
        }
      }

      /* iPhone Landscape - Shifted right to avoid leaderboard button */
      @media (max-height: 500px) and (orientation: landscape) {
        .hw-tutorial-button {
          top: max(5px, env(safe-area-inset-top));
          left: 58%; /* Shifted right from center to avoid leaderboard overlap */
          right: auto;
          transform: translateX(-50%);
          width: 40px;
          height: 40px;
          font-size: 18px;
        }

        .hw-tutorial-button:hover {
          transform: translateX(-50%) scale(1.1);
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
        <div class="hw-tutorial-icon">🟤</div>
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
            <span class="hw-tutorial-key">T</span>
            (or <span class="hw-tutorial-key">SPACE</span>) • Hit players & wildebeest • Distract aerial predators 🐦
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
        <div class="hw-tutorial-icon">🍴</div>
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
        Click the <strong>?</strong> button (top-right) to reopen this guide
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
        <div class="hw-tutorial-icon">🟤</div>
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
    button.textContent = '?'; // Consistent across all platforms
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

    // Industry standard: Don't pause multiplayer games
    // Overlay provides enough visual feedback, game continues running
  }

  /**
   * Hide tutorial
   */
  hide(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.overlay.classList.remove('visible');

    // Mark as seen
    this.markAsSeen();
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
