import { useState, useEffect, useRef } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';
import { TEMPLATES } from '../../utils/templates';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import { useGraphLayout } from '../../hooks/useGraphLayout';

import TemplateCard from '../ui/TemplateCard';

function makeSourceNode(content: string): ContentNode {
  const def = NODE_DEFS_BY_SUBTYPE['text-source'];
  return {
    id: `text-source-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    type: 'contentNode',
    position: { x: 200, y: 200 },
    deletable: true,
    data: { subtype: 'text-source', label: def.label, badge: def.badge, category: def.category, description: def.description, config: { text: content } },
  };
}

function EmptyHero({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 'var(--radius-xl)',
      background: 'linear-gradient(135deg, var(--color-bg-dark) 0%, #2a3028 100%)',
      overflow: 'hidden', marginBottom: 'var(--space-6)',
    }}>
      <svg viewBox="0 0 800 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <rect x="400" y="35" width="110" height="55" rx="10" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <text x="455" y="67" fontSize="11" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.25)" textAnchor="middle">Source</text>
        <rect x="560" y="15" width="95" height="45" rx="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <text x="607" y="42" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.2)" textAnchor="middle">LinkedIn</text>
        <rect x="560" y="85" width="95" height="45" rx="10" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <text x="607" y="112" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.2)" textAnchor="middle">Thread</text>
        <rect x="700" y="45" width="85" height="55" rx="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
        <text x="742" y="77" fontSize="10" fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.18)" textAnchor="middle">Export</text>
        <path d="M510 55 Q535 37 560 37" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <path d="M510 70 Q535 107 560 107" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
        <path d="M655 37 Q677 65 700 65" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <path d="M655 107 Q677 80 700 80" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
        <polygon points="558,33 558,41 565,37" fill="rgba(255,255,255,0.2)" />
        <polygon points="558,103 558,111 565,107" fill="rgba(255,255,255,0.2)" />
        <polygon points="698,61 698,69 705,65" fill="rgba(255,255,255,0.15)" />
        <circle cx="510" cy="55" r="3" fill="rgba(255,255,255,0.25)" />
        <circle cx="510" cy="70" r="3" fill="rgba(255,255,255,0.25)" />
        <circle cx="655" cy="37" r="2.5" fill="rgba(255,255,255,0.18)" />
        <circle cx="655" cy="107" r="2.5" fill="rgba(255,255,255,0.18)" />
      </svg>
      <div style={{ position: 'relative', padding: 'var(--space-8) var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--p-white)', margin: 0, letterSpacing: '-.02em' }}>
          Content Graph
        </h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-on-dark)', margin: 'var(--space-2) 0 var(--space-5)', maxWidth: 360, lineHeight: 1.5 }}>
          Connect nodes to repurpose any content into LinkedIn posts, threads, newsletters, and more.
        </p>
        <button onClick={onNew} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          New Workflow →
        </button>
      </div>
    </div>
  );
}

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>;


export default function WorkflowLibraryView({ onOpen }: { onOpen: () => void }) {
  const [items, setItems] = useState<SavedWorkflow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { setNodes, setEdges, setGraphName, addNode } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [loading, setLoading] = useState(true);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (pasting) setTimeout(() => pasteRef.current?.focus(), 100); }, [pasting]);

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
  const handleLoadTemplate = (idx: number) => {
    const { nodes: n, edges: e } = TEMPLATES[idx].build();
    const trimmed = pasteText.trim();
    if (trimmed) {
      const src = n.find(nd => nd.data.subtype === 'text-source');
      if (src) src.data.config = { ...src.data.config, text: trimmed };
    }
    useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll();
    setNodes(n); setEdges(e);
    setGraphName(`${TEMPLATES[idx].name} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    onOpen();
    setTimeout(autoLayout, 0);
  };
  const handlePasteGo = () => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll();
    setNodes([]); setEdges([]);
    addNode(makeSourceNode(trimmed));
    setGraphName('Untitled Graph');
    onOpen();
  };
  const fmt = (iso: string) => { const d = new Date(iso), diff = Date.now() - d.getTime(); if (diff < 60000) return 'Just now'; if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`; if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`; return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

  const chipList = (item: SavedWorkflow) => {
    const all = item.nodes.map(n => n.data.label);
    const visible = all.slice(0, 2);
    const remaining = Math.max(0, all.length - 2);
    return { visible, remaining };
  };

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Hero banner — 30% of viewport (shown only when workflows exist) */}
      {!loading && items.length > 0 && (
        <div className="p-4 md:p-8" style={{ height: '30vh', minHeight: 180, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Workflows</h1>
            <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{items.length} workflow{items.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)', zIndex: 1 }}><button className="btn btn-primary" onClick={handleNew}><PlusIcon /> New workflow</button></div>
        </div>
      )}

      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 'var(--radius-lg)' }} />)}
          </div>

        /* Empty — show hero + template picker */
        ) : items.length === 0 ? (
          <div>
            <EmptyHero onNew={handleNew} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <span className="text-label">Start from a template</span>
              <button onClick={() => setPasting(!pasting)}
                style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-accent-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {pasting ? '← Back' : 'Paste content instead'}
              </button>
            </div>
            {pasting && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <textarea ref={pasteRef} value={pasteText} onChange={e => setPasteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePasteGo(); }}
                  placeholder="Paste an article, transcript, or notes…"
                  className="form-textarea"
                  style={{ minHeight: 120, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--color-bg-card)', marginBottom: 'var(--space-2)' }} />
                <div style={{ textAlign: 'right' }}>
                  <button onClick={handlePasteGo} disabled={!pasteText.trim()} className="btn btn-primary" style={{ opacity: pasteText.trim() ? 1 : 0.4 }}>
                    Create graph →
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)', paddingBottom: 'var(--space-8)' }}>
              <TemplateCard title="+ Empty Workflow" meta="Start from scratch" pills={[]} onClick={handleNew} />
              {TEMPLATES.map((t, i) => {
                const { nodes: n } = t.build();
                const nodeLabels = n.slice(0, 2).map(nd => nd.data.label);
                const extra = n.length - 2;
                return <TemplateCard key={t.name} title={t.name} meta={`${n.length} nodes`} pills={nodeLabels} extraCount={extra > 0 ? extra : undefined} onClick={() => handleLoadTemplate(i)} />;
              })}
            </div>
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
