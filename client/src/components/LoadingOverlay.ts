/**
 * LoadingOverlay - Simple loading screen with progress bar
 * Replaces complex 3D flip card approach with clean overlay
 */

export class LoadingOverlay {
  private container: HTMLElement | null = null;
  private backdrop: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private loadingText: HTMLElement | null = null;
  private isVisible: boolean = false;

  constructor() {
    this.createOverlay();
  }

  /**
   * Create the loading overlay DOM structure
   */
  private createOverlay(): void {
    // Get or create container
    let root = document.getElementById('loading-overlay-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'loading-overlay-root';
      document.body.appendChild(root);
    }
    this.container = root;

    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'loading-overlay-backdrop';
    this.backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #1a4620 0%, #2d5f2e 50%, #4a8f4d 100%);
      z-index: 10000;
      display: none;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    `;

    // Create card
    this.card = document.createElement('div');
    this.card.className = 'loading-overlay-card';
    this.card.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%);
      border-radius: 24px;
      padding: 40px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid rgba(255, 215, 0, 0.3);
      z-index: 10001;
      display: none;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
      text-align: center;
    `;

    // Create progress container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 100%;
      height: 20px;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) inset;
      border: 2px solid rgba(255, 255, 255, 0.1);
    `;

    // Create progress bar
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'loading-progress-bar';
    this.progressBar.style.cssText = `
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, #32CD32 0%, #90EE90 50%, #32CD32 100%);
      background-size: 200% 100%;
      transition: width 0.3s ease;
      border-radius: 8px;
      animation: progressShimmer 2s infinite;
    `;

    // Create loading text
    this.loadingText = document.createElement('p');
    this.loadingText.className = 'loading-text';
    this.loadingText.textContent = 'Preparing your adventure...';
    this.loadingText.style.cssText = `
      font-size: clamp(16px, 4vw, 20px);
      color: #FFE4B5;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
      margin: 0;
    `;

    // Add shimmer animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes progressShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);

    // Assemble
    progressContainer.appendChild(this.progressBar);
    this.card.appendChild(progressContainer);
    this.card.appendChild(this.loadingText);
    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.card);
  }

  /**
   * Show the loading overlay
   */
  public async show(): Promise<void> {
    if (this.isVisible) return;

    this.isVisible = true;

    // Reset progress
    if (this.progressBar) {
      this.progressBar.style.width = '0%';
    }
    if (this.loadingText) {
      this.loadingText.textContent = 'Preparing your adventure...';
    }

    // Show elements
    if (this.backdrop) {
      this.backdrop.style.display = 'block';
      this.backdrop.style.pointerEvents = 'auto';
      // Force reflow
      void this.backdrop.offsetWidth;
      this.backdrop.style.opacity = '1';
    }

    if (this.card) {
      this.card.style.display = 'block';
      this.card.style.pointerEvents = 'auto';
      // Force reflow
      void this.card.offsetWidth;
      this.card.style.opacity = '1';
    }

    console.log('📊 [LoadingOverlay] Shown');
  }

  /**
   * Update loading progress
   * @param progress - Value from 0 to 1
   * @param message - Optional message to display
   */
  public updateProgress(progress: number, message: string = ''): void {
    console.log(`📊 [LoadingOverlay] updateProgress(${progress}, "${message}")`);

    if (this.progressBar) {
      const percentage = Math.round(progress * 100);
      this.progressBar.style.width = `${percentage}%`;
      console.log(`✅ [LoadingOverlay] Progress bar: ${percentage}%`);
    } else {
      console.error('❌ [LoadingOverlay] Progress bar element not found');
    }

    if (this.loadingText && message) {
      this.loadingText.textContent = message;
      console.log(`✅ [LoadingOverlay] Message: "${message}"`);
    }
  }

  /**
   * Show completion message
   */
  public async showComplete(): Promise<void> {
    if (this.loadingText) {
      this.loadingText.textContent = 'Forest ready! 🌰';
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Hide the loading overlay
   */
  public async hide(): Promise<void> {
    if (!this.isVisible) return;

    this.isVisible = false;

    // Disable pointer events immediately
    if (this.backdrop) {
      this.backdrop.style.pointerEvents = 'none';
      this.backdrop.style.opacity = '0';
    }
    if (this.card) {
      this.card.style.pointerEvents = 'none';
      this.card.style.opacity = '0';
    }

    // Hide after transition
    setTimeout(() => {
      if (this.backdrop) {
        this.backdrop.style.display = 'none';
      }
      if (this.card) {
        this.card.style.display = 'none';
      }
    }, 500);

    console.log('🎭 [LoadingOverlay] Hidden');
  }

  /**
   * Destroy the overlay
   */
  public destroy(): void {
    this.container?.remove();
  }
}
