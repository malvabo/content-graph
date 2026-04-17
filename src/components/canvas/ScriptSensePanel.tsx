import { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Props { initialText?: string }

export default function ScriptSensePanel({ initialText }: Props) {
  const [iframeKey, setIframeKey] = useState(0);
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
    if (iframeRef.current?.contentWindow && anthropicKey) {
      iframeRef.current.contentWindow.postMessage({ type: 'set-api-key', key: anthropicKey }, '*');
    }
  };

  // Reload iframe when dark mode toggles
  useEffect(() => {
    const obs = new MutationObserver(() => setIframeKey(k => k + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
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
