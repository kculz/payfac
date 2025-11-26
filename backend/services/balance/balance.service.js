/**
 * Balance Service
 * 
 * Manages user account balances and ensures balance integrity.
 * Works in conjunction with Pool Account Service.
 * 
 * Location: src/services/balance/balanceService.js
 */

const balanceRepository = require('../../database/repositories/balance.repository');
const ledgerService = require('./ledger.service');
const logger = require('../../src/shared/utils/logger');
const {
  InsufficientBalanceError,
  NotFoundError,
  DatabaseError
} = require('../../src/shared/utils/ApiError');

class BalanceService {
  /**
   * Get user's balance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Balance information
   */
  async getBalance(userId) {
    try {
      const balance = await balanceRepository.getOrCreate(userId);

      if (!balance) {
        throw new NotFoundError('Balance');
      }

      return {
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance),
        reserved: parseFloat(balance.reserved_balance),
        totalEarned: parseFloat(balance.total_earned),
        totalWithdrawn: parseFloat(balance.total_withdrawn),
        currency: balance.currency,
        lastUpdated: balance.updated_at
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getBalance',
        userId
      });
      throw new DatabaseError('Failed to get balance');
    }
  }

  /**
   * Initialize balance for a new user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created balance
   */
  async initializeBalance(userId) {
    try {
      // Use getOrCreate instead of create to handle duplicates gracefully
      const balance = await balanceRepository.getOrCreate(userId);

      logger.info('Balance initialized', { userId });

      return {
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance),
        reserved: parseFloat(balance.reserved_balance),
        totalEarned: parseFloat(balance.total_earned),
        totalWithdrawn: parseFloat(balance.total_withdrawn),
        currency: balance.currency,
        lastUpdated: balance.updated_at
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'initializeBalance',
        userId,
        error: error.message
      });
      throw new DatabaseError('Failed to initialize balance');
    }
  }

  /**
   * Check if user has sufficient available balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to check
   * @returns {Promise<boolean>} True if sufficient balance
   */
  async checkSufficientBalance(userId, amount) {
    try {
      const balance = await balanceRepository.getByUserId(userId);

      if (!balance) {
        return false;
      }

      return parseFloat(balance.available_balance) >= amount;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'checkSufficientBalance',
        userId,
        amount
      });
      throw new DatabaseError('Failed to check balance');
    }
  }

  /**
   * Credit balance (add funds) with ledger entry
   * Used for deposits, refunds, etc.
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to credit
   * @param {string} source - Source of credit
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Updated balance
   */
  async creditBalance(userId, amount, source = 'deposit', metadata = {}) {
    if (amount <= 0) {
      throw new DatabaseError('Credit amount must be positive');
    }

    try {
      // Get current balance
      const currentBalance = await balanceRepository.getOrCreate(userId);
      const balanceBefore = parseFloat(currentBalance.available_balance);

      // Credit balance using repository
      const updatedBalance = await balanceRepository.creditAvailable(userId, amount);
      const balanceAfter = parseFloat(updatedBalance.available_balance);

      // Record in ledger
      await ledgerService.recordCredit(
        userId,
        amount,
        balanceBefore,
        balanceAfter,
        source,
        metadata
      );

      return {
        available: balanceAfter,
        pending: parseFloat(updatedBalance.pending_balance),
        reserved: parseFloat(updatedBalance.reserved_balance),
        totalEarned: parseFloat(updatedBalance.total_earned)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'creditBalance',
        userId,
        amount,
        source
      });
      throw new DatabaseError('Failed to credit balance');
    }
  }

  /**
   * Debit balance (remove funds)
   * Used for sales, withdrawals, fees, etc.
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to debit
   * @param {string} transactionId - Related transaction ID
   * @returns {Promise<Object>} Updated balance
   */
  async debitBalance(userId, amount, transactionId = null) {
    if (amount <= 0) {
      throw new DatabaseError('Debit amount must be positive');
    }

    try {
      const result = await balanceRepository.debitAvailable(userId, amount);

      logger.info('Balance debited', {
        userId,
        amount,
        transactionId,
        newBalance: result.available_balance
      });

      return {
        available: parseFloat(result.available_balance),
        pending: parseFloat(result.pending_balance),
        reserved: parseFloat(result.reserved_balance),
        totalWithdrawn: parseFloat(result.total_withdrawn)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'debitBalance',
        userId,
        amount,
        transactionId
      });
      throw error;
    }
  }

  /**
   * Reserve funds (move from available to reserved)
   * Used when initiating a transaction before completion
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reserve
   * @returns {Promise<Object>} Updated balance
   */
  async reserveFunds(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Reserve amount must be positive');
    }

    try {
      const result = await balanceRepository.reserveFunds(userId, amount);

      logger.info('Funds reserved', {
        userId,
        amount,
        newAvailable: result.available_balance,
        newReserved: result.reserved_balance
      });

      return {
        available: parseFloat(result.available_balance),
        reserved: parseFloat(result.reserved_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reserveFunds',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Release reserved funds back to available
   * Used when a transaction fails or is cancelled
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to release
   * @returns {Promise<Object>} Updated balance
   */
  async releaseReservedFunds(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Release amount must be positive');
    }

    try {
      const result = await balanceRepository.releaseReservedFunds(userId, amount);

      logger.info('Reserved funds released', {
        userId,
        amount,
        newAvailable: result.available_balance,
        newReserved: result.reserved_balance
      });

      return {
        available: parseFloat(result.available_balance),
        reserved: parseFloat(result.reserved_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'releaseReservedFunds',
        userId,
        amount
      });
      throw new DatabaseError('Failed to release reserved funds');
    }
  }

  /**
   * Complete reserved transaction (deduct from reserved)
   * Used when a transaction completes successfully
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to complete
   * @returns {Promise<Object>} Updated balance
   */
  async completeReservedTransaction(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Amount must be positive');
    }

    try {
      const result = await balanceRepository.completeReservedTransaction(userId, amount);

      logger.info('Reserved transaction completed', {
        userId,
        amount,
        newReserved: result.reserved_balance
      });

      return {
        available: parseFloat(result.available_balance),
        reserved: parseFloat(result.reserved_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'completeReservedTransaction',
        userId,
        amount
      });
      throw new DatabaseError('Failed to complete reserved transaction');
    }
  }

  /**
   * Move funds to pending (for deposits awaiting approval)
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to move to pending
   * @returns {Promise<Object>} Updated balance
   */
  async moveToPending(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Amount must be positive');
    }

    try {
      const result = await balanceRepository.moveToPending(userId, amount);

      logger.info('Funds moved to pending', {
        userId,
        amount,
        newPending: result.pending_balance
      });

      return {
        available: parseFloat(result.available_balance),
        pending: parseFloat(result.pending_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'moveToPending',
        userId,
        amount
      });
      throw new DatabaseError('Failed to move funds to pending');
    }
  }

  /**
   * Approve pending funds (move from pending to available)
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to approve
   * @returns {Promise<Object>} Updated balance
   */
  async approvePending(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Amount must be positive');
    }

    try {
      const result = await balanceRepository.approvePending(userId, amount);

      logger.info('Pending funds approved', {
        userId,
        amount,
        newAvailable: result.available_balance,
        newPending: result.pending_balance
      });

      return {
        available: parseFloat(result.available_balance),
        pending: parseFloat(result.pending_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'approvePending',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Reject pending funds (remove from pending)
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reject
   * @returns {Promise<Object>} Updated balance
   */
  async rejectPending(userId, amount) {
    if (amount <= 0) {
      throw new DatabaseError('Amount must be positive');
    }

    try {
      const result = await balanceRepository.rejectPending(userId, amount);

      logger.info('Pending funds rejected', {
        userId,
        amount,
        newPending: result.pending_balance
      });

      return {
        available: parseFloat(result.available_balance),
        pending: parseFloat(result.pending_balance)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'rejectPending',
        userId,
        amount
      });
      throw new DatabaseError('Failed to reject pending funds');
    }
  }

  /**
   * Record withdrawal (update total_withdrawn)
   * 
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @returns {Promise<Object>} Updated balance
   */
  async recordWithdrawal(userId, amount) {
    try {
      const result = await balanceRepository.recordWithdrawal(userId, amount);

      logger.info('Withdrawal recorded', {
        userId,
        amount,
        totalWithdrawn: result.total_withdrawn
      });

      return {
        totalWithdrawn: parseFloat(result.total_withdrawn)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'recordWithdrawal',
        userId,
        amount
      });
      throw new DatabaseError('Failed to record withdrawal');
    }
  }

  /**
   * Get balance summary with statistics
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Detailed balance summary
   */
  async getBalanceSummary(userId) {
    try {
      const balance = await this.getBalance(userId);

      // Calculate net balance
      const netBalance = balance.totalEarned - balance.totalWithdrawn;

      return {
        ...balance,
        netBalance,
        balanceBreakdown: {
          liquid: balance.available, // Can be used immediately
          pending: balance.pending, // Awaiting approval
          reserved: balance.reserved, // Reserved for pending transactions
          total: balance.available + balance.pending + balance.reserved
        },
        lifetime: {
          earned: balance.totalEarned,
          withdrawn: balance.totalWithdrawn,
          net: netBalance
        }
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getBalanceSummary',
        userId
      });
      throw error;
    }
  }

  /**
   * Get multiple users' balances
   * @param {Array<string>} userIds - Array of user IDs
   * @returns {Promise<Array>} Array of balances
   */
  async getMultipleBalances(userIds) {
    try {
      const balances = await balanceRepository.getMultipleBalances(userIds);

      return balances.map(balance => ({
        userId: balance.user_id,
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance),
        reserved: parseFloat(balance.reserved_balance),
        currency: balance.currency
      }));
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getMultipleBalances',
        userIds
      });
      throw new DatabaseError('Failed to get multiple balances');
    }
  }

  /**
   * Get total allocated balance across all users
   * @returns {Promise<number>} Total allocated balance
   */
  async getTotalAllocated() {
    try {
      const result = await balanceRepository.getTotalAllocated();

      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTotalAllocated'
      });
      throw new DatabaseError('Failed to get total allocated balance');
    }
  }

  /**
   * Reconcile user balance
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Reconciliation result
   */
  async reconcileBalance(userId) {
    try {
      const result = await ledgerService.reconcileBalance(userId);
      return result;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reconcileBalance',
        userId
      });
      throw new DatabaseError('Failed to reconcile balance');
    }
  }

  /**
   * Get balance history/ledger
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated ledger entries
   */
  async getBalanceHistory(userId, filters = {}, pagination = {}) {
    try {
      const history = await ledgerService.getUserLedger(userId, filters, pagination);
      return history;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getBalanceHistory',
        userId
      });
      throw new DatabaseError('Failed to get balance history');
    }
  }

  /**
   * Get balance statistics
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Balance statistics
   */
  async getBalanceStats(userId, startDate = null, endDate = null) {
    try {
      const stats = await ledgerService.getUserLedgerSummary(userId, startDate, endDate);
      return stats;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getBalanceStats',
        userId
      });
      throw new DatabaseError('Failed to get balance statistics');
    }
  }
}

// Export singleton instance
module.exports = new BalanceService();