/**
 * Airtime Routes
 * 
 * Defines all airtime-related routes.
 * 
 * Location: backend/api/v1/routes/airtime.route.js
 */

const express = require('express');
const airtimeController = require('../controllers/airtime.controller');
const { authenticate } = require('../../../src/shared/middleware/auth.middleware');
const { validateRequest } = require('../../../src/shared/middleware/validation.middleware');
const { asyncHandler } = require('../../../src/shared/middleware/errorHandler.middleware');
const airtimeValidators = require('../validators/airtime.validator');

const router = express.Router();

// All airtime routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/airtime/carriers
 * @desc    Get supported carriers
 * @access  Private
 */
router.get(
  '/carriers',
  asyncHandler(airtimeController.getCarriers.bind(airtimeController))
);

/**
 * @route   GET /api/v1/airtime/carriers/:carrier/values
 * @desc    Get voucher values for a carrier
 * @access  Private
 */
router.get(
  '/carriers/:carrier/values',
  asyncHandler(airtimeController.getVoucherValues.bind(airtimeController))
);

/**
 * @route   POST /api/v1/airtime/direct
 * @desc    Buy direct airtime
 * @access  Private
 */
router.post(
  '/direct',
  validateRequest(airtimeValidators.buyDirectAirtime),
  asyncHandler(airtimeController.buyDirectAirtime.bind(airtimeController))
);

/**
 * @route   POST /api/v1/airtime/vouchers/:carrier
 * @desc    Buy voucher airtime
 * @access  Private
 */
router.post(
  '/vouchers/:carrier',
  validateRequest(airtimeValidators.buyVoucherAirtime),
  asyncHandler(airtimeController.buyVoucherAirtime.bind(airtimeController))
);

/**
 * @route   GET /api/v1/airtime/bundles
 * @desc    Get available bundles
 * @access  Private
 */
router.get(
  '/bundles',
  validateRequest(airtimeValidators.getBundlesFilter, 'query'),
  asyncHandler(airtimeController.getAvailableBundles.bind(airtimeController))
);

/**
 * @route   POST /api/v1/airtime/bundles/:bundleId
 * @desc    Buy bundle
 * @access  Private
 */
router.post(
  '/bundles/:bundleId',
  validateRequest(airtimeValidators.buyBundle),
  asyncHandler(airtimeController.buyBundle.bind(airtimeController))
);

module.exports = router;