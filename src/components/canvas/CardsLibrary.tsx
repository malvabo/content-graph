import { useState } from 'react';
import { useCardsStore } from '../../store/cardsStore';
import TemplateCard from '../ui/TemplateCard';

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
      {/* Hero banner — matches Voice */}
      <div style={{ height: '30vh', minHeight: 180, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-end', padding: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Cards</h1>
          {sets.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{sets.length} set{sets.length !== 1 ? 's' : ''}</p>}
        </div>
        {sets.length > 0 && (
          <div style={{ position: 'absolute', top: 'var(--space-6)', right: 'var(--space-8)', zIndex: 1 }}>
            <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New card set</button>
          </div>
        )}
      </div>

      <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

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
            {sets.map(set => {
              const pills = set.cards.slice(0, 3).map(c => c.headline);
              const extra = set.cards.length > 3 ? set.cards.length - 3 : undefined;
              return (
                <div key={set.id} style={{ position: 'relative' }}
                  onMouseEnter={e => { const b = e.currentTarget.querySelector<HTMLElement>('.del-btn'); if (b) b.style.opacity = '1'; }}
                  onMouseLeave={e => { const b = e.currentTarget.querySelector<HTMLElement>('.del-btn'); if (b) b.style.opacity = '0'; }}>
                  <TemplateCard
                    title={set.name}
                    meta={`${set.cards.length} cards · ${fmt(set.createdAt)}`}
                    pills={pills}
                    extraCount={extra}
                    onClick={() => onOpen(set.id)}
                  />
                  <button className="del-btn" onClick={e => { e.stopPropagation(); setDeleteId(set.id); }}
                    style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', background: 'var(--color-overlay-light)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              );
            })}
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
