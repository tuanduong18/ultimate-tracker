import {
  DARK_QUERY,
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

/**
 * Applies the stored theme and light/dark mode before the first paint.
 *
 * Without this the page renders in the default palette and then snaps to the
 * chosen one once React hydrates — a flash of the wrong colour on every single
 * navigation-free load, and for dark mode a flash of white, which is the one
 * people notice most. That has to happen in a blocking inline script, because
 * anything React does is by definition after the first paint.
 *
 * The script is deliberately tiny and reads only localStorage and the OS colour
 * scheme. It does not validate the stored values: an unknown `data-theme`
 * matches no CSS block, so the `:root` defaults apply, and anything but "light"
 * or "dark" falls through to the OS setting. ThemeProvider corrects both a
 * moment later. Shipping the lists here to avoid that would mean keeping two
 * copies of them in sync for no gain.
 */
export function ThemeScript() {
  const json = JSON.stringify;
  const script =
    // Even touching `localStorage` can throw (Safari private mode), so the
    // property read sits inside the try along with the getItem calls.
    `(function(){var d=document.documentElement,t,m;` +
    `try{t=localStorage.getItem(${json(THEME_STORAGE_KEY)});m=localStorage.getItem(${json(MODE_STORAGE_KEY)})}catch(e){}` +
    `d.dataset.theme=t||${json(DEFAULT_THEME)};m=m||${json(DEFAULT_MODE)};` +
    `if(m!=="light"&&m!=="dark")m=window.matchMedia&&matchMedia(${json(DARK_QUERY)}).matches?"dark":"light";` +
    `d.dataset.mode=m})()`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
