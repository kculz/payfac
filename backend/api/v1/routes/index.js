const fs = require('fs');
const path = require('path');

function registerRoutes(app) {
  const routesPath = __dirname;
  
  // Read all files in the routes directory
  const files = fs.readdirSync(routesPath);
  
  for (const file of files) {
    // Skip index.js and non-JavaScript files
    if (file === 'index.js' || !file.endsWith('.js')) {
      continue;
    }
    
    const filePath = path.join(routesPath, file);
    const stats = fs.statSync(filePath);
    
    // Skip if it's a directory
    if (!stats.isFile()) {
      continue;
    }
    
    // Skip empty files
    if (stats.size === 0) {
      console.log(`Skipping empty file: ${file}`);
      continue;
    }
    
    try {
      const routeModule = require(filePath);
      
      // Check if the module exports a valid router
      if (routeModule && typeof routeModule === 'function') {
        // If it's a router function, use it
        app.use(routeModule);
        console.log(`Loaded routes from: ${file}`);
      } else if (routeModule && routeModule.router && typeof routeModule.router === 'function') {
        // If it exports an object with a router property
        app.use(routeModule.router);
        console.log(`Loaded routes from: ${file}`);
      } else {
        console.log(`Skipping ${file}: No valid router export found`);
      }
    } catch (error) {
      console.error(`Error loading routes from ${file}:`, error.message);
    }
  }
}

module.exports = registerRoutes;