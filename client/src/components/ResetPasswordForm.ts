/**
 * Reset Password Form Component
 * MVP 16: Password reset form with token validation
 *
 * Features:
 * - Triggered from route: /reset-password?token=abc123
 * - New password and confirm password fields
 * - Password strength meter and requirements
 * - Password show/hide toggle
 * - API integration for password reset
 * - Success: "Password Updated!" → Redirect to login after 2 seconds
 * - Error: "Reset link expired or invalid. [Request New Link]"
 */

import { validatePassword, passwordsMatch, getPasswordStrengthColor, getPasswordStrengthLabel } from '../utils/validation';
import { resetPassword } from '../services/AuthService';

export interface ResetPasswordFormOptions {
  token: string;
  onSuccess?: () => void;
  onRequestNewLink?: () => void;
}

export class ResetPasswordForm {
  private container: HTMLElement;
  private options: ResetPasswordFormOptions;
  private isLoading: boolean = false;

  // Form fields
  private passwordInput: HTMLInputElement | null = null;
  private confirmPasswordInput: HTMLInputElement | null = null;
  private submitButton: HTMLButtonElement | null = null;

  // Validation indicators
  private passwordIndicator: HTMLElement | null = null;
  private confirmPasswordIndicator: HTMLElement | null = null;

  // Password strength meter
  private strengthMeter: HTMLElement | null = null;
  private strengthLabel: HTMLElement | null = null;

  // Message displays
  private errorMessage: HTMLElement | null = null;
  private successMessage: HTMLElement | null = null;

  constructor(container: HTMLElement, options: ResetPasswordFormOptions) {
    this.container = container;
    this.options = options;
    this.render();
    this.setupEventListeners();
  }

  /**
   * Render the reset password form
   */
  private render(): void {
    this.container.innerHTML = `
      <div class="reset-password-form">
        <!-- Instructions -->
        <div style="text-align: center; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; font-size: 24px; color: #333;">Create New Password</h3>
          <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.6;">
            Please enter a new password for your account.
          </p>
        </div>

        <!-- Success Message -->
        <div class="success-message" style="display: none; background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 16px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
          <h4 style="margin: 0 0 8px 0; font-size: 18px;">Password Updated!</h4>
          <p style="margin: 0; font-size: 14px;">
            Redirecting you to login...
          </p>
        </div>

        <!-- Error Message -->
        <div class="error-message" style="display: none; background: #fee; border: 1px solid #fcc; color: #c33; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px;"></div>

        <!-- Password Field -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            New Password
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

          <!-- Password Requirements -->
          <div style="margin-top: 8px; font-size: 12px; color: #666; line-height: 1.6;">
            Password must contain:
            <ul style="margin: 4px 0 0 20px; padding: 0;">
              <li>At least 8 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
            </ul>
          </div>
        </div>

        <!-- Confirm Password Field -->
        <div class="form-group" style="margin-bottom: 24px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #333; font-size: 14px;">
            Confirm New Password
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
          Reset Password
        </button>

        <!-- Request New Link -->
        <div class="request-new-link" style="display: none; text-align: center; font-size: 14px; color: #666;">
          Reset link expired?
          <a href="#" class="request-link" style="color: #667eea; font-weight: 600; text-decoration: none;">Request New Link</a>
        </div>
      </div>
    `;

    // Store references to form elements
    this.passwordInput = this.container.querySelector('input[name="password"]');
    this.confirmPasswordInput = this.container.querySelector('input[name="confirmPassword"]');
    this.submitButton = this.container.querySelector('.submit-button');
    this.errorMessage = this.container.querySelector('.error-message');
    this.successMessage = this.container.querySelector('.success-message');
    this.strengthMeter = this.container.querySelector('.strength-meter');
    this.strengthLabel = this.container.querySelector('.strength-label');

    // Get validation indicators
    const indicators = this.container.querySelectorAll('.validation-indicator');
    this.passwordIndicator = indicators[0] as HTMLElement;
    this.confirmPasswordIndicator = indicators[1] as HTMLElement;
  }

  /**
   * Setup event listeners for form interactions
   */
  private setupEventListeners(): void {
    // Real-time validation on input
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

    // Request new link
    const requestLink = this.container.querySelector('.request-link');
    requestLink?.addEventListener('click', (e) => {
      e.preventDefault();
      this.options.onRequestNewLink?.();
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
  private validateField(field: 'password' | 'confirmPassword'): void {
    const password = this.passwordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    let result;
    let indicator;
    let input;
    let errorElement;

    if (field === 'password') {
      result = validatePassword(password);
      indicator = this.passwordIndicator;
      input = this.passwordInput;
      errorElement = this.passwordInput?.parentElement?.parentElement?.querySelector('.field-error');
    } else {
      result = passwordsMatch(password, confirmPassword);
      indicator = this.confirmPasswordIndicator;
      input = this.confirmPasswordInput;
      errorElement = this.confirmPasswordInput?.parentElement?.parentElement?.querySelector('.field-error');
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
        (errorElement as HTMLElement).textContent = result.error || (result as any).errors?.[0];
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

    const result = validatePassword(password);
    const color = getPasswordStrengthColor(result.strength);
    const label = getPasswordStrengthLabel(result.strength);
    const percentage = result.score;

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
    const password = this.passwordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    const passwordValidation = validatePassword(password);
    const confirmValidation = passwordsMatch(password, confirmPassword);

    // Trigger validation display for all fields
    this.validateField('password');
    this.validateField('confirmPassword');

    if (!passwordValidation.isValid || !confirmValidation.isValid) {
      this.showError('Please fix the errors above before submitting.');
      return;
    }

    // Set loading state
    this.setLoading(true);
    this.hideError();

    try {
      // Call reset password API
      const response = await resetPassword({
        token: this.options.token,
        newPassword: password
      });

      if (response.success) {
        // Show success message
        this.showSuccess();

        // Redirect to login after 2 seconds
        setTimeout(() => {
          this.options.onSuccess?.();
        }, 2000);
      } else {
        // Show error from server
        this.showError(response.message || response.error || 'Failed to reset password. Please try again.');

        // Show "Request New Link" if token expired
        if (response.error?.includes('expired') || response.error?.includes('invalid')) {
          this.showRequestNewLink();
        }
      }
    } catch (error) {
      console.error('Reset password error:', error);
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
        this.submitButton.textContent = 'Resetting Password...';
      } else {
        this.submitButton.disabled = false;
        this.submitButton.style.opacity = '1';
        this.submitButton.style.cursor = 'pointer';
        this.submitButton.textContent = 'Reset Password';
      }
    }

    // Disable all inputs during loading
    const inputs = [this.passwordInput, this.confirmPasswordInput];
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
   * Show success message
   */
  private showSuccess(): void {
    if (this.successMessage) {
      this.successMessage.style.display = 'block';
    }

    // Hide the form
    const formGroups = this.container.querySelectorAll('.form-group');
    const submitButton = this.container.querySelector('.submit-button');
    formGroups.forEach(group => (group as HTMLElement).style.display = 'none');
    if (submitButton) (submitButton as HTMLElement).style.display = 'none';
  }

  /**
   * Show request new link message
   */
  private showRequestNewLink(): void {
    const requestNewLink = this.container.querySelector('.request-new-link');
    if (requestNewLink) {
      (requestNewLink as HTMLElement).style.display = 'block';
    }
  }
}
