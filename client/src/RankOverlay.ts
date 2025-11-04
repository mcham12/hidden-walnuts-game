/**
 * MVP 12: Rank Announcement Overlay
 *
 * Full-screen overlay for rank announcements:
 * - First join: "You are a Rookie"
 * - Rank up: "You've achieved Maestro Status!"
 *
 * Design: Clean, centered overlay with reliable positioning
 * - Fade in/out transitions
 * - Dark forest green semi-transparent background
 * - Guaranteed centered text on all screen sizes
 */

export class RankOverlay {
  private overlay: HTMLDivElement;
  private contentWrapper: HTMLDivElement;
  private titleElement: HTMLDivElement;
  private descriptionElement: HTMLDivElement;
  private isShowing: boolean = false;
  private styleElement: HTMLStyleElement;

  constructor() {
    // Create style element with all CSS
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = `
      .rank-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(20, 60, 30, 0.6); /* MVP 14: More transparent for better game visibility */
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.5s ease-in-out;
        pointer-events: none;
      }

      .rank-overlay.visible {
        display: flex;
        opacity: 1;
      }

      .rank-overlay-content {
        max-width: 90%;
        text-align: center;
        padding: 20px;
      }

      .rank-overlay-title {
        font-size: 36px;
        font-weight: bold;
        color: #FFD700;
        text-align: center;
        margin: 0 0 16px 0;
        text-shadow:
          0 2px 4px rgba(0, 0, 0, 0.8),
          0 0 20px rgba(255, 215, 0, 0.9),
          0 0 40px rgba(255, 215, 0, 0.6); /* MVP 14: Enhanced contrast for lighter background */
        font-family: Arial, sans-serif;
        letter-spacing: 2px;
        line-height: 1.3;
      }

      .rank-overlay-description {
        font-size: 20px;
        color: #FFFFFF;
        text-align: center;
        margin: 0;
        opacity: 0.95;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8); /* MVP 14: Better readability on transparent background */
        font-family: Arial, sans-serif;
        line-height: 1.4;
      }

      /* Responsive font sizes for smaller screens */
      @media (max-width: 768px) {
        .rank-overlay-title {
          font-size: 28px;
          letter-spacing: 1px;
        }
        .rank-overlay-description {
          font-size: 18px;
        }
      }

      @media (max-width: 480px) {
        .rank-overlay-title {
          font-size: 24px;
        }
        .rank-overlay-description {
          font-size: 16px;
        }
      }
    `;
    document.head.appendChild(this.styleElement);

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'rank-overlay';

    // Create content wrapper (for max-width constraint)
    this.contentWrapper = document.createElement('div');
    this.contentWrapper.className = 'rank-overlay-content';

    // Create title element
    this.titleElement = document.createElement('div');
    this.titleElement.className = 'rank-overlay-title';

    // Create description element
    this.descriptionElement = document.createElement('div');
    this.descriptionElement.className = 'rank-overlay-description';

    // Assemble DOM structure
    this.contentWrapper.appendChild(this.titleElement);
    this.contentWrapper.appendChild(this.descriptionElement);
    this.overlay.appendChild(this.contentWrapper);
    document.body.appendChild(this.overlay);
  }

  /**
   * Show welcome message on first join
   * "You are a Rookie"
   */
  showWelcome(titleName: string): void {
    if (this.isShowing) return;

    this.titleElement.textContent = `You are a ${titleName}`;
    this.descriptionElement.textContent = '';
    this.descriptionElement.style.display = 'none';

    this.show(3000); // 3 seconds
  }

  /**
   * Show rank-up message
   * "You've achieved Maestro Status!"
   */
  showRankUp(titleName: string, description: string): void {
    if (this.isShowing) return;

    this.titleElement.textContent = `You've achieved ${titleName} Status!`;
    this.descriptionElement.textContent = description;
    this.descriptionElement.style.display = 'block';

    this.show(3500); // 3.5 seconds
  }

  /**
   * Show overlay with fade in/out animation
   */
  private show(duration: number): void {
    this.isShowing = true;

    // Trigger fade in (CSS transition handles animation)
    this.overlay.classList.add('visible');

    // Fade out after duration
    setTimeout(() => {
      this.overlay.classList.remove('visible');

      // Mark as not showing after fade completes
      setTimeout(() => {
        this.isShowing = false;
      }, 500); // Match CSS transition duration
    }, duration);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
    if (this.styleElement.parentElement) {
      this.styleElement.parentElement.removeChild(this.styleElement);
    }
  }
}
