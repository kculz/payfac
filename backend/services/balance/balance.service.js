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
      const balance = await balanceRepository.create({
        user_id: userId,
        available_balance: 0,
        pending_balance: 0,
        reserved_balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        currency: 'USD'
      });

      logger.info('Balance initialized', { userId });

      return {
        available: 0,
        pending: 0,
        reserved: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        currency: 'USD',
        lastUpdated: balance.updated_at
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'initializeBalance',
        userId
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

      // Credit balance
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
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance),
        reserved: parseFloat(balance.reserved_balance),
        totalEarned: parseFloat(balance.total_earned)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'creditBalance',
        userId,
        amount,
        transactionId
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
      return await prisma.$transaction(async (tx) => {
        // Get current balance with lock
        const currentBalance = await tx.accountBalance.findUnique({
          where: { user_id: userId }
        });

        if (!currentBalance) {
          throw new NotFoundError('Balance');
        }

        // Check sufficient balance
        if (parseFloat(currentBalance.available_balance) < amount) {
          throw new InsufficientBalanceError(
            amount,
            parseFloat(currentBalance.available_balance)
          );
        }

        // Debit balance
        const balance = await tx.accountBalance.update({
          where: { user_id: userId },
          data: {
            available_balance: {
              decrement: amount
            }
          }
        });

        logger.info('Balance debited', {
          userId,
          amount,
          transactionId,
          newBalance: balance.available_balance
        });

        return {
          available: parseFloat(balance.available_balance),
          pending: parseFloat(balance.pending_balance),
          reserved: parseFloat(balance.reserved_balance),
          totalWithdrawn: parseFloat(balance.total_withdrawn)
        };
      });
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
      return await prisma.$transaction(async (tx) => {
        const currentBalance = await tx.accountBalance.findUnique({
          where: { user_id: userId }
        });

        if (!currentBalance) {
          throw new NotFoundError('Balance');
        }

        // Check sufficient available balance
        if (parseFloat(currentBalance.available_balance) < amount) {
          throw new InsufficientBalanceError(
            amount,
            parseFloat(currentBalance.available_balance)
          );
        }

        // Move funds from available to reserved
        const balance = await tx.accountBalance.update({
          where: { user_id: userId },
          data: {
            available_balance: {
              decrement: amount
            },
            reserved_balance: {
              increment: amount
            }
          }
        });

        logger.info('Funds reserved', {
          userId,
          amount,
          newAvailable: balance.available_balance,
          newReserved: balance.reserved_balance
        });

        return {
          available: parseFloat(balance.available_balance),
          reserved: parseFloat(balance.reserved_balance)
        };
      });
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
      const balance = await prisma.accountBalance.update({
        where: { user_id: userId },
        data: {
          available_balance: {
            increment: amount
          },
          reserved_balance: {
            decrement: amount
          }
        }
      });

      logger.info('Reserved funds released', {
        userId,
        amount,
        newAvailable: balance.available_balance,
        newReserved: balance.reserved_balance
      });

      return {
        available: parseFloat(balance.available_balance),
        reserved: parseFloat(balance.reserved_balance)
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
      const balance = await prisma.accountBalance.update({
        where: { user_id: userId },
        data: {
          reserved_balance: {
            decrement: amount
          }
        }
      });

      logger.info('Reserved transaction completed', {
        userId,
        amount,
        newReserved: balance.reserved_balance
      });

      return {
        available: parseFloat(balance.available_balance),
        reserved: parseFloat(balance.reserved_balance)
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
      const balance = await prisma.accountBalance.update({
        where: { user_id: userId },
        data: {
          pending_balance: {
            increment: amount
          }
        }
      });

      logger.info('Funds moved to pending', {
        userId,
        amount,
        newPending: balance.pending_balance
      });

      return {
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance)
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
      return await prisma.$transaction(async (tx) => {
        const currentBalance = await tx.accountBalance.findUnique({
          where: { user_id: userId }
        });

        if (!currentBalance) {
          throw new NotFoundError('Balance');
        }

        if (parseFloat(currentBalance.pending_balance) < amount) {
          throw new DatabaseError('Insufficient pending balance');
        }

        const balance = await tx.accountBalance.update({
          where: { user_id: userId },
          data: {
            pending_balance: {
              decrement: amount
            },
            available_balance: {
              increment: amount
            },
            total_earned: {
              increment: amount
            }
          }
        });

        logger.info('Pending funds approved', {
          userId,
          amount,
          newAvailable: balance.available_balance,
          newPending: balance.pending_balance
        });

        return {
          available: parseFloat(balance.available_balance),
          pending: parseFloat(balance.pending_balance)
        };
      });
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
      const balance = await prisma.accountBalance.update({
        where: { user_id: userId },
        data: {
          pending_balance: {
            decrement: amount
          }
        }
      });

      logger.info('Pending funds rejected', {
        userId,
        amount,
        newPending: balance.pending_balance
      });

      return {
        available: parseFloat(balance.available_balance),
        pending: parseFloat(balance.pending_balance)
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
      const balance = await prisma.accountBalance.update({
        where: { user_id: userId },
        data: {
          total_withdrawn: {
            increment: amount
          }
        }
      });

      logger.info('Withdrawal recorded', {
        userId,
        amount,
        totalWithdrawn: balance.total_withdrawn
      });

      return {
        totalWithdrawn: parseFloat(balance.total_withdrawn)
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
      const balances = await prisma.accountBalance.findMany({
        where: {
          user_id: { in: userIds }
        }
      });

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
      const result = await prisma.accountBalance.aggregate({
        _sum: {
          available_balance: true,
          pending_balance: true,
          reserved_balance: true
        }
      });

      const total = 
        (parseFloat(result._sum.available_balance) || 0) +
        (parseFloat(result._sum.pending_balance) || 0) +
        (parseFloat(result._sum.reserved_balance) || 0);

      return total;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTotalAllocated'
      });
      throw new DatabaseError('Failed to get total allocated balance');
    }
  }
}

// Export singleton instance
module.exports = new BalanceService();