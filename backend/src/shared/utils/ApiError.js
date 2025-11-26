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
  if (!joiError || !joiError.details) {
    return new ValidationError([], 'Validation failed');
  }
  
  const errors = joiError.details.map(detail => ({
    field: detail.path?.join('.') || 'unknown',
    message: detail.message?.replace(/"/g, '') || 'Invalid value',
    type: detail.type || 'validation'
  }));
  
  return new ValidationError(errors);
}

/**
 * Helper function to create error from Prisma error
 * @param {Object} prismaError - Prisma error object
 * @returns {ApiError}
 */
function fromPrismaError(prismaError) {
  // Handle cases where prismaError might be null/undefined
  if (!prismaError) {
    return new DatabaseError('Unknown database error');
  }

  // Ensure we have a code property
  if (!prismaError.code) {
    return new DatabaseError(
      'Database operation failed', 
      prismaError.message || 'Unknown Prisma error'
    );
  }

  // Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference
  const meta = prismaError.meta || {};
  
  switch (prismaError.code) {
    case 'P2002': // Unique constraint violation
      const field = meta.target?.[0] || 'field';
      return new ConflictError(`${field} already exists`);
      
    case 'P2025': // Record not found
      const model = meta.modelName || 'Record';
      return new NotFoundError(model);
      
    case 'P2003': // Foreign key constraint violation
      return new BadRequestError('Invalid reference to related record');
      
    case 'P2014': // Relation violation
      return new BadRequestError('Cannot delete record due to related records');

    case 'P2000': // Value too long
      return new ValidationError([{
        field: meta.column_name || 'field',
        message: 'Value too long for column',
        type: 'string.max'
      }]);

    case 'P2001': // Record not found in where condition
      return new NotFoundError('Record');

    case 'P2004': // Constraint failed
      return new BadRequestError('Constraint failed');

    case 'P2005': // Invalid value
      return new ValidationError([{
        field: meta.field_name || 'field',
        message: 'Invalid value provided',
        type: 'validation'
      }]);

    case 'P2006': // Invalid value for field type
      return new ValidationError([{
        field: meta.field_name || 'field',
        message: 'Invalid value type for field',
        type: 'validation'
      }]);

    case 'P2007': // Data validation error
      return new ValidationError([{
        field: meta.field_name || 'field',
        message: 'Data validation error',
        type: 'validation'
      }]);

    case 'P2008': // Query parsing error
      return new BadRequestError('Invalid query parameters');

    case 'P2009': // Query validation error
      return new BadRequestError('Query validation failed');

    case 'P2010': // Raw query error
      return new DatabaseError('Database query failed');

    case 'P2011': // Null constraint violation
      return new ValidationError([{
        field: meta.constraint || 'field',
        message: 'This field cannot be null',
        type: 'any.required'
      }]);

    case 'P2012': // Missing required value
      return new ValidationError([{
        field: meta.path || 'field',
        message: 'This field is required',
        type: 'any.required'
      }]);

    case 'P2013': // Missing required argument
      return new BadRequestError('Missing required argument');

    case 'P2015': // Related record not found
      return new NotFoundError('Related record');

    case 'P2016': // Query interpretation error
      return new BadRequestError('Query interpretation error');

    case 'P2017': // Records not connected
      return new BadRequestError('Records are not connected');

    case 'P2018': // Required connected records not found
      return new NotFoundError('Required connected records');

    case 'P2019': // Input error
      return new BadRequestError('Input error');

    case 'P2020': // Value out of range
      return new ValidationError([{
        field: meta.field_name || 'field',
        message: 'Value out of range',
        type: 'number.range'
      }]);

    case 'P2021': // Table does not exist
      return new DatabaseError('Database table not found');

    case 'P2022': // Column does not exist
      return new DatabaseError('Database column not found');

    case 'P2023': // Inconsistent column data
      return new DatabaseError('Inconsistent column data');

    case 'P2024': // Connection timeout
      return new ServiceUnavailableError('Database');

    case 'P2026': // Database server error
      return new DatabaseError('Database server error');

    case 'P2027': // Multiple errors occurred
      return new DatabaseError('Multiple database errors occurred');

    case 'P2030': // Fulltext index not found
      return new DatabaseError('Search index not found');

    case 'P2031': // MongoDB replica set error
      return new DatabaseError('Database replication error');

    case 'P2033': // Number out of 64-bit range
      return new ValidationError([{
        field: meta.field_name || 'field',
        message: 'Number out of valid range',
        type: 'number.range'
      }]);

    case 'P2034': // Transaction failed
      return new DatabaseError('Database transaction failed');

    case 'P2035': // Assertion violation
      return new DatabaseError('Database assertion failed');

    case 'P2036': // External connector error
      return new ServiceUnavailableError('Database connector');

    case 'P2037': // Too many database connections
      return new ServiceUnavailableError('Database connections exhausted');

    default:
      // For unknown Prisma errors, provide a generic database error
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