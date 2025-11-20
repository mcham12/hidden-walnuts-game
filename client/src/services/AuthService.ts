/**
 * Authentication Service
 * MVP 16: Client-side authentication API integration
 *
 * Handles all authentication-related API calls:
 * - Signup, login, logout
 * - Password reset flow
 * - Email verification
 * - Token management (access & refresh tokens)
 * - Session persistence
 *
 * Token storage:
 * - auth_access_token: JWT access token (30-day expiration)
 * - auth_refresh_token: JWT refresh token (90-day expiration)
 * - auth_user: Cached user data
 * - auth_access_token_expiry: Expiration timestamp for access token
 * - auth_refresh_token_expiry: Expiration timestamp for refresh token
 */

// Get API URL from environment
const API_URL = import.meta.env.VITE_API_URL || '';

export interface UserData {
  username: string;
  email?: string;
  emailVerified: boolean;
  isAuthenticated: boolean;
  unlockedCharacters: string[];
  lastCharacterId?: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  success: boolean;
  username: string;
  email: string;
  emailVerified: boolean;
  unlockedCharacters: string[];
  lastCharacterId?: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  error?: string;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  username: string;
  email: string;
  emailVerified: boolean;
  unlockedCharacters: string[];
  lastCharacterId?: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  error?: string;
  message?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface ResendVerificationRequest {
  email?: string; // Optional if user is already logged in
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  accessTokenExpiry: number;
  error?: string;
  message?: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * Sign up a new user
 */
export async function signup(data: SignupRequest): Promise<SignupResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Store tokens and user data
      storeAuthData(result);
      return result;
    }

    return {
      success: false,
      error: result.error || 'Signup failed',
      message: result.message || 'An error occurred during signup',
      ...result
    };
  } catch (error) {
    console.error('Signup error:', error);
    return {
      success: false,
      error: 'Network error',
      message: 'Failed to connect to server. Please check your internet connection.',
      username: '',
      email: '',
      emailVerified: false,
      unlockedCharacters: [],
      accessToken: '',
      refreshToken: '',
      accessTokenExpiry: 0,
      refreshTokenExpiry: 0
    };
  }
}

/**
 * Log in an existing user
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Store tokens and user data
      storeAuthData(result);
      return result;
    }

    return {
      success: false,
      error: result.error || 'Login failed',
      message: result.message || 'Invalid email or password',
      ...result
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      error: 'Network error',
      message: 'Failed to connect to server. Please check your internet connection.',
      username: '',
      email: '',
      emailVerified: false,
      unlockedCharacters: [],
      accessToken: '',
      refreshToken: '',
      accessTokenExpiry: 0,
      refreshTokenExpiry: 0
    };
  }
}

/**
 * Request password reset email
 */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Forgot password error:', error);
    return {
      success: false,
      message: 'Failed to send password reset email',
      error: 'Network error'
    };
  }
}

/**
 * Reset password with token from email
 */
export async function resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      message: 'Failed to reset password',
      error: 'Network error'
    };
  }
}

/**
 * Verify email address with token from email
 */
export async function verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  try {
    const response = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    // If verification successful, update cached user data
    if (result.success) {
      const user = getCurrentUser();
      if (user) {
        user.emailVerified = true;
        localStorage.setItem('auth_user', JSON.stringify(user));
      }
    }

    return result;
  } catch (error) {
    console.error('Verify email error:', error);
    return {
      success: false,
      message: 'Failed to verify email',
      error: 'Network error'
    };
  }
}

/**
 * Resend verification email
 */
export async function resendVerification(data?: ResendVerificationRequest): Promise<ResendVerificationResponse> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth token if available
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Ensure email is present (required for routing in api.ts)
    const requestData = data || {};
    if (!requestData.email) {
      const user = getCurrentUser();
      if (user && user.email) {
        requestData.email = user.email;
      }
    }

    const response = await fetch(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Resend verification error:', error);
    return {
      success: false,
      message: 'Failed to resend verification email',
      error: 'Network error'
    };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<RefreshTokenResponse> {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
        message: 'Please log in again',
        accessToken: '',
        accessTokenExpiry: 0
      };
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      // Update access token
      localStorage.setItem('auth_access_token', result.accessToken);
      localStorage.setItem('auth_access_token_expiry', result.accessTokenExpiry.toString());
      return result;
    }

    // Refresh token expired or invalid - clear auth
    clearAuth();
    return result;
  } catch (error) {
    console.error('Refresh token error:', error);
    return {
      success: false,
      error: 'Network error',
      message: 'Failed to refresh authentication',
      accessToken: '',
      accessTokenExpiry: 0
    };
  }
}

