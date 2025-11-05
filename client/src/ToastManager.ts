/**
 * MVP 5/16: Toast Notification System
 * Manages toast notifications for game events
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'default' | 'enticement';

interface ToastOptions {
  type?: ToastType;
  duration?: number; // Duration in milliseconds (default: 3000ms)
  icon?: string; // Optional emoji icon
}

export class ToastManager {
  private container: HTMLElement | null = null;
  private toastQueue: HTMLElement[] = [];
  private maxToasts: number = 5; // Maximum simultaneous toasts

  constructor() {
    this.container = document.getElementById('toast-container');
    if (!this.container) {
      console.warn('ToastManager: toast-container element not found');
    }
  }

  /**
   * Show a toast notification
   */
  show(message: string, options: ToastOptions = {}): void {
    if (!this.container) return;

    const {
      type = 'default',
      duration = 3000,
      icon = this.getDefaultIcon(type),
    } = options;

    // Remove oldest toast if we've hit the maximum
    if (this.toastQueue.length >= this.maxToasts) {
      const oldestToast = this.toastQueue.shift();
      if (oldestToast) {
        this.removeToast(oldestToast);
      }
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Add icon if provided
    if (icon) {
      const iconElement = document.createElement('span');
      iconElement.className = 'toast-icon';
      iconElement.textContent = icon;
      toast.appendChild(iconElement);
    }

    // Add message
    const messageElement = document.createElement('span');
    messageElement.className = 'toast-message';
    messageElement.textContent = message;
    toast.appendChild(messageElement);

    // Add to container and queue
    this.container.appendChild(toast);
    this.toastQueue.push(toast);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
  }

  /**
   * Show a success toast
   */
  success(message: string, duration?: number): void {
    this.show(message, { type: 'success', duration });
  }

  /**
   * Show an error toast
   */
  error(message: string, duration?: number): void {
    this.show(message, { type: 'error', duration });
  }

  /**
   * Show an info toast
   */
  info(message: string, duration?: number): void {
    this.show(message, { type: 'info', duration });
  }

  /**
   * Show a warning toast
   */
  warning(message: string, duration?: number): void {
    this.show(message, { type: 'warning', duration });
  }

  /**
   * MVP 16: Show an enticement toast (passive signup reminder)
   * These are non-intrusive, info-only toasts that encourage signup
   * Duration defaults to 8 seconds to give players time to read
   */
  enticement(message: string, duration: number = 8000): void {
    this.show(message, { type: 'enticement', duration, icon: '💡' });
  }

  /**
   * Remove a toast with fade-out animation
   */
  private removeToast(toast: HTMLElement): void {
    // Add fade-out class
    toast.classList.add('fadeOut');

    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }

      // Remove from queue
      const index = this.toastQueue.indexOf(toast);
      if (index > -1) {
        this.toastQueue.splice(index, 1);
      }
    }, 300); // Match animation duration
  }

  /**
   * Get default icon for toast type
   */
  private getDefaultIcon(type: ToastType): string {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      default:
        return '💬';
    }
  }

  /**
   * Clear all toasts
   */
  clearAll(): void {
    this.toastQueue.forEach(toast => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    });
    this.toastQueue = [];
  }
}
