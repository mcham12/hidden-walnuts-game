/**
 * Email Verification Reminder System
 * MVP 16: Unverified email reminder logic
 *
 * Features:
 * - Trigger: Every 3rd login if email not verified
 * - Toast: "Verify your email to secure your account" + [Resend Email] link
 * - Duration: 8 seconds
 * - Track `login_count_since_reminder` in localStorage
 */

import { getCurrentUser, resendVerification } from '../services/AuthService';

export interface ReminderState {
  loginCount: number;
  lastReminderTime: number;
  totalReminders: number;
}

/**
 * Get reminder state from localStorage
 */
function getReminderState(): ReminderState {
  try {
    const state = localStorage.getItem('email_reminder_state');
    if (state) {
      return JSON.parse(state);
    }
  } catch (error) {
    console.error('Error loading reminder state:', error);
  }

  return {
    loginCount: 0,
    lastReminderTime: 0,
    totalReminders: 0
  };
}

/**
 * Save reminder state to localStorage
 */
function saveReminderState(state: ReminderState): void {
  try {
    localStorage.setItem('email_reminder_state', JSON.stringify(state));
  } catch (error) {
    console.error('Error saving reminder state:', error);
  }
}

/**
 * Reset reminder state (when email is verified)
 */
export function resetEmailReminderState(): void {
  try {
    localStorage.removeItem('email_reminder_state');
  } catch (error) {
    console.error('Error resetting reminder state:', error);
  }
}

/**
 * Check if email verification reminder should be shown
 * Call this on every login/page load
 */
export function checkEmailVerificationReminder(): boolean {
  const user = getCurrentUser();

  // Don't show if user is not authenticated or email is already verified
  if (!user || !user.isAuthenticated || user.emailVerified) {
    return false;
  }

  const state = getReminderState();

  // Increment login count
  state.loginCount++;

  // Show reminder every 3rd login
  if (state.loginCount >= 3) {
    state.loginCount = 0; // Reset counter
    state.lastReminderTime = Date.now();
    state.totalReminders++;
    saveReminderState(state);
    return true;
  }

  // Save updated count
  saveReminderState(state);
  return false;
}

/**
 * Show email verification reminder toast
 * Returns a cleanup function to remove the toast
 */
export function showEmailVerificationReminder(): () => void {
  const user = getCurrentUser();
  if (!user) {
    return () => {};
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'email-verification-reminder-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: slideIn 0.3s ease;
  `;

  // Add animation styles
  if (!document.getElementById('email-reminder-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'email-reminder-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(120%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(120%);
          opacity: 0;
        }
      }

      /* Responsive positioning for mobile */
      @media (max-width: 768px) {
        .email-verification-reminder-toast {
          top: auto !important;
          bottom: 80px !important;
          right: 16px !important;
          left: 16px !important;
          max-width: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Message
  const message = document.createElement('div');
  message.style.cssText = `
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  `;
  message.textContent = 'Verify your email to secure your account';

  // Buttons container
  const buttons = document.createElement('div');
  buttons.style.cssText = `
    display: flex;
    gap: 8px;
  `;

  // Resend button
  const resendButton = document.createElement('button');
  resendButton.style.cssText = `
    flex: 1;
    padding: 8px 16px;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  `;
  resendButton.textContent = 'Resend Email';

  // Close button
  const closeButton = document.createElement('button');
  closeButton.style.cssText = `
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  `;
  closeButton.innerHTML = '&times;';

  buttons.appendChild(resendButton);
  buttons.appendChild(closeButton);

  toast.appendChild(message);
  toast.appendChild(buttons);

  // Add to DOM
  document.body.appendChild(toast);

  // Auto-dismiss after 8 seconds
  const autoDismissTimer = setTimeout(() => {
    removeToast();
  }, 8000);

  // Remove toast function
  const removeToast = () => {
    clearTimeout(autoDismissTimer);
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  };

  // Button event listeners
  resendButton.addEventListener('click', async () => {
    resendButton.disabled = true;
    resendButton.textContent = 'Sending...';
    resendButton.style.opacity = '0.7';

    try {
      const response = await resendVerification({ email: user.email });

      if (response.success) {
        message.textContent = 'Email sent! Check your inbox.';
        resendButton.textContent = 'Sent ✓';
        setTimeout(removeToast, 2000);
      } else {
        message.textContent = 'Failed to send. Try again later.';
        resendButton.textContent = 'Resend Email';
        resendButton.disabled = false;
        resendButton.style.opacity = '1';
      }
    } catch (error) {
      console.error('Resend error:', error);
      message.textContent = 'Network error. Try again later.';
      resendButton.textContent = 'Resend Email';
      resendButton.disabled = false;
      resendButton.style.opacity = '1';
    }
  });

  closeButton.addEventListener('click', () => {
    removeToast();
  });

  // Hover effects
  resendButton.addEventListener('mouseenter', () => {
    if (!resendButton.disabled) {
      resendButton.style.transform = 'scale(1.05)';
    }
  });
  resendButton.addEventListener('mouseleave', () => {
    resendButton.style.transform = 'scale(1)';
  });

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.3)';
  });
  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.background = 'rgba(255, 255, 255, 0.2)';
  });

  // Return cleanup function
  return removeToast;
}

/**
 * Track login for reminder system
 * Call this after successful login
 */
export function trackLoginForReminder(): void {
  // Check if reminder should be shown
  if (checkEmailVerificationReminder()) {
    // Show reminder after a short delay
    setTimeout(() => {
      showEmailVerificationReminder();
    }, 2000); // 2 second delay after login
  }
}
