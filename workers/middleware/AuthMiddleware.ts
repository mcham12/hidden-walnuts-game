/**
 * Authentication Middleware
 * MVP 16: JWT-based authentication for protected API routes
 *
 * Usage:
 * - authenticateRequest() - Extract and verify token, return user data or null
 * - requireAuth() - Return 401 error if not authenticated
 */

import { verifyAccessToken, extractTokenFromHeader, type AccessTokenPayload } from '../services/AuthService';
import type { Env } from '../types';

export interface AuthenticatedRequest {
  user: AccessTokenPayload;
  request: Request;
}

/**
 * Authenticate request by extracting and verifying JWT token
 * Returns user payload if authenticated, null otherwise
 */
export async function authenticateRequest(
  request: Request,
  env: Env
): Promise<AccessTokenPayload | null> {
  // Extract token from Authorization header
  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return null;
  }

  // Verify token
  const payload = verifyAccessToken(token, env.JWT_SECRET);

  if (!payload) {
    return null;
  }

  // TODO: Check if token has been revoked by checking PlayerIdentity DO
  // For now, we trust the JWT signature

  return payload;
}

/**
 * Require authentication middleware
 * Returns 401 error if not authenticated
 * Returns user payload if authenticated
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ authenticated: false; error: Response } | { authenticated: true; user: AccessTokenPayload }> {
  const user = await authenticateRequest(request, env);

  if (!user) {
    return {
      authenticated: false,
      error: new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required. Please log in.'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    };
  }

  return {
    authenticated: true,
    user
  };
}

/**
 * Require email verification middleware
 * Returns 403 error if email not verified
 */
export async function requireEmailVerified(
  request: Request,
  env: Env
): Promise<{ authenticated: false; error: Response } | { authenticated: true; user: AccessTokenPayload }> {
  const authResult = await requireAuth(request, env);

  if (!authResult.authenticated) {
    return authResult;
  }

  if (!authResult.user.emailVerified) {
    return {
      authenticated: false,
      error: new Response(JSON.stringify({
        error: 'Email not verified',
        message: 'Please verify your email address to access this feature.'
      }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    };
  }

  return authResult;
}

/**
 * Optional authentication middleware
 * Returns user payload if authenticated, null if not
 * Never returns an error - use this for endpoints that work for both auth and no-auth users
 */
export async function optionalAuth(
  request: Request,
  env: Env
): Promise<AccessTokenPayload | null> {
  return await authenticateRequest(request, env);
}
