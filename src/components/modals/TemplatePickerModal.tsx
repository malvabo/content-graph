import { useState, useEffect } from 'react';
import { TEMPLATES, type TemplateCategory } from '../../utils/templates';
import TemplateCard from '../ui/TemplateCard';

type Filter = 'All' | TemplateCategory;
const FILTERS: Filter[] = ['All', 'Repurposing', 'Transcript', 'Research'];

interface Props {
  onClose: () => void;
  onStartScratch: () => void;
  onPickTemplate: (index: number) => void;
}

export default function TemplatePickerModal({ onClose, onStartScratch, onPickTemplate }: Props) {
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const visible = filter === 'All' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose a template"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: 1100, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Choose a template</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button onClick={onStartScratch} className="btn btn-primary">Start from scratch</button>
            <button onClick={onClose} aria-label="Close"
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-interactive-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Body: left filters + grid */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Filter sidebar */}
          <aside style={{ width: 180, flexShrink: 0, padding: 'var(--space-4)', borderRight: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: filter === f ? 'var(--color-bg-surface)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: filter === f ? 'var(--weight-medium)' : 'var(--weight-normal)', color: filter === f ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
                onMouseEnter={e => { if (filter !== f) e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { if (filter !== f) e.currentTarget.style.background = 'transparent'; }}>
                {f}
              </button>
            ))}
          </aside>

          {/* Template grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-5) var(--space-6)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
              {visible.map(t => {
                const i = TEMPLATES.indexOf(t);
                const { nodes } = t.build();
                const labels = nodes.slice(0, 2).map(n => n.data.label);
                const extra = nodes.length - 2;
                return (
                  <TemplateCard
                    key={t.name}
                    title={t.name}
                    meta={`${t.category} · ${nodes.length} nodes`}
                    pills={labels}
                    extraCount={extra > 0 ? extra : undefined}
                    onClick={() => onPickTemplate(i)}
                  />
                );
              })}
            </div>
            {visible.length === 0 && (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                No templates in this category yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
