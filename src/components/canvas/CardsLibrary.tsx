import { useState } from 'react';
import { useCardsStore, type CardSet } from '../../store/cardsStore';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
const CardsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>;

const fmt = (iso: string) => { const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

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
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
            <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Cards</h1>
            {sets.length > 0 && <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{sets.length}</span>}
          </div>
          {sets.length > 0 && <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New card set</button>}
        </div>

        {sets.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <CardsIcon />
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No card sets yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-6)' }}>Create a card set to organize and discuss your content</div>
            <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New card set</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {sets.map(set => (
              <CardSetItem key={set.id} set={set} onOpen={() => onOpen(set.id)} onDelete={() => setDeleteId(set.id)} />
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

function CardSetItem({ set, onOpen, onDelete }: { set: CardSet; onOpen: () => void; onDelete: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onOpen} style={{ position: 'relative' }}>
      <div style={{
        cursor: 'pointer', outline: 'none',
        background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-lg)', textAlign: 'left',
        transition: 'border-color 150ms, box-shadow 150ms',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.parentElement!.querySelector<HTMLElement>('.del-btn')!.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.parentElement!.querySelector<HTMLElement>('.del-btn')!.style.opacity = '0'; }}
      >
        <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: 'var(--leading-tight)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{set.name}</div>
        {/* Preview pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {set.cards.slice(0, 3).map((c, i) => (
            <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: 'var(--color-text-disabled)', fontSize: 10 }}>·</span>}
              <span style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', lineHeight: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>{c.headline}</span>
            </span>
          ))}
          {set.cards.length > 3 && <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>+{set.cards.length - 3}</span>}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-tight)' }}>{set.cards.length} cards · {fmt(set.createdAt)}</div>
      </div>
      <button className="del-btn" onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', background: 'var(--color-overlay-light)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', backdropFilter: 'blur(4px)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}
