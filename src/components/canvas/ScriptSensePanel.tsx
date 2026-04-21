import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Props { initialText?: string; onOpenInCards?: () => void }

export default function ScriptSensePanel({ initialText, onOpenInCards }: Props) {
  // Bug 5: write to localStorage synchronously before first iframe mount so key=0
  // always loads with the correct content — no wasted double-load on initial render.
  const [iframeKey, setIframeKey] = useState(() => {
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      return 1;
    }
    return 0;
  });
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isFirstRender = useRef(true);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);

  useEffect(() => {
    // Skip initial mount — localStorage was already set in useState initializer
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      setIframeLoading(true); // Bug 2: reset loading state before key bump
      setIframeKey((k) => k + 1);
    }
  }, [initialText]);

  // Send API key to iframe on load
  const handleLoad = () => {
    setIframeLoading(false);
    const origin = window.location.origin; // Bug 6: scope postMessage to same origin
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
