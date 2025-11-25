/**
 * Electricity Routes
 * 
 * Defines all electricity-related routes.
 * 
 * Location: backend/api/v1/routes/electricity.route.js
 */

const express = require('express');
const electricityController = require('../controllers/electricity.controller');
const { authenticate } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const electricityValidators = require('../validators/electricity.validator');

const router = express.Router();

// All electricity routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/electricity/check-account
 * @desc    Check/verify ZESA account
 * @access  Private
 */
router.post(
  '/check-account',
  validateRequest(electricityValidators.checkAccount),
  asyncHandler(electricityController.checkAccount.bind(electricityController))
);

/**
 * @route   POST /api/v1/electricity/buy-tokens
 * @desc    Buy ZESA tokens
 * @access  Private
 */
router.post(
  '/buy-tokens',
  validateRequest(electricityValidators.buyTokens),
  asyncHandler(electricityController.buyTokens.bind(electricityController))
);

/**
 * @route   GET /api/v1/electricity/history
 * @desc    Get electricity transaction history
 * @access  Private
 */
router.get(
  '/history',
  asyncHandler(electricityController.getTransactionHistory.bind(electricityController))
);

/**
 * @route   GET /api/v1/electricity/stats
 * @desc    Get electricity purchase statistics
 * @access  Private
 */
router.get(
  '/stats',
  validateRequest(electricityValidators.getStatsQuery, 'query'),
  asyncHandler(electricityController.getStats.bind(electricityController))
);

module.exports = router;