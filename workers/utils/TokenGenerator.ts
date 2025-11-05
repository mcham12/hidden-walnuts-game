/**
 * TokenGenerator - Generate secure verification and reset tokens
 * MVP 16: Full authentication support
 */
export class TokenGenerator {
  /**
   * Generate cryptographically secure random token
   * Uses crypto.randomUUID() for security
   */
  static generateVerificationToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate password reset token
   * Uses crypto.randomUUID() for security
   */
  static generatePasswordResetToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate token expiration timestamp
   * @param hoursFromNow - Hours until expiration
   */
  static generateExpiry(hoursFromNow: number): number {
    return Date.now() + (hoursFromNow * 60 * 60 * 1000);
  }

  /**
   * Check if token is expired
   */
  static isExpired(expiryTimestamp?: number): boolean {
    if (!expiryTimestamp) return true;
    return Date.now() > expiryTimestamp;
  }
}
