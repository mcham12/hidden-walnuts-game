import bcrypt from 'bcryptjs';

/**
 * PasswordUtils - Password hashing and validation utilities
 * MVP 16: Full authentication support
 */
export class PasswordUtils {
  private static readonly BCRYPT_COST_FACTOR = 12;
  private static readonly MIN_PASSWORD_LENGTH = 8;

  // Common passwords to reject (top 20 for MVP 16, expand later)
  private static readonly COMMON_PASSWORDS = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
    'baseball', '111111', 'iloveyou', 'master', 'sunshine',
    'ashley', 'bailey', 'passw0rd', 'shadow', '123123'
  ];

  /**
   * Validate password meets requirements
   * Requirements:
   * - 8+ characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - Not a common password
   */
  static validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password || password.length < this.MIN_PASSWORD_LENGTH) {
      return { valid: false, error: `Password must be at least ${this.MIN_PASSWORD_LENGTH} characters` };
    }

    // Check for uppercase
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 uppercase letter' };
    }

    // Check for lowercase
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 lowercase letter' };
    }

    // Check for number
    if (!/\d/.test(password)) {
      return { valid: false, error: 'Password must contain at least 1 number' };
    }

    // Check against common passwords
    if (this.COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return { valid: false, error: 'Password is too common. Please choose a stronger password' };
    }

    return { valid: true };
  }

  /**
   * Hash password using bcrypt (cost factor 12)
   * Performance: ~200-300ms per hash (acceptable for signup/password change)
   */
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, this.BCRYPT_COST_FACTOR);
  }

  /**
   * Compare plaintext password with hash
   * Performance: ~200-300ms per comparison (acceptable for login)
   */
  static async comparePassword(plaintext: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(plaintext, hash);
  }

  /**
   * Validate password doesn't match username or email
   */
  static validatePasswordUniqueness(
    password: string,
    username: string,
    email?: string
  ): { valid: boolean; error?: string } {
    const passwordLower = password.toLowerCase();

    if (passwordLower === username.toLowerCase()) {
      return { valid: false, error: 'Password cannot be the same as username' };
    }

    if (email && passwordLower === email.toLowerCase()) {
      return { valid: false, error: 'Password cannot be the same as email' };
    }

    return { valid: true };
  }
}
