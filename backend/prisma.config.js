// prisma.config.js
require('dotenv').config();

const { defineConfig, env } = require('@prisma/config');

module.exports = defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
  schema: './prisma/schema.prisma',
});
