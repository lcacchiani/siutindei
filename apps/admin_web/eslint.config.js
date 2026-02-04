const nextConfig = require('eslint-config-next');

module.exports = [
  ...nextConfig,
  {
    ignores: ['node_modules/**', 'e2e/**', 'playwright.config.ts'],
  },
];
