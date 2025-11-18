/**
 * Response Utility
 * 
 * Standardized response formatters for consistent API responses.
 * Ensures all API responses follow the same structure.
 * 
 * Location: src/shared/utils/response.js
 */

/**
 * Success Response Format
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data (can be object, array, or primitive)
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} Express response
 * 
 * @example
 * successResponse(res, { user: {...} }, 'User created successfully', 201);
 */
function successResponse(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Error Response Format
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Array|Object} errors - Detailed errors (validation errors, etc.)
 * @returns {Object} Express response
 * 
 * @example
 * errorResponse(res, 'Validation failed', 422, [{ field: 'email', message: 'Invalid email' }]);
 */
function errorResponse(res, message, statusCode = 500, errors = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
}

/**
 * Paginated Response Format
 * 
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page number
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total number of items
 * @param {string} message - Success message
 * @returns {Object} Express response
 * 
 * @example
 * paginatedResponse(res, transactions, { page: 1, limit: 20, total: 150 }, 'Transactions retrieved');
 */
function paginatedResponse(res, data, pagination, message = 'Success') {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);
  
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      currentPage: page,
      itemsPerPage: limit,
      totalPages,
      totalItems: total,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Created Response Format
 * Specialized response for resource creation (201 status)
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Success message
 * @param {string} location - Resource location URL (optional)
 * @returns {Object} Express response
 * 
 * @example
 * createdResponse(res, { id: '123', name: 'John' }, 'User created', '/api/v1/users/123');
 */
function createdResponse(res, data, message = 'Resource created successfully', location = null) {
  if (location) {
    res.set('Location', location);
  }
  
  return successResponse(res, data, message, 201);
}

/**
 * No Content Response Format
 * Used for successful operations with no data to return (204 status)
 * 
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 * 
 * @example
 * noContentResponse(res); // Used for DELETE operations
 */
function noContentResponse(res) {
  return res.status(204).send();
}

/**
 * Accepted Response Format
 * Used for asynchronous operations that have been accepted (202 status)
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Response data (usually contains job/task ID)
 * @param {string} message - Acceptance message
 * @returns {Object} Express response
 * 
 * @example
 * acceptedResponse(res, { jobId: '456' }, 'Payout request accepted for processing');
 */
function acceptedResponse(res, data, message = 'Request accepted for processing') {
  return successResponse(res, data, message, 202);
}

/**
 * Partial Content Response Format
 * Used when only part of the content is returned (206 status)
 * 
 * @param {Object} res - Express response object
 * @param {*} data - Partial data
 * @param {Object} range - Range information
 * @param {string} message - Success message
 * @returns {Object} Express response
 */
