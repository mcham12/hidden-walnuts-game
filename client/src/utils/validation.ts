/**
 * Client-Side Validation Utilities
 * MVP 16: Form validation for authentication flows
 *
 * Provides validation functions for:
 * - Email addresses (RFC 5322 compliant)
 * - Passwords (strength meter + requirements)
 * - Usernames (3-20 chars, alphanumeric + underscore)
 * - Password confirmation matching
 */

export interface PasswordValidationResult {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  errors: string[];
  score: number; // 0-100
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate email address using RFC 5322 compliant regex
 * Accepts most valid email formats including special characters
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required' };
  }

  // RFC 5322 compliant regex (simplified but comprehensive)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Additional checks
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }

  const [localPart] = email.split('@');
  if (localPart.length > 64) {
    return { isValid: false, error: 'Email local part is too long' };
  }

  return { isValid: true };
}

/**
 * Validate username
 * Requirements:
 * - 3-20 characters
 * - Alphanumeric characters (a-z, A-Z, 0-9)
 * - Underscores allowed
 * - Must start with a letter
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.trim().length === 0) {
    return { isValid: false, error: 'Username is required' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 20) {
    return { isValid: false, error: 'Username must be 20 characters or less' };
  }

  // Must start with a letter
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Username must start with a letter' };
  }

  // Only alphanumeric and underscores
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, and underscores' };
  }

  return { isValid: true };
}

/**
 * Validate password and return strength + errors
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 *
 * Strength scoring:
 * - Weak (0-40): Meets minimum requirements only
 * - Medium (41-70): Meets requirements + length/variety
 * - Strong (71-100): Long password with good character variety
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  if (!password || password.length === 0) {
    return {
      isValid: false,
      strength: 'weak',
      errors: ['Password is required'],
      score: 0
    };
  }

  // Check minimum length (8 characters)
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else {
    score += 20; // Base score for meeting minimum length
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score += 15;
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score += 15;
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score += 15;
  }

  // Bonus points for length (beyond 8 characters)
  if (password.length >= 12) {
    score += 15;
  } else if (password.length >= 10) {
    score += 10;
  }

  // Bonus points for special characters
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 10;
  }

  // Bonus points for character variety (entropy)
  const uniqueChars = new Set(password.split('')).size;
  if (uniqueChars >= password.length * 0.7) {
    score += 10; // High variety
  } else if (uniqueChars >= password.length * 0.5) {
    score += 5; // Medium variety
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong';
  if (score <= 40) {
    strength = 'weak';
  } else if (score <= 70) {
    strength = 'medium';
  } else {
    strength = 'strong';
  }

  return {
    isValid: errors.length === 0,
    strength,
    errors,
    score: Math.min(score, 100)
  };
}

/**
 * Validate password confirmation matches original password
 */
export function passwordsMatch(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword || confirmPassword.length === 0) {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true };
}

/**
 * Get password strength color for UI display
 */
export function getPasswordStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return '#E74C3C'; // Red
    case 'medium':
      return '#F39C12'; // Orange/Yellow
    case 'strong':
      return '#27AE60'; // Green
  }
}

/**
 * Get password strength label for UI display
 */
export function getPasswordStrengthLabel(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'weak':
      return 'Weak';
    case 'medium':
      return 'Medium';
    case 'strong':
      return 'Strong';
  }
}

/**
 * Validate all signup form fields
 * Returns object with field-specific errors
 */
export interface SignupValidation {
  username: ValidationResult;
  email: ValidationResult;
  password: PasswordValidationResult;
  confirmPassword: ValidationResult;
  isValid: boolean;
}

export function validateSignupForm(
  username: string,
  email: string,
  password: string,
  confirmPassword: string
): SignupValidation {
  const usernameResult = validateUsername(username);
  const emailResult = validateEmail(email);
  const passwordResult = validatePassword(password);
  const confirmPasswordResult = passwordsMatch(password, confirmPassword);

  return {
    username: usernameResult,
    email: emailResult,
    password: passwordResult,
    confirmPassword: confirmPasswordResult,
    isValid: usernameResult.isValid && emailResult.isValid && passwordResult.isValid && confirmPasswordResult.isValid
  };
}

/**
 * Validate login form fields
 */
export interface LoginValidation {
  email: ValidationResult;
  password: ValidationResult;
  isValid: boolean;
}

export function validateLoginForm(email: string, password: string): LoginValidation {
  const emailResult = validateEmail(email);

  // For login, we just check if password is not empty (don't validate strength)
  const passwordResult: ValidationResult = password.length > 0
    ? { isValid: true }
    : { isValid: false, error: 'Password is required' };

  return {
    email: emailResult,
    password: passwordResult,
    isValid: emailResult.isValid && passwordResult.isValid
  };
}
