import { useState, useRef, useEffect } from 'react';
import { NODE_DEFS, CATEGORY_LABELS, BADGE_COLORS, type NodeDef } from '../../utils/nodeDefs';
import { NODE_ICONS } from '../../utils/nodeIcons';
import type { NodeCategory } from '../../store/graphStore';

import { motion } from 'motion/react';

const PALETTE_TEMPLATES = [
  { key: 'review',    title: 'Quick review document',  description: 'Summarise key decisions and action items from any doc' },
  { key: 'marketing', title: 'Marketing launch pack',  description: 'Social posts, email and ad copy from a single brief' },
  { key: 'repurpose', title: 'Content repurpose',      description: 'Adapt one piece of content across multiple formats' },
  { key: 'newsletter',title: 'Newsletter digest',      description: 'Turn a source into a scannable email newsletter' },
  { key: 'brand',     title: 'Brand story refresh',    description: 'Rewrite with a consistent voice and narrative arc' },
];

const PALETTE_ORDER: NodeCategory[] = ['source', 'generate', 'output', 'transform'];

function PaletteItem({ def, onClick }: { def: NodeDef; onClick: () => void }) {
  const colors = BADGE_COLORS[def.category];
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/content-graph-node', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick}
      className="palette-item flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer active:opacity-80">
      <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: colors.bg, color: colors.text }}>
        {NODE_ICONS[def.subtype]?.() ?? def.badge}
      </div>
      <div className="min-w-0">
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-fixed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }} className="truncate">{def.label}</div>
        <div style={{ fontSize: 'var(--text-xs)', lineHeight: '16px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 2 }} className="truncate">{def.description}</div>
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.55 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function GenerateFileBlock({ def, onClick }: { def: NodeDef; onClick: () => void }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/content-graph-node', JSON.stringify(def));
    e.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div
      draggable onDragStart={onDragStart} onClick={onClick}
      className="palette-item cursor-pointer active:opacity-70"
      style={{
        borderRadius: 10,
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 5,
        transition: 'background 120ms, border-color 120ms',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-muted, var(--color-bg-subtle))'; e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: '16px' }}>{def.label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text-tertiary)' }}>
        <FileIcon />
        <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', lineHeight: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def.description}</span>
      </div>
    </div>
  );
}

interface Props { onAddNode: (def: NodeDef) => void }

