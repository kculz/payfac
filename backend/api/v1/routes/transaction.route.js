/**
 * Transaction Routes
 * 
 * Defines all transaction-related routes.
 * 
 * Location: backend/api/v1/routes/transaction.route.js
 */

const express = require('express');
const transactionController = require('../controllers/transaction.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam, commonSchemas } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const transactionValidator = require('../validators/transaction.validator');
const Joi = require('joi');

const router = express.Router();

// ============================================================================
// TRANSACTION PROCESSING ROUTES
// ============================================================================

/**
 * @route   POST /api/v1/transactions/sale
 * @desc    Process a sale transaction
 * @access  Private
 */
router.post(
  '/sale',
  authenticate,
  validateRequest(transactionValidator.processSale),
  asyncHandler(transactionController.processSale.bind(transactionController))
);

/**
 * @route   POST /api/v1/transactions/:transactionId/refund
 * @desc    Process a refund for a transaction
 * @access  Private
 */
router.post(
  '/:transactionId/refund',
  authenticate,
  validateUuidParam('transactionId'),
  validateRequest(transactionValidator.processRefund),
  asyncHandler(transactionController.processRefund.bind(transactionController))
);

/**
 * @route   POST /api/v1/transactions/:transactionId/cancel
 * @desc    Cancel a pending transaction
 * @access  Private
 */
router.post(
  '/:transactionId/cancel',
  authenticate,
  validateUuidParam('transactionId'),
  asyncHandler(transactionController.cancelTransaction.bind(transactionController))
);

// ============================================================================
// TRANSACTION QUERY ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/transactions
 * @desc    Get transaction history with filtering
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validateRequest(transactionValidator.getTransactionHistory, 'query'),
  asyncHandler(transactionController.getTransactionHistory.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/recent
 * @desc    Get recent transactions
 * @access  Private
 */
router.get(
  '/recent',
  authenticate,
  validateRequest(transactionValidator.getRecentTransactions, 'query'),
  asyncHandler(transactionController.getRecentTransactions.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/search
 * @desc    Search transactions
 * @access  Private
 */
router.get(
  '/search',
  authenticate,
  validateRequest(transactionValidator.searchTransactions, 'query'),
  asyncHandler(transactionController.searchTransactions.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/:transactionId
 * @desc    Get specific transaction details
 * @access  Private
 */
router.get(
  '/:transactionId',
  authenticate,
  validateUuidParam('transactionId'),
  asyncHandler(transactionController.getTransaction.bind(transactionController))
);

// ============================================================================
// TRANSACTION ANALYTICS ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/transactions/stats
 * @desc    Get transaction statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  validateRequest(transactionValidator.getTransactionStats, 'query'),
  asyncHandler(transactionController.getTransactionStats.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/summary/daily
 * @desc    Get daily transaction summary
 * @access  Private
 */
router.get(
  '/summary/daily',
  authenticate,
  validateRequest(transactionValidator.getDailySummary, 'query'),
  asyncHandler(transactionController.getDailySummary.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/summary/monthly
 * @desc    Get monthly transaction summary
 * @access  Private
 */
router.get(
  '/summary/monthly',
  authenticate,
  validateRequest(transactionValidator.getMonthlySummary, 'query'),
  asyncHandler(transactionController.getMonthlySummary.bind(transactionController))
);

// ============================================================================
// ADMIN TRANSACTION ROUTES
// ============================================================================

/**
 * @route   GET /api/v1/transactions/admin/all
 * @desc    Get all transactions across all users (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    status: transactionValidator.getTransactionHistory.extract('status').optional(),
    type: transactionValidator.getTransactionHistory.extract('type').optional(),
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate,
    userId: commonSchemas.uuid.optional()
  }), 'query'),
  asyncHandler(transactionController.getAllTransactions.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/admin/stats
 * @desc    Get transaction statistics for all users (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  validateRequest(transactionValidator.getTransactionStats, 'query'),
  asyncHandler(transactionController.getAllTransactionStats.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/admin/user/:userId
 * @desc    Get transactions for a specific user (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/user/:userId',
  authenticate,
  requireAdmin,
  validateUuidParam('userId'),
  validateRequest(transactionValidator.getTransactionHistory, 'query'),
  asyncHandler(transactionController.getUserTransactions.bind(transactionController))
);

/**
 * @route   POST /api/v1/transactions/admin/:transactionId/refund
 * @desc    Force refund a transaction (Admin override)
 * @access  Private (Admin)
 */
router.post(
  '/admin/:transactionId/refund',
  authenticate,
  requireAdmin,
  validateUuidParam('transactionId'),
  validateRequest(transactionValidator.processRefund),
  asyncHandler(transactionController.adminForceRefund.bind(transactionController))
);

/**
 * @route   PATCH /api/v1/transactions/admin/:transactionId/status
 * @desc    Update transaction status (Admin)
 * @access  Private (Admin)
 */
router.patch(
  '/admin/:transactionId/status',
  authenticate,
  requireAdmin,
  validateUuidParam('transactionId'),
  validateRequest(Joi.object({
    status: Joi.string()
      .valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')
      .required(),
    reason: Joi.string().optional().max(500)
  })),
  asyncHandler(transactionController.updateTransactionStatus.bind(transactionController))
);

/**
 * @route   GET /api/v1/transactions/admin/failed
 * @desc    Get failed transactions (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/failed',
  authenticate,
  requireAdmin,
  validateRequest(Joi.object({
    page: commonSchemas.pagination.page,
    limit: commonSchemas.pagination.limit,
    startDate: commonSchemas.dateRange.startDate,
    endDate: commonSchemas.dateRange.endDate
  }), 'query'),
  asyncHandler(transactionController.getFailedTransactions.bind(transactionController))
);

module.exports = router;