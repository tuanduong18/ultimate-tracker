import COLOURS from '../../plugins/android-theme-colours.json';
import { ACCENTS, NEUTRAL } from '@/theme/tokens';

// The plugin is the app's one CommonJS file (Expo loads config plugins with require).
// eslint-disable-next-line typescript/no-require-imports
const { withMaterialDependency } = require('../../plugins/with-android-theme') as {
  withMaterialDependency: (gradle: string) => string;
};

describe('the native Android theme', () => {
  it('draws dialogs in the app’s own tokens, with Graphite’s neutral accent', () => {
    for (const mode of ['light', 'dark'] as const) {
      const native = COLOURS[mode];
      const neutral = NEUTRAL[mode];
      const accent = ACCENTS.slate[mode];
      expect(native).toEqual({
        ut_primary: accent.primary,
        ut_on_primary: accent.primaryFg,
        ut_primary_container: accent.primarySoft,
        ut_on_primary_container: neutral.fg,
        ut_surface: neutral.surface,
        ut_surface_muted: neutral.surfaceMuted,
        ut_on_surface: neutral.fg,
        ut_on_surface_variant: neutral.fgMuted,
        ut_outline: neutral.borderControl,
        ut_outline_variant: neutral.border,
        ut_error: neutral.negative,
      });
    }
  });

  it('adds the Material library to the app once, and leaves a build that has it alone', () => {
    const gradle =
      'android {\n}\n\ndependencies {\n    implementation("com.facebook.react:react-android")\n}\n';
    const once = withMaterialDependency(gradle);
    expect(once).toContain('implementation("com.google.android.material:material:1.13.0")');
    expect(withMaterialDependency(once)).toBe(once);
  });
});
