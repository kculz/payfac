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
  BadRequestError,
  UnauthorizedError,
  ValidationError,
  InternalServerError,
  fromPrismaError,
  fromJoiError
} = require('../utils/ApiError');
const config = require('../../config/environment.config');

/**
 * Safe error property access
 */
function safeGet(obj, path, defaultValue = null) {
  if (!obj) return defaultValue;
  
  const keys = path.split('.');
  let result = obj;
  
  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
  }
  
  return result === undefined ? defaultValue : result;
}

/**
 * Extract clean error information without verbose stack
 */
function getCleanErrorInfo(error, req) {
  const errorInfo = {
    message: safeGet(error, 'message', 'Unknown error occurred'),
    name: safeGet(error, 'name', 'Error'),
    code: safeGet(error, 'code'),
    statusCode: safeGet(error, 'statusCode', 500),
    path: safeGet(req, 'path', 'unknown'),
    method: safeGet(req, 'method', 'unknown'),
    userId: safeGet(req, 'user.id') || safeGet(req, 'userId'),
    timestamp: new Date().toISOString()
  };

  // Only include relevant stack information for server errors
  if (errorInfo.statusCode >= 500 && error.stack) {
    try {
      const stackLines = error.stack.split('\n').slice(0, 3);
      errorInfo.stackContext = stackLines.map(line => 
        line.trim().replace(process.cwd(), '')
      );
    } catch (stackError) {
      errorInfo.stackContext = ['Unable to parse stack trace'];
    }
  }

  return errorInfo;
}

/**
 * Format error response consistently
 */
function formatErrorForResponse(error, req, includeStack = false) {
  const baseResponse = {
    success: false,
    status: safeGet(error, 'status', 'error'),
    message: safeGet(error, 'message', 'An unexpected error occurred'),
    timestamp: safeGet(error, 'timestamp', new Date().toISOString())
  };

  // Add errors if they exist
  if (safeGet(error, 'errors')) {
    baseResponse.errors = error.errors;
  }

  // Add contextual info for client errors
  if (safeGet(error, 'statusCode', 500) >= 400 && safeGet(error, 'statusCode', 500) < 500) {
    baseResponse.context = {
      path: safeGet(req, 'path', 'unknown'),
      method: safeGet(req, 'method', 'unknown')
    };
  }

  // Include minimal stack context for server errors in development
  if (includeStack && safeGet(error, 'statusCode', 500) >= 500 && error.stack) {
    try {
      const relevantStack = error.stack.split('\n')
        .slice(0, 3)
        .map(line => line.trim().replace(process.cwd(), ''));
      baseResponse.stackContext = relevantStack;
    } catch (stackError) {
      baseResponse.stackContext = ['Unable to parse stack trace'];
    }
  }

  return baseResponse;
}

/**
 * Log error with appropriate level and clean format
 */
