import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { useBrandsStore, getActiveBrand } from '../../store/brandsStore';
import { useScriptStore } from '../../store/scriptStore';
import { generateAndSaveCards } from '../../utils/scriptToCards';

interface Props { scriptId?: string; initialText?: string; onBack?: () => void; onOpenInCards?: (id?: string) => void; onSendToWorkflow?: () => void; onDelete?: () => void }

export default function ScriptSensePanel({ scriptId, initialText, onBack, onOpenInCards, onSendToWorkflow: _onSendToWorkflow, onDelete }: Props) {
  const title = useScriptStore(s => s.scripts.find(sc => sc.id === scriptId)?.title ?? '');
  const scriptContent = useScriptStore(s => s.scripts.find(sc => sc.id === scriptId)?.content ?? '');
  const updateScript = useScriptStore(s => s.updateScript);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeFailed, setIframeFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  // Bake the current dark-mode state into the src at mount so the iframe renders
  // with the correct theme on its very first paint, before any postMessage round-trip.
  const iframeSrc = useRef(
    `/scriptsense/scriptsense.html?dark=${document.documentElement.classList.contains('dark') ? '1' : '0'}`
  ).current;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingActionRef = useRef<'back' | 'workflow' | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: PointerEvent) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [menuOpen]);
  const anthropicKey = useSettingsStore(s => s.anthropicKey);
  const groqKey = useSettingsStore(s => s.groqKey);
  // Subscribe to every input that could change the resolved active brand so
  // flush() reposts on change; the actual resolution uses getActiveBrand().
  useSettingsStore(s => s.brand);
  useBrandsStore(s => s.activeBrandId);
  useBrandsStore(s => s.brands);
  const brand = getActiveBrand();

  // Buffer the last non-empty initialText seen, so a parent-side clear on the
  // next tick can't race the iframe's ready handshake. Works across panel
  // lifetimes too: if the panel stays mounted and a fresh transcript arrives
  // from a later send, we'll push that too and blank the buffer once consumed.
  const pendingContentRef = useRef<string>('');
  const initialTextRef = useRef<string>('');
  useEffect(() => {
    // Mirror the latest initialText prop into a ref so flush() can read it
    // directly if the iframe's 'ready' message fires before this effect runs.
    initialTextRef.current = initialText || '';
    if (!initialText) return;
    pendingContentRef.current = initialText;
    if (readyRef.current) {
      iframeRef.current?.contentWindow?.postMessage({ type: 'set-content', text: initialText }, '*');
      pendingContentRef.current = '';
    }
  }, [initialText]);

  // When switching scripts, explicitly load the stored content into the iframe
  // (including empty string for new scripts, which clears any previous content).
  const prevScriptIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!scriptId || scriptId === prevScriptIdRef.current) return;
    prevScriptIdRef.current = scriptId;
    if (!readyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'set-content', text: scriptContent }, '*');
    pendingContentRef.current = '';
  // scriptContent intentionally excluded: we only want to trigger on scriptId change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId]);

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
    // Prefer the buffered value, but fall back to the live prop ref so a
    // 'ready' that races ahead of the initialText useEffect still delivers.
    // Always send set-content when switching scripts (including empty string to clear).
    const pending = pendingContentRef.current || initialTextRef.current;
    if (pending || prevScriptIdRef.current) {
      post({ type: 'set-content', text: pending });
      pendingContentRef.current = '';
    }
  }, [post, anthropicKey, groqKey, brand]);

  // Handles the 'scriptsense-ready' handshake and all 'script-content' replies.
  // script-content always persists to store; pendingActionRef controls navigation.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const d = e.data;
      if (d?.type === 'scriptsense-ready') {
        readyRef.current = true;
        setIframeLoading(false);
        flush();
      } else if (d?.type === 'script-content' && typeof d.text === 'string') {
        const text = d.text;
        if (scriptId) updateScript(scriptId, { content: text });
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        if (action === 'back') {
          onBack?.();
        } else if (action === 'workflow') {
          const trimmed = text.trim();
          if (trimmed) {
            generateAndSaveCards(trimmed, title || 'Script')
              .then(id => onOpenInCards?.(id || undefined))
              .catch(() => { onOpenInCards?.(); });
          }
        }
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, [flush, onBack, onOpenInCards, scriptId, title, updateScript]);

  // Periodic save: pull content from iframe every 10s and persist to store.
  useEffect(() => {
    if (!scriptId) return;
    const id = setInterval(() => {
      if (readyRef.current) post({ type: 'request-content' });
    }, 10000);
    return () => clearInterval(id);
  }, [scriptId, post]);

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
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
      {/* Toolbar — three-column, matches CanvasToolbar */}
      <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 var(--space-3)', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {/* Left: back */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {onBack && (
            <button
              onClick={() => { if (readyRef.current) { pendingActionRef.current = 'back'; post({ type: 'request-content' }); } else { onBack(); } }}
              style={{ width: 30, height: 30, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', transition: 'background 100ms, border-color 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
              aria-label="Back to scripts">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
        </div>
        {/* Center: title */}
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: 420, minWidth: 120 }}>
          {scriptId && (
            <input
              aria-label="Script name"
              className="outline-none"
              style={{ fontWeight: 500, fontSize: 15, lineHeight: '22px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em', background: 'none', border: 'none', borderBottom: '1px solid transparent', borderRadius: 0, padding: '2px 4px', width: 220, maxWidth: '30vw', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}
              value={title}
              placeholder="Untitled"
              onChange={e => updateScript(scriptId, { title: e.target.value })}
              onFocus={e => { e.currentTarget.style.borderBottomColor = 'var(--color-accent)'; }}
              onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
            />
          )}
        </div>
        {/* Right: actions */}
        <div ref={menuWrapRef} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-1)', position: 'relative' }}>
          <button
            type="button"
            disabled={iframeLoading}
            onClick={() => post({ type: 'run-analysis' })}
            aria-label="Re-run analysis"
            title="Re-run analysis"
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: iframeLoading ? 'default' : 'pointer', color: 'var(--color-text-tertiary)', transition: 'background 100ms, border-color 100ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>
          </button>
          <button
            type="button"
            disabled={iframeLoading}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Script actions"
            aria-expanded={menuOpen}
            style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: iframeLoading ? 'default' : 'pointer', color: 'var(--color-text-tertiary)', transition: 'background 100ms, border-color 100ms' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + var(--space-1))', right: 0, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 170, zIndex: 50 }}>
              {[
                onOpenInCards && { label: 'Open in Cards', action: () => { setMenuOpen(false); pendingActionRef.current = 'workflow'; post({ type: 'request-content' }); } },
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
        src={iframeSrc}
        className="flex-1 w-full border-none"
        style={{ opacity: iframeLoading ? 0 : 1, transition: 'opacity var(--duration-slow) var(--ease-default)' }}
        title="ScriptSense"
        onLoad={handleLoad}
      />
    </div>
  );
}
