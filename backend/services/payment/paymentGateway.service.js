/**
 * Payment Gateway Service
 * 
 * Integrates with external wallet API (xash.co.zw) for payment processing.
 * Handles authentication, balance checking, and transaction processing.
 * 
 * Location: src/services/payment/paymentGatewayService.js
 */

const axios = require('axios');
const config = require('../../src/config/environment.config');
const logger = require('../../src/shared/utils/logger');
const {
  PaymentFailedError,
  ServiceUnavailableError,
  UnauthorizedError
} = require('../../src/shared/utils/ApiError');

class PaymentGatewayService {
  constructor() {
    // Determine base URL based on environment
    this.baseURL = config.app.isProduction
      ? process.env.GATEWAY_BASE_URL || 'https://xv.xash.co.zw/api/v1'
      : process.env.GATEWAY_BASE_URL_DEV || 'https://xvdev.xash.co.zw/api/v1';

    // Gateway credentials
    this.userNumber = process.env.GATEWAY_USER_NUMBER;
    this.password = process.env.GATEWAY_PASSWORD;

    // Access token storage
    this.accessToken = null;
    this.tokenExpiry = null;

    // Axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Gateway API Request', {
          method: config.method,
          url: config.url,
          baseURL: config.baseURL
        });
        return config;
      },
      (error) => {
        logger.error('Gateway API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Gateway API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Gateway API Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );

    logger.info('Payment Gateway Service initialized', {
      baseURL: this.baseURL,
      environment: config.app.nodeEnv
    });
  }

  /**
   * Authenticate with the gateway and obtain access token
   * @returns {Promise<string>} Access token
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      logger.info('Authenticating with payment gateway');

      const response = await this.client.post('/auth/login', {
        user_number: parseInt(this.userNumber),
        password: this.password
      });

      if (!response.data.success) {
        throw new UnauthorizedError('Gateway authentication failed');
      }

      // Store token (prefer 'token' over deprecated 'accessToken')
      this.accessToken = response.data.token || response.data.accessToken;
      
      // Set token expiry (1 hour from now minus 5 minutes buffer)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000); // 55 minutes

      logger.info('Gateway authentication successful');

      return this.accessToken;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'authenticate'
      });

      if (error.response?.status === 401 || error.response?.status === 422) {
        throw new UnauthorizedError('Invalid gateway credentials');
      }

      throw new ServiceUnavailableError('Payment Gateway', 'Authentication failed');
    }
  }

  /**
   * Logout from the gateway
   * @returns {Promise<boolean>} Success status
   */
  async logout() {
    try {
      if (!this.accessToken) {
        return true;
      }

      await this.client.post('/auth/logout', {}, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      this.accessToken = null;
      this.tokenExpiry = null;

      logger.info('Gateway logout successful');
      return true;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'logout'
      });
      // Don't throw error on logout failure
      return false;
    }
  }

  /**
   * Get wallet balance from gateway
   * @returns {Promise<Object>} Wallet balance information
   */
  async getWalletBalance() {
    try {
      // Ensure we have a valid token
      const token = await this.authenticate();

      const response = await this.client.get('/wallet', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Handle response structure
      if (response.data.success && response.data.data && response.data.data.length > 0) {
        const wallet = response.data.data[0];

        const walletData = {
          total_balance: parseFloat(wallet.value) || 0,
          available_balance: parseFloat(wallet.value) - 
                            parseFloat(wallet.value_on_hold || 0) - 
                            parseFloat(wallet.value_pending || 0),
          pending_balance: parseFloat(wallet.value_pending) || 0,
          on_hold: parseFloat(wallet.value_on_hold) || 0,
          currency: wallet.currency || 'USD',
          raw_data: wallet
        };

        logger.info('Wallet balance retrieved', {
          totalBalance: walletData.total_balance,
          availableBalance: walletData.available_balance,
          currency: walletData.currency
        });

        return walletData;
      } else {
        // Return default values if no data
        logger.warn('No wallet data returned from gateway');
        
        return {
          total_balance: 0,
          available_balance: 0,
          pending_balance: 0,
          on_hold: 0,
          currency: 'USD',
          raw_data: null
        };
      }
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getWalletBalance'
      });

      if (error.response?.status === 401) {
        // Token expired, try to re-authenticate
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Retry once
        try {
          return await this.getWalletBalance();
        } catch (retryError) {
          throw new UnauthorizedError('Failed to authenticate with payment gateway');
        }
      }

      throw new ServiceUnavailableError('Payment Gateway', 'Failed to retrieve wallet balance');
    }
  }

  /**
   * Process a payment transaction
   * Note: Implementation depends on the gateway's payment endpoint
   * This is a placeholder - update with actual endpoint when available
   * 
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Payment result
   */
  async processPayment(paymentData) {
    try {
      const token = await this.authenticate();

      const { amount, currency, customer, metadata } = paymentData;

      // TODO: Update this with actual payment endpoint
      // This is a placeholder structure
      const response = await this.client.post('/payments', {
        amount,
        currency: currency || 'USD',
        customer,
        metadata
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.success) {
        throw new PaymentFailedError(
          response.data.message || 'Payment processing failed',
          response.data
        );
      }

      logger.transaction('payment_processed', {
        amount,
        currency,
        gatewayTransactionId: response.data.transaction_id
      });

      return {
        id: response.data.transaction_id,
        status: response.data.status,
        amount,
        currency,
        created_at: new Date().toISOString(),
        raw_response: response.data
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'processPayment',
        amount: paymentData.amount
      });

      if (error instanceof PaymentFailedError) {
        throw error;
      }

      throw new PaymentFailedError('Payment processing failed', error.message);
    }
  }

  /**
   * Refund a payment
   * Note: Implementation depends on the gateway's refund endpoint
   * 
   * @param {string} transactionId - Original transaction ID
   * @param {number} amount - Amount to refund
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount) {
    try {
      const token = await this.authenticate();

      // TODO: Update with actual refund endpoint
      const response = await this.client.post('/payments/refund', {
        transaction_id: transactionId,
        amount
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.data.success) {
        throw new PaymentFailedError(
          response.data.message || 'Refund processing failed',
          response.data
        );
      }

      logger.transaction('refund_processed', {
        originalTransactionId: transactionId,
        amount,
        refundId: response.data.refund_id
      });

      return {
        id: response.data.refund_id,
        status: response.data.status,
        amount,
        original_transaction_id: transactionId,
        created_at: new Date().toISOString(),
        raw_response: response.data
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'refundPayment',
        transactionId,
        amount
      });

      if (error instanceof PaymentFailedError) {
        throw error;
      }

      throw new PaymentFailedError('Refund processing failed', error.message);
    }
  }

  /**
   * Check gateway health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      // Try to authenticate
      await this.authenticate();

      // Try to get wallet balance
      await this.getWalletBalance();

      return {
        status: 'healthy',
        gateway: 'xash.co.zw',
        baseURL: this.baseURL,
        authenticated: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Gateway health check failed', {
        error: error.message
      });

      return {
        status: 'unhealthy',
        gateway: 'xash.co.zw',
        baseURL: this.baseURL,
        authenticated: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Sync pool account balance with gateway wallet
   * This method should be called periodically to keep balances in sync
   * 
   * @returns {Promise<Object>} Sync result with balance information
   */
  async syncPoolBalance() {
    try {
      logger.info('Starting pool balance sync with gateway');

      const walletBalance = await this.getWalletBalance();

      // Return the available balance for pool account sync
      return {
        success: true,
        gateway_balance: walletBalance.available_balance,
        total_balance: walletBalance.total_balance,
        pending_balance: walletBalance.pending_balance,
        on_hold: walletBalance.on_hold,
        currency: walletBalance.currency,
        synced_at: new Date().toISOString()
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'syncPoolBalance'
      });

      throw new ServiceUnavailableError(
        'Payment Gateway',
        'Failed to sync pool balance'
      );
    }
  }

  /**
   * Get transaction history from gateway
   * Note: Implementation depends on available gateway endpoints
   * 
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(filters = {}) {
    try {
      const token = await this.authenticate();

      // TODO: Update with actual transactions endpoint
      const response = await this.client.get('/transactions', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: filters
      });

      if (!response.data.success) {
        throw new ServiceUnavailableError(
          'Payment Gateway',
          'Failed to retrieve transaction history'
        );
      }

      return response.data.data || [];
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTransactionHistory'
      });

      throw new ServiceUnavailableError(
        'Payment Gateway',
        'Failed to retrieve transaction history'
      );
    }
  }

  /**
   * Validate gateway connection and credentials
   * @returns {Promise<boolean>} True if valid
   */
  async validateConnection() {
    try {
      await this.authenticate();
      return true;
    } catch (error) {
      logger.error('Gateway connection validation failed', {
        error: error.message
      });
      return false;
    }
  }
}

// Export singleton instance
module.exports = new PaymentGatewayService();