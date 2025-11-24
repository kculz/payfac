/**
 * Deposit Repository
 * 
 * Handles database operations for deposit requests.
 * 
 * Location: src/database/repositories/depositRepository.js
 */

const BaseRepository = require('./base.repository');
const logger = require('../../src/shared/utils/logger');

class DepositRepository extends BaseRepository {
  constructor() {
    super('depositRequest');
  }

  /**
   * Find deposit requests by user ID
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated deposits
   */
  async findByUserId(userId, filters = {}, pagination = {}) {
    const { status } = filters;

    const where = { user_id: userId };
    if (status) {
      where.status = status;
    }

    return this.paginate(where, {
      ...pagination,
      orderBy: { created_at: 'desc' }
    });
  }

  /**
   * Get pending deposits
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated pending deposits
   */
  async getPendingDeposits(pagination = {}) {
    return this.paginate(
      { status: 'PENDING' },
      {
        ...pagination,
        orderBy: { created_at: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              business_name: true,
              phone: true
            }
          }
        }
      }
    );
  }

  /**
   * Approve deposit request
   * @param {string} depositId - Deposit ID
   * @param {string} approvedBy - Admin user ID
   * @returns {Promise<Object>} Updated deposit
   */
  async approveDeposit(depositId, approvedBy) {
    const deposit = await this.update(depositId, {
      status: 'APPROVED',
      approved_by: approvedBy,
      approved_at: new Date()
    });

    logger.info('Deposit approved', {
      depositId,
      approvedBy,
      amount: deposit.amount,
      userId: deposit.user_id
    });

    return deposit;
  }

  /**
   * Reject deposit request
   * @param {string} depositId - Deposit ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Updated deposit
   */
  async rejectDeposit(depositId, reason) {
    const deposit = await this.update(depositId, {
      status: 'REJECTED',
      rejection_reason: reason,
      rejected_at: new Date()
    });

    logger.info('Deposit rejected', {
      depositId,
      reason,
      amount: deposit.amount,
      userId: deposit.user_id
    });

    return deposit;
  }

  /**
   * Get deposit statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserStats(userId) {
    const [approved, pending, rejected, total] = await Promise.all([
      this.aggregate({
        where: { user_id: userId, status: 'APPROVED' },
        _sum: { amount: true },
        _count: true
      }),
      this.count({ user_id: userId, status: 'PENDING' }),
      this.count({ user_id: userId, status: 'REJECTED' }),
      this.count({ user_id: userId })
    ]);

    return {
      approved: {
        total: approved._sum.amount ? parseFloat(approved._sum.amount) : 0,
        count: approved._count
      },
      pending,
      rejected,
      total
    };
  }

  /**
   * Get all pending deposits count (for admin)
   * @returns {Promise<number>} Count of pending deposits
   */
  async getPendingCount() {
    return this.count({ status: 'PENDING' });
  }
}

// Export singleton instance
module.exports = new DepositRepository();