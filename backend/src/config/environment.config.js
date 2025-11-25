/**
 * Environment Configuration
 * 
 * Central configuration file that validates and exports all environment variables.
 * This file ensures all required configurations are present before the app starts.
 * 
 * Location: src/config/environment.js
 */

require('dotenv').config();

/**
 * Validates that required environment variables are set
 * @param {Array<string>} requiredVars - Array of required variable names
 * @throws {Error} If any required variable is missing
 */
function validateRequiredEnvVars(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file.'
    );
  }
}

/**
 * Parse a boolean environment variable
 * @param {string} value - Environment variable value
 * @param {boolean} defaultValue - Default value if not set
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse an integer environment variable
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function parseInteger(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse a float environment variable
 * @param {string} value - Environment variable value
 * @param {number} defaultValue - Default value if not set
 * @returns {number}
 */
function parseFloat(value, defaultValue) {
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Critical environment variables that must be present
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

// Validate before creating config
validateRequiredEnvVars(REQUIRED_ENV_VARS);

/**
 * Application Configuration Object
 */
const config = {
  // Application Settings
  app: {
    name: process.env.APP_NAME || 'Payment Facilitator Platform',
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInteger(process.env.PORT, 3000),
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test'
  },

  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    // Enable query logging in development
    logging: parseBoolean(process.env.DB_LOGGING, process.env.NODE_ENV === 'development')
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'payfac-platform',
    audience: process.env.JWT_AUDIENCE || 'payfac-api'
  },

  // Payment Gateway Configuration
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'stripe', // 'stripe' or 'paypal'
    
    // Stripe Configuration
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      apiVersion: process.env.STRIPE_API_VERSION || '2023-10-16'
    },
    
    // PayPal Configuration (alternative)
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox' // 'sandbox' or 'live'
    }
  },

  // Pool Account Configuration
  pool: {
    initialBalance: parseFloat(process.env.POOL_INITIAL_BALANCE, 10000.00),
    minBalance: parseFloat(process.env.POOL_MIN_BALANCE, 1000.00),
    currency: process.env.POOL_CURRENCY || 'USD',
    // Alert when pool balance drops below this threshold
    alertThreshold: parseFloat(process.env.POOL_ALERT_THRESHOLD, 2000.00)
  },

  // Email Configuration
  email: {
    enabled: parseBoolean(process.env.EMAIL_ENABLED, true),
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInteger(process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false), // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'Payment Facilitator Platform',
      email: process.env.SMTP_FROM || 'noreply@yourdomain.com'
    }
  },

  // CORS Configuration
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['http://localhost:3000', 'http://localhost:19006'], // Default for web & React Native
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true)
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
    max: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 100), // requests per windowMs
    skipSuccessfulRequests: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESS, false)
  },

  // Security Settings
  security: {
    bcryptRounds: parseInteger(process.env.BCRYPT_ROUNDS, 10),
    maxLoginAttempts: parseInteger(process.env.MAX_LOGIN_ATTEMPTS, 5),
    lockoutDuration: parseInteger(process.env.LOCKOUT_DURATION_MINUTES, 30) * 60 * 1000 // in ms
  },

  // Transaction Limits
  limits: {
    minTransactionAmount: parseFloat(process.env.MIN_TRANSACTION_AMOUNT, 1.00),
    maxTransactionAmount: parseFloat(process.env.MAX_TRANSACTION_AMOUNT, 10000.00),
    minDepositAmount: parseFloat(process.env.MIN_DEPOSIT_AMOUNT, 10.00),
    maxDepositAmount: parseFloat(process.env.MAX_DEPOSIT_AMOUNT, 50000.00),
    minPayoutAmount: parseFloat(process.env.MIN_PAYOUT_AMOUNT, 10.00),
    dailyTransactionLimit: parseFloat(process.env.DAILY_TRANSACTION_LIMIT, 50000.00)
  },

  // Feature Flags
  features: {
    enableWebhooks: parseBoolean(process.env.ENABLE_WEBHOOKS, true),
    enableEmailNotifications: parseBoolean(process.env.ENABLE_EMAIL_NOTIFICATIONS, true),
    enableSMSNotifications: parseBoolean(process.env.ENABLE_SMS_NOTIFICATIONS, false),
    enableRefunds: parseBoolean(process.env.ENABLE_REFUNDS, true),
    enablePayouts: parseBoolean(process.env.ENABLE_PAYOUTS, true)
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info', // 'error', 'warn', 'info', 'debug'
    format: process.env.LOG_FORMAT || 'json', // 'json' or 'simple'
    // Log to file in production
    fileLogging: parseBoolean(
      process.env.LOG_TO_FILE, 
      process.env.NODE_ENV === 'production'
    ),
    logDirectory: process.env.LOG_DIRECTORY || './logs'
  }
};

/**
 * Validate payment gateway configuration
 */
function validatePaymentConfig() {
  if (config.payment.provider === 'stripe') {
    if (!config.payment.stripe.secretKey) {
      console.warn('⚠️  Warning: STRIPE_SECRET_KEY is not set. Payment processing will fail.');
    }
  } else if (config.payment.provider === 'paypal') {
    if (!config.payment.paypal.clientId || !config.payment.paypal.clientSecret) {
      console.warn('⚠️  Warning: PayPal credentials are not set. Payment processing will fail.');
    }
  }
}

// Run validation
validatePaymentConfig();

/**
 * Print configuration summary (without sensitive data)
 */
function printConfigSummary() {
  if (config.app.isDevelopment) {
    console.log('');
    console.log('🔧 Configuration Summary:');
    console.log('========================');
    console.log(`Environment: ${config.app.nodeEnv}`);
    console.log(`Port: ${config.app.port}`);
    console.log(`Payment Provider: ${config.payment.provider}`);
    console.log(`Email Enabled: ${config.email.enabled}`);
    console.log(`Log Level: ${config.logging.level}`);
    console.log('========================');
    console.log('');
  }
}

// Print summary in development
if (config.app.isDevelopment) {
  printConfigSummary();
}

// Export configuration
module.exports = config;

/**
 * Export individual config sections for easier imports
 * Usage: const { database } = require('./config/environment');
 */
module.exports.app = config.app;
module.exports.database = config.database;
module.exports.jwt = config.jwt;
module.exports.payment = config.payment;
module.exports.pool = config.pool;
module.exports.email = config.email;
module.exports.cors = config.cors;
module.exports.rateLimit = config.rateLimit;
module.exports.security = config.security;
module.exports.limits = config.limits;
module.exports.features = config.features;
module.exports.logging = config.logging;