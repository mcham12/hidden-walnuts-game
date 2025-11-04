/**
 * TipCard - Dismissible educational tip cards
 *
 * MVP 14 Phase 9: Industry-standard tip system (Clash of Clans, PUBG Mobile pattern)
 * - Manual dismiss (user-controlled)
 * - Bottom-center positioning (doesn't block minimap/HUD)
 * - One tip at a time with queue
 * - Semi-transparent background
 */

export class TipCard {
  private container: HTMLElement;
  private queue: Array<{ text: string; emoji?: string }> = [];
  private isShowing: boolean = false;
  private currentCard: HTMLElement | null = null;

  constructor() {
    this.container = document.getElementById('tip-card-container')!;

    if (!this.container) {
      console.error('TipCard: Container #tip-card-container not found');
    }
  }

  /**
   * Show a dismissible tip card
   * @param text Tip text content
   * @param emoji Optional emoji prefix
   */
  show(text: string, emoji?: string): void {
    // If already showing, queue this tip
    if (this.isShowing) {
      this.queue.push({ text, emoji });
      return;
    }

    this.isShowing = true;
    this.createCard(text, emoji);
  }

  /**
   * Create and display the tip card
   */
  private createCard(text: string, emoji?: string): void {
    // Create card element
    const card = document.createElement('div');
    card.className = 'tip-card';

    // Header with emoji and close button
    const header = document.createElement('div');
    header.className = 'tip-card-header';

    const title = document.createElement('div');
    title.className = 'tip-card-title';
    title.textContent = '💡 TIP';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tip-card-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close tip');
    closeBtn.onclick = () => this.dismiss();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content
    const content = document.createElement('div');
    content.className = 'tip-card-content';
    const emojiPrefix = emoji ? `${emoji} ` : '';
    content.textContent = `${emojiPrefix}${text}`;

    // Footer with "Got it" button
    const footer = document.createElement('div');
    footer.className = 'tip-card-footer';

    const gotItBtn = document.createElement('button');
    gotItBtn.className = 'tip-card-button';
    gotItBtn.textContent = 'Got it';
    gotItBtn.onclick = () => this.dismiss();

    footer.appendChild(gotItBtn);

    // Assemble card
    card.appendChild(header);
    card.appendChild(content);
    card.appendChild(footer);

    // Add to container
    this.container.appendChild(card);
    this.currentCard = card;

    // Trigger slide-in animation
    requestAnimationFrame(() => {
      card.classList.add('tip-card-visible');
    });
  }

  /**
   * Dismiss the current tip card
   */
  private dismiss(): void {
    if (!this.currentCard) return;

    const card = this.currentCard;

    // Slide out animation
    card.classList.remove('tip-card-visible');
    card.classList.add('tip-card-exit');

    // Remove after animation
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
      this.currentCard = null;
      this.isShowing = false;

      // Show next tip in queue if any
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.show(next.text, next.emoji);
      }
    }, 300); // Match CSS animation duration
  }

  /**
   * Clear the queue (emergency use)
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Check if currently showing a tip
   */
  isActive(): boolean {
    return this.isShowing;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}
