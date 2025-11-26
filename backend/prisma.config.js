// prisma.config.js

// 1. Ensure dotenv is loaded if running the CLI directly
require('dotenv').config();

// 2. Import the necessary utility functions
const { defineConfig, env } = require('@prisma/config');

// 3. Define the configuration using defineConfig
module.exports = defineConfig({
  datasource: {
    // The 'env' utility is used here to safely fetch the variable
    url: env('DATABASE_URL'), 
    provider: 'postgresql',
  },
  schema: './prisma/schema.prisma',
});