/**
 * Request Logger Middleware
 * 
 * Logs all HTTP requests with detailed information.
 * Tracks request duration, status, and user context.
 * 
 * Location: src/shared/middleware/requestLogger.js
 */

const logger = require('../utils/logger');
const config = require('../../config/environment.config');

/**
 * Request logger middleware
 * Logs incoming requests and their responses
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Attach request ID to request object
  req.requestId = requestId;

  // Log incoming request
  logIncomingRequest(req, requestId);

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    logOutgoingResponse(req, res, duration, requestId);

    return res.send(data);
  };

  next();
}

/**
 * Log incoming request
 */
function logIncomingRequest(req, requestId) {
  const logData = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    userRole: req.user?.role
  };

  // Include query params if present
  if (Object.keys(req.query).length > 0) {
    logData.query = req.query;
  }

  // Include request body (sanitized) for non-GET requests
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    logData.body = logger.sanitize(req.body);
  }

  logger.info('Incoming request', logData);
}

/**
 * Log outgoing response
 */
function logOutgoingResponse(req, res, duration, requestId) {
  const logData = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?.id
  };

  // Determine log level based on status code
  let logLevel = 'info';
  if (res.statusCode >= 500) {
    logLevel = 'error';
  } else if (res.statusCode >= 400) {
    logLevel = 'warn';
  }

  // Add warning for slow requests
  if (duration > 1000) {
    logData.slow = true;
    logLevel = 'warn';
  }

  logger[logLevel]('Outgoing response', logData);
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Enhanced request logger with more details
 */
function detailedRequestLogger(req, res, next) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  req.requestId = requestId;

  // Log detailed incoming request
  const incomingLog = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    protocol: req.protocol,
    hostname: req.hostname,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    referer: req.get('referer'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
    headers: sanitizeHeaders(req.headers),
    query: req.query,
    params: req.params,
    userId: req.user?.id,
    userRole: req.user?.role
  };

  if (req.method !== 'GET' && req.body) {
    incomingLog.body = logger.sanitize(req.body);
  }

  logger.debug('Detailed incoming request', incomingLog);

  // Capture response
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(data) {
    res.send = originalSend;
    logDetailedResponse(req, res, duration, requestId, data);
    return res.send(data);
  };

  res.json = function(data) {
    res.json = originalJson;
    logDetailedResponse(req, res, duration, requestId, data);
    return res.json(data);
  };

  const duration = Date.now() - startTime;
  next();
}

/**
 * Log detailed response
 */
function logDetailedResponse(req, res, duration, requestId, data) {
  const responseLog = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    statusMessage: res.statusMessage,
    duration: `${duration}ms`,
    responseSize: data ? Buffer.byteLength(JSON.stringify(data)) : 0,
    userId: req.user?.id
  };

  // Include response data in development
  if (config.app.isDevelopment && data) {
    responseLog.responseData = logger.sanitize(data);
  }

  const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
  logger[logLevel]('Detailed outgoing response', responseLog);
}

/**
 * Sanitize headers (remove sensitive data)
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '***REDACTED***';
    }
  });

  return sanitized;
}

/**
 * Request metrics middleware
 * Tracks request metrics for monitoring
 */
function requestMetrics(req, res, next) {
  const startTime = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // Metrics data
    const metrics = {
      method: req.method,
      path: req.route?.path || req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString()
    };

    // Log metrics
    logger.performance(`${req.method} ${req.path}`, duration, metrics);

    // Could send to monitoring service here
    // monitoringService.recordMetric(metrics);
  });

  next();
}

/**
 * Error request logger
 * Logs detailed information when errors occur
 */
function errorRequestLogger(err, req, res, next) {
  const errorLog = {
    requestId: req.requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode
    },
    request: {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: sanitizeHeaders(req.headers),
      body: logger.sanitize(req.body),
      query: req.query,
      params: req.params
    },
    user: {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.role
    },
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };

  logger.error('Request error', errorLog);

  next(err);
}

/**
 * Security event logger
 * Logs security-related events
 */
function securityLogger(event, req, details = {}) {
  logger.security(event, {
    requestId: req.requestId,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    url: req.originalUrl || req.url,
    method: req.method,
    details,
    timestamp: new Date().toISOString()
  });
}

/**
 * Skip logging for specific paths
 */
function skipLogging(paths = []) {
  return (req, res, next) => {
    const shouldSkip = paths.some(path => {
      if (typeof path === 'string') {
        return req.path === path;
      }
      if (path instanceof RegExp) {
        return path.test(req.path);
      }
      return false;
    });

    if (shouldSkip) {
      return next();
    }

    requestLogger(req, res, next);
  };
}

/**
 * Conditional logger based on environment
 */
function conditionalLogger(req, res, next) {
  if (config.app.isTest) {
    // Skip logging in test environment
    return next();
  }

  if (config.app.isDevelopment) {
    // Detailed logging in development
    return detailedRequestLogger(req, res, next);
  }

  // Standard logging in production
  return requestLogger(req, res, next);
}

module.exports = {
  requestLogger,
  detailedRequestLogger,
  requestMetrics,
  errorRequestLogger,
  securityLogger,
  skipLogging,
  conditionalLogger,
  generateRequestId
};