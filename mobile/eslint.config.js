const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  {
    ignores: ['.expo/', 'dist/', 'android/', 'ios/', 'coverage/', 'node_modules/', 'expo-env.d.ts'],
  },
  expoConfig,
  eslintConfigPrettier,
]);
