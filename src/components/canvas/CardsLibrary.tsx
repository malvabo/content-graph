import { useState } from 'react';
import { useCardsStore } from '../../store/cardsStore';
import LibraryPage, { LibraryGrid } from '../ui/LibraryPage';

const CardsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>;

const fmt = (iso: string) => { if (!iso) return ''; const d = new Date(iso), diff = Date.now() - d.getTime(); if (isNaN(diff)) return ''; if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

export default function CardsLibrary({ onOpen }: { onOpen: (id: string) => void }) {
  const { sets, add, remove } = useCardsStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleNew = () => {
    const id = `cards-${Date.now()}`;
    add({ id, name: 'Untitled', cards: [{ id: 'c1', headline: 'New card', body: 'Start writing here…' }], createdAt: new Date().toISOString() });
    onOpen(id);
  };

  const confirmDelete = () => { if (deleteId) { remove(deleteId); setDeleteId(null); } };

  return (
    <>
      <LibraryPage
        title="Cards"
        itemCount={sets.length}
        itemNoun={{ singular: 'set', plural: 'sets' }}
        onNew={handleNew}
        newLabel="New card set"
        isEmpty={sets.length === 0}
        emptyState={{
          icon: <CardsIcon />,
          title: 'No card sets yet',
          description: 'Create a card set to organize and discuss your content.',
          actionLabel: 'Create your first set',
          onAction: handleNew,
        }}
      >
        <LibraryGrid>
          {sets.map(set => (
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
        </LibraryGrid>
      </LibraryPage>

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
    </>
  );
}
