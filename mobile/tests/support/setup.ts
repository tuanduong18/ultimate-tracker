import type { ReactNode } from 'react';

/**
 * Stand-ins for the native modules Jest can't load, each the package's own published mock
 * where it has one, so a test of a screen exercises the screen rather than a hand-made imitation
 * of the library. Kept in one place because nearly every screen pulls these in through the root
 * of the app or its shared components (sheets, forms, the drag list).
 */

jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js')
);

jest.mock('react-native-keyboard-controller', () =>
  jest.requireActual('react-native-keyboard-controller/jest')
);

// Gesture-handler 3's own start-up reaches for the native worklets runtime, which Jest doesn't
// have, and a drag can't be performed in Jest anyway. So the drag list's gesture is inert here
// (its handle renders, nothing recognises it) and its Move up / Move down buttons are what the
// tests exercise; the drag itself is checked on the phone.
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: ReactNode }) => children,
    usePanGesture: () => ({}),
  };
});

// Android's date picker is a native dialog; a test that opens one mocks it itself (date-field).
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Zero insets, as on a phone with no notch and no navigation bar.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default
);
