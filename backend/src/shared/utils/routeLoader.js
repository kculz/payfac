/**
 * Route Loader Utility - Improved Version
 * 
 * Dynamically loads all route files from specified directories.
 * Automatically handles versioning, empty files, and route registration.
 * 
 * Location: src/shared/utils/routeLoader.js
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const express = require('express');
const logger = require('./logger');

/**
 * Cache for loaded modules to prevent redundant require() calls
 */
const moduleCache = new Map();

/**
 * Load all routes from a directory
 * @param {Object} app - Express app instance
 * @param {Object} options - Loader options
 * @returns {Promise<Array>} Array of loaded routes
 */
async function loadRoutes(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'],
    prefix = '/api',
    verbose = true,
    skipFiles = ['index.js', 'index.ts'],
    allowedExtensions = ['.js', '.ts']
  } = options;

  try {
    logger.info('Loading routes...', { routesPath, versions, prefix });

    const loadedRoutes = [];

    // Load routes for each version
    for (const version of versions) {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fsSync.existsSync(versionPath)) {
        logger.warn(`Routes directory not found: ${versionPath}`);
        continue;
      }

      const versionPrefix = `${prefix}/${version}`;
      const routes = await loadVersionRoutes(versionPath, versionPrefix, {
        skipFiles,
        allowedExtensions
      });
      
      // Register routes with express app
      routes.forEach(({ router, routePath }) => {
        app.use(routePath, router);
        loadedRoutes.push({ version, path: routePath });
      });
    }

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
 * @param {Object} options - Loading options
 * @returns {Promise<Array>} Array of route configurations
 */
