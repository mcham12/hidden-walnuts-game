/**
 * WelcomeScreen - MVP 16: Two-column layout with 3D character previews
 *
 * Left: Quick Play with 3D squirrel preview
 * Right: Sign Up with rotating 3D character carousel
 * Responsive design for iPhone, iPad, and Desktop
 */

import { CharacterPreview3D } from './components/CharacterPreview3D';
import { CharacterRegistry } from './services/CharacterRegistry';
import { AuthModal } from './components/AuthModal';

export class WelcomeScreen {
  private container: HTMLDivElement | null = null;
  private resolvePromise: ((username: string) => void) | null = null;

  // 3D preview components
  private squirrelPreview: CharacterPreview3D | null = null;
  private carouselPreview: CharacterPreview3D | null = null;
  private carouselInterval: number | null = null;

  // Authentication modal
  private authModal: AuthModal | null = null;

  constructor() {
    this.createHTML();

    // Initialize AuthModal
    this.authModal = new AuthModal({
      onAuthSuccess: (userData) => this.handleAuthSuccess(userData)
    });
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
          <h1 class="welcome-title">Hidden Walnuts</h1>
          <p class="welcome-tagline">Welcome to the Forest</p>
        </div>

        <!-- Two Column Layout -->
        <div class="welcome-columns">
          <!-- Left Column: Quick Play -->
          <div class="welcome-column welcome-column-left">
            <h2 class="column-title">QUICK PLAY</h2>
            <p class="column-subtitle">No login needed!</p>

            <div class="welcome-form">
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
                <div id="squirrel-preview-container" style="width: 100%; height: 300px;"></div>
                <p class="character-label">Squirrel</p>
              </div>

              <button id="welcome-quick-play-button" class="welcome-button quick-play-button">
                QUICK PLAY!
              </button>
            </div>
          </div>

          <!-- Right Column: Sign Up Free -->
          <div class="welcome-column welcome-column-right">
            <h2 class="column-title">SIGN UP FREE</h2>
            <p class="column-subtitle">Unlock 6 FREE characters!</p>

            <div class="welcome-form">
              <input
                type="text"
                id="welcome-signup-username"
                class="welcome-input"
                placeholder="Enter your name"
                maxlength="20"
                autocomplete="off"
                spellcheck="false"
              />

              <!-- Rotating Character Carousel -->
              <div class="character-preview-mini">
                <div id="carousel-preview-container" style="width: 100%; height: 300px;"></div>
                <p class="character-label" id="carousel-character-name">Hare</p>
              </div>

              <button id="welcome-signup-button" class="welcome-button signup-button">
                SIGN UP
              </button>
            </div>
          </div>
        </div>

        <!-- Sign In Link Below -->
        <div class="welcome-footer">
          <button id="welcome-signin-link" class="signin-link">🔒 Sign In</button>
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
  }

