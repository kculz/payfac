/**
 * Payout Service
 * 
 * Handles payout request creation, processing, and management.
 * 
 * Location: src/services/payout/payoutService.js
 */

const payoutRepository = require('../../database/repositories/payout.repository');
const balanceService = require('../balance/balance.service');
const logger = require('../../src/shared/utils/logger');
const config = require('../../src/config/environment.config');
const {
  BadRequestError,
  NotFoundError,
  InsufficientBalanceError,
  TransactionLimitError
} = require('../../src/shared/utils/ApiError');

class PayoutService {
  /**
   * Create a payout request
   * @param {string} userId - User ID
   * @param {Object} payoutData - Payout data
   * @returns {Promise<Object>} Created payout request
   */
  async createPayoutRequest(userId, payoutData) {
    const { amount, bank_account_id } = payoutData;

    try {
      // Validate amount limits
      if (amount < config.limits.minPayoutAmount) {
        throw new TransactionLimitError(config.limits.minPayoutAmount, 'minimum payout');
      }

      // Check user has sufficient balance
      const balance = await balanceService.getBalance(userId);
      
      if (balance.available < amount) {
        throw new InsufficientBalanceError(amount, balance.available);
      }

      // Reserve funds
      await balanceService.reserveFunds(userId, amount);

      try {
        // Create payout request
        const payout = await payoutRepository.create({
          user_id: userId,
          amount,
          currency: 'USD',
          bank_account_id,
          status: 'PENDING'
        });

        logger.info('Payout request created', {
          payoutId: payout.id,
          userId,
          amount
        });

        return payout;

      } catch (error) {
        // Rollback: Release reserved funds
        await balanceService.releaseReservedFunds(userId, amount);
        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'createPayoutRequest',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Process a payout request (Admin only)
   * @param {string} payoutId - Payout ID
   * @param {string} processedBy - Admin user ID
   * @returns {Promise<Object>} Processed payout
   */
  async processPayout(payoutId, processedBy) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new NotFoundError('Payout request');
      }

      if (payout.status !== 'PENDING') {
        throw new BadRequestError('Payout has already been processed');
      }

      // Mark as processing
      await payoutRepository.markAsProcessing(payoutId, processedBy);

      try {
        // TODO: Process actual bank transfer via gateway
        // For now, simulate success
        const gatewayReference = `PAYOUT_${Date.now()}`;

        // Complete payout
        const completedPayout = await payoutRepository.completePayout(
          payoutId,
          gatewayReference
        );

        // Deduct from user's balance (release reserved and deduct)
        await balanceService.completeReservedTransaction(
          payout.user_id,
          parseFloat(payout.amount)
        );

        // Record withdrawal
        await balanceService.recordWithdrawal(
          payout.user_id,
          parseFloat(payout.amount)
        );

        logger.info('Payout processed successfully', {
          payoutId,
          userId: payout.user_id,
          amount: payout.amount,
          processedBy
        });

        return completedPayout;

      } catch (error) {
        // Fail the payout
        await payoutRepository.failPayout(payoutId, error.message);

        // Release reserved funds
        await balanceService.releaseReservedFunds(
          payout.user_id,
          parseFloat(payout.amount)
        );

        throw error;
      }

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'processPayout',
        payoutId,
        processedBy
      });
      throw error;
    }
  }

  /**
   * Reject a payout request (Admin only)
   * @param {string} payoutId - Payout ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Rejected payout
   */
  async rejectPayout(payoutId, reason) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new NotFoundError('Payout request');
      }

      if (payout.status !== 'PENDING') {
        throw new BadRequestError('Only pending payouts can be rejected');
      }

      // Release reserved funds
      await balanceService.releaseReservedFunds(
        payout.user_id,
        parseFloat(payout.amount)
      );

      // Fail the payout
      const rejectedPayout = await payoutRepository.failPayout(payoutId, reason);

      logger.info('Payout rejected', {
        payoutId,
        userId: payout.user_id,
        amount: payout.amount,
        reason
      });

      return rejectedPayout;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'rejectPayout',
        payoutId
      });
      throw error;
    }
  }

  /**
   * Cancel payout request (User, before processing)
   * @param {string} payoutId - Payout ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cancelled payout
   */
  async cancelPayout(payoutId, userId) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new NotFoundError('Payout request');
      }

      if (payout.user_id !== userId) {
        throw new BadRequestError('Unauthorized to cancel this payout');
      }

      if (payout.status !== 'PENDING') {
        throw new BadRequestError('Only pending payouts can be cancelled');
      }

      // Release reserved funds
      await balanceService.releaseReservedFunds(
        userId,
        parseFloat(payout.amount)
      );

      // Cancel the payout
      const cancelled = await payoutRepository.cancelPayout(payoutId);

      logger.info('Payout cancelled', {
        payoutId,
        userId
      });

      return cancelled;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'cancelPayout',
        payoutId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's payout history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated payouts
   */
  async getPayoutHistory(userId, filters = {}, pagination = {}) {
    try {
      return await payoutRepository.findByUserId(userId, filters, pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPayoutHistory',
        userId
      });
      throw error;
    }
  }

  /**
   * Get payout by ID
   * @param {string} payoutId - Payout ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<Object>} Payout
   */
  async getPayout(payoutId, userId = null) {
    try {
      const payout = await payoutRepository.findById(payoutId);

      if (!payout) {
        throw new NotFoundError('Payout request');
      }

      // Verify ownership if userId provided
      if (userId && payout.user_id !== userId) {
        throw new BadRequestError('Unauthorized to view this payout');
      }

      return payout;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPayout',
        payoutId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending payouts (Admin only)
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated pending payouts
   */
  async getPendingPayouts(pagination = {}) {
    try {
      return await payoutRepository.getPendingPayouts(pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPendingPayouts'
      });
      throw error;
    }
  }

  /**
   * Get payout statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserPayoutStats(userId) {
    try {
      return await payoutRepository.getUserStats(userId);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getUserPayoutStats',
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending payouts count (for admin dashboard)
   * @returns {Promise<number>} Count
   */
  async getPendingCount() {
    try {
      return await payoutRepository.getPendingCount();
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPendingCount'
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PayoutService();