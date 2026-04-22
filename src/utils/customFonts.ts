import type { CustomFont } from '../store/settingsStore';

const STYLE_ID = 'custom-font-faces';

/** Map `font/woff2` etc from a data URL so the @font-face format() hint is right. */
function formatFromDataUrl(dataUrl: string): string {
  const m = dataUrl.match(/^data:([^;]+)/);
  const mime = (m?.[1] || '').toLowerCase();
  if (mime.includes('woff2')) return 'woff2';
  if (mime.includes('woff')) return 'woff';
  if (mime.includes('opentype') || mime.includes('otf')) return 'opentype';
  return 'truetype';
}

/**
 * Inject (or replace) a single <style> tag that declares @font-face for every
 * user-uploaded font. Subsequent calls overwrite prior rules in place, so the
 * browser picks up renames and removals automatically.
 */
export function injectCustomFonts(fonts: CustomFont[]): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = (fonts || [])
    .filter((f) => f.name && f.dataUrl)
    .map((f) => `@font-face { font-family: ${JSON.stringify(f.name)}; src: url(${JSON.stringify(f.dataUrl)}) format(${JSON.stringify(formatFromDataUrl(f.dataUrl))}); font-display: swap; }`)
    .join('\n');
}
