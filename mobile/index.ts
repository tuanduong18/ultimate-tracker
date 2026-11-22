/**
 * The app's entry point, ahead of Expo Router's.
 *
 * Android can start the app with no screen at all, to run a background task, and the task's
 * definition has to be in place before that run asks for it. A definition inside a screen's
 * module would be missing on such a start, so background tasks are imported here, first.
 */
import './src/lib/notifications/background-sync';
import 'expo-router/entry';
