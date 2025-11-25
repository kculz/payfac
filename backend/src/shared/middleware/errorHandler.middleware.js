/**
 * Optimized Error Handler Middleware
 * 
 * Clean, formatted error handling that works with existing ApiError classes
 * No verbose stack traces, only essential information
 * 
 * Location: src/shared/middleware/errorHandler.js
 */

const logger = require('../utils/logger');
const { 
  ApiError, 
  NotFoundError,
  InternalServerError,
  isOperationalError,
  formatErrorResponse 
} = require('../utils/ApiError');
const config = require('../../config/environment.config');

/**
 * Extract clean error information without verbose stack
 */
function getCleanErrorInfo(error, req) {
  const errorInfo = {
    message: error.message,
    name: error.name,
    code: error.code,
    statusCode: error.statusCode || 500,
    path: req.path,
    method: req.method,
    userId: req.user?.id || req.userId,
    timestamp: new Date().toISOString()
  };

  // Only include relevant stack information for server errors
  if (errorInfo.statusCode >= 500 && error.stack) {
    // Get just the first 2 lines of stack for context
    const stackLines = error.stack.split('\n').slice(0, 3);
    errorInfo.stackContext = stackLines.map(line => 
      line.trim().replace(process.cwd(), '')
    );
  }

  return errorInfo;
}

/**
 * Format error response consistently
 */
function formatErrorForResponse(error, req, includeStack = false) {
  const baseResponse = {
    success: false,
    status: error.status || 'error',
    message: error.message,
    ...(error.errors && { errors: error.errors }),
    timestamp: error.timestamp || new Date().toISOString()
  };

  // Add contextual info for client errors
  if (error.statusCode >= 400 && error.statusCode < 500) {
    baseResponse.context = {
      path: req.path,
      method: req.method
    };
  }

  // Include minimal stack context for server errors in development
  if (includeStack && error.statusCode >= 500 && error.stack) {
    const relevantStack = error.stack.split('\n')
      .slice(0, 3)
      .map(line => line.trim().replace(process.cwd(), ''));
    baseResponse.stackContext = relevantStack;
  }

  return baseResponse;
}

/**
 * Log error with appropriate level and clean format
 */
function logError(error, req) {
  const errorInfo = getCleanErrorInfo(error, req);
  
  const logData = {
    type: error.name,
    message: error.message,
    code: error.code,
    statusCode: errorInfo.statusCode,
    path: req.path,
    method: req.method,
    userId: errorInfo.userId,
    timestamp: errorInfo.timestamp
  };

  // Add minimal stack context for server errors only
  if (errorInfo.statusCode >= 500 && errorInfo.stackContext) {
    logData.stackContext = errorInfo.stackContext;
  }

  // Log with appropriate level
  if (errorInfo.statusCode >= 500) {
    logger.error('Server Error', logData);
  } else if (errorInfo.statusCode === 404) {
    logger.warn('Route Not Found', logData);
  } else {
    logger.warn('Client Error', logData);
  }
}

/**
 * Handle common error types and convert to ApiError
 */
function normalizeError(error) {
  // If it's already an ApiError, return as is
  if (error instanceof ApiError) {
    return error;
  }

  // Handle Prisma errors
  if (error.code && error.code.startsWith('P')) {
    const { fromPrismaError } = require('../utils/ApiError');
    return fromPrismaError(error);
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    const { UnauthorizedError } = require('../utils/ApiError');
    return new UnauthorizedError('Authentication failed');
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    const { ValidationError } = require('../utils/ApiError');
    return new ValidationError(error.details || error.errors, 'Validation failed');
  }

  // Handle multer file upload errors
  if (error.name === 'MulterError') {
    const { BadRequestError } = require('../utils/ApiError');
    let message = 'File upload error';
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds maximum allowed';
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
    
    return new BadRequestError(message);
  }

  // Convert to InternalServerError for unknown errors
  const message = config.app.isProduction 
    ? 'An unexpected error occurred' 
    : error.message;
  
  return new InternalServerError(message, false);
}

/**
 * Main error handler middleware
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Normalize the error (convert to ApiError if needed)
  const error = normalizeError(err);

  // Log the error (clean format)
  logError(error, req);

  // Determine if we should include stack in response
  const includeStack = config.app.isDevelopment && error.statusCode >= 500;

  // Format and send error response
  const response = formatErrorForResponse(error, req, includeStack);
  res.status(error.statusCode).json(response);
}

/**
 * Clean 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
}

/**
 * Optimized async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Production-optimized error handler (minimal info)
 */
function productionErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const error = normalizeError(err);
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  // Log with minimal info in production
  if (statusCode >= 500) {
    logger.error('Production Server Error', {
      message: error.message,
      code: error.code,
      path: req.path,
      method: req.method,
      statusCode: statusCode
    });
  }

  // Client response - minimal information
  const response = {
    success: false,
    status: error.status || 'error',
    message: isClientError ? error.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  };

  // Only include path for client errors
  if (isClientError) {
    response.context = { path: req.path };
  }

  // Include validation errors if they exist
  if (isClientError && error.errors) {
    response.errors = error.errors;
  }

  res.status(statusCode).json(response);
}

/**
 * Development error handler (slightly more info but still clean)
 */
function developmentErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const error = normalizeError(err);
  const statusCode = error.statusCode || 500;

  // Log with development context
  const logInfo = {
    message: error.message,
    name: error.name,
    code: error.code,
    statusCode: statusCode,
    path: req.path,
    method: req.method
  };

  // Include minimal stack context for server errors
  if (statusCode >= 500 && error.stack) {
    const stackLines = error.stack.split('\n').slice(0, 3);
    logInfo.stackContext = stackLines.map(line => line.trim());
  }

  if (statusCode >= 500) {
    logger.error('Development Server Error', logInfo);
  } else {
    logger.warn('Development Client Error', logInfo);
  }

  // Development response
  const response = {
    success: false,
    status: error.status || 'error',
    message: error.message,
    code: error.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    context: {
      path: req.path,
      method: req.method
    }
  };

  // Include validation errors
  if (error.errors) {
    response.errors = error.errors;
  }

  // Include minimal stack for server errors in development
  if (statusCode >= 500 && error.stack) {
    const relevantStack = error.stack.split('\n')
      .slice(0, 3)
      .map(line => line.trim().replace(process.cwd(), ''));
    response.stackContext = relevantStack;
  }

  res.status(statusCode).json(response);
}

/**
 * Route validation error handler
 * Use this in routes to handle validation errors cleanly
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { 
      abortEarly: false, 
      stripUnknown: true 
    });

    if (error) {
      const { ValidationError } = require('../utils/ApiError');
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        type: detail.type
      }));

      return next(new ValidationError(validationErrors));
    }

    next();
  };
}

/**
 * Error handler for specific routes
 * Use this to wrap route handlers and handle errors consistently
 */
function routeErrorHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Convert to ApiError and pass to error handler
      const normalizedError = normalizeError(error);
      next(normalizedError);
    }
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  productionErrorHandler,
  developmentErrorHandler,
  validateRequest,
  routeErrorHandler,
  
  // Export helper functions for testing
  normalizeError,
  formatErrorForResponse,
  getCleanErrorInfo
};