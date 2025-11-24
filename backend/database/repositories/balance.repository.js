/**
 * Balance Repository
 * 
 * Handles database operations for account balances.
 * 
 * Location: src/database/repositories/balanceRepository.js
 */

const BaseRepository = require('./base.repository');
const logger = require('../../src/shared/utils/logger');
const { DatabaseError } = require('../../src/shared/utils/ApiError');

class BalanceRepository extends BaseRepository {
  constructor() {
    super('accountBalance');
  }

  /**
   * Get balance by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Balance or null
   */
  async getByUserId(userId) {
    try {
      return await this.findOne({ user_id: userId });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getByUserId',
        userId
      });
      throw error;
    }
  }

  /**
   * Get balance by user ID or create if doesn't exist
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Balance
   */
  async getOrCreate(userId) {
    try {
      let balance = await this.getByUserId(userId);

      if (!balance) {
        balance = await this.create({
          user_id: userId,
          available_balance: 0,
          pending_balance: 0,
          reserved_balance: 0,
          total_earned: 0,
          total_withdrawn: 0,
          currency: 'USD'
        });

        logger.info('Balance created for user', { userId });
      }

      return balance;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getOrCreate',
        userId
      });
      throw error;
    }
  }

  /**
   * Update balance atomically
   * @param {string} userId - User ID
   * @param {Object} updates - Balance updates
   * @returns {Promise<Object>} Updated balance
   */
  async updateBalance(userId, updates) {
    try {
      const balance = await this.model.update({
        where: { user_id: userId },
        data: updates
      });

      logger.info('Balance updated', {
        userId,
        updates: logger.sanitize(updates)
      });

      return balance;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'updateBalance',
        userId,
        updates
      });
      throw new DatabaseError('Failed to update balance');
    }
  }

  /**
   * Credit available balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to credit
   * @returns {Promise<Object>} Updated balance
   */
  async creditAvailable(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        available_balance: { increment: amount },
        total_earned: { increment: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'creditAvailable',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Debit available balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to debit
   * @returns {Promise<Object>} Updated balance
   */
  async debitAvailable(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        available_balance: { decrement: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'debitAvailable',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Move funds from available to reserved
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reserve
   * @returns {Promise<Object>} Updated balance
   */
  async reserveFromAvailable(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        available_balance: { decrement: amount },
        reserved_balance: { increment: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'reserveFromAvailable',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Release reserved funds back to available
   * @param {string} userId - User ID
   * @param {number} amount - Amount to release
   * @returns {Promise<Object>} Updated balance
   */
  async releaseReserved(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        reserved_balance: { decrement: amount },
        available_balance: { increment: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'releaseReserved',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Complete reserved transaction (deduct from reserved)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to complete
   * @returns {Promise<Object>} Updated balance
   */
  async completeReserved(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        reserved_balance: { decrement: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'completeReserved',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Add to pending balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add to pending
   * @returns {Promise<Object>} Updated balance
   */
  async addToPending(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        pending_balance: { increment: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'addToPending',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Move from pending to available (approval)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to approve
   * @returns {Promise<Object>} Updated balance
   */
  async approvePending(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        pending_balance: { decrement: amount },
        available_balance: { increment: amount },
        total_earned: { increment: amount }
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
   * Remove from pending (rejection)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reject
   * @returns {Promise<Object>} Updated balance
   */
  async rejectPending(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        pending_balance: { decrement: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'rejectPending',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Record withdrawal
   * @param {string} userId - User ID
   * @param {number} amount - Withdrawal amount
   * @returns {Promise<Object>} Updated balance
   */
  async recordWithdrawal(userId, amount) {
    try {
      return await this.updateBalance(userId, {
        total_withdrawn: { increment: amount }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'recordWithdrawal',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Get all balances (admin)
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated balances
   */
  async getAllBalances(filters = {}, pagination = {}) {
    try {
      const where = {};

      // Filter by minimum balance
      if (filters.minBalance) {
        where.available_balance = { gte: filters.minBalance };
      }

      // Filter by maximum balance
      if (filters.maxBalance) {
        where.available_balance = { ...where.available_balance, lte: filters.maxBalance };
      }

      return this.paginate(where, {
        ...pagination,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              business_name: true,
              status: true
            }
          }
        },
        orderBy: { available_balance: 'desc' }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getAllBalances'
      });
      throw error;
    }
  }

  /**
   * Get total allocated balance across all users
   * @returns {Promise<Object>} Aggregate balances
   */
  async getTotalAllocated() {
    try {
      const result = await this.aggregate({
        _sum: {
          available_balance: true,
          pending_balance: true,
          reserved_balance: true
        }
      });

      return {
        available: parseFloat(result._sum.available_balance) || 0,
        pending: parseFloat(result._sum.pending_balance) || 0,
        reserved: parseFloat(result._sum.reserved_balance) || 0,
        total: (parseFloat(result._sum.available_balance) || 0) +
               (parseFloat(result._sum.pending_balance) || 0) +
               (parseFloat(result._sum.reserved_balance) || 0)
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTotalAllocated'
      });
      throw error;
    }
  }

  /**
   * Get users with low balance
   * @param {number} threshold - Balance threshold
   * @returns {Promise<Array>} Users with low balance
   */
  async getLowBalanceUsers(threshold = 100) {
    try {
      return await this.findMany(
        {
          available_balance: { lt: threshold }
        },
        {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                business_name: true
              }
            }
          }
        }
      );
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getLowBalanceUsers',
        threshold
      });
      throw error;
    }
  }

  /**
   * Get balance statistics
   * @returns {Promise<Object>} Statistics
   */
  async getStats() {
    try {
      const [total, aggregates] = await Promise.all([
        this.count(),
        this.aggregate({
          _sum: {
            available_balance: true,
            pending_balance: true,
            reserved_balance: true,
            total_earned: true,
            total_withdrawn: true
          },
          _avg: {
            available_balance: true
          },
          _max: {
            available_balance: true
          },
          _min: {
            available_balance: true
          }
        })
      ]);

      return {
        totalUsers: total,
        totalAllocated: {
          available: parseFloat(aggregates._sum.available_balance) || 0,
          pending: parseFloat(aggregates._sum.pending_balance) || 0,
          reserved: parseFloat(aggregates._sum.reserved_balance) || 0
        },
        lifetime: {
          earned: parseFloat(aggregates._sum.total_earned) || 0,
          withdrawn: parseFloat(aggregates._sum.total_withdrawn) || 0
        },
        averageBalance: parseFloat(aggregates._avg.available_balance) || 0,
        maxBalance: parseFloat(aggregates._max.available_balance) || 0,
        minBalance: parseFloat(aggregates._min.available_balance) || 0
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getStats'
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new BalanceRepository();