function partialContentResponse(res, data, range, message = 'Partial content') {
  res.set('Content-Range', `items ${range.start}-${range.end}/${range.total}`);
  
  return res.status(206).json({
    success: true,
    message,
    data,
    range: {
      start: range.start,
      end: range.end,
      total: range.total
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Transaction Response Format
 * Specialized response for financial transactions
 * 
 * @param {Object} res - Express response object
 * @param {Object} transaction - Transaction object
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Express response
 * 
 * @example
 * transactionResponse(res, transaction, 'Transaction completed successfully');
 */
function transactionResponse(res, transaction, message = 'Transaction processed', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: {
      transaction: {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: parseFloat(transaction.amount),
        status: transaction.status,
        description: transaction.description,
        createdAt: transaction.created_at,
        completedAt: transaction.completed_at
      }
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Balance Response Format
 * Specialized response for balance queries
 * 
 * @param {Object} res - Express response object
 * @param {Object} balance - Balance object
 * @param {string} message - Success message
 * @returns {Object} Express response
 * 
 * @example
 * balanceResponse(res, { available_balance: 1000, pending_balance: 50 });
 */
function balanceResponse(res, balance, message = 'Balance retrieved successfully') {
  return res.status(200).json({
    success: true,
    message,
    data: {
      balance: {
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance),
        currency: balance.currency,
        lastUpdated: balance.updated_at
      }
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Stats Response Format
 * Specialized response for statistical data
 * 
 * @param {Object} res - Express response object
 * @param {Object} stats - Statistics object
 * @param {string} message - Success message
 * @param {Object} period - Time period for stats (optional)
 * @returns {Object} Express response
 * 
 * @example
 * statsResponse(res, { totalSales: 5000, count: 25 }, 'Stats retrieved', { start: '2024-01-01', end: '2024-01-31' });
 */
function statsResponse(res, stats, message = 'Statistics retrieved successfully', period = null) {
  const response = {
    success: true,
    message,
    data: { stats },
    timestamp: new Date().toISOString()
  };

  if (period) {
    response.data.period = period;
  }

  return res.status(200).json(response);
}

/**
 * Validation Error Response Format
 * Specialized response for validation errors
 * 
 * @param {Object} res - Express response object
 * @param {Array} errors - Array of validation errors
 * @returns {Object} Express response
 * 
 * @example
 * validationErrorResponse(res, [{ field: 'email', message: 'Invalid email format' }]);
 */
function validationErrorResponse(res, errors) {
  return res.status(422).json({
    success: false,
    message: 'Validation failed',
    errors: errors.map(error => ({
      field: error.field || error.path?.join('.'),
      message: error.message,
      value: error.value
    })),
    timestamp: new Date().toISOString()
  });
}

/**
 * Not Found Response Format
 * Specialized response for 404 errors
 * 
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name that was not found
 * @returns {Object} Express response
 * 
 * @example
 * notFoundResponse(res, 'User');
 */
function notFoundResponse(res, resource = 'Resource') {
  return errorResponse(res, `${resource} not found`, 404);
}

/**
 * Unauthorized Response Format
 * Specialized response for authentication errors
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Custom error message
 * @returns {Object} Express response
 * 
 * @example
 * unauthorizedResponse(res, 'Invalid token');
 */
function unauthorizedResponse(res, message = 'Authentication required') {
  return errorResponse(res, message, 401);
}

/**
 * Forbidden Response Format
 * Specialized response for authorization errors
 * 
 * @param {Object} res - Express response object
 * @param {string} message - Custom error message
 * @returns {Object} Express response
 * 
 * @example
 * forbiddenResponse(res, 'Admin access required');
 */
function forbiddenResponse(res, message = 'Insufficient permissions') {
  return errorResponse(res, message, 403);
}

/**
 * Health Check Response Format
 * Specialized response for health check endpoints
 * 
 * @param {Object} res - Express response object
 * @param {Object} health - Health status object
 * @returns {Object} Express response
 * 
 * @example
 * healthCheckResponse(res, { database: 'healthy', redis: 'healthy' });
 */
function healthCheckResponse(res, health = {}) {
  const isHealthy = Object.values(health).every(status => status === 'healthy');
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    success: isHealthy,
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks: health,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}

/**
 * Helper to sanitize data before sending in response
 * Removes sensitive fields like passwords, tokens, etc.
 * 
 * @param {Object} data - Data object to sanitize
 * @param {Array} fieldsToRemove - Additional fields to remove
 * @returns {Object} Sanitized data
 */
function sanitizeData(data, fieldsToRemove = []) {
  const defaultSensitiveFields = [
    'password',
    'password_hash',
    'token',
    'refreshToken',
    'apiKey',
    'secret'
  ];

  const sensitiveFields = [...defaultSensitiveFields, ...fieldsToRemove];

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, fieldsToRemove));
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.includes(key)) {
        delete sanitized[key];
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeData(sanitized[key], fieldsToRemove);
      }
    });

    return sanitized;
  }

  return data;
}

module.exports = {
  // Standard responses
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  noContentResponse,
  acceptedResponse,
  partialContentResponse,
  
  // Domain-specific responses
  transactionResponse,
  balanceResponse,
  statsResponse,
  
  // Error responses
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  
  // Utility responses
  healthCheckResponse,
  
  // Helpers
  sanitizeData
};