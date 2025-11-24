/**
 * Authentication Middleware
 * 
 * Handles JWT authentication, token verification, and role-based access control.
 * Protects routes and validates user permissions.
 * 
 * Location: src/shared/middleware/auth.js
 */

const jwt = require('jsonwebtoken');
const config = require('../../config/environment.config');
const userRepository = require('../../../database/repositories/user.repository');
const logger = require('../utils/logger');
const {
  UnauthorizedError,
  ForbiddenError,
  AccountSuspendedError
} = require('../utils/ApiError');

/**
 * Verify JWT token and extract payload
 * @param {string} token - JWT token
 * @param {string} secret - JWT secret
 * @returns {Object} Decoded token payload
 * @throws {UnauthorizedError} If token is invalid
 */
function verifyToken(token, secret) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Invalid token');
    }
    throw new UnauthorizedError('Token verification failed');
  }
}

/**
 * Extract token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} JWT token or null
 */
function extractToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader) {
    return null;
  }

  // Support both "Bearer TOKEN" and just "TOKEN"
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Main authentication middleware
 * Verifies JWT token and attaches user to request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from header
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    // Verify token
    const decoded = verifyToken(token, config.jwt.secret);

    // Get user from database
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check if user account is suspended
    if (user.status === 'SUSPENDED') {
      logger.security('Suspended user attempted access', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      throw new AccountSuspendedError('Your account has been suspended');
    }

    // Check if user account is deactivated
    if (user.status === 'DEACTIVATED') {
      throw new UnauthorizedError('Your account has been deactivated');
    }

    // Check if account is locked
    const lockStatus = await userRepository.isAccountLocked(user.id);
    if (lockStatus.locked) {
      throw new UnauthorizedError(
        `Account is locked. Please try again in ${lockStatus.remainingMinutes} minutes`
      );
    }

    // Attach user to request (without sensitive data)
    req.user = userRepository.sanitizeUser(user);
    req.userId = user.id;
    req.userRole = user.role;

    // Attach token to request for potential refresh
    req.token = token;

    next();
  } catch (error) {
    // Log authentication failures
    logger.security('Authentication failed', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      path: req.path
    });

    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token, config.jwt.secret);
      const user = await userRepository.findById(decoded.userId);

      if (user && user.status === 'ACTIVE') {
        req.user = userRepository.sanitizeUser(user);
        req.userId = user.id;
        req.userRole = user.role;
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
}

/**
 * Role-based access control middleware
 * Requires specific role(s) to access route
 * 
 * @param {...string} allowedRoles - Allowed roles (SELLER, ADMIN)
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/admin/users', authenticate, requireRole('ADMIN'), controller.getUsers);
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!allowedRoles.includes(req.userRole)) {
      logger.security('Unauthorized role access attempt', {
        userId: req.userId,
        userRole: req.userRole,
        requiredRoles: allowedRoles,
        path: req.path,
        ip: req.ip
      });

      return next(
        new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
}

/**
 * Admin-only access middleware
 * Shorthand for requireRole('ADMIN')
 */
const requireAdmin = requireRole('ADMIN');

/**
 * Seller-only access middleware
 * Shorthand for requireRole('SELLER')
 */
const requireSeller = requireRole('SELLER');

/**
 * Check if user owns the resource
 * Prevents users from accessing other users' data
 * 
 * @param {string} paramName - Parameter name containing user ID (default: 'userId')
 * @returns {Function} Middleware function
 * 
 * @example
 * router.get('/users/:userId/transactions', authenticate, requireOwnership('userId'), controller.getTransactions);
 */
function requireOwnership(paramName = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const resourceUserId = req.params[paramName];

    // Admins can access any resource
    if (req.userRole === 'ADMIN') {
      return next();
    }

    // Check if user owns the resource
    if (req.userId !== resourceUserId) {
      logger.security('Unauthorized resource access attempt', {
        userId: req.userId,
        attemptedAccess: resourceUserId,
        path: req.path,
        ip: req.ip
      });

      return next(new ForbiddenError('You do not have permission to access this resource'));
    }

    next();
  };
}

/**
 * Check if user owns the resource or is admin
 * @param {string} paramName - Parameter name containing user ID
 * @returns {Function} Middleware function
 */
function requireOwnershipOrAdmin(paramName = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const resourceUserId = req.params[paramName];

    // Allow if admin or owner
    if (req.userRole === 'ADMIN' || req.userId === resourceUserId) {
      return next();
    }

    logger.security('Unauthorized resource access attempt', {
      userId: req.userId,
      attemptedAccess: resourceUserId,
      path: req.path,
      ip: req.ip
    });

    return next(new ForbiddenError('You do not have permission to access this resource'));
  };
}

