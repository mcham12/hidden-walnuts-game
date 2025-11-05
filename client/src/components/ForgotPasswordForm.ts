/**
 * Forgot Password Form Component
 * MVP 16: Password reset request form
 *
 * Features:
 * - Email field with validation
 * - API integration for password reset request
 * - Success message: "Check Your Email!"
 * - Rate limiting: 3 requests per hour per email
 * - Security: Don't reveal if email exists
 * - Back to login link
 */

import { validateEmail } from '../utils/validation';
import { forgotPassword } from '../services/AuthService';

export interface ForgotPasswordFormOptions {
  onSuccess?: () => void;
  onBackToLogin?: () => void;
}

export class ForgotPasswordForm {
  private container: HTMLElement;
  private options: ForgotPasswordFormOptions;
  private isLoading: boolean = false;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  // Form fields
  private emailInput: HTMLInputElement | null = null;
  private submitButton: HTMLButtonElement | null = null;

  // Validation indicator
  private emailIndicator: HTMLElement | null = null;

  // Message displays
  private errorMessage: HTMLElement | null = null;
  private successMessage: HTMLElement | null = null;

  constructor(container: HTMLElement, options: ForgotPasswordFormOptions = {}) {
    this.container = container;
    this.options = options;
    this.loadRateLimitState();
    this.render();
    this.setupEventListeners();
  }

