/**
 * Airtime Validators
 * 
 * Joi validation schemas for airtime endpoints.
 * 
 * Location: backend/api/v1/validators/airtime.validator.js
 */

const Joi = require('joi');
const { commonSchemas } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Buy direct airtime validation schema
 */
const buyDirectAirtime = Joi.object({
  mobile_phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Mobile phone must be in E.164 format',
      'any.required': 'Mobile phone is required'
    }),
  amount: commonSchemas.amount
    .required()
    .messages({
      'any.required': 'Amount is required'
    }),
  currency: Joi.string()
    .length(3)
    .uppercase()
    .default('USD')
    .optional()
});

/**
 * Buy voucher airtime validation schema
 */
const buyVoucherAirtime = Joi.object({
  amount: commonSchemas.amount
    .required()
    .messages({
      'any.required': 'Amount is required'
    }),
  currency: Joi.string()
    .length(3)
    .uppercase()
    .default('USD')
    .optional(),
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .default(1)
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.max': 'Maximum quantity is 10'
    })
});

/**
 * Buy bundle validation schema
 */
const buyBundle = Joi.object({
  mobile_phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Mobile phone must be in E.164 format',
      'any.required': 'Mobile phone is required'
    })
});

/**
 * Get bundles filter validation schema
 */
const getBundlesFilter = Joi.object({
  currency: Joi.string()
    .length(3)
    .uppercase()
    .optional(),
  network: Joi.string()
    .max(100)
    .optional()
});

module.exports = {
  buyDirectAirtime,
  buyVoucherAirtime,
  buyBundle,
  getBundlesFilter
};