export default function NodePalette({ onAddNode }: Props) {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [promptText, setPromptText] = useState('');
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const toggle = () => setOpen(o => !o);
    window.addEventListener('toggle-palette', toggle);
    return () => window.removeEventListener('toggle-palette', toggle);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open]);

  useEffect(() => {
    if (!templatePickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const picker = ref.current?.querySelector('[data-template-picker]');
      const pill = ref.current?.querySelector('[data-template-pill]');
      if (!picker?.contains(target) && !pill?.contains(target)) setTemplatePickerOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [templatePickerOpen]);

  const selectTemplate = (key: string) => {
    const tpl = PALETTE_TEMPLATES.find(t => t.key === key);
    if (!tpl) return;
    setActiveTemplate(key);
    setPromptText(tpl.description);
    setTemplatePickerOpen(false);
  };

  return (
    <div ref={ref} className="absolute bottom-4 left-4 z-20">
      <style>{`
        @keyframes paletteIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tplPickerIn { from { opacity: 0; transform: scale(0.97) translateY(4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      `}</style>
      {/* Floating + button */}
      <motion.button
        onClick={() => setOpen(!open)}
        aria-label="Add node" aria-expanded={open}
        whileHover={{ scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          color: 'var(--color-text-primary)',
          transition: 'box-shadow 200ms, border-color 200ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}
      >
        <motion.svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <path d="M12 5v14"/><path d="M5 12h14"/>
        </motion.svg>
      </motion.button>

      {/* Popover */}
      {open && (
        <div className="palette-popover absolute left-0 flex flex-col"
          style={{ width: 300, bottom: 52, background: 'var(--color-bg-popover)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)', animation: 'paletteIn 150ms ease' }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setTemplatePickerOpen(false); setOpen(false); } }}>

          {/* Prompt section — outside scroll area so template picker isn't clipped */}
          <div style={{ padding: 'var(--space-3) var(--space-3) 0', flexShrink: 0, position: 'relative' }}>
            <div style={{ fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>Prompt</div>
            <textarea
              className="nowheel"
              value={promptText}
              onChange={e => { setPromptText(e.target.value); if (activeTemplate) setActiveTemplate(null); }}
              placeholder="Describe what you want to generate…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'none',
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: '20px',
                color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)',
                padding: '8px 10px', outline: 'none', transition: 'border-color 120ms',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
            />

            {/* Templates pill */}
            <div style={{ marginTop: 6, marginBottom: 10, position: 'relative' }}>
              <button
                data-template-pill
                onClick={() => setTemplatePickerOpen(o => !o)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px 4px 10px', borderRadius: 'var(--radius-full)',
                  border: `1px solid ${activeTemplate ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                  background: activeTemplate ? 'var(--color-bg-surface)' : 'var(--color-bg-subtle)',
                  color: activeTemplate ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                  fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 500, cursor: 'pointer',
                  transition: 'all 120ms',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/><rect x="14" y="13" width="7" height="8" rx="1"/></svg>
                {activeTemplate ? PALETTE_TEMPLATES.find(t => t.key === activeTemplate)?.title : 'Templates'}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.6, transform: templatePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}><path d="m6 9 6 6 6-6"/></svg>
              </button>

              {/* iOS-style template picker */}
              {templatePickerOpen && (
                <div
                  data-template-picker
                  style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                    width: '100%', zIndex: 200,
                    background: 'var(--color-bg-card)',
                    borderRadius: 16,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
                    border: '1px solid var(--color-border-subtle)',
                    overflow: 'hidden',
                    animation: 'tplPickerIn 160ms cubic-bezier(0.32,0.72,0,1)',
                  }}
                >
                  {PALETTE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={tpl.key}
                      onClick={() => selectTemplate(tpl.key)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '13px 16px',
                        background: activeTemplate === tpl.key ? 'var(--color-bg-surface)' : 'transparent',
                        border: 'none', borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : 'none',
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={e => { if (activeTemplate !== tpl.key) e.currentTarget.style.background = 'var(--color-bg-subtle)'; }}
                      onMouseLeave={e => { if (activeTemplate !== tpl.key) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: '20px' }}>{tpl.title}</span>
                        {activeTemplate === tpl.key && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2, lineHeight: '16px' }}>{tpl.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: '0 calc(-1 * var(--space-3))' }} />
          </div>

          {/* Node list — scrollable */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', padding: 'var(--space-2) var(--space-2) var(--space-3)', maxHeight: 280 }}>
            {PALETTE_ORDER.map((cat, catIdx) => {
              const nodes = NODE_DEFS.filter(n => n.category === cat);
              if (!nodes.length) return null;
              const isAdvanced = cat === 'transform';
              return (
                <div key={cat}>
                  {catIdx > 0 && <div style={{ height: 1, background: 'var(--color-border-subtle)', margin: 'var(--space-2) var(--space-3)' }} />}
                  {isAdvanced ? (
                    <button className="palette-cat-btn flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded-md text-left"
                      style={{ fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                      onClick={() => setAdvancedOpen(!advancedOpen)}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ transform: advancedOpen ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }}><path d="m9 18 6-6-6-6"/></svg>
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ) : (
                    <div className="px-3 mb-1 mt-1" style={{ fontWeight: 500, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{CATEGORY_LABELS[cat]}</div>
                  )}
                  {(!isAdvanced || advancedOpen) && (
                    cat === 'generate' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '4px var(--space-2) var(--space-1)' }}>
                        {nodes.map(def => (
                          <GenerateFileBlock key={def.subtype} def={def} onClick={() => { onAddNode(def); setOpen(false); }} />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">{nodes.map(def => (
                        <PaletteItem key={def.subtype} def={def} onClick={() => { onAddNode(def); setOpen(false); }} />
                      ))}</div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
