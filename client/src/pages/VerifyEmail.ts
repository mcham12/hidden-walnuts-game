/**
 * Email Verification Page
 * MVP 16: Email verification landing page handler
 *
 * Features:
 * - Route: `/verify-email?token=abc123`
 * - Extract token from URL params
 * - Call API: POST `/auth/verify-email`
 * - Success: Show WelcomeOverlay, redirect after 5 seconds
 * - Error: "Verification link expired" + [Request New Link] button
 */

import { verifyEmail } from '../services/AuthService';
import { WelcomeOverlay } from '../components/WelcomeOverlay';
import { getCurrentUser } from '../services/AuthService';

export class VerifyEmailPage {
  private container: HTMLElement;
  private token: string;

  constructor(container: HTMLElement, token: string) {
    this.container = container;
    this.token = token;
    this.init();
  }

  /**
   * Initialize the verification process
   */
  private async init(): Promise<void> {
    // Show loading state
    this.showLoading();

    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Call verify email API
      const response = await verifyEmail({ token: this.token });

      if (response.success) {
        // Show success message
        this.showSuccess();

        // Get current user
        const user = getCurrentUser();

        // Show welcome overlay if user data is available
        if (user && WelcomeOverlay.shouldShow()) {
          setTimeout(() => {
            new WelcomeOverlay({
              username: user.username,
              onStartPlaying: () => {
                this.redirectToGame();
              }
            });
          }, 1000);
        } else {
          // Redirect after 5 seconds if no welcome overlay
          setTimeout(() => {
            this.redirectToGame();
          }, 5000);
        }
      } else {
        // Show error message
        this.showError(response.message || 'Verification failed');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      this.showError('Network error. Please check your connection and try again.');
    }
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    this.container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <div style="
          background: white;
          border-radius: 20px;
          padding: 50px;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 60px; margin-bottom: 20px;">⏳</div>
          <h2 style="margin: 0 0 12px 0; font-size: 24px; color: #333;">Verifying Your Email...</h2>
          <p style="margin: 0; color: #666; font-size: 16px;">Please wait while we confirm your email address.</p>
        </div>
      </div>
    `;
  }

  /**
   * Show success message
   */
  private showSuccess(): void {
    this.container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <div style="
          background: white;
          border-radius: 20px;
          padding: 50px;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 72px; margin-bottom: 20px; animation: checkmark 0.5s ease;">✅</div>
          <h2 style="margin: 0 0 12px 0; font-size: 28px; color: #27AE60; font-weight: 700;">Email Verified!</h2>
          <p style="margin: 0 0 20px 0; color: #666; font-size: 16px; line-height: 1.6;">
            Your account has been successfully verified. You now have access to all authenticated features!
          </p>
          <p style="margin: 0; color: #999; font-size: 14px;">
            Redirecting you to the game...
          </p>
        </div>
      </div>
    `;

    // Add animation
    if (!document.getElementById('verify-email-styles')) {
      const style = document.createElement('style');
      style.id = 'verify-email-styles';
      style.textContent = `
        @keyframes checkmark {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.container.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      ">
        <div style="
          background: white;
          border-radius: 20px;
          padding: 50px;
          max-width: 500px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
          <div style="font-size: 60px; margin-bottom: 20px;">❌</div>
          <h2 style="margin: 0 0 12px 0; font-size: 24px; color: #E74C3C; font-weight: 700;">Verification Failed</h2>
          <p style="margin: 0 0 30px 0; color: #666; font-size: 16px; line-height: 1.6;">
            ${message}
          </p>

          <button
            id="request-new-link"
            style="
              width: 100%;
              height: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: transform 0.2s;
              margin-bottom: 12px;
            "
          >
            Request New Link
          </button>

          <button
            id="go-to-game"
            style="
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
            "
          >
            Continue to Game
          </button>
        </div>
      </div>
    `;

    // Setup event listeners
    const requestButton = document.getElementById('request-new-link');
    const gameButton = document.getElementById('go-to-game');

    requestButton?.addEventListener('click', () => this.handleRequestNewLink());
    gameButton?.addEventListener('click', () => this.redirectToGame());

    // Button hover effects
    requestButton?.addEventListener('mouseenter', () => {
      (requestButton as HTMLElement).style.transform = 'scale(1.02)';
    });
    requestButton?.addEventListener('mouseleave', () => {
      (requestButton as HTMLElement).style.transform = 'scale(1)';
    });

    gameButton?.addEventListener('mouseenter', () => {
      (gameButton as HTMLElement).style.background = '#f0f0f0';
    });
    gameButton?.addEventListener('mouseleave', () => {
      (gameButton as HTMLElement).style.background = 'white';
    });
  }

  /**
   * Handle request new link click
   */
  private handleRequestNewLink(): void {
    // Redirect to home page and open forgot password modal
    window.location.href = '/?action=resend-verification';
  }

  /**
   * Redirect to game
   */
  private redirectToGame(): void {
    // Remove token from URL and go to home
    window.location.href = '/';
  }

  /**
   * Static method to handle verification from URL
   * Returns true if verification route was handled
   */
  public static handleVerificationRoute(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    // Check if this is a verification route
    // Support both /verify-email and /verify (short URL)
    if (token && (window.location.pathname === '/verify-email' || window.location.pathname === '/verify' || urlParams.has('verify'))) {
      // Create container for verification page
      const container = document.createElement('div');
      container.id = 'verify-email-page';
      document.body.appendChild(container);

      // Initialize verification page
      new VerifyEmailPage(container, token);

      return true;
    }
    return false;
  }
}
