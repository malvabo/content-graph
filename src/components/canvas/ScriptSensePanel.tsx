import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { computeSafePosition } from '../../utils/nodePlacement';

interface Props { initialText?: string; onOpenInCards?: () => void; onSendToWorkflow?: () => void; onDelete?: () => void }

export default function ScriptSensePanel({ initialText, onOpenInCards, onSendToWorkflow, onDelete }: Props) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [menuOpen]);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);
  const brand = useSettingsStore(s => s.brand);

  // Buffer the last non-empty initialText seen, so a parent-side clear on the
  // next tick can't race the iframe's ready handshake. Works across panel
  // lifetimes too: if the panel stays mounted and a fresh transcript arrives
  // from a later send, we'll push that too and blank the buffer once consumed.
  const pendingContentRef = useRef<string>('');
  useEffect(() => {
    if (!initialText) return;
    pendingContentRef.current = initialText;
    if (readyRef.current) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'set-content', text: initialText }, '*');
      pendingContentRef.current = '';
    }
  }, [initialText]);

  const post = useCallback((msg: Record<string, unknown>) => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    try { w.postMessage(msg, '*'); } catch { /* cross-origin or detached; ignore */ }
  }, []);

  const flush = useCallback(() => {
    post({ type: 'set-api-key', key: anthropicKey || '' });
    post({ type: 'set-groq-key', key: groqKey || '' });
    post({ type: 'set-theme', dark: document.documentElement.classList.contains('dark') });
    if (brand?.voice?.personality || brand?.name) post({ type: 'set-brand', brand });
    if (pendingContentRef.current) {
      post({ type: 'set-content', text: pendingContentRef.current });
      pendingContentRef.current = '';
    }
  }, [post, anthropicKey, groqKey, brand]);

  // Handles the 'scriptsense-ready' handshake and the 'script-content' reply
  // used by Send to Workflow (the iframe posts this in response to request-content).
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'scriptsense-ready') {
        readyRef.current = true;
        setIframeLoading(false);
        flush();
      } else if (d?.type === 'script-content' && typeof d.text === 'string') {
        const text = d.text.trim();
        if (!text) return;
        const id = `text-source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const node: ContentNode = {
          id,
          type: 'contentNode',
          position: computeSafePosition(),
          deletable: true,
          data: {
            subtype: 'text-source',
            label: 'From ScriptSense',
            badge: 'Ss',
            category: 'source',
            description: 'Script from ScriptSense',
            config: { text },
          },
        };
        useGraphStore.getState().addNode(node);
        useOutputStore.getState().setOutput(id, { text });
        useGraphStore.getState().setSelectedNodeId(id);
        onSendToWorkflow?.();
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [flush, onSendToWorkflow]);

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
      <div ref={menuWrapRef} style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-4)', zIndex: 10 }}>
        <button
          type="button"
          disabled={iframeLoading}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Script actions"
          aria-expanded={menuOpen}
          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', cursor: iframeLoading ? 'default' : 'pointer', color: 'var(--color-text-primary)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', top: 'calc(100% + var(--space-1))', right: 0, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 170 }}>
            {[
              onOpenInCards && { label: 'Open in Cards', action: () => { setMenuOpen(false); onOpenInCards(); } },
              { label: 'Open in Flows', action: () => { setMenuOpen(false); post({ type: 'request-content' }); } },
              onDelete && { label: 'Delete', danger: true, action: () => { setMenuOpen(false); post({ type: 'set-content', text: '' }); onDelete(); } },
            ].filter(Boolean).map(opt => (
              <button key={(opt as { label: string }).label} onClick={(opt as { action: () => void }).action}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as { danger?: boolean }).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', transition: 'background 100ms' }}
                onMouseEnter={e => { e.currentTarget.style.background = (opt as { danger?: boolean }).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                {(opt as { label: string }).label}
              </button>
            ))}
          </div>
        )}
      </div>
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
