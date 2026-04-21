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

  // Send API keys after iframe loads
  const handleLoad = () => {
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
    <div className="flex-1 flex flex-col overflow-hidden" style={{ position: 'relative' }}>
      {onOpenInCards && (
        <button onClick={onOpenInCards} className="btn btn-primary" style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-4)', zIndex: 10 }}>
          Open in Cards
        </button>
      )}
      <iframe
        ref={iframeRef}
        key={iframeKey}
        src="/scriptsense/scriptsense.html"
        className="flex-1 w-full border-none"
        title="ScriptSense"
        onLoad={handleLoad}
      />
    </div>
  );
}
