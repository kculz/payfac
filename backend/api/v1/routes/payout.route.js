/**
 * Payout Routes
 * 
 * Defines all payout-related routes.
 * 
 * Location: backend/api/v1/routes/payout.route.js
 */

const express = require('express');
const payoutController = require('../controllers/payout.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const Joi = require('joi');

const router = express.Router();

// ============================================================================
// USER PAYOUT ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/payouts
 * @desc    Create payout request
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  validateRequest(Joi.object({
    amount: commonSchemas.amount.required().min(1).max(10000).messages({
      'number.min': 'Minimum payout amount is $1',
      'number.max': 'Maximum payout amount is $10,000'
    }),
    bank_account_id: commonSchemas.uuid.required().messages({
      'string.guid': 'Valid bank account ID is required',
      'any.required': 'Bank account ID is required'
    })
  })),
  asyncHandler(payoutController.createPayoutRequest.bind(payoutController))
);

/**
 * @route   GET /api/v1/payouts
 * @desc    Get payout history
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validateRequest(Joi.object({
    status: Joi.string()
      .valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
      .optional(),
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }), 'query'),
  asyncHandler(payoutController.getPayoutHistory.bind(payoutController))
);

/**
 * @route   GET /api/v1/payouts/stats
 * @desc    Get payout statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(payoutController.getPayoutStats.bind(payoutController))
);

/**
 * @route   GET /api/v1/payouts/:payoutId
 * @desc    Get payout by ID
 * @access  Private
 */
router.get(
  '/:payoutId',
  authenticate,
  validateUuidParam('payoutId'),
  asyncHandler(payoutController.getPayout.bind(payoutController))
);

/**
 * @route   POST /api/v1/payouts/:payoutId/cancel
 * @desc    Cancel payout request
 * @access  Private
 */
router.post(
  '/:payoutId/cancel',
  authenticate,
  validateUuidParam('payoutId'),
  asyncHandler(payoutController.cancelPayout.bind(payoutController))
);

// ============================================================================
// ADMIN PAYOUT ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/payouts/admin/pending
 * @desc    Get pending payouts (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/pending',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit
  }), 'query'),
  asyncHandler(payoutController.getPendingPayouts.bind(payoutController))
);

/**
 * @route   GET /api/v1/payouts/admin/pending/count
 * @desc    Get pending payouts count (Admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/pending/count',
  authenticate,
  requireAdmin,
  asyncHandler(payoutController.getPendingCount.bind(payoutController))
);

/**
 * @route   POST /api/v1/payouts/admin/:payoutId/process
 * @desc    Process payout (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/admin/:payoutId/process',
  authenticate,
  requireAdmin,
  validateUuidParam('payoutId'),
  asyncHandler(payoutController.processPayout.bind(payoutController))
);

/**
 * @route   POST /api/v1/payouts/admin/:payoutId/reject
 * @desc    Reject payout (Admin only)
 * @access  Private (Admin)
 */
router.post(
  '/admin/:payoutId/reject',
  authenticate,
  requireAdmin,
  validateUuidParam('payoutId'),
  validateRequest(Joi.object({
    reason: Joi.string().required().min(5).max(500).messages({
      'string.empty': 'Rejection reason is required',
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason must not exceed 500 characters'
    })
  })),
  asyncHandler(payoutController.rejectPayout.bind(payoutController))
);

module.exports = router;