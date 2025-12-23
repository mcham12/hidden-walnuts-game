/**
 * MVP 16: Enticement Service
 * Manages passive signup reminders and frequency limiting
 *
 * DESIGN PRINCIPLE: Never interrupt active gameplay
 * - Toasts are info-only, no action buttons
 * - Action CTAs only in safe contexts (menus, after death, leaderboard)
 */

import { ToastManager } from '../ToastManager';
import { isAuthenticated } from './AuthService';

export class EnticementService {
  private toastManager: ToastManager;

  constructor(toastManager: ToastManager) {
    this.toastManager = toastManager;
  }

  /**
   * Start showing periodic enticement toasts
   * Only shows for no-auth users
   */
  start(): void {
    // FUN & FREE UPDATE: Passive enticements disabled.
    // We only show "Save Progress" hints in specific contexts (like after death).
    return;
  }

  /**
   * Stop showing enticement toasts
   */
  stop(): void {
    // No-op
  }

  /**
   * MVP 16: Show one-time enticement after death (safe timing)
   * Only shows once per session to avoid annoyance
   */
  showAfterDeathEnticement(): void {
    // Don't show if authenticated
    if (isAuthenticated()) return;

    // Check if already shown this session
    const shownThisSession = sessionStorage.getItem('shown_death_enticement');
    if (shownThisSession) return;

    // Show message after a brief delay (let death screen settle)
    setTimeout(() => {
      this.toastManager.info(
        'Lost progress? Create an account to save your progress across sessions!',
        6000
      );

      // Mark as shown this session
      sessionStorage.setItem('shown_death_enticement', 'true');
    }, 1500); // 1.5 second delay
  }
}
