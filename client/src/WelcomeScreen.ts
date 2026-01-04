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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class WelcomeScreen {
  private container: HTMLDivElement | null = null;
  private resolvePromise: ((result: { username: string; isGuest: boolean }) => void) | null = null;

  // 3D preview components
  private squirrelPreview: CharacterPreview3D | null = null;
  private carouselPreview: CharacterPreview3D | null = null;
  private carouselInterval: number | null = null;

  // Preloading
  private randomBackCharacter: string | null = null;
  private gltfLoader = new GLTFLoader();

  // Authentication modal
  private authModal: AuthModal | null = null;

  // MVP 16: Turnstile bot protection
  private turnstileToken: string | null = null;
  private turnstileResolve: (() => void) | null = null;
  private turnstileComplete: Promise<void>;

  constructor() {
    // Create promise that resolves when Turnstile verification completes
    this.turnstileComplete = new Promise((resolve) => {
      this.turnstileResolve = resolve;
    });

    this.createHTML();

    // Initialize AuthModal
    this.authModal = new AuthModal({
      onAuthSuccess: (userData) => this.handleAuthSuccess(userData)
    });
  }

  /**
   * Create HTML structure for welcome screen
   * Flip-card layout with front (welcome) and back (loading) states
   */
  private createHTML(): void {
    // Create container - simple overlay with centered card
    this.container = document.createElement('div');
    this.container.id = 'welcome-screen';
    this.container.innerHTML = `
      <div class="welcome-content">
        <!-- Simple Card (NO 3D transforms) -->
        <div class="welcome-card">
          <div class="card-top">
            <h1 class="card-title">HIDDEN WALNUTS</h1>
            <p class="card-tagline">Welcome to the Forest</p>

            <!-- 3D Character (Squirrel) -->
            <div class="card-character-3d" id="front-character-container"></div>
          </div>

          <div class="card-bottom">
            <!-- Turnstile Bot Protection -->
            <div class="card-turnstile" id="welcome-turnstile-container"></div>

            <!-- Username Input -->
            <input
              type="text"
              id="welcome-username-input"
              class="card-input"
              placeholder="Your name..."
              maxlength="20"
              autocomplete="off"
              spellcheck="false"
            />

            <!-- Primary Action Button -->
            <button id="welcome-play-button" class="card-button-primary" disabled>
              PLAY AS GUEST
            </button>

            <!-- Auth Links -->
            <div class="card-auth-links">
              <div class="card-auth-buttons">
                <button id="welcome-signup-link" class="card-auth-link card-auth-link-signup">
                  Sign Up
                </button>
                <button id="welcome-login-link" class="card-auth-link card-auth-link-login">
                  Log In
                </button>
              </div>
            </div>
          </div>
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

    // Initialize Turnstile first (button will be enabled after verification)
    this.initTurnstile();

    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for flip card buttons
   */
  private setupEventHandlers(): void {
    console.log('🔧 [WelcomeScreen] setupEventHandlers() called');

    const playButton = document.getElementById('welcome-play-button') as HTMLButtonElement;
    const signupLink = document.getElementById('welcome-signup-link');
    const loginLink = document.getElementById('welcome-login-link');
    const signupLinkBack = document.getElementById('welcome-signup-link-back');
    const loginLinkBack = document.getElementById('welcome-login-link-back');
    const input = document.getElementById('welcome-username-input') as HTMLInputElement;

    console.log('  - playButton:', !!playButton);
    console.log('  - signupLink:', !!signupLink);
    console.log('  - loginLink:', !!loginLink);
    console.log('  - input:', !!input);

    // Play as Guest button (already disabled, will be enabled by Turnstile)
    if (playButton && input) {
      playButton.addEventListener('click', () => this.onPlayAsGuestClick());

      // Allow Enter key to submit
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !playButton.disabled) {
          this.onPlayAsGuestClick();
        }
      });
      console.log('  ✅ Play button handler attached');
    }

    // Sign Up links (front and back)
    if (signupLink) {
      signupLink.addEventListener('click', () => {
        console.log('🖱️ Sign Up button CLICKED');
        this.onSignUpClick();
      });
      console.log('  ✅ Sign Up button handler attached');
    } else {
      console.error('  ❌ Sign Up button NOT FOUND in DOM!');
    }
    if (signupLinkBack) {
      signupLinkBack.addEventListener('click', () => this.onSignUpClick());
    }

    // Log In links (front and back)
    if (loginLink) {
      loginLink.addEventListener('click', () => {
        console.log('🖱️ Log In button CLICKED');
        this.onSignInClick();
      });
      console.log('  ✅ Log In button handler attached');
    } else {
      console.error('  ❌ Log In button NOT FOUND in DOM!');
    }
    if (loginLinkBack) {
      loginLinkBack.addEventListener('click', () => this.onSignInClick());
    }

    console.log('✅ [WelcomeScreen] Event handlers setup complete');
  }

  /**
   * Initialize 3D character previews
   * Front card: Squirrel
   * Back card: Random free character (initialized when card flips)
   */
  private async init3DPreviews(): Promise<void> {
    try {
      // Ensure CharacterRegistry is loaded first
      await CharacterRegistry.loadCharacters();

      // Initialize squirrel preview for front card
      this.squirrelPreview = new CharacterPreview3D(
        'front-character-container',
        'squirrel',
        { rotationSpeed: 0.005, autoRotate: true, showAnimation: true, cameraDistance: 1.5 }
      );
      await this.squirrelPreview.init();

      // Preload back card character for faster flip
      await this.preloadBackCharacter();
    } catch (error) {
      console.error('Error initializing 3D previews:', error);
    }
  }

  /**
   * Preload the back character model during idle time on front card
   */
  private async preloadBackCharacter(): Promise<void> {
    try {
      // Pick a random free character (excluding squirrel)
      const freeCharacters = ['hare', 'goat', 'chipmunk', 'turkey', 'mallard'];
      this.randomBackCharacter = freeCharacters[Math.floor(Math.random() * freeCharacters.length)];

      // Get character data
      const characterData = CharacterRegistry.getCharacterById(this.randomBackCharacter);
      if (!characterData?.modelPath) {
        console.warn('⚠️ Character model path not found for preloading');
        return;
      }

      // Preload the GLTF model
      await new Promise((resolve, reject) => {
        this.gltfLoader.load(
          characterData.modelPath,
          () => {
            console.log(`✅ Preloaded back character: ${this.randomBackCharacter}`);
            resolve(true);
          },
          undefined,
          (error) => {
            console.warn('⚠️ Failed to preload back character:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.warn('⚠️ Error preloading back character:', error);
    }
  }

  /**
   * Handle Play as Guest click - resolves promise to start game loading
   */
  private onPlayAsGuestClick(): void {
    const input = document.getElementById('welcome-username-input') as HTMLInputElement;
    const username = input?.value.trim() || '';

    if (!username) {
      input?.focus();
      return;
    }

    // Disable button to prevent double-click
    const playButton = document.getElementById('welcome-play-button') as HTMLButtonElement;
    if (playButton) {
      playButton.disabled = true;
      playButton.style.opacity = '0.5';
    }

    // Resolve with username - main.ts will handle transition to loading overlay
    if (this.resolvePromise) {
      this.resolvePromise({ username, isGuest: true });
    }
  }

  /**
   * Handle Sign Up click - Open AuthModal in signup mode with prefilled username
   */
  private onSignUpClick(): void {
    console.log('🎯 [WelcomeScreen] onSignUpClick() called');
    console.log('  - authModal exists:', !!this.authModal);

    if (this.authModal) {
      // Get username from card input field
      const usernameInput = document.getElementById('welcome-username-input') as HTMLInputElement;
      const username = usernameInput?.value.trim() || '';
      console.log('  - username from input:', username);

      // Open auth modal directly
      console.log('  - Calling authModal.open("signup", ...)');
      this.authModal.open('signup', username ? { username } : undefined);
    } else {
      console.error('  ❌ authModal is NULL!');
    }
  }

  /**
   * Handle Sign In click - Open AuthModal in login mode
   */
  private onSignInClick(): void {
    console.log('🎯 [WelcomeScreen] onSignInClick() called');
    console.log('  - authModal exists:', !!this.authModal);

    if (this.authModal) {
      // Open auth modal directly
      console.log('  - Calling authModal.open("login")');
      this.authModal.open('login');
    } else {
      console.error('  ❌ authModal is NULL!');
    }
  }

  /**
   * Handle successful authentication - start game loading
   */
  private async handleAuthSuccess(userData: any): Promise<void> {
    console.log('Authentication successful:', userData);

    // Resolve with username to start game loading
    if (this.resolvePromise && userData.username) {
      this.resolvePromise({ username: userData.username, isGuest: false });
    }
  }

  /**
   * Initialize random 3D character on back of card
   */

  /**
   * Update loading progress bar (called externally from main.ts)
   * @param progress - Progress value from 0 to 1
   * @param message - Optional message to display
   */
  public updateLoadingProgress(progress: number, message: string = ''): void {
    console.log(`📊 [WelcomeScreen] updateLoadingProgress(${progress}, "${message}")`);

    const progressBar = document.getElementById('card-progress-bar');
    const loadingText = document.getElementById('card-loading-text');

    if (progressBar) {
      const percentage = Math.round(progress * 100);
      progressBar.style.width = `${percentage}%`;
      console.log(`✅ [WelcomeScreen] Progress bar updated to ${percentage}%`);
    } else {
      console.error('❌ [WelcomeScreen] card-progress-bar element NOT FOUND');
    }

    if (loadingText) {
      if (message) {
        loadingText.textContent = message;
        console.log(`✅ [WelcomeScreen] Loading text updated: "${message}"`);
      }
    } else {
      console.error('❌ [WelcomeScreen] card-loading-text element NOT FOUND');
    }
  }

  /**
   * Wait for loading to complete (called after progress reaches 100%)
   */
  public async finishLoading(): Promise<void> {
    const loadingText = document.getElementById('card-loading-text');
    if (loadingText) {
      loadingText.textContent = 'Forest ready!';
    }
    // Increased from 800ms to 1500ms to give more time before transition
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  /**
   * MVP 16: Initialize Cloudflare Turnstile bot protection
   * Buttons are disabled until verification completes
   */
  private async initTurnstile(): Promise<void> {
    const container = document.getElementById('welcome-turnstile-container');
    const statusDiv = document.getElementById('welcome-turnstile-status');

    if (!container) {
      console.error('❌ Turnstile container not found');
      return;
    }

    // Wait for Turnstile script to load
    const waitForTurnstile = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkTurnstile = () => {
          if (typeof (window as any).turnstile !== 'undefined') {
            resolve();
          } else {
            setTimeout(checkTurnstile, 100);
          }
        };
        checkTurnstile();
      });
    };

    await waitForTurnstile();

    // Determine site key based on hostname
    const hostname = window.location.hostname;
    const isProduction = hostname === 'game.hiddenwalnuts.com';
    const TURNSTILE_SITE_KEY = isProduction
      ? '0x4AAAAAAB7S9YhTOdtQjCTu' // Production key
      : '1x00000000000000000000AA'; // Testing key (always passes)

    console.log(`🤖 [Turnstile] Initializing on ${hostname} (${isProduction ? 'production' : 'preview'})`);

    try {
      const turnstile = (window as any).turnstile;
      turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          console.log('✅ [Turnstile] Verification successful');
          this.turnstileToken = token;
          this.onTurnstileComplete();
        },
        'error-callback': () => {
          console.error('❌ [Turnstile] Verification failed');
          if (statusDiv) {
            statusDiv.textContent = '❌ Verification failed. Please refresh the page.';
            statusDiv.style.color = '#c33';
          }
          // Still resolve the promise so showWelcomeBack doesn't hang
          // Server will handle the failed verification
          if (this.turnstileResolve) {
            this.turnstileResolve();
          }
        },
        theme: 'dark',
      });
    } catch (error) {
      console.error('❌ [Turnstile] Failed to render:', error);
      // Enable buttons anyway in development
      this.onTurnstileComplete();
    }
  }

  /**
   * MVP 16: Called when Turnstile verification completes
   * Enables play button and updates UI
   */
  private onTurnstileComplete(): void {
    console.log('🎯 [Turnstile] Enabling play button');

    // Enable play button
    const playButton = document.getElementById('welcome-play-button') as HTMLButtonElement;

    if (playButton) {
      playButton.disabled = false;
      playButton.textContent = 'PLAY AS GUEST';
      playButton.style.opacity = '1';
      playButton.style.cursor = 'pointer';
    }

    // Resolve the turnstileComplete promise
    if (this.turnstileResolve) {
      this.turnstileResolve();
    }
  }

  /**
   * MVP 16: Get Turnstile token for WebSocket authentication
   */
  getTurnstileToken(): string | null {
    return this.turnstileToken;
  }

  /**
   * Wait for user to enter username and click play
   * Returns promise that resolves with username and guest status
   */
  public waitForUsername(): Promise<{ username: string; isGuest: boolean }> {
    // Initialize 3D previews after DOM is ready
    setTimeout(async () => {
      await this.init3DPreviews();
    }, 100);

    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      if (this.container) {
        this.container.style.display = 'flex'; // Ensure it's visible!
        this.container.style.pointerEvents = 'auto';
        // Force reflow
        this.container.offsetHeight;
        this.container.style.transition = 'opacity 0.5s ease-in';
        this.container.style.opacity = '1';
      }

      // Auto-focus the username input
      const input = document.getElementById('welcome-username-input') as HTMLInputElement;
      if (input) {
        setTimeout(() => input.focus(), 100);
      }
    });
  }

  /**
   * MVP 6: Show "Welcome Back" message for returning users
   * Auto-continues after 2 seconds or on button click
   *
   * MVP 16 FIX: Wait for Turnstile verification before showing message
   * This prevents destroying the Turnstile widget before it completes
   */
  async showWelcomeBack(username: string): Promise<{ switchCharacter: boolean }> {
    if (!this.container) return { switchCharacter: false };

    // Show container with original content (including Turnstile) but make card invisible
    this.container.style.opacity = '0';
    this.container.style.display = 'flex';
    this.container.style.pointerEvents = 'none'; // Disable clicks while waiting

    requestAnimationFrame(() => {
      if (this.container) {
        this.container.style.opacity = '1'; // Fade in container (but card is still invisible)
      }
    });

    // Make the welcome card invisible while Turnstile completes in background
    const welcomeCard = this.container.querySelector('.welcome-card') as HTMLElement;
    if (welcomeCard) {
      welcomeCard.style.opacity = '0';
      welcomeCard.style.pointerEvents = 'none';
    }

    console.log('⏳ [WelcomeScreen] Waiting for Turnstile verification...');

    // Wait for Turnstile verification to complete (don't destroy the widget!)
    // Add timeout to prevent hanging forever
    await Promise.race([
      this.turnstileComplete,
      new Promise((resolve) => setTimeout(() => {
        console.warn('⚠️ [WelcomeScreen] Turnstile verification timed out after 10s');
        resolve(undefined);
      }, 10000))
    ]);

    console.log('✅ [WelcomeScreen] Turnstile verified, showing welcome back message');

    // NOW it's safe to replace the HTML
    const welcomeContent = this.container.querySelector('.welcome-content');
    if (welcomeContent) {
      // MVP 16: Enhanced Welcome Back with Change Character option
      welcomeContent.innerHTML = `
        <div class="welcome-card" style="
          max-width: 450px;
          text-align: center;
          padding: 40px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: fadeScaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        ">
          <h1 class="welcome-title" style="margin:0; font-size: 32px; color: #FFD700; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">Welcome Back!</h1>
          <p class="welcome-tagline" style="margin:0; font-size: 18px; color: #FFE4B5;">
            Hey <strong>${username}</strong>, ready for more?
          </p>

          <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <button id="welcome-continue-button" class="card-button-primary" style="width: 100%; max-width: none;">
              RESUME GAME
            </button>

            <button id="welcome-change-char-button" style="
              background: rgba(255, 255, 255, 0.1);
              border: 2px solid rgba(255, 215, 0, 0.3);
              color: #FFE4B5;
              padding: 12px;
              border-radius: 12px;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.2s;
              font-size: 14px;
            ">
              Change Character
            </button>
          </div>
          
          <div style="font-size: 12px; color: rgba(255,228,181,0.6); margin-top: 5px;">
            Auto-starting in <span id="welcome-countdown">2</span>...
          </div>
        </div>
        <style>
          @keyframes fadeScaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          #welcome-change-char-button:hover {
            background: rgba(255, 215, 0, 0.15);
            border-color: #FFD700;
            color: #FFD700;
          }
        </style>
      `;
    }

    // Re-enable pointer events
    this.container.style.pointerEvents = 'auto';

    // Auto-continue logic with cancellation
    return new Promise((resolve) => {
      const continueButton = document.getElementById('welcome-continue-button');
      const changeCharButton = document.getElementById('welcome-change-char-button');
      const countdownSpan = document.getElementById('welcome-countdown');
      let countdown = 2; // match HTML

      let timeout: number | null = null;
      let interval: number | null = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (interval) clearInterval(interval);
        continueButton?.removeEventListener('click', handleContinue);
        changeCharButton?.removeEventListener('click', handleChangeChar);
      };

      const handleContinue = () => {
        console.log('👆 [WelcomeScreen] User clicked Continue');
        cleanup();
        resolve({ switchCharacter: false });
      };

      const handleChangeChar = () => {
        console.log('[WelcomeScreen] User clicked Change Character');
        cleanup();
        resolve({ switchCharacter: true }); // Signal to switch character
      };

      // Setup click handlers
      continueButton?.addEventListener('click', handleContinue);
      changeCharButton?.addEventListener('click', handleChangeChar);

      // Start countdown
      const startCountdown = () => {
        interval = window.setInterval(() => {
          countdown--;
          if (countdownSpan) countdownSpan.textContent = countdown.toString();

          if (countdown <= 0) {
            cleanup();
            console.log('⏰ [WelcomeScreen] Auto-continue triggered');
            resolve({ switchCharacter: false });
          }
        }, 1000);
      };

      startCountdown();
    });
  }

  /**
   * Hide welcome screen with fade out
   * MVP 16 FIX: Set pointer-events:none IMMEDIATELY to prevent click blocking
   *
   * Critical: Must disable pointer events BEFORE starting fade animation.
   * If we wait until after the 500ms timeout, the invisible overlay blocks
   * all clicks during the fade, breaking all UI controls.
   */
  async hide(): Promise<void> {
    return new Promise((resolve) => {
      if (this.container) {
        // CRITICAL: Disable pointer events IMMEDIATELY (before fade starts)
        // This ensures clicks pass through even during the fade animation
        this.container.style.pointerEvents = 'none';

        // Start fade out animation
        this.container.style.transition = 'opacity 0.5s ease-out';
        this.container.style.opacity = '0';

        // Hide completely after animation
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
