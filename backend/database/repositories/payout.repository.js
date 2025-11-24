/**
 * Payout Repository
 * 
 * Handles database operations for payout requests.
 * 
 * Location: src/database/repositories/payoutRepository.js
 */

const BaseRepository = require('./base.repository');
const logger = require('../../src/shared/utils/logger');

class PayoutRepository extends BaseRepository {
  constructor() {
    super('payoutRequest');
  }

  /**
   * Find payout requests by user ID
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated payouts
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
   * Get pending payouts (admin view)
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated pending payouts
   */
  async getPendingPayouts(pagination = {}) {
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
              phone: true,
              account_balance: {
                select: {
                  available_balance: true
                }
              }
            }
          }
        }
      }
    );
  }

  /**
   * Mark payout as processing
   * @param {string} payoutId - Payout ID
   * @param {string} processedBy - Admin user ID
   * @returns {Promise<Object>} Updated payout
   */
  async markAsProcessing(payoutId, processedBy) {
    return this.update(payoutId, {
      status: 'PROCESSING',
      processed_by: processedBy,
      processed_at: new Date()
    });
  }

  /**
   * Complete payout
   * @param {string} payoutId - Payout ID
   * @param {string} gatewayReference - Gateway transaction reference
   * @returns {Promise<Object>} Updated payout
   */
  async completePayout(payoutId, gatewayReference) {
    const payout = await this.update(payoutId, {
      status: 'COMPLETED',
      gateway_reference: gatewayReference,
      completed_at: new Date()
    });

    logger.info('Payout completed', {
      payoutId,
      amount: payout.amount,
      userId: payout.user_id,
      gatewayReference
    });

    return payout;
  }

  /**
   * Fail payout
   * @param {string} payoutId - Payout ID
   * @param {string} reason - Failure reason
   * @returns {Promise<Object>} Updated payout
   */
  async failPayout(payoutId, reason) {
    const payout = await this.update(payoutId, {
      status: 'FAILED',
      rejection_reason: reason,
      failed_at: new Date()
    });

    logger.warn('Payout failed', {
      payoutId,
      reason,
      amount: payout.amount,
      userId: payout.user_id
    });

    return payout;
  }

  /**
   * Cancel payout
   * @param {string} payoutId - Payout ID
   * @returns {Promise<Object>} Updated payout
   */
  async cancelPayout(payoutId) {
    return this.update(payoutId, {
      status: 'CANCELLED'
    });
  }

  /**
   * Get payout statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserStats(userId) {
    const [completed, pending, failed] = await Promise.all([
      this.aggregate({
        where: { user_id: userId, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true
      }),
      this.count({ user_id: userId, status: 'PENDING' }),
      this.count({ user_id: userId, status: 'FAILED' })
    ]);

    return {
      completed: {
        total: completed._sum.amount ? parseFloat(completed._sum.amount) : 0,
        count: completed._count
      },
      pending,
      failed
    };
  }

  /**
   * Get pending payouts count (for admin)
   * @returns {Promise<number>} Count
   */
  async getPendingCount() {
    return this.count({ status: 'PENDING' });
  }

  /**
   * Get processing payouts count (for admin)
   * @returns {Promise<number>} Count
   */
  async getProcessingCount() {
    return this.count({ status: 'PROCESSING' });
  }
}

// Export singleton instance
module.exports = new PayoutRepository();