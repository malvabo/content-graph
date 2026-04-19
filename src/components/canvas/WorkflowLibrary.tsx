import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;

const CHIP: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-normal)', fontFamily: 'var(--font-sans)', padding: '3px var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', lineHeight: '16px', whiteSpace: 'nowrap', flexShrink: 0 };
const ARROW: React.CSSProperties = { color: 'var(--color-text-disabled)', fontSize: 'var(--text-xs)', opacity: 0.4, flexShrink: 0 };

export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, setGraphName } = useGraphStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWorkflows().then(r => { setItems(r); setLoading(false); }); }, []);
  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  const handleLoad = (item: SavedWorkflow) => { useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); setNodes(item.nodes); setEdges(item.edges); setGraphName(item.name); onOpen(); };
  const confirmDelete = async () => { if (!deleteId) return; setItems(p => p.filter(i => i.id !== deleteId)); setDeleteId(null); await deleteWorkflow(deleteId); };
  const handleRename = async (id: string, newName: string) => { setItems(p => p.map(i => i.id === id ? { ...i, name: newName } : i)); const item = items.find(i => i.id === id); if (item) await saveWorkflow({ ...item, name: newName }); };
  const handleDuplicate = async (item: SavedWorkflow) => { const dup: SavedWorkflow = { ...item, id: `wf-${Date.now()}`, name: `${item.name} (copy)`, savedAt: new Date().toISOString() }; setItems(p => [...p, dup]); await saveWorkflow(dup); setMenuId(null); };
  const handleNew = () => { setNodes([]); setEdges([]); setGraphName('Untitled'); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); onOpen(); };
  const fmt = (iso: string) => { const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  const chipList = (item: SavedWorkflow) => {
    const MAX = 3;
    const labels = item.nodes.slice(0, MAX).map(n => n.data.label);
    const extra = Math.max(0, item.nodes.length - MAX);
    return { labels, extra };
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
            <h1 style={{ fontWeight: 600, fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Workflows</h1>
            {items.length > 0 && <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{items.length}</span>}
          </div>
          {items.length > 0 && <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button>}
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 'var(--radius-lg)' }} />)}
          </div>

        /* Empty */
        ) : items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7m-3.5-3.5h7"/></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No workflows yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>Create your first workflow to start repurposing content</div>
            <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button>
          </div>

        /* Grid */
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
            {items.map(item => {
              const hovered = hoverId === item.id;
              const { labels, extra } = chipList(item);
              return (
                <div key={item.id} role="button" tabIndex={0} onClick={() => handleLoad(item)}
                  onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)}
                  style={{
                    cursor: 'pointer', outline: 'none', height: 156, padding: 'var(--space-5)',
                    background: 'var(--color-bg-card)', border: `1px solid var(--color-border-${hovered ? 'strong' : 'default'})`,
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    transition: 'transform 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out',
                    transform: hovered ? 'translateY(-1px)' : 'none',
                    boxShadow: hovered ? 'var(--shadow-md)' : 'none',
                    display: 'flex', flexDirection: 'column',
                  }}>

                  {/* Title + menu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {item.name}
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0, opacity: hovered || menuId === item.id ? 1 : 0, transition: 'opacity 150ms' }}>
                      <div role="button" tabIndex={0} aria-label="More options"
                        style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)', cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </div>
                      {menuId === item.id && (
                        <div ref={menuRef} onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 'var(--space-1)', minWidth: 130 }}>
                          {[
                            { label: 'Rename', action: () => { const name = prompt('Rename workflow', item.name); if (name?.trim()) handleRename(item.id, name.trim()); setMenuId(null); } },
                            { label: 'Duplicate', action: () => handleDuplicate(item) },
                            { label: 'Delete', danger: true, action: () => { setDeleteId(item.id); setMenuId(null); } },
                          ].map(opt => (
                            <button key={opt.label} onClick={opt.action}
                              style={{ width: '100%', padding: '6px 10px', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-secondary)', textAlign: 'left', transition: 'background 100ms' }}
                              onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-card)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chips — single row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                    {labels.map((label, j) => (
                      <span key={j} style={{ display: 'contents' }}>
                        {j > 0 && <span style={ARROW}>→</span>}
                        <span style={CHIP}>{label}</span>
                      </span>
                    ))}
                    {extra > 0 && <>
                      {labels.length > 0 && <span style={ARROW}>→</span>}
                      <span style={{ ...CHIP, minWidth: 'fit-content' }}>+{extra} more</span>
                    </>}
                  </div>

                  {/* Metadata */}
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-3)' }}>
                    {item.nodes.length} nodes · {fmt(item.savedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }} onClick={() => setDeleteId(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-default)', maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete workflow?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>This will permanently remove "{items.find(i => i.id === deleteId)?.name}".</div>
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
