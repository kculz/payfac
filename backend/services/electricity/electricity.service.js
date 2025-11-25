/**
 * Electricity Service
 * 
 * Handles ZESA token purchases through the payment gateway.
 * Uses user's account balance for transactions.
 * 
 * Location: backend/services/electricity/electricity.service.js
 */

const paymentGatewayService = require('../payment/paymentGateway.service');
const balanceService = require('../balance/balance.service');
const transactionRepository = require('../../database/repositories/transaction.repository');
const logger = require('../../src/shared/utils/logger');
const config = require('../../src/config/environment.config');
const {
  BadRequestError,
  InsufficientBalanceError,
  ServiceUnavailableError,
  PaymentFailedError
} = require('../../src/shared/utils/ApiError');

class ElectricityService {
  /**
   * Check/verify ZESA account
   * @param {string} meterNumber - Meter number
   * @param {string} currency - Currency (ZWL or USD)
   * @returns {Promise<Object>} Account details
   */
  async checkAccount(meterNumber, currency) {
    try {
      const token = await paymentGatewayService.authenticate();

      const response = await paymentGatewayService.client.post(
        '/electricity/check-account',
        {
          meter_number: meterNumber,
          currency
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.data.success) {
        throw new BadRequestError(response.data.message || 'Invalid meter number');
      }

      logger.info('ZESA account verified', {
        meterNumber,
        currency,
        customerName: response.data.data.customer_name
      });

      return response.data.data;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'checkAccount',
        meterNumber,
        currency
      });

      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new ServiceUnavailableError('Payment Gateway', 'Failed to verify account');
    }
  }

  /**
   * Buy ZESA tokens
   * @param {string} userId - User ID
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Purchase result with tokens
   */
  async buyTokens(userId, purchaseData) {
    const { meter_number, amount, currency = 'USD' } = purchaseData;

    try {
      // Validate amount limits
      if (amount < config.limits.minTransactionAmount) {
        throw new BadRequestError(`Minimum electricity purchase is $${config.limits.minTransactionAmount}`);
      }

      if (amount > config.limits.maxTransactionAmount) {
        throw new BadRequestError(`Maximum electricity purchase is $${config.limits.maxTransactionAmount}`);
      }

      // Check user balance
      const hasSufficientBalance = await balanceService.checkSufficientBalance(userId, amount);
      
      if (!hasSufficientBalance) {
        const balance = await balanceService.getBalance(userId);
        throw new InsufficientBalanceError(amount, balance.available);
      }

      // Reserve funds
      await balanceService.reserveFunds(userId, amount);

      let transaction;

      try {
        // Authenticate with gateway
        const token = await paymentGatewayService.authenticate();

        // Make token purchase request
        const response = await paymentGatewayService.client.post(
          '/electricity/buy-tokens',
          {
            meter_number,
            amount,
            currency
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.data.success) {
          throw new PaymentFailedError('Token purchase failed', response.data.message);
        }

        const tokenData = response.data.data;

        // Create transaction record
        transaction = await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          currency,
          status: 'COMPLETED',
          description: `ZESA tokens for meter ${meter_number}`,
          customer_name: tokenData.customer_name,
          metadata: {
            service_type: 'electricity',
            meter_number,
            meter_currency: tokenData.meter_currency,
            customer_name: tokenData.customer_name,
            customer_address: tokenData.customer_address,
            kwh: tokenData.kwh,
            energy: tokenData.energy,
            debt: tokenData.debt,
            rea: tokenData.rea,
            vat: tokenData.vat,
            tendered_currency: tokenData.tendered_currency,
            tendered: tokenData.tendered,
            total_amt: tokenData.total_amt,
            date: tokenData.date,
            tokens: tokenData.tokens,
            commission: tokenData.commission,
            gateway_response: tokenData
          },
          completed_at: new Date()
        });

        // Deduct from user balance
        await balanceService.completeReservedTransaction(userId, amount);

        logger.info('ZESA tokens purchased', {
          transactionId: transaction.id,
          userId,
          amount,
          meter_number,
          kwh: tokenData.kwh,
          tokensCount: tokenData.tokens?.length || 0
        });

        return {
          transaction,
          details: tokenData
        };

      } catch (error) {
        // Rollback: Release reserved funds
        await balanceService.releaseReservedFunds(userId, amount);

        // Create failed transaction record
        await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          status: 'FAILED',
          description: `Failed ZESA token purchase for meter ${meter_number}`,
          error_message: error.message,
          failed_at: new Date()
        });

        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'buyTokens',
        userId,
        meter_number,
        amount
      });
      throw error;
    }
  }

  /**
   * Format token receipt data
   * Helper method to format token data for receipt generation
   * @param {Object} tokenData - Token data from gateway
   * @returns {Object} Formatted receipt data
   */
  formatReceiptData(tokenData) {
    return {
      customer: {
        name: tokenData.customer_name,
        address: tokenData.customer_address,
        meterNumber: tokenData.meter_number,
        meterCurrency: tokenData.meter_currency
      },
      purchase: {
        kwh: tokenData.kwh,
        energy: tokenData.energy,
        debt: tokenData.debt,
        rea: tokenData.rea,
        vat: tokenData.vat,
        totalAmount: tokenData.total_amt,
        date: tokenData.date
      },
      payment: {
        tenderedCurrency: tokenData.tendered_currency,
        tendered: tokenData.tendered,
        commission: tokenData.commission
      },
      tokens: tokenData.tokens.map(token => ({
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
  }

  /**
   * Get electricity transaction history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated transactions
   */
  async getTransactionHistory(userId, filters = {}, pagination = {}) {
    try {
      const transactionFilters = {
        ...filters,
        'metadata.service_type': 'electricity'
      };

      return await transactionRepository.findByUserId(
        userId,
        transactionFilters,
        pagination
      );
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTransactionHistory',
        userId
      });
      throw error;
    }
  }

  /**
   * Get token purchase statistics
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  async getStats(userId, startDate, endDate) {
    try {
      // Get all electricity transactions
      const transactions = await transactionRepository.findMany({
        user_id: userId,
        transaction_type: 'SALE',
        status: 'COMPLETED',
        'metadata.service_type': 'electricity',
        created_at: {
          gte: startDate,
          lte: endDate
        }
      });

      // Calculate statistics
      const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalKwh = transactions.reduce((sum, t) => {
        const kwh = parseFloat(t.metadata?.kwh || 0);
        return sum + kwh;
      }, 0);

      const totalCommission = transactions.reduce((sum, t) => {
        const commission = t.metadata?.commission || '0';
        const commissionAmount = parseFloat(commission.replace(/[^\d.]/g, ''));
        return sum + commissionAmount;
      }, 0);

      return {
        totalTransactions: transactions.length,
        totalAmount,
        totalKwh,
        totalCommission,
        averageAmount: transactions.length > 0 ? totalAmount / transactions.length : 0,
        averageKwh: transactions.length > 0 ? totalKwh / transactions.length : 0
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getStats',
        userId
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new ElectricityService();