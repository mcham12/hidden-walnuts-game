import { TipsManager } from './TipsManager';
import { TouchControls } from './TouchControls';


export class ModeSelectionOverlay {
  private container: HTMLElement;
  private onSelect: (mode: 'standard' | 'carefree') => void;
  private tipsManager: TipsManager;
  private tipInterval: number | undefined;

  constructor(onSelect: (mode: 'standard' | 'carefree') => void) {
    this.onSelect = onSelect;
    this.tipsManager = new TipsManager();
    this.container = document.createElement('div');
    this.container.id = 'mode-selection-overlay';

    // Inject responsive styles
    const style = document.createElement('style');
    style.textContent = `
      #mode-selection-overlay {
        font-family: 'Arial', sans-serif;
        color: white;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .mode-content {
        width: 100%;
        max-width: 900px;
        max-height: 90vh;
        background: rgba(40, 40, 40, 0.95);
        border: 4px solid #8B4513;
        border-radius: 20px;
        padding: 30px;
        text-align: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        gap: 20px;
        overflow-y: auto; /* Allow scrolling on small screens */
        -webkit-overflow-scrolling: touch;
      }

      .mode-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        text-align: left;
      }

      .mobile-controls-hint {
        display: none;
      }

      h1 {
        font-size: 3rem;
        margin: 0;
        text-shadow: 3px 3px 0 #000;
        color: #FFD700;
      }

      /* Mobile / Portrait Styles */
      @media (max-width: 768px) {
        .mode-content {
          padding: 15px;
          max-height: 95vh;
        }

        h1 {
          font-size: 2rem;
        }

        .mode-grid {
          grid-template-columns: 1fr; /* Stack vertically */
        }

        .mode-btn {
          padding: 15px !important;
          min-height: 80px;
        }
        
        .mode-btn-title {
          font-size: 1.2rem !important;
        }

        /* Hide desktop controls description on mobile to save space */
        .desktop-controls {
          display: none !important;
        }

        .mobile-controls-hint {
          display: block;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 15px;
          padding: 15px;
        }
      }

      /* Landscape Mobile Styles */
      @media (max-height: 600px) and (orientation: landscape) {
        .mode-content {
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        h1 {
          width: 100%;
          font-size: 1.5rem;
        }

        .mode-grid {
             width: 100%;
        }
      }

      /* iOS Safe-Area Support (notch/Dynamic Island) */
      @supports (padding: env(safe-area-inset-left)) {
        #mode-selection-overlay {
          padding-left: max(20px, env(safe-area-inset-left));
          padding-right: max(20px, env(safe-area-inset-right));
          padding-top: max(20px, env(safe-area-inset-top));
          padding-bottom: max(20px, env(safe-area-inset-bottom));
        }
        
        .mode-content {
          padding-left: max(15px, env(safe-area-inset-left));
          padding-right: max(15px, env(safe-area-inset-right));
        }
      }

      /* iPad Optimization */
      @media (max-width: 1024px) and (min-width: 768px) {
        .mode-content {
          max-width: 700px;
        }
      }

      /* Fix Landscape Overflow */
      @media (max-height: 600px) and (orientation: landscape) {
        .tips-container,
        .control-item {
          font-size: 0.85rem;
        }
        .mode-grid {
          gap: 10px;
        }
        h1 {
          font-size: 1.3rem;
        }
      }

      /* Controls Styling */
      .control-item {
        margin: 8px 0;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .control-icon {
        font-size: 1.4rem;
        min-width: 25px;
        text-align: center;
      }
      .control-text {
        flex: 1;
      }
      .control-label {
        font-size: 0.9rem;
        font-weight: bold;
        color: #FFD700;
        margin: 0 0 2px 0;
      }
      .control-desc {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.9);
        margin: 0;
        line-height: 1.3;
      }
      .control-key {
        display: inline-block;
        padding: 1px 4px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.5);
        border-radius: 3px;
        font-weight: bold;
        margin: 0 1px;
        font-size: 0.75rem;
      }
      /* Tip Carousel Styling */
      .tips-container {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 15px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 180px; /* Slight Increase */
        position: relative;
        overflow: hidden;
      }

      .mode-tip-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        padding: 15px;
        margin-top: 5px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        animation: fadeInRight 0.5s ease-out;
      }
      
      @keyframes fadeInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .tip-category-icon {
        font-size: 2rem;
        margin-bottom: 8px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }

      .tip-progress-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        margin-top: 15px;
        overflow: hidden;
        width: 100%;
      }
      
      .tip-progress-fill {
        height: 100%;
        background: #FFD700;
        width: 100%; /* Must be 100% for scaleX to work */
        animation: progressFill 8s linear infinite;
        transform-origin: left;
        transform: scaleX(0); /* Start at 0 */
      }

      @keyframes progressFill {
        from { transform: scaleX(0); }
        to { transform: scaleX(1); }
      }
      
      /* Content Animation Classes */
      .tip-content-fade {
        transition: opacity 0.3s ease-in-out;
        opacity: 1;
      }
      .tip-content-hidden {
        opacity: 0;
      }
    `;
    document.head.appendChild(style);

    this.container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(5px);
    `;

    this.render();
    document.body.appendChild(this.container);
  }

  private render(): void {
    const content = document.createElement('div');
    content.className = 'mode-content';

    // Title
    const title = document.createElement('h1');
    title.textContent = 'Welcome to Hidden Walnuts!';
    content.appendChild(title);

    // 1. Mode Selection (NOW AT TOP)
    const modesContainer = document.createElement('div');
    modesContainer.style.cssText = `
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-bottom: 10px;
      flex-wrap: wrap; /* Wrap on very small screens */
    `;

    // Standard Mode Button
    const standardBtn = this.createModeButton(
      'STANDARD',
      'After leveling up, NPCs and Predators will start to attack!',
      '#4CAF50', // Green
      () => this.selectMode('standard')
    );

    // Carefree Mode Button
    const carefreeBtn = this.createModeButton(
      'CAREFREE',
      'Relax. No attacks. Just vibes.',
      '#2196F3', // Blue
      () => this.selectMode('carefree')
    );

    modesContainer.appendChild(carefreeBtn);
    modesContainer.appendChild(standardBtn);
    content.appendChild(modesContainer);

    // 2. Info Grid (Tips & Controls) - NOW BELOW BUTTONS
    const gridContainer = document.createElement('div');
    gridContainer.className = 'mode-grid';

    // Tips Carousel (Left/Top)
    const tipsContainer = document.createElement('div');
    tipsContainer.className = 'tips-container';

    const tipTitle = document.createElement('h3');
    tipTitle.textContent = 'Tips';
    tipTitle.style.marginBottom = '10px';
    tipTitle.style.marginTop = '0';
    tipsContainer.appendChild(tipTitle);

    // Static Card Container
    const tipCard = document.createElement('div');
    tipCard.className = 'mode-tip-card';

    // Content wrapper for animation
    const tipContent = document.createElement('div');
    tipContent.className = 'tip-content-fade'; // Start visible
    tipContent.style.textAlign = 'center';

    tipCard.appendChild(tipContent);
    tipsContainer.appendChild(tipCard);

    // Progress Bar
    const progressBar = document.createElement('div');
    progressBar.className = 'tip-progress-bar';
    progressBar.innerHTML = '<div class="tip-progress-fill"></div>';
    tipsContainer.appendChild(progressBar);

    gridContainer.appendChild(tipsContainer);

    // Initialize first tip immediately
    this.updateTipContent(tipContent);

    // Start auto-rotation
    this.tipInterval = window.setInterval(() => {
      this.animateTipUpdate(tipContent);
    }, 8000) as unknown as number;



    // Controls Overview (Right/Bottom)
    const controlsContainer = document.createElement('div');
    controlsContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border-radius: 15px;
      padding: 20px;
      text-align: left;
    `;

    // MVP 16: Use authoritative platform detection to match TutorialOverlay ("?")
    const isMobile = TouchControls.isMobile();

    controlsContainer.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 10px;">Controls</h3>
    `;

    if (isMobile) {
      // Mobile View
      controlsContainer.innerHTML += `
        <div class="control-item">
          <div class="control-icon">👆</div>
          <div class="control-text">
            <div class="control-label">MOVE</div>
            <div class="control-desc">Drag anywhere on screen</div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🟤</div>
          <div class="control-text">
            <div class="control-label">GET WALNUT</div>
            <div class="control-desc">Walk near</div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🎯</div>
          <div class="control-text">
            <div class="control-label">THROW</div>
            <div class="control-desc">Tap Button</div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🌳</div>
          <div class="control-text">
            <div class="control-label">HIDE</div>
            <div class="control-desc">Tap Button</div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🍴</div>
          <div class="control-text">
            <div class="control-label">EAT</div>
            <div class="control-desc">Tap Button</div>
          </div>
        </div>
      `;
    } else {
      // Desktop View
      controlsContainer.innerHTML += `
        <div class="control-item">
          <div class="control-icon">🚶</div>
          <div class="control-text">
            <div class="control-label">MOVE</div>
            <div class="control-desc">
              <span class="control-key">W</span><span class="control-key">A</span><span class="control-key">S</span><span class="control-key">D</span>
            </div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🟤</div>
          <div class="control-text">
            <div class="control-label">GET WALNUT</div>
            <div class="control-desc">Walk near</div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🎯</div>
          <div class="control-text">
            <div class="control-label">THROW WALNUT</div>
            <div class="control-desc"><span class="control-key">T</span> or <span class="control-key">SPACE</span></div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🌳</div>
          <div class="control-text">
            <div class="control-label">HIDE WALNUT</div>
            <div class="control-desc"><span class="control-key">H</span></div>
          </div>
        </div>
        <div class="control-item">
          <div class="control-icon">🍴</div>
          <div class="control-text">
            <div class="control-label">EAT WALNUT</div>
            <div class="control-desc"><span class="control-key">E</span></div>
          </div>
        </div>
      `;
    }

    gridContainer.appendChild(controlsContainer);

    content.appendChild(gridContainer);
    this.container.appendChild(content);
  }

  private createModeButton(title: string, desc: string, color: string, onClick: () => void): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.style.cssText = `
      background: ${color};
      border: none;
      border-radius: 15px;
      padding: 15px;
      color: white;
      font-family: inherit;
      cursor: pointer;
      flex: 1;
      min-width: 140px; /* Prevent squishing */
      transition: transform 0.2s, filter 0.2s;
      box-shadow: 0 5px 0 rgba(0,0,0,0.3);
    `;
    btn.innerHTML = `
      <div class="mode-btn-title" style="font-size: 1.4rem; margin-bottom: 5px; font-weight: bold;">${title}</div>
      <div style="font-size: 0.85rem; opacity: 0.9;">${desc}</div>
    `;

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.filter = 'brightness(1.1)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)';
      btn.style.filter = 'brightness(1.0)';
    };
    btn.onmousedown = () => btn.style.transform = 'translateY(2px)';
    btn.onclick = onClick;

    // Add touch feedback
    btn.ontouchstart = () => btn.style.transform = 'translateY(2px)';
    btn.ontouchend = () => btn.style.transform = 'translateY(0)';

    return btn;
  }

  private updateTipContent(container: HTMLElement): void {
    const tip = this.tipsManager.getRandomTip();
    if (!tip) return;

    container.innerHTML = `
      <div class="tip-category-icon">${tip.emoji || '💡'}</div>
      <div style="font-size: 1.05rem; line-height: 1.4; color: white;">${tip.text}</div>
    `;

    // Ensure visibility
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
  }

  private animateTipUpdate(container: HTMLElement): void {
    // 1. Fade out
    container.classList.add('tip-content-hidden');

    // 2. Wait for fade out, update text, fade in
    setTimeout(() => {
      this.updateTipContent(container);
      container.classList.remove('tip-content-hidden');

      // Reset Progress Bar
      const bar = this.container.querySelector('.tip-progress-fill') as HTMLElement;
      if (bar) {
        // Reset animation
        bar.style.animation = 'none';
        bar.offsetHeight; /* trigger reflow */
        bar.style.animation = 'progressFill 8s linear infinite';
      }
    }, 300); // 300ms matches transition duration
  }

  private selectMode(mode: 'standard' | 'carefree'): void {
    // Clear interval
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
    }

    // Animate out
    this.container.style.opacity = '0';
    this.container.style.transition = 'opacity 0.5s';

    setTimeout(() => {
      this.container.remove();
      this.onSelect(mode);
    }, 500);
  }
}
