import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Props { initialText?: string }

export default function ScriptSensePanel({ initialText }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);

  useEffect(() => {
    if (initialText) {
      localStorage.setItem('scriptsense-content', initialText);
      setIframeKey((k) => k + 1);
    }
  }, [initialText]);

  // Send API key to iframe on load
  const handleLoad = () => {
    setIframeLoading(false);
    if (iframeRef.current?.contentWindow && anthropicKey) {
      iframeRef.current.contentWindow.postMessage({ type: 'set-api-key', key: anthropicKey }, window.location.origin);
    }
  };

  // Notify iframe of dark mode change instead of reloading
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      iframeRef.current?.contentWindow?.postMessage({ type: 'set-theme', dark }, window.location.origin);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
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
        style={{ opacity: iframeLoading ? 0 : 1, transition: 'opacity 200ms ease' }}
        title="ScriptSense"
        onLoad={handleLoad}
      />
    </div>
  );
}
