/** @type {import('jest').Config} */
module.exports = {
  // Android only: the app ships no iOS or web build, so tests run one platform, not three.
  preset: 'jest-expo/android',
  // Tests live outside src/app/, where Expo Router would treat every file as a route.
  roots: ['<rootDir>/tests'],
  // The first render in a screen suite loads React Native's renderer and takes ~2 s on a cold
  // cache even on a fast machine; under a full parallel run on CI's two cores, Jest's 5 s
  // default is within reach. A real hang still fails, just later.
  testTimeout: 15000,
};
