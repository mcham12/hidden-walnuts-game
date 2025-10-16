/**
 * WelcomeScreen - MVP 5.8: Startup Experience
 *
 * Simple forest entrance with animated walnut emoji
 * Responsive design for iPhone, iPad, and Desktop
 */

export class WelcomeScreen {
  private container: HTMLDivElement | null = null;
  private resolvePromise: ((username: string) => void) | null = null;

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
        <div class="welcome-text">
          <h1 class="welcome-title">Hidden Walnuts</h1>
          <p class="welcome-tagline">A Multiplayer Forest Adventure</p>
        </div>

        <div class="welcome-form">
          <label for="welcome-username" class="welcome-label">What should we call you?</label>
          <input
            type="text"
            id="welcome-username"
            class="welcome-input"
            placeholder="Enter your name"
            maxlength="20"
            autocomplete="off"
            spellcheck="false"
          />
          <button id="welcome-button" class="welcome-button">
            Enter the Forest
          </button>
        </div>
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
    const input = document.getElementById('welcome-username') as HTMLInputElement;

    if (button && input) {
      button.addEventListener('click', () => this.onButtonClick());

      // Also allow Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.onButtonClick();
        }
      });
    }
  }

  /**
   * Handle button click
   */
  private onButtonClick(): void {
    const input = document.getElementById('welcome-username') as HTMLInputElement;
    const username = input?.value.trim() || '';

    // Require username (placeholder for now, will add validation later)
    if (!username) {
      input?.focus();
      return;
    }

    if (this.resolvePromise) {
      this.resolvePromise(username);
    }
  }

  /**
   * Show welcome screen and wait for user interaction
   * Returns the username entered by the user
   */
  async show(): Promise<string> {
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

          // Auto-focus the username input
          const input = document.getElementById('welcome-username') as HTMLInputElement;
          if (input) {
            setTimeout(() => input.focus(), 100);
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