/**
 * Log out current user
 */
export async function logout(): Promise<LogoutResponse> {
  try {
    const token = getAccessToken();
    if (token) {
      // Call backend logout endpoint
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }

  // Clear local auth data regardless of backend response
  clearAuth();

  return {
    success: true,
    message: 'Logged out successfully'
  };
}

/**
 * Get current user data from localStorage
 */
export function getCurrentUser(): UserData | null {
  try {
    const userJson = localStorage.getItem('auth_user');
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error parsing user data:', error);
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken();
  const expiry = getAccessTokenExpiry();

  if (!token || !expiry) return false;

  // Check if token is expired
  const now = Date.now();
  if (now >= expiry) {
    // Token expired, try to refresh
    refreshAccessToken().catch(() => {
      // Refresh failed, user is not authenticated
      clearAuth();
    });
    return false;
  }

  return true;
}

/**
 * Get access token
 */
export function getAccessToken(): string | null {
  return localStorage.getItem('auth_access_token');
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem('auth_refresh_token');
}

/**
 * Get access token expiry timestamp
 */
export function getAccessTokenExpiry(): number | null {
  const expiry = localStorage.getItem('auth_access_token_expiry');
  return expiry ? parseInt(expiry, 10) : null;
}

/**
 * Get refresh token expiry timestamp
 */
export function getRefreshTokenExpiry(): number | null {
  const expiry = localStorage.getItem('auth_refresh_token_expiry');
  return expiry ? parseInt(expiry, 10) : null;
}

/**
 * Store authentication data in localStorage
 */
function storeAuthData(data: SignupResponse | LoginResponse): void {
  localStorage.setItem('auth_access_token', data.accessToken);
  localStorage.setItem('auth_refresh_token', data.refreshToken);
  localStorage.setItem('auth_access_token_expiry', data.accessTokenExpiry.toString());
  localStorage.setItem('auth_refresh_token_expiry', data.refreshTokenExpiry.toString());

  const userData: UserData = {
    username: data.username,
    email: data.email,
    emailVerified: data.emailVerified,
    isAuthenticated: true,
    unlockedCharacters: data.unlockedCharacters,
    lastCharacterId: data.lastCharacterId
  };

  localStorage.setItem('auth_user', JSON.stringify(userData));

  // Also store username in legacy format for main.ts compatibility
  localStorage.setItem('hw_username', data.username);

  // Store last character ID if available
  if (data.lastCharacterId) {
    localStorage.setItem('last_character_id', data.lastCharacterId);
  }
}

/**
 * Clear all authentication data
 */
export function clearAuth(): void {
  localStorage.removeItem('auth_access_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_access_token_expiry');
  localStorage.removeItem('auth_refresh_token_expiry');
  localStorage.removeItem('auth_user');
}

/**
 * Start automatic token refresh timer
 * Refreshes access token 5 days before expiration (every 25 days)
 */
export function startTokenRefreshTimer(): void {
  // Check every hour if token needs refresh
  setInterval(() => {
    const expiry = getAccessTokenExpiry();
    if (!expiry) return;

    const now = Date.now();
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;

    // Refresh if expiring within 5 days
    if (expiry - now < fiveDaysInMs) {
      refreshAccessToken().catch((error) => {
        console.error('Auto-refresh failed:', error);
      });
    }
  }, 60 * 60 * 1000); // Check every hour
}

/**
 * Restore session on page load
 * Checks if tokens are valid and refreshes if needed
 */
export async function restoreSession(): Promise<boolean> {
  const accessToken = getAccessToken();
  const accessExpiry = getAccessTokenExpiry();
  const refreshToken = getRefreshToken();

  if (!accessToken || !refreshToken) {
    return false;
  }

  const now = Date.now();

  // If access token is expired, try to refresh
  if (accessExpiry && now >= accessExpiry) {
    const result = await refreshAccessToken();
    return result.success;
  }

  // Access token is still valid
  return true;
}
