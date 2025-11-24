/**
 * Rate Limiter Middleware
 * 
 * Protects API endpoints from abuse by limiting request rates.
 * Uses in-memory storage for development, Redis for production.
 * 
 * Location: src/shared/middleware/rateLimiter.js
 */

const rateLimit = require('express-rate-limit');
const config = require('../../config/environment');
const logger = require('../utils/logger');
const { TooManyRequestsError } = require('../utils/ApiError');

/**
 * Create a rate limiter with custom options
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limiter middleware
 */
function createRateLimiter(options = {}) {
  const defaultOptions = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
    
    // Key generator - use IP and user ID if available
    keyGenerator: (req) => {
      const userId = req.user?.id || 'anonymous';
      const ip = req.ip || req.connection.remoteAddress;
      return `${ip}:${userId}`;
    },

    // Handler when limit is exceeded
    handler: (req, res, next, options) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.path,
        method: req.method
      });

      const error = new TooManyRequestsError(
        `Too many requests from this IP, please try again after ${Math.ceil(options.windowMs / 60000)} minutes`,
        Math.ceil(options.windowMs / 1000)
      );

      next(error);
    },

    // Skip function - can skip rate limiting for certain conditions
    skip: (req) => {
      // Skip rate limiting in test environment
      if (config.app.isTest) {
        return true;
      }

      // Could add whitelist IPs here
      return false;
    }
  };

  return rateLimit({
    ...defaultOptions,
    ...options
  });
}

/**
 * Strict rate limiter for sensitive endpoints (login, register)
 * 5 requests per 15 minutes
 */
const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many attempts from this IP, please try again after 15 minutes'
});

/**
 * Standard rate limiter for general API endpoints
 * 100 requests per 15 minutes
 */
const standardRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Flexible rate limiter for authenticated users
 * 200 requests per 15 minutes
 */
const authenticatedRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => {
    // Use user ID for authenticated requests
    return req.user?.id || req.ip;
  }
});

/**
 * Lenient rate limiter for read-only operations
 * 300 requests per 15 minutes
 */
const readOnlyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  skipSuccessfulRequests: true
});

/**
 * Heavy rate limiter for expensive operations
 * 10 requests per hour
 */
const heavyRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many requests for this operation, please try again later'
});

/**
 * Admin rate limiter - more lenient
 * 500 requests per 15 minutes
 */
const adminRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  skip: (req) => {
    // Skip for test environment
    if (config.app.isTest) return true;
    
    // Only apply to non-admin users
    return req.user?.role !== 'ADMIN';
  }
});

/**
 * Per-user rate limiter
 * Limits requests per user regardless of IP
 * @param {number} max - Maximum requests
 * @param {number} windowMs - Time window in milliseconds
 */
function perUserRateLimiter(max = 100, windowMs = 15 * 60 * 1000) {
  return createRateLimiter({
    windowMs,
    max,
    keyGenerator: (req) => {
      if (!req.user?.id) {
        return req.ip; // Fallback to IP for unauthenticated
      }
      return `user:${req.user.id}`;
    }
  });
}

/**
 * Sliding window rate limiter
 * More accurate than fixed window
 */
class SlidingWindowRateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // key -> array of timestamps
  }

  middleware() {
    return (req, res, next) => {
      const key = req.user?.id || req.ip;
      const now = Date.now();

      // Get existing requests for this key
      let userRequests = this.requests.get(key) || [];

      // Remove old requests outside the window
      userRequests = userRequests.filter(timestamp => now - timestamp < this.windowMs);

      // Check if limit exceeded
      if (userRequests.length >= this.maxRequests) {
        const oldestRequest = userRequests[0];
        const retryAfter = Math.ceil((this.windowMs - (now - oldestRequest)) / 1000);

        logger.warn('Sliding window rate limit exceeded', {
          key,
          requests: userRequests.length,
          maxRequests: this.maxRequests
        });

        return next(new TooManyRequestsError(
          'Rate limit exceeded, please try again later',
          retryAfter
        ));
      }

      // Add current request
      userRequests.push(now);
      this.requests.set(key, userRequests);

      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance
        this.cleanup(now);
      }

      next();
    };
  }

  cleanup(now) {
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

/**
 * Create sliding window rate limiter
 * @param {number} maxRequests - Maximum requests
 * @param {number} windowMs - Time window
 */
function createSlidingWindowLimiter(maxRequests, windowMs) {
  const limiter = new SlidingWindowRateLimiter(maxRequests, windowMs);
  return limiter.middleware();
}

/**
 * Dynamic rate limiter based on user tier/subscription
 */
function dynamicRateLimiter() {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    let max;
    if (userRole === 'ADMIN') {
      max = 500;
    } else if (userRole === 'SELLER') {
      max = 200;
    } else {
      max = 50; // Anonymous users
    }

    const limiter = createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max
    });

    limiter(req, res, next);
  };
}

/**
 * Burst rate limiter
 * Allows bursts but enforces average over time
 */
function burstRateLimiter(burstMax, sustainedMax, windowMs) {
  const burstLimiter = createRateLimiter({
    windowMs: 1000, // 1 second
    max: burstMax
  });

  const sustainedLimiter = createRateLimiter({
    windowMs,
    max: sustainedMax
  });

  return (req, res, next) => {
    burstLimiter(req, res, (err) => {
      if (err) return next(err);
      sustainedLimiter(req, res, next);
    });
  };
}

module.exports = {
  // Pre-configured limiters
  strictRateLimiter,
  standardRateLimiter,
  authenticatedRateLimiter,
  readOnlyRateLimiter,
  heavyRateLimiter,
  adminRateLimiter,

  // Factory functions
  createRateLimiter,
  perUserRateLimiter,
  createSlidingWindowLimiter,
  dynamicRateLimiter,
  burstRateLimiter
};