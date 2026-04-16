import { useState, useEffect } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { BADGE_COLORS, CATEGORY_LABELS } from '../../utils/nodeDefs';
import type { Edge } from '@xyflow/react';
import type { NodeCategory } from '../../store/graphStore';

interface SavedWorkflow {
  id: string;
  name: string;
  nodes: ContentNode[];
  edges: Edge[];
  savedAt: string;
}

const STORAGE_KEY = 'workflow-library';
function load(): SavedWorkflow[] { try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function persist(items: SavedWorkflow[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

/* SVG icons */
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
const TrashIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>;
const SaveIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

/* Node breakdown badges */
function NodeBreakdown({ nodes }: { nodes: ContentNode[] }) {
  const counts: Partial<Record<NodeCategory, number>> = {};
  nodes.forEach(n => { const c = n.data.category; counts[c] = (counts[c] || 0) + 1; });
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {(Object.entries(counts) as [NodeCategory, number][]).map(([cat, count]) => {
        const c = BADGE_COLORS[cat];
        return (
          <span key={cat} style={{
            fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: c.bg, color: c.text,
          }}>{count} {CATEGORY_LABELS[cat]}</span>
        );
      })}
    </div>
  );
}

export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { nodes, edges, graphName, setNodes, setEdges, setGraphName } = useGraphStore();

  useEffect(() => { setItems(load()); }, []);

  const canSave = nodes.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const name = graphName || 'Untitled';
    const item: SavedWorkflow = { id: Date.now().toString(), name, nodes, edges, savedAt: new Date().toISOString() };
    const updated = [item, ...items];
    persist(updated);
    setItems(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleLoad = (item: SavedWorkflow) => {
    setNodes(item.nodes);
    setEdges(item.edges);
    setGraphName(item.name);
    onOpen();
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    const updated = items.filter(i => i.id !== deleteId);
    persist(updated);
    setItems(updated);
    setDeleteId(null);
  };

  const handleNew = () => {
    setNodes([]);
    setEdges([]);
    setGraphName('Untitled');
    onOpen();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>Workflows</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={handleSave} disabled={!canSave} title={canSave ? 'Save current workflow' : 'Add nodes to your workflow first'}>
              <SaveIcon /> Save current
            </button>
            {saved && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-subtle)', alignSelf: 'center' }}>Saved!</span>}
            <button className="btn btn-primary" onClick={handleNew}>
              <PlusIcon /> New workflow
            </button>
          </div>
        </div>

        {/* Empty state */}
        {items.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '80px 24px', borderRadius: 16,
            border: '1px dashed var(--color-border-subtle)',
            background: 'var(--color-bg-card)',
          }}>
            {/* Workflow graph icon */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16, opacity: 0.35 }}>
              <rect x="4" y="18" width="14" height="12" rx="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5"/>
              <rect x="30" y="6" width="14" height="10" rx="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5"/>
              <rect x="30" y="20" width="14" height="10" rx="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5"/>
              <rect x="30" y="34" width="14" height="10" rx="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5"/>
              <path d="M18 22C24 22 24 11 30 11" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none"/>
              <path d="M18 24C24 24 24 25 30 25" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none"/>
              <path d="M18 26C24 26 24 39 30 39" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none"/>
            </svg>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              No saved workflows yet
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginBottom: 20 }}>
              Build a content pipeline and save it for reuse
            </div>
            <button className="btn btn-primary" onClick={handleNew}>
              <PlusIcon /> Create your first workflow
            </button>
          </div>
        ) : (
          /* Card grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            {items.map(item => (
              <button key={item.id} onClick={() => handleLoad(item)}
                style={{
                  textAlign: 'left', borderRadius: 12, padding: 16,
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                      {item.nodes.length} node{item.nodes.length !== 1 ? 's' : ''} · {item.edges.length} edge{item.edges.length !== 1 ? 's' : ''} · {fmt(item.savedAt)}
                    </div>
                  </div>
                  <div
                    role="button" tabIndex={0} aria-label="Delete workflow"
                    style={{
                      width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, marginLeft: 8, color: 'var(--color-text-disabled)', background: 'transparent',
                      transition: 'color .15s, background .15s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={e => { e.stopPropagation(); setDeleteId(item.id); }}>
                    <TrashIcon />
                  </div>
                </div>
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
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-6)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18)', border: '1px solid var(--color-border-default)',
            maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)',
            animation: 'scaleIn 150ms ease',
          }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete workflow?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-5)' }}>
              This will permanently remove "{items.find(i => i.id === deleteId)?.name}" from your library. This can't be undone.
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
