/**
 * Signup Form Component
 * MVP 16: User registration form with real-time validation
 *
 * Features:
 * - Username, email, password, confirm password fields
 * - Real-time validation with visual indicators (✅/❌)
 * - Password strength meter (weak/medium/strong)
 * - Password show/hide toggle
 * - Benefits display above form
 * - API integration with error handling
 * - Loading states during submission
 */

import { validateSignupForm, getPasswordStrengthColor, getPasswordStrengthLabel } from '../utils/validation';
import { signup, type SignupResponse } from '../services/AuthService';

export interface SignupFormOptions {
  onSuccess?: (response: SignupResponse) => void;
  onSwitchToLogin?: () => void;
}

export class SignupForm {
  private container: HTMLElement;
  private options: SignupFormOptions;
  private isLoading: boolean = false;

  // Form fields
  private usernameInput: HTMLInputElement | null = null;
  private emailInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private confirmPasswordInput: HTMLInputElement | null = null;
  private submitButton: HTMLButtonElement | null = null;

  // Validation indicators
  private usernameIndicator: HTMLElement | null = null;
  private emailIndicator: HTMLElement | null = null;
  private passwordIndicator: HTMLElement | null = null;
  private confirmPasswordIndicator: HTMLElement | null = null;

  // Password strength meter
  private strengthMeter: HTMLElement | null = null;
  private strengthLabel: HTMLElement | null = null;

  // Error message display
  private errorMessage: HTMLElement | null = null;

