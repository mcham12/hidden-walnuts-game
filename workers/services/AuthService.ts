/**
 * Authentication Service - JWT Token Management
 * MVP 16: Session management with access and refresh tokens
 *
 * Access Tokens: 30-day expiration, used for API authentication
 * Refresh Tokens: 90-day expiration, used to generate new access tokens
 */

import jwt from 'jsonwebtoken';

export interface AccessTokenPayload {
  username: string;
  email?: string;
  isAuthenticated: boolean;
  emailVerified: boolean;
  unlockedCharacters: string[];
  tokenId: string; // Unique ID for token revocation
  type: 'access';
}

export interface RefreshTokenPayload {
  username: string;
  tokenId: string; // Unique ID for token revocation
  type: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
}

/**
 * Generate access token (30-day expiration)
 * Used for authenticating API requests
 */
export function generateAccessToken(
  userData: {
    username: string;
    email?: string;
    isAuthenticated: boolean;
    emailVerified: boolean;
    unlockedCharacters: string[];
  },
  tokenId: string,
  jwtSecret: string
): string {
  const payload: AccessTokenPayload = {
    username: userData.username,
    email: userData.email,
    isAuthenticated: userData.isAuthenticated,
    emailVerified: userData.emailVerified,
    unlockedCharacters: userData.unlockedCharacters,
    tokenId,
    type: 'access'
  };

  // 30-day expiration
  return jwt.sign(payload, jwtSecret, {
    expiresIn: '30d',
    issuer: 'hidden-walnuts-api'
  });
}

/**
 * Generate refresh token (90-day expiration)
 * Used to obtain new access tokens without re-login
 */
export function generateRefreshToken(
  username: string,
  tokenId: string,
  jwtSecret: string
): string {
  const payload: RefreshTokenPayload = {
    username,
    tokenId,
    type: 'refresh'
  };

  // 90-day expiration
  return jwt.sign(payload, jwtSecret, {
    expiresIn: '90d',
    issuer: 'hidden-walnuts-api'
  });
}

/**
 * Generate both access and refresh tokens
 * Returns token pair with expiry timestamps
 */
export function generateTokenPair(
  userData: {
    username: string;
    email?: string;
    isAuthenticated: boolean;
    emailVerified: boolean;
    unlockedCharacters: string[];
  },
  tokenId: string,
  jwtSecret: string
): TokenPair {
  const accessToken = generateAccessToken(userData, tokenId, jwtSecret);
  const refreshToken = generateRefreshToken(userData.username, tokenId, jwtSecret);

  const now = Date.now();
  const accessTokenExpiry = now + (30 * 24 * 60 * 60 * 1000); // 30 days
  const refreshTokenExpiry = now + (90 * 24 * 60 * 60 * 1000); // 90 days

  return {
    accessToken,
    refreshToken,
    accessTokenExpiry,
    refreshTokenExpiry
  };
}

/**
 * Verify and decode access token
 * Returns payload if valid, null if invalid/expired
 */
export function verifyAccessToken(
  token: string,
  jwtSecret: string
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'hidden-walnuts-api'
    }) as AccessTokenPayload;

    // Verify it's an access token
    if (decoded.type !== 'access') {
      console.error('Token is not an access token');
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Access token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('Invalid access token:', error.message);
    } else {
      console.error('Token verification error:', error);
    }
    return null;
  }
}

/**
 * Verify and decode refresh token
 * Returns payload if valid, null if invalid/expired
 */
export function verifyRefreshToken(
  token: string,
  jwtSecret: string
): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: 'hidden-walnuts-api'
    }) as RefreshTokenPayload;

    // Verify it's a refresh token
    if (decoded.type !== 'refresh') {
      console.error('Token is not a refresh token');
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Refresh token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('Invalid refresh token:', error.message);
    } else {
      console.error('Token verification error:', error);
    }
    return null;
  }
}

/**
 * Extract token from Authorization header
 * Expects format: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Generate unique token ID for tracking
 * Format: timestamp-random
 */
export function generateTokenId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}
