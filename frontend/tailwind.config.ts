import type { Config } from 'tailwindcss';

/**
 * Bind a Tailwind colour to a theme token.
 *
 * `<alpha-value>` is what lets `bg-primary/10` work: Tailwind substitutes the
 * opacity into the `rgb()` it builds, which is only possible because the tokens
 * in globals.css store channels rather than hex.
 */
function token(name: string): string {
  return `rgb(var(--color-${name}) / <alpha-value>)`;
}

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-muted': token('surface-muted'),
        border: token('border'),
        fg: token('fg'),
        'fg-muted': token('fg-muted'),
        'fg-subtle': token('fg-subtle'),
        primary: token('primary'),
        'primary-fg': token('primary-fg'),
        'primary-soft': token('primary-soft'),
        positive: token('positive'),
        negative: token('negative'),
        'negative-soft': token('negative-soft'),
      },
      borderColor: {
        // Tailwind's own default is gray-200, which every bare `border` on an
        // input would otherwise keep wearing whatever the theme says.
        DEFAULT: token('border'),
      },
    },
  },
  plugins: [],
};

export default config;
