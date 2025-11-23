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
  private intervalId: number | null = null;

  // Frequency limits
  private readonly MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes between toasts
  private readonly MAX_PER_HOUR = 4; // Maximum 4 toasts per hour
  private readonly HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds

  // Enticement messages (rotate through these)
  private readonly messages = [
    'Sign up to unlock 6 free characters!',
    'Your progress isn\'t saved. Sign up to sync across devices!',
    'Join the Hall of Fame - sign up free!',
    'Get verified badge - sign up now!'
  ];

  private currentMessageIndex = 0;

  constructor(toastManager: ToastManager) {
    this.toastManager = toastManager;
  }

  /**
   * Start showing periodic enticement toasts
   * Only shows for no-auth users
   */
  start(): void {
    // Don't show enticements if user is already authenticated
    if (isAuthenticated()) {

      return;
    }

    // Check if we should show initial toast
    if (this.shouldShowEnticement()) {
      this.showNextEnticement();
    }

    // Set up interval to check every minute
    this.intervalId = window.setInterval(() => {
      if (isAuthenticated()) {
        // User signed up, stop enticements
        this.stop();
        return;
      }

      if (this.shouldShowEnticement()) {
        this.showNextEnticement();
      }
    }, 60 * 1000); // Check every minute


  }

  /**
   * Stop showing enticement toasts
   */
  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if we should show an enticement toast based on frequency limits
   */
  private shouldShowEnticement(): boolean {
    const now = Date.now();
    const lastToastTime = this.getLastToastTime();
    const recentToasts = this.getRecentToastTimes();

    // Check minimum interval (15 minutes)
    if (lastToastTime && now - lastToastTime < this.MIN_INTERVAL_MS) {
      return false;
    }

    // Check hourly limit (max 4 per hour)
    const oneHourAgo = now - this.HOUR_MS;
    const toastsInLastHour = recentToasts.filter(time => time > oneHourAgo);

    if (toastsInLastHour.length >= this.MAX_PER_HOUR) {
      return false;
    }

    return true;
  }

  /**
   * Show the next enticement message in rotation
   */
  private showNextEnticement(): void {
    const message = this.messages[this.currentMessageIndex];

    // Show toast (8 second duration)
    this.toastManager.enticement(message);

    // Track this toast
    this.recordToastTime(Date.now());

    // Move to next message (rotate)
    this.currentMessageIndex = (this.currentMessageIndex + 1) % this.messages.length;


  }

  /**
   * Get the last toast time from localStorage
   */
  private getLastToastTime(): number | null {
    try {
      const stored = localStorage.getItem('last_enticement_toast_time');
      return stored ? parseInt(stored, 10) : null;
    } catch (error) {
      console.error('Error reading last toast time:', error);
      return null;
    }
  }

  /**
   * Get recent toast times from localStorage (for hourly limit check)
   */
  private getRecentToastTimes(): number[] {
    try {
      const stored = localStorage.getItem('enticement_toast_times');
      if (!stored) return [];

      const times: number[] = JSON.parse(stored);

      // Clean up old times (older than 1 hour)
      const now = Date.now();
      const oneHourAgo = now - this.HOUR_MS;
      const recentTimes = times.filter(time => time > oneHourAgo);

      // Save cleaned array
      if (recentTimes.length !== times.length) {
        localStorage.setItem('enticement_toast_times', JSON.stringify(recentTimes));
      }

      return recentTimes;
    } catch (error) {
      console.error('Error reading toast times:', error);
      return [];
    }
  }

  /**
   * Record a toast time in localStorage
   */
  private recordToastTime(time: number): void {
    try {
      // Update last toast time
      localStorage.setItem('last_enticement_toast_time', time.toString());

      // Add to recent times array
      const recentTimes = this.getRecentToastTimes();
      recentTimes.push(time);
      localStorage.setItem('enticement_toast_times', JSON.stringify(recentTimes));
    } catch (error) {
      console.error('Error recording toast time:', error);
    }
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
        'Lost progress? Sign up to save your progress across sessions!',
        6000
      );

      // Mark as shown this session
      sessionStorage.setItem('shown_death_enticement', 'true');
    }, 1500); // 1.5 second delay
  }
}
