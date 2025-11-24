/**
 * Server Entry Point
 * 
 * Starts the Express server and initializes services.
 * 
 * Location: src/server.js
 */

require('dotenv').config();

const app = require('./app');
const config = require('./src/config/environment.config');
const logger = require('./src/shared/utils/logger');
const { testConnection, disconnect } = require('./src/config/database.config');
const poolAccountService = require('./services/poolAccount/poolAccount.service');
const paymentGatewayService = require('./services/payment/paymentGateway.service');
const poolSyncJob = require('./jobs/poolSync.job');
const payoutProcessorJob = require('./jobs/payoutProcessor.job');
const reconciliationJob = require('./jobs/reconciliation.job');
const { registerEventHandlers } = require('./events');

const PORT = config.app.port;

/**
 * Initialize application services
 */
async function initialize() {
  try {
    logger.info('Initializing application...');

    // Register event handlers
    logger.info('Registering event handlers...');
    registerEventHandlers();

    // Test database connection
    logger.info('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      throw new Error('Database connection failed');
    }

    logger.info('Database connected successfully');

    // Initialize pool account if needed
    logger.info('Checking pool account...');
    const poolStatus = await poolAccountService.getPoolStatus();
    
    if (poolStatus) {
      logger.info('Pool account status:', {
        totalBalance: poolStatus.totalBalance,
        allocatedBalance: poolStatus.allocatedBalance,
        unallocatedBalance: poolStatus.unallocatedBalance
      });
    } else {
      logger.info('Initializing pool account...');
      await poolAccountService.initializePool();
    }

    // Test gateway connection
    logger.info('Testing payment gateway connection...');
    const gatewayHealth = await paymentGatewayService.checkHealth();
    
    if (gatewayHealth.status === 'healthy') {
      logger.info('Payment gateway connected successfully');
      
      // Start pool sync job
      logger.info('Starting pool sync job...');
      poolSyncJob.start();

      // Start payout processor job
      logger.info('Starting payout processor job...');
      payoutProcessorJob.start();

      // Start reconciliation job
      logger.info('Starting reconciliation job...');
      reconciliationJob.start();
    } else {
      logger.warn('Payment gateway is unavailable', {
        error: gatewayHealth.error
      });
      logger.warn('Jobs will retry when gateway becomes available');
    }

    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Initialize services
    await initialize();

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info('='.repeat(50));
      logger.info(`🚀 Server started successfully`);
      logger.info(`Environment: ${config.app.nodeEnv}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`API v1: http://localhost:${PORT}/api/v1`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
      logger.info('='.repeat(50));
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} signal received: closing HTTP server`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Stop all jobs
          logger.info('Stopping scheduled jobs...');
          poolSyncJob.stop();
          payoutProcessorJob.stop();
          reconciliationJob.stop();

          // Disconnect from database
          logger.info('Disconnecting from database...');
          await disconnect();

          // Logout from gateway
          logger.info('Logging out from payment gateway...');
          await paymentGatewayService.logout();

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error.message
          });
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
startServer();