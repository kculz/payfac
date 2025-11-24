/**
 * Reconciliation Job
 * 
 * Periodically reconciles pool account with gateway and user balances.
 * Ensures financial integrity across the system.
 * 
 * Location: src/jobs/reconciliation.job.js
 */

const poolAccountService = require('../services/poolAccount/poolAccount.service');
const balanceRepository = require('../database/repositories/balance.repository');
const ledgerService = require('../services/balance/ledger.service');
const logger = require('../src/shared/utils/logger');
const { eventHelpers } = require('../events/eventEmitter');

class ReconciliationJob {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.reconciliationIntervalHours = parseInt(process.env.RECONCILIATION_INTERVAL) || 24; // Daily default
  }

  /**
   * Execute complete reconciliation
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('Reconciliation already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Starting reconciliation job');

      const results = {
        timestamp: new Date(),
        poolReconciliation: null,
        balanceReconciliation: null,
        ledgerReconciliation: null,
        discrepancies: [],
        warnings: []
      };

      // 1. Reconcile pool account
      try {
        results.poolReconciliation = await this.reconcilePoolAccount();
      } catch (error) {
        logger.error('Pool reconciliation failed', { error: error.message });
        results.warnings.push({
          type: 'pool_reconciliation',
          message: error.message
        });
      }

      // 2. Reconcile total allocated balances
      try {
        results.balanceReconciliation = await this.reconcileTotalBalances();
      } catch (error) {
        logger.error('Balance reconciliation failed', { error: error.message });
        results.warnings.push({
          type: 'balance_reconciliation',
          message: error.message
        });
      }

      // 3. Reconcile individual user ledgers (sample)
      try {
        results.ledgerReconciliation = await this.reconcileSampleLedgers();
      } catch (error) {
        logger.error('Ledger reconciliation failed', { error: error.message });
        results.warnings.push({
          type: 'ledger_reconciliation',
          message: error.message
        });
      }

      // Check for critical discrepancies
      if (results.discrepancies.length > 0) {
        logger.error('Reconciliation found discrepancies', {
          count: results.discrepancies.length,
          discrepancies: results.discrepancies
        });

        // Emit event for alerting
        eventHelpers.reconciliationCompleted({
          success: false,
          discrepancies: results.discrepancies
        });

        // TODO: Send alert to admins
        // await notificationService.sendAdminAlert('Reconciliation Discrepancies', results);
      } else {
        logger.info('Reconciliation completed successfully - no discrepancies found');
        
        eventHelpers.reconciliationCompleted({
          success: true,
          results
        });
      }

      return results;

    } catch (error) {
      logger.error('Reconciliation job failed', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Reconcile pool account balances
   */
  async reconcilePoolAccount() {
    logger.info('Reconciling pool account');

    // Get pool status
    const poolStatus = await poolAccountService.getPoolStatus();

    // Get total allocated from users
    const totalAllocated = await balanceRepository.getTotalAllocated();

    // Calculate discrepancy
    const poolAllocated = poolStatus.allocatedBalance;
    const userAllocated = totalAllocated.total;
    const difference = Math.abs(poolAllocated - userAllocated);

    const result = {
      poolAllocated,
      userAllocated,
      difference,
      isReconciled: difference < 0.01, // Allow 1 cent difference for rounding
      timestamp: new Date()
    };

    if (!result.isReconciled) {
      logger.error('Pool allocation mismatch detected', result);
      
      // Add to discrepancies
      this.discrepancies = this.discrepancies || [];
      this.discrepancies.push({
        type: 'pool_allocation',
        severity: difference > 100 ? 'critical' : 'warning',
        ...result
      });
    }

    return result;
  }

  /**
   * Reconcile total allocated balances
   */
  async reconcileTotalBalances() {
    logger.info('Reconciling total balances');

    const poolStatus = await poolAccountService.getPoolStatus();
    const totalAllocated = await balanceRepository.getTotalAllocated();

    const result = {
      pool: {
        total: poolStatus.totalBalance,
        allocated: poolStatus.allocatedBalance,
        reserved: poolStatus.reservedBalance,
        unallocated: poolStatus.unallocatedBalance
      },
      users: {
        available: totalAllocated.available,
        pending: totalAllocated.pending,
        reserved: totalAllocated.reserved,
        total: totalAllocated.total
      },
      isBalanced: true,
      timestamp: new Date()
    };

    // Check if pool allocated matches user total
    const difference = Math.abs(
      poolStatus.allocatedBalance - totalAllocated.total
    );

    if (difference > 0.01) {
      result.isBalanced = false;
      result.difference = difference;

      logger.error('Total balance mismatch', result);

      this.discrepancies = this.discrepancies || [];
      this.discrepancies.push({
        type: 'total_balance',
        severity: 'critical',
        difference,
        ...result
      });
    }

    return result;
  }

  /**
   * Reconcile sample user ledgers
   * Checks a random sample of users
   */
  async reconcileSampleLedgers(sampleSize = 10) {
    logger.info(`Reconciling ${sampleSize} sample user ledgers`);

    // Get random users with balances
    const allBalances = await balanceRepository.findMany(
      { available_balance: { gt: 0 } },
      { take: sampleSize }
    );

    const results = {
      total: allBalances.length,
      reconciled: 0,
      mismatched: 0,
      errors: []
    };

    for (const balance of allBalances) {
      try {
        const reconciliation = await ledgerService.reconcileBalance(balance.user_id);

        if (reconciliation.isReconciled) {
          results.reconciled++;
        } else {
          results.mismatched++;
          
          logger.warn('Ledger mismatch for user', {
            userId: balance.user_id,
            ...reconciliation
          });

          this.discrepancies = this.discrepancies || [];
          this.discrepancies.push({
            type: 'ledger_mismatch',
            severity: Math.abs(reconciliation.difference) > 10 ? 'high' : 'low',
            userId: balance.user_id,
            ...reconciliation
          });
        }
      } catch (error) {
        results.errors.push({
          userId: balance.user_id,
          error: error.message
        });
      }
    }

    logger.info('Sample ledger reconciliation completed', results);

    return results;
  }

  /**
   * Reconcile all user ledgers (intensive operation)
   * Should be run manually or during off-peak hours
   */
  async reconcileAllLedgers() {
    logger.info('Starting full ledger reconciliation');

    const allBalances = await balanceRepository.findMany();
    
    const results = {
      total: allBalances.length,
      reconciled: 0,
      mismatched: 0,
      errors: []
    };

    let processed = 0;

    for (const balance of allBalances) {
      try {
        const reconciliation = await ledgerService.reconcileBalance(balance.user_id);

        if (reconciliation.isReconciled) {
          results.reconciled++;
        } else {
          results.mismatched++;
        }

        processed++;

        // Log progress every 100 users
        if (processed % 100 === 0) {
          logger.info(`Ledger reconciliation progress: ${processed}/${allBalances.length}`);
        }

      } catch (error) {
        results.errors.push({
          userId: balance.user_id,
          error: error.message
        });
      }
    }

    logger.info('Full ledger reconciliation completed', results);

    return results;
  }

  /**
   * Generate reconciliation report
   */
  async generateReport() {
    logger.info('Generating reconciliation report');

    const [poolStatus, totalAllocated, balanceStats] = await Promise.all([
      poolAccountService.getPoolStatus(),
      balanceRepository.getTotalAllocated(),
      balanceRepository.getStats()
    ]);

    return {
      timestamp: new Date(),
      pool: poolStatus,
      allocated: totalAllocated,
      statistics: balanceStats,
      health: await poolAccountService.getPoolHealth()
    };
  }

  /**
   * Start the scheduled job
   */
  start() {
    if (this.interval) {
      logger.warn('Reconciliation job already running');
      return;
    }

    logger.info('Starting reconciliation job', {
      intervalHours: this.reconciliationIntervalHours
    });

    // Run immediately on start
    this.execute();

    // Then run periodically
    this.interval = setInterval(
      () => this.execute(),
      this.reconciliationIntervalHours * 60 * 60 * 1000
    );

    const nextRun = new Date(Date.now() + this.reconciliationIntervalHours * 60 * 60 * 1000);
    logger.info('Reconciliation job scheduled', { nextRun });
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Reconciliation job stopped');
    }
  }

  /**
   * Force reconciliation immediately
   */
  async forceReconciliation() {
    logger.info('Force reconciliation requested');
    return await this.execute();
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.interval !== null,
      intervalHours: this.reconciliationIntervalHours,
      nextRun: this.interval 
        ? new Date(Date.now() + this.reconciliationIntervalHours * 60 * 60 * 1000)
        : null
    };
  }
}

// Export singleton instance
module.exports = new ReconciliationJob();