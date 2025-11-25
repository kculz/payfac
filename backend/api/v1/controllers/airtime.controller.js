/**
 * Airtime Controller
 * 
 * Handles HTTP requests for airtime services.
 * 
 * Location: backend/api/v1/controllers/airtime.controller.js
 */

const airtimeService = require('../../../services/airtime/airtime.service');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');

class AirtimeController {
  /**
   * @desc    Get supported carriers
   * @route   GET /api/v1/airtime/carriers
   * @access  Private
   */
  async getCarriers(req, res, next) {
    try {
      const carriers = await airtimeService.getSupportedCarriers();

      return successResponse(
        res,
        carriers,
        'Supported carriers retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get voucher values for a carrier
   * @route   GET /api/v1/airtime/carriers/:carrier/values
   * @access  Private
   */
  async getVoucherValues(req, res, next) {
    try {
      const { carrier } = req.params;

      const result = await airtimeService.getVoucherValues(carrier);

      return successResponse(
        res,
        {
          values: result.values,
          allowCustomAmount: result.allowCustomAmount
        },
        'Voucher values retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Buy direct airtime
   * @route   POST /api/v1/airtime/direct
   * @access  Private
   */
  async buyDirectAirtime(req, res, next) {
    try {
      const userId = req.userId;
      const { mobile_phone, amount, currency } = req.body;

      const result = await airtimeService.buyDirectAirtime(userId, {
        mobile_phone,
        amount,
        currency
      });

      return createdResponse(
        res,
        {
          transaction: {
            id: result.transaction.id,
            amount: parseFloat(result.transaction.amount),
            currency: result.transaction.currency,
            status: result.transaction.status,
            description: result.transaction.description,
            createdAt: result.transaction.created_at
          },
          details: {
            carrier: result.details.name,
            mobile_phone: result.details.mobile_phone,
            status: result.details.status,
            commission: result.details.commission,
            balance: result.details.balance
          }
        },
        'Airtime purchase successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Buy voucher airtime
   * @route   POST /api/v1/airtime/vouchers/:carrier
   * @access  Private
   */
  async buyVoucherAirtime(req, res, next) {
    try {
      const userId = req.userId;
      const { carrier } = req.params;
      const { amount, currency, quantity } = req.body;

      const result = await airtimeService.buyVoucherAirtime(userId, carrier, {
        amount,
        currency,
        quantity
      });

      return createdResponse(
        res,
        {
          transaction: {
            id: result.transaction.id,
            amount: parseFloat(result.transaction.amount),
            currency: result.transaction.currency,
            status: result.transaction.status,
            description: result.transaction.description,
            createdAt: result.transaction.created_at
          },
          details: {
            carrier: result.details.name,
            voucher_value: result.details.voucher_value,
            quantity: result.details.vouchers?.length || 0,
            vouchers: result.details.vouchers,
            status: result.details.status,
            commission: result.details.commission,
            balance: result.details.balance
          }
        },
        'Voucher purchase successful'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get available bundles
   * @route   GET /api/v1/airtime/bundles
   * @access  Private
   */
  async getAvailableBundles(req, res, next) {
    try {
      const { currency, network } = req.query;

      const bundles = await airtimeService.getAvailableBundles({
        currency,
        network
      });

      return successResponse(
        res,
        bundles,
        'Available bundles retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Buy bundle
   * @route   POST /api/v1/airtime/bundles/:bundleId
   * @access  Private
   */
  async buyBundle(req, res, next) {
    try {
      const userId = req.userId;
      const { bundleId } = req.params;
      const { mobile_phone } = req.body;

      const result = await airtimeService.buyBundle(
        userId,
        parseInt(bundleId),
        mobile_phone
      );

      return createdResponse(
        res,
        {
          transaction: {
            id: result.transaction.id,
            amount: parseFloat(result.transaction.amount),
            currency: result.transaction.currency,
            status: result.transaction.status,
            description: result.transaction.description,
            createdAt: result.transaction.created_at
          },
          details: {
            bundle: result.details.name,
            mobile_phone: result.details.mobile_phone,
            status: result.details.status,
            commission: result.details.commission,
            balance: result.details.balance
          }
        },
        'Bundle purchase successful'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new AirtimeController();