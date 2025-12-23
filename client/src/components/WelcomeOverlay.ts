/**
 * Welcome Overlay Component
 * MVP 16: Post-verification welcome message
 *
 * Features:
 * - Trigger: After email verification success
 * - Display: "🎉 Welcome to Hidden Walnuts, [Username]!"
 * - List benefits: 6 characters, sync, hall of fame, progress tracking
 * - [Start Playing →] button → character selection
 * - One-time display: Store `welcome_shown` in localStorage
 */

export interface WelcomeOverlayOptions {
  username: string;
  onStartPlaying?: () => void;
}

export class WelcomeOverlay {
  private container: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private options: WelcomeOverlayOptions;

  constructor(options: WelcomeOverlayOptions) {
    this.options = options;

    // Check if welcome has already been shown
    if (this.hasBeenShown()) {
      return;
    }

    this.createOverlay();
    this.markAsShown();
  }

  /**
   * Check if welcome overlay has been shown before
   */
  private hasBeenShown(): boolean {
    try {
      return localStorage.getItem('welcome_shown') === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark welcome overlay as shown
   */
  private markAsShown(): void {
    try {
      localStorage.setItem('welcome_shown', 'true');
    } catch (error) {
      console.error('Error marking welcome as shown:', error);
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
    this.overlay.className = 'welcome-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;

    // Create content box
    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, #1a3a1a 0%, #0d1f0d 100%);
      border: 2px solid #4a7c59;
      border-radius: 20px;
      padding: 50px;
      max-width: 600px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      transform: scale(0.9);
      transition: transform 0.5s ease;
    `;

    // Celebration icon
    const icon = document.createElement('div');
    icon.style.cssText = `
      font-size: 80px;
      margin-bottom: 20px;
      animation: bounce 1s ease infinite;
    `;
    icon.textContent = '🎉';

    // Add keyframes for bounce animation
    if (!document.getElementById('welcome-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'welcome-overlay-styles';
      style.textContent = `
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    // Title
    const title = document.createElement('h1');
    title.style.cssText = `
      margin: 0 0 12px 0;
      font-size: 32px;
      color: white;
      font-weight: 800;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    `;
    title.textContent = `Welcome to Hidden Walnuts, ${this.options.username}!`;

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.style.cssText = `
      margin: 0 0 30px 0;
      font-size: 18px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
    `;
    subtitle.textContent = 'Welcome to the forest! Here\'s what\'s waiting for you:';

    // Benefits list
    const benefits = document.createElement('div');
    benefits.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
      text-align: left;
    `;

    const benefitsList = [
      { icon: '🦊', text: 'All characters unlocked & free!' },
      { icon: '🏆', text: 'Compete on global leaderboards' },
      { icon: '🌍', text: 'Explore a massive squirrel world' },
      { icon: '🥜', text: 'Collect walnuts & survive!' }
    ];

    benefitsList.forEach(benefit => {
      const item = document.createElement('div');
      item.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        color: white;
        font-size: 16px;
      `;

      const iconSpan = document.createElement('span');
      iconSpan.style.cssText = `
        font-size: 24px;
        margin-right: 12px;
        width: 32px;
        text-align: center;
      `;
      iconSpan.textContent = benefit.icon;

      const textSpan = document.createElement('span');
      textSpan.textContent = benefit.text;

      item.appendChild(iconSpan);
      item.appendChild(textSpan);
      benefits.appendChild(item);
    });

    // Start Playing button
    const button = document.createElement('button');
    button.style.cssText = `
      width: 100%;
      height: 60px;
      background: linear-gradient(180deg, #2ecc71 0%, #27ae60 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 20px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    button.textContent = 'Start Playing →';

    // Assemble content
    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(benefits);
    content.appendChild(button);

    this.overlay.appendChild(content);
    this.container.appendChild(this.overlay);

    // Trigger animations after a brief delay
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
      content.style.transform = 'scale(1)';
    }, 50);

    // Setup event listeners
    button.addEventListener('click', () => this.handleStartPlaying());

    // Button hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Auto-close after 10 seconds if user doesn't interact
    setTimeout(() => {
      if (this.overlay && this.overlay.parentElement) {
        this.handleStartPlaying();
      }
    }, 10000);
  }

  /**
   * Handle "Start Playing" click
   */
  private handleStartPlaying(): void {
    // Fade out animation
    if (this.overlay) {
      this.overlay.style.opacity = '0';
    }

    setTimeout(() => {
      this.close();
      this.options.onStartPlaying?.();
    }, 300);
  }

  /**
   * Close and remove the overlay
   */
  public close(): void {
    // Remove overlay
    this.overlay?.remove();

    // Restore body scroll
    document.body.style.overflow = '';
  }

  /**
   * Static method to reset the welcome shown flag (for testing)
   */
  public static reset(): void {
    try {
      localStorage.removeItem('welcome_shown');
    } catch (error) {
      console.error('Error resetting welcome flag:', error);
    }
  }

  /**
   * Static method to check if welcome should be shown
   */
  public static shouldShow(): boolean {
    try {
      return localStorage.getItem('welcome_shown') !== 'true';
    } catch (error) {
      return false;
    }
  }
}
