/**
 * Route Loader Utility
 * 
 * Dynamically loads all route files from specified directories.
 * Automatically handles versioning, empty files, and route registration.
 * 
 * Location: src/shared/utils/routeLoader.js
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const logger = require('./logger');

/**
 * Load all routes from a directory
 * @param {Object} app - Express app instance
 * @param {Object} options - Loader options
 */
function loadRoutes(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'], // API versions to load
    prefix = '/api', // Base prefix for all routes
    verbose = true // Log loaded routes
  } = options;

  try {
    logger.info('Loading routes...', { routesPath, versions, prefix });

    const loadedRoutes = [];

    // Load routes for each version
    versions.forEach(version => {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fs.existsSync(versionPath)) {
        logger.warn(`Routes directory not found: ${versionPath}`);
        return;
      }

      const versionPrefix = `${prefix}/${version}`;
      const routes = loadVersionRoutes(versionPath, versionPrefix);
      
      // Register routes with express app
      routes.forEach(({ router, routePath }) => {
        app.use(routePath, router);
        loadedRoutes.push({ version, path: routePath });
      });
    });

    if (verbose) {
      logger.info('Routes loaded successfully', {
        total: loadedRoutes.length,
        routes: loadedRoutes
      });
    }

    return loadedRoutes;

  } catch (error) {
    logger.error('Failed to load routes', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Load routes for a specific version
 * @param {string} versionPath - Path to version routes directory
 * @param {string} versionPrefix - URL prefix for this version
 * @returns {Array} Array of route configurations
 */
function loadVersionRoutes(versionPath, versionPrefix) {
  const routes = [];
  const files = fs.readdirSync(versionPath);

  files.forEach(file => {
    // Skip non-JavaScript files
    if (!file.endsWith('.js') && !file.endsWith('.routes.js')) {
      return;
    }

    // Skip index files
    if (file === 'index.js') {
      return;
    }

    const filePath = path.join(versionPath, file);
    
    try {
      // Import the route file
      const routeModule = require(filePath);

      // Skip empty or invalid modules
      if (!routeModule || typeof routeModule !== 'object') {
        logger.warn(`Skipping invalid route file: ${file}`);
        return;
      }

      // Check if it's an Express router
      if (!isExpressRouter(routeModule)) {
        logger.warn(`Skipping non-router export: ${file}`);
        return;
      }

      // Extract route name from filename
      // auth.routes.js -> auth
      // user.js -> user
      const routeName = file
        .replace('.routes.js', '')
        .replace('.js', '');

      // Build full route path
      const routePath = `${versionPrefix}/${routeName}`;

      routes.push({
        router: routeModule,
        routePath,
        fileName: file
      });

      logger.debug(`Route loaded: ${routePath} from ${file}`);

    } catch (error) {
      logger.error(`Failed to load route file: ${file}`, {
        error: error.message
      });
    }
  });

  return routes;
}

/**
 * Check if object is an Express router
 * @param {*} obj - Object to check
 * @returns {boolean}
 */
function isExpressRouter(obj) {
  return (
    obj &&
    typeof obj === 'function' &&
    typeof obj.use === 'function' &&
    typeof obj.get === 'function' &&
    typeof obj.post === 'function'
  );
}

/**
 * Advanced route loader with middleware and error handling
 * @param {Object} app - Express app
 * @param {Object} options - Advanced options
 */
function loadRoutesAdvanced(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'],
    prefix = '/api',
    middleware = {}, // Version-specific middleware
    errorHandlers = {}, // Version-specific error handlers
    verbose = true
  } = options;

  try {
    logger.info('Loading routes with advanced configuration...');

    const loadedRoutes = [];

    versions.forEach(version => {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fs.existsSync(versionPath)) {
        logger.warn(`Routes directory not found: ${versionPath}`);
        return;
      }

      const versionPrefix = `${prefix}/${version}`;
      
      // Create version-specific router
      const versionRouter = express.Router();

      // Apply version-specific middleware
      if (middleware[version]) {
        middleware[version].forEach(mw => {
          versionRouter.use(mw);
          logger.debug(`Applied middleware to ${version}`);
        });
      }

      // Load and mount routes
      const routes = loadVersionRoutes(versionPath, '');
      routes.forEach(({ router, routePath }) => {
        versionRouter.use(routePath.replace(versionPrefix, ''), router);
        loadedRoutes.push({ version, path: `${versionPrefix}${routePath}` });
      });

      // Apply version-specific error handler
      if (errorHandlers[version]) {
        versionRouter.use(errorHandlers[version]);
      }

      // Mount version router
      app.use(versionPrefix, versionRouter);
    });

    if (verbose) {
      logger.info('Advanced routes loaded successfully', {
        total: loadedRoutes.length,
        routes: loadedRoutes
      });
    }

    return loadedRoutes;

  } catch (error) {
    logger.error('Failed to load advanced routes', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Load routes with automatic API documentation
 * @param {Object} app - Express app
 * @param {Object} options - Options
 */
function loadRoutesWithDocs(app, options = {}) {
  const loadedRoutes = loadRoutes(app, options);

  // Create documentation endpoint for each version
  options.versions?.forEach(version => {
    const docsPath = `${options.prefix || '/api'}/${version}/docs`;
    
    app.get(docsPath, (req, res) => {
      const versionRoutes = loadedRoutes.filter(r => r.version === version);
      
      res.json({
        version,
        baseUrl: `${req.protocol}://${req.get('host')}${options.prefix || '/api'}/${version}`,
        routes: versionRoutes.map(r => ({
          path: r.path,
          fullUrl: `${req.protocol}://${req.get('host')}${r.path}`
        })),
        documentation: `${req.protocol}://${req.get('host')}${docsPath}`
      });
    });

    logger.info(`Documentation endpoint created: ${docsPath}`);
  });

  return loadedRoutes;
}

/**
 * Load routes from nested directories
 * Supports modular route organization
 * @param {Object} app - Express app
 * @param {Object} options - Options
 */
function loadRoutesNested(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'],
    prefix = '/api',
    maxDepth = 2,
    verbose = true
  } = options;

  try {
    logger.info('Loading nested routes...');

    const loadedRoutes = [];

    versions.forEach(version => {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fs.existsSync(versionPath)) {
        return;
      }

      const versionPrefix = `${prefix}/${version}`;
      
      // Recursively load routes
      const routes = loadRoutesRecursive(versionPath, versionPrefix, 0, maxDepth);
      
      routes.forEach(({ router, routePath }) => {
        app.use(routePath, router);
        loadedRoutes.push({ version, path: routePath });
      });
    });

    if (verbose) {
      logger.info('Nested routes loaded successfully', {
        total: loadedRoutes.length
      });
    }

    return loadedRoutes;

  } catch (error) {
    logger.error('Failed to load nested routes', { error: error.message });
    throw error;
  }
}

/**
 * Recursively load routes from directories
 * @param {string} dirPath - Directory path
 * @param {string} prefix - URL prefix
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum depth
 * @returns {Array} Routes
 */
function loadRoutesRecursive(dirPath, prefix, depth, maxDepth) {
  if (depth > maxDepth) {
    return [];
  }

  const routes = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  items.forEach(item => {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      // Recursively load from subdirectory
      const subRoutes = loadRoutesRecursive(
        itemPath,
        `${prefix}/${item.name}`,
        depth + 1,
        maxDepth
      );
      routes.push(...subRoutes);
    } else if (item.isFile() && item.name.endsWith('.js')) {
      // Load route file
      try {
        const routeModule = require(itemPath);
        
        if (isExpressRouter(routeModule)) {
          const routeName = item.name.replace('.routes.js', '').replace('.js', '');
          routes.push({
            router: routeModule,
            routePath: `${prefix}/${routeName}`,
            fileName: item.name
          });
        }
      } catch (error) {
        logger.error(`Failed to load route: ${item.name}`, { error: error.message });
      }
    }
  });

  return routes;
}

