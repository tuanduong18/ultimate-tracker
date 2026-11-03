/** @type {import('jest').Config} */
module.exports = {
  // Android only: the app ships no iOS or web build, so tests run one platform, not three.
  preset: 'jest-expo/android',
  // Tests live outside src/app/, where Expo Router would treat every file as a route.
  roots: ['<rootDir>/tests'],
};
