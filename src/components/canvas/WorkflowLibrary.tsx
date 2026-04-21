import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';

import TemplateCard from '../ui/TemplateCard';

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
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  const handleLoad = (item: SavedWorkflow) => { useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); setNodes(item.nodes); setEdges(item.edges); setGraphName(item.name); useGraphStore.getState().setWorkflowId(item.id); onOpen(); };
  const confirmDelete = async () => { if (!deleteId) return; setItems(p => p.filter(i => i.id !== deleteId)); setDeleteId(null); await deleteWorkflow(deleteId); };
  const handleRename = async (id: string, newName: string) => { setItems(p => p.map(i => i.id === id ? { ...i, name: newName } : i)); const item = items.find(i => i.id === id); if (item) await saveWorkflow({ ...item, name: newName }); };
  const handleDuplicate = async (item: SavedWorkflow) => { const dup: SavedWorkflow = { ...item, id: `wf-${Date.now()}`, name: `${item.name} (copy)`, savedAt: new Date().toISOString() }; setItems(p => [...p, dup]); await saveWorkflow(dup); setMenuId(null); };
  const handleNew = () => { setNodes([]); setEdges([]); setGraphName('Untitled'); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); onOpen(); };
  const fmt = (iso: string) => { const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  const chipList = (item: SavedWorkflow) => {
    const all = item.nodes.map(n => n.data.label);
    const visible = all.slice(0, 2);
    const remaining = Math.max(0, all.length - 2);
    return { visible, remaining };
  };

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Hero banner — 30% of viewport */}
      <div className="p-4 md:p-8" style={{ height: '30vh', minHeight: 180, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Workflows</h1>
          {items.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{items.length} workflow{items.length !== 1 ? 's' : ''}</p>}
        </div>
        {items.length > 0 && <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 1 }}><button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button></div>}
      </div>

      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 'var(--radius-lg)' }} />)}
          </div>

        /* Empty */
        ) : items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7m-3.5-3.5h7"/></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No workflows yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-6)' }}>Create your first workflow to start repurposing content</div>
            <button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button>
          </div>

        /* Grid */
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {items.map(item => {
              const { visible, remaining } = chipList(item);
              return (
                <div key={item.id} style={{ position: 'relative' }}
                  onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)}>
                  <TemplateCard
                    title={item.name}
                    meta={`${item.nodes.length} nodes · ${fmt(item.savedAt)}`}
                    pills={visible}
                    extraCount={remaining > 0 ? remaining : undefined}
                    onClick={() => handleLoad(item)}
                  />
                  {/* 3-dot menu */}
                  <div style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', opacity: hoverId === item.id || menuId === item.id ? 1 : 0, transition: 'opacity 150ms', zIndex: 2 }}>
                    <div role="button" tabIndex={0} aria-label="More options"
                      style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', background: 'transparent', cursor: 'pointer', transition: 'color 150ms, background 150ms' }}
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </div>
                    {menuId === item.id && (
                      <div ref={menuRef} onClick={e => e.stopPropagation()}
                        style={{ position: 'absolute', top: 28, left: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
                        {[
                          { label: 'Rename', action: () => { const name = prompt('Rename workflow', item.name); if (name?.trim()) handleRename(item.id, name.trim()); setMenuId(null); } },
                          { label: 'Duplicate', action: () => handleDuplicate(item) },
                          { label: 'Delete', danger: true, action: () => { setDeleteId(item.id); setMenuId(null); } },
                        ].map(opt => (
                          <button key={opt.label} onClick={opt.action}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', transition: 'background 100ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
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
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-snug)', marginBottom: 'var(--space-4)' }}>This will permanently remove "{items.find(i => i.id === deleteId)?.name}".</div>
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
