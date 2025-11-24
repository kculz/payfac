/**
 * Payout Processor Job
 * 
 * Automatically processes approved payouts in batches.
 * Runs periodically to check for processing payouts.
 * 
 * Location: src/jobs/payoutProcessor.job.js
 */

const payoutRepository = require('../database/repositories/payout.repository');
const payoutService = require('../services/payout/payout.service');
const logger = require('../src/shared/utils/logger');
const { eventHelpers } = require('../events/eventEmitter');

class PayoutProcessorJob {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.processingIntervalMinutes = parseInt(process.env.PAYOUT_PROCESSING_INTERVAL) || 60; // 1 hour default
    this.batchSize = parseInt(process.env.PAYOUT_BATCH_SIZE) || 10;
  }

  /**
   * Execute payout processing
   */
  async execute() {
    if (this.isRunning) {
      logger.warn('Payout processor already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('Starting payout processor job');

      // Get processing payouts
      const processingPayouts = await payoutRepository.findMany(
        { status: 'PROCESSING' },
        {
          take: this.batchSize,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                business_name: true,
                account_balance: true
              }
            }
          }
        }
      );

      if (processingPayouts.length === 0) {
        logger.info('No processing payouts found');
        return {
          success: true,
          processed: 0,
          message: 'No payouts to process'
        };
      }

      logger.info(`Found ${processingPayouts.length} payouts to process`);

      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      // Process each payout
      for (const payout of processingPayouts) {
        try {
          await this.processSinglePayout(payout);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            payoutId: payout.id,
            error: error.message
          });

          logger.error('Failed to process payout', {
            payoutId: payout.id,
            userId: payout.user_id,
            amount: payout.amount,
            error: error.message
          });
        }

        // Add delay between payouts to avoid overwhelming the system
        await this.delay(1000); // 1 second delay
      }

      logger.info('Payout processor job completed', {
        total: processingPayouts.length,
        successful: results.successful,
        failed: results.failed
      });

      return {
        success: true,
        ...results,
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Payout processor job failed', {
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
   * Process a single payout
   * @param {Object} payout - Payout to process
   */
  async processSinglePayout(payout) {
    logger.info('Processing payout', {
      payoutId: payout.id,
      userId: payout.user_id,
      amount: payout.amount
    });

    try {
      // TODO: Integrate with actual payment gateway for bank transfers
      // For now, simulate processing
      const gatewayReference = `PAYOUT_${Date.now()}_${payout.id.substring(0, 8)}`;

      // Complete the payout
      await payoutRepository.completePayout(payout.id, gatewayReference);

      // Emit event
      eventHelpers.payoutCompleted(payout);

      logger.info('Payout processed successfully', {
        payoutId: payout.id,
        gatewayReference
      });

    } catch (error) {
      // Fail the payout
      await payoutRepository.failPayout(payout.id, error.message);
      throw error;
    }
  }

  /**
   * Start the scheduled job
   */
  start() {
    if (this.interval) {
      logger.warn('Payout processor job already running');
      return;
    }

    logger.info('Starting payout processor job', {
      intervalMinutes: this.processingIntervalMinutes,
      batchSize: this.batchSize
    });

    // Run immediately on start
    this.execute();

    // Then run periodically
    this.interval = setInterval(
      () => this.execute(),
      this.processingIntervalMinutes * 60 * 1000
    );

    logger.info('Payout processor job scheduled', {
      nextRun: new Date(Date.now() + this.processingIntervalMinutes * 60 * 1000)
    });
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Payout processor job stopped');
    }
  }

  /**
   * Force process immediately
   */
  async forceProcess() {
    logger.info('Force payout processing requested');
    return await this.execute();
  }

  /**
   * Get job status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isScheduled: this.interval !== null,
      intervalMinutes: this.processingIntervalMinutes,
      batchSize: this.batchSize,
      nextRun: this.interval 
        ? new Date(Date.now() + this.processingIntervalMinutes * 60 * 1000)
        : null
    };
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new PayoutProcessorJob();