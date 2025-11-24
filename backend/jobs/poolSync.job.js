/**
 * Pool Sync Job
 * 
 * Periodically syncs the local pool account balance with the external gateway.
 * Runs every X minutes (configured via POOL_SYNC_INTERVAL env variable).
 * 
 * Location: src/jobs/poolSync.job.js
 */

const poolAccountService = require('../services/poolAccount/poolAccount.service');
const paymentGatewayService = require('../services/payment/paymentGateway.service');
const logger = require('../src/shared/utils/logger');
const config = require('../src/config/environment.config');

class PoolSyncJob {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.syncIntervalMinutes = parseInt(process.env.POOL_SYNC_INTERVAL) || 30;
  }

  /**
   * Execute pool balance sync
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('Pool sync already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Starting pool balance sync job');

      // Get balance from gateway
      const syncResult = await paymentGatewayService.syncPoolBalance();

      if (!syncResult.success) {
        throw new Error('Gateway sync failed');
      }

      // Get current pool status
      const currentPool = await poolAccountService.getPoolStatus();

      // Reconcile with gateway balance
      const reconciliation = await poolAccountService.reconcileWithGateway(
        syncResult.gateway_balance
      );

      logger.info('Pool sync completed', {
        gatewayBalance: syncResult.gateway_balance,
        localBalance: currentPool.totalBalance,
        reconciled: reconciliation.reconciled,
        difference: reconciliation.difference
      });

      // Check pool health after sync
      const health = await poolAccountService.getPoolHealth();

      if (health.status === 'critical') {
        logger.error('Pool account is in critical state', {
          health
        });

        // TODO: Send alert to admin
        // notificationService.sendAdminAlert('Pool Account Critical', health);
      } else if (health.status === 'warning') {
        logger.warn('Pool account is in warning state', {
          health
        });

        // TODO: Send warning to admin
        // notificationService.sendAdminWarning('Pool Account Warning', health);
      }

      return {
        success: true,
        syncedAt: new Date(),
        gatewayBalance: syncResult.gateway_balance,
        localBalance: currentPool.totalBalance,
        health: health.status
      };

    } catch (error) {
      logger.errorWithContext(error, {
        job: 'poolSync'
      });

      return {
        success: false,
        error: error.message,
        syncedAt: new Date()
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the scheduled job
   */
  start() {
    if (this.interval) {
      logger.warn('Pool sync job already running');
      return;
    }

    logger.info('Starting pool sync job', {
      intervalMinutes: this.syncIntervalMinutes
    });

    // Run immediately on start
    this.execute();

    // Then run periodically
    this.interval = setInterval(
      () => this.execute(),
      this.syncIntervalMinutes * 60 * 1000
    );

    logger.info('Pool sync job scheduled', {
      nextRun: new Date(Date.now() + this.syncIntervalMinutes * 60 * 1000)
    });
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Pool sync job stopped');
    }
  }

  /**
   * Force sync immediately
   */
  async forceSync() {
    logger.info('Force sync requested');
    return await this.execute();
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.interval !== null,
      intervalMinutes: this.syncIntervalMinutes,
      nextRun: this.interval 
        ? new Date(Date.now() + this.syncIntervalMinutes * 60 * 1000)
        : null
    };
  }
}

// Export singleton instance
module.exports = new PoolSyncJob();