  constructor(container: HTMLElement, options: SignupFormOptions = {}) {
    this.container = container;
    this.options = options;
    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the signup form
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="signup-form">
        <!-- Benefits Section -->
        <div class="signup-benefits" style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        ">
          <h4 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">Create a Free Account</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li>Unlock 6 free characters</li>
            <li>Sync progress across devices</li>
            <li>Join the Hall of Fame</li>
            <li>Get verified badge on leaderboard</li>
          </ul>
        </div>

        <!-- Error Message -->
        <div class="error-message" style="display: none; background: #fee; border: 1px solid #fcc; color: #c33; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

        <!-- Username Field -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            Username
          </label>
          <div style="position: relative;">
            <input
              type="text"
              name="username"
              placeholder="Choose a username"
              autocomplete="username"
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

        <!-- Email Field -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
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
          <div class="field-error" style="color: #c33; font-size: 13px; margin-top: 4px; display: none;"></div>
        </div>

        <!-- Password Field -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            Password
          </label>
          <div style="position: relative;">
            <input
              type="password"
              name="password"
              placeholder="Create a strong password"
              autocomplete="new-password"
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
          <div class="field-error" style="color: #c33; font-size: 13px; margin-top: 4px; display: none;"></div>

          <!-- Password Strength Meter -->
          <div class="password-strength" style="margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 12px; color: #666;">Password strength:</span>
              <span class="strength-label" style="font-size: 12px; font-weight: 600;"></span>
            </div>
            <div style="height: 4px; background: #e0e0e0; border-radius: 2px; overflow: hidden;">
              <div class="strength-meter" style="height: 100%; width: 0%; transition: width 0.3s, background-color 0.3s;"></div>
            </div>
          </div>
        </div>

        <!-- Confirm Password Field -->
        <div class="form-group" style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            Confirm Password
          </label>
          <div style="position: relative;">
            <input
              type="password"
              name="confirmPassword"
              placeholder="Re-enter your password"
              autocomplete="new-password"
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
          Sign Up
        </button>

        <!-- Switch to Login -->
        <div style="text-align: center; font-size: 14px; color: #666;">
          Already have an account?
          <a href="#" class="switch-to-login" style="color: #667eea; font-weight: 600; text-decoration: none;">Log In</a>
        </div>
      </div>
    `;

    // Store references to form elements
    this.usernameInput = this.container.querySelector('input[name="username"]');
    this.emailInput = this.container.querySelector('input[name="email"]');
    this.passwordInput = this.container.querySelector('input[name="password"]');
    this.confirmPasswordInput = this.container.querySelector('input[name="confirmPassword"]');
    this.submitButton = this.container.querySelector('.submit-button');
    this.errorMessage = this.container.querySelector('.error-message');
    this.strengthMeter = this.container.querySelector('.strength-meter');
    this.strengthLabel = this.container.querySelector('.strength-label');

    // Get validation indicators
    const indicators = this.container.querySelectorAll('.validation-indicator');
    this.usernameIndicator = indicators[0] as HTMLElement;
    this.emailIndicator = indicators[1] as HTMLElement;
    this.passwordIndicator = indicators[2] as HTMLElement;
    this.confirmPasswordIndicator = indicators[3] as HTMLElement;
  }

  /**
   * Setup event listeners for form interactions
   */
  private setupEventListeners(): void {
    // Real-time validation on input
    this.usernameInput?.addEventListener('input', () => this.validateField('username'));
    this.emailInput?.addEventListener('input', () => this.validateField('email'));
    this.passwordInput?.addEventListener('input', () => {
      this.validateField('password');
      this.updatePasswordStrength();
    });
    this.confirmPasswordInput?.addEventListener('input', () => this.validateField('confirmPassword'));

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

    // Switch to login
    const switchLink = this.container.querySelector('.switch-to-login');
    switchLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onSwitchToLogin?.();
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
  private validateField(field: 'username' | 'email' | 'password' | 'confirmPassword'): void {
    const username = this.usernameInput?.value || '';
    const email = this.emailInput?.value || '';
    const password = this.passwordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    const validation = validateSignupForm(username, email, password, confirmPassword);

    let result;
    let indicator;
    let input;
    let errorElement;

    switch (field) {
      case 'username':
        result = validation.username;
        indicator = this.usernameIndicator;
        input = this.usernameInput;
        errorElement = this.usernameInput?.parentElement?.parentElement?.querySelector('.field-error');
        break;
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
      case 'confirmPassword':
        result = validation.confirmPassword;
        indicator = this.confirmPasswordIndicator;
        input = this.confirmPasswordInput;
        errorElement = this.confirmPasswordInput?.parentElement?.parentElement?.querySelector('.field-error');
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
   * Update password strength meter
   */
  private updatePasswordStrength(): void {
    const password = this.passwordInput?.value || '';

    if (password.length === 0) {
      this.strengthMeter!.style.width = '0%';
      this.strengthLabel!.textContent = '';
      return;
    }

    const validation = validateSignupForm('', '', password, '');
    const passwordResult = validation.password;

    const color = getPasswordStrengthColor(passwordResult.strength);
    const label = getPasswordStrengthLabel(passwordResult.strength);
    const percentage = passwordResult.score;

    this.strengthMeter!.style.width = `${percentage}%`;
    this.strengthMeter!.style.backgroundColor = color;
    this.strengthLabel!.textContent = label;
    this.strengthLabel!.style.color = color;
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
    const username = this.usernameInput?.value || '';
    const email = this.emailInput?.value || '';
    const password = this.passwordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    const validation = validateSignupForm(username, email, password, confirmPassword);

    // Trigger validation display for all fields
    this.validateField('username');
    this.validateField('email');
    this.validateField('password');
    this.validateField('confirmPassword');

    if (!validation.isValid) {
      this.showError('Please fix the errors above before submitting.');
      return;
    }

    // Set loading state
    this.setLoading(true);
    this.hideError();

    try {
      // Call signup API
      const response = await signup({ username, email, password });

      if (response.success) {
        // Success callback
        this.options.onSuccess?.(response);
      } else {
        // Show error from server
        this.showError(response.message || response.error || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error('Signup error:', error);
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
        this.submitButton.textContent = 'Creating Account...';
      } else {
        this.submitButton.disabled = false;
        this.submitButton.style.opacity = '1';
        this.submitButton.style.cursor = 'pointer';
        this.submitButton.textContent = 'Sign Up';
      }
    }

    // Disable all inputs during loading
    const inputs = [this.usernameInput, this.emailInput, this.passwordInput, this.confirmPasswordInput];
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
    if (this.usernameInput) this.usernameInput.value = '';
    if (this.emailInput) this.emailInput.value = '';
    if (this.passwordInput) this.passwordInput.value = '';
    if (this.confirmPasswordInput) this.confirmPasswordInput.value = '';
    this.hideError();
    this.strengthMeter!.style.width = '0%';
    this.strengthLabel!.textContent = '';
  }
}
