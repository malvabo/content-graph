import { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, MenuItem } from '../ui/Menu';
import { useScriptStore } from '../../store/scriptStore';

const fmt = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ScriptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 12l-2 2 2 2"/><path d="M14 12l2 2-2 2"/>
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
);



export default function ScriptLibrary({ onOpenScript }: { onOpenScript: (id: string, content: string) => void }) {
  const { scripts, addScript, removeScript, updateScript } = useScriptStore();
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  const handleNew = useCallback(() => {
    const id = addScript('');
    onOpenScript(id, '');
  }, [addScript, onOpenScript]);

  const filtered = scripts.filter(s => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (s.title || '').toLowerCase().includes(q) || (s.content || '').toLowerCase().includes(q);
  });

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%' }}>
      {/* Top toolbar — matches Workflows / Voice */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <ScriptIcon />
          <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Scripts</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'var(--radius-full)', padding: '6px 12px', border: '1px solid var(--color-border-default)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Learn
          </button>
          <button onClick={handleNew} className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New script
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <div className="search-bar">
            <span className="search-bar__icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input className="search-bar__input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." aria-label="Search scripts" />
          </div>
        </div>

        {/* Count */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {filtered.length} script{filtered.length !== 1 ? 's' : ''}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            {query ? 'No scripts match your search.' : 'No scripts yet. Create one to get started.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Name</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>State</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Created</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Preview</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => onOpenScript(s.id, s.content)}
                  onMouseEnter={() => setHoverId(s.id)} onMouseLeave={() => setHoverId(null)}
                  style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', background: hoverId === s.id ? 'var(--color-bg-surface)' : 'transparent', transition: 'background 100ms' }}>
                  <td style={{ padding: '14px 12px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{s.title || 'Untitled'}</td>
                  <td style={{ padding: '14px 12px' }}>
                    <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{s.analysed ? 'Analysed' : 'Draft'}</span>
                  </td>
                  <td style={{ padding: '14px 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{fmt(s.createdAt)}</td>
                  <td style={{ padding: '14px 12px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                    {s.content ? s.content.slice(0, 120) : '—'}
                  </td>
                  <td style={{ padding: '14px 12px', width: 40, position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <div role="button" tabIndex={0} aria-label="More options"
                      style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
                      onClick={() => setMenuId(menuId === s.id ? null : s.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuId(menuId === s.id ? null : s.id); } }}>
                      <DotsIcon />
                    </div>
                    {menuId === s.id && (
                      <Menu ref={menuRef} style={{ position: 'absolute', top: 32, right: 0, zIndex: 50 }}>
                        <MenuItem onClick={() => { const name = prompt('Rename', s.title); if (name?.trim()) updateScript(s.id, { title: name.trim() }); setMenuId(null); }}>Rename</MenuItem>
                        <MenuItem danger onClick={() => { removeScript(s.id); setMenuId(null); }}>Delete</MenuItem>
                      </Menu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
