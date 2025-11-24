/**
 * Transaction Service
 * 
 * Handles all transaction-related business logic.
 * Processes sales, refunds, and manages transaction lifecycle.
 * 
 * Location: src/services/transaction/transactionService.js
 */

const transactionRepository = require('../../database/repositories/transaction.repository');
const balanceService = require('../balance/balance.service');
const poolAccountService = require('../poolAccount/poolAccount.service');
const paymentGatewayService = require('../payment/paymentGateway.service');
const logger = require('../../src/shared/utils/logger');
const config = require('../../src/config/environment.config');
const {
  InsufficientBalanceError,
  PaymentFailedError,
  TransactionLimitError,
  BadRequestError,
  NotFoundError
} = require('../../src/shared/utils/ApiError');

class TransactionService {
  /**
   * Process a sale transaction
   * @param {string} userId - User ID
   * @param {Object} saleData - Sale data
   * @returns {Promise<Object>} Completed transaction
   */
  async processSale(userId, saleData) {
    const { amount, customer_name, customer_email, description, items, metadata } = saleData;

    try {
      // Validate amount limits
      if (amount < config.limits.minTransactionAmount) {
        throw new TransactionLimitError(config.limits.minTransactionAmount, 'minimum');
      }

      if (amount > config.limits.maxTransactionAmount) {
        throw new TransactionLimitError(config.limits.maxTransactionAmount, 'maximum');
      }

      // Check user has sufficient balance
      const hasSufficientBalance = await balanceService.checkSufficientBalance(userId, amount);
      
      if (!hasSufficientBalance) {
        const balance = await balanceService.getBalance(userId);
        throw new InsufficientBalanceError(amount, balance.available);
      }

      // Reserve funds before processing
      await balanceService.reserveFunds(userId, amount);

      let transaction;
      
      try {
        // Process payment through gateway (if needed)
        // For now, we just deduct from balance since gateway handles the actual payment
        
        // Create transaction record
        transaction = await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          currency: 'USD',
          status: 'COMPLETED',
          customer_name,
          customer_email,
          description,
          metadata: items ? { items, ...metadata } : metadata,
          completed_at: new Date()
        });

        // Deallocate from pool and user balance
        await poolAccountService.deallocateFromUser(userId, amount);

        // Release reserved funds (already deducted by deallocate)
        await balanceService.completeReservedTransaction(userId, amount);

        logger.transaction('sale_completed', {
          id: transaction.id,
          userId,
          amount,
          status: transaction.status
        });

        return transaction;

      } catch (error) {
        // Rollback: Release reserved funds
        await balanceService.releaseReservedFunds(userId, amount);

        // Create failed transaction record
        await transactionRepository.create({
          user_id: userId,
          transaction_type: 'SALE',
          amount,
          status: 'FAILED',
          description,
          error_message: error.message,
          failed_at: new Date()
        });

        throw new PaymentFailedError('Sale processing failed', error.message);
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'processSale',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Process a refund
   * @param {string} userId - User ID
   * @param {string} transactionId - Original transaction ID
   * @param {Object} refundData - Refund data
   * @returns {Promise<Object>} Refund transaction
   */
  async processRefund(userId, transactionId, refundData) {
    const { amount: refundAmount, reason } = refundData;

    try {
      // Get original transaction
      const originalTransaction = await transactionRepository.findById(transactionId);

      if (!originalTransaction) {
        throw new NotFoundError('Transaction');
      }

      // Verify ownership
      if (originalTransaction.user_id !== userId) {
        throw new BadRequestError('You can only refund your own transactions');
      }

      // Verify transaction is refundable
      if (originalTransaction.status !== 'COMPLETED') {
        throw new BadRequestError('Only completed transactions can be refunded');
      }

      if (originalTransaction.transaction_type !== 'SALE') {
        throw new BadRequestError('Only sale transactions can be refunded');
      }

      // Determine refund amount
      const amount = refundAmount || parseFloat(originalTransaction.amount);

      // Validate refund amount
      if (amount > parseFloat(originalTransaction.amount)) {
        throw new BadRequestError('Refund amount cannot exceed original transaction amount');
      }

      // Create refund transaction using repository method
      const refundTransaction = await transactionRepository.createRefund(
        {
          user_id: userId,
          transaction_type: 'REFUND',
          amount,
          currency: originalTransaction.currency,
          status: 'COMPLETED',
          description: `Refund for transaction ${transactionId}: ${reason}`,
          metadata: {
            original_transaction_id: transactionId,
            reason
          },
          completed_at: new Date()
        },
        transactionId
      );

      // Allocate funds back to user
      await poolAccountService.allocateToUser(userId, amount);

      logger.transaction('refund_completed', {
        id: refundTransaction.id,
        originalTransactionId: transactionId,
        userId,
        amount
      });

      return refundTransaction;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'processRefund',
        userId,
        transactionId
      });
      throw error;
    }
  }

  /**
   * Get transaction by ID
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<Object>} Transaction
   */
  async getTransaction(transactionId, userId = null) {
    try {
      const transaction = await transactionRepository.getWithRelations(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      // Verify ownership if userId provided
      if (userId && transaction.user_id !== userId) {
        throw new BadRequestError('Unauthorized to view this transaction');
      }

      return transaction;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTransaction',
        transactionId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get transaction history for user
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated transactions
   */
  async getTransactionHistory(userId, filters = {}, pagination = {}) {
    try {
      return await transactionRepository.findByUserId(userId, filters, pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTransactionHistory',
        userId
      });
      throw error;
    }
  }

  /**
   * Get transaction statistics
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Statistics
   */
  async getTransactionStats(userId, startDate = null, endDate = null) {
    try {
      // Default to last 30 days if no dates provided
      if (!startDate) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }

      if (!endDate) {
        endDate = new Date();
      }

      return await transactionRepository.getStats(userId, startDate, endDate);

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTransactionStats',
        userId
      });
      throw error;
    }
  }

  /**
   * Get recent transactions
   * @param {string} userId - User ID
   * @param {number} limit - Number of transactions
   * @returns {Promise<Array>} Recent transactions
   */
  async getRecentTransactions(userId, limit = 10) {
    try {
      return await transactionRepository.getRecent(userId, limit);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getRecentTransactions',
        userId
      });
      throw error;
    }
  }

  /**
   * Get daily summary
   * @param {string} userId - User ID
   * @param {Date} date - Date to get summary for
   * @returns {Promise<Object>} Daily summary
   */
  async getDailySummary(userId, date = new Date()) {
    try {
      return await transactionRepository.getDailySummary(userId, date);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getDailySummary',
        userId
      });
      throw error;
    }
  }

  /**
   * Get monthly summary
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Object>} Monthly summary
   */
  async getMonthlySummary(userId, year, month) {
    try {
      return await transactionRepository.getMonthlySummary(userId, year, month);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getMonthlySummary',
        userId
      });
      throw error;
    }
  }

  /**
   * Search transactions
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching transactions
   */
  async searchTransactions(userId, query, options = {}) {
    try {
      return await transactionRepository.search(userId, query, options);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'searchTransactions',
        userId,
        query
      });
      throw error;
    }
  }

  /**
   * Cancel a pending transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated transaction
   */
  async cancelTransaction(transactionId, userId) {
    try {
      const transaction = await transactionRepository.findById(transactionId);

      if (!transaction) {
        throw new NotFoundError('Transaction');
      }

      if (transaction.user_id !== userId) {
        throw new BadRequestError('Unauthorized to cancel this transaction');
      }

      if (transaction.status !== 'PENDING') {
        throw new BadRequestError('Only pending transactions can be cancelled');
      }

      // Release reserved funds if any
      if (parseFloat(transaction.amount) > 0) {
        await balanceService.releaseReservedFunds(userId, parseFloat(transaction.amount));
      }

      // Update transaction status
      const updated = await transactionRepository.updateStatus(transactionId, 'CANCELLED');

      logger.info('Transaction cancelled', {
        transactionId,
        userId
      });

      return updated;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'cancelTransaction',
        transactionId,
        userId
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new TransactionService();