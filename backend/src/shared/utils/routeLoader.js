/**
 * Simple Route Loader
 * 
 * A simplified version that directly loads routes from your structure.
 * Use this if the advanced loader has issues.
 * 
 * Location: backend/src/shared/utils/simpleRouteLoader.js
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Load routes from a directory
 * @param {Object} app - Express app
 * @param {Object} options - Options
 */
function loadRoutes(app, options = {}) {
  const {
    routesPath = path.join(process.cwd(), 'api'),
    versions = ['v1'],
    prefix = '/api',
    verbose = true
  } = options;

  logger.info('Loading routes...', { routesPath, versions, prefix });

  const loadedRoutes = [];

  versions.forEach(version => {
    const versionRoutesPath = path.join(routesPath, version, 'routes');
    
    // Check if directory exists
    if (!fs.existsSync(versionRoutesPath)) {
      logger.warn(`Routes directory not found: ${versionRoutesPath}`);
      return;
    }

    logger.info(`Loading routes from: ${versionRoutesPath}`);

    // Read all files in the routes directory
    const files = fs.readdirSync(versionRoutesPath);

    files.forEach(file => {
      // Skip non-JavaScript files
      if (!file.endsWith('.js')) {
        return;
      }

      // Skip index.js
      if (file === 'index.js') {
        return;
      }

      const filePath = path.join(versionRoutesPath, file);
      
      // Check if file is empty
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        logger.warn(`Skipping empty file: ${file}`);
        return;
      }

      try {
        // Require the route file
        const routeModule = require(filePath);

        // Check if module is valid
        if (!routeModule) {
          logger.warn(`Skipping invalid module: ${file}`);
          return;
        }

        // Check if it's an Express router
        const isRouter = 
          typeof routeModule === 'function' &&
          typeof routeModule.use === 'function' &&
          typeof routeModule.get === 'function' &&
          typeof routeModule.post === 'function';

        if (!isRouter) {
          logger.warn(`Skipping non-router export: ${file}`);
          return;
        }

        // Extract route name from filename
        // auth.route.js -> auth
        // user.js -> user
        const routeName = file
          .replace('.route.js', '')
          .replace('.routes.js', '')
          .replace('.js', '');

        // Build route path
        const routePath = `${prefix}/${version}/${routeName}`;

        // Mount the router
        app.use(routePath, routeModule);

        loadedRoutes.push({
          version,
          path: routePath,
          file
        });

        logger.info(`✓ Loaded route: ${routePath} from ${file}`);

      } catch (error) {
        logger.error(`Failed to load route file: ${file}`, {
          error: error.message,
          stack: error.stack
        });
      }
    });
  });

  if (verbose) {
    logger.info(`Successfully loaded ${loadedRoutes.length} route(s)`);
    loadedRoutes.forEach(route => {
      logger.info(`  - ${route.path} (${route.file})`);
    });
  }

  return loadedRoutes;
}

/**
 * Print all registered routes
 * @param {Object} app - Express app
 */
function printRouteTable(app) {
  if (!app._router || !app._router.stack) {
    console.log('\nNo routes registered.\n');
    return;
  }

  const routes = [];

  function extractRoutes(stack, basePath = '') {
    stack.forEach(layer => {
      if (layer.route) {
        // Regular route
        const methods = Object.keys(layer.route.methods)
          .map(m => m.toUpperCase())
          .join(', ');
        
        routes.push({
          methods,
          path: basePath + layer.route.path
        });
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // Router middleware
        let routerPath = '';
        if (layer.regexp) {
          routerPath = layer.regexp.source
            .replace(/^\^\\\//, '/')
            .replace(/\\\//g, '/')
            .replace(/\?/g, '')
            .replace(/\$/g, '')
            .replace(/\(/g, '')
            .replace(/\)/g, '')
            .replace(/\|/g, '')
            .replace(/=/g, '');
        }
        
        extractRoutes(layer.handle.stack, basePath + routerPath);
      }
    });
  }

  extractRoutes(app._router.stack);

  if (routes.length === 0) {
    console.log('\nNo routes registered.\n');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('REGISTERED ROUTES');
  console.log('='.repeat(80));

  routes.forEach(route => {
    console.log(`${route.methods.padEnd(10)} ${route.path}`);
  });

  console.log('='.repeat(80));
  console.log(`Total: ${routes.length} route(s)\n`);
}

module.exports = {
  loadRoutes,
  printRouteTable
};