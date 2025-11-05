/**
 * Authentication Modal Component
 * MVP 16: Base modal system for authentication flows
 *
 * Supports multiple screens:
 * - signup: User signup form
 * - login: User login form
 * - forgot-password: Password reset request
 * - reset-password: Password reset with token
 * - verify-email: Email verification landing
 *
 * Platform support:
 * - Desktop (1025px+): 600px centered modal
 * - iPad Portrait (768-1024px): 700px modal
 * - iPad Landscape (768-1024px): 800px modal
 * - iPhone Portrait (≤430px): Full-screen
 * - iPhone Landscape (≤932px width, ≤500px height): 400px compact modal
 */

export type AuthScreen = 'signup' | 'login' | 'forgot-password' | 'reset-password' | 'verify-email';

export interface AuthModalOptions {
  initialScreen?: AuthScreen;
  onClose?: () => void;
  onAuthSuccess?: (userData: any) => void;
}

export class AuthModal {
  private container: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private modalElement: HTMLElement | null = null;
  private currentScreen: AuthScreen = 'signup';
  private options: AuthModalOptions;
  private isOpen: boolean = false;

  constructor(options: AuthModalOptions = {}) {
    this.options = options;
    this.currentScreen = options.initialScreen || 'signup';
    this.createModal();
    this.setupEventListeners();
  }

  /**
   * Create the modal DOM structure
   */
  private createModal(): void {
    // Get or create modal root container
    let root = document.getElementById('auth-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'auth-modal-root';
      document.body.appendChild(root);
    }
    this.container = root;

    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'auth-modal-backdrop';
    this.backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Create modal
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'auth-modal';
    this.modalElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-height: 90vh;
      overflow-y: auto;
      width: 600px;
      max-width: 90vw;
    `;

    // Add responsive sizing
    this.applyResponsiveStyles();

    // Append to container
    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.modalElement);
  }

  /**
   * Apply responsive styles based on screen size
   */
  private applyResponsiveStyles(): void {
    if (!this.modalElement) return;

    // Desktop (1025px+): 600px
    // iPad Portrait (768-1024px portrait): 700px
    // iPad Landscape (768-1024px landscape): 800px
    // iPhone Portrait (≤430px): Full-screen
    // iPhone Landscape (≤932px width, ≤500px height): 400px compact

    const style = document.createElement('style');
    style.textContent = `
      /* Desktop */
      @media (min-width: 1025px) {
        .auth-modal {
          width: 600px !important;
        }
      }

      /* iPad Portrait */
      @media (min-width: 768px) and (max-width: 1024px) and (orientation: portrait) {
        .auth-modal {
          width: 700px !important;
          max-width: 85vw !important;
        }
      }

      /* iPad Landscape */
      @media (min-width: 768px) and (max-width: 1024px) and (orientation: landscape) {
        .auth-modal {
          width: 800px !important;
          max-width: 85vw !important;
        }
      }

      /* iPhone Portrait */
      @media (max-width: 430px) and (orientation: portrait) {
        .auth-modal {
          width: 100% !important;
          max-width: 100% !important;
          height: 100%;
          max-height: 100%;
          border-radius: 0 !important;
          top: 0 !important;
          left: 0 !important;
          transform: none !important;
        }
      }

      /* iPhone Landscape */
      @media (max-width: 932px) and (max-height: 500px) and (orientation: landscape) {
        .auth-modal {
          width: 400px !important;
          max-width: 85vw !important;
          max-height: 85vh !important;
        }
      }

      /* Prevent body scroll when modal is open */
      body.auth-modal-open {
        overflow: hidden;
      }

      /* Focus styles for accessibility */
      .auth-modal input:focus,
      .auth-modal button:focus {
        outline: 2px solid #4A90E2;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup event listeners for keyboard navigation and backdrop clicks
   */
  private setupEventListeners(): void {
    // ESC key to close
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Tab key navigation (trap focus within modal)
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab' && this.isOpen && this.modalElement) {
        this.trapFocus(e);
      }
    });

    // Backdrop click to close
    this.backdrop?.addEventListener('click', () => {
      this.close();
    });

