import 'react-native-gesture-handler/jestSetup';

/**
 * Stand-ins for the native modules Jest can't load, each the package's own published mock, so a
 * test of a screen exercises the screen rather than a hand-made imitation of the library. Kept
 * in one place because nearly every screen pulls these in through the root of the app or its
 * shared components (sheets, forms, the drag list).
 */

jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js')
);

jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual('react-native-keyboard-controller/jest')
);

// Android's date picker is a native dialog; a test that opens one mocks it itself (date-field).
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Zero insets, as on a phone with no notch and no navigation bar.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default
);