function logError(error, req) {
  try {
    const errorInfo = getCleanErrorInfo(error, req);
    
    const logData = {
      type: errorInfo.name,
      message: errorInfo.message,
      code: errorInfo.code,
      statusCode: errorInfo.statusCode,
      path: errorInfo.path,
      method: errorInfo.method,
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
  } catch (logError) {
    // Fallback logging if everything else fails
    logger.error('Error Handler Failure', {
      originalError: error?.message || 'Unknown error',
      logError: logError.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Ultra-safe error normalization
 */
function normalizeError(error) {
  // Handle null/undefined errors
  if (!error) {
    return new InternalServerError('Unknown error occurred');
  }

  // If it's already an ApiError, return as is
  if (error instanceof ApiError) {
    return error;
  }

  try {
    // Handle Prisma errors - with extra safety
    const code = safeGet(error, 'code');
    if (code && typeof code === 'string' && code.startsWith('P')) {
      try {
        return fromPrismaError(error);
      } catch (prismaError) {
        // If fromPrismaError fails, fall back to generic database error
        return new InternalServerError('Database operation failed');
      }
    }

    // Handle JWT errors
    const errorName = safeGet(error, 'name');
    if (errorName === 'JsonWebTokenError') {
      return new UnauthorizedError('Invalid authentication token');
    }
    
    if (errorName === 'TokenExpiredError') {
      return new UnauthorizedError('Authentication token expired');
    }

    // Handle validation errors (Joi)
    if (errorName === 'ValidationError' && safeGet(error, 'details')) {
      try {
        return fromJoiError(error);
      } catch (joiError) {
        return new ValidationError([], 'Validation failed');
      }
    }

    // Handle custom validation errors
    if (errorName === 'ValidationError' && Array.isArray(safeGet(error, 'errors'))) {
      return new ValidationError(error.errors);
    }

    // Handle multer file upload errors
    if (errorName === 'MulterError') {
      let message = 'File upload error';
      const multerCode = safeGet(error, 'code');
      
      if (multerCode === 'LIMIT_FILE_SIZE') {
        message = 'File size exceeds maximum allowed';
      } else if (multerCode === 'LIMIT_FILE_COUNT') {
        message = 'Too many files uploaded';
      } else if (multerCode === 'LIMIT_UNEXPECTED_FILE') {
        message = 'Unexpected file field';
      }
      
      return new BadRequestError(message);
    }

    // Handle MongoDB errors
    if (errorName === 'MongoError' || errorName === 'MongoServerError') {
      const mongoCode = safeGet(error, 'code');
      if (mongoCode === 11000) {
        const field = Object.keys(safeGet(error, 'keyValue', {}))[0] || 'field';
        return new BadRequestError(`${field} already exists`);
      }
      return new InternalServerError('Database operation failed');
    }

    // Handle CastError (Mongoose ObjectId errors)
    if (errorName === 'CastError') {
      return new BadRequestError('Invalid ID format');
    }

    // Convert to InternalServerError for unknown errors
    const message = config.app.isProduction 
      ? 'An unexpected error occurred' 
      : safeGet(error, 'message', 'Unknown error occurred');
    
    return new InternalServerError(message );

  } catch (normalizationError) {
    // Ultimate fallback - if normalization fails completely
    return new InternalServerError(
      config.app.isProduction 
        ? 'An unexpected error occurred' 
        : `Error normalization failed: ${normalizationError.message}`
    );
  }
}

/**
 * Main error handler middleware
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  try {
    // Normalize the error (convert to ApiError if needed)
    const error = normalizeError(err);

    // Log the error (clean format)
    logError(error, req);

    // Determine if we should include stack in response
    const includeStack = config.app.isDevelopment && safeGet(error, 'statusCode', 500) >= 500;

    // Format and send error response
    const response = formatErrorForResponse(error, req, includeStack);
    
    // Ensure we have a valid status code
    const statusCode = safeGet(error, 'statusCode', 500);
    res.status(statusCode).json(response);
    
  } catch (handlerError) {
    // Ultimate fallback - if the error handler itself fails
    logger.error('CRITICAL: Error handler failed', {
      originalError: err?.message || 'Unknown',
      handlerError: handlerError.message,
      timestamp: new Date().toISOString()
    });

    // Send minimal safe response
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Clean 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${safeGet(req, 'method', 'unknown')} ${safeGet(req, 'path', 'unknown')} not found`);
  error.code = 'ROUTE_NOT_FOUND';
  next(error);
}

/**
 * Optimized async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      Promise.resolve(fn(req, res, next)).catch(next);
    } catch (syncError) {
      next(syncError);
    }
  };
}

/**
 * Production-optimized error handler (minimal info)
 */
function productionErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  try {
    const error = normalizeError(err);
    const statusCode = safeGet(error, 'statusCode', 500);
    const isClientError = statusCode >= 400 && statusCode < 500;

    // Log with minimal info in production
    if (statusCode >= 500) {
      logger.error('Production Server Error', {
        message: safeGet(error, 'message', 'Unknown error'),
        code: safeGet(error, 'code'),
        path: safeGet(req, 'path', 'unknown'),
        method: safeGet(req, 'method', 'unknown'),
        statusCode: statusCode
      });
    }

    // Client response - minimal information
    const response = {
      success: false,
      status: safeGet(error, 'status', 'error'),
      message: isClientError ? safeGet(error, 'message', 'Bad request') : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    };

    // Only include path for client errors
    if (isClientError) {
      response.context = { path: safeGet(req, 'path', 'unknown') };
    }

    // Include validation errors if they exist
    if (isClientError && safeGet(error, 'errors')) {
      response.errors = error.errors;
    }

    res.status(statusCode).json(response);
  } catch (fallbackError) {
    // Ultimate production fallback
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Development error handler (slightly more info but still clean)
 */
function developmentErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  try {
    const error = normalizeError(err);
    const statusCode = safeGet(error, 'statusCode', 500);

    // Log with development context
    const logInfo = {
      message: safeGet(error, 'message', 'Unknown error'),
      name: safeGet(error, 'name', 'Error'),
      code: safeGet(error, 'code'),
      statusCode: statusCode,
      path: safeGet(req, 'path', 'unknown'),
      method: safeGet(req, 'method', 'unknown')
    };

    // Include minimal stack context for server errors
    if (statusCode >= 500 && error.stack) {
      try {
        const stackLines = error.stack.split('\n').slice(0, 3);
        logInfo.stackContext = stackLines.map(line => line.trim());
      } catch (stackError) {
        logInfo.stackContext = ['Unable to parse stack'];
      }
    }

    if (statusCode >= 500) {
      logger.error('Development Server Error', logInfo);
    } else {
      logger.warn('Development Client Error', logInfo);
    }

    // Development response
    const response = {
      success: false,
      status: safeGet(error, 'status', 'error'),
      message: safeGet(error, 'message', 'Unknown error occurred'),
      code: safeGet(error, 'code', 'INTERNAL_ERROR'),
      timestamp: new Date().toISOString(),
      context: {
        path: safeGet(req, 'path', 'unknown'),
        method: safeGet(req, 'method', 'unknown')
      }
    };

    // Include validation errors
    if (safeGet(error, 'errors')) {
      response.errors = error.errors;
    }

    // Include minimal stack for server errors in development
    if (statusCode >= 500 && error.stack) {
      try {
        const relevantStack = error.stack.split('\n')
          .slice(0, 3)
          .map(line => line.trim().replace(process.cwd(), ''));
        response.stackContext = relevantStack;
      } catch (stackError) {
        response.stackContext = ['Unable to parse stack trace'];
      }
    }

    res.status(statusCode).json(response);
  } catch (fallbackError) {
    // Development fallback
    res.status(500).json({
      success: false,
      status: 'error',
      message: `Error handler failed: ${fallbackError.message}`,
      timestamp: new Date().toISOString(),
      context: {
        path: safeGet(req, 'path', 'unknown'),
        method: safeGet(req, 'method', 'unknown')
      }
    });
  }
}

/**
 * Route validation error handler
 */
function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    try {
      const { error } = schema.validate(safeGet(req, property, {}), { 
        abortEarly: false, 
        stripUnknown: true 
      });

      if (error) {
        return next(fromJoiError(error));
      }

      next();
    } catch (validationError) {
      next(new BadRequestError('Request validation failed'));
    }
  };
}

/**
 * Error handler for specific routes
 */
function routeErrorHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
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
  routeErrorHandler
};