    // Prevent modal content clicks from closing
    this.modalElement?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
    });
  }

  /**
   * Trap focus within modal for accessibility
   */
  private trapFocus(e: KeyboardEvent): void {
    if (!this.modalElement) return;

    const focusableElements = this.modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Open the modal with the specified screen
   */
  public open(screen?: AuthScreen): void {
    if (screen) {
      this.currentScreen = screen;
    }

    this.isOpen = true;
    document.body.classList.add('auth-modal-open');

    // Show elements
    if (this.backdrop) {
      this.backdrop.style.display = 'block';
      // Force reflow for animation
      void this.backdrop.offsetWidth;
      this.backdrop.style.opacity = '1';
    }

    if (this.modalElement) {
      this.modalElement.style.display = 'block';
      // Force reflow for animation
      void this.modalElement.offsetWidth;
      this.modalElement.style.opacity = '1';
    }

    // Render the current screen
    this.renderScreen();

    // Focus first input
    setTimeout(() => {
      const firstInput = this.modalElement?.querySelector('input') as HTMLElement;
      firstInput?.focus();
    }, 100);
  }

  /**
   * Close the modal
   */
  public close(): void {
    this.isOpen = false;
    document.body.classList.remove('auth-modal-open');

    // Fade out
    if (this.backdrop) {
      this.backdrop.style.opacity = '0';
    }
    if (this.modalElement) {
      this.modalElement.style.opacity = '0';
    }

    // Hide after animation
    setTimeout(() => {
      if (this.backdrop) {
        this.backdrop.style.display = 'none';
      }
      if (this.modalElement) {
        this.modalElement.style.display = 'none';
      }
    }, 300);

    // Call close callback
    this.options.onClose?.();
  }

  /**
   * Navigate to a different screen
   */
  public navigateTo(screen: AuthScreen): void {
    this.currentScreen = screen;
    this.renderScreen();
  }

  /**
   * Render the current screen content
   */
  private renderScreen(): void {
    if (!this.modalElement) return;

    // Import form components dynamically
    import('./SignupForm').then(({ SignupForm }) => {
      import('./LoginForm').then(({ LoginForm }) => {
        import('./ForgotPasswordForm').then(({ ForgotPasswordForm }) => {
          import('./ResetPasswordForm').then(({ ResetPasswordForm }) => {
            this.renderScreenWithForms(SignupForm, LoginForm, ForgotPasswordForm, ResetPasswordForm);
          });
        });
      });
    });
  }

  /**
   * Render screen with form components loaded
   */
  private renderScreenWithForms(
    SignupForm: any,
    LoginForm: any,
    ForgotPasswordForm: any,
    ResetPasswordForm: any
  ): void {
    if (!this.modalElement) return;

    // Clear existing content
    this.modalElement.innerHTML = '';

    // Create header with close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    `;

    const title = document.createElement('h2');
    title.style.cssText = `
      margin: 0;
      font-size: 24px;
      color: #333;
      font-weight: 600;
    `;
    title.textContent = this.getScreenTitle();

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 32px;
      color: #999;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      line-height: 32px;
      text-align: center;
      transition: color 0.2s;
    `;
    closeButton.addEventListener('mouseover', () => closeButton.style.color = '#333');
    closeButton.addEventListener('mouseout', () => closeButton.style.color = '#999');
    closeButton.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeButton);
    this.modalElement.appendChild(header);

    // Create content container
    const content = document.createElement('div');
    content.className = 'auth-modal-content';
    content.style.cssText = `
      padding: 30px 20px;
    `;

    // Render screen-specific content
    switch (this.currentScreen) {
      case 'signup':
        new SignupForm(content, {
          onSuccess: (response: any) => {
            this.options.onAuthSuccess?.(response);
            this.close();
          },
          onSwitchToLogin: () => this.navigateTo('login')
        });
        break;
      case 'login':
        new LoginForm(content, {
          onSuccess: (response: any) => {
            this.options.onAuthSuccess?.(response);
            this.close();
          },
          onSwitchToSignup: () => this.navigateTo('signup'),
          onForgotPassword: () => this.navigateTo('forgot-password')
        });
        break;
      case 'forgot-password':
        new ForgotPasswordForm(content, {
          onSuccess: () => {
            // Keep modal open to show success message
          },
          onBackToLogin: () => this.navigateTo('login')
        });
        break;
      case 'reset-password':
        // Get token from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token') || '';

        new ResetPasswordForm(content, {
          token,
          onSuccess: () => {
            // Redirect to login after success message
            setTimeout(() => this.navigateTo('login'), 2000);
          },
          onRequestNewLink: () => this.navigateTo('forgot-password')
        });
        break;
      case 'verify-email':
        content.innerHTML = '<p>Email verification page will be implemented in Part 2B</p>';
        break;
    }

    this.modalElement.appendChild(content);
  }

  /**
   * Get the title for the current screen
   */
  private getScreenTitle(): string {
    switch (this.currentScreen) {
      case 'signup':
        return 'Sign Up';
      case 'login':
        return 'Log In';
      case 'forgot-password':
        return 'Forgot Password';
      case 'reset-password':
        return 'Reset Password';
      case 'verify-email':
        return 'Verify Email';
      default:
        return 'Authentication';
    }
  }

  /**
   * Destroy the modal and clean up
   */
  public destroy(): void {
    this.close();
    this.backdrop?.remove();
    this.modalElement?.remove();
  }
}
