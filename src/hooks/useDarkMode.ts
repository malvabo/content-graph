import { useEffect, useState } from 'react';

export type Theme = 'default' | 'light' | 'dark';

function resolveTheme(): Theme {
  if (typeof window === 'undefined') return 'default';
  const stored = localStorage.getItem('theme-mode');
  if (stored === 'dark' || stored === 'light' || stored === 'default') return stored;
  // migrate legacy boolean value
  if (localStorage.getItem('dark-mode') === 'true') return 'dark';
  return 'default';
}

function applyTheme(t: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', t === 'dark' || (t === 'default' && prefersDark));
}

export function useDarkMode(): [Theme, (v: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(resolveTheme);

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem('theme-mode', theme); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent('dark-mode-change', { detail: theme }));
  }, [theme]);

  // Re-apply when OS preference changes while in default mode
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => { if (theme === 'default') applyTheme('default'); };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [theme]);

  // Sync across all hook instances in the same tab
  useEffect(() => {
    const h = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener('dark-mode-change', h);
    return () => window.removeEventListener('dark-mode-change', h);
  }, []);

  return [theme, setTheme];
}
