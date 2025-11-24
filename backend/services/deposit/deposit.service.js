/**
 * Deposit Service
 * 
 * Handles deposit request creation, approval, and management.
 * 
 * Location: src/services/deposit/depositService.js
 */

const depositRepository = require('../../database/repositories/deposit.repository');
const poolAccountService = require('../poolAccount/poolAccount.service');
const logger = require('../../src/shared/utils/logger');
const config = require('../../src/config/environment.config');
const {
  BadRequestError,
  NotFoundError,
  InsufficientBalanceError,
  TransactionLimitError
} = require('../../src/shared/utils/ApiError');

class DepositService {
  /**
   * Create a deposit request
   * @param {string} userId - User ID
   * @param {Object} depositData - Deposit data
   * @returns {Promise<Object>} Created deposit request
   */
  async createDepositRequest(userId, depositData) {
    const { amount, payment_method, gateway_reference } = depositData;

    try {
      // Validate amount limits
      if (amount < config.limits.minDepositAmount) {
        throw new TransactionLimitError(config.limits.minDepositAmount, 'minimum deposit');
      }

      if (amount > config.limits.maxDepositAmount) {
        throw new TransactionLimitError(config.limits.maxDepositAmount, 'maximum deposit');
      }

      // Create deposit request
      const deposit = await depositRepository.create({
        user_id: userId,
        amount,
        currency: 'USD',
        payment_method,
        gateway_reference,
        status: 'PENDING'
      });

      logger.info('Deposit request created', {
        depositId: deposit.id,
        userId,
        amount
      });

      return deposit;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'createDepositRequest',
        userId,
        amount
      });
      throw error;
    }
  }

  /**
   * Approve a deposit request (Admin only)
   * @param {string} depositId - Deposit ID
   * @param {string} approvedBy - Admin user ID
   * @returns {Promise<Object>} Approved deposit with updated balance
   */
  async approveDeposit(depositId, approvedBy) {
    try {
      // Get deposit request
      const deposit = await depositRepository.findById(depositId);

      if (!deposit) {
        throw new NotFoundError('Deposit request');
      }

      // Check if already processed
      if (deposit.status !== 'PENDING') {
        throw new BadRequestError('Deposit has already been processed');
      }

      // Check if pool has sufficient unallocated funds
      const hasAvailableFunds = await poolAccountService.checkAvailableFunds(
        parseFloat(deposit.amount)
      );

      if (!hasAvailableFunds) {
        throw new InsufficientBalanceError(
          parseFloat(deposit.amount),
          0 // Pool unallocated balance
        );
      }

      // Approve deposit
      const approvedDeposit = await depositRepository.approveDeposit(depositId, approvedBy);

      // Allocate funds to user
      await poolAccountService.allocateToUser(
        deposit.user_id,
        parseFloat(deposit.amount)
      );

      logger.info('Deposit approved and funds allocated', {
        depositId,
        userId: deposit.user_id,
        amount: deposit.amount,
        approvedBy
      });

      return approvedDeposit;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'approveDeposit',
        depositId,
        approvedBy
      });
      throw error;
    }
  }

  /**
   * Reject a deposit request (Admin only)
   * @param {string} depositId - Deposit ID
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Rejected deposit
   */
  async rejectDeposit(depositId, reason) {
    try {
      const deposit = await depositRepository.findById(depositId);

      if (!deposit) {
        throw new NotFoundError('Deposit request');
      }

      if (deposit.status !== 'PENDING') {
        throw new BadRequestError('Deposit has already been processed');
      }

      const rejectedDeposit = await depositRepository.rejectDeposit(depositId, reason);

      logger.info('Deposit rejected', {
        depositId,
        userId: deposit.user_id,
        amount: deposit.amount,
        reason
      });

      return rejectedDeposit;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'rejectDeposit',
        depositId
      });
      throw error;
    }
  }

  /**
   * Get user's deposit history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated deposits
   */
  async getDepositHistory(userId, filters = {}, pagination = {}) {
    try {
      return await depositRepository.findByUserId(userId, filters, pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getDepositHistory',
        userId
      });
      throw error;
    }
  }

  /**
   * Get deposit by ID
   * @param {string} depositId - Deposit ID
   * @param {string} userId - User ID (for verification)
   * @returns {Promise<Object>} Deposit
   */
  async getDeposit(depositId, userId = null) {
    try {
      const deposit = await depositRepository.findById(depositId);

      if (!deposit) {
        throw new NotFoundError('Deposit request');
      }

      // Verify ownership if userId provided
      if (userId && deposit.user_id !== userId) {
        throw new BadRequestError('Unauthorized to view this deposit');
      }

      return deposit;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getDeposit',
        depositId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending deposits (Admin only)
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Paginated pending deposits
   */
  async getPendingDeposits(pagination = {}) {
    try {
      return await depositRepository.getPendingDeposits(pagination);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPendingDeposits'
      });
      throw error;
    }
  }

  /**
   * Get deposit statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  async getUserDepositStats(userId) {
    try {
      return await depositRepository.getUserStats(userId);
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getUserDepositStats',
        userId
      });
      throw error;
    }
  }

  /**
   * Cancel deposit request (before approval)
   * @param {string} depositId - Deposit ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Cancelled deposit
   */
  async cancelDeposit(depositId, userId) {
    try {
      const deposit = await depositRepository.findById(depositId);

      if (!deposit) {
        throw new NotFoundError('Deposit request');
      }

      if (deposit.user_id !== userId) {
        throw new BadRequestError('Unauthorized to cancel this deposit');
      }

      if (deposit.status !== 'PENDING') {
        throw new BadRequestError('Only pending deposits can be cancelled');
      }

      const cancelled = await depositRepository.update(depositId, {
        status: 'CANCELLED'
      });

      logger.info('Deposit cancelled', {
        depositId,
        userId
      });

      return cancelled;

    } catch (error) {
      logger.errorWithContext(error, {
        method: 'cancelDeposit',
        depositId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get pending deposits count (for admin dashboard)
   * @returns {Promise<number>} Count
   */
  async getPendingCount() {
    try {
      return await depositRepository.getPendingCount();
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPendingCount'
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new DepositService();