  /**
   * Setup event handlers for buttons and pane interactions
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

    // Sign Up button
    if (signupButton) {
      signupButton.addEventListener('click', () => this.onSignUpClick());
    }

    // Sign In link
    if (signinLink) {
      signinLink.addEventListener('click', () => this.onSignInClick());
    }

    // MVP 16: Overlapping pane interaction
    const leftPane = this.container?.querySelector('.welcome-column-left');
    const rightPane = this.container?.querySelector('.welcome-column-right');

    if (leftPane && rightPane) {
      // Bring pane to front on hover/click
      const bringToFront = (pane: Element, otherPane: Element) => {
        pane.classList.add('active');
        otherPane.classList.remove('active');
      };

      // Left pane interactions
      leftPane.addEventListener('mouseenter', () => bringToFront(leftPane, rightPane));
      leftPane.addEventListener('click', () => bringToFront(leftPane, rightPane));

      // Right pane interactions
      rightPane.addEventListener('mouseenter', () => bringToFront(rightPane, leftPane));
      rightPane.addEventListener('click', () => bringToFront(rightPane, leftPane));

      // Touch support for mobile
      leftPane.addEventListener('touchstart', () => bringToFront(leftPane, rightPane));
      rightPane.addEventListener('touchstart', () => bringToFront(rightPane, leftPane));

      // Start with left pane active
      leftPane.classList.add('active');
    }
  }

  /**
   * Initialize 3D character previews
   */
  private async init3DPreviews(): Promise<void> {
    try {
      // Ensure CharacterRegistry is loaded first
      await CharacterRegistry.loadCharacters();

      // Initialize squirrel preview (left column) - closer camera for bigger character
      this.squirrelPreview = new CharacterPreview3D(
        'squirrel-preview-container',
        'squirrel',
        { rotationSpeed: 0.005, autoRotate: true, showAnimation: true, cameraDistance: 2 }
      );
      await this.squirrelPreview.init();

      // Initialize carousel preview (right column)
      // Free characters: hare, goat, chipmunk, turkey, mallard, squirrel
      const freeCharacters = [
        { id: 'hare', name: 'Hare' },
        { id: 'goat', name: 'Goat' },
        { id: 'chipmunk', name: 'Chipmunk' },
        { id: 'turkey', name: 'Turkey' },
        { id: 'mallard', name: 'Mallard' },
        { id: 'squirrel', name: 'Squirrel' }
      ];

      let currentIndex = 0;

      this.carouselPreview = new CharacterPreview3D(
        'carousel-preview-container',
        freeCharacters[0].id,
        { rotationSpeed: 0.005, autoRotate: true, showAnimation: true, cameraDistance: 2 }
      );
      await this.carouselPreview.init();

      // Update character name label
      const nameLabel = document.getElementById('carousel-character-name');
      if (nameLabel) {
        nameLabel.textContent = freeCharacters[0].name;
      }

      // Rotate carousel every 3 seconds
      this.carouselInterval = window.setInterval(async () => {
        currentIndex = (currentIndex + 1) % freeCharacters.length;
        const nextChar = freeCharacters[currentIndex];

        await this.carouselPreview?.switchCharacter(nextChar.id);

        // Update name label
        if (nameLabel) {
          nameLabel.textContent = nextChar.name;
        }
      }, 3000);
    } catch (error) {
      console.error('Error initializing 3D previews:', error);
    }
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
   * Handle Sign Up click - Open AuthModal in signup mode with prefilled username
   */
  private onSignUpClick(): void {
    if (this.authModal) {
      // Get username from sign up pane input field
      const signupUsernameInput = document.getElementById('welcome-signup-username') as HTMLInputElement;
      const username = signupUsernameInput?.value.trim() || '';

      // Open AuthModal with prefilled username if provided
      this.authModal.open('signup', username ? { username } : undefined);
    }
  }

  /**
   * Handle Sign In click - Open AuthModal in login mode
   */
  private onSignInClick(): void {
    if (this.authModal) {
      this.authModal.open('login');
    }
  }

  /**
   * Handle successful authentication - proceed to character selection
   */
  private handleAuthSuccess(userData: any): void {
    console.log('Authentication successful:', userData);
    // TODO: Show character selection screen
    // For now, just close welcome screen and start game with authenticated user
    if (this.resolvePromise && userData.username) {
      this.resolvePromise(userData.username);
    }
  }


  /**
   * Show welcome screen and wait for user interaction
   * Returns the username entered by the user
   */
  async show(): Promise<string> {
    return new Promise(async (resolve) => {
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

        // Initialize 3D previews after DOM is ready
        setTimeout(async () => {
          await this.init3DPreviews();
        }, 100);
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
    // Cleanup 3D previews
    if (this.squirrelPreview) {
      this.squirrelPreview.destroy();
      this.squirrelPreview = null;
    }

    if (this.carouselPreview) {
      this.carouselPreview.destroy();
      this.carouselPreview = null;
    }

    if (this.carouselInterval !== null) {
      clearInterval(this.carouselInterval);
      this.carouselInterval = null;
    }

    // Remove from DOM
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
