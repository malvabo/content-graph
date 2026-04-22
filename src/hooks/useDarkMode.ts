import { useEffect, useState } from 'react';

/**
 * Shared dark-mode state. Persists to localStorage under `dark-mode`
 * and syncs the `.dark` class on <html> so Tailwind/theme tokens flip
 * across every consumer the moment one caller toggles it.
 */
export function useDarkMode(): [boolean, (v: boolean) => void] {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('dark-mode') === 'true'
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('dark-mode', String(dark)); } catch { /* private mode */ }
    // Broadcast so other hook instances (e.g. header menu + settings page) stay in sync.
    window.dispatchEvent(new CustomEvent('dark-mode-change', { detail: dark }));
  }, [dark]);
  useEffect(() => {
    const h = (e: Event) => setDark(!!(e as CustomEvent).detail);
    window.addEventListener('dark-mode-change', h);
    return () => window.removeEventListener('dark-mode-change', h);
  }, []);
  return [dark, setDark];
}
