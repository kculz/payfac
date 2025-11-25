/**
 * Airtime Service
 * 
 * Handles airtime purchases (direct, voucher, and bundles) through the payment gateway.
 * Uses user's account balance for transactions.
 * 
 * Location: backend/services/airtime/airtime.service.js
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

class AirtimeService {
  /**
   * Get supported carriers
   * @returns {Promise<Array>} List of supported carriers
   */
  async getSupportedCarriers() {
    try {
      const token = await paymentGatewayService.authenticate();

      const response = await paymentGatewayService.client.get('/airtime/carriers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.success) {
        throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve carriers');
      }

      logger.info('Carriers retrieved', {
        count: response.data.data?.length || 0
      });

      return response.data.data;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getSupportedCarriers'
      });
      throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve carriers');
    }
  }

  /**
   * Get voucher values for a carrier
   * @param {string} carrier - Carrier identifier
   * @returns {Promise<Object>} Voucher values and custom amount flag
   */
  async getVoucherValues(carrier) {
    try {
      const token = await paymentGatewayService.authenticate();

      const response = await paymentGatewayService.client.get(
        `/airtime/direct/${carrier}/values`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.data.success) {
        throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve voucher values');
      }

      logger.info('Voucher values retrieved', {
        carrier,
        valuesCount: response.data.data?.length || 0,
        allowCustomAmount: response.data.allow_custom_amount
      });

      return {
        values: response.data.data,
        allowCustomAmount: response.data.allow_custom_amount
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getVoucherValues',
        carrier
      });
      throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve voucher values');
    }
  }

  /**
   * Buy direct airtime
   * @param {string} userId - User ID
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Purchase result
   */
  async buyDirectAirtime(userId, purchaseData) {
    const { mobile_phone, amount, currency = 'USD' } = purchaseData;

    try {
      // Validate amount limits
      if (amount < config.limits.minTransactionAmount) {
        throw new BadRequestError(`Minimum airtime purchase is $${config.limits.minTransactionAmount}`);
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

        // Make airtime purchase request
        const response = await paymentGatewayService.client.post(
          '/airtime/direct',
          {
            mobile_phone,
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
          throw new PaymentFailedError('Airtime purchase failed', response.data.message);
        }

        // Create transaction record
        transaction = await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          currency,
          status: 'COMPLETED',
          description: `Direct airtime to ${mobile_phone}`,
          customer_name: response.data.data.name,
          metadata: {
            service_type: 'airtime_direct',
            mobile_phone,
            carrier: response.data.data.name,
            commission: response.data.data.commission,
            gateway_response: response.data.data
          },
          completed_at: new Date()
        });

        // Deduct from user balance (complete reserved transaction)
        await balanceService.completeReservedTransaction(userId, amount);

        logger.info('Direct airtime purchased', {
          transactionId: transaction.id,
          userId,
          amount,
          mobile_phone,
          carrier: response.data.data.name
        });

        return {
          transaction,
          details: response.data.data
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
          description: `Failed airtime purchase to ${mobile_phone}`,
          error_message: error.message,
          failed_at: new Date()
        });

        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'buyDirectAirtime',
        userId,
        mobile_phone,
        amount
      });
      throw error;
    }
  }

  /**
   * Buy voucher airtime
   * @param {string} userId - User ID
   * @param {string} carrier - Carrier identifier
   * @param {Object} purchaseData - Purchase data
   * @returns {Promise<Object>} Purchase result with vouchers
   */
  async buyVoucherAirtime(userId, carrier, purchaseData) {
    const { amount, currency = 'USD', quantity = 1 } = purchaseData;
    const totalAmount = amount * quantity;

    try {
      // Check user balance
      const hasSufficientBalance = await balanceService.checkSufficientBalance(userId, totalAmount);
      
      if (!hasSufficientBalance) {
        const balance = await balanceService.getBalance(userId);
        throw new InsufficientBalanceError(totalAmount, balance.available);
      }

      // Reserve funds
      await balanceService.reserveFunds(userId, totalAmount);

      let transaction;

      try {
        // Authenticate with gateway
        const token = await paymentGatewayService.authenticate();

        // Make voucher purchase request
        const response = await paymentGatewayService.client.post(
          `/airtime/direct/voucher/${carrier}`,
          {
            amount,
            currency,
            quantity
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.data.success) {
          throw new PaymentFailedError('Voucher purchase failed', response.data.message);
        }

        // Create transaction record
        transaction = await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount: totalAmount,
          currency,
          status: 'COMPLETED',
          description: `${quantity}x ${amount} ${currency} vouchers from ${response.data.data.name}`,
          customer_name: response.data.data.name,
          metadata: {
            service_type: 'airtime_voucher',
            carrier,
            carrier_name: response.data.data.name,
            voucher_value: amount,
            quantity,
            vouchers: response.data.data.vouchers,
            commission: response.data.data.commission,
            gateway_response: response.data.data
          },
          completed_at: new Date()
        });

        // Deduct from user balance
        await balanceService.completeReservedTransaction(userId, totalAmount);

        logger.info('Voucher airtime purchased', {
          transactionId: transaction.id,
          userId,
          amount: totalAmount,
          quantity,
          carrier: response.data.data.name
        });

        return {
          transaction,
          details: response.data.data
        };

      } catch (error) {
        // Rollback: Release reserved funds
        await balanceService.releaseReservedFunds(userId, totalAmount);

        // Create failed transaction record
        await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount: totalAmount,
          status: 'FAILED',
          description: `Failed voucher purchase from ${carrier}`,
          error_message: error.message,
          failed_at: new Date()
        });

        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'buyVoucherAirtime',
        userId,
        carrier,
        amount,
        quantity
      });
      throw error;
    }
  }

  /**
   * Get available bundles
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Available bundles
   */
  async getAvailableBundles(filters = {}) {
    try {
      const token = await paymentGatewayService.authenticate();

      const response = await paymentGatewayService.client.get('/bundles', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: filters
      });

      if (!response.data.success) {
        throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve bundles');
      }

      logger.info('Bundles retrieved', {
        count: response.data.data?.length || 0,
        filters
      });

      return response.data.data;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getAvailableBundles',
        filters
      });
      throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve bundles');
    }
  }

  /**
   * Buy bundle
   * @param {string} userId - User ID
   * @param {number} bundleId - Bundle ID
   * @param {string} mobile_phone - Mobile phone number
   * @returns {Promise<Object>} Purchase result
   */
  async buyBundle(userId, bundleId, mobile_phone) {
    try {
      // First, get bundle details to know the price
      const bundles = await this.getAvailableBundles();
      const bundle = bundles.find(b => b.id === bundleId);

      if (!bundle) {
        throw new BadRequestError('Bundle not found');
      }

      const amount = bundle.price;

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

        // Make bundle purchase request
        const response = await paymentGatewayService.client.post(
          `/bundles/buy/${bundleId}`,
          {
            mobile_phone
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (!response.data.success) {
          throw new PaymentFailedError('Bundle purchase failed', response.data.message);
        }

        // Create transaction record
        transaction = await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          currency: bundle.currency,
          status: 'COMPLETED',
          description: `${bundle.name} bundle for ${mobile_phone}`,
          customer_name: bundle.network,
          metadata: {
            service_type: 'bundle',
            bundle_id: bundleId,
            bundle_name: bundle.name,
            bundle_description: bundle.description,
            mobile_phone,
            network: bundle.network,
            commission: response.data.data.commission,
            gateway_response: response.data.data
          },
          completed_at: new Date()
        });

        // Deduct from user balance
        await balanceService.completeReservedTransaction(userId, amount);

        logger.info('Bundle purchased', {
          transactionId: transaction.id,
          userId,
          amount,
          bundleId,
          bundleName: bundle.name,
          mobile_phone
        });

        return {
          transaction,
          details: response.data.data
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
          description: `Failed bundle purchase: ${bundle.name}`,
          error_message: error.message,
          failed_at: new Date()
        });

        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'buyBundle',
        userId,
        bundleId,
        mobile_phone
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new AirtimeService();