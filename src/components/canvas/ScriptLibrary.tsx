import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(script.title);
  const [deleting, setDeleting] = useState(false);
  const delTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-generate title
  useEffect(() => {
    if (script.title) { setTitleLoading(false); return; }
    let cancelled = false;
    generateTitle(script.content).then(t => {
      if (!cancelled && t) { updateScript(script.id, { title: t }); setEditVal(t); }
      if (!cancelled) setTitleLoading(false);
    }).catch(() => { if (!cancelled) setTitleLoading(false); });
    return () => { cancelled = true; };
  }, [script.id, script.title, script.content, updateScript]);

  const confirmEdit = () => {
    setEditing(false);
    if (editVal.trim() && editVal !== script.title) updateScript(script.id, { title: editVal.trim() });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deleting) { clearTimeout(delTimer.current); onDelete(); setDeleting(false); }
    else { setDeleting(true); delTimer.current = setTimeout(() => setDeleting(false), 3000); }
  };

  return (
    <div onClick={onOpen} style={{
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-4)',
      cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
      transition: 'transform 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
    >
      {/* Delete — hover only */}
      <button onClick={handleDelete} style={{
        position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)',
        background: 'none', border: 'none', color: deleting ? 'var(--color-danger-text)' : 'var(--color-text-disabled)',
        fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', cursor: 'pointer', opacity: 0,
        transition: 'opacity 150ms',
      }} className="script-card-delete">
        {deleting ? 'Delete?' : '×'}
      </button>

      {/* Title */}
      {editing ? (
        <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
          onBlur={confirmEdit} onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditing(false); }}
          onClick={e => e.stopPropagation()}
          style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', background: 'none', border: 'none', outline: 'none', padding: 0, width: '100%' }} />
      ) : titleLoading ? (
        <div className="skeleton-bar" style={{ height: 'var(--text-sm)', width: '70%', borderRadius: 'var(--radius-sm)' }} />
      ) : (
        <div onClick={e => { e.stopPropagation(); setEditing(true); }} style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
          color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{script.title || 'Untitled'}</div>
      )}

      {/* Preview */}
      <div style={{
        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)',
        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        lineHeight: 'var(--leading-snug)',
      }}>{script.content}</div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-1)' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{fmt(script.createdAt)}</span>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
          padding: '2px 8px', borderRadius: 'var(--radius-full)',
          background: script.analysed ? 'var(--color-success-bg)' : 'var(--color-bg-surface)',
          color: script.analysed ? 'var(--color-accent-subtle)' : 'var(--color-text-disabled)',
        }}>{script.analysed ? 'Analysed' : 'Not analysed'}</span>
      </div>

      <style>{`.script-card-delete { opacity: 0 !important; } div:hover > .script-card-delete { opacity: 1 !important; }`}</style>
    </div>
  );
}

export default function ScriptLibrary({ onOpenScript }: { onOpenScript: (id: string) => void }) {
  const { scripts, addScript, removeScript } = useScriptStore();
  const [search, setSearch] = useState('');

  const handleNew = useCallback(() => {
    const id = addScript('');
    onOpenScript(id);
  }, [addScript, onOpenScript]);

  const filtered = scripts.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Hero banner */}
      <div style={{ height: '30vh', minHeight: 180, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-end', padding: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Scripts</h1>
          {scripts.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{scripts.length} script{scripts.length !== 1 ? 's' : ''}</p>}
        </div>
        <div style={{ position: 'absolute', top: 'var(--space-6)', right: 'var(--space-8)', zIndex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {scripts.length > 0 && (
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-disabled)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
                placeholder="Search scripts…" aria-label="Search scripts" className="form-input" style={{ width: 200, paddingLeft: 32 }} />
            </div>
          )}
          <button className="btn btn-primary" onClick={handleNew}>+ New script</button>
        </div>
      </div>

      <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {filtered.map(s => (
            <ScriptCard key={s.id} script={s} onOpen={() => onOpenScript(s.id)} onDelete={() => removeScript(s.id)} />
          ))}
        </div>

        {/* Empty state */}
        {scripts.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
            Record a voice note or paste a script to begin
          </div>
        )}
      </div>

      <style>{`@media (max-width: 639px) { div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
