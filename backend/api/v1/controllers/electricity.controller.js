/**
 * Electricity Controller
 * 
 * Handles HTTP requests for electricity token services.
 * 
 * Location: backend/api/v1/controllers/electricity.controller.js
 */

const electricityService = require('../../../services/electricity/electricity.service');
const { successResponse, createdResponse } = require('../../../src/shared/utils/response');

class ElectricityController {
  /**
   * @desc    Check/verify ZESA account
   * @route   POST /api/v1/electricity/check-account
   * @access  Private
   */
  async checkAccount(req, res, next) {
    try {
      const { meter_number, currency } = req.body;

      const accountDetails = await electricityService.checkAccount(
        meter_number,
        currency
      );

      return successResponse(
        res,
        accountDetails,
        'Account verified successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Buy ZESA tokens
   * @route   POST /api/v1/electricity/buy-tokens
   * @access  Private
   */
  async buyTokens(req, res, next) {
    try {
      const userId = req.userId;
      const { meter_number, amount, currency } = req.body;

      const result = await electricityService.buyTokens(userId, {
        meter_number,
        amount,
        currency
      });

      // Format response
      const responseData = {
        transaction: {
          id: result.transaction.id,
          amount: parseFloat(result.transaction.amount),
          currency: result.transaction.currency,
          status: result.transaction.status,
          description: result.transaction.description,
          createdAt: result.transaction.created_at
        },
        customer: {
          name: result.details.customer_name,
          address: result.details.customer_address,
          meterNumber: result.details.meter_number,
          meterCurrency: result.details.meter_currency
        },
        purchase: {
          kwh: result.details.kwh,
          energy: result.details.energy,
          debt: result.details.debt,
          rea: result.details.rea,
          vat: result.details.vat,
          totalAmount: result.details.total_amt,
          date: result.details.date
        },
        payment: {
          tenderedCurrency: result.details.tendered_currency,
          tendered: result.details.tendered,
          commission: result.details.commission,
          balance: result.details.balance
        },
        tokens: result.details.tokens.map(token => ({
          number: token.token,
          formatted: token.formatted,
          units: token.units,
          rate: token.rate,
          receipt: token.receipt,
          taxRate: token.tax_rate,
          netAmount: token.net_amount,
          taxAmount: token.tax_amount,
          position: token.position
        }))
      };

      return createdResponse(
        res,
        responseData,
        'ZESA tokens purchased successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get electricity transaction history
   * @route   GET /api/v1/electricity/history
   * @access  Private
   */
  async getTransactionHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { page = 1, limit = 20 } = req.query;

      const history = await electricityService.getTransactionHistory(
        userId,
        {},
        { page: parseInt(page), limit: parseInt(limit) }
      );

      return successResponse(
        res,
        history,
        'Transaction history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @desc    Get electricity purchase statistics
   * @route   GET /api/v1/electricity/stats
   * @access  Private
   */
  async getStats(req, res, next) {
    try {
      const userId = req.userId;
      const { startDate, endDate } = req.query;

      // Default to last 30 days if not provided
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const stats = await electricityService.getStats(userId, start, end);

      return successResponse(
        res,
        {
          ...stats,
          period: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        },
        'Statistics retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
module.exports = new ElectricityController();