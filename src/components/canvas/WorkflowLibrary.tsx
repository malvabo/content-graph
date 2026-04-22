import { useState, useEffect, useRef } from 'react';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';
import { TEMPLATES } from '../../utils/templates';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import { useGraphLayout } from '../../hooks/useGraphLayout';

import TemplateCard from '../ui/TemplateCard';
import TemplatePickerModal from '../modals/TemplatePickerModal';

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
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const handleLoad = (item: SavedWorkflow) => {
    useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll();
    setNodes(item.nodes); setEdges(item.edges); setGraphName(item.name);
    useGraphStore.getState().setWorkflowId(item.id);
    useGraphStore.getState().setBrandId(item.brandId ?? null);
    onOpen();
  };
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
      {/* Hero banner — matches Voice Notes layout, button stacked below subtitle */}
      {!loading && (
        <div className="p-4 md:p-8" style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
            <div>
              <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>
                {items.length === 0 ? 'Content Graph' : 'Workflows'}
              </h1>
              <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0', maxWidth: 420, lineHeight: 1.5 }}>
                {items.length === 0
                  ? 'Connect nodes to repurpose any content into LinkedIn posts, threads, newsletters, and more.'
                  : `${items.length} workflow${items.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setPickerOpen(true)}><PlusIcon /> New workflow</button>
          </div>
        </div>
      )}

      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Loading */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {[0,1,2].map(i => <div key={i} className="skeleton-bar" style={{ height: 156, borderRadius: 'var(--radius-lg)' }} />)}
          </div>

        /* Empty — onboarding hero + popular templates */
        ) : items.length === 0 ? (
          <div>
            {/* Onboarding feature block */}
            <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Build content workflows with graphs</h2>
                <p style={{ margin: 'var(--space-2) 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, maxWidth: 460 }}>
                  Connect nodes to turn one piece of content into LinkedIn posts, newsletters, threads, infographics, and more — all in one graph.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <button onClick={() => setPickerOpen(true)} className="btn btn-primary"><PlusIcon /> New workflow</button>
                  <button onClick={() => setPasting(!pasting)}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-accent-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    {pasting ? '← Back' : 'Paste content instead'}
                  </button>
                </div>
                {pasting && (
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <textarea ref={pasteRef} value={pasteText} onChange={e => setPasteText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePasteGo(); }}
                      placeholder="Paste an article, transcript, or notes…"
                      className="form-textarea"
                      style={{ minHeight: 100, borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--color-bg-card)', marginBottom: 'var(--space-2)' }} />
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={handlePasteGo} disabled={!pasteText.trim()} className="btn btn-primary" style={{ opacity: pasteText.trim() ? 1 : 0.4 }}>
                        Create graph →
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Decorative preview on the right */}
              <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {['Article', 'LinkedIn post', 'Newsletter', 'Thread'].map((label, i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: i === 0 ? 0 : 16 }}>
                    {i > 0 && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>}
                    <span style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular templates heading + strip */}
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>Start with a popular template</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)', paddingBottom: 'var(--space-6)' }}>
              {TEMPLATES.map((t, i) => {
                const { nodes: n, edges: e } = t.build();
                return <TemplateCard key={t.name} title={t.name} meta={`${t.category} · ${n.length} nodes`} pills={[]} graphData={{ nodes: n, edges: e }} onClick={() => handleLoadTemplate(i)} />;
              })}
            </div>
            <div style={{ textAlign: 'center', paddingBottom: 'var(--space-8)' }}>
              <button onClick={() => setPickerOpen(true)}
                style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-2)' }}>
                See all
              </button>
            </div>
          </div>

        /* Grid */
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
            {items.map(item => {
              const { visible, remaining } = chipList(item);
              return (
                <div key={item.id} style={{ position: 'relative', zIndex: menuId === item.id ? 60 : 'auto' }}
                  onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)}>
                  <TemplateCard
                    title={item.name}
                    meta={`${item.nodes.length} nodes · ${fmt(item.savedAt)}`}
                    pills={[]}
                    graphData={{ nodes: item.nodes, edges: item.edges }}
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

      {/* Template picker modal */}
      {pickerOpen && (
        <TemplatePickerModal
          onClose={() => setPickerOpen(false)}
          onStartScratch={() => { setPickerOpen(false); handleNew(); }}
          onPickTemplate={(idx) => { setPickerOpen(false); handleLoadTemplate(idx); }}
        />
      )}

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
