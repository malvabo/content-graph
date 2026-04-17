import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NODE_DEFS, BADGE_COLORS, CATEGORY_LABELS, type NodeDef } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import type { NodeCategory } from '../../store/graphStore';

const ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

export default function MobileNodePicker({ onAdd, onClose }: { onAdd: (def: NodeDef) => void; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const dismiss = () => { setVisible(false); setTimeout(onClose, 200); };
  const q = search.toLowerCase().trim();

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={dismiss}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-overlay-backdrop)', opacity: visible ? 1 : 0, transition: 'opacity 200ms' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', background: 'var(--color-bg-card)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 200ms ease',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3) 0 var(--space-2)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-default)' }} />
        </div>

        {/* Search — matches desktop palette */}
        <div style={{ padding: '0 var(--space-3) var(--space-2)' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes…" className="form-input" />
        </div>

        {/* Node list — matches desktop palette structure */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 var(--space-2) var(--space-4)', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
          {ORDER.map((cat, catIdx) => {
            const items = NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)));
            if (!items.length) return null;
            return (
              <div key={cat}>
                {catIdx > 0 && <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: 'var(--space-2) var(--space-3)' }} />}
                <div style={{ padding: 'var(--space-1) var(--space-3)', fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map(def => {
                  const c = BADGE_COLORS[def.category];
                  return (
                    <button key={def.subtype} onClick={() => onAdd(def)} className="palette-item" style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)',
                      background: 'none', border: 'none', textAlign: 'left',
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: 'var(--radius-md)', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {NODE_ICONS[def.subtype]?.() ?? def.badge}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', lineHeight: '16px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {q && !ORDER.some(cat => NODE_DEFS.some(n => n.category === cat && (n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)))) && (
            <div style={{ padding: 'var(--space-6) var(--space-3)', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>No nodes found</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
