/**
 * Deposit Validators
 * 
 * Joi validation schemas for deposit endpoints.
 * 
 * Location: backend/api/v1/validators/deposit.validator.js
 */

const Joi = require('joi');
const { commonSchemas } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Create deposit validation schema
 */
const createDeposit = Joi.object({
  amount: commonSchemas.amount.required().min(10).max(50000).messages({
    'number.min': 'Minimum deposit amount is $10',
    'number.max': 'Maximum deposit amount is $50,000'
  }),
  payment_method: Joi.string().optional().max(50),
  gateway_reference: Joi.string().optional().max(255)
});

/**
 * Get deposit history validation schema
 */
const getDepositHistory = Joi.object({
  status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED').optional(),
  page: commonSchemas.pagination.page,
  limit: commonSchemas.pagination.limit
});

/**
 * Reject deposit validation schema
 */
const rejectDeposit = Joi.object({
  reason: Joi.string().required().min(5).max(500).messages({
    'string.empty': 'Rejection reason is required',
    'string.min': 'Rejection reason must be at least 5 characters',
    'string.max': 'Rejection reason must not exceed 500 characters'
  })
});

module.exports = {
  createDeposit,
  getDepositHistory,
  rejectDeposit
};