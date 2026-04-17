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
  const hasAny = ORDER.some(cat => NODE_DEFS.some(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q))));

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }} onClick={dismiss}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-overlay-backdrop)', opacity: visible ? 1 : 0, transition: 'opacity 200ms' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'relative', background: 'var(--color-bg-card)',
        borderRadius: '16px 16px 0 0',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 200ms ease',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-default)' }} />
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 8px' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes…" className="form-input" style={{ fontSize: 16 }} />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 20 }}>
          {!hasAny && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>No nodes found</div>
          )}
          {ORDER.map((cat, ci) => {
            const items = NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)));
            if (!items.length) return null;
            return (
              <div key={cat}>
                {ci > 0 && <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '4px 16px 4px' }} />}
                <div style={{ padding: '8px 16px 2px', fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map(def => {
                  const c = BADGE_COLORS[def.category];
                  return (
                    <button key={def.subtype} onClick={() => onAdd(def)} style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      padding: '10px 16px', gap: 12,
                      background: 'none', border: 'none', textAlign: 'left',
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}>
                        {NODE_ICONS[def.subtype]?.() ?? def.badge}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{def.label}</div>
                        <div style={{ fontSize: 13, lineHeight: '18px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{def.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
