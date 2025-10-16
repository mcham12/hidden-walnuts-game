/**
 * WelcomeScreen - MVP 5.8: Startup Experience
 *
 * Simple forest entrance with animated walnut emoji
 * Responsive design for iPhone, iPad, and Desktop
 */

export class WelcomeScreen {
  private container: HTMLDivElement | null = null;
  private resolvePromise: (() => void) | null = null;

  constructor() {
    this.createHTML();
  }

  /**
   * Create HTML structure for welcome screen
   */
  private createHTML(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'welcome-screen';
    this.container.innerHTML = `
      <div class="welcome-content">
        <div class="welcome-walnut-emoji">🌰</div>
        <div class="welcome-text">
          <h1 class="welcome-title">Hidden Walnuts</h1>
          <p class="welcome-tagline">A Multiplayer Forest Adventure</p>
        </div>
        <button id="welcome-button" class="welcome-button">
          Enter the Forest
        </button>
      </div>

      <!-- Decorative elements -->
      <div class="forest-rays"></div>
      <div class="floating-leaf leaf-1">🍃</div>
      <div class="floating-leaf leaf-2">🍂</div>
      <div class="floating-leaf leaf-3">🍃</div>
      <div class="floating-leaf leaf-4">🍂</div>
    `;

    document.body.appendChild(this.container);

    // Setup button click handler
    const button = document.getElementById('welcome-button');
    if (button) {
      button.addEventListener('click', () => this.onButtonClick());
    }
  }

  /**
   * Handle button click
   */
  private onButtonClick(): void {
    if (this.resolvePromise) {
      this.resolvePromise();
    }
  }

  /**
   * Show welcome screen and wait for user interaction
   */
  async show(): Promise<void> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      if (this.container) {
        // Fade in
        this.container.style.opacity = '0';
        this.container.style.display = 'flex';

        requestAnimationFrame(() => {
          if (this.container) {
            this.container.style.transition = 'opacity 0.5s ease-in';
            this.container.style.opacity = '1';
          }
        });
      }
    });
  }

  /**
   * Hide welcome screen with fade out
   */
  async hide(): Promise<void> {
    return new Promise((resolve) => {
      if (this.container) {
        this.container.style.transition = 'opacity 0.5s ease-out';
        this.container.style.opacity = '0';

        setTimeout(() => {
          if (this.container) {
            this.container.style.display = 'none';
          }
          resolve();
        }, 500);
      } else {
        resolve();
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Remove from DOM
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
