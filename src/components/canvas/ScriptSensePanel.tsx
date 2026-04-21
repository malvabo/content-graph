import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Props { initialText?: string; onBack?: () => void; onOpenInCards?: () => void }

export default function ScriptSensePanel({ initialText, onBack, onOpenInCards }: Props) {
  const [iframeKey, setIframeKey] = useState(() => {
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      return 1;
    }
    return 0;
  });
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevInitialTextRef = useRef(initialText);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);

  // Only reload the iframe when initialText genuinely changes, not on StrictMode double-mount
  useEffect(() => {
    if (initialText === prevInitialTextRef.current) return;
    prevInitialTextRef.current = initialText;
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      setIframeLoading(true);
      setIframeKey((k) => k + 1);
    }
  }, [initialText]);

  // Listen for navigate-back from iframe
  useEffect(() => {
    if (!onBack) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'navigate-back') onBack();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onBack]);

  const handleLoad = () => {
    setIframeLoading(false);
    const origin = window.location.origin;
    if (iframeRef.current?.contentWindow) {
      if (anthropicKey) iframeRef.current.contentWindow.postMessage({ type: 'set-api-key', key: anthropicKey }, origin);
      if (groqKey) iframeRef.current.contentWindow.postMessage({ type: 'set-groq-key', key: groqKey }, origin);
    }
  };

  // Notify iframe of dark mode change
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      iframeRef.current?.contentWindow?.postMessage({ type: 'set-theme', dark }, window.location.origin);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)', position: 'relative' }}>
      {onBack && (
        <button onClick={onBack} style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-4)', zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6 }}>
          ← Scripts
        </button>
      )}
      {onOpenInCards && (
        <button onClick={onOpenInCards} className="btn btn-primary" style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-4)', zIndex: 10 }}>
          Open in Cards
        </button>
      )}
      {iframeLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="skeleton-bar" style={{ width: 200, height: 24, borderRadius: 'var(--radius-md)' }} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src="/scriptsense/scriptsense.html"
        className="flex-1 w-full border-none"
        style={{ opacity: iframeLoading ? 0 : 1, transition: 'opacity var(--duration-slow) var(--ease-default)' }}
        title="ScriptSense"
        onLoad={handleLoad}
      />
    </div>
  );
}
