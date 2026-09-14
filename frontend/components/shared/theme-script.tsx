import { DEFAULT_THEME, THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Applies the stored theme before the first paint.
 *
 * Without this the page renders in the default palette and then snaps to the
 * chosen one once React hydrates — a flash of the wrong colour on every single
 * navigation-free load. That has to happen in a blocking inline script, because
 * anything React does is by definition after the first paint.
 *
 * The script is deliberately tiny and reads only localStorage. It does not
 * validate the value against the theme list: an unknown `data-theme` matches no
 * CSS block, so the `:root` defaults apply and ThemeProvider corrects the
 * attribute a moment later. Shipping the list here to avoid that would mean
 * keeping two copies of it in sync for no gain.
 */
export function ThemeScript() {
  const script = `try{document.documentElement.dataset.theme=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY
  )})||${JSON.stringify(DEFAULT_THEME)}}catch(e){document.documentElement.dataset.theme=${JSON.stringify(
    DEFAULT_THEME
  )}}`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
