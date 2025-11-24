/**
 * Pool Account Repository
 * 
 * Handles database operations for the pool account.
 * 
 * Location: src/database/repositories/poolAccountRepository.js
 */

const BaseRepository = require('./base.repository');
const logger = require('../../src/shared/utils/logger');

class PoolAccountRepository extends BaseRepository {
  constructor() {
    super('poolAccount');
  }

  /**
   * Get the pool account (should only be one)
   * @returns {Promise<Object|null>} Pool account
   */
  async getPoolAccount() {
    try {
      return await this.model.findFirst();
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'getPoolAccount'
      });
      throw error;
    }
  }

  /**
   * Update pool account balance after gateway sync
   * @param {number} gatewayBalance - Balance from gateway
   * @returns {Promise<Object>} Updated pool account
   */
  async syncWithGateway(gatewayBalance) {
    try {
      const pool = await this.getPoolAccount();

      if (!pool) {
        throw new Error('Pool account not found');
      }

      const updated = await this.model.update({
        where: { id: pool.id },
        data: {
          total_balance: gatewayBalance,
          last_synced_at: new Date()
        }
      });

      logger.info('Pool account synced with gateway', {
        previousBalance: pool.total_balance,
        newBalance: gatewayBalance,
        difference: gatewayBalance - parseFloat(pool.total_balance)
      });

      return updated;
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'syncWithGateway',
        gatewayBalance
      });
      throw error;
    }
  }

  /**
   * Update gateway account ID
   * @param {string} gatewayAccountId - Gateway account identifier
   * @returns {Promise<Object>} Updated pool account
   */
  async updateGatewayAccountId(gatewayAccountId) {
    try {
      const pool = await this.getPoolAccount();

      return await this.model.update({
        where: { id: pool.id },
        data: { gateway_account_id: gatewayAccountId }
      });
    } catch (error) {
      logger.errorWithContext(error, {
        method: 'updateGatewayAccountId'
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PoolAccountRepository();