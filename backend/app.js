/**
 * Application Setup
 * 
 * Main Express application configuration.
 * Sets up middleware, routes, and error handling.
 * 
 * Location: src/app.js
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./src/config/environment.config');
const logger = require('./src/shared/utils/logger');
const { loadRoutes, printRouteTable } = require('./src/shared/utils/routeLoader');

// Import middleware
const { errorHandler, notFoundHandler } = require('./src/shared/middleware/errorHandler.middleware');
const { conditionalLogger } = require('./src/shared/middleware/requestLogger.middleware');

// Create Express app
const app = express();

// Trust proxy (for getting real IP behind reverse proxy)
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: config.cors.allowedOrigins,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// HTTP request logging
if (config.app.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Custom request logging middleware
app.use(conditionalLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.nodeEnv,
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: config.app.name,
    version: '1.0.0',
    environment: config.app.nodeEnv,
    api: {
      v1: '/api/v1',
      docs: '/api/v1/docs'
    },
    health: '/health'
  });
});

// Load all API routes automatically
loadRoutes(app, {
  versions: ['v1'], // Can add v2, v3, etc.
  prefix: '/api',
  verbose: config.app.isDevelopment
});

// Print route table in development
if (config.app.isDevelopment) {
  setTimeout(() => {
    printRouteTable(app);
  }, 1000);
}

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;