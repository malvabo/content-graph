import { useState, useEffect, useRef } from 'react';
import { Menu, MenuItem } from '../ui/Menu';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { loadWorkflows, deleteWorkflow, saveWorkflow, type SavedWorkflow } from '../../utils/workflowApi';
import { TEMPLATES } from '../../utils/templates';
import { NODE_DEFS_BY_SUBTYPE } from '../../utils/nodeDefs';
import { useGraphLayout } from '../../hooks/useGraphLayout';

import TemplatePickerModal from '../modals/TemplatePickerModal';
import GraphSchematic from '../ui/GraphSchematic';

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
  const { setNodes, setEdges, setGraphName, addNode, clearGraph } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [query, setQuery] = useState('');
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
  const handleRename = async (id: string, newName: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const renamed: SavedWorkflow = { ...item, name: newName };
    setItems(p => p.map(i => i.id === id ? renamed : i));
    await saveWorkflow(renamed);
  };
  const handleDuplicate = async (item: SavedWorkflow) => { const dup: SavedWorkflow = { ...item, id: `wf-${Date.now()}`, name: `${item.name} (copy)`, savedAt: new Date().toISOString() }; setItems(p => [...p, dup]); await saveWorkflow(dup); setMenuId(null); };
  const handleNew = () => { clearGraph(); setGraphName('Untitled'); useExecutionStore.getState().resetAll(); useOutputStore.getState().clearAll(); onOpen(); };
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

  const filtered = items.filter(i => !query.trim() || i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mobile-safe-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      {/* Top toolbar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '14px 24px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7"/><path d="M17.5 14v7"/></svg>
          <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Workflows</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 'var(--radius-full)', padding: '6px 12px', border: '1px solid var(--color-border-default)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Learn
          </button>
          <button onClick={() => setPickerOpen(true)} className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)' }}>
            <PlusIcon /> New workflow
          </button>
        </div>
      </div>

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <div className="search-bar">
            <span className="search-bar__icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input className="search-bar__input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..." aria-label="Search workflows" />
          </div>
        </div>

        {/* Count */}
        {!loading && (
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
            {filtered.length} workflow{filtered.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Feature block */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start', marginBottom: 'var(--space-6)' }}>
          {/* Left: title + description + 3 starters */}
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', letterSpacing: '-0.01em' }}>Get started with Workflows</h2>
            <p style={{ margin: 'var(--space-2) 0 var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Connect nodes to turn one piece of content into LinkedIn posts, newsletters, threads, infographics, and more.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {([
                { title: 'From template', description: 'Start from a curated workflow', onClick: () => setPickerOpen(true) },
                { title: 'Blank workflow', description: 'Open an empty canvas', onClick: handleNew },
                { title: 'Paste content', description: 'Paste an article or transcript as source', onClick: () => setPasting(true) },
              ] as const).map(s => (
                <button key={s.title} onClick={s.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    textAlign: 'left', padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)',
                    background: 'var(--color-bg-card)', fontFamily: 'var(--font-sans)',
                    cursor: 'pointer', transition: 'border-color 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{s.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>{s.description}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
            </div>
          </div>

          {/* Right: decorative schematic — non-interactive illustration */}
          {(() => {
            const t = TEMPLATES[0];
            if (!t) return <div />;
            const { nodes: n, edges: e } = t.build();
            return (
              <div aria-hidden style={{
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', minHeight: 160,
              }}>
                <GraphSchematic nodes={n} edges={e} background="var(--color-bg-card)" showBorder={false} height={160} />
              </div>
            );
          })()}
        </div>

          {pasting && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <textarea ref={pasteRef} value={pasteText} onChange={e => setPasteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePasteGo(); }}
                placeholder="Paste an article, transcript, or notes…"
                className="form-textarea"
                style={{ minHeight: 120, borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)', background: 'var(--color-bg-card)', marginBottom: 'var(--space-2)' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                <button onClick={() => { setPasting(false); setPasteText(''); }} className="btn btn-ghost">Cancel</button>
                <button onClick={handlePasteGo} disabled={!pasteText.trim()} className="btn btn-primary" style={{ opacity: pasteText.trim() ? 1 : 0.4 }}>
                  Create graph →
                </button>
              </div>
            </div>
          )}

        {/* Table */}
        {loading ? (
          <div className="skeleton-bar" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
            {query ? 'No workflows match your search.' : 'No workflows yet. Create one to get started.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)' }}>
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Name</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>State</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Updated</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Steps</th>
                <th style={{ padding: '10px 12px', fontWeight: 'var(--weight-medium)' }}>Flow</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const { visible, remaining } = chipList(item);
                const hasNodes = item.nodes.length > 0;
                const stateLabel = hasNodes ? 'Saved' : 'Draft';
                return (
                  <tr key={item.id}
                    onClick={() => handleLoad(item)}
                    onMouseEnter={() => setHoverId(item.id)} onMouseLeave={() => setHoverId(null)}
                    style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'pointer', background: hoverId === item.id ? 'var(--color-bg-surface)' : 'transparent', transition: 'background 100ms' }}>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)' }}>{item.name}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-default)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{stateLabel}</span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{fmt(item.savedAt)}</td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{item.nodes.length}</td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                      {visible.join(' → ')}{remaining > 0 && ` +${remaining}`}
                    </td>
                    <td style={{ padding: '14px 12px', width: 40, position: 'relative' }} onClick={e => e.stopPropagation()}>
                      <div role="button" tabIndex={0} aria-label="More options"
                        style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
                        onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMenuId(menuId === item.id ? null : item.id); } }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                      </div>
                      {menuId === item.id && (
                        <Menu ref={menuRef} style={{ position: 'absolute', top: 32, right: 0, zIndex: 50 }}>
                          <MenuItem onClick={() => { const name = prompt('Rename workflow', item.name); if (name?.trim()) handleRename(item.id, name.trim()); setMenuId(null); }}>
                            Rename
                          </MenuItem>
                          <MenuItem onClick={() => handleDuplicate(item)}>Duplicate</MenuItem>
                          <MenuItem danger onClick={() => { setDeleteId(item.id); setMenuId(null); }}>Delete</MenuItem>
                        </Menu>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
