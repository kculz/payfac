/**
 * Auth Validators
 * 
 * Joi validation schemas for authentication endpoints.
 * 
 * Location: src/api/v1/validators/authValidator.js
 */

const Joi = require('joi');
const { commonSchemas, businessName } = require('../../../src/shared/middleware/validation.middleware');

/**
 * Register validation schema
 */
const register = Joi.object({
  email: commonSchemas.email.required(),
  password: commonSchemas.password.required(),
  business_name: businessName.required(),
  phone: commonSchemas.phone.optional()
});

/**
 * Login validation schema
 */
const login = Joi.object({
  email: commonSchemas.email.required(),
  password: Joi.string().required().min(1).messages({
    'string.empty': 'Password is required',
    'any.required': 'Password is required'
  })
});

/**
 * Logout validation schema
 */
const logout = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
});

/**
 * Refresh token validation schema
 */
const refreshToken = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
});

/**
 * Update profile validation schema
 */
const updateProfile = Joi.object({
  business_name: businessName.optional(),
  phone: commonSchemas.phone.optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided'
});

/**
 * Change password validation schema
 */
const changePassword = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
    'any.required': 'Current password is required'
  }),
  newPassword: commonSchemas.password.required()
    .invalid(Joi.ref('currentPassword'))
    .messages({
      'any.invalid': 'New password must be different from current password'
    })
});

/**
 * Forgot password validation schema
 */
const forgotPassword = Joi.object({
  email: commonSchemas.email.required()
});

/**
 * Reset password validation schema
 */
const resetPassword = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Reset token is required',
    'any.required': 'Reset token is required'
  }),
  newPassword: commonSchemas.password.required()
});

/**
 * Verify email validation schema
 */
const verifyEmail = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Verification token is required',
    'any.required': 'Verification token is required'
  })
});

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail
};