/**
 * Admin Routes
 * 
 * Defines all admin-related routes.
 * 
 * Location: backend/api/v1/routes/admin.route.js
 */

const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const Joi = require('joi');

const router = express.Router();

// Apply authentication and admin role check to all admin routes
router.use(authenticate);
router.use(requireAdmin);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users
 * @access  Private (Admin)
 */
router.get(
  '/users',
  validateRequest(Joi.object({
    status: Joi.string().valid('ACTIVE', 'SUSPENDED', 'PENDING', 'DEACTIVATED').optional(),
    role: Joi.string().valid('SELLER', 'ADMIN').optional(),
    search: commonSchemas.searchQuery.optional(),
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }), 'query'),
  asyncHandler(adminController.getAllUsers.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/users/search
 * @desc    Search users
 * @access  Private (Admin)
 */
router.get(
  '/users/search',
  validateRequest(Joi.object({
    query: commonSchemas.searchQuery.required(),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }), 'query'),
  asyncHandler(adminController.searchUsers.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Get user by ID
 * @access  Private (Admin)
 */
router.get(
  '/users/:userId',
  validateUuidParam('userId'),
  asyncHandler(adminController.getUserById.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/users/:userId/stats
 * @desc    Get user statistics
 * @access  Private (Admin)
 */
router.get(
  '/users/:userId/stats',
  validateUuidParam('userId'),
  asyncHandler(adminController.getUserStats.bind(adminController))
);

/**
 * @route   PATCH /api/v1/admin/users/:userId/status
 * @desc    Update user status
 * @access  Private (Admin)
 */
router.patch(
  '/users/:userId/status',
  validateUuidParam('userId'),
  validateRequest(Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'SUSPENDED', 'PENDING', 'DEACTIVATED')
      .required()
  })),
  asyncHandler(adminController.updateUserStatus.bind(adminController))
);

/**
 * @route   POST /api/v1/admin/users/:userId/suspend
 * @desc    Suspend user account
 * @access  Private (Admin)
 */
router.post(
  '/users/:userId/suspend',
  validateUuidParam('userId'),
  validateRequest(Joi.object({
    reason: Joi.string().required().min(5).max(500)
  })),
  asyncHandler(adminController.suspendUser.bind(adminController))
);

/**
 * @route   POST /api/v1/admin/users/:userId/activate
 * @desc    Activate user account
 * @access  Private (Admin)
 */
router.post(
  '/users/:userId/activate',
  validateUuidParam('userId'),
  asyncHandler(adminController.activateUser.bind(adminController))
);

// ============================================================================
// POOL ACCOUNT MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/v1/admin/pool
 * @desc    Get pool account status
 * @access  Private (Admin)
 */
router.get(
  '/pool',
  asyncHandler(adminController.getPoolStatus.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/pool/health
 * @desc    Get pool health
 * @access  Private (Admin)
 */
router.get(
  '/pool/health',
  asyncHandler(adminController.getPoolHealth.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/pool/summary
 * @desc    Get pool summary
 * @access  Private (Admin)
 */
router.get(
  '/pool/summary',
  validateRequest(Joi.object({
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate
  }), 'query'),
  asyncHandler(adminController.getPoolSummary.bind(adminController))
);

/**
 * @route   POST /api/v1/admin/pool/add-funds
 * @desc    Add funds to pool
 * @access  Private (Admin)
 */
router.post(
  '/pool/add-funds',
  validateRequest(Joi.object({
    amount: commonSchemas.amount.required().positive(),
    source: Joi.string().required().max(255),
    reference: Joi.string().required().max(255)
  })),
  asyncHandler(adminController.addFundsToPool.bind(adminController))
);

/**
 * @route   POST /api/v1/admin/pool/remove-funds
 * @desc    Remove funds from pool
 * @access  Private (Admin)
 */
router.post(
  '/pool/remove-funds',
  validateRequest(Joi.object({
    amount: commonSchemas.amount.required().positive(),
    destination: Joi.string().required().max(255),
    reference: Joi.string().required().max(255)
  })),
  asyncHandler(adminController.removeFundsFromPool.bind(adminController))
);

/**
 * @route   POST /api/v1/admin/pool/reconcile
 * @desc    Reconcile pool with gateway
 * @access  Private (Admin)
 */
router.post(
  '/pool/reconcile',
  validateRequest(Joi.object({
    gateway_balance: commonSchemas.amount.required()
  })),
  asyncHandler(adminController.reconcilePool.bind(adminController))
);

// ============================================================================
// DASHBOARD & STATISTICS
// ============================================================================

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin)
 */
router.get(
  '/dashboard',
  asyncHandler(adminController.getDashboardStats.bind(adminController))
);

/**
 * @route   GET /api/v1/admin/stats/active-sellers
 * @desc    Get active seller count
 * @access  Private (Admin)
 */
router.get(
  '/stats/active-sellers',
  asyncHandler(adminController.getActiveSellerCount.bind(adminController))
);

module.exports = router;