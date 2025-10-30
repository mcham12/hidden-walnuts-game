/**
 * MVP 12: Rank Announcement Overlay
 *
 * Full-screen overlay (NOT toast) for rank announcements:
 * - First join: "You are a Rookie"
 * - Rank up: "You've achieved Maestro Status!"
 *
 * Design: Similar to game achievement overlays (Dark Souls, Zelda)
 * - Fade in from black
 * - Large centered text
 * - Brief display (3-4 seconds)
 * - Fade out
 */

export class RankOverlay {
  private container: HTMLDivElement;
  private titleElement: HTMLDivElement;
  private descriptionElement: HTMLDivElement;
  private isShowing: boolean = false;

  constructor() {
    // Create overlay container
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    this.container.style.display = 'none';
    this.container.style.flexDirection = 'column';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';
    this.container.style.zIndex = '10000';
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.5s ease-in-out';
    this.container.style.pointerEvents = 'none';
    this.container.style.padding = '20px'; // Safe area for notches/home indicators
    this.container.style.boxSizing = 'border-box';

    // Create title element (main message)
    // Responsive sizing: clamp(min, preferred, max)
    this.titleElement = document.createElement('div');
    this.titleElement.style.fontSize = 'clamp(28px, 8vw, 48px)'; // Mobile: 28-48px, scales with viewport
    this.titleElement.style.fontWeight = 'bold';
    this.titleElement.style.color = '#FFD700';
    this.titleElement.style.textAlign = 'center';
    this.titleElement.style.marginBottom = 'clamp(10px, 3vh, 20px)';
    this.titleElement.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.5)';
    this.titleElement.style.fontFamily = 'Arial, sans-serif';
    this.titleElement.style.letterSpacing = 'clamp(1px, 0.5vw, 2px)';
    this.titleElement.style.animation = 'pulse 2s infinite';
    this.titleElement.style.wordWrap = 'break-word';
    this.titleElement.style.width = '90%'; // Use width instead of maxWidth for consistent centering
    this.titleElement.style.margin = '0 auto'; // Center horizontally, preserve vertical spacing

    // Create description element (subtitle)
    this.descriptionElement = document.createElement('div');
    this.descriptionElement.style.fontSize = 'clamp(16px, 4vw, 24px)'; // Mobile: 16-24px
    this.descriptionElement.style.color = '#FFFFFF';
    this.descriptionElement.style.textAlign = 'center';
    this.descriptionElement.style.opacity = '0.9';
    this.descriptionElement.style.fontFamily = 'Arial, sans-serif';
    this.descriptionElement.style.wordWrap = 'break-word';
    this.descriptionElement.style.width = '85%'; // Use width instead of maxWidth for consistent centering
    this.descriptionElement.style.margin = '0 auto'; // Center horizontally, preserve vertical spacing

    // Add pulse animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
      }
    `;
    document.head.appendChild(style);

    // Assemble
    this.container.appendChild(this.titleElement);
    this.container.appendChild(this.descriptionElement);
    document.body.appendChild(this.container);
  }

  /**
   * Show welcome message on first join
   * "You are a Rookie"
   */
  showWelcome(titleName: string): void {
    if (this.isShowing) return;

    this.titleElement.textContent = `You are a ${titleName}`;
    this.descriptionElement.textContent = ''; // No secondary text needed
    this.descriptionElement.style.display = 'none'; // Hide empty description

    this.show(3000); // 3 seconds display
  }

  /**
   * Show rank-up message
   * "You've achieved Maestro Status!"
   */
  showRankUp(titleName: string, description: string): void {
    if (this.isShowing) return;

    this.titleElement.textContent = `You've achieved ${titleName} Status!`;
    this.descriptionElement.textContent = description;
    this.descriptionElement.style.display = 'block'; // Show description for rank-up

    this.show(3500); // 3.5 seconds display
  }

  /**
   * Show overlay with fade in/out animation
   */
  private show(duration: number): void {
    this.isShowing = true;

    // Fade in
    this.container.style.display = 'flex';
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });

    // Fade out after duration
    setTimeout(() => {
      this.container.style.opacity = '0';

      // Hide after fade out completes
      setTimeout(() => {
        this.container.style.display = 'none';
        this.isShowing = false;
      }, 500);
    }, duration);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
