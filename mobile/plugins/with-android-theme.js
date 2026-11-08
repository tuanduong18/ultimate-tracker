const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
  withAppBuildGradle,
} = require('expo/config-plugins');

const COLOURS = require('./android-theme-colours.json');

/**
 * The Android theme behind the app's native parts: the date picker, the confirmation dialogs and
 * anything else Android draws itself rather than React Native.
 *
 * Expo's default theme is `Theme.AppCompat.Light`, which draws every native dialog light, even
 * in dark mode, in Expo's navy, and can't host Material 3's date picker at all. This makes the
 * theme `Theme.Material3.DayNight`, so dialogs follow the app's mode (the theme provider tells
 * Android which one with `Appearance.setColorScheme`), and gives Material's colour roles the
 * app's own tokens.
 *
 * The accent is Graphite's, not the person's scheme: a native theme is fixed when the app is
 * built, so it cannot follow a scheme chosen at runtime. A neutral accent belongs to every scheme
 * on the shared neutral base instead of impersonating one. The values in
 * android-theme-colours.json are kept equal to src/theme/tokens.ts by a test, the way app.json's
 * splash colours are kept by hand.
 *
 * Native code: changing this needs a new development build.
 */

/** Material 3's colour roles, and the token-coloured resource each one reads. */
const ROLES = {
  colorPrimary: 'ut_primary',
  colorOnPrimary: 'ut_on_primary',
  colorPrimaryContainer: 'ut_primary_container',
  colorOnPrimaryContainer: 'ut_on_primary_container',
  colorSecondaryContainer: 'ut_primary_container',
  colorOnSecondaryContainer: 'ut_on_primary_container',
  colorSurface: 'ut_surface',
  // Dialogs and the date picker sit on the high container: the app's card colour.
  colorSurfaceContainerLow: 'ut_surface',
  colorSurfaceContainer: 'ut_surface',
  colorSurfaceContainerHigh: 'ut_surface',
  colorSurfaceContainerHighest: 'ut_surface_muted',
  colorOnSurface: 'ut_on_surface',
  colorOnSurfaceVariant: 'ut_on_surface_variant',
  colorOutline: 'ut_outline',
  colorOutlineVariant: 'ut_outline_variant',
  colorError: 'ut_error',
};

function withColours(colours, mode) {
  for (const [name, value] of Object.entries(COLOURS[mode])) {
    colours = AndroidConfig.Colors.assignColorValue(colours, { name, value });
  }
  return colours;
}

/**
 * The app's own dependency on Google's Material library, which defines Theme.Material3. Several
 * packages already pull it in (react-native-screens, expo-router, the date picker, all at 1.13),
 * but the theme shouldn't rest on another package's internals. Added once: a build that already
 * names the library is left alone.
 */
const MATERIAL = 'implementation("com.google.android.material:material:1.13.0")';

function withMaterialDependency(gradle) {
  if (gradle.includes('com.google.android.material:material')) return gradle;
  return gradle.replace(
    /^dependencies\s*\{/m,
    (opening) =>
      `${opening}\n    // Theme.Material3, for plugins/with-android-theme.js.\n    ${MATERIAL}`
  );
}

function withAndroidTheme(config) {
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = withMaterialDependency(mod.modResults.contents);
    return mod;
  });
  config = withAndroidColors(config, (mod) => {
    mod.modResults = withColours(mod.modResults, 'light');
    return mod;
  });
  config = withAndroidColorsNight(config, (mod) => {
    mod.modResults = withColours(mod.modResults, 'dark');
    return mod;
  });
  config = withAndroidStyles(config, (mod) => {
    const group = AndroidConfig.Styles.getAppThemeGroup();
    for (const [name, colour] of Object.entries(ROLES)) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent: group,
        name,
        value: `@color/${colour}`,
      });
    }
    const appTheme = AndroidConfig.Styles.getStyleParent(mod.modResults, group);
    if (appTheme) appTheme.$.parent = 'Theme.Material3.DayNight.NoActionBar';
    return mod;
  });
  return config;
}

module.exports = withAndroidTheme;
module.exports.withMaterialDependency = withMaterialDependency;
