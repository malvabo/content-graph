import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

export default function CardsPanel() {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);

  const handleLoad = () => {
    setLoading(false);
    if (iframeRef.current?.contentWindow && anthropicKey) {
      iframeRef.current.contentWindow.postMessage({ type: 'set-api-key', key: anthropicKey }, window.location.origin);
    }
  };

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
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="skeleton-bar" style={{ width: 200, height: 24, borderRadius: 'var(--radius-md)' }} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/scriptsense/chat.html"
        className="flex-1 w-full border-none"
        style={{ opacity: loading ? 0 : 1, transition: `opacity var(--duration-slow) var(--ease-default)` }}
        title="Cards"
        onLoad={handleLoad}
      />
    </div>
  );
}
