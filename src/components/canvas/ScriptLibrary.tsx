import { useState, useEffect, useCallback } from 'react';
import { useScriptStore, type Script } from '../../store/scriptStore';
import { useSettingsStore } from '../../store/settingsStore';

const fmt = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ScriptIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/>
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
);

async function generateTitle(content: string): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const text = content.slice(0, 200);
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 20, messages: [{ role: 'user', content: `Give me a 5 word title for this text, return only the title, no punctuation: ${text}` }] }),
    });
    if (res.ok) { const d = await res.json(); return d.choices?.[0]?.message?.content?.trim() || ''; }
  }
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-haiku-4-20250414', max_tokens: 20, messages: [{ role: 'user', content: `Give me a 5 word title for this text, return only the title, no punctuation: ${text}` }] }),
    });
    if (res.ok) { const d = await res.json(); return d.content?.[0]?.text?.trim() || ''; }
  }
  return content.split(/\s+/).slice(0, 5).join(' ');
}

function ScriptCard({ script, onOpen, onDelete }: { script: Script; onOpen: () => void; onDelete: () => void }) {
  const updateScript = useScriptStore(s => s.updateScript);
  const [titleLoading, setTitleLoading] = useState(!script.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (script.title) { setTitleLoading(false); return; }
    let cancelled = false;
    generateTitle(script.content).then(t => {
      if (!cancelled && t) updateScript(script.id, { title: t });
      if (!cancelled) setTitleLoading(false);
    }).catch(() => { if (!cancelled) setTitleLoading(false); });
    return () => { cancelled = true; };
  }, [script.id, script.title, script.content, updateScript]);

  return (
    <>
      <div onClick={onOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          textAlign: 'left', borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
          fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
          transition: 'border-color .15s, box-shadow .15s, transform .15s',
          boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
          borderColor: hover ? 'var(--color-border-default)' : 'var(--color-border-subtle)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          height: 280, position: 'relative', zIndex: menuOpen ? 60 : 'auto',
        }}
      >
        {/* Header: title + meta + menu */}
        <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-3)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {titleLoading ? (
              <div className="skeleton-bar" style={{ height: 'var(--text-md)', width: '70%', borderRadius: 'var(--radius-sm)' }} />
            ) : (
              <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                {script.title || 'Untitled'}
              </div>
            )}
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              Updated {fmt(script.createdAt)}
              {script.analysed && <span style={{ marginLeft: 8, color: 'var(--color-accent-subtle)' }}>· Analysed</span>}
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div role="button" tabIndex={0} aria-label="More options"
              style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', background: 'transparent', cursor: 'pointer', opacity: hover || menuOpen ? 1 : 0, transition: 'opacity 150ms' }}
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}>
              <DotsIcon />
            </div>
            {menuOpen && (
              <div onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
                {[
                  { label: 'Rename', action: () => { const name = prompt('Rename', script.title); if (name?.trim()) updateScript(script.id, { title: name.trim() }); setMenuOpen(false); } },
                  { label: 'Delete', danger: true, action: () => { setDeleteId(true); setMenuOpen(false); } },
                ].map(opt => (
                  <button key={opt.label} onClick={opt.action}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', transition: 'background 100ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border-subtle)' }} />

        {/* Content preview with fade-out */}
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden', padding: 'var(--space-4)' }}>
          {script.content ? (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {script.content.slice(0, 700)}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>
              Empty script
            </div>
          )}
          {/* Fade mask so long scripts end gracefully */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(0,0,0,0), var(--color-bg-card))' }} />
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }} onClick={() => setDeleteId(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-default)', maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete script?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-4)' }}>This will permanently remove "{script.title || 'Untitled'}".</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(false)}>Cancel</button>
              <button className="btn btn-destructive" onClick={() => { onDelete(); setDeleteId(false); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ScriptLibrary({ onOpenScript }: { onOpenScript: (id: string, content: string) => void }) {
  const { scripts, addScript, removeScript } = useScriptStore();

  const handleNew = useCallback(() => {
    const id = addScript('');
    onOpenScript(id, '');
  }, [addScript, onOpenScript]);

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%' }}>
      {/* Hero banner — title, subtitle, then button below */}
      <div className="p-4 md:p-8" style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Scripts</h1>
            {scripts.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{scripts.length} script{scripts.length !== 1 ? 's' : ''}</p>}
          </div>
          <button className="btn btn-primary" onClick={handleNew}>+ New script</button>
        </div>
      </div>

      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {scripts.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <ScriptIcon />
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No scripts yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Paste a talk script and get AI-powered insights on claims, metaphors, and logic.</div>
            <button className="btn btn-primary" onClick={handleNew} style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>Create your first script</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {scripts.map(s => (
              <ScriptCard key={s.id} script={s} onOpen={() => onOpenScript(s.id, s.content)} onDelete={() => removeScript(s.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
