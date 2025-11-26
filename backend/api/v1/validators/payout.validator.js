/**
 * Payout Validators
 * 
 * Joi validation schemas for payout endpoints.
 * 
 * Location: backend/api/v1/validators/payout.validator.js
 */

const Joi = require('joi');
const { commonSchemas } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Create payout validation schema
 */
const createPayout = Joi.object({
  amount: commonSchemas.amount.required().min(10).max(50000).messages({
    'number.min': 'Minimum payout amount is $10',
    'number.max': 'Maximum payout amount is $50,000',
    'any.required': 'Amount is required'
  }),
  bank_account_id: commonSchemas.uuid.required().messages({
    'any.required': 'Bank account ID is required'
  })
});

/**
 * Get payout history validation schema
 */
const getPayoutHistory = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
    .optional(),
  page: commonSchemas.pagination.page,
  limit: commonSchemas.pagination.limit
});

/**
 * Reject payout validation schema
 */
const rejectPayout = Joi.object({
  reason: Joi.string().required().min(5).max(500).messages({
    'string.empty': 'Rejection reason is required',
    'string.min': 'Rejection reason must be at least 5 characters',
    'string.max': 'Rejection reason must not exceed 500 characters'
  })
});

module.exports = {
  createPayout,
  getPayoutHistory,
  rejectPayout
};