  /**
   * Load rate limit state from localStorage
   */
  private loadRateLimitState(): void {
    try {
      const state = localStorage.getItem('forgot_password_rate_limit');
      if (state) {
        const parsed = JSON.parse(state);
        this.requestCount = parsed.count || 0;
        this.lastRequestTime = parsed.lastRequest || 0;

        // Reset if more than 1 hour has passed
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - this.lastRequestTime > oneHour) {
          this.requestCount = 0;
          this.lastRequestTime = 0;
        }
      }
    } catch (error) {
      console.error('Error loading rate limit state:', error);
    }
  }

  /**
   * Save rate limit state to localStorage
   */
  private saveRateLimitState(): void {
    try {
      localStorage.setItem('forgot_password_rate_limit', JSON.stringify({
        count: this.requestCount,
        lastRequest: this.lastRequestTime
      }));
    } catch (error) {
      console.error('Error saving rate limit state:', error);
    }
  }

  /**
   * Render the forgot password form
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="forgot-password-form">
        <!-- Instructions -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 24px; color: #333;">Reset Your Password</h3>
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <!-- Success Message -->
        <div class="success-message" style="display: none; background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">✉️</div>
          <h4 style="margin: 0 0 8px 0; font-size: 18px;">Check Your Email!</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6;">
            If an account exists with that email, you'll receive password reset instructions shortly.
          </p>
        </div>

        <!-- Error Message -->
        <div class="error-message" style="display: none; background: #fee; border: 1px solid #fcc; color: #c33; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

        <!-- Email Field -->
        <div class="form-group" style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            Email Address
          </label>
          <div style="position: relative;">
            <input
              type="email"
              name="email"
              placeholder="your.email@example.com"
              autocomplete="email"
              style="
                width: 100%;
                height: 50px;
                padding: 0 40px 0 12px;
                font-size: 16px;
                border: 2px solid #ddd;
                border-radius: 8px;
                box-sizing: border-box;
                transition: border-color 0.2s;
              "
            />
            <span class="validation-indicator" style="
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 20px;
              display: none;
            "></span>
          </div>
          <div class="field-error" style="color: #c33; font-size: 13px; margin-top: 4px; display: none;"></div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="submit-button"
          style="
            width: 100%;
            height: 60px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
            margin-bottom: 16px;
          "
        >
          Send Reset Link
        </button>

        <!-- Back to Login -->
        <div style="text-align: center; font-size: 14px; color: #666;">
          <a href="#" class="back-to-login" style="color: #667eea; font-weight: 600; text-decoration: none;">← Back to Log In</a>
        </div>
      </div>
    `;

    // Store references to form elements
    this.emailInput = this.container.querySelector('input[name="email"]');
    this.submitButton = this.container.querySelector('.submit-button');
    this.errorMessage = this.container.querySelector('.error-message');
    this.successMessage = this.container.querySelector('.success-message');
    this.emailIndicator = this.container.querySelector('.validation-indicator');
  }

  /**
   * Setup event listeners for form interactions
   */
  private setupEventListeners(): void {
    // Real-time validation on input
    this.emailInput?.addEventListener('input', () => this.validateField());

    // Form submission
    this.submitButton?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Enter key submission
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.isLoading) {
        e.preventDefault();
        this.handleSubmit();
      }
    });

    // Back to login link
    const backToLoginLink = this.container.querySelector('.back-to-login');
    backToLoginLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onBackToLogin?.();
    });

    // Button hover effects
    this.submitButton?.addEventListener('mouseenter', () => {
      if (!this.isLoading && this.submitButton) {
        this.submitButton.style.transform = 'scale(1.02)';
      }
    });
    this.submitButton?.addEventListener('mouseleave', () => {
      if (this.submitButton) {
        this.submitButton.style.transform = 'scale(1)';
      }
    });
  }

  /**
   * Validate email field and update UI
   */
  private validateField(): void {
    const email = this.emailInput?.value || '';
    const result = validateEmail(email);
    const errorElement = this.emailInput?.parentElement?.parentElement?.querySelector('.field-error');

    // Only show validation if field has been touched
    if (email.length === 0) {
      this.emailIndicator!.style.display = 'none';
      this.emailInput!.style.borderColor = '#ddd';
      if (errorElement) {
        (errorElement as HTMLElement).style.display = 'none';
      }
      return;
    }

    // Update indicator
    if (result.isValid) {
      this.emailIndicator!.textContent = '✅';
      this.emailIndicator!.style.display = 'block';
      this.emailInput!.style.borderColor = '#27AE60';
      if (errorElement) {
        (errorElement as HTMLElement).style.display = 'none';
      }
    } else {
      this.emailIndicator!.textContent = '❌';
      this.emailIndicator!.style.display = 'block';
      this.emailInput!.style.borderColor = '#E74C3C';
      if (errorElement && result.error) {
        (errorElement as HTMLElement).textContent = result.error;
        (errorElement as HTMLElement).style.display = 'block';
      }
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (this.isLoading) return;

    // Check rate limiting (3 per hour)
    if (this.requestCount >= 3) {
      this.showError('Too many password reset requests. Please try again in an hour.');
      return;
    }

    // Validate email
    const email = this.emailInput?.value || '';
    const validation = validateEmail(email);

    this.validateField();

    if (!validation.isValid) {
      this.showError('Please enter a valid email address.');
      return;
    }

    // Set loading state
    this.setLoading(true);
    this.hideError();
    this.hideSuccess();

    try {
      // Call forgot password API
      const response = await forgotPassword({ email });

      if (response.success) {
        // Update rate limit
        this.requestCount++;
        this.lastRequestTime = Date.now();
        this.saveRateLimitState();

        // Show success message (always show success for security)
        this.showSuccess();

        // Call success callback
        this.options.onSuccess?.();
      } else {
        // Show error from server
        this.showError(response.message || response.error || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      this.showError('An unexpected error occurred. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Set loading state
   */
  private setLoading(loading: boolean): void {
    this.isLoading = loading;

    if (this.submitButton) {
      if (loading) {
        this.submitButton.disabled = true;
        this.submitButton.style.opacity = '0.7';
        this.submitButton.style.cursor = 'not-allowed';
        this.submitButton.textContent = 'Sending Email...';
      } else {
        this.submitButton.disabled = false;
        this.submitButton.style.opacity = '1';
        this.submitButton.style.cursor = 'pointer';
        this.submitButton.textContent = 'Send Reset Link';
      }
    }

    // Disable input during loading
    if (this.emailInput) {
      this.emailInput.disabled = loading;
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
      this.errorMessage.style.display = 'block';
    }
  }

  /**
   * Hide error message
   */
  private hideError(): void {
    if (this.errorMessage) {
      this.errorMessage.style.display = 'none';
    }
  }

  /**
   * Show success message
   */
  private showSuccess(): void {
    if (this.successMessage) {
      this.successMessage.style.display = 'block';
    }

    // Hide the form fields
    const formGroup = this.container.querySelector('.form-group');
    const submitButton = this.container.querySelector('.submit-button');
    if (formGroup) (formGroup as HTMLElement).style.display = 'none';
    if (submitButton) (submitButton as HTMLElement).style.display = 'none';
  }

  /**
   * Hide success message
   */
  private hideSuccess(): void {
    if (this.successMessage) {
      this.successMessage.style.display = 'none';
    }

    // Show the form fields
    const formGroup = this.container.querySelector('.form-group');
    const submitButton = this.container.querySelector('.submit-button');
    if (formGroup) (formGroup as HTMLElement).style.display = 'block';
    if (submitButton) (submitButton as HTMLElement).style.display = 'block';
  }

  /**
   * Clear form
   */
  public clear(): void {
    if (this.emailInput) this.emailInput.value = '';
    this.hideError();
    this.hideSuccess();
  }
}
