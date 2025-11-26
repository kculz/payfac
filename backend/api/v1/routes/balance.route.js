/**
 * Balance Routes
 * 
 * Defines all balance-related routes.
 * 
 * Location: backend/api/v1/routes/balance.route.js
 */

const express = require('express');
const balanceController = require('../controllers/balance.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const Joi = require('joi');

const router = express.Router();

// ============================================================================
// USER BALANCE ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/balance
 * @desc    Get user's balance
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  asyncHandler(balanceController.getBalance.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/summary
 * @desc    Get detailed balance summary
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(balanceController.getBalanceSummary.bind(balanceController))
);

/**
 * @route   POST /api/v1/balance/check
 * @desc    Check if user has sufficient balance
 * @access  Private
 */
router.post(
  '/check',
  authenticate,
  validateRequest(Joi.object({
    amount: commonSchemas.amount.required().positive()
  })),
  asyncHandler(balanceController.checkSufficientBalance.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/history
 * @desc    Get balance history/ledger
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate,
    entry_type: Joi.string()
      .valid('DEPOSIT', 'SALE', 'REFUND', 'PAYOUT', 'ADJUSTMENT')
      .optional()
  }), 'query'),
  asyncHandler(balanceController.getBalanceHistory.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/stats
 * @desc    Get balance statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  validateRequest(Joi.object({
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate
  }), 'query'),
  asyncHandler(balanceController.getBalanceStats.bind(balanceController))
);

/**
 * @route   POST /api/v1/balance/reconcile
 * @desc    Reconcile user balance
 * @access  Private
 */
router.post(
  '/reconcile',
  authenticate,
  asyncHandler(balanceController.reconcileBalance.bind(balanceController))
);

// ============================================================================
// ADMIN BALANCE ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/balance/admin/all
 * @desc    Get all user balances (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    minBalance: commonSchemas.amount.optional(),
    maxBalance: commonSchemas.amount.optional()
  }), 'query'),
  asyncHandler(balanceController.getAllBalances.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/admin/total-allocated
 * @desc    Get total allocated balance (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/total-allocated',
  authenticate,
  requireAdmin,
  asyncHandler(balanceController.getTotalAllocated.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/admin/low-balance
 * @desc    Get users with low balance (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/low-balance',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    threshold: commonSchemas.amount.optional()
  }), 'query'),
  asyncHandler(balanceController.getLowBalanceUsers.bind(balanceController))
);

/**
 * @route   GET /api/v1/balance/admin/stats
 * @desc    Get balance statistics for all users (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  asyncHandler(balanceController.getAllBalanceStats.bind(balanceController))
);

/**
 * @route   POST /api/v1/balance/admin/adjust/:userId
 * @desc    Adjust user balance (Admin)
 * @access  Private (Admin)
 */
router.post(
  '/admin/adjust/:userId',
  authenticate,
  requireAdmin,
  validateUuidParam('userId'),
  validateRequest(Joi.object({
    amount: Joi.number().required().messages({
      'number.base': 'Amount must be a number',
      'any.required': 'Amount is required'
    }),
    reason: Joi.string().required().min(5).max(500).messages({
      'string.empty': 'Reason is required',
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason must not exceed 500 characters'
    })
  })),
  asyncHandler(balanceController.adjustBalance.bind(balanceController))
);

module.exports = router;