import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;

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
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  const handleLoad = (item: SavedWorkflow) => { useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); setNodes(item.nodes); setEdges(item.edges); setGraphName(item.name); onOpen(); };
  const confirmDelete = async () => { if (!deleteId) return; setItems(p => p.filter(i => i.id !== deleteId)); setDeleteId(null); await deleteWorkflow(deleteId); };
  const handleRename = async (id: string, newName: string) => { setItems(p => p.map(i => i.id === id ? { ...i, name: newName } : i)); const item = items.find(i => i.id === id); if (item) await saveWorkflow({ ...item, name: newName }); };
  const handleDuplicate = async (item: SavedWorkflow) => { const dup: SavedWorkflow = { ...item, id: `wf-${Date.now()}`, name: `${item.name} (copy)`, savedAt: new Date().toISOString() }; setItems(p => [...p, dup]); await saveWorkflow(dup); setMenuId(null); };
  const handleNew = () => { setNodes([]); setEdges([]); setGraphName('Untitled'); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); onOpen(); };

  const fmt = (iso: string) => { const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  // DS tokens
  const CHIP: React.CSSProperties = { fontSize: 11, fontWeight: 400, fontFamily: 'var(--font-sans)', padding: '3px 8px', borderRadius: 5, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', color: 'var(--color-text-secondary)', lineHeight: '16px', whiteSpace: 'nowrap' };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h1 style={{ fontWeight: 600, fontSize: 20, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Workflows</h1>
            {items.length > 0 && <span style={{ fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{items.length}</span>}
          </div>
          {items.length > 0 && <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button>}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 12 }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 20 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7m-3.5-3.5h7"/></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>No workflows yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 1.5, marginBottom: 24 }}>Create your first workflow to start repurposing content</div>
            <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {items.map(item => {
              const hovered = hoverId === item.id;
              const source = item.nodes.filter(n => n.data.category === 'source');
              const rest = item.nodes.filter(n => n.data.category !== 'source');
              const showLabels = [...source.slice(0, 1), ...rest.slice(0, 2)];
              const extra = item.nodes.length - showLabels.length;

              return (
                <div key={item.id} role="button" tabIndex={0} onClick={() => handleLoad(item)}
                  onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => { setHoverId(null); }}
                  style={{
                    cursor: 'pointer', outline: 'none', height: 156, padding: 20,
                    background: 'var(--color-bg-card)',
                    border: `1px solid ${hovered ? 'var(--color-border-strong)' : 'var(--color-border-default)'}`,
                    borderRadius: 12, overflow: 'hidden',
                    transition: 'transform 150ms ease-out, box-shadow 150ms ease-out, border-color 150ms ease-out',
                    transform: hovered ? 'translateY(-1px)' : 'none',
                    boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 2px 12px rgba(0,0,0,0.08)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>

                  {/* Title + menu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ fontWeight: 500, fontSize: 14, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {item.name}
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0, opacity: hovered || menuId === item.id ? 1 : 0, transition: 'opacity 150ms' }}>
                      <div role="button" tabIndex={0} aria-label="More options"
                        style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)', cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </div>
                      {menuId === item.id && (
                        <div ref={menuRef} onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 4, minWidth: 130 }}>
                          {[
                            { label: 'Rename', action: () => { const name = prompt('Rename workflow', item.name); if (name?.trim()) handleRename(item.id, name.trim()); setMenuId(null); } },
                            { label: 'Duplicate', action: () => handleDuplicate(item) },
                            { label: 'Delete', danger: true, action: () => { setDeleteId(item.id); setMenuId(null); } },
                          ].map(opt => (
                            <button key={opt.label} onClick={opt.action}
                              style={{ width: '100%', padding: '6px 10px', background: 'none', border: 'none', borderRadius: 5, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-secondary)', textAlign: 'left', transition: 'background 100ms' }}
                              onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-card)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chips — single row, no wrap */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1 }}>
                    {showLabels.map((n, j) => (
                      <span key={n.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {j > 0 && <span style={{ color: 'var(--color-text-disabled)', fontSize: 11, opacity: 0.4 }}>→</span>}
                        <span style={CHIP}>{n.data.label}</span>
                      </span>
                    ))}
                    {extra > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--color-text-disabled)', fontSize: 11, opacity: 0.4 }}>→</span>
                        <span style={CHIP}>+{extra} more</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginTop: 'auto' }}>
                    {item.nodes.length} nodes · {fmt(item.savedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }} onClick={() => setDeleteId(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 12, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', border: '1px solid var(--color-border-default)', maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontWeight: 500, fontSize: 16, color: 'var(--color-text-primary)', marginBottom: 8 }}>Delete workflow?</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>This will permanently remove "{items.find(i => i.id === deleteId)?.name}".</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
