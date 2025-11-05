/**
 * Session Expired Banner Component
 * MVP 16: Shows when authentication session expires mid-game
 *
 * Non-intrusive banner that informs user their session expired
 * without blocking gameplay. User can dismiss or click to log in.
 */

export interface SessionExpiredBannerOptions {
  onLoginClick?: () => void;
  onDismiss?: () => void;
}

export class SessionExpiredBanner {
  private banner: HTMLElement | null = null;
  private options: SessionExpiredBannerOptions;
  private isShowing: boolean = false;

  constructor(options: SessionExpiredBannerOptions = {}) {
    this.options = options;
  }

  /**
   * Show the session expired banner
   */
  show(): void {
    if (this.isShowing) return; // Already showing

    this.createBanner();
    this.isShowing = true;

    // Fade in
    setTimeout(() => {
      if (this.banner) {
        this.banner.style.opacity = '1';
      }
    }, 50);

    console.log('⚠️ SessionExpiredBanner: Shown');
  }

  /**
   * Hide and remove the banner
   */
  hide(): void {
    if (!this.banner) return;

    // Fade out
    this.banner.style.opacity = '0';

    setTimeout(() => {
      if (this.banner && this.banner.parentElement) {
        this.banner.parentElement.removeChild(this.banner);
      }
      this.banner = null;
      this.isShowing = false;
    }, 300);

    console.log('✅ SessionExpiredBanner: Hidden');
  }

  /**
   * Create the banner DOM structure
   */
  private createBanner(): void {
    this.banner = document.createElement('div');
    this.banner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 5000;
      background: linear-gradient(135deg, #FF6B6B 0%, #C92A2A 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: Arial, sans-serif;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 90vw;
      flex-wrap: wrap;
      justify-content: center;
    `;

    // Warning icon
    const icon = document.createElement('span');
    icon.textContent = '⚠️';
    icon.style.cssText = 'font-size: 24px;';

    // Message
    const message = document.createElement('div');
    message.style.cssText = `
      font-size: 15px;
      font-weight: 600;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    `;
    message.textContent = 'Session Expired';

    // Subtext
    const subtext = document.createElement('div');
    subtext.style.cssText = `
      font-size: 13px;
      opacity: 0.9;
    `;
    subtext.textContent = 'Log in again to save progress';

    // Log In button
    const loginButton = document.createElement('button');
    loginButton.textContent = 'Log In';
    loginButton.style.cssText = `
      background: white;
      color: #C92A2A;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
    loginButton.addEventListener('mouseenter', () => {
      loginButton.style.transform = 'scale(1.05)';
      loginButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });
    loginButton.addEventListener('mouseleave', () => {
      loginButton.style.transform = 'scale(1)';
      loginButton.style.boxShadow = 'none';
    });
    loginButton.addEventListener('click', () => {
      this.hide();
      this.options.onLoginClick?.();
    });

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '✕';
    closeButton.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    `;
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
    });
    closeButton.addEventListener('click', () => {
      this.hide();
      this.options.onDismiss?.();
    });

    // Message container
    const messageContainer = document.createElement('div');
    messageContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    messageContainer.appendChild(message);
    messageContainer.appendChild(subtext);

    // Assemble banner
    this.banner.appendChild(icon);
    this.banner.appendChild(messageContainer);
    this.banner.appendChild(loginButton);
    this.banner.appendChild(closeButton);

    // Add to body
    document.body.appendChild(this.banner);
  }

  /**
   * Check if banner is currently showing
   */
  isVisible(): boolean {
    return this.isShowing;
  }
}
