/**
 * MVP 14: Tree Growing Bonus Overlay
 * Special full-screen announcement for tree growing milestones
 */

export class BonusOverlay {
  private overlay: HTMLElement | null = null;
  private isShowing: boolean = false;

  constructor() {
    this.createOverlay();
  }

  /**
   * Create the bonus overlay element
   */
  private createOverlay(): void {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'bonus-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      z-index: 9500;
      display: none;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    `;

    // Create content container
    const content = document.createElement('div');
    content.style.cssText = `
      background: linear-gradient(135deg, #2d5f2e 0%, #4a8f4d 100%);
      padding: 60px 80px;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(74, 143, 77, 0.4);
      text-align: center;
      max-width: 600px;
      border: 4px solid rgba(255, 215, 0, 0.6);
      animation: bonusBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    // Create icon
    const icon = document.createElement('div');
    icon.id = 'bonus-icon';
    icon.textContent = '🌳';
    icon.style.cssText = `
      font-size: 120px;
      margin-bottom: 20px;
      animation: bonusPulse 1.5s ease-in-out infinite;
    `;

    // Create title
    const title = document.createElement('div');
    title.id = 'bonus-title';
    title.textContent = 'FOREST MASTERY!';
    title.style.cssText = `
      font-family: 'Arial', sans-serif;
      font-size: 56px;
      font-weight: 800;
      color: #FFD700;
      margin-bottom: 20px;
      text-shadow: 0 4px 12px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 215, 0, 0.6);
      letter-spacing: 2px;
    `;

    // Create message
    const message = document.createElement('div');
    message.id = 'bonus-message';
    message.style.cssText = `
      font-family: 'Arial', sans-serif;
      font-size: 28px;
      color: #FFE4B5;
      margin-bottom: 30px;
      line-height: 1.5;
      text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    `;

    // Create points display
    const points = document.createElement('div');
    points.id = 'bonus-points';
    points.style.cssText = `
      font-family: 'Arial', sans-serif;
      font-size: 72px;
      font-weight: 900;
      color: #FFD700;
      text-shadow: 0 4px 16px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 215, 0, 0.8);
      animation: bonusGlow 2s ease-in-out infinite;
    `;

    // Assemble overlay
    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(points);
    this.overlay.appendChild(content);
    document.body.appendChild(this.overlay);

    // Add animations to style
    this.addAnimations();
  }

  /**
   * Add CSS animations
   */
  private addAnimations(): void {
    if (document.getElementById('bonus-overlay-styles')) return;

    const style = document.createElement('style');
    style.id = 'bonus-overlay-styles';
    style.textContent = `
      @keyframes bonusBounce {
        0% {
          transform: scale(0.3) translateY(-100px);
          opacity: 0;
        }
        60% {
          transform: scale(1.1);
          opacity: 1;
        }
        80% {
          transform: scale(0.95);
        }
        100% {
          transform: scale(1);
        }
      }

      @keyframes bonusPulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1);
        }
      }

      @keyframes bonusGlow {
        0%, 100% {
          filter: brightness(1) drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
        }
        50% {
          filter: brightness(1.2) drop-shadow(0 0 40px rgba(255, 215, 0, 0.9));
        }
      }

      /* Responsive styles for smaller screens */
      @media (max-width: 768px) {
        #bonus-overlay > div {
          padding: 40px 50px !important;
          max-width: 90% !important;
        }
        #bonus-icon {
          font-size: 80px !important;
          margin-bottom: 15px !important;
        }
        #bonus-title {
          font-size: 42px !important;
          margin-bottom: 15px !important;
        }
        #bonus-message {
          font-size: 20px !important;
          margin-bottom: 20px !important;
        }
        #bonus-points {
          font-size: 56px !important;
        }
      }

      @media (max-width: 430px) {
        #bonus-overlay > div {
          padding: 30px 40px !important;
        }
        #bonus-icon {
          font-size: 60px !important;
        }
        #bonus-title {
          font-size: 32px !important;
        }
        #bonus-message {
          font-size: 16px !important;
        }
        #bonus-points {
          font-size: 42px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show the bonus overlay
   */
  show(message: string, points: number, _count: number): void {
    if (!this.overlay || this.isShowing) return;

    this.isShowing = true;

    // Update content
    const messageEl = this.overlay.querySelector('#bonus-message');
    const pointsEl = this.overlay.querySelector('#bonus-points');

    if (messageEl) {
      messageEl.textContent = message;
    }

    if (pointsEl) {
      pointsEl.textContent = `+${points} POINTS!`;
    }

    // Show overlay
    this.overlay.style.display = 'flex';

    // Fade in
    requestAnimationFrame(() => {
      if (this.overlay) {
        this.overlay.style.opacity = '1';
      }
    });

    // Auto-hide after 4 seconds
    setTimeout(() => {
      this.hide();
    }, 4000);
  }

  /**
   * Hide the bonus overlay
   */
  private hide(): void {
    if (!this.overlay || !this.isShowing) return;

    // Fade out
    this.overlay.style.opacity = '0';

    // Remove from DOM after fade
    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.display = 'none';
        this.isShowing = false;
      }
    }, 500);
  }
}