async function loadVersionRoutes(versionPath, versionPrefix, options = {}) {
  const {
    skipFiles = ['index.js', 'index.ts'],
    allowedExtensions = ['.js', '.ts']
  } = options;

  const routes = [];
  
  try {
    const files = await fs.readdir(versionPath);

    for (const file of files) {
      // Skip non-allowed files
      if (!allowedExtensions.some(ext => file.endsWith(ext))) {
        continue;
      }

      // Skip designated files
      if (skipFiles.includes(file)) {
        continue;
      }

      const filePath = path.join(versionPath, file);
      
      try {
        // Import the route file
        const routeModule = requireModule(filePath);

        // Skip empty or invalid modules
        if (!routeModule || typeof routeModule !== 'object') {
          logger.warn(`Skipping invalid route file: ${file}`);
          continue;
        }

        // Check if it's an Express router or has default/router export
        const router = extractRouter(routeModule);
        
        if (!router) {
          logger.warn(`Skipping non-router export: ${file}`);
          continue;
        }

        // Extract route name from filename
        const routeName = extractRouteName(file);

        // Build full route path
        const routePath = `${versionPrefix}/${routeName}`;

        routes.push({
          router,
          routePath,
          fileName: file
        });

        logger.debug(`Route loaded: ${routePath} from ${file}`);

      } catch (error) {
        logger.error(`Failed to load route file: ${file}`, {
          error: error.message,
          stack: error.stack
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to read directory: ${versionPath}`, {
      error: error.message
    });
    throw error;
  }

  return routes;
}

/**
 * Require a module with caching support
 * @param {string} filePath - Path to module
 * @returns {*} Module exports
 */
function requireModule(filePath) {
  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath);
  }

  const module = require(filePath);
  moduleCache.set(filePath, module);
  return module;
}

/**
 * Extract router from module (handles default exports, named exports)
 * @param {Object} routeModule - Imported module
 * @returns {Object|null} Express router or null
 */
function extractRouter(routeModule) {
  // Direct router export
  if (isExpressRouter(routeModule)) {
    return routeModule;
  }

  // ES6 default export
  if (routeModule.default && isExpressRouter(routeModule.default)) {
    return routeModule.default;
  }

  // Named router export
  if (routeModule.router && isExpressRouter(routeModule.router)) {
    return routeModule.router;
  }

  return null;
}

/**
 * Extract route name from filename
 * @param {string} filename - File name
 * @returns {string} Route name
 */
function extractRouteName(filename) {
  return filename
    .replace(/\.(routes?|controller|handler)\.(js|ts)$/i, '')
    .replace(/\.(js|ts)$/i, '')
    .toLowerCase();
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
    typeof obj.post === 'function' &&
    Array.isArray(obj.stack) // Additional check for router stack
  );
}

/**
 * Advanced route loader with middleware and error handling
 * @param {Object} app - Express app
 * @param {Object} options - Advanced options
 * @returns {Promise<Array>} Loaded routes
 */
async function loadRoutesAdvanced(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'],
    prefix = '/api',
    middleware = {},
    errorHandlers = {},
    verbose = true,
    skipFiles = ['index.js', 'index.ts'],
    allowedExtensions = ['.js', '.ts']
  } = options;

  try {
    logger.info('Loading routes with advanced configuration...');

    const loadedRoutes = [];

    for (const version of versions) {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fsSync.existsSync(versionPath)) {
        logger.warn(`Routes directory not found: ${versionPath}`);
        continue;
      }

      const versionPrefix = `${prefix}/${version}`;
      
      // Create version-specific router
      const versionRouter = express.Router();

      // Apply version-specific middleware
      if (middleware[version]) {
        const mwArray = Array.isArray(middleware[version]) 
          ? middleware[version] 
          : [middleware[version]];
        
        mwArray.forEach(mw => {
          versionRouter.use(mw);
          logger.debug(`Applied middleware to ${version}`);
        });
      }

      // Load and mount routes
      const routes = await loadVersionRoutes(versionPath, '', {
        skipFiles,
        allowedExtensions
      });

      routes.forEach(({ router, routePath, fileName }) => {
        const mountPath = routePath || `/${extractRouteName(fileName)}`;
        versionRouter.use(mountPath, router);
        loadedRoutes.push({ 
          version, 
          path: `${versionPrefix}${mountPath}`,
          fileName 
        });
      });

      // Apply version-specific error handler
      if (errorHandlers[version]) {
        versionRouter.use(errorHandlers[version]);
      }

      // Mount version router
      app.use(versionPrefix, versionRouter);
    }

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
 * @returns {Promise<Array>} Loaded routes
 */
async function loadRoutesWithDocs(app, options = {}) {
  const loadedRoutes = await loadRoutes(app, options);

  // Create documentation endpoint for each version
  const versions = options.versions || ['v1'];
  const prefix = options.prefix || '/api';

  versions.forEach(version => {
    const docsPath = `${prefix}/${version}/docs`;
    
    app.get(docsPath, (req, res) => {
      const versionRoutes = loadedRoutes.filter(r => r.version === version);
      
      res.json({
        version,
        baseUrl: `${req.protocol}://${req.get('host')}${prefix}/${version}`,
        timestamp: new Date().toISOString(),
        routes: versionRoutes.map(r => ({
          path: r.path,
          fullUrl: `${req.protocol}://${req.get('host')}${r.path}`,
          fileName: r.fileName
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
 * @param {Object} app - Express app
 * @param {Object} options - Options
 * @returns {Promise<Array>} Loaded routes
 */
async function loadRoutesNested(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'src', 'api'),
    versions = ['v1'],
    prefix = '/api',
    maxDepth = 2,
    verbose = true,
    skipFiles = ['index.js', 'index.ts'],
    allowedExtensions = ['.js', '.ts']
  } = options;

  try {
    logger.info('Loading nested routes...');

    const loadedRoutes = [];

    for (const version of versions) {
      const versionPath = path.join(routesPath, version, 'routes');
      
      if (!fsSync.existsSync(versionPath)) {
        continue;
      }

      const versionPrefix = `${prefix}/${version}`;
      
      // Recursively load routes
      const routes = await loadRoutesRecursive(versionPath, versionPrefix, 0, maxDepth, {
        skipFiles,
        allowedExtensions
      });
      
      routes.forEach(({ router, routePath, fileName }) => {
        app.use(routePath, router);
        loadedRoutes.push({ version, path: routePath, fileName });
      });
    }

    if (verbose) {
      logger.info('Nested routes loaded successfully', {
        total: loadedRoutes.length
      });
    }

    return loadedRoutes;

  } catch (error) {
    logger.error('Failed to load nested routes', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Recursively load routes from directories
 * @param {string} dirPath - Directory path
 * @param {string} prefix - URL prefix
 * @param {number} depth - Current depth
 * @param {number} maxDepth - Maximum depth
 * @param {Object} options - Loading options
 * @returns {Promise<Array>} Routes
 */
async function loadRoutesRecursive(dirPath, prefix, depth, maxDepth, options = {}) {
  if (depth > maxDepth) {
    return [];
  }

  const {
    skipFiles = ['index.js', 'index.ts'],
    allowedExtensions = ['.js', '.ts']
  } = options;

  const routes = [];
  
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        // Recursively load from subdirectory
        const subRoutes = await loadRoutesRecursive(
          itemPath,
          `${prefix}/${item.name}`,
          depth + 1,
          maxDepth,
          options
        );
        routes.push(...subRoutes);
      } else if (item.isFile() && allowedExtensions.some(ext => item.name.endsWith(ext))) {
        // Skip designated files
        if (skipFiles.includes(item.name)) {
          continue;
        }

        // Load route file
        try {
          const routeModule = requireModule(itemPath);
          const router = extractRouter(routeModule);
          
          if (router) {
            const routeName = extractRouteName(item.name);
            routes.push({
              router,
              routePath: `${prefix}/${routeName}`,
              fileName: item.name
            });
          }
        } catch (error) {
          logger.error(`Failed to load route: ${item.name}`, { 
            error: error.message,
            path: itemPath
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to read directory: ${dirPath}`, {
      error: error.message
    });
  }

  return routes;
}

/**
 * Get list of all loaded routes (for debugging)
 * @param {Object} app - Express app
 * @returns {Array} All registered routes
 */
function getRegisteredRoutes(app) {
  if (!app._router) {
    logger.warn('Express app has no router stack');
    return [];
  }

  const routes = [];

  function extractRoutes(stack, basePath = '') {
    if (!Array.isArray(stack)) {
      return;
    }

    stack.forEach(layer => {
      if (layer.route) {
        // Regular route
        const methods = Object.keys(layer.route.methods)
          .map(m => m.toUpperCase())
          .join(', ');
        
        routes.push({
          path: basePath + layer.route.path,
          methods,
          name: layer.name || 'anonymous'
        });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // Router middleware - extract path from regexp
        let routerPath = '';
        
        if (layer.regexp) {
          routerPath = layer.regexp.source
            .replace(/^\^\\\//, '/')
            .replace(/\\\/\?\(\?=\\\/\|\$\)/g, '')
            .replace(/\\\//g, '/')
            .replace(/\$$/g, '');
        }
        
        extractRoutes(layer.handle.stack, basePath + routerPath);
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

  if (routes.length === 0) {
    console.log('\nNo routes registered.\n');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('REGISTERED ROUTES');
  console.log('='.repeat(80));

  // Group by base path for better readability
  const grouped = routes.reduce((acc, route) => {
    const basePath = route.path.split('/')[1] || 'root';
    if (!acc[basePath]) acc[basePath] = [];
    acc[basePath].push(route);
    return acc;
  }, {});

  Object.entries(grouped).forEach(([base, routeList]) => {
    console.log(`\n[${base.toUpperCase()}]`);
    routeList.forEach(route => {
      console.log(`  ${route.methods.padEnd(10)} ${route.path}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log(`Total routes: ${routes.length}\n`);
}

/**
 * Clear module cache (useful for hot-reloading in development)
 */
function clearModuleCache() {
  moduleCache.clear();
  logger.debug('Module cache cleared');
}

/**
 * Validate route configuration
 * @param {Object} options - Route options to validate
 * @throws {Error} If configuration is invalid
 */
function validateRouteConfig(options) {
  if (options.versions && !Array.isArray(options.versions)) {
    throw new Error('versions must be an array');
  }

  if (options.prefix && typeof options.prefix !== 'string') {
    throw new Error('prefix must be a string');
  }

  if (options.maxDepth && (typeof options.maxDepth !== 'number' || options.maxDepth < 0)) {
    throw new Error('maxDepth must be a positive number');
  }
}

module.exports = {
  loadRoutes,
  loadRoutesAdvanced,
  loadRoutesWithDocs,
  loadRoutesNested,
  getRegisteredRoutes,
  printRouteTable,
  clearModuleCache,
  validateRouteConfig
};