/**
 * Transaction Repository
 * 
 * Handles all database operations related to transactions.
 * Includes specialized methods for financial operations.
 * 
 * Location: src/database/repositories/transactionRepository.js
 */

const BaseRepository = require('./base.repository');
const { prisma } = require('../../src/config/database.config');
const logger = require('../../src/shared/utils/logger');
const { DatabaseError } = require('../../src/shared/utils/ApiError');

class TransactionRepository extends BaseRepository {
  constructor() {
    super('transaction');
  }

  /**
   * Find transactions by user ID with pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated transactions
   */
  async findByUserId(userId, filters = {}, pagination = {}) {
    const { status, type, startDate, endDate } = filters;

    const where = { user_id: userId };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.transaction_type = type;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    return this.paginate(where, {
      ...pagination,
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Get transaction by gateway transaction ID
   * @param {string} gatewayTransactionId - Gateway transaction ID
   * @returns {Promise<Object|null>} Transaction or null
   */
  async findByGatewayId(gatewayTransactionId) {
    return this.findOne({
      gateway_transaction_id: gatewayTransactionId
    });
  }

  /**
   * Create transaction with balance update (atomic operation)
   * @param {Object} transactionData - Transaction data
   * @param {string} userId - User ID
   * @param {number} balanceChange - Balance change amount (negative for debit)
   * @returns {Promise<Object>} Created transaction
   */
  async createWithBalanceUpdate(transactionData, userId, balanceChange) {
    try {
      return await this.transaction(async (tx) => {
        // Create transaction
        const transaction = await tx.transaction.create({
          data: transactionData
        });

        // Update balance
        if (balanceChange !== 0) {
          await tx.accountBalance.update({
            where: { user_id: userId },
            data: {
              available_balance: {
                [balanceChange > 0 ? 'increment' : 'decrement']: Math.abs(balanceChange)
              }
            }
          });
        }

        logger.transaction('created', {
          id: transaction.id,
          userId,
          amount: transactionData.amount,
          type: transactionData.transaction_type,
          status: transactionData.status
        });

        return transaction;
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'createWithBalanceUpdate',
        userId,
        balanceChange
      });
      throw new DatabaseError('Failed to create transaction with balance update', error.message);
    }
  }

  /**
   * Update transaction status
   * @param {string} transactionId - Transaction ID
   * @param {string} status - New status
   * @param {Object} additionalData - Additional data to update
   * @returns {Promise<Object>} Updated transaction
   */
  async updateStatus(transactionId, status, additionalData = {}) {
    const updateData = {
      status,
      ...additionalData
    };

    if (status === 'COMPLETED' && !additionalData.completed_at) {
      updateData.completed_at = new Date();
    }

    if (status === 'FAILED' && !additionalData.failed_at) {
      updateData.failed_at = new Date();
    }

    const transaction = await this.update(transactionId, updateData);

    logger.transaction('status_updated', {
      id: transaction.id,
      userId: transaction.user_id,
      status,
      type: transaction.transaction_type
    });

    return transaction;
  }

  /**
   * Get total sales for user within date range
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Aggregated sales data
   */
  async getTotalSales(userId, startDate, endDate) {
    try {
      const result = await this.aggregate({
        where: {
          user_id: userId,
          transaction_type: 'SALE',
          status: 'COMPLETED',
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          amount: true
        },
        _count: true,
        _avg: {
          amount: true
        }
      });

      return {
        totalAmount: result._sum.amount ? parseFloat(result._sum.amount) : 0,
        count: result._count,
        averageAmount: result._avg.amount ? parseFloat(result._avg.amount) : 0
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getTotalSales',
        userId,
        startDate,
        endDate
      });
      throw new DatabaseError('Failed to get total sales', error.message);
    }
  }

  /**
   * Get transaction statistics for user
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Promise<Object>} Transaction statistics
   */
  async getStats(userId, startDate = null, endDate = null) {
    const where = {
      user_id: userId,
      status: 'COMPLETED'
    };

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }

    try {
      const [sales, deposits, refunds, payouts] = await Promise.all([
        this.aggregate({
          where: { ...where, transaction_type: 'SALE' },
          _sum: { amount: true },
          _count: true
        }),
        this.aggregate({
          where: { ...where, transaction_type: 'DEPOSIT' },
          _sum: { amount: true },
          _count: true
        }),
        this.aggregate({
          where: { ...where, transaction_type: 'REFUND' },
          _sum: { amount: true },
          _count: true
        }),
        this.aggregate({
          where: { ...where, transaction_type: 'PAYOUT' },
          _sum: { amount: true },
          _count: true
        })
      ]);

      return {
        sales: {
          total: sales._sum.amount ? parseFloat(sales._sum.amount) : 0,
          count: sales._count
        },
        deposits: {
          total: deposits._sum.amount ? parseFloat(deposits._sum.amount) : 0,
          count: deposits._count
        },
        refunds: {
          total: refunds._sum.amount ? parseFloat(refunds._sum.amount) : 0,
          count: refunds._count
        },
        payouts: {
          total: payouts._sum.amount ? parseFloat(payouts._sum.amount) : 0,
          count: payouts._count
        }
      };
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getStats',
        userId
      });
      throw new DatabaseError('Failed to get transaction stats', error.message);
    }
  }

  /**
   * Get recent transactions for user
   * @param {string} userId - User ID
   * @param {number} limit - Number of transactions to fetch
   * @returns {Promise<Array>} Array of recent transactions
   */
  async getRecent(userId, limit = 10) {
    return this.findMany(
      { user_id: userId },
      {
        take: limit,
        orderBy: { created_at: 'desc' }
      }
    );
  }

  /**
   * Get pending transactions for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of pending transactions
   */
  async getPending(userId) {
    return this.findMany({
      user_id: userId,
      status: { in: ['PENDING', 'PROCESSING'] }
    });
  }

  /**
   * Get failed transactions for user
   * @param {string} userId - User ID
   * @param {number} daysBack - Number of days to look back
   * @returns {Promise<Array>} Array of failed transactions
   */
  async getFailed(userId, daysBack = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.findMany({
      user_id: userId,
      status: 'FAILED',
      created_at: { gte: startDate }
    });
  }

  /**
   * Get transaction history grouped by date
   * @param {string} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Grouped transaction data
   */
  async getGroupedByDate(userId, startDate, endDate) {
    try {
      // Use raw query for date grouping
      const result = await prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          transaction_type as type,
          COUNT(*) as count,
          SUM(amount) as total
        FROM transactions
        WHERE user_id = ${userId}
          AND status = 'COMPLETED'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY DATE(created_at), transaction_type
        ORDER BY date DESC, type
      `;

      return result.map(row => ({
        date: row.date,
        type: row.type,
        count: Number(row.count),
        total: parseFloat(row.total)
      }));
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getGroupedByDate',
        userId
      });
      throw new DatabaseError('Failed to get grouped transactions', error.message);
    }
  }

  /**
   * Get refundable transactions for user
   * Transactions that are completed and not yet refunded
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of refundable transactions
   */
  async getRefundable(userId) {
    return this.findMany({
      user_id: userId,
      transaction_type: 'SALE',
      status: 'COMPLETED',
      parent_transaction_id: null // Not already refunded
    });
  }

  /**
   * Create refund transaction
   * @param {Object} refundData - Refund data
   * @param {string} originalTransactionId - Original transaction ID
   * @returns {Promise<Object>} Created refund transaction
   */
  async createRefund(refundData, originalTransactionId) {
    try {
      return await this.transaction(async (tx) => {
        // Create refund transaction
        const refund = await tx.transaction.create({
          data: {
            ...refundData,
            parent_transaction_id: originalTransactionId
          }
        });

        // Update original transaction status
        await tx.transaction.update({
          where: { id: originalTransactionId },
          data: { status: 'REFUNDED' }
        });

        // Update user balance
        await tx.accountBalance.update({
          where: { user_id: refundData.user_id },
          data: {
            available_balance: {
              increment: parseFloat(refundData.amount)
            }
          }
        });

        logger.transaction('refund_created', {
          id: refund.id,
          originalTransactionId,
          userId: refundData.user_id,
          amount: refundData.amount
        });

        return refund;
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'createRefund',
        originalTransactionId
      });
      throw new DatabaseError('Failed to create refund', error.message);
    }
  }

  /**
   * Get daily transaction summary
   * @param {string} userId - User ID
   * @param {Date} date - Date to get summary for
   * @returns {Promise<Object>} Daily summary
   */
  async getDailySummary(userId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getStats(userId, startOfDay, endOfDay);
  }

  /**
   * Get monthly transaction summary
   * @param {string} userId - User ID
   * @param {number} year - Year
   * @param {number} month - Month (1-12)
   * @returns {Promise<Object>} Monthly summary
   */
  async getMonthlySummary(userId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    return this.getStats(userId, startDate, endDate);
  }

  /**
   * Search transactions
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Matching transactions
   */
  async search(userId, query, options = {}) {
    const where = {
      user_id: userId,
      OR: [
        { description: { contains: query, mode: 'insensitive' } },
        { customer_name: { contains: query, mode: 'insensitive' } },
        { customer_email: { contains: query, mode: 'insensitive' } },
        { gateway_transaction_id: { contains: query, mode: 'insensitive' } }
      ]
    };

    return this.findMany(where, {
      take: options.limit || 20,
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Get transaction with related data
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction with relations
   */
  async getWithRelations(transactionId) {
    return this.findById(transactionId, {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            business_name: true
          }
        },
        receipts: true,
        parent_transaction: true,
        refunds: true
      }
    });
  }

  /**
   * Get largest transactions for user
   * @param {string} userId - User ID
   * @param {number} limit - Number of transactions
   * @returns {Promise<Array>} Largest transactions
   */
  async getLargest(userId, limit = 10) {
    return this.findMany(
      {
        user_id: userId,
        status: 'COMPLETED'
      },
      {
        take: limit,
        orderBy: { amount: 'desc' }
      }
    );
  }

  /**
   * Count transactions by status for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Status counts
   */
  async countByStatus(userId) {
    try {
      const result = await this.groupBy({
        by: ['status'],
        where: { user_id: userId },
        _count: true
      });

      return result.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {});
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'countByStatus',
        userId
      });
      throw new DatabaseError('Failed to count transactions by status', error.message);
    }
  }
}

// Export singleton instance
module.exports = new TransactionRepository();