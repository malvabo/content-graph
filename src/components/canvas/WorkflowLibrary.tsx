import { useState, useEffect } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import type { Edge } from '@xyflow/react';

interface SavedWorkflow {
  id: string;
  name: string;
  nodes: ContentNode[];
  edges: Edge[];
  savedAt: string;
}

const STORAGE_KEY = 'workflow-library';

function load(): SavedWorkflow[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(items: SavedWorkflow[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const { nodes, edges, graphName, setNodes, setEdges, setGraphName } = useGraphStore();

  useEffect(() => { setItems(load()); }, []);

  const handleSave = () => {
    if (nodes.length === 0) return;
    const name = graphName || 'Untitled';
    const item: SavedWorkflow = { id: Date.now().toString(), name, nodes, edges, savedAt: new Date().toISOString() };
    const updated = [item, ...items];
    save(updated);
    setItems(updated);
  };

  const handleLoad = (item: SavedWorkflow) => {
    setNodes(item.nodes);
    setEdges(item.edges);
    setGraphName(item.name);
    onOpen();
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    save(updated);
    setItems(updated);
  };

  const handleNew = () => {
    setNodes([]);
    setEdges([]);
    setGraphName('Untitled');
    onOpen();
  };

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 overflow-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-[720px] mx-auto py-12 px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 style={{ fontWeight: 600, fontSize: 'var(--text-xl)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>Workflows</h1>
          <div className="flex gap-2">
            {nodes.length > 0 && (
              <button className="btn btn-outline" onClick={handleSave}>Save current</button>
            )}
            <button className="btn btn-primary" onClick={handleNew}>+ New workflow</button>
          </div>
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, marginBottom: 4 }}>No saved workflows</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>Create a workflow and save it here</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <button key={item.id} onClick={() => handleLoad(item)}
                className="text-left rounded-xl p-4 transition-all"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', fontFamily: 'var(--font-sans)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }} className="truncate">{item.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                      {item.nodes.length} nodes · {fmt(item.savedAt)}
                    </div>
                  </div>
                  <button
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 ml-2"
                    style={{ color: 'var(--color-text-disabled)', background: 'transparent', border: 'none' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'var(--color-danger-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-disabled)'; e.currentTarget.style.background = 'transparent'; }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    aria-label="Delete workflow">✕</button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
