/**
 * Transaction Validators
 * 
 * Joi validation schemas for transaction endpoints.
 * 
 * Location: backend/api/v1/validators/transaction.validator.js
 */

const Joi = require('joi');
const { commonSchemas, receiptItems } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Process sale validation schema
 */
const processSale = Joi.object({
  amount: commonSchemas.amount.required().min(1).max(10000).messages({
    'number.min': 'Minimum sale amount is $1',
    'number.max': 'Maximum sale amount is $10,000'
  }),
  customer_name: Joi.string().optional().max(255),
  customer_email: commonSchemas.email.optional(),
  description: Joi.string().optional().max(500),
  items: receiptItems.optional(),
  metadata: Joi.object().optional()
});

/**
 * Process refund validation schema
 */
const processRefund = Joi.object({
  amount: commonSchemas.amount.optional().positive(),
  reason: Joi.string().required().min(5).max(500).messages({
    'string.empty': 'Refund reason is required',
    'string.min': 'Reason must be at least 5 characters',
    'string.max': 'Reason must not exceed 500 characters'
  })
});

/**
 * Get transaction history validation schema
 */
const getTransactionHistory = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')
    .optional(),
  type: Joi.string()
    .valid('DEPOSIT', 'SALE', 'REFUND', 'PAYOUT', 'FEE', 'ADJUSTMENT')
    .optional(),
  startDate: commonSchemas.dateRange.startDate,
  endDate: commonSchemas.dateRange.endDate,
  page: commonSchemas.pagination.page,
  limit: commonSchemas.pagination.limit
});

/**
 * Get recent transactions validation schema
 */
const getRecentTransactions = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10)
});

/**
 * Get transaction stats validation schema
 */
const getTransactionStats = Joi.object({
  startDate: commonSchemas.dateRange.startDate,
  endDate: commonSchemas.dateRange.endDate
});

/**
 * Get daily summary validation schema
 */
const getDailySummary = Joi.object({
  date: commonSchemas.date.optional()
});

/**
 * Get monthly summary validation schema
 */
const getMonthlySummary = Joi.object({
  year: Joi.number().integer().min(2020).max(2100).optional(),
  month: Joi.number().integer().min(1).max(12).optional()
});

/**
 * Search transactions validation schema
 */
const searchTransactions = Joi.object({
  query: commonSchemas.searchQuery.required(),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

module.exports = {
  processSale,
  processRefund,
  getTransactionHistory,
  getRecentTransactions,
  getTransactionStats,
  getDailySummary,
  getMonthlySummary,
  searchTransactions
};