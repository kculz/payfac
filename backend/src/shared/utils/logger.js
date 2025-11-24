/**
 * Logger Utility
 * 
 * Centralized logging system using Winston.
 * Provides structured logging with different levels and formats.
 * 
 * Location: src/shared/utils/logger.js
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../../config/environment.config');

// Ensure log directory exists
if (config.logging.fileLogging) {
  if (!fs.existsSync(config.logging.logDirectory)) {
    fs.mkdirSync(config.logging.logDirectory, { recursive: true });
  }
}

/**
 * Custom format for console output in development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return msg;
  })
);

/**
 * JSON format for production (easier to parse)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create transports array based on configuration
 */
const transports = [];

// Console transport (always enabled)
transports.push(
  new winston.transports.Console({
    format: config.app.isDevelopment ? consoleFormat : jsonFormat,
    handleExceptions: true
  })
);

// File transports (enabled in production or if configured)
if (config.logging.fileLogging) {
  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.logDirectory, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.logDirectory, 'combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: jsonFormat,
  defaultMeta: {
    service: config.app.name,
    environment: config.app.nodeEnv
  },
  transports,
  exitOnError: false
});

/**
 * Create a child logger with additional metadata
 * Useful for adding context like userId, requestId, etc.
 * 
 * @param {Object} meta - Additional metadata to include in all logs
 * @returns {Object} Child logger instance
 * 
 * @example
 * const requestLogger = logger.child({ requestId: '123', userId: 'user-456' });
 * requestLogger.info('Processing transaction'); // Will include requestId and userId
 */
logger.child = (meta) => {
  return logger.child(meta);
};

/**
 * Log a transaction event
 * Specialized method for logging financial transactions
 * 
 * @param {string} action - Transaction action (sale, refund, deposit, etc.)
 * @param {Object} data - Transaction data
 */
logger.transaction = (action, data) => {
  logger.info('Transaction', {
    action,
    transactionId: data.id,
    userId: data.userId,
    amount: data.amount,
    status: data.status,
    type: data.type,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log a security event
 * Specialized method for logging security-related events
 * 
 * @param {string} event - Security event type
 * @param {Object} data - Event data
 */
logger.security = (event, data) => {
  logger.warn('Security Event', {
    event,
    userId: data.userId,
    ip: data.ip,
    userAgent: data.userAgent,
    details: data.details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Log an API request
 * Specialized method for logging API requests
 * 
 * @param {Object} req - Express request object
 * @param {number} statusCode - Response status code
 * @param {number} duration - Request duration in ms
 */
logger.request = (req, statusCode, duration) => {
  const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  logger.log(logLevel, 'HTTP Request', {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
};

/**
 * Log a performance metric
 * Useful for tracking slow operations
 * 
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 * @param {Object} meta - Additional metadata
 */
logger.performance = (operation, duration, meta = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  
  logger.log(level, 'Performance', {
    operation,
    duration: `${duration}ms`,
    ...meta
  });
};

/**
 * Log a database query (only in development)
 * 
 * @param {string} query - SQL query or operation name
 * @param {number} duration - Query duration in ms
 */
logger.query = (query, duration) => {
  if (config.app.isDevelopment && config.database.logging) {
    logger.debug('Database Query', {
      query: query.substring(0, 200), // Truncate long queries
      duration: `${duration}ms`
    });
  }
};

/**
 * Log an error with full stack trace
 * Enhanced error logging with context
 * 
 * @param {Error} error - Error object
 * @param {Object} context - Additional context about the error
 */
logger.errorWithContext = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    ...context
  });
};

/**
 * Log pool account activity
 * Specialized method for pool account operations
 * 
 * @param {string} action - Pool action (allocate, deallocate, sync, etc.)
 * @param {Object} data - Pool operation data
 */
logger.pool = (action, data) => {
  logger.info('Pool Account Activity', {
    action,
    amount: data.amount,
    userId: data.userId,
    previousBalance: data.previousBalance,
    newBalance: data.newBalance,
    timestamp: new Date().toISOString()
  });
};

/**
 * Create a timer to measure operation duration
 * Returns a function that when called, logs the duration
 * 
 * @param {string} operation - Operation name
 * @returns {Function} Function to call when operation completes
 * 
 * @example
 * const timer = logger.startTimer('Process Payment');
 * // ... do work ...
 * timer(); // Logs: "Process Payment completed in Xms"
 */
logger.startTimer = (operation) => {
  const start = Date.now();
  
  return (meta = {}) => {
    const duration = Date.now() - start;
    logger.performance(operation, duration, meta);
  };
};

/**
 * Sanitize sensitive data before logging
 * Removes or masks sensitive information
 * 
 * @param {Object} data - Data object to sanitize
 * @returns {Object} Sanitized data
 */
logger.sanitize = (data) => {
  const sensitiveFields = [
    'password',
    'password_hash',
    'token',
    'refreshToken',
    'apiKey',
    'secret',
    'cardNumber',
    'cvv',
    'ssn',
    'accountNumber'
  ];

  const sanitized = { ...data };

  Object.keys(sanitized).forEach(key => {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '***REDACTED***';
    }
    
    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = logger.sanitize(sanitized[key]);
    }
  });

  return sanitized;
};

// Handle uncaught exceptions
if (config.app.isProduction) {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Give logger time to write before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString()
    });
  });
}

// Log startup
logger.info('Logger initialized', {
  level: config.logging.level,
  format: config.logging.format,
  fileLogging: config.logging.fileLogging
});

module.exports = logger;