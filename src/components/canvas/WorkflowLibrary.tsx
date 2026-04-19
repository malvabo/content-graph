import { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { BADGE_COLORS } from '../../utils/nodeDefs';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';

/* SVG icons */
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
/* Mini node graph preview for cards */

export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, setGraphName } = useGraphStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWorkflows().then(r => { setItems(r); setLoading(false); }); }, []);
  useEffect(() => {
    if (!menuId) return;
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuId]);

  const handleLoad = (item: SavedWorkflow) => {
    useExecutionStore.getState().resetAll();
    useOutputStore.getState().clearAll();
    setNodes(item.nodes);
    setEdges(item.edges);
    setGraphName(item.name);
    onOpen();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setItems(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
    await deleteWorkflow(deleteId);
  };

  const handleRename = async (id: string, newName: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, name: newName } : i));
    const item = items.find(i => i.id === id);
    if (item) await saveWorkflow({ ...item, name: newName });
  };

  const handleDuplicate = async (item: SavedWorkflow) => {
    const dup: SavedWorkflow = { ...item, id: `wf-${Date.now()}`, name: `${item.name} (copy)`, savedAt: new Date().toISOString() };
    setItems(prev => [...prev, dup]);
    await saveWorkflow(dup);
    setMenuId(null);
  };

  const handleNew = () => {
    setNodes([]);
    setEdges([]);
    setGraphName('Untitled');
    useExecutionStore.getState().resetAll();
    useOutputStore.getState().clearAll();
    onOpen();
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%' }}>
      {/* Full-width layout with horizontal padding */}
      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', width: '100%' }}>

        {/* Header row — compact, full-width */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)', position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', paddingBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
            <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Workflows</h1>
            {items.length > 0 && (
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>
                {items.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {items.length > 0 && <button className="btn btn-primary" onClick={handleNew}>
              <PlusIcon /> New workflow
            </button>}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 180, borderRadius: 'var(--radius-lg)' }} />)}
          </div>
        ) : items.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 'var(--space-8)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-xl, 16px)',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M17.5 14v7m-3.5-3.5h7" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md, 16px)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              No workflows yet
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
              Create your first content pipeline to connect nodes, automate tasks, and reuse flows.
            </div>
            <button className="btn btn-primary" onClick={handleNew} style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
              <PlusIcon /> Create your first workflow
            </button>
          </div>
        ) : (
          /* Card grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            {items.map(item => {
              const srcNode = item.nodes.find(n => n.data.subtype === 'text-source' || n.data.subtype === 'voice-source');
              const preview = (srcNode?.data.config?.text as string || '').slice(0, 100);
              const nodeLabels = item.nodes.slice(0, 6).map(n => n.data.label);

              return (
              <div key={item.id} role="button" tabIndex={0} onClick={() => handleLoad(item)}
                style={{
                  textAlign: 'left', cursor: 'pointer', outline: 'none',
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                  borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>

                {/* Top: node pills */}
                <div style={{ background: 'var(--color-bg-surface)', padding: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {nodeLabels.map((label, j) => {
                    const cat = item.nodes[j]?.data.category;
                    const c = BADGE_COLORS[cat] || BADGE_COLORS.source;
                    return (
                      <span key={j} style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)', padding: '3px 10px', borderRadius: 'var(--radius-full)', background: c.bg, color: c.text, lineHeight: '16px' }}>{label}</span>
                    );
                  })}
                  {item.nodes.length > 6 && <span style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>+{item.nodes.length - 6}</span>}
                </div>

                {/* Bottom: title, meta, preview */}
                <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 2 }}>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {item.name}
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div role="button" tabIndex={0} aria-label="More options"
                        style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-disabled)', cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); setMenuId(menuId === item.id ? null : item.id); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </div>
                      {menuId === item.id && (
                        <div ref={menuRef} onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: 4, minWidth: 140 }}>
                          {[
                            { label: 'Rename', action: () => {
                              const name = prompt('Rename workflow', item.name);
                              if (name?.trim()) handleRename(item.id, name.trim());
                              setMenuId(null);
                            } },
                            { label: 'Duplicate', action: () => handleDuplicate(item) },
                            { label: 'Delete', danger: true, action: () => { setDeleteId(item.id); setMenuId(null); } },
                          ].map(opt => (
                            <button key={opt.label} onClick={opt.action}
                              style={{ width: '100%', padding: '6px 10px', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-secondary)', textAlign: 'left' }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>
                    {item.nodes.length} nodes · {fmt(item.savedAt)}
                  </div>
                  {preview && (
                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>
                      {preview}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation overlay */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)',
          animation: 'fadeIn 150ms ease',
        }} onClick={() => setDeleteId(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)', border: '1px solid var(--color-border-default)',
            maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)',
            animation: 'scaleIn 150ms ease',
          }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete workflow?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              This will permanently remove "{items.find(i => i.id === deleteId)?.name}" from your library.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
