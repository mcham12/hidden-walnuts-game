/**
 * Login Form Component
 * MVP 16: User login form with validation and error handling
 *
 * Features:
 * - Email and password fields
 * - Password show/hide toggle
 * - "Forgot Password?" link
 * - "Don't have an account? Sign Up" link
 * - API integration with error handling
 * - Loading states during submission
 * - Rate limiting feedback (3/5 attempts)
 */

import { validateLoginForm } from '../utils/validation';
import { login, type LoginResponse } from '../services/AuthService';

export interface LoginFormOptions {
  onSuccess?: (response: LoginResponse) => void;
  onSwitchToSignup?: () => void;
  onForgotPassword?: () => void;
}

export class LoginForm {
  private container: HTMLElement;
  private options: LoginFormOptions;
  private isLoading: boolean = false;
  private loginAttempts: number = 0;

  // Form fields
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private submitButton: HTMLButtonElement | null = null;

  // Validation indicators
  private emailIndicator: HTMLElement | null = null;
  private passwordIndicator: HTMLElement | null = null;

  // Error message display
  private errorMessage: HTMLElement | null = null;

  constructor(container: HTMLElement, options: LoginFormOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the login form
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="login-form">
        <!-- Welcome Message -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 24px; color: #FFD700; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">Welcome Back!</h3>
          <p style="margin: 0; color: #FFE4B5; font-size: 14px;">Log in to continue your adventure</p>
        </div>

        <!-- Error Message -->
        <div class="error-message" style="display: none; background: rgba(255, 68, 68, 0.15); border: 1px solid rgba(255, 68, 68, 0.5); color: #FF9999; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 500;"></div>

        <!-- Email Field -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #FFD700; font-size: 14px;">
            Email
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
          <div class="field-error" style="color: #FF6B6B; font-size: 13px; margin-top: 4px; display: none; font-weight: 500;"></div>
        </div>

        <!-- Password Field -->
        <div class="form-group" style="margin-bottom: 12px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #FFD700; font-size: 14px;">
            Password
          </label>
          <div style="position: relative;">
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              style="
                width: 100%;
                height: 50px;
                padding: 0 80px 0 12px;
                font-size: 16px;
                border: 2px solid #ddd;
                border-radius: 8px;
                box-sizing: border-box;
                transition: border-color 0.2s;
              "
            />
            <button
              type="button"
              class="password-toggle"
              style="
                position: absolute;
                right: 40px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                padding: 4px 8px;
              "
            >👁️</button>
            <span class="validation-indicator" style="
              position: absolute;
              right: 12px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 20px;
              display: none;
            "></span>
          </div>
          <div class="field-error" style="color: #FF6B6B; font-size: 13px; margin-top: 4px; display: none; font-weight: 500;"></div>
        </div>

        <!-- Forgot Password Link -->
        <div style="text-align: right; margin-bottom: 24px;">
          <a href="#" class="forgot-password-link" style="color: #FFD700; font-size: 14px; text-decoration: none; font-weight: 500;">
            Forgot Password?
          </a>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="submit-button"
          style="
            width: 100%;
            height: 60px;
            background: linear-gradient(135deg, #32CD32 0%, #228B22 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, opacity 0.2s;
            margin-bottom: 16px;
            box-shadow: 0 8px 24px rgba(50, 205, 50, 0.4);
          "
        >
          Log In
        </button>

        <!-- Switch to Signup -->
        <div style="text-align: center; font-size: 14px; color: #FFE4B5;">
          Don't have an account?
          <a href="#" class="switch-to-signup" style="color: #FFD700; font-weight: 600; text-decoration: none;">Sign Up</a>
        </div>
      </div>
    `;

    // Store references to form elements
    this.emailInput = this.container.querySelector('input[name="email"]');
    this.passwordInput = this.container.querySelector('input[name="password"]');
    this.submitButton = this.container.querySelector('.submit-button');
    this.errorMessage = this.container.querySelector('.error-message');

    // Get validation indicators
    const indicators = this.container.querySelectorAll('.validation-indicator');
    this.emailIndicator = indicators[0] as HTMLElement;
    this.passwordIndicator = indicators[1] as HTMLElement;
  }

  /**
   * Setup event listeners for form interactions
   */
  private setupEventListeners(): void {
    // Real-time validation on input
    this.emailInput?.addEventListener('input', () => this.validateField('email'));
    this.passwordInput?.addEventListener('input', () => this.validateField('password'));

    // Password toggle
    const passwordToggle = this.container.querySelector('.password-toggle');
    passwordToggle?.addEventListener('click', () => this.togglePasswordVisibility());

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

    // Forgot password link
    const forgotPasswordLink = this.container.querySelector('.forgot-password-link');
    forgotPasswordLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onForgotPassword?.();
    });

    // Switch to signup
    const switchLink = this.container.querySelector('.switch-to-signup');
    switchLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onSwitchToSignup?.();
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
   * Validate a single field and update UI
   */
  private validateField(field: 'email' | 'password'): void {
    const email = this.emailInput?.value || '';
    const password = this.passwordInput?.value || '';

    const validation = validateLoginForm(email, password);

    let result;
    let indicator;
    let input;
    let errorElement;

    switch (field) {
      case 'email':
        result = validation.email;
        indicator = this.emailIndicator;
        input = this.emailInput;
        errorElement = this.emailInput?.parentElement?.parentElement?.querySelector('.field-error');
        break;
      case 'password':
        result = validation.password;
        indicator = this.passwordIndicator;
        input = this.passwordInput;
        errorElement = this.passwordInput?.parentElement?.parentElement?.querySelector('.field-error');
        break;
    }

    // Only show validation if field has been touched
    if (input?.value.length === 0) {
      indicator!.style.display = 'none';
      input!.style.borderColor = '#ddd';
      if (errorElement) {
        (errorElement as HTMLElement).style.display = 'none';
      }
      return;
    }

    // Update indicator
    if (result.isValid) {
      indicator!.textContent = '✅';
      indicator!.style.display = 'block';
      input!.style.borderColor = '#27AE60';
      if (errorElement) {
        (errorElement as HTMLElement).style.display = 'none';
      }
    } else {
      indicator!.textContent = '❌';
      indicator!.style.display = 'block';
      input!.style.borderColor = '#E74C3C';
      if (errorElement && result.error) {
        (errorElement as HTMLElement).textContent = result.error;
        (errorElement as HTMLElement).style.display = 'block';
      }
    }
  }

  /**
   * Toggle password visibility
   */
  private togglePasswordVisibility(): void {
    const isPassword = this.passwordInput?.type === 'password';
    if (this.passwordInput) {
      this.passwordInput.type = isPassword ? 'text' : 'password';
    }
  }

  /**
   * Handle form submission
   */
  private async handleSubmit(): Promise<void> {
    if (this.isLoading) return;

    // Validate all fields
    const email = this.emailInput?.value || '';
    const password = this.passwordInput?.value || '';

    const validation = validateLoginForm(email, password);

    // Trigger validation display for all fields
    this.validateField('email');
    this.validateField('password');

    if (!validation.isValid) {
      this.showError('Please fix the errors above before submitting.');
      return;
    }

    // Set loading state
    this.setLoading(true);
    this.hideError();

    try {
      // Call login API
      const response = await login({ email, password });

      if (response.success) {
        // Reset login attempts on success
        this.loginAttempts = 0;

        // Success callback
        this.options.onSuccess?.(response);
      } else {
        // Increment login attempts
        this.loginAttempts++;

        // Show error from server with rate limiting info
        let errorMessage = response.message || response.error || 'Login failed. Please try again.';

        // Add rate limiting feedback if applicable
        if (this.loginAttempts >= 3 && this.loginAttempts < 5) {
          errorMessage += ` (${5 - this.loginAttempts} attempts remaining)`;
        } else if (this.loginAttempts >= 5) {
          errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
        }

        this.showError(errorMessage);
      }
    } catch (error) {
      console.error('Login error:', error);
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
        this.submitButton.textContent = 'Logging In...';
      } else {
        this.submitButton.disabled = false;
        this.submitButton.style.opacity = '1';
        this.submitButton.style.cursor = 'pointer';
        this.submitButton.textContent = 'Log In';
      }
    }

    // Disable all inputs during loading
    const inputs = [this.emailInput, this.passwordInput];
    inputs.forEach(input => {
      if (input) {
        input.disabled = loading;
      }
    });
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
   * Clear form
   */
  public clear(): void {
    if (this.emailInput) this.emailInput.value = '';
    if (this.passwordInput) this.passwordInput.value = '';
    this.hideError();
    this.loginAttempts = 0;
  }
}
