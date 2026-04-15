import { useState, useRef, useEffect } from 'react';
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

function getLibrary(): SavedWorkflow[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function setLibrary(items: SavedWorkflow[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function WorkflowLibrary() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const { nodes, edges, setNodes, setEdges, setGraphName } = useGraphStore();

  useEffect(() => {
    if (open) setItems(getLibrary());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry: SavedWorkflow = { id: crypto.randomUUID(), name: trimmed, nodes, edges, savedAt: new Date().toISOString() };
    const updated = [entry, ...getLibrary()];
    setLibrary(updated);
    setItems(updated);
    setName('');
  };

  const handleLoad = (w: SavedWorkflow) => {
    setNodes(w.nodes);
    setEdges(w.edges);
    setGraphName(w.name);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    const updated = getLibrary().filter((w) => w.id !== id);
    setLibrary(updated);
    setItems(updated);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn-ghost btn-sm" style={{ borderRadius: 10 }} onClick={() => setOpen(!open)}>Library</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 'var(--space-2)',
          width: 320, maxHeight: 400, overflowY: 'auto',
          background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-sans)' }}>
              Workflow Library
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                placeholder="Workflow name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                style={{
                  flex: 1, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
                  padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)', outline: 'none', minHeight: 'var(--size-control-sm)',
                }}
              />
              <button className="btn-ghost btn-sm" style={{ borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }} onClick={handleSave}>Save current</button>
            </div>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {items.length === 0 && (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                No saved workflows
              </div>
            )}
            {items.map((w) => (
              <div
                key={w.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
                onClick={() => handleLoad(w)}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {w.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                    {w.nodes.length} nodes · {new Date(w.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-1)',
                    color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', lineHeight: 1,
                    borderRadius: 'var(--radius-sm)', minWidth: 'var(--size-control-sm)', minHeight: 'var(--size-control-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-tertiary)')}
                  aria-label={`Delete ${w.name}`}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
