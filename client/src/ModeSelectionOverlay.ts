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

    // 1. Mode Selection Buttons
    const modesContainer = document.createElement('div');
    modesContainer.style.cssText = `
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-bottom: 25px;
      flex-wrap: wrap;
    `;

    const standardBtn = this.createModeButton(
      'STANDARD',
      'After leveling up, NPCs and Predators will start to attack!',
      '#4CAF50', // Green
      () => this.selectMode('standard')
    );

    const carefreeBtn = this.createModeButton(
      'CAREFREE',
      'Relax. No attacks. Just vibes.',
      '#2196F3', // Blue
      () => this.selectMode('carefree')
    );

    modesContainer.appendChild(carefreeBtn);
    modesContainer.appendChild(standardBtn);
    content.appendChild(modesContainer);

    // 2. Info Card (Unifies Tips & Controls)
    const infoCard = document.createElement('div');
    infoCard.style.cssText = `
      background: rgba(0, 0, 0, 0.6);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 380px; /* Slightly taller for breathing room */
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    `;

    // 3. Compact Toggle Header
    const tabsHeader = document.createElement('div');
    tabsHeader.style.cssText = `
      display: flex;
      justify-content: center;
      padding: 15px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0,0,0,0.2);
    `;

    const pillContainer = document.createElement('div');
    pillContainer.style.cssText = `
      display: inline-flex; /* Compact */
      background: #000;
      border-radius: 50px;
      padding: 4px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
    `;

    const createPillBtn = (text: string, isActive: boolean, onClick: () => void) => {
      const btn = document.createElement('div');
      btn.textContent = text;
      btn.style.cssText = `
        padding: 8px 24px;
        cursor: pointer;
        font-weight: 800;
        font-size: 0.8rem;
        border-radius: 40px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        user-select: none;
        min-width: 100px;
        text-align: center;
        ${isActive ?
          `background: #FFF; color: #000; box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);` :
          `background: transparent; color: rgba(255, 255, 255, 0.5);`
        }
      `;
      btn.onclick = onClick;
      return btn;
    };

    // Tab Content Containers
    const controlsContent = document.createElement('div');
    controlsContent.className = 'tab-content';
    controlsContent.style.cssText = `
      flex: 1;
      padding: 0;
      overflow-y: auto;
      display: block; /* Default active */
    `;

    const tipsContent = document.createElement('div');
    tipsContent.className = 'tab-content';
    tipsContent.style.cssText = `
      flex: 1;
      padding: 20px;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
    `;

    // Render Controls (Default Tab)
    this.renderControls(controlsContent);

    // Render Tips
    const tipsWrapper = document.createElement('div');
    tipsWrapper.style.width = '100%';
    tipsWrapper.className = 'tips-container'; // Reuse class for styling if needed

    const tipCard = document.createElement('div');
    tipCard.className = 'mode-tip-card';
    tipCard.style.cssText = `
      background: transparent; 
      box-shadow: none; 
      border: none;
      height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const tipContentFade = document.createElement('div');
    tipContentFade.className = 'tip-content-fade';
    tipContentFade.style.textAlign = 'center';
    tipCard.appendChild(tipContentFade);
    tipsWrapper.appendChild(tipCard);

    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'tips-pagination';
    paginationContainer.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 10px;
    `;
    tipsWrapper.appendChild(paginationContainer);
    tipsContent.appendChild(tipsWrapper);

    this.initCarousel(tipContentFade, paginationContainer);


    // Tab Switching Logic
    let controlsBtn: HTMLElement;
    let tipsBtn: HTMLElement;

    const updatePills = (isControls: boolean) => {
      const resetStyle = `padding: 8px 24px; cursor: pointer; font-weight: 800; font-size: 0.8rem; border-radius: 40px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); text-transform: uppercase; letter-spacing: 0.5px; user-select: none; min-width: 100px; text-align: center; background: transparent; color: rgba(255, 255, 255, 0.5);`;
      const activeStyle = `padding: 8px 24px; cursor: pointer; font-weight: 800; font-size: 0.8rem; border-radius: 40px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); text-transform: uppercase; letter-spacing: 0.5px; user-select: none; min-width: 100px; text-align: center; background: #FFF; color: #000; box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);`;

      controlsBtn.style.cssText = isControls ? activeStyle : resetStyle;
      tipsBtn.style.cssText = !isControls ? activeStyle : resetStyle;

      controlsContent.style.display = isControls ? 'block' : 'none';
      tipsContent.style.display = isControls ? 'none' : 'flex';
    };

    controlsBtn = createPillBtn('Controls', true, () => updatePills(true));
    tipsBtn = createPillBtn('Tips', false, () => updatePills(false)); // Shortened text for compact toggle

    pillContainer.appendChild(controlsBtn);
    pillContainer.appendChild(tipsBtn);
    tabsHeader.appendChild(pillContainer);

    infoCard.appendChild(tabsHeader);
    infoCard.appendChild(controlsContent);
    infoCard.appendChild(tipsContent);

    content.appendChild(infoCard);
    this.container.appendChild(content);
  }


  private renderControls(container: HTMLElement): void {
    const isMobile = TouchControls.isMobile();

    const grid = document.createElement('div');
    // V3: Structured Grid with Left Alignment
    grid.style.cssText = `
        display: grid;
        grid-template-columns: ${isMobile ? '1fr' : '1fr 1fr'}; 
        gap: 12px;
        padding: 20px;
      `;

    const createControlRow = (icon: string, label: string, keyHTML: string) => {
      return `
            <div class="control-row" style="
                display: flex;
                align-items: center;
                background: rgba(255,255,255,0.05);
                padding: 12px 20px;
                border-radius: 12px;
                border: 1px solid rgba(255,255,255,0.05);
            ">
                <div style="font-size: 1.5rem; margin-right: 20px; width: 30px; text-align: center;">${icon}</div>
                <div style="flex: 1; text-align: left;">
                    <div style="font-weight: 800; font-size: 0.9rem; color: #FFF; letter-spacing: 0.5px;">${label}</div>
                </div>
                <div style="opacity: 0.8; font-size: 0.85rem;">${keyHTML}</div>
            </div>
          `;
    };

    let html = '';

    if (isMobile) {
      html += createControlRow('👆', 'MOVE', 'Drag Screen');
      html += createControlRow('🟤', 'GET WALNUT', 'Walk Near');
      html += createControlRow('🎯', 'THROW', 'Tap Button');
      html += createControlRow('🌳', 'HIDE', 'Tap Button');
      html += createControlRow('🍴', 'EAT', 'Tap Button');
    } else {
      html += createControlRow('🚶', 'MOVE', '<span class="control-key">W</span><span class="control-key">A</span><span class="control-key">S</span><span class="control-key">D</span> / <span class="control-key">ARROWS</span>');
      html += createControlRow('🟤', 'GET WALNUT', 'Walk Near');
      html += createControlRow('🎯', 'THROW', '<span class="control-key">T</span> / <span class="control-key">SPACE</span>');
      html += createControlRow('🌳', 'HIDE', '<span class="control-key">H</span>');
      html += createControlRow('🍴', 'EAT', '<span class="control-key">E</span>');
    }

    grid.innerHTML = html;
    container.appendChild(grid);
  }


  // MVP 17: Carousel Logic
  private carouselTips: any[] = [];
  private currentTipIndex: number = 0;
  private carouselInterval: number | undefined;

  private initCarousel(contentEl: HTMLElement, paginationEl: HTMLElement): void {
    // 1. Pick 5 random unique tips
    const allTips = this.tipsManager.getAllTips();
    // Shuffle array
    for (let i = allTips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTips[i], allTips[j]] = [allTips[j], allTips[i]];
    }
    this.carouselTips = allTips.slice(0, 5);
    this.currentTipIndex = 0;

    // 2. Create Dots
    this.renderDots(paginationEl);

    // 3. Show first tip
    this.updateCarouselDisplay(contentEl, paginationEl);

    // 4. Start Auto-rotation
    this.startCarousel(contentEl, paginationEl);
  }

  private renderDots(container: HTMLElement): void {
    container.innerHTML = '';
    this.carouselTips.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'tip-dot';
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
      `;
      // Allow manual navigation
      dot.onclick = () => {
        this.currentTipIndex = index;
        // Find content element relative to container - hacky but effective
        const contentEl = container.parentElement?.querySelector('.mode-tip-card > div') as HTMLElement;
        if (contentEl) {
          this.updateCarouselDisplay(contentEl, container);
          this.resetCarouselTimer(contentEl, container);
        }
      };
      container.appendChild(dot);
    });
  }

  private updateCarouselDisplay(contentEl: HTMLElement, paginationEl: HTMLElement): void {
    const tip = this.carouselTips[this.currentTipIndex];
    if (!tip) return;

    // Fade Out
    contentEl.style.opacity = '0';
    contentEl.style.transform = 'translateY(5px)';
    contentEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';

    setTimeout(() => {
      // Update Content
      contentEl.innerHTML = `
        <div class="tip-category-icon" style="font-size: 2.5rem; margin-bottom: 10px;">${tip.emoji || '💡'}</div>
        <div style="font-size: 1.1rem; line-height: 1.5; color: white;">${tip.text}</div>
      `;

      // Update Dots
      const dots = paginationEl.querySelectorAll('.tip-dot');
      dots.forEach((dot, idx) => {
        const el = dot as HTMLElement;
        if (idx === this.currentTipIndex) {
          el.style.backgroundColor = '#FFD700'; // Active Gold
          el.style.transform = 'scale(1.3)';
        } else {
          el.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
          el.style.transform = 'scale(1)';
        }
      });

      // Fade In
      contentEl.style.opacity = '1';
      contentEl.style.transform = 'translateY(0)';
    }, 300);
  }

  private startCarousel(contentEl: HTMLElement, paginationEl: HTMLElement): void {
    if (this.carouselInterval) clearInterval(this.carouselInterval);

    this.carouselInterval = window.setInterval(() => {
      this.currentTipIndex = (this.currentTipIndex + 1) % this.carouselTips.length;
      this.updateCarouselDisplay(contentEl, paginationEl);
    }, 6000) as unknown as number; // 6 seconds per tip
  }

  private resetCarouselTimer(contentEl: HTMLElement, paginationEl: HTMLElement): void {
    this.startCarousel(contentEl, paginationEl);
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

  private selectMode(mode: 'standard' | 'carefree'): void {
    // Clear interval
    if (this.tipInterval) {
      clearInterval(this.tipInterval);
    }

    if (this.carouselInterval) {
      clearInterval(this.carouselInterval);
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
