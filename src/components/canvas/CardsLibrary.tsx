import { useState } from 'react';
import { useCardsStore } from '../../store/cardsStore';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
const CardsIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>;

const fmt = (iso: string) => { if (!iso) return ''; const d = new Date(iso), diff = Date.now() - d.getTime(); if (isNaN(diff)) return ''; if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

export default function CardsLibrary({ onOpen }: { onOpen: (id: string) => void }) {
  const { sets, add, remove } = useCardsStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = sets.filter(s => !query.trim() || (s.name || '').toLowerCase().includes(query.toLowerCase()));

  const handleNew = () => {
    const id = `cards-${Date.now()}`;
    add({ id, name: 'Untitled', cards: [{ id: 'c1', headline: 'New card', body: 'Start writing here…' }], createdAt: new Date().toISOString() });
    onOpen(id);
  };

  const confirmDelete = () => { if (deleteId) { remove(deleteId); setDeleteId(null); } };

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Top toolbar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <CardsIcon />
          <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Cards</h1>
        </div>
        <button onClick={handleNew} className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)' }}><PlusIcon /> New card set</button>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Search */}
        {sets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
            <div className="search-bar">
              <span className="search-bar__icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
              <input className="search-bar__input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." aria-label="Search card sets" />
            </div>
          </div>
        )}

        {/* Count */}
        {sets.length > 0 && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
            {filtered.length} set{filtered.length !== 1 ? 's' : ''}
          </div>
        )}

        {sets.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-8)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-xl)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <CardsIcon />
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No card sets yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Create a card set to organize and discuss your content.</div>
            <button className="btn btn-primary" onClick={handleNew} style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}><PlusIcon /> Create your first set</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No card sets match your search.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            {filtered.map(set => (
              <div key={set.id}
                style={{
                  textAlign: 'left', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                onClick={() => onOpen(set.id)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{set.name || 'Untitled'}</div>
                  <div role="button" tabIndex={0} aria-label="Delete"
                    style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)', background: 'transparent', transition: 'color .15s, background .15s', cursor: 'pointer', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={e => { e.stopPropagation(); setDeleteId(set.id); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{(set.cards || []).length} card{(set.cards || []).length !== 1 ? 's' : ''} · {fmt(set.createdAt)}</div>
                {set.cards?.length > 0 && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {set.cards.map(c => c.headline || 'Untitled').join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }} onClick={() => setDeleteId(null)}>
          <div role="dialog" onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-default)', maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete card set?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-4)' }}>This will permanently remove this card set.</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
