import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

interface Props { initialText?: string; onOpenInCards?: () => void }

export default function ScriptSensePanel({ initialText, onOpenInCards }: Props) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeFailed, setIframeFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);

  const post = useCallback((msg: Record<string, unknown>) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try { w.postMessage(msg, '*'); } catch { /* cross-origin or detached; ignore */ }
  }, []);

  const flush = useCallback(() => {
    post({ type: 'set-api-key', key: anthropicKey || '' });
    post({ type: 'set-groq-key', key: groqKey || '' });
    post({ type: 'set-theme', dark: document.documentElement.classList.contains('dark') });
    if (initialText) post({ type: 'set-initial-text', text: initialText });
  }, [post, anthropicKey, groqKey, initialText]);

  // Parent-side listener: the iframe posts 'scriptsense-ready' when it boots.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === 'scriptsense-ready') {
        readyRef.current = true;
        setIframeLoading(false);
        flush();
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [flush]);

  // Re-flush whenever keys, theme, or initial text change after the iframe has booted.
  useEffect(() => { if (readyRef.current) flush(); }, [flush]);

  // Watch for dark-mode class changes and relay to iframe.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      post({ type: 'set-theme', dark: document.documentElement.classList.contains('dark') });
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [post]);

  // Native onLoad fires on all iframe loads; use it as a fallback in case the
  // iframe doesn't post 'scriptsense-ready' (e.g., very old cached HTML).
  const handleLoad = () => {
    setTimeout(() => {
      if (!readyRef.current) {
        setIframeLoading(false);
        flush();
      }
    }, 300);
  };

  // Watchdog: if the iframe never loads at all after 10s, show an error.
  useEffect(() => {
    const t = setTimeout(() => { if (iframeLoading) setIframeFailed(true); }, 10000);
    return () => clearTimeout(t);
  }, [iframeLoading]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)', position: 'relative' }}>
      {onOpenInCards && (
        <button onClick={onOpenInCards} className="btn btn-primary" style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-4)', zIndex: 10 }}>
          Open in Cards
        </button>
      )}
      {iframeLoading && !iframeFailed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="skeleton-bar" style={{ width: 200, height: 24, borderRadius: 'var(--radius-md)' }} />
        </div>
      )}
      {iframeFailed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 'var(--space-6)' }}>
          <div style={{ maxWidth: 380, textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>ScriptSense didn't load</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              The editor couldn't start. An ad blocker or network restriction may be blocking the CDN it depends on.
            </div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="/scriptsense/scriptsense.html"
        className="flex-1 w-full border-none"
        style={{ opacity: iframeLoading ? 0 : 1, transition: 'opacity var(--duration-slow) var(--ease-default)' }}
        title="ScriptSense"
        onLoad={handleLoad}
      />
    </div>
  );
}