/**
 * Get list of all loaded routes (for debugging)
 * @param {Object} app - Express app
 * @returns {Array} All registered routes
 */
function getRegisteredRoutes(app) {
  const routes = [];

  function extractRoutes(stack, basePath = '') {
    stack.forEach(layer => {
      if (layer.route) {
        // Regular route
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        routes.push({
          path: basePath + layer.route.path,
          methods,
          name: layer.name
        });
      } else if (layer.name === 'router') {
        // Router middleware
        const path = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/');
        
        extractRoutes(layer.handle.stack, basePath + path);
      }
    });
  }

  extractRoutes(app._router.stack);

  return routes;
}

/**
 * Print route table to console
 * @param {Object} app - Express app
 */
function printRouteTable(app) {
  const routes = getRegisteredRoutes(app);

  console.log('\n' + '='.repeat(80));
  console.log('REGISTERED ROUTES');
  console.log('='.repeat(80));

  routes.forEach(route => {
    console.log(`${route.methods.padEnd(10)} ${route.path}`);
  });

  console.log('='.repeat(80));
  console.log(`Total routes: ${routes.length}\n`);
}

module.exports = {
  loadRoutes,
  loadRoutesAdvanced,
  loadRoutesWithDocs,
  loadRoutesNested,
  getRegisteredRoutes,
  printRouteTable
};