/**
 * SessionManager - Manages player session tokens with cookie + localStorage fallback
 *
 * MVP 6: Player Authentication & Identity
 *
 * Strategy:
 * - Priority: Cookie (30 days) > localStorage (fallback) > Generate new
 * - Works in private browsing (just doesn't persist between sessions)
 * - No personal data - just session token (UUID)
 * - SameSite=Lax, Secure (HTTPS only)
 */
export class SessionManager {
  private static readonly COOKIE_NAME = 'hw_session';
  private static readonly STORAGE_KEY = 'hw_session';
  private static readonly COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

  private token: string | null = null;

  /**
   * Get session token (from cookie, localStorage, or generate new)
   */
  getToken(): string {
    // Return cached if already loaded
    if (this.token) {
      return this.token;
    }

    // 1. Try cookie first (most reliable for persistence)
    const cookieToken = this.getCookie(SessionManager.COOKIE_NAME);
    if (cookieToken) {
      this.token = cookieToken;
      this.tryPromoteToLocalStorage(cookieToken);
      return cookieToken;
    }

    // 2. Try localStorage (fallback)
    try {
      const storedToken = localStorage.getItem(SessionManager.STORAGE_KEY);
      if (storedToken) {
        this.token = storedToken;
        this.setCookie(SessionManager.COOKIE_NAME, storedToken);
        return storedToken;
      }
    } catch (e) {
      console.warn('⚠️ localStorage not available (private browsing?)');
    }

    // 3. Generate new token
    const newToken = crypto.randomUUID();
    this.token = newToken;
    this.saveToken(newToken);
    return newToken;
  }

  /**
   * Save token to cookie and localStorage
   */
  private saveToken(token: string): void {
    // Save to cookie (primary)
    this.setCookie(SessionManager.COOKIE_NAME, token);

    // Save to localStorage (backup)
    try {
      localStorage.setItem(SessionManager.STORAGE_KEY, token);
    } catch (e) {
      console.warn('⚠️ Could not save to localStorage:', e);
    }
  }

  /**
   * Try to promote cookie token to localStorage (for redundancy)
   */
  private tryPromoteToLocalStorage(token: string): void {
    try {
      const stored = localStorage.getItem(SessionManager.STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(SessionManager.STORAGE_KEY, token);
      }
    } catch (e) {
      // Silently fail - not critical
    }
  }

  /**
   * Get cookie value by name
   */
  private getCookie(name: string): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [key, value] = cookie.trim().split('=');
      if (key === name) {
        return value;
      }
    }
    return null;
  }

  /**
   * Set cookie with secure flags
   */
  private setCookie(name: string, value: string): void {
    // Only use Secure flag on HTTPS (not localhost)
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value}; max-age=${SessionManager.COOKIE_MAX_AGE}; SameSite=Lax; path=/${secure}`;
  }

  /**
   * Clear session (for testing or logout)
   */
  clearSession(): void {
    this.token = null;
    document.cookie = `${SessionManager.COOKIE_NAME}=; max-age=0; path=/`;
    try {
      localStorage.removeItem(SessionManager.STORAGE_KEY);
    } catch (e) {
      // Silently fail
    }
  }
}
