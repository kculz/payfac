/**
 * User Routes
 * 
 * Defines all user-related routes.
 * 
 * Location: backend/api/v1/routes/user.route.js
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const Joi = require('joi');

const router = express.Router();

// ============================================================================
// USER PROFILE ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get(
  '/profile',
  authenticate,
  asyncHandler(userController.getProfile.bind(userController))
);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  validateRequest(Joi.object({
    business_name: Joi.string().min(2).max(255).trim().optional().messages({
      'string.min': 'Business name must be at least 2 characters',
      'string.max': 'Business name must not exceed 255 characters'
    }),
    phone: Joi.string().max(20).trim().optional().messages({
      'string.max': 'Phone number must not exceed 20 characters'
    })
  })),
  asyncHandler(userController.updateProfile.bind(userController))
);

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(userController.getStats.bind(userController))
);

// ============================================================================
// ADMIN USER MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/users
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'SUSPENDED', 'PENDING', 'DEACTIVATED')
      .optional(),
    role: Joi.string()
      .valid('SELLER', 'ADMIN')
      .optional(),
    search: commonSchemas.searchQuery.optional(),
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }), 'query'),
  asyncHandler(userController.getAllUsers.bind(userController))
);

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/search',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    query: commonSchemas.searchQuery.required(),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }), 'query'),
  asyncHandler(userController.searchUsers.bind(userController))
);

/**
 * @route   GET /api/v1/users/by-status/:status
 * @desc    Get user by status (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/by-status/:status',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'SUSPENDED', 'PENDING', 'DEACTIVATED')
      .required()
      .messages({
        'any.required': 'Status is required',
        'any.only': 'Status must be one of: ACTIVE, SUSPENDED, PENDING, DEACTIVATED'
      })
  }), 'params'),
  asyncHandler(userController.getUsersByStatus.bind(userController))
);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/:userId',
  authenticate,
  requireAdmin,
  validateUuidParam('userId'),
  asyncHandler(userController.getUserById.bind(userController))
);

/**
 * @route   POST /api/v1/users/:userId/suspend
 * @desc    Suspend user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:userId/suspend',
  authenticate,
  requireAdmin,
  validateUuidParam('userId'),
  validateRequest(Joi.object({
    reason: Joi.string().required().min(5).max(500).messages({
      'string.empty': 'Suspension reason is required',
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason must not exceed 500 characters'
    })
  })),
  asyncHandler(userController.suspendUser.bind(userController))
);

/**
 * @route   POST /api/v1/users/:userId/activate
 * @desc    Activate user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/:userId/activate',
  authenticate,
  requireAdmin,
  validateUuidParam('userId'),
  asyncHandler(userController.activateUser.bind(userController))
);

module.exports = router;