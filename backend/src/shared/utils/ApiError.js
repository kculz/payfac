/**
 * Custom API Error Classes
 * 
 * Standardized error classes for consistent error handling across the application.
 * Provides different error types with appropriate HTTP status codes.
 * 
 * Location: src/shared/utils/ApiError.js
 */

/**
 * Base API Error Class
 * All custom errors inherit from this class
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Error message
   * @param {Array|Object} errors - Additional error details (validation errors, etc.)
   * @param {boolean} isOperational - Whether this is an operational error (true) or programming error (false)
   */
  constructor(statusCode, message, errors = null, isOperational = true) {
    super(message);
    
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      status: this.status,
      message: this.message,
      errors: this.errors,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}

/**
 * 400 Bad Request Error
 * Used when the client sends invalid data
 */
class BadRequestError extends ApiError {
  constructor(message = 'Bad request', errors = null) {
    super(400, message, errors);
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized Error
 * Used when authentication is required or has failed
 */
class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized - Authentication required') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden Error
 * Used when user is authenticated but doesn't have permission
 */
class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden - Insufficient permissions') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 Not Found Error
 * Used when a requested resource doesn't exist
 */
class NotFoundError extends ApiError {
  constructor(resource = 'Resource', message = null) {
    super(404, message || `${resource} not found`);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * 409 Conflict Error
 * Used when there's a conflict with the current state (e.g., duplicate resource)
 */
class ConflictError extends ApiError {
  constructor(message = 'Resource already exists') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

/**
 * 422 Unprocessable Entity Error
 * Used when validation fails
 */
class ValidationError extends ApiError {
  constructor(errors, message = 'Validation failed') {
    super(422, message, errors);
    this.name = 'ValidationError';
  }
}

/**
 * 429 Too Many Requests Error
 * Used when rate limiting is triggered
 */
class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests, please try again later', retryAfter = null) {
    super(429, message);
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 500 Internal Server Error
 * Used for unexpected server errors
 */
class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', isOperational = false) {
    super(500, message, null, isOperational);
    this.name = 'InternalServerError';
  }
}

/**
 * 503 Service Unavailable Error
 * Used when a service (database, payment gateway, etc.) is unavailable
 */
class ServiceUnavailableError extends ApiError {
  constructor(service = 'Service', message = null) {
    super(503, message || `${service} is currently unavailable`);
    this.name = 'ServiceUnavailableError';
    this.service = service;
  }
}

/**
 * Custom Domain-Specific Errors
 */

/**
 * Insufficient Balance Error
 * Used when user doesn't have enough balance for a transaction
 */
class InsufficientBalanceError extends ApiError {
  constructor(required, available) {
    super(
      400,
      `Insufficient balance. Required: $${required.toFixed(2)}, Available: $${available.toFixed(2)}`
    );
    this.name = 'InsufficientBalanceError';
    this.required = required;
    this.available = available;
  }
}

/**
 * Payment Failed Error
 * Used when payment processing fails
 */
class PaymentFailedError extends ApiError {
  constructor(message = 'Payment processing failed', gatewayError = null) {
    super(402, message, gatewayError ? [{ gateway: gatewayError }] : null);
    this.name = 'PaymentFailedError';
    this.gatewayError = gatewayError;
  }
}

/**
 * Transaction Limit Exceeded Error
 * Used when transaction exceeds allowed limits
 */
class TransactionLimitError extends ApiError {
  constructor(limit, type = 'transaction') {
    super(400, `${type} limit exceeded. Maximum allowed: $${limit.toFixed(2)}`);
    this.name = 'TransactionLimitError';
    this.limit = limit;
    this.type = type;
  }
}

/**
 * Pool Account Error
 * Used when pool account operations fail
 */
class PoolAccountError extends ApiError {
  constructor(message = 'Pool account operation failed') {
    super(500, message);
    this.name = 'PoolAccountError';
  }
}

/**
 * Account Suspended Error
 * Used when trying to access a suspended account
 */
class AccountSuspendedError extends ApiError {
  constructor(reason = 'Your account has been suspended') {
    super(403, reason);
    this.name = 'AccountSuspendedError';
  }
}

/**
 * Database Error
 * Used when database operations fail
 */
class DatabaseError extends ApiError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(500, message, null, true);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * Helper function to check if error is operational
 * @param {Error} error - Error to check
 * @returns {boolean}
 */
function isOperationalError(error) {
  if (error instanceof ApiError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Helper function to create error from Joi validation error
 * @param {Object} joiError - Joi validation error object
 * @returns {ValidationError}
 */
function fromJoiError(joiError) {
  const errors = joiError.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type
  }));
  
  return new ValidationError(errors);
}

/**
 * Helper function to create error from Prisma error
 * @param {Object} prismaError - Prisma error object
 * @returns {ApiError}
 */
function fromPrismaError(prismaError) {
  // Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference
  
  switch (prismaError.code) {
    case 'P2002': // Unique constraint violation
      const field = prismaError.meta?.target?.[0] || 'field';
      return new ConflictError(`${field} already exists`);
      
    case 'P2025': // Record not found
      return new NotFoundError('Record');
      
    case 'P2003': // Foreign key constraint violation
      return new BadRequestError('Invalid reference to related record');
      
    case 'P2014': // Relation violation
      return new BadRequestError('Cannot delete record due to related records');
      
    default:
      return new DatabaseError(
        'Database operation failed',
        prismaError.message
      );
  }
}

/**
 * Helper function to create standardized error response
 * @param {Error} error - Error object
 * @returns {Object} Standardized error response
 */
function formatErrorResponse(error) {
  if (error instanceof ApiError) {
    return error.toJSON();
  }
  
  // Handle unknown errors
  return {
    success: false,
    status: 'error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : error.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };
}

module.exports = {
  // Base class
  ApiError,
  
  // HTTP errors
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  
  // Domain-specific errors
  InsufficientBalanceError,
  PaymentFailedError,
  TransactionLimitError,
  PoolAccountError,
  AccountSuspendedError,
  DatabaseError,
  
  // Helper functions
  isOperationalError,
  fromJoiError,
  fromPrismaError,
  formatErrorResponse
};