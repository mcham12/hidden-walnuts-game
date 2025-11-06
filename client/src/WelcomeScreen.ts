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
   * MVP 16: Two-column layout with Quick Play (left) and Sign Up Free (right)
   */
  private createHTML(): void {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'welcome-screen';
    this.container.innerHTML = `
      <div class="welcome-content">
        <!-- Title and Tagline at Top -->
        <div class="welcome-header">
          <h1 class="welcome-title">🌲🌳 Hidden Walnuts 🌰🌲</h1>
          <p class="welcome-tagline">Welcome to the Forest</p>
        </div>

        <!-- Two Column Layout -->
        <div class="welcome-columns">
          <!-- Left Column: Quick Play -->
          <div class="welcome-column welcome-column-left">
            <h2 class="column-title">QUICK PLAY</h2>
            <p class="column-subtitle">No login needed!</p>

            <div class="welcome-form">
              <label for="welcome-username" class="welcome-label">👤 Enter your name:</label>
              <input
                type="text"
                id="welcome-username"
                class="welcome-input"
                placeholder="Enter your name"
                maxlength="20"
                autocomplete="off"
                spellcheck="false"
              />

              <!-- 3D Character Preview -->
              <div class="character-preview-mini">
                <div class="character-emoji">🐿️</div>
                <p class="character-label">(Bobbing, nut juggling)</p>
              </div>

              <button id="welcome-quick-play-button" class="welcome-button quick-play-button">
                🟢 QUICK PLAY!
              </button>
            </div>
          </div>

          <!-- Right Column: Sign Up Free -->
          <div class="welcome-column welcome-column-right">
            <h2 class="column-title">SIGN UP FREE</h2>
            <p class="column-subtitle">Unlock 6 FREE characters!</p>

            <!-- Rotating Character Carousel -->
            <div class="character-carousel">
              <div class="carousel-characters">
                <span class="carousel-char" title="Fox">🦊</span>
                <span class="carousel-char" title="Bear">🐻</span>
                <span class="carousel-char" title="Rabbit">🐰</span>
                <span class="carousel-char" title="Bird">🐦</span>
                <span class="carousel-char" title="Frog">🐸</span>
                <span class="carousel-char" title="Badger">🦡</span>
              </div>
              <p class="carousel-label">Idling animations rotate every 3 seconds</p>
            </div>

            <button id="welcome-signup-button" class="welcome-button signup-button">
              🟠 SIGN UP
            </button>
          </div>
        </div>

        <!-- Sign In Link Below -->
        <div class="welcome-footer">
          <button id="welcome-signin-link" class="signin-link">🔒 Sign In</button>
        </div>

        <!-- Tagline at Bottom -->
        <div class="welcome-bottom-tagline">
          Start collecting walnuts now! 🌰🎮
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

    // Setup event handlers
    this.setupEventHandlers();

    // Start character carousel rotation
    this.startCarouselAnimation();
  }

  /**
   * Setup event handlers for buttons
   */
  private setupEventHandlers(): void {
    const quickPlayButton = document.getElementById('welcome-quick-play-button');
    const signupButton = document.getElementById('welcome-signup-button');
    const signinLink = document.getElementById('welcome-signin-link');
    const input = document.getElementById('welcome-username') as HTMLInputElement;

    // Quick Play button
    if (quickPlayButton && input) {
      quickPlayButton.addEventListener('click', () => this.onQuickPlayClick());

      // Allow Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.onQuickPlayClick();
        }
      });
    }

    // Sign Up button (will be wired to AuthModal in next step)
    if (signupButton) {
      signupButton.addEventListener('click', () => this.onSignUpClick());
    }

    // Sign In link (will be wired to AuthModal in next step)
    if (signinLink) {
      signinLink.addEventListener('click', () => this.onSignInClick());
    }
  }

  /**
   * Animate character carousel
   */
  private startCarouselAnimation(): void {
    const carousel = document.querySelector('.carousel-characters') as HTMLElement;
    if (!carousel) return;

    let currentIndex = 0;
    const chars = carousel.querySelectorAll('.carousel-char');

    setInterval(() => {
      // Reset all
      chars.forEach(char => {
        (char as HTMLElement).style.transform = 'scale(1)';
        (char as HTMLElement).style.opacity = '0.6';
      });

      // Highlight current
      const current = chars[currentIndex] as HTMLElement;
      current.style.transform = 'scale(1.5)';
      current.style.opacity = '1';

      currentIndex = (currentIndex + 1) % chars.length;
    }, 3000);
  }

  /**
   * Handle Quick Play click
   */
  private onQuickPlayClick(): void {
    const input = document.getElementById('welcome-username') as HTMLInputElement;
    const username = input?.value.trim() || '';

    if (!username) {
      input?.focus();
      return;
    }

    if (this.resolvePromise) {
      this.resolvePromise(username);
    }
  }

  /**
   * Handle Sign Up click
   * TODO: Wire to AuthModal
   */
  private onSignUpClick(): void {
    console.log('Sign Up clicked - TODO: Open AuthModal in signup mode');
    // Will be wired to AuthModal in next step
  }

  /**
   * Handle Sign In click
   * TODO: Wire to AuthModal
   */
  private onSignInClick(): void {
    console.log('Sign In clicked - TODO: Open AuthModal in signin mode');
    // Will be wired to AuthModal in next step
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
   * MVP 6: Show "Welcome Back" message for returning users
   * Auto-continues after 2 seconds or on button click
   */
  async showWelcomeBack(username: string): Promise<void> {
    if (!this.container) return;

    // Update HTML to show welcome back message
    const welcomeContent = this.container.querySelector('.welcome-content');
    if (welcomeContent) {
      welcomeContent.innerHTML = `
        <div class="welcome-text">
          <h1 class="welcome-title">Welcome Back!</h1>
          <p class="welcome-tagline">Hey <strong>${username}</strong>, ready for more adventure?</p>
        </div>
        <button id="welcome-continue-button" class="welcome-button">
          Continue to Forest
        </button>
      `;
    }

    // Show with fade in
    this.container.style.opacity = '0';
    this.container.style.display = 'flex';

    requestAnimationFrame(() => {
      if (this.container) {
        this.container.style.transition = 'opacity 0.5s ease-in';
        this.container.style.opacity = '1';
      }
    });

    // Auto-continue after 2 seconds OR click button
    return new Promise((resolve) => {
      const button = document.getElementById('welcome-continue-button');

      const continueToGame = () => {
        clearTimeout(timeout);
        button?.removeEventListener('click', continueToGame);
        resolve();
      };

      const timeout = setTimeout(continueToGame, 2000);
      button?.addEventListener('click', continueToGame);
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
