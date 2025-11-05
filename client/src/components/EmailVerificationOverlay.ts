/**
 * Email Verification Overlay Component
 * MVP 16: Post-signup email verification prompt
 *
 * Features:
 * - Display: "✉️ Check Your Email!" with user's email
 * - Message: "Click the link to verify your account and unlock 6 characters!"
 * - [Resend Email] button with rate limiting (3 per hour) and countdown timer
 * - [Play as Guest] button to continue without verification
 * - API: POST `/auth/resend-verification`
 */

import { resendVerification } from '../services/AuthService';

export interface EmailVerificationOverlayOptions {
  email: string;
  onPlayAsGuest?: () => void;
  onClose?: () => void;
}

export class EmailVerificationOverlay {
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private options: EmailVerificationOverlayOptions;
  private resendCount: number = 0;
  private lastResendTime: number = 0;
  private countdownTimer: number | null = null;
  private resendButton: HTMLButtonElement | null = null;

  constructor(options: EmailVerificationOverlayOptions) {
    this.options = options;
    this.loadRateLimitState();
    this.createOverlay();
  }

  /**
   * Load rate limit state from localStorage
   */
  private loadRateLimitState(): void {
    try {
      const state = localStorage.getItem('email_verification_rate_limit');
      if (state) {
        const parsed = JSON.parse(state);
        this.resendCount = parsed.count || 0;
        this.lastResendTime = parsed.lastResend || 0;

        // Reset if more than 1 hour has passed
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - this.lastResendTime > oneHour) {
          this.resendCount = 0;
          this.lastResendTime = 0;
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
      localStorage.setItem('email_verification_rate_limit', JSON.stringify({
        count: this.resendCount,
        lastResend: this.lastResendTime
      }));
    } catch (error) {
      console.error('Error saving rate limit state:', error);
    }
  }

  /**
   * Create the overlay DOM structure
   */
  private createOverlay(): void {
    // Get or create overlay root
    let root = document.getElementById('overlay-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'overlay-root';
      document.body.appendChild(root);
    }
    this.container = root;

    // Create backdrop
    this.overlay = document.createElement('div');
    this.overlay.className = 'email-verification-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    `;

    // Create content box
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    `;

    // Email icon
    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 72px;
      margin-bottom: 20px;
    `;
    icon.textContent = '✉️';

    // Title
    const title = document.createElement('h2');
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 28px;
      color: #333;
      font-weight: 700;
    `;
    title.textContent = 'Check Your Email!';

    // Email display
    const emailDisplay = document.createElement('p');
    emailDisplay.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 16px;
      color: #667eea;
      font-weight: 600;
    `;
    emailDisplay.textContent = this.options.email;

    // Message
    const message = document.createElement('p');
    message.style.cssText = `
      margin: 0 0 30px 0;
      font-size: 16px;
      color: #666;
      line-height: 1.6;
    `;
    message.textContent = 'Click the link in your email to verify your account and unlock 6 free characters!';

    // Status message (for success/error)
    const statusMessage = document.createElement('div');
    statusMessage.className = 'status-message';
    statusMessage.style.cssText = `
      display: none;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    `;

    // Resend button
    this.resendButton = document.createElement('button');
    this.resendButton.className = 'resend-button';
    this.resendButton.style.cssText = `
      width: 100%;
      height: 50px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
      margin-bottom: 12px;
    `;
    this.updateResendButtonState();

    // Play as Guest button
    const guestButton = document.createElement('button');
    guestButton.style.cssText = `
      width: 100%;
      height: 50px;
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, background 0.2s;
    `;
    guestButton.textContent = 'Play as Guest';

    // Assemble content
    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(emailDisplay);
    content.appendChild(message);
    content.appendChild(statusMessage);
    content.appendChild(this.resendButton);
    content.appendChild(guestButton);

    this.overlay.appendChild(content);
    this.container.appendChild(this.overlay);

    // Setup event listeners
    this.resendButton.addEventListener('click', () => this.handleResend());
    guestButton.addEventListener('click', () => this.handlePlayAsGuest());

    // Button hover effects
    this.resendButton.addEventListener('mouseenter', () => {
      if (this.resendButton && !this.resendButton.disabled) {
        this.resendButton.style.transform = 'scale(1.02)';
      }
    });
    this.resendButton.addEventListener('mouseleave', () => {
      if (this.resendButton) {
        this.resendButton.style.transform = 'scale(1)';
      }
    });

    guestButton.addEventListener('mouseenter', () => {
      guestButton.style.background = '#f0f0f0';
    });
    guestButton.addEventListener('mouseleave', () => {
      guestButton.style.background = 'white';
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  /**
   * Update resend button state based on rate limiting
   */
  private updateResendButtonState(): void {
    if (!this.resendButton) return;

    // Check if rate limited (3 per hour)
    if (this.resendCount >= 3) {
      const oneHour = 60 * 60 * 1000;
      const timeRemaining = oneHour - (Date.now() - this.lastResendTime);

      if (timeRemaining > 0) {
        this.resendButton.disabled = true;
        this.resendButton.style.opacity = '0.5';
        this.resendButton.style.cursor = 'not-allowed';
        const minutesRemaining = Math.ceil(timeRemaining / 60000);
        this.resendButton.textContent = `Try again in ${minutesRemaining} min`;
        return;
      } else {
        // Reset if hour has passed
        this.resendCount = 0;
        this.lastResendTime = 0;
        this.saveRateLimitState();
      }
    }

    // Check if in 60-second cooldown
    const cooldownRemaining = 60000 - (Date.now() - this.lastResendTime);
    if (cooldownRemaining > 0 && this.lastResendTime > 0) {
      this.startCountdown(Math.ceil(cooldownRemaining / 1000));
      return;
    }

    // Button is available
    this.resendButton.disabled = false;
    this.resendButton.style.opacity = '1';
    this.resendButton.style.cursor = 'pointer';
    this.resendButton.textContent = 'Resend Email';
  }

  /**
   * Start countdown timer for resend button
   */
  private startCountdown(seconds: number): void {
    if (!this.resendButton) return;

    this.resendButton.disabled = true;
    this.resendButton.style.opacity = '0.5';
    this.resendButton.style.cursor = 'not-allowed';

    const updateCountdown = (remaining: number) => {
      if (!this.resendButton) return;

      if (remaining <= 0) {
        this.updateResendButtonState();
        return;
      }

      this.resendButton.textContent = `Resend Email (${remaining}s)`;

      this.countdownTimer = window.setTimeout(() => {
        updateCountdown(remaining - 1);
      }, 1000);
    };

    updateCountdown(seconds);
  }

  /**
   * Handle resend email click
   */
  private async handleResend(): Promise<void> {
    if (!this.resendButton) return;
    if (this.resendButton.disabled) return;

    // Set loading state
    this.resendButton.disabled = true;
    this.resendButton.style.opacity = '0.7';
    const originalText = this.resendButton.textContent;
    this.resendButton.textContent = 'Sending...';

    try {
      // Call resend API
      const response = await resendVerification({ email: this.options.email });

      if (response.success) {
        // Update rate limit
        this.resendCount++;
        this.lastResendTime = Date.now();
        this.saveRateLimitState();

        // Show success message
        this.showStatusMessage('Email sent! Check your inbox.', 'success');

        // Start 60-second countdown
        this.startCountdown(60);
      } else {
        // Show error message
        this.showStatusMessage(response.message || 'Failed to send email. Please try again.', 'error');
        this.resendButton.disabled = false;
        this.resendButton.style.opacity = '1';
        this.resendButton.textContent = originalText || 'Resend Email';
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      this.showStatusMessage('Network error. Please check your connection.', 'error');
      this.resendButton.disabled = false;
      this.resendButton.style.opacity = '1';
      this.resendButton.textContent = originalText || 'Resend Email';
    }
  }

  /**
   * Show status message (success or error)
   */
  private showStatusMessage(message: string, type: 'success' | 'error'): void {
    const statusElement = this.overlay?.querySelector('.status-message') as HTMLElement;
    if (!statusElement) return;

    if (type === 'success') {
      statusElement.style.background = '#d4edda';
      statusElement.style.border = '1px solid #c3e6cb';
      statusElement.style.color = '#155724';
    } else {
      statusElement.style.background = '#fee';
      statusElement.style.border = '1px solid #fcc';
      statusElement.style.color = '#c33';
    }

    statusElement.textContent = message;
    statusElement.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 5000);
  }

  /**
   * Handle "Play as Guest" click
   */
  private handlePlayAsGuest(): void {
    this.close();
    this.options.onPlayAsGuest?.();
  }

  /**
   * Close and remove the overlay
   */
  public close(): void {
    // Clear countdown timer
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }

    // Remove overlay
    this.overlay?.remove();

    // Restore body scroll
    document.body.style.overflow = '';

    // Call close callback
    this.options.onClose?.();
  }

  /**
   * Show the overlay (in case it was hidden)
   */
  public show(): void {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
    document.body.style.overflow = 'hidden';
  }
}
