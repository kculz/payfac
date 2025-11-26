/**
 * Deposit Routes
 * 
 * Defines all deposit-related routes.
 * 
 * Location: backend/api/v1/routes/deposit.route.js
 */

const express = require('express');
const depositController = require('../controllers/deposit.controller');
const { authenticate, requireAdmin } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest, validateUuidParam } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const depositValidators = require('../validators/deposit.validator');

const router = express.Router();

/**
 * @route   POST /api/v1/deposits
 * @desc    Create a deposit request
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  validateRequest(depositValidators.createDeposit),
  asyncHandler(depositController.createDeposit.bind(depositController))
);

/**
 * @route   GET /api/v1/deposits
 * @desc    Get user's deposit history
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validateRequest(depositValidators.getDepositHistory, 'query'),
  asyncHandler(depositController.getDepositHistory.bind(depositController))
);

/**
 * @route   GET /api/v1/deposits/stats
 * @desc    Get deposit statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(depositController.getDepositStats.bind(depositController))
);

/**
 * @route   GET /api/v1/deposits/admin/pending
 * @desc    Get all pending deposits (Admin)
 * @access  Private (Admin)
 */
router.get(
  '/admin/pending',
  authenticate,
  requireAdmin,
  asyncHandler(depositController.getPendingDeposits.bind(depositController))
);

/**
 * @route   GET /api/v1/deposits/:depositId
 * @desc    Get single deposit by ID
 * @access  Private
 */
router.get(
  '/:depositId',
  authenticate,
  validateUuidParam('depositId'),
  asyncHandler(depositController.getDeposit.bind(depositController))
);

/**
 * @route   POST /api/v1/deposits/:depositId/approve
 * @desc    Approve deposit request (Admin)
 * @access  Private (Admin)
 */
router.post(
  '/:depositId/approve',
  authenticate,
  requireAdmin,
  validateUuidParam('depositId'),
  asyncHandler(depositController.approveDeposit.bind(depositController))
);

/**
 * @route   POST /api/v1/deposits/:depositId/reject
 * @desc    Reject deposit request (Admin)
 * @access  Private (Admin)
 */
router.post(
  '/:depositId/reject',
  authenticate,
  requireAdmin,
  validateUuidParam('depositId'),
  validateRequest(depositValidators.rejectDeposit),
  asyncHandler(depositController.rejectDeposit.bind(depositController))
);

/**
 * @route   DELETE /api/v1/deposits/:depositId
 * @desc    Cancel deposit request
 * @access  Private
 */
router.delete(
  '/:depositId',
  authenticate,
  validateUuidParam('depositId'),
  asyncHandler(depositController.cancelDeposit.bind(depositController))
);

module.exports = router;