/**
 * Validation Middleware
 * 
 * Validates request data using Joi schemas.
 * Provides consistent validation error responses.
 * 
 * Location: src/shared/middleware/validation.js
 */

const Joi = require('joi');
const { ValidationError, fromJoiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

/**
 * Validate request data against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/users', validateRequest(userSchema.create), controller.createUser);
 */
function validateRequest(schema, property = 'body') {
  return (req, res, next) => {
    const dataToValidate = req[property];

    // Validate against schema
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Return all errors, not just the first
      stripUnknown: true, // Remove unknown keys
      convert: true // Type conversion
    });

    if (error) {
      logger.warn('Validation failed', {
        property,
        path: req.path,
        errors: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });

      return next(fromJoiError(error));
    }

    // Replace request data with validated and sanitized data
    req[property] = value;
    next();
  };
}

/**
 * Validate multiple request properties
 * @param {Object} schemas - Object with schemas for different properties
 * @returns {Function} Express middleware function
 * 
 * @example
 * validateMultiple({
 *   body: bodySchema,
 *   query: querySchema,
 *   params: paramsSchema
 * })
 */
function validateMultiple(schemas) {
  return (req, res, next) => {
    const errors = [];

    // Validate each property
    for (const [property, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        errors.push(...error.details.map(d => ({
          property,
          field: d.path.join('.'),
          message: d.message,
          type: d.type
        })));
      } else {
        req[property] = value;
      }
    }

    if (errors.length > 0) {
      logger.warn('Multiple validation failed', {
        path: req.path,
        errors
      });

      return next(new ValidationError(errors));
    }

    next();
  };
}

/**
 * Common Joi schemas and validators
 * Reusable validation patterns
 */
const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid({ version: 'uuidv4' }),

  // Email validation
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .max(255),

  // Password validation (strong password)
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),

  // Phone number validation
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
      'string.pattern.base': 'Phone number must be in E.164 format'
    }),

  // Amount/Money validation
  amount: Joi.number()
    .positive()
    .precision(2)
    .messages({
      'number.positive': 'Amount must be positive',
      'number.precision': 'Amount can have at most 2 decimal places'
    }),

  // Date validation
  date: Joi.date().iso(),

  // Pagination
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  },

  // Date range
  dateRange: {
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  },

  // Status enum
  status: (values) => Joi.string().valid(...values),

  // Sort order
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),

  // Search query
  searchQuery: Joi.string().min(1).max(100).trim()
};

/**
 * Sanitize input to prevent XSS
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Custom Joi validators
 */

/**
 * Validate business name
 */
const businessName = Joi.string()
  .min(2)
  .max(255)
  .pattern(/^[a-zA-Z0-9\s\-&'.]+$/)
  .trim()
  .messages({
    'string.pattern.base': 'Business name can only contain letters, numbers, spaces, and -&\'.'
  });

/**
 * Validate transaction type
 */
const transactionType = Joi.string()
  .valid('DEPOSIT', 'SALE', 'REFUND', 'PAYOUT', 'FEE', 'ADJUSTMENT')
  .uppercase();

/**
 * Validate transaction status
 */
const transactionStatus = Joi.string()
  .valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')
  .uppercase();

/**
 * Validate user status
 */
const userStatus = Joi.string()
  .valid('ACTIVE', 'SUSPENDED', 'PENDING', 'DEACTIVATED')
  .uppercase();

/**
 * Validate user role
 */
const userRole = Joi.string()
  .valid('SELLER', 'ADMIN')
  .uppercase();

/**
 * Validate currency code
 */
const currency = Joi.string()
  .length(3)
  .uppercase()
  .default('USD');

/**
 * Validate receipt items
 */
const receiptItems = Joi.array().items(
  Joi.object({
    name: Joi.string().required().max(255),
    quantity: Joi.number().integer().positive().required(),
    price: commonSchemas.amount.required()
  })
).min(1);

/**
 * Validate bank account
 */
const bankAccount = Joi.object({
  account_holder_name: Joi.string().required().max(255),
  account_number: Joi.string().required().max(100),
  bank_name: Joi.string().required().max(255),
  bank_code: Joi.string().optional().max(50),
  routing_number: Joi.string().optional().max(50),
  swift_code: Joi.string().optional().max(20),
  iban: Joi.string().optional().max(50),
  country: Joi.string().length(2).uppercase().default('ZW')
});

/**
 * Middleware to validate file uploads
 * @param {Object} options - Upload options
 * @returns {Function} Middleware function
 */
function validateFileUpload(options = {}) {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
    required = false
  } = options;

  return (req, res, next) => {
    if (!req.file && !req.files) {
      if (required) {
        return next(new ValidationError([
          { field: 'file', message: 'File is required' }
        ]));
      }
      return next();
    }

    const files = req.files || [req.file];

    for (const file of files) {
      // Check file size
      if (file.size > maxSize) {
        return next(new ValidationError([
          {
            field: 'file',
            message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
          }
        ]));
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return next(new ValidationError([
          {
            field: 'file',
            message: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
          }
        ]));
      }
    }

    next();
  };
}

/**
 * Validate query parameters with common patterns
 * @returns {Function} Middleware function
 */
function validateQueryParams() {
  const schema = Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    sortBy: Joi.string().optional(),
    sortOrder: commonSchemas.sortOrder,
    search: commonSchemas.searchQuery.optional(),
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate,
    status: Joi.string().optional(),
    type: Joi.string().optional()
  });

  return validateRequest(schema, 'query');
}

/**
 * Validate UUID parameter
 * @param {string} paramName - Parameter name
 * @returns {Function} Middleware function
 */
function validateUuidParam(paramName = 'id') {
  const schema = Joi.object({
    [paramName]: commonSchemas.uuid.required()
  });

  return validateRequest(schema, 'params');
}

/**
 * Custom validator for conditional fields
 * @param {Object} schema - Base schema
 * @param {Function} condition - Condition function
 * @returns {Function} Middleware function
 */
function validateConditional(schema, condition) {
  return (req, res, next) => {
    if (!condition(req)) {
      return next();
    }

    return validateRequest(schema)(req, res, next);
  };
}

/**
 * Validate amount within limits
 * @param {number} min - Minimum amount
 * @param {number} max - Maximum amount
 * @returns {Joi.Schema} Joi schema
 */
function amountWithLimits(min, max) {
  return commonSchemas.amount
    .min(min)
    .max(max)
    .messages({
      'number.min': `Amount must be at least ${min}`,
      'number.max': `Amount must not exceed ${max}`
    });
}

/**
 * Validate metadata object
 */
const metadata = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.object()
  )
);

module.exports = {
  // Main validation functions
  validateRequest,
  validateMultiple,
  validateQueryParams,
  validateUuidParam,
  validateConditional,
  validateFileUpload,

  // Common schemas
  commonSchemas,

  // Domain-specific validators
  businessName,
  transactionType,
  transactionStatus,
  userStatus,
  userRole,
  currency,
  receiptItems,
  bankAccount,
  metadata,
  amountWithLimits,

  // Utilities
  sanitizeInput
};