/**
 * Verify email is confirmed
 * Some routes might require email verification
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function requireEmailVerification(req, res, next) {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }

  if (!req.user.email_verified) {
    return next(
      new ForbiddenError('Email verification required. Please verify your email to continue.')
    );
  }

  next();
}

/**
 * Verify refresh token
 * Used for token refresh endpoints
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function verifyRefreshToken(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, config.jwt.refreshSecret);

    // Check if refresh token exists in database
    const tokenRecord = await userRepository.model.refreshToken.findUnique({
      where: { token: refreshToken }
    });

    if (!tokenRecord) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Check if token is revoked
    if (tokenRecord.revoked_at) {
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    // Check if token is expired
    if (new Date() > tokenRecord.expires_at) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    // Get user
    const user = await userRepository.findById(decoded.userId);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Attach user and token info to request
    req.user = userRepository.sanitizeUser(user);
    req.userId = user.id;
    req.refreshToken = refreshToken;
    req.tokenRecord = tokenRecord;

    next();
  } catch (error) {
    logger.security('Refresh token verification failed', {
      error: error.message,
      ip: req.ip
    });

    next(error);
  }
}

/**
 * Rate limit authentication attempts per IP
 * Prevents brute force attacks
 * 
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Middleware function
 */
function rateLimitAuth(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const attempts = new Map();

  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(ip);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!attempts.has(ip)) {
      attempts.set(ip, {
        count: 1,
        firstAttempt: now
      });
      return next();
    }

    const data = attempts.get(ip);

    // Reset if window has passed
    if (now - data.firstAttempt > windowMs) {
      attempts.set(ip, {
        count: 1,
        firstAttempt: now
      });
      return next();
    }

    // Increment attempts
    data.count++;

    // Block if exceeded
    if (data.count > maxAttempts) {
      const remainingTime = Math.ceil((windowMs - (now - data.firstAttempt)) / 1000 / 60);

      logger.security('Rate limit exceeded for authentication', {
        ip,
        attempts: data.count,
        path: req.path
      });

      return next(
        new UnauthorizedError(
          `Too many authentication attempts. Please try again in ${remainingTime} minutes`
        )
      );
    }

    next();
  };
}

/**
 * Generate JWT access token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }
  );
}

/**
 * Generate JWT refresh token
 * @param {Object} user - User object
 * @returns {Object} Refresh token and expiry
 */
function generateRefreshToken(user) {
  const token = jwt.sign(
    {
      userId: user.id,
      type: 'refresh'
    },
    config.jwt.refreshSecret,
    {
      expiresIn: config.jwt.refreshExpiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }
  );

  // Calculate expiry date
  const expiresIn = config.jwt.refreshExpiresIn;
  const expiryMs = expiresIn.endsWith('d')
    ? parseInt(expiresIn) * 24 * 60 * 60 * 1000
    : parseInt(expiresIn) * 1000;

  const expiresAt = new Date(Date.now() + expiryMs);

  return { token, expiresAt };
}

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Promise<Object>} Tokens object
 */
async function generateTokens(user) {
  const accessToken = generateAccessToken(user);
  const { token: refreshToken, expiresAt } = generateRefreshToken(user);

  // Store refresh token in database
  await userRepository.model.refreshToken.create({
    data: {
      user_id: user.id,
      token: refreshToken,
      expires_at: expiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn
  };
}

/**
 * Revoke refresh token
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<void>}
 */
async function revokeRefreshToken(token) {
  await userRepository.model.refreshToken.updateMany({
    where: { token },
    data: { revoked_at: new Date() }
  });

  logger.info('Refresh token revoked', { token: token.substring(0, 20) + '...' });
}

/**
 * Revoke all refresh tokens for a user
 * Useful for logout all devices
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function revokeAllUserTokens(userId) {
  const result = await userRepository.model.refreshToken.updateMany({
    where: {
      user_id: userId,
      revoked_at: null
    },
    data: { revoked_at: new Date() }
  });

  logger.info('All user tokens revoked', { userId, count: result.count });
}

module.exports = {
  // Middleware
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireAdmin,
  requireSeller,
  requireOwnership,
  requireOwnershipOrAdmin,
  requireEmailVerification,
  verifyRefreshToken,
  rateLimitAuth,

  // Token utilities
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  revokeRefreshToken,
  revokeAllUserTokens,
  verifyToken,
  extractToken
};