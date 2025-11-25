/**
 * Electricity Validators
 * 
 * Joi validation schemas for electricity endpoints.
 * 
 * Location: backend/api/v1/validators/electricity.validator.js
 */

const Joi = require('joi');
const { commonSchemas } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Check account validation schema
 */
const checkAccount = Joi.object({
  meter_number: Joi.string()
    .pattern(/^[0-9]{6,12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Meter number must be 6-12 digits',
      'any.required': 'Meter number is required'
    }),
  currency: Joi.string()
    .valid('ZWL', 'USD', 'ZIG')
    .uppercase()
    .required()
    .messages({
      'any.only': 'Currency must be ZWL, USD, or ZIG',
      'any.required': 'Currency is required'
    })
});

/**
 * Buy tokens validation schema
 */
const buyTokens = Joi.object({
  meter_number: Joi.string()
    .pattern(/^[0-9]{6,12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Meter number must be 6-12 digits',
      'any.required': 'Meter number is required'
    }),
  amount: commonSchemas.amount
    .min(1)
    .required()
    .messages({
      'number.min': 'Minimum purchase amount is $1',
      'any.required': 'Amount is required'
    }),
  currency: Joi.string()
    .valid('ZWL', 'USD', 'ZIG')
    .uppercase()
    .default('USD')
    .messages({
      'any.only': 'Currency must be ZWL, USD, or ZIG'
    })
});

/**
 * Get stats query validation schema
 */
const getStatsQuery = Joi.object({
  startDate: commonSchemas.dateRange.startDate,
  endDate: commonSchemas.dateRange.endDate
});

module.exports = {
  checkAccount,
  buyTokens,
  getStatsQuery
};