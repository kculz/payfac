/**
 * Database Configuration
 * 
 * Centralized Prisma Client configuration with connection pooling,
 * error handling, and query logging.
 * 
 * Updated for Prisma 7.0.0 compatibility
 * 
 * Location: src/config/database.js
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../shared/utils/logger');
const config = require('./environment.config');

/**
 * Prisma Client configuration options for Prisma 7.0.0+
 */
const prismaOptions = {
  // Database connection configuration (REQUIRED for Prisma 7+)
  datasource: {
    url: process.env.DATABASE_URL || config.database.url
  },

  // Log configuration
  log: config.database.logging
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', 'emit': 'event' },
        { level: 'info', 'emit': 'event' }
      ]
    : [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' }
      ],

  // Error formatting
  errorFormat: config.app.isDevelopment ? 'pretty' : 'minimal',

  // Connection pool settings
  ...(config.database.pool && {
    transactionOptions: {
      maxWait: config.database.pool.maxWait || 5000,
      timeout: config.database.pool.timeout || 10000,
    }
  })
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
 * Enhanced connection test with Prisma 7 compatibility
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
  try {
    await prisma.$connect();
    
    // Test with a simple query to verify full functionality
    await prisma.$queryRaw`SELECT 1`;
    
    logger.info('Database connection established successfully');
    
    // Log database info
    if (config.app.isDevelopment) {
      try {
        const dbInfo = await prisma.$queryRaw`SELECT version() as version`;
        logger.info('Database version info', { version: dbInfo[0]?.version });
      } catch (infoError) {
        // Skip version check if not supported
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });
    
    // Provide helpful error messages for common issues
    if (error.code === 'P1001') {
      logger.error('Database connection refused. Check if:');
      logger.error('1. Database server is running');
      logger.error('2. DATABASE_URL is correct in .env file');
      logger.error('3. Database credentials are valid');
    } else if (error.code === 'P1012') {
      logger.error('Prisma schema validation error. Run: npx prisma generate');
    }
    
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
 * Check database health with enhanced diagnostics
 * @returns {Promise<Object>} Health status object
 */
async function checkHealth() {
  try {
    const startTime = Date.now();
    
    // Test both connection and basic query functionality
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;

    // Get additional health metrics
    const [activeConnections, dbSize] = await Promise.allSettled([
      prisma.$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE state = 'active'`,
      prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`
    ]);

    const healthInfo = {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL',
      prismaVersion: require('@prisma/client/package.json').version
    };

    // Add connection info if available
    if (activeConnections.status === 'fulfilled') {
      healthInfo.activeConnections = parseInt(activeConnections.value[0]?.count) || 0;
    }

    // Add database size if available
    if (dbSize.status === 'fulfilled') {
      const bytes = parseInt(dbSize.value[0]?.size) || 0;
      healthInfo.databaseSize = `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    return healthInfo;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Enhanced transaction with better error handling and Prisma 7 compatibility
 * @param {Function} callback - Function containing transaction logic
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {Object} options - Transaction options
 * @returns {Promise<*>} Transaction result
 */
async function executeTransaction(callback, maxRetries = 3, options = {}) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(callback, {
        maxWait: options.maxWait || 5000,
        timeout: options.timeout || 10000,
        isolationLevel: options.isolationLevel,
      });
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      const isRetryable = 
        error.code === 'P2034' || // Transaction conflict
        error.code === 'P2028' || // Transaction API error
        error.code === 'P1008' || // Timeout
        error.message.includes('deadlock') ||
        error.message.includes('timeout') ||
        error.message.includes('connection');

      if (!isRetryable || attempt === maxRetries) {
        logger.error('Transaction failed', {
          attempt,
          maxRetries,
          error: error.message,
          code: error.code,
          meta: error.meta
        });
        throw error;
      }

      // Wait before retrying (exponential backoff with jitter)
      const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;
      
      logger.warn(`Transaction failed, retrying in ${Math.round(delay)}ms`, {
        attempt,
        maxRetries,
        error: error.message,
        code: error.code
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Get database statistics with error handling
 * @returns {Promise<Object>} Database statistics
 */
async function getStats() {
  try {
    const [
      userCount,
      transactionCount,
      poolAccount,
      todayTransactions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.transaction.count(),
      prisma.poolAccount.findFirst(),
      prisma.transaction.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      users: userCount,
      transactions: transactionCount,
      todayTransactions,
      poolBalance: poolAccount ? parseFloat(poolAccount.total_balance) : 0,
      currency: poolAccount?.currency || 'USD',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Failed to get database stats', {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Enhanced cleanup helper with batch processing for large datasets
 * @param {string} model - Model name
 * @param {number} daysOld - Number of days
 * @param {number} batchSize - Batch size for large deletions
 * @returns {Promise<number>} Number of deleted records
 */
async function cleanupOldRecords(model, daysOld = 90, batchSize = 1000) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let totalDeleted = 0;
    let shouldContinue = true;

    while (shouldContinue) {
      const result = await prisma[model].deleteMany({
        where: {
          created_at: {
            lt: cutoffDate
          }
        },
        take: batchSize
      });

      totalDeleted += result.count;
      shouldContinue = result.count === batchSize;

      if (shouldContinue) {
        // Small delay to prevent database overload
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info(`Cleaned up old ${model} records`, {
      deleted: totalDeleted,
      cutoffDate: cutoffDate.toISOString(),
      batchSize
    });

    return totalDeleted;
  } catch (error) {
    logger.error(`Failed to cleanup ${model} records`, {
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Enhanced soft delete helper with audit trail
 * @param {string} model - Model name
 * @param {string} id - Record ID
 * @param {string} deletedBy - User ID who performed deletion
 * @returns {Promise<Object>} Updated record
 */
async function softDelete(model, id, deletedBy = null) {
  try {
    const result = await prisma[model].update({
      where: { id },
      data: {
        deleted_at: new Date(),
        ...(deletedBy && { deleted_by: deletedBy })
      }
    });

    // Create audit log entry
    try {
      await prisma.auditLog.create({
        data: {
          user_id: deletedBy,
          action: 'SOFT_DELETE',
          entity: model,
          entity_id: id,
          changes: { soft_deleted_at: new Date() }
        }
      });
    } catch (auditError) {
      // Don't fail if audit log fails
      logger.warn('Failed to create audit log for soft delete', {
        model, id, error: auditError.message
      });
    }

    return result;
  } catch (error) {
    logger.error('Soft delete failed', {
      model,
      id,
      message: error.message,
      code: error.code
    });
    throw error;
  }
}

/**
 * Enhanced paginate helper with sorting and filtering
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
    include = null,
    select = null,
    search = null,
    searchFields = []
  } = options;

  const skip = (page - 1) * limit;

  // Add search functionality if provided
  const finalWhere = { ...where };
  if (search && searchFields.length > 0) {
    finalWhere.OR = searchFields.map(field => ({
      [field]: {
        contains: search,
        mode: 'insensitive'
      }
    }));
  }

  const [data, total] = await Promise.all([
    prisma[model].findMany({
      where: finalWhere,
      skip,
      take: limit,
      orderBy,
      ...(include && { include }),
      ...(select && { select })
    }),
    prisma[model].count({ where: finalWhere })
  ]);

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + data.length < total,
      hasPrevious: page > 1
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
          total_balance: config.pool?.initialBalance || 0,
          allocated_balance: 0,
          reserved_balance: 0,
          currency: config.pool?.currency || 'USD'
        }
      });
      
      logger.info('Pool account initialized', {
        initialBalance: config.pool?.initialBalance || 0,
        currency: config.pool?.currency || 'USD'
      });
    }
  } catch (error) {
    logger.error('Failed to seed pool account', {
      message: error.message,
      code: error.code
    });
  }
}

/**
 * Initialize database connection and run startup tasks
 */
async function initializeDatabase() {
  try {
    const isConnected = await testConnection();
    
    if (isConnected) {
      await seedPoolAccount();
      logger.info('Database initialization completed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('Database initialization failed', {
      message: error.message,
      code: error.code
    });
    return false;
  }
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

// Initialize database on startup if not in test mode
if (!config.app.isTest && process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    initializeDatabase().catch(error => {
      logger.error('Failed to initialize database on startup', error);
    });
  }, 1000); // Delay to allow other services to start
}

module.exports = {
  prisma,
  testConnection,
  disconnect,
  checkHealth,
  executeTransaction,
  getStats,
  cleanupOldRecords,
  softDelete,
  paginate,
  initializeDatabase
};