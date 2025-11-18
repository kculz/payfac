/**
 * Database Configuration
 * 
 * Centralized Prisma Client configuration with connection pooling,
 * error handling, and query logging.
 * 
 * Location: src/config/database.js
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../shared/utils/logger');
const config = require('./environment.config');

/**
 * Prisma Client configuration options
 */
const prismaOptions = {
  // Log configuration
  log: config.database.logging
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'info', emit: 'event' }
      ]
    : [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ],

  // Error formatting
  errorFormat: config.app.isDevelopment ? 'pretty' : 'minimal'
};

/**
 * Create Prisma Client instance with singleton pattern
 * Ensures only one instance exists in the application
 */
let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(prismaOptions);
} else {
  // In development, prevent hot-reloading from creating multiple instances
  if (!global.prisma) {
    global.prisma = new PrismaClient(prismaOptions);
  }
  prisma = global.prisma;
}

/**
 * Set up event listeners for logging
 */
if (config.database.logging && config.app.isDevelopment) {
  // Log queries (development only)
  prisma.$on('query', (e) => {
    logger.query(e.query, e.duration);
  });
}

// Log errors
prisma.$on('error', (e) => {
  logger.error('Database error', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  });
});

// Log warnings
prisma.$on('warn', (e) => {
  logger.warn('Database warning', {
    message: e.message,
    target: e.target,
    timestamp: e.timestamp
  });
});

// Log info
prisma.$on('info', (e) => {
  if (config.app.isDevelopment) {
    logger.info('Database info', {
      message: e.message,
      target: e.target,
      timestamp: e.timestamp
    });
  }
});

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', {
      message: error.message,
      code: error.code
    });
    return false;
  }
}

/**
 * Disconnect from database
 * Should be called during graceful shutdown
 */
async function disconnect() {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error disconnecting from database', {
      message: error.message
    });
  }
}

/**
 * Check database health
 * @returns {Promise<Object>} Health status object
 */
async function checkHealth() {
  try {
    const startTime = Date.now();
    
    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Execute a transaction with automatic retry logic
 * @param {Function} callback - Function containing transaction logic
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<*>} Transaction result
 */
async function executeTransaction(callback, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(callback);
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.code === 'P2034' || // Transaction conflict
        error.code === 'P2028' || // Transaction API error
        error.message.includes('deadlock') ||
        error.message.includes('timeout');

      if (!isRetryable || attempt === maxRetries) {
        logger.error('Transaction failed', {
          attempt,
          maxRetries,
          error: error.message,
          code: error.code
        });
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.warn(`Transaction failed, retrying in ${delay}ms`, {
        attempt,
        maxRetries,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
async function getStats() {
  try {
    const [
      userCount,
      transactionCount,
      poolAccount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.poolAccount.findFirst()
    ]);

    return {
      users: userCount,
      transactions: transactionCount,
      poolBalance: poolAccount ? parseFloat(poolAccount.total_balance) : 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get database stats', {
      message: error.message
    });
    throw error;
  }
}

/**
 * Cleanup helper - deletes old records
 * @param {string} model - Model name
 * @param {number} daysOld - Number of days
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanupOldRecords(model, daysOld = 90) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma[model].deleteMany({
      where: {
        created_at: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`Cleaned up old ${model} records`, {
      deleted: result.count,
      cutoffDate: cutoffDate.toISOString()
    });

    return result.count;
  } catch (error) {
    logger.error(`Failed to cleanup ${model} records`, {
      message: error.message
    });
    throw error;
  }
}

/**
 * Soft delete helper
 * Updates a record with deleted_at timestamp instead of hard delete
 * (Note: Requires adding deleted_at field to models)
 * 
 * @param {string} model - Model name
 * @param {string} id - Record ID
 * @returns {Promise<Object>} Updated record
 */
async function softDelete(model, id) {
  try {
    return await prisma[model].update({
      where: { id },
      data: {
        deleted_at: new Date()
      }
    });
  } catch (error) {
    logger.error('Soft delete failed', {
      model,
      id,
      message: error.message
    });
    throw error;
  }
}

/**
 * Paginate helper
 * Simplifies pagination queries
 * 
 * @param {string} model - Model name
 * @param {Object} where - Where clause
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Paginated results
 */
async function paginate(model, where = {}, options = {}) {
  const {
    page = 1,
    limit = 20,
    orderBy = { created_at: 'desc' },
    include = null
  } = options;

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma[model].findMany({
      where,
      skip,
      take: limit,
      orderBy,
      ...(include && { include })
    }),
    prisma[model].count({ where })
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + data.length < total
    }
  };
}

/**
 * Seed pool account if it doesn't exist
 * Called during application startup
 */
async function seedPoolAccount() {
  try {
    const existing = await prisma.poolAccount.findFirst();
    
    if (!existing) {
      await prisma.poolAccount.create({
        data: {
          total_balance: config.pool.initialBalance,
          allocated_balance: 0,
          reserved_balance: 0,
          currency: config.pool.currency
        }
      });
      
      logger.info('Pool account initialized', {
        initialBalance: config.pool.initialBalance,
        currency: config.pool.currency
      });
    }
  } catch (error) {
    logger.error('Failed to seed pool account', {
      message: error.message
    });
  }
}

// Initialize pool account on startup
if (!config.app.isTest) {
  seedPoolAccount();
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown() {
  logger.info('Closing database connections...');
  await disconnect();
}

// Register shutdown handlers
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

module.exports = {
  prisma,
  testConnection,
  disconnect,
  checkHealth,
  executeTransaction,
  getStats,
  cleanupOldRecords,
  softDelete,
  paginate
};