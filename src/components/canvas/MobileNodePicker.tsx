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
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--color-overlay-backdrop)', opacity: visible ? 1 : 0, transition: 'opacity 200ms' }} />

      {/* Sheet */}
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

        {/* Search */}
        <div style={{ padding: '0 var(--space-4) var(--space-3)' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes…"
            className="form-input" style={{ height: 44, borderRadius: 'var(--radius-lg)', fontSize: 'var(--text-md)' }} />
        </div>

        {/* Node list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 var(--space-2) var(--space-4)', WebkitOverflowScrolling: 'touch' }}>
          {ORDER.map(cat => {
            const items = NODE_DEFS.filter(n => n.category === cat && (!q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)));
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map(def => {
                  const c = BADGE_COLORS[def.category];
                  return (
                    <button key={def.subtype} onClick={() => onAdd(def)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: 'var(--space-3) var(--space-3)', borderRadius: 'var(--radius-lg)',
                      background: 'none', border: 'none', textAlign: 'left', minHeight: 48,
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: c.bg, color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {NODE_ICONS[def.subtype]?.() ?? def.badge}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{def.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>{def.description}</div>
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
