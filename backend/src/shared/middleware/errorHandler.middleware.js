/**
 * Error Handler Middleware
 * 
 * Global error handling middleware for Express.
 * Catches all errors and returns standardized responses.
 * 
 * Location: src/shared/middleware/errorHandler.js
 */

const logger = require('../utils/logger');
const {
  ApiError,
  isOperationalError,
  fromPrismaError,
  formatErrorResponse
} = require('../utils/ApiError');
const config = require('../../config/environment.config');

/**
 * Handle Prisma errors
 * @param {Error} error - Prisma error
 * @returns {ApiError} Formatted API error
 */
function handlePrismaError(error) {
  // Check if it's a Prisma error
  if (error.code && error.code.startsWith('P')) {
    return fromPrismaError(error);
  }
  return null;
}

/**
 * Handle JWT errors
 * @param {Error} error - JWT error
 * @returns {ApiError|null} Formatted API error or null
 */
function handleJWTError(error) {
  if (error.name === 'JsonWebTokenError') {
    const { UnauthorizedError } = require('../utils/ApiError');
    return new UnauthorizedError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    const { UnauthorizedError } = require('../utils/ApiError');
    return new UnauthorizedError('Token has expired');
  }
  return null;
}

/**
 * Handle Multer (file upload) errors
 * @param {Error} error - Multer error
 * @returns {ApiError|null} Formatted API error or null
 */
function handleMulterError(error) {
  if (error.name === 'MulterError') {
    const { BadRequestError } = require('../utils/ApiError');
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new BadRequestError('File size exceeds maximum allowed size');
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return new BadRequestError('Too many files uploaded');
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new BadRequestError('Unexpected file field');
    }
    
    return new BadRequestError(`File upload error: ${error.message}`);
  }
  return null;
}

/**
 * Handle validation errors
 * @param {Error} error - Validation error
 * @returns {ApiError|null} Formatted API error or null
 */
function handleValidationError(error) {
  if (error.name === 'ValidationError' && error.errors) {
    const { ValidationError } = require('../utils/ApiError');
    return new ValidationError(error.errors, error.message);
  }
  return null;
}

/**
 * Log error based on severity
 * @param {Error} error - Error to log
 * @param {Object} req - Express request object
 */
function logError(error, req) {
  const errorInfo = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
    userAgent: req.get('user-agent'),
    body: logger.sanitize(req.body),
    query: req.query,
    params: req.params
  };

  // Determine log level based on error type
  if (error.statusCode >= 500) {
    logger.error('Server error occurred', errorInfo);
  } else if (error.statusCode >= 400) {
    logger.warn('Client error occurred', errorInfo);
  } else {
    logger.error('Unexpected error occurred', errorInfo);
  }
}

/**
 * Send error response to client
 * @param {Error} error - Error object
 * @param {Object} res - Express response object
 */
function sendErrorResponse(error, res) {
  const statusCode = error.statusCode || 500;
  const response = formatErrorResponse(error);

  // In production, don't send stack traces
  if (config.app.isProduction) {
    delete response.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  let error = err;

  // Convert known error types to ApiError
  if (!(error instanceof ApiError)) {
    // Try to handle specific error types
    error = 
      handlePrismaError(err) ||
      handleJWTError(err) ||
      handleMulterError(err) ||
      handleValidationError(err);

    // If still not an ApiError, create a generic one
    if (!error) {
      const { InternalServerError } = require('../utils/ApiError');
      error = new InternalServerError(
        config.app.isProduction 
          ? 'An unexpected error occurred' 
          : err.message
      );
      error.stack = err.stack;
    }
  }

  // Log the error
  logError(error, req);

  // Send error response
  sendErrorResponse(error, res);
}

/**
 * 404 Not Found handler
 * Handles routes that don't exist
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function notFoundHandler(req, res, next) {
  const { NotFoundError } = require('../utils/ApiError');
  
  const error = new NotFoundError('Route');
  error.message = `Route ${req.method} ${req.path} not found`;
  
  next(error);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getUsers();
 *   res.json(users);
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString()
  });

  // In production, exit the process
  if (config.app.isProduction) {
    logger.error('Shutting down due to unhandled rejection');
    process.exit(1);
  }
});

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  // Always exit on uncaught exception
  logger.error('Shutting down due to uncaught exception');
  process.exit(1);
});

/**
 * Handle SIGTERM signal (graceful shutdown)
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  
  // Perform cleanup
  // Close database connections, etc.
  
  process.exit(0);
});

/**
 * Handle SIGINT signal (Ctrl+C)
 */
process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  
  // Perform cleanup
  
  process.exit(0);
});

/**
 * Error response formatter for specific error types
 */
const errorFormatters = {
  /**
   * Format database errors
   */
  database: (error) => {
    return {
      type: 'database_error',
      message: config.app.isProduction 
        ? 'A database error occurred' 
        : error.message,
      ...(config.app.isDevelopment && { details: error.meta })
    };
  },

  /**
   * Format authentication errors
   */
  authentication: (error) => {
    return {
      type: 'authentication_error',
      message: error.message,
      hint: 'Please check your credentials and try again'
    };
  },

  /**
   * Format authorization errors
   */
  authorization: (error) => {
    return {
      type: 'authorization_error',
      message: error.message,
      hint: 'You do not have permission to access this resource'
    };
  },

  /**
   * Format validation errors
   */
  validation: (error) => {
    return {
      type: 'validation_error',
      message: error.message,
      errors: error.errors
    };
  },

  /**
   * Format payment errors
   */
  payment: (error) => {
    return {
      type: 'payment_error',
      message: error.message,
      ...(error.gatewayError && { gateway: error.gatewayError })
    };
  }
};

/**
 * Create custom error middleware
 * @param {Function} handler - Custom error handler function
 * @returns {Function} Express middleware
 */
function customErrorHandler(handler) {
  return (err, req, res, next) => {
    try {
      handler(err, req, res, next);
    } catch (handlerError) {
      // If custom handler fails, use default
      errorHandler(err, req, res, next);
    }
  };
}

/**
 * Development error handler (more verbose)
 */
function developmentErrorHandler(err, req, res, next) {
  const error = err instanceof ApiError ? err : new ApiError(
    500,
    err.message,
    null,
    false
  );

  logError(error, req);

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    errors: error.errors,
    stack: error.stack,
    request: {
      method: req.method,
      path: req.path,
      body: logger.sanitize(req.body),
      query: req.query,
      params: req.params
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Production error handler (minimal information)
 */
function productionErrorHandler(err, req, res, next) {
  const error = err instanceof ApiError ? err : new ApiError(
    500,
    'An unexpected error occurred',
    null,
    false
  );

  logError(error, req);

  // Only send operational errors to client
  if (isOperationalError(error)) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors,
      timestamp: new Date().toISOString()
    });
  } else {
    // For programming errors, send generic message
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  developmentErrorHandler,
  productionErrorHandler,
  customErrorHandler,
  errorFormatters,
  
  // Export handlers for specific error types
  handlePrismaError,
  handleJWTError,
  handleMulterError,
  handleValidationError
};