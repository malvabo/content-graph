import { useState, useEffect } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { BADGE_COLORS, CATEGORY_LABELS } from '../../utils/nodeDefs';
import type { NodeCategory } from '../../store/graphStore';
import { loadWorkflows, deleteWorkflow, type SavedWorkflow } from '../../utils/workflowApi';
import type { Edge } from '@xyflow/react';

/* SVG icons */
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>;
/* Mini node graph preview for cards */
function MiniGraph({ nodes, edges }: { nodes: ContentNode[]; edges: Edge[] }) {
  const cats = nodes.map(n => n.data.category);
  const uniq = [...new Set(cats)];
  const total = Math.min(nodes.length, 6);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 16 }}>
      {Array.from({ length: total }).map((_, i) => {
        const cat = cats[i] || uniq[0];
        const c = BADGE_COLORS[cat];
        return <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: c.text, opacity: 0.6 }} />;
      })}
      {edges.length > 0 && (
        <svg width="12" height="8" viewBox="0 0 12 8" style={{ marginLeft: 2, opacity: 0.3 }}>
          <path d="M0 4h12M8 1l4 3-4 3" fill="none" stroke="var(--color-text-disabled)" strokeWidth="1.2"/>
        </svg>
      )}
      {nodes.length > 6 && <span style={{ fontSize: 10, color: 'var(--color-text-disabled)', fontFamily: 'var(--font-sans)' }}>+{nodes.length - 6}</span>}
    </div>
  );
}

/* Node breakdown badges */
function NodeBreakdown({ nodes }: { nodes: ContentNode[] }) {
  const counts: Partial<Record<NodeCategory, number>> = {};
  nodes.forEach(n => { const c = n.data.category; counts[c] = (counts[c] || 0) + 1; });
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {(Object.entries(counts) as [NodeCategory, number][]).map(([cat, count]) => {
        const c = BADGE_COLORS[cat];
        return (
          <span key={cat} style={{
            fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)',
            padding: '1px 6px', borderRadius: 'var(--radius-full)',
            background: c.bg, color: c.text, lineHeight: '16px',
          }}>{count} {CATEGORY_LABELS[cat]}</span>
        );
      })}
    </div>
  );
}

export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { setNodes, setEdges, setGraphName } = useGraphStore();

  useEffect(() => { loadWorkflows().then(setItems); }, []);

  const handleLoad = (item: SavedWorkflow) => {
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

  const handleNew = () => {
    setNodes([]);
    setEdges([]);
    setGraphName('Untitled');
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
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Full-width layout with horizontal padding */}
      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Header row — compact, full-width */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Workflows</h1>
            {items.length > 0 && (
              <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
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

        {items.length === 0 ? (
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
          /* Card grid — 3 columns, full-width, tight cards */
          <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]" style={{ gap: 'var(--space-3)' }}>
            {items.map(item => (
              <button key={item.id} onClick={() => handleLoad(item)}
                style={{
                  textAlign: 'left', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>

                {/* Row 1: name + delete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {item.name}
                  </div>
                  <div
                    role="button" tabIndex={0} aria-label="Delete workflow"
                    style={{
                      width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: 'var(--color-text-disabled)', background: 'transparent',
                      transition: 'color .15s, background .15s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}>
                    <TrashIcon />
                  </div>
                </div>

                {/* Row 2: meta line — nodes, edges, time + mini graph */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {item.nodes.length} node{item.nodes.length !== 1 ? 's' : ''} · {item.edges.length} edge{item.edges.length !== 1 ? 's' : ''} · {fmt(item.savedAt)}
                  </div>
                  <MiniGraph nodes={item.nodes} edges={item.edges} />
                </div>

                {/* Row 3: category badges */}
                <NodeBreakdown nodes={item.nodes} />
              </button>
            ))}
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
          <div onClick={e => e.stopPropagation()} style={{
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
