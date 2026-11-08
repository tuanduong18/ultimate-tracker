import 'react-native-gesture-handler/jestSetup';

/**
 * Stand-ins for the native modules Jest can't load, each the package's own published mock, so a
 * test of a screen exercises the screen rather than a hand-made imitation of the library. Kept
 * in one place because nearly every screen pulls these in through the root of the app.
 */

jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js')
);

jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual('react-native-keyboard-controller